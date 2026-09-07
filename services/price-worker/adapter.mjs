import { createHash } from "node:crypto";
import { classifySolarProduct, extractSolarSpecifications } from "../shared/product-taxonomy.mjs";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const textContent = value => String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const lower = value => textContent(value).toLowerCase();

function rulesForAgent(text, userAgent = "*") {
  const groups = [];
  let agents = [];
  let rules = [];
  const flush = () => {
    if (agents.length) groups.push({ agents, rules });
    agents = [];
    rules = [];
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split("#")[0].trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === "user-agent") {
      if (rules.length) flush();
      agents.push(value.toLowerCase());
    } else if (["allow", "disallow"].includes(key) && agents.length) {
      rules.push({ type: key, path: value });
    }
  }
  flush();
  const agent = userAgent.toLowerCase();
  const matching = groups.filter(group => group.agents.some(item => item === "*" || agent.includes(item)));
  const specific = matching.filter(group => group.agents.some(item => item !== "*"));
  return (specific.length ? specific : matching).flatMap(group => group.rules);
}

export function robotsAllows(text, pathname, userAgent = "*") {
  const matches = rulesForAgent(text, userAgent)
    .filter(rule => rule.path && pathname.startsWith(rule.path.replace(/\*.*$/, "")))
    .sort((a, b) => b.path.length - a.path.length);
  return !matches.length || matches[0].type === "allow";
}

function extractSitemaps(text, baseUrl) {
  const robots = [...text.matchAll(/^sitemap:\s*(.+)$/gim)].map(match => match[1].trim());
  return robots.length ? robots : [`${new URL(baseUrl).origin}/sitemap.xml`];
}

function extractLocs(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map(match => match[1].replaceAll("&amp;", "&").trim());
}

function flattenJsonLd(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  if (value["@graph"]) return flattenJsonLd(value["@graph"]);
  if (value.itemListElement) return [value, ...flattenJsonLd(value.itemListElement.map(item => item.item || item))];
  return [value];
}

function jsonLdBlocks(html) {
  const blocks = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      blocks.push(...flattenJsonLd(JSON.parse(match[1].trim())));
    } catch {}
  }
  return blocks;
}

function numberFrom(text, pattern) {
  const match = text.match(pattern);
  return match ? Number(match[1].replaceAll(",", "")) : undefined;
}

function inferSubcategory(category, text) {
  const value = lower(text);
  const checks = {
    generation: [["Bifacial", /bifacial/], ["Flexible / semi-flexible", /flexible|cigs|semi-flex/], ["Monofacial", /monofacial|solar panel|pv module/]],
    inverters: [["All-in-one power station", /power station|solar generator/], ["Microinverter", /microinverter/], ["Hybrid", /hybrid/], ["Grid-tie / string", /grid.?tie|string inverter/], ["Off-grid", /off.?grid/]],
    controllers: [["MPPT", /mppt/], ["PWM", /pwm/]],
    storage: [["High-voltage battery", /high.?voltage|\b[1234]\d{2}\s*v/], ["LiFePO4 cells", /prismatic|cell/], ["BMS / balancer", /\bbms\b|balancer/], ["Battery hardware", /busbar|terminal cover|compression/], ["Rack / wall battery", /rack|wall|battery/]],
    protection: [["Combiner box", /combiner/], ["Surge protection", /surge|\bspd\b/], ["Fuse / breaker", /fuse|breaker/], ["Disconnect", /disconnect|isolator/], ["Grounding", /ground/]],
    wiring: [["PV wire", /pv wire|solar cable/], ["Battery cable", /battery cable|[124]\/0\s*awg/], ["AC wire", /thhn|thwn|ac wire/], ["Connectors / terminals", /mc4|lug|ferrule|terminal/], ["Weatherproofing", /gland|entry housing|weather/]],
    mounting: [["Ground mount", /ground mount|ground screw/], ["Roof mount", /roof|flashing|tile hook|standing seam/], ["Clamps / hardware", /clamp|rail|bracket/]],
    monitoring: [["System gateway", /gateway|cerbo/], ["Battery shunt", /shunt/], ["Home energy monitor", /energy monitor|ct clamp/], ["Communications cable", /rs485|can bus|communication/]],
    tools: [["Crimping", /crimp/], ["Testing", /meter|tester/], ["Safety / PPE", /ppe|glove|arc flash|eye protection/], ["Solar-specific tools", /mc4 wrench|pv stripper/]],
  };
  return checks[category]?.find(([, pattern]) => pattern.test(value))?.[0] || "Other";
}

function normalizeOffers(offers) {
  if (!offers) return [];
  if (Array.isArray(offers)) return offers;
  return [offers];
}

