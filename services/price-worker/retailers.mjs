import { readFileSync } from "node:fs";

const configuredRetailers = JSON.parse(readFileSync(new URL("./retailers.config.json", import.meta.url), "utf8"));

export const retailers = configuredRetailers.map(source => ({
  ...source,
  userAgent: "Solar4UPriceResearch/0.1 (+local respectful price research; contact configured by operator)",
  schedule: "00:00 America/New_York",
  status: "pending_policy_review",
  discovery: "robots-sitemap-jsonld",
  maxConcurrency: 1,
  discoveryJitterMs: [2500, 8000],
  pageDelayMs: 60_000,
  termsUrl: source.termsUrl || `${new URL(source.baseUrl).origin}/policies/terms-of-service`,
}));

export function getRetailer(id) {
  return retailers.find(retailer => retailer.id === id);
}
