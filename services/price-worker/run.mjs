import { randomUUID } from "node:crypto";
import { ensureCatalogSchema } from "../shared/catalog-schema.mjs";
import { retailers, getRetailer } from "./retailers.mjs";
import { RespectfulRetailerAdapter } from "./adapter.mjs";
import {
  getCheckpoint,
  getPageState,
  persistPage,
  recordRun,
  updateCheckpoint,
  updatePageState,
  upsertRetailer,
  getSourceSetting,
  getAdminRetailer,
} from "./store.mjs";

function easternDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export async function runRetailer(retailer, options = {}) {
  await ensureCatalogSchema();
  await upsertRetailer(retailer, "pending_policy_review", "Policy check queued");
  const id = randomUUID();
  const runDate = options.runDate || easternDate();
  const startedAt = new Date().toISOString();
  const checkpoint = await getCheckpoint(retailer.id, runDate);
  const sourceSetting = await getSourceSetting(retailer.id);
  if (sourceSetting && (!sourceSetting.enabled || sourceSetting.policy_override === "disabled")) {
    const skipped = { id, retailerId: retailer.id, status: "disabled_by_policy", startedAt, finishedAt: startedAt, reason: "Disabled by local administrator", offers: 0 };
    await recordRun(skipped);
    return skipped;
  }
  if (sourceSetting?.policy_override === "authorized_integration") {
    const complete = sourceSetting.integration_kind
      && sourceSetting.authorized_source_url
      && sourceSetting.authorization_reference;
    const status = complete ? "awaiting_authorized_connector" : "pending_policy_review";
    const reason = complete
      ? `Authorized ${sourceSetting.integration_kind} registered; a source-specific connector is required before collection`
      : "Authorized integration configuration is incomplete";
    const pending = { id, retailerId: retailer.id, status, startedAt, finishedAt: startedAt, reason, offers: 0 };
    await upsertRetailer(retailer, status, reason);
    await recordRun(pending);
    return pending;
  }
  if (checkpoint.status === "completed" && !options.force) {
    return { id, retailerId: retailer.id, status: "already_completed_today", startedAt, finishedAt: startedAt, offers: checkpoint.offerCount || 0 };
  }
  let processed = checkpoint.nextIndex || 0;
  let persisted = checkpoint.offerCount || 0;
  let discovered = 0;
  try {
    const adapter = new RespectfulRetailerAdapter(retailer, {
      pageDelayMs: sourceSetting?.page_delay_ms,
      maxPages: sourceSetting?.max_pages,
      ...options.adapterOptions,
    });
    const result = await adapter.scrape({
      startIndex: options.force ? 0 : checkpoint.nextIndex || 0,
      pageState: url => getPageState(retailer.id, url),
      onPage: async page => {
        const stored = await persistPage(retailer, page.offers, id);
        persisted += stored.persisted || 0;
        processed = page.index + 1;
        await updatePageState(retailer.id, page);
        await updateCheckpoint(retailer.id, runDate, {
          status: "running",
          nextIndex: processed,
          discovered,
          processed,
          offerCount: persisted,
          lastUrl: page.url,
        });
      },
    });
    discovered = result.discovered || 0;
    const status = result.status === "enabled" ? "completed" : result.status;
    await upsertRetailer(retailer, result.status, result.reason);
    await updateCheckpoint(retailer.id, runDate, {
      status,
      nextIndex: status === "completed" ? discovered : processed,
      discovered,
      processed,
      offerCount: persisted,
      reason: result.reason,
    });
    const run = {
      id,
      retailerId: retailer.id,
      status,
      startedAt,
      finishedAt: new Date().toISOString(),
      discovered,
      offers: persisted,
      persisted,
      reason: result.reason,
    };
    await recordRun(run);
    console.log(JSON.stringify(run));
    return run;
  } catch (error) {
    const status = error.policyStatus || "failed";
    await upsertRetailer(retailer, status, error.message);
    await updateCheckpoint(retailer.id, runDate, {
      status,
      nextIndex: processed,
      discovered,
      processed,
      offerCount: persisted,
      reason: error.message,
    });
    const run = {
      id,
      retailerId: retailer.id,
      status,
      startedAt,
      finishedAt: new Date().toISOString(),
      discovered,
      offers: persisted,
      error: error.message,
    };
    await recordRun(run);
    console.error(JSON.stringify(run));
    return run;
  }
}

export async function runAll(selectedId, options = {}) {
  const selectedRetailer = selectedId ? (getRetailer(selectedId) || await getAdminRetailer(selectedId)) : null;
  const selected = selectedId ? [selectedRetailer].filter(Boolean) : retailers;
  if (!selected.length) throw new Error(`Unknown retailer: ${selectedId}`);
  const results = new Array(selected.length);
  let cursor = 0;
  const concurrency = selectedId ? 1 : Math.min(Math.max(Number(process.env.SCRAPER_RETAILER_CONCURRENCY || 12), 1), selected.length);
  const workers = Array.from({ length: concurrency }, async () => {
    while (cursor < selected.length) {
      const index = cursor++;
      results[index] = await runRetailer(selected[index], options);
    }
  });
  await Promise.all(workers);
  return results;
}

if (import.meta.url === `file://${process.argv[1].replaceAll("\\", "/")}` || process.argv[1]?.endsWith("run.mjs")) {
  await runAll(process.env.RETAILER_ID || process.argv[2], { force: process.env.SCRAPER_FORCE === "true" });
}
