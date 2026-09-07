import test from "node:test";
import assert from "node:assert/strict";
import { localEstimate, fitGroundArray } from "./model.mjs";

test("estimate increases with capacity", () => {
  assert.ok(localEstimate({ capacityKw: 10, latitude: 43 }).annualKwh > localEstimate({ capacityKw: 5, latitude: 43 }).annualKwh);
});
test("ground layout respects small areas", () => {
  assert.equal(fitGroundArray({ areaSqM: 1 }).panelCount, 0);
});
