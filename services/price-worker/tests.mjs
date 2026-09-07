import test from "node:test";
import assert from "node:assert/strict";
import { retailers } from "./retailers.mjs";
import { RespectfulRetailerAdapter, robotsAllows } from "./adapter.mjs";

test("all requested retailer adapters are registered", () => {
  assert.equal(retailers.length, 36);
  assert.equal(new Set(retailers.map(x => x.id)).size, retailers.length);
});

test("JSON-LD product normalizes through adapter", async () => {
  const retailer = retailers[0];
  const fakeFetch = async url => {
    const body = String(url).endsWith("robots.txt") ? "User-agent: *\nSitemap: https://example.test/sitemap.xml" :
      String(url).endsWith("sitemap.xml") ? "<urlset><url><loc>https://example.test/products/battery</loc></url></urlset>" :
      `<script type="application/ld+json">{"@type":"Product","name":"Demo 5kWh Battery","brand":{"name":"Demo"},"offers":{"price":"999","priceCurrency":"USD","availability":"https://schema.org/InStock"}}</script>`;
    return { ok: true, status: 200, text: async () => body };
  };
  const pages = [];
  const result = await new RespectfulRetailerAdapter(
    { ...retailer, baseUrl: "https://example.test", termsUrl: "https://example.test/terms" },
    { fetch: fakeFetch, jitter: false, discoveryDelayMs: 0, pageDelayMs: 0 },
  ).scrape({ onPage: page => pages.push(page) });
  assert.equal(result.offerCount, 1);
  assert.equal(pages[0].offers[0].price.amount, 999);
  assert.equal(pages[0].offers[0].pickerCategory, "storage");
});

test("robots parser honors the most specific allow rule", () => {
  const robots = "User-agent: *\nDisallow: /products\nAllow: /products/public";
  assert.equal(robotsAllows(robots, "/products/private", "Solar4UPriceResearch"), false);
  assert.equal(robotsAllows(robots, "/products/public/panel", "Solar4UPriceResearch"), true);
});

test("explicit terms prohibition disables collection", async () => {
  const retailer = { ...retailers[0], baseUrl: "https://example.test", termsUrl: "https://example.test/terms" };
  const fakeFetch = async url => ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    text: async () => String(url).endsWith("robots.txt")
      ? "User-agent: *\nSitemap: https://example.test/sitemap.xml"
      : "You may not use automated robots, spiders, crawlers, or scraping tools.",
  });
  const result = await new RespectfulRetailerAdapter(retailer, { fetch: fakeFetch, jitter: false, discoveryDelayMs: 0 }).scrape();
  assert.equal(result.status, "disabled_by_policy");
  assert.match(result.reason, /terms_explicitly_prohibit/);
});
