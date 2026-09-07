import { serve, json, readJson } from "../shared/http.mjs";
import { ensureCatalogSchema } from "../shared/catalog-schema.mjs";
import { retailers } from "./retailers.mjs";
import { runAll } from "./run.mjs";
import { addAdminSource, adminOverview, updateSourceSetting } from "./store.mjs";

let running = false;
let lastRun = null;
const adminToken = process.env.ADMIN_TOKEN || "solar4u-local-admin";
const authorized = request => request.headers["x-solar4u-admin-token"] === adminToken;

function easternParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit" });
  return Object.fromEntries(formatter.formatToParts(date).filter(p => p.type !== "literal").map(p => [p.type, p.value]));
}

async function scheduledTick() {
  const now = easternParts();
  const day = `${now.year}-${now.month}-${now.day}`;
  if (now.hour === "00" && now.minute < "05" && lastRun !== day && !running) {
    running = true;
    lastRun = day;
    try { await runAll(); } finally { running = false; }
  }
}
setInterval(scheduledTick, 60_000).unref();
await ensureCatalogSchema();

serve({
  name: "price-worker",
  port: Number(process.env.PORT || 4004),
  router: async (request, response, requestId) => {
    const url = new URL(request.url, "http://local");
    if (url.pathname.startsWith("/v1/admin/") && !authorized(request)) return json(response, 403, { error: "admin_required" }, requestId) || true;
    if (request.method === "GET" && url.pathname === "/v1/admin/overview") return json(response, 200, { data: { ...(await adminOverview()), runtime: { running, lastRun, retailerCount: retailers.length } } }, requestId) || true;
    if (request.method === "POST" && url.pathname === "/v1/admin/sources") {
      const body = await readJson(request);
      try {
        return json(response, 201, { data: await addAdminSource(body) }, requestId) || true;
      } catch {
        return json(response, 400, { error: "invalid_source" }, requestId) || true;
      }
    }
    if (request.method === "PATCH" && url.pathname.match(/^\/v1\/admin\/sources\/[^/]+$/)) {
      const retailerId = decodeURIComponent(url.pathname.split("/").at(-1));
      if (!retailers.some(item => item.id === retailerId)) return json(response, 404, { error: "retailer_not_found" }, requestId) || true;
      try {
        return json(response, 200, { data: await updateSourceSetting(retailerId, await readJson(request)) }, requestId) || true;
      } catch (error) {
        return json(response, 400, { error: error.message }, requestId) || true;
      }
    }
    if (request.method === "POST" && url.pathname === "/v1/scraper/run") {
      if (!authorized(request)) return json(response, 403, { error: "admin_required" }, requestId) || true;
      if (running) return json(response, 409, { error: "scrape_already_running" }, requestId) || true;
      const body = await readJson(request);
      running = true;
      runAll(body.retailerId, { force: body.force === true }).finally(() => { running = false; });
      return json(response, 202, { data: { status: "started", retailerId: body.retailerId || "all", force: body.force === true } }, requestId) || true;
    }
    return false;
  },
});
