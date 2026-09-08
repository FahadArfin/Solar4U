import test from "node:test";
import assert from "node:assert/strict";
import worker from "../dist/server/index.js";
const env = {
  ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
};
const ctx = { waitUntil() {}, passThroughOnException() {} };
const render = (path) =>
  worker.fetch(
    new Request(`https://solar4u.example${path}`, {
      headers: { accept: "text/html" },
    }),
    env,
    ctx,
  );
test("home exposes real journeys without fabricated market totals", async () => {
  const r = await render("/");
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, /Your place/);
  assert.match(html, /\/planner/);
  assert.match(html, /\/guides/);
  assert.doesNotMatch(html, /18,420|1\.2M|126.*Price drops/);
  assert.doesNotMatch(html, /localhost:400[0-9]/);
});
test("primary routes render without server failures", async () => {
  for (const path of [
    "/planner",
    "/products",
    "/guides",
    "/calculators",
    "/dashboard",
    "/diagnostics",
    "/solar-part-picker",
    "/build",
    "/equipment",
  ]) {
    const r = await render(path);
    assert.equal(r.status, 200, path);
    const html = await r.text();
    assert.match(html, /Main navigation/, path);
    assert.doesNotMatch(html, /http:\/\/localhost:400[0-9]/, path);
  }
});
test("health responds with a timestamp and device storage disclosure", async () => {
  const r = await render("/api/health");
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.equal(data.status, "ok");
  assert.ok(Date.parse(data.checkedAt));
  assert.match(data.projectStorage, /device/);
});
test("roof endpoints reject oversized and invalid input before requesting paid data", async () => {
  for (const [body, status] of [
    ["x".repeat(5000), 413],
    [JSON.stringify({ latitude: 91, longitude: 0 }), 400],
  ]) {
    const r = await worker.fetch(
      new Request("https://solar4u.example/api/roof", {
        method: "POST",
        body,
        headers: { "content-length": String(body.length) },
      }),
      env,
      ctx,
    );
    assert.equal(r.status, status);
  }
  const r = await render(
    "/api/roof?op=layer&latitude=0&longitude=0&radius=30&layer=https://example.com",
  );
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /Unknown roof layer/);
});
test("shared local forum identity cannot be used through hosted proxy", async () => {
  const r = await worker.fetch(
    new Request("https://solar4u.example/api/community/threads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
    env,
    ctx,
  );
  assert.equal(r.status, 403);
});
test("engine rejects invalid input and computes zero capacity honestly", async () => {
  for (const [body, status] of [
    [{ capacityKw: -1 }, 400],
    [{ capacityKw: 0, provider: "manual" }, 200],
  ]) {
    const r = await worker.fetch(
      new Request("https://solar4u.example/api/engine/v1/solar/estimates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      env,
      ctx,
    );
    assert.equal(r.status, status);
    if (status === 200) assert.equal((await r.json()).data.annualKwh, 0);
  }
});
test("engine validates every array before requesting climate data and keeps percent units", async () => {
  const post = (body) =>
    worker.fetch(
      new Request("https://solar4u.example/api/engine/v1/solar/estimates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      env,
      ctx,
    );
  for (const body of [
    { capacityKw: null },
    { arrays: [{ capacityKw: 700 }, { capacityKw: 700 }], provider: "pvgis" },
    { arrays: [{ capacityKw: 1 }, { latitude: 91 }], provider: "pvgis" },
  ])
    assert.equal((await post(body)).status, 400);
  const empty = await post({ arrays: [] });
  assert.equal((await empty.json()).data.annualKwh, 0);
  const r = await post({
    capacityKw: 10,
    costPerWatt: 3,
    incentivePercent: 30,
  });
  assert.equal((await r.json()).data.netCost, 21000);
});