export function normalizeProduct(node, retailer, sourceUrl, observedAt = new Date()) {
  if (!node || !String(node["@type"] || "").toLowerCase().includes("product")) return [];
  const title = textContent(node.name);
  if (!title) return [];
  const description = textContent(node.description);
  const combined = `${title} ${description}`;
  const classification = classifySolarProduct(title, description, node.category);
  const { category, pickerCategory } = classification;
  const base = {
    retailerId: retailer.id,
    sourceUrl,
    sourceProductId: node.sku || node.productID || node.mpn || undefined,
    title,
    brand: typeof node.brand === "string" ? node.brand : node.brand?.name,
    model: node.model || node.mpn || node.sku,
    description,
    category,
    pickerCategory,
    pickerSubcategory: inferSubcategory(pickerCategory, combined),
    condition: lower(node.itemCondition).includes("used") ? "used" : "new",
    quantity: 1,
    watts: numberFrom(combined, /\b([\d,.]+)\s*(?:w|watt)\b/i),
    wattHours: (() => {
      const kwh = numberFrom(combined, /\b([\d,.]+)\s*kwh\b/i);
      return kwh ? kwh * 1000 : numberFrom(combined, /\b([\d,.]+)\s*wh\b/i);
    })(),
    voltage: numberFrom(combined, /\b([\d,.]+)\s*v(?:olt)?\b/i),
    currentAmps: numberFrom(combined, /\b([\d,.]+)\s*a(?:mp)?\b/i),
    widthMm: numberFrom(combined, /\b([\d,.]+)\s*(?:mm|millimeter)s?\s*(?:w|wide|width)\b/i),
    heightMm: numberFrom(combined, /\b([\d,.]+)\s*(?:mm|millimeter)s?\s*(?:h|high|height|long)\b/i),
    imageUrl: Array.isArray(node.image) ? node.image[0] : typeof node.image === "object" ? node.image?.url : node.image,
    classificationConfidence: classification.confidence,
    classificationSource: classification.source,
    specifications: extractSolarSpecifications(title, description, {
      cellTechnology: textContent(combined.match(/\b(TOPCon|HJT|PERC|shingled|back contact|CIGS)\b/i)?.[1]),
      sourceCategory: textContent(node.category),
      gtin: node.gtin13 || node.gtin12 || node.gtin,
    }),
  };
  const dailyObservation = new Date(observedAt);
  dailyObservation.setUTCHours(12, 0, 0, 0);
  return normalizeOffers(node.offers).flatMap(offer => {
    const price = Number(offer.price || offer.lowPrice);
    if (!Number.isFinite(price) || price <= 0) return [];
    const availability = textContent(offer.availability || offer.availabilityStarts || "");
    const evidenceHash = createHash("sha256").update(JSON.stringify({ title, price, availability, sourceUrl })).digest("hex");
    return [{
      ...base,
      price: { amount: price, currency: offer.priceCurrency || "USD" },
      originalPrice: Number(offer.highPrice) || undefined,
      shipping: Number(offer.shippingDetails?.shippingRate?.value) || undefined,
      availability,
      inStock: !lower(availability).includes("outofstock") && !lower(availability).includes("soldout"),
      seller: textContent(offer.seller?.name),
      observedAt: dailyObservation.toISOString(),
      evidenceHash,
    }];
  });
}

function explicitAutomationProhibition(terms) {
  const text = lower(terms);
  return /(?:may not|must not|prohibited|do not|not permitted)[^.!]{0,120}(?:scrap|crawl|spider|robot|automated)/i.test(text)
    || /(?:scrap|crawl|spider|robot|automated)[^.!]{0,120}(?:may not|must not|prohibited|not permitted)/i.test(text);
}

function challengeDetected(html) {
  return /cf-chl-|cloudflare ray id|verify you are human|captcha|access denied/i.test(html);
}

export class RespectfulRetailerAdapter {
  constructor(retailer, options = {}) {
    this.retailer = retailer;
    this.fetch = options.fetch || globalThis.fetch;
    this.maxPages = Number(options.maxPages || process.env.MAX_PAGES_PER_RETAILER || 50);
    this.discoveryDelay = Number(options.discoveryDelayMs ?? process.env.SCRAPER_DISCOVERY_DELAY_MS ?? retailer.discoveryJitterMs?.[0] ?? 2500);
    this.pageDelay = Number(options.pageDelayMs ?? process.env.SCRAPER_PAGE_DELAY_MS ?? retailer.pageDelayMs ?? 60_000);
    this.jitter = options.jitter ?? process.env.SCRAPER_DISABLE_JITTER !== "true";
    this.robotsText = "";
  }

