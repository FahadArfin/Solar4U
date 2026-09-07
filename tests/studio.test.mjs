import test from "node:test";
import assert from "node:assert/strict";
import {
  createPlan,
  decodePlan,
  makeSurfaces,
  panelCorners,
  groundSpacing,
  DEFAULT_SETTINGS,
  canPlace,
} from "../lib/studio.ts";
test("location survives backups, older plans migrate and invalid coordinates are rejected", () => {
  const p = createPlan();
  p.location = { latitude: -33, longitude: 151 };
  assert.deepEqual(decodePlan(JSON.stringify(p)).location, p.location);
  delete p.location;
  assert.deepEqual(decodePlan(JSON.stringify(p)).location, {
    latitude: 40,
    longitude: -75,
  });
  p.location = { latitude: 91, longitude: 0 };
  assert.throws(() => decodePlan(JSON.stringify(p)));
  p.location = { latitude: 0, longitude: 181 };
  assert.throws(() => decodePlan(JSON.stringify(p)));
});
test("roof and ground geometry survives a portable backup round trip", () => {
  const p = createPlan();
  const restored = decodePlan(JSON.stringify(p));
  assert.deepEqual(restored.panels, p.panels);
  assert.ok(p.panels.length > 0);
  for (const panel of p.panels) {
    assert.ok(canPlace(p, panel));
    const c = panelCorners(
      p.surfaces.find((s) => s.id === panel.surfaceId),
      panel,
    );
    assert.ok(
      Math.abs(Math.hypot(...c[0].map((v, i) => v - c[1][i])) - panel.width) <
        1e-7,
    );
    assert.ok(
      Math.abs(
        Math.hypot(...c[0].map((v, i) => v - c[3][i])) - panel.slopeLength,
      ) < 1e-7,
    );
  }
});
test("zero degree roof survives all roof types and measured imports", () => {
  for (const roof of ["gable", "mono", "flat"]) {
    const p = createPlan({ ...DEFAULT_SETTINGS, roof, pitch: 0, azimuth: 0 });
    assert.doesNotThrow(() => decodePlan(JSON.stringify(p)));
    assert.equal(p.surfaces[0].tilt, 0);
    assert.equal(p.surfaces[0].azimuth, 0);
  }
});
test("ground row gap is based on tilted rise and a stated sun altitude", () => {
  const g = groundSpacing(1.722, 30, 20, 0.6);
  assert.ok(Math.abs(g.gap - 2.3655780582) < 1e-8);
  assert.ok(Math.abs(g.depth - 1.4912957453) < 1e-8);
  assert.equal(groundSpacing(1.722, 0, 20, 0.6).gap, 0.6);
});
test("rejects false plane metadata, duplicate surfaces and altered module sizes", () => {
  for (const mutate of [
    (p) => (p.surfaces[0].v = [0, 1, 0]),
    (p) => p.surfaces.push({ ...p.surfaces[0], id: "duplicate" }),
    (p) => (p.panels[0].width *= 2),
    (p) => (p.panels[0].watts *= 2),
  ]) {
    const p = createPlan();
    mutate(p);
    assert.throws(() => decodePlan(JSON.stringify(p)));
  }
});
test("ground stays outside the house for a long rotated footprint", () => {
  const s = { ...DEFAULT_SETTINGS, width: 3, depth: 40, azimuth: 90 };
  const ground = makeSurfaces(s).find((v) => v.kind === "ground");
  const points = ground.outer.map(([x, y]) => [
    ground.origin[0] + ground.u[0] * x + ground.v[0] * y,
  ]);
  assert.ok(Math.min(...points.flat()) > 20);
});
