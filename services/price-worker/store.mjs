import { createHash } from "node:crypto";
import pg from "pg";

const { Pool } = pg;
let pool;

const normalizeKey = value => String(value || "")
  .toLowerCase()
  .replace(/\b(the|new|sale|free shipping)\b/g, " ")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const slugify = value => normalizeKey(value).replaceAll(" ", "-").slice(0, 76) || "solar-product";

function canonicalProductId(offer) {
  const identity = offer.brand && offer.model
    ? `${normalizeKey(offer.brand)}|${normalizeKey(offer.model)}`
    : `${normalizeKey(offer.brand)}|${normalizeKey(offer.title)}`;
  return createHash("sha1").update(identity).digest("hex");
}

function db() {
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return pool;
}

async function refreshProductSummary(client, productId) {
  await client.query(
    `update products p set
       current_low_price=summary.low_price,
       current_retailer_count=summary.retailer_count,
       current_image_url=coalesce(summary.image_url,p.current_image_url),
       current_condition=summary.condition,
       current_stock_status=case when summary.in_stock then 'In stock' else 'Out of stock' end,
       updated_at=now()
     from (
       select min(price) filter(where in_stock) low_price,
              count(distinct retailer_id) retailer_count,
              (array_agg(image_url order by (image_url is not null) desc,last_observed_at desc))[1] image_url,
              (array_agg(condition order by price asc))[1] condition,
              bool_or(in_stock) in_stock
       from retailer_offers where product_id=$1
     ) summary
     where p.id=$1`,
    [productId],
  );
}