  async request(url, { productPage = false, headers = {} } = {}) {
    const baseDelay = productPage ? this.pageDelay : this.discoveryDelay;
    if (this.jitter && baseDelay > 0) await sleep(baseDelay + Math.random() * Math.min(baseDelay * 0.15, 5000));
    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await this.fetch(url, {
          redirect: "follow",
          headers: {
            "user-agent": `${this.retailer.userAgent}; ${process.env.SCRAPER_CONTACT || "local-operator"}`,
            accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.2",
            "accept-language": "en-US,en;q=0.8",
            ...headers,
          },
          signal: AbortSignal.timeout(Number(process.env.SCRAPER_TIMEOUT_MS || 30_000)),
        });
        if ([401, 403].includes(response.status)) throw Object.assign(new Error(`source_rejected_${response.status}`), { policyStatus: "disabled_by_policy" });
        if (response.status === 429) {
          const retryAfter = Math.min(Number(response.headers?.get?.("retry-after") || 60) * 1000, 15 * 60_000);
          await sleep(retryAfter);
          throw Object.assign(new Error("source_rate_limited"), { policyStatus: "degraded" });
        }
        if (response.status === 304) return response;
        if (!response.ok) throw new Error(`source_http_${response.status}`);
        return response;
      } catch (error) {
        lastError = error;
        if (error.policyStatus === "disabled_by_policy" || attempt === 2) throw error;
        await sleep(Math.min(2 ** attempt * 5000, 30_000));
      }
    }
    throw lastError;
  }

  async policy() {
    try {
      const robotsUrl = `${new URL(this.retailer.baseUrl).origin}/robots.txt`;
      const response = await this.request(robotsUrl);
      this.robotsText = await response.text();
      if (!robotsAllows(this.robotsText, "/", this.retailer.userAgent)) {
        return { allowed: false, reason: "robots_disallows_site", sitemaps: [] };
      }
      let termsNote = "terms_not_found_or_no_explicit_automation_prohibition";
      try {
        const termsResponse = await this.request(this.retailer.termsUrl);
        const terms = await termsResponse.text();
        if (explicitAutomationProhibition(terms)) return { allowed: false, reason: "terms_explicitly_prohibit_automated_collection", sitemaps: [] };
        termsNote = "terms_reviewed_no_explicit_automation_prohibition_detected";
      } catch (error) {
        if (error.policyStatus === "disabled_by_policy") return { allowed: false, reason: "terms_page_rejected_automation", sitemaps: [] };
      }
      return { allowed: true, reason: termsNote, sitemaps: extractSitemaps(this.robotsText, this.retailer.baseUrl) };
    } catch (error) {
      if (error.policyStatus) return { allowed: false, reason: error.message, sitemaps: [] };
      return { allowed: false, reason: "robots_unavailable_cautious_disable", sitemaps: [] };
    }
  }

  async discover() {
    const policy = await this.policy();
    if (!policy.allowed) return { status: "disabled_by_policy", reason: policy.reason, urls: [] };
    const found = [];
    const queue = policy.sitemaps.slice(0, 5);
    const visited = new Set();
    while (queue.length && found.length < this.maxPages && visited.size < 25) {
      const sitemap = queue.shift();
      if (!sitemap || visited.has(sitemap)) continue;
      visited.add(sitemap);
      try {
        const response = await this.request(sitemap);
        const xml = await response.text();
        const locs = extractLocs(xml);
        for (const url of locs) {
          if (/sitemap/i.test(url) && queue.length < 20) queue.push(url);
          else {
            const parsed = new URL(url);
            if (parsed.origin === new URL(this.retailer.baseUrl).origin
              && robotsAllows(this.robotsText, parsed.pathname, this.retailer.userAgent)
              && /product|products|shop\/|collections\/[^/]+\/products/i.test(parsed.pathname)) found.push(url);
          }
          if (found.length >= this.maxPages) break;
        }
      } catch {}
    }
    return { status: "enabled", reason: policy.reason, urls: [...new Set(found)].slice(0, this.maxPages) };
  }

  async scrape({ startIndex = 0, pageState = () => ({}), onPage = async () => {} } = {}) {
    const discovery = await this.discover();
    if (discovery.status !== "enabled") return { retailerId: this.retailer.id, ...discovery, offers: [] };
    let offerCount = 0;
    for (let index = startIndex; index < discovery.urls.length; index++) {
      const url = discovery.urls[index];
      const prior = await pageState(url);
      try {
        const response = await this.request(url, {
          productPage: index > startIndex,
          headers: {
            ...(prior.etag ? { "if-none-match": prior.etag } : {}),
            ...(prior.lastModified ? { "if-modified-since": prior.lastModified } : {}),
          },
        });
        if (response.status === 304) {
          await onPage({ url, index, offers: [], unchanged: true, etag: prior.etag, lastModified: prior.lastModified });
          continue;
        }
        const html = await response.text();
        if (challengeDetected(html)) {
          return { retailerId: this.retailer.id, status: "disabled_by_policy", reason: "bot_challenge_detected_no_bypass", discovered: discovery.urls.length, offerCount };
        }
        const offers = jsonLdBlocks(html).flatMap(node => normalizeProduct(node, this.retailer, url));
        offerCount += offers.length;
        await onPage({
          url,
          index,
          offers,
          unchanged: false,
          etag: response.headers?.get?.("etag") || null,
          lastModified: response.headers?.get?.("last-modified") || null,
        });
      } catch (error) {
        await onPage({ url, index, offers: [], error: error.message });
        if (error.policyStatus) return { retailerId: this.retailer.id, status: error.policyStatus, reason: error.message, discovered: discovery.urls.length, offerCount };
      }
    }
    return { retailerId: this.retailer.id, status: "enabled", reason: discovery.reason, discovered: discovery.urls.length, offerCount };
  }
}
