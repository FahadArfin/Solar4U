import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyEquipment,
  validateEquipment,
  equipmentTotals,
  addOffer,
  equipmentCsv,
  currencyDigits,
  parseUnitPrice,
  applyObservation,
} from "../lib/equipment.ts";
const offer = {
  id: "0123456789abcdef01234567",
  name: "Panel pallet",
  category: "Solar panel",
  minorAmount: 759900,
  currency: "USD",
  retailer: "Example",
  retailerId: "example",
  variant: "31 panels",
  sku: "PALLET",
  url: "https://example.com/pallet",
  observedAt: "2026-09-07T12:00:00Z",
  available: true,
};
test("manual prices are exact decimal amounts and never round unknown precision into free equipment", () => {
  assert.equal(parseUnitPrice("1.01", "USD"), 101);
  assert.equal(parseUnitPrice("1.255", "KWD"), 1255);
  assert.equal(parseUnitPrice("0", "USD"), 0);
  assert.equal(parseUnitPrice("", "USD"), null);
  for (const value of ["1.005", "1.255", "0.004", "1e3", "-1"])
    assert.throws(() => parseUnitPrice(value, "USD"));
  assert.throws(() => parseUnitPrice("1.5", "JPY"));
});
test("identical observed variants merge quantities while changed snapshots stay separate", () => {
  const one = addOffer(emptyEquipment, offer),
    two = addOffer(one, offer),
    three = addOffer(two, { ...offer, minorAmount: 749900 });
  assert.equal(two.items.length, 1);
  assert.equal(two.items[0].quantity, 2);
  assert.equal(three.items.length, 2);
  assert.equal(three.items[0].source.variant, "31 panels");
  assert.equal(equipmentTotals(two.items).USD.minorAmount, 1519800);
});
test("observation updates reject removed or concurrently changed snapshots and keep independent edits", () => {
  const list = addOffer(emptyEquipment, offer),
    expected = list.items[0],
    newer = {
      ...offer,
      minorAmount: 749900,
      observedAt: "2026-09-08T12:00:00Z",
    };
  const changed = {
    ...list,
    items: [{ ...expected, quantity: 3, notes: "Keep this note" }],
  };
  const updated = applyObservation(changed, expected, newer);
  assert.equal(updated.items[0].quantity, 3);
  assert.equal(updated.items[0].notes, "Keep this note");
  assert.equal(updated.items[0].unitMinorAmount, 749900);
  assert.throws(() => applyObservation(updated, expected, offer));
  assert.throws(() => applyObservation(emptyEquipment, expected, newer));
  assert.throws(() =>
    applyObservation(list, expected, { ...newer, currency: "CAD" }),
  );
});
test("currency subtotals and unpriced units remain separate through backup round trip", () => {
  const a = addOffer(emptyEquipment, offer);
  a.items.push({
    ...a.items[0],
    id: "cad",
    currency: "CAD",
    unitMinorAmount: null,
    quantity: 3,
    source: null,
  });
  a.items.push({
    ...a.items[0],
    id: "zero",
    currency: "JPY",
    unitMinorAmount: 0,
    source: null,
  });
  const parsed = validateEquipment(JSON.parse(JSON.stringify(a)));
  assert.deepEqual(equipmentTotals(parsed.items), {
    USD: { minorAmount: 759900, unknown: 0, items: 1 },
    CAD: { minorAmount: 0, unknown: 3, items: 3 },
    JPY: { minorAmount: 0, unknown: 0, items: 1 },
  });
  assert.equal(currencyDigits("JPY"), 0);
  assert.equal(currencyDigits("KWD"), 3);
});
test("malformed backups reject duplicate IDs, unsafe amounts, links and quantities", () => {
  const a = addOffer(emptyEquipment, offer);
  assert.throws(() =>
    validateEquipment({ ...a, items: [...a.items, ...a.items] }),
  );
  for (const values of [
    { quantity: 0 },
    { quantity: 1.5 },
    { unitMinorAmount: -1 },
    { unitMinorAmount: Infinity },
    { currency: "__proto__" },
    { source: { ...a.items[0].source, url: "javascript:alert(1)" } },
    {
      source: { ...a.items[0].source, url: "https://user:secret@example.com" },
    },
  ])
    assert.throws(() =>
      validateEquipment({ ...a, items: [{ ...a.items[0], ...values }] }),
    );
  assert.equal(a.items[0].quantity, 1);
  for (const offerId of ["constructor", "__proto__", "toString"])
    assert.throws(() =>
      validateEquipment({
        ...a,
        items: [{ ...a.items[0], source: { ...a.items[0].source, offerId } }],
      }),
    );
  assert.throws(() =>
    validateEquipment({
      ...a,
      items: [
        {
          ...a.items[0],
          source: {
            ...a.items[0].source,
            observedAt: "2026-09-07" + " ".repeat(100),
          },
        },
      ],
    }),
  );
});
test("CSV preserves quoted text and neutralizes spreadsheet formulas", () => {
  const a = addOffer(emptyEquipment, { ...offer, name: ' =HYPERLINK("bad")' });
  a.items[0].notes = 'line one, "quoted"\nline two';
  const csv = equipmentCsv(a);
  assert.match(csv, /"'=HYPERLINK\(""bad""\)"/);
  assert.match(csv, /"line one, ""quoted""\nline two"/);
});