export async function persistPage(retailer, offers, runId) {
  if (!process.env.DATABASE_URL) return { persisted: 0, mode: "dry_run" };
  const client = await db().connect();
  try {
    await client.query("begin");
    let persisted = 0;
    const touched = new Set();
    for (const offer of offers || []) {
      const id = canonicalProductId(offer);
      const slug = `${slugify(`${offer.brand || ""} ${offer.model || offer.title}`)}-${id.slice(0, 7)}`;
      touched.add(id);
      await client.query(
        `insert into products(
           id,slug,name,brand,model,category,description,watts,capacity_wh,voltage,
           picker_category,picker_subcategory,specifications,search_text,current_image_url,current_condition,
           taxonomy_confidence,taxonomy_source
         )
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         on conflict(id) do update set
           slug=coalesce(products.slug,excluded.slug),
           name=excluded.name,
           brand=coalesce(excluded.brand,products.brand),
           model=coalesce(excluded.model,products.model),
           category=case when excluded.category='other' then products.category else excluded.category end,
           description=case when length(coalesce(excluded.description,''))>length(coalesce(products.description,'')) then excluded.description else products.description end,
           watts=coalesce(excluded.watts,products.watts),
           capacity_wh=coalesce(excluded.capacity_wh,products.capacity_wh),
           voltage=coalesce(excluded.voltage,products.voltage),
           picker_category=case when excluded.picker_category='other' then products.picker_category else excluded.picker_category end,
           picker_subcategory=case when excluded.picker_subcategory='Other' then products.picker_subcategory else excluded.picker_subcategory end,
           specifications=products.specifications || excluded.specifications,
           search_text=excluded.search_text,
           current_image_url=coalesce(excluded.current_image_url,products.current_image_url),
           current_condition=excluded.current_condition,
           taxonomy_confidence=case when products.taxonomy_source in ('admin','community_confirmed') then products.taxonomy_confidence else excluded.taxonomy_confidence end,
           taxonomy_source=case when products.taxonomy_source in ('admin','community_confirmed') then products.taxonomy_source else excluded.taxonomy_source end,
           updated_at=now()`,
        [
          id,
          slug,
          offer.title,
          offer.brand,
          offer.model,
          offer.category,
          offer.description,
          offer.watts,
          offer.wattHours,
          offer.voltage,
          offer.pickerCategory,
          offer.pickerSubcategory,
          JSON.stringify({ ...offer.specifications, currentAmps: offer.currentAmps, widthMm: offer.widthMm, heightMm: offer.heightMm }),
          `${offer.title} ${offer.brand || ""} ${offer.model || ""} ${offer.category} ${offer.pickerSubcategory || ""}`,
          offer.imageUrl,
          offer.condition,
          offer.classificationConfidence,
          offer.classificationSource,
        ],
      );
      const offerResult = await client.query(
        `insert into retailer_offers(
           retailer_id,product_id,source_url,source_product_id,price,original_price,shipping,currency,
           in_stock,availability_text,condition,quantity,image_url,seller,evidence_hash,last_observed_at
         )
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         on conflict(retailer_id,source_url) do update set
           product_id=excluded.product_id,
           source_product_id=coalesce(excluded.source_product_id,retailer_offers.source_product_id),
           price=excluded.price,
           original_price=coalesce(excluded.original_price,retailer_offers.original_price),
           shipping=excluded.shipping,
           currency=excluded.currency,
           in_stock=excluded.in_stock,
           availability_text=excluded.availability_text,
           condition=excluded.condition,
           quantity=excluded.quantity,
           image_url=coalesce(excluded.image_url,retailer_offers.image_url),
           seller=coalesce(excluded.seller,retailer_offers.seller),
           evidence_hash=excluded.evidence_hash,
           last_observed_at=excluded.last_observed_at
         returning id`,
        [
          offer.retailerId,
          id,
          offer.sourceUrl,
          offer.sourceProductId,
          offer.price.amount,
          offer.originalPrice,
          offer.shipping,
          offer.price.currency,
          offer.inStock,
          offer.availability,
          offer.condition,
          offer.quantity,
          offer.imageUrl,
          offer.seller,
          offer.evidenceHash,
          offer.observedAt,
        ],
      );
      await client.query(
        `insert into price_observations(offer_id,product_id,retailer_id,price,shipping,currency,in_stock,observed_at,evidence_hash,run_id)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         on conflict(offer_id,observed_at) do update set
           price=excluded.price,shipping=excluded.shipping,in_stock=excluded.in_stock,
           evidence_hash=excluded.evidence_hash,run_id=excluded.run_id`,
        [offerResult.rows[0].id, id, offer.retailerId, offer.price.amount, offer.shipping, offer.price.currency, offer.inStock, offer.observedAt, offer.evidenceHash, runId],
      );
      persisted++;
    }
    for (const productId of touched) await refreshProductSummary(client, productId);
    await client.query("commit");
    return { persisted, mode: "database" };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function upsertRetailer(retailer, status, reason = null) {
  if (!process.env.DATABASE_URL) return;
  await db().query(
    `insert into retailers(id,name,base_url,status,policy_note,last_checked_at)
     values($1,$2,$3,$4,$5,now())
     on conflict(id) do update set
       name=excluded.name,base_url=excluded.base_url,status=excluded.status,
       policy_note=excluded.policy_note,last_checked_at=excluded.last_checked_at`,
    [retailer.id, retailer.name, retailer.baseUrl, status, reason],
  );
}

export async function getCheckpoint(retailerId, runDate) {
  if (!process.env.DATABASE_URL) return { nextIndex: 0, status: "new" };
  const result = await db().query("select * from scraper_checkpoints where retailer_id=$1 and run_date=$2", [retailerId, runDate]);
  const row = result.rows[0];
  if (!row) return { nextIndex: 0, status: "new" };
  return { nextIndex: row.next_index, status: row.status, offerCount: row.offer_count };
}

export async function updateCheckpoint(retailerId, runDate, patch) {
  if (!process.env.DATABASE_URL) return;
  await db().query(
    `insert into scraper_checkpoints(
       retailer_id,run_date,status,next_index,discovered_count,processed_count,offer_count,last_url,policy_reason,updated_at
     ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
     on conflict(retailer_id) do update set
       run_date=excluded.run_date,status=excluded.status,next_index=excluded.next_index,
       discovered_count=excluded.discovered_count,processed_count=excluded.processed_count,
       offer_count=excluded.offer_count,last_url=excluded.last_url,
       policy_reason=excluded.policy_reason,updated_at=now()`,
    [
      retailerId,
      runDate,
      patch.status || "running",
      patch.nextIndex || 0,
      patch.discovered || 0,
      patch.processed || 0,
      patch.offerCount || 0,
      patch.lastUrl || null,
      patch.reason || null,
    ],
  );
}

export async function getPageState(retailerId, sourceUrl) {
  if (!process.env.DATABASE_URL) return {};
  const result = await db().query(
    "select etag,last_modified from scraper_page_cache where retailer_id=$1 and source_url=$2",
    [retailerId, sourceUrl],
  );
  return result.rows[0] ? { etag: result.rows[0].etag, lastModified: result.rows[0].last_modified } : {};
}

export async function updatePageState(retailerId, page) {
  if (!process.env.DATABASE_URL) return;
  await db().query(
    `insert into scraper_page_cache(
       retailer_id,source_url,etag,last_modified,last_status,last_error,last_fetched_at
     ) values($1,$2,$3,$4,$5,$6,now())
     on conflict(retailer_id,source_url) do update set
       etag=coalesce(excluded.etag,scraper_page_cache.etag),
       last_modified=coalesce(excluded.last_modified,scraper_page_cache.last_modified),
       last_status=excluded.last_status,last_error=excluded.last_error,last_fetched_at=now()`,
    [retailerId, page.url, page.etag, page.lastModified, page.error ? "failed" : page.unchanged ? "unchanged" : "fetched", page.error || null],
  );
}

export async function recordRun(run) {
  if (!process.env.DATABASE_URL) return;
  await db().query(
    `insert into scraper_runs(id,retailer_id,status,started_at,finished_at,discovered_count,offer_count,error)
     values($1,$2,$3,$4,$5,$6,$7,$8)
     on conflict(id) do update set status=excluded.status,finished_at=excluded.finished_at,
       discovered_count=excluded.discovered_count,offer_count=excluded.offer_count,error=excluded.error`,
    [run.id, run.retailerId, run.status, run.startedAt, run.finishedAt, run.discovered || 0, run.offers || 0, run.error || run.reason || null],
  );
}

export async function adminOverview() {
  if (!process.env.DATABASE_URL) return { sources: [], runs: [], summary: {} };
  const [sources, runs, summary, pages] = await Promise.all([
    db().query(
      `select r.id,r.name,r.base_url,r.status,r.policy_note,r.last_checked_at,
        coalesce(s.enabled,true) enabled,coalesce(s.schedule_time,'00:00') schedule_time,
        coalesce(s.page_delay_ms,60000) page_delay_ms,coalesce(s.max_pages,500) max_pages,
        coalesce(s.policy_override,'follow_policy') policy_override,s.integration_kind,
        s.authorized_source_url,s.authorization_reference,s.updated_at,
        c.status checkpoint_status,c.discovered_count,c.processed_count,c.offer_count,c.last_url,c.updated_at checkpoint_updated_at
       from retailers r left join scraper_source_settings s on s.retailer_id=r.id
       left join scraper_checkpoints c on c.retailer_id=r.id order by r.name`,
    ),
    db().query(
      `select sr.id,sr.retailer_id,r.name retailer,sr.status,sr.started_at,sr.finished_at,
        sr.discovered_count,sr.offer_count,sr.error
       from scraper_runs sr left join retailers r on r.id=sr.retailer_id
       order by sr.started_at desc limit 100`,
    ),
    db().query(
      `select
        (select count(*)::int from retailers) sources,
        (select count(*)::int from scraper_runs where started_at >= date_trunc('day',now())) runs_today,
        (select coalesce(sum(offer_count),0)::int from scraper_runs where started_at >= date_trunc('day',now())) offers_today,
        (select count(*)::int from scraper_runs where started_at >= date_trunc('day',now()) and status in ('failed','degraded')) issues_today,
        (select count(*)::int from products) products,
        (select count(*)::int from price_observations) observations`,
    ),
    db().query(
      `select retailer_id,last_status,last_error,source_url,last_fetched_at
       from scraper_page_cache order by last_fetched_at desc nulls last limit 60`,
    ),
  ]);
  return { sources: sources.rows, runs: runs.rows, summary: summary.rows[0], pages: pages.rows };
}

export async function updateSourceSetting(retailerId, patch) {
  if (!process.env.DATABASE_URL) return null;
  const policyOverride = ["follow_policy", "authorized_integration", "disabled"].includes(patch.policyOverride)
    ? patch.policyOverride
    : "follow_policy";
  const integrationKind = ["api", "feed", "manual_import"].includes(patch.integrationKind)
    ? patch.integrationKind
    : null;
  const authorizedSourceUrl = String(patch.authorizedSourceUrl || "").trim().slice(0, 2000) || null;
  const authorizationReference = String(patch.authorizationReference || "").trim().slice(0, 2000) || null;
  if (policyOverride === "authorized_integration" && (!integrationKind || !authorizedSourceUrl || !authorizationReference)) {
    throw new Error("authorized_integration_requires_kind_source_and_reference");
  }
  const result = await db().query(
    `insert into scraper_source_settings(
       retailer_id,enabled,schedule_time,page_delay_ms,max_pages,policy_override,
       integration_kind,authorized_source_url,authorization_reference,updated_by
     )
     values($1,$2,$3,$4,$5,$6,$7,$8,$9,'00000000-0000-0000-0000-000000000001')
     on conflict(retailer_id) do update set enabled=excluded.enabled,schedule_time=excluded.schedule_time,
       page_delay_ms=excluded.page_delay_ms,max_pages=excluded.max_pages,policy_override=excluded.policy_override,
       integration_kind=excluded.integration_kind,authorized_source_url=excluded.authorized_source_url,
       authorization_reference=excluded.authorization_reference,
       updated_by=excluded.updated_by,updated_at=now()
     returning *`,
    [
      retailerId,
      patch.enabled !== false,
      /^\d{2}:\d{2}$/.test(patch.scheduleTime || "") ? patch.scheduleTime : "00:00",
      Math.min(Math.max(Number(patch.pageDelayMs || 60000), 5000), 900000),
      Math.min(Math.max(Number(patch.maxPages || 500), 1), 10000),
      policyOverride,
      policyOverride === "authorized_integration" ? integrationKind : null,
      policyOverride === "authorized_integration" ? authorizedSourceUrl : null,
      policyOverride === "authorized_integration" ? authorizationReference : null,
    ],
  );
  return result.rows[0];
}

export async function getSourceSetting(retailerId) {
  if (!process.env.DATABASE_URL) return null;
  const result = await db().query("select * from scraper_source_settings where retailer_id=$1", [retailerId]);
  return result.rows[0] || null;
}

export async function getAdminRetailer(retailerId) {
  if (!process.env.DATABASE_URL) return null;
  const result = await db().query(
    `select r.id,r.name,r.base_url,coalesce(s.page_delay_ms,60000) page_delay_ms,
      coalesce(s.max_pages,500) max_pages
     from retailers r left join scraper_source_settings s on s.retailer_id=r.id where r.id=$1`,
    [retailerId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id, name: row.name, baseUrl: row.base_url,
    termsUrl: `${new URL(row.base_url).origin}/policies/terms-of-service`,
    userAgent: "Solar4UPriceResearch/0.1 (+local respectful price research; contact configured by operator)",
    schedule: "00:00 America/New_York", status: "pending_policy_review",
    discovery: "robots-sitemap-jsonld", maxConcurrency: 1, discoveryJitterMs: [2500, 8000],
    pageDelayMs: row.page_delay_ms,
  };
}

export async function addAdminSource({ id, name, baseUrl }) {
  if (!process.env.DATABASE_URL) return null;
  const normalizedId = String(id || name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  const parsed = new URL(baseUrl);
  const result = await db().query(
    `insert into retailers(id,name,base_url,status,policy_note)
     values($1,$2,$3,'pending_policy_review','Added through local admin; policy review required before collection')
     on conflict(id) do update set name=excluded.name,base_url=excluded.base_url,status='pending_policy_review',policy_note=excluded.policy_note
     returning *`,
    [normalizedId, String(name || parsed.hostname).slice(0, 120), parsed.origin],
  );
  await updateSourceSetting(normalizedId, { enabled: true, scheduleTime: "00:00", pageDelayMs: 60000, maxPages: 500, policyOverride: "follow_policy" });
  return result.rows[0];
}

export function closeStore() {
  return pool?.end();
}
