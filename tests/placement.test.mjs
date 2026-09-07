import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  testPlacement,
  validateRegion,
  packRegion,
} from "../lib/placement.mjs";
const f = JSON.parse(
  await readFile(new URL("./fixtures/placement.json", import.meta.url), "utf8"),
);
for (const c of f.placementCases)
  test(c.id, () => {
    const result = testPlacement(f.regions[c.region], c.rectangle, c);
    for (const [k, v] of Object.entries(c.expected)) {
      if (typeof v === "number") assert.ok(Math.abs(result[k] - v) < 1e-7, `${k}: ${result[k]} / ${v}`);
      else assert.equal(result[k], v);
    }
  });
test("concave exclusions do not become filled convex hulls", () => {
  const region = f.regions[
    Object.keys(f.regions).find(
      (k) =>
        k.toLowerCase().includes("lshape") ||
        k.toLowerCase().includes("concave"),
    )
  ] ?? {
    outer: [
      [0, 0],
      [6, 0],
      [6, 2],
      [2, 2],
      [2, 6],
      [0, 6],
    ],
    holes: [],
  };
  const panels = packRegion(region, {
    width: 1,
    depth: 1,
    gapX: 0,
    gapY: 0,
    setback: 0,
    clearance: 0,
  });
  assert.ok(panels.length);
  for (const p of panels)
    assert.ok(
      testPlacement(region, {
        centre: [p.x + 0.5, p.y + 0.5],
        widthM: 1,
        depthM: 1,
        rotationDegrees: 0,
      }).valid,
    );
});
test("rejects self-crossing and exterior-hole imports", () => {
  assert.throws(() =>
    validateRegion({
      outer: [
        [0, 0],
        [4, 4],
        [0, 4],
        [4, 0],
      ],
      holes: [],
    }),
  );
  assert.throws(() =>
    validateRegion({
      outer: [
        [0, 0],
        [5, 0],
        [5, 5],
        [0, 5],
      ],
      holes: [
        [
          [4, 4],
          [6, 4],
          [6, 6],
          [4, 6],
        ],
      ],
    }),
  );
});
test("respects zero clearance and a small roof with no fit", () => {
  assert.equal(
    packRegion(
      {
        outer: [
          [0, 0],
          [2, 0],
          [2, 2],
          [0, 2],
        ],
        holes: [],
      },
      { width: 1, depth: 1, gapX: 0, gapY: 0, setback: 0, clearance: 0 },
    ).length,
    4,
  );
  assert.equal(
    packRegion(
      {
        outer: [
          [0, 0],
          [2, 0],
          [2, 2],
          [0, 2],
        ],
        holes: [],
      },
      { width: 1, depth: 1, gapX: 0, gapY: 0, setback: 0.6, clearance: 0 },
    ).length,
    0,
  );
});
