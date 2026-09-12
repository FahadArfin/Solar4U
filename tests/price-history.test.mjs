import test from "node:test";
import assert from "node:assert/strict";
import { parsePriceHistory, historySummary } from "../lib/price-history.ts";
import {
  emptyComponentLibrary,
  rememberComponent,
  validateComponentLibrary,
} from "../lib/component-library.ts";
const offer = {
  id: "0123456789abcdef01234567",
  name: "  Example   400W Solar Panel  ",
  variant: "2 panels",
  category: "Solar panel",
  minorAmount: 19900,
  currency: "USD",
  retailer: "Example",
  retailerId: "example",
  sku: "P400",
  url: "https://example.com/panel",
  observedAt: "2026-09-12T12:00:00Z",
  available: true,
};
test("history keeps zero prices, orders dates, and deduplicates timestamps without filling missing days", () => {
  const p = parsePriceHistory([
    ["2026-09-12T12:00:00Z", 19900, true],
    ["2026-09-08T12:00:00Z", 0, false],
    ["2026-09-12T12:00:00Z", 20000, null],
  ]);
  assert.equal(p.length, 2);
  assert.equal(p[0][1], 0);
  assert.deepEqual(historySummary(p), {
    low: 0,
    high: 20000,
    first: 0,
    latest: 20000,
    change: 20000,
  });
  assert.equal(historySummary([]), null);
  for (const data of [
    null,
    {},
    [["bad", 1, true]],
    [["2026-09-12", -1, true]],
    [["2026-09-12", 1.1, true]],
    [["2026-09-12", 1, "yes"]],
  ])
    assert.throws(() => parsePriceHistory(data));
});
test("device catalog retains exact identity, structured specification clues and recorded prices", () => {
  const saved = rememberComponent(emptyComponentLibrary, offer, [
    ["2026-09-10T12:00:00Z", 20900, true],
  ]);
  assert.equal(saved.records[0].offer.name, "Example 400W Solar Panel");
  assert.equal(saved.records[0].offer.id, offer.id);
  assert.equal(saved.records[0].specs.watts, 400);
  assert.equal(saved.records[0].points.length, 2);
  const updated = rememberComponent(saved, {
    ...offer,
    minorAmount: 18900,
    observedAt: "2026-09-13T12:00:00Z",
  });
  assert.equal(updated.records.length, 1);
  assert.equal(updated.records[0].points.length, 3);
  assert.equal(updated.records[0].offer.minorAmount, 18900);
  assert.equal(
    rememberComponent(updated, offer).records[0].offer.minorAmount,
    18900,
  );
  assert.equal(saved.records[0].offer.minorAmount, 19900);
  assert.deepEqual(
    validateComponentLibrary(JSON.parse(JSON.stringify(updated))),
    updated,
  );
});
test("catalog isolates currencies and rejects corrupt or unsafe saved listings", () => {
  const saved = rememberComponent(
    rememberComponent(emptyComponentLibrary, offer),
    { ...offer, currency: "CAD" },
  );
  assert.equal(saved.records.length, 2);
  assert.throws(() =>
    rememberComponent(saved, { ...offer, url: "javascript:alert(1)" }),
  );
  assert.throws(() =>
    validateComponentLibrary({
      ...saved,
      records: [...saved.records, saved.records[0]],
    }),
  );
  assert.throws(() =>
    validateComponentLibrary({
      ...saved,
      records: [{ offer, points: [["bad", 1, true]] }],
    }),
  );
});
