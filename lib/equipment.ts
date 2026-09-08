export const EQUIPMENT_KEY = "solar4u-bom-v1";
export const categories = [
  "Solar panel",
  "Battery",
  "Inverter",
  "Controller",
  "Mounting",
  "Wiring",
  "Protection",
  "Monitoring",
  "Labor",
  "Other",
] as const;
export type EquipmentItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unitMinorAmount: number | null;
  currency: string;
  notes: string;
  source: null | {
    offerId: string;
    retailer: string;
    retailerId: string;
    variant: string;
    sku: string;
    url: string;
    observedAt: string;
    available: boolean | null;
    imported?: boolean;
  };
};
export type EquipmentList = {
  schemaVersion: 1;
  name: string;
  updatedAt: string;
  items: EquipmentItem[];
};
export const emptyEquipment: EquipmentList = {
  schemaVersion: 1,
  name: "My solar equipment",
  updatedAt: "",
  items: [],
};
function timestamp(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length > 40 ||
    !Number.isFinite(Date.parse(value))
  )
    throw new Error("Invalid saved timestamp");
  return new Date(value).toISOString();
}
function text(v: unknown, max: number, required = false): string {
  if (typeof v !== "string" || v.length > max || (required && !v.trim()))
    throw new Error("Invalid or missing equipment text");
  return v.trim();
}
export function currencyDigits(currency: string) {
  if (!/^[A-Z]{3}$/.test(currency))
    throw new Error("Use a three-letter currency code");
  return (
    new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2
  );
}
export function formatMinor(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(amount / 10 ** currencyDigits(currency));
}
export function parseUnitPrice(raw: string, currency: string): number | null {
  const value = raw.trim();
  if (value === "") return null;
  const digits = currencyDigits(currency),
    match = /^(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match || value.length > 30 || (match[2]?.length ?? 0) > digits)
    throw new Error(
      `Enter a nonnegative decimal price with at most ${digits} decimal places for ${currency}`,
    );
  const minor =
    BigInt(match[1]) * BigInt(10) ** BigInt(digits) +
    BigInt((match[2] ?? "").padEnd(digits, "0") || "0");
  if (minor > BigInt(10000000000))
    throw new Error("Unit price exceeds the supported amount");
  return Number(minor);
}
export function validateEquipment(value: unknown): EquipmentList {
  const o = value as EquipmentList;
  if (
    !o ||
    typeof o !== "object" ||
    o.schemaVersion !== 1 ||
    !Array.isArray(o.items) ||
    o.items.length > 300
  )
    throw new Error("Expected a Solar4U equipment backup with up to 300 items");
  const ids = new Set<string>();
  const items = o.items.map((i) => {
    if (!i || typeof i !== "object") throw new Error("Invalid equipment item");
    const id = text(i.id, 128, true);
    if (ids.has(id)) throw new Error("Duplicate equipment ID");
    ids.add(id);
    if (!Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 10000)
      throw new Error("Quantity must be a whole number from 1 to 10,000");
    currencyDigits(i.currency);
    if (
      i.unitMinorAmount !== null &&
      (!Number.isSafeInteger(i.unitMinorAmount) ||
        i.unitMinorAmount < 0 ||
        i.unitMinorAmount > 10000000000)
    )
      throw new Error("Invalid unit price");
    if (!categories.includes(i.category as (typeof categories)[number]))
      throw new Error("Unknown equipment category");
    let source: EquipmentItem["source"] = null;
    if (i.source) {
      const s = i.source;
      if (
        !/^[a-f0-9]{24}$/.test(s.offerId) ||
        !/^[a-z][a-z0-9-]{0,127}$/.test(s.retailerId)
      )
        throw new Error("Invalid observed variant identity");
      let u: URL;
      try {
        u = new URL(s.url);
      } catch {
        throw new Error("Invalid retailer link");
      }
      if (
        u.protocol !== "https:" ||
        u.username ||
        u.password ||
        s.url.length > 2000
      )
        throw new Error("Retailer links must use HTTPS");
      if (
        !Number.isFinite(Date.parse(s.observedAt)) ||
        ![true, false, null].includes(s.available)
      )
        throw new Error("Invalid observation metadata");
      source = {
        offerId: text(s.offerId, 128, true),
        retailer: text(s.retailer, 160, true),
        retailerId: text(s.retailerId, 128, true),
        variant: text(s.variant, 500),
        sku: text(s.sku, 200),
        url: u.href,
        observedAt: timestamp(s.observedAt),
        available: s.available,
        imported: s.imported === true,
      };
    }
    return {
      id,
      name: text(i.name, 500, true),
      category: i.category,
      quantity: i.quantity,
      unitMinorAmount: i.unitMinorAmount,
      currency: i.currency,
      notes: text(i.notes, 2000),
      source,
    };
  });
  equipmentTotals(items);
  return {
    schemaVersion: 1,
    name: text(o.name, 120, true),
    updatedAt: o.updatedAt === "" ? "" : timestamp(o.updatedAt),
    items,
  };
}
export function equipmentTotals(items: EquipmentItem[]) {
  const totals: Record<
    string,
    { minorAmount: number; unknown: number; items: number }
  > = {};
  for (const i of items) {
    const t = (totals[i.currency] ??= { minorAmount: 0, unknown: 0, items: 0 });
    t.items += i.quantity;
    if (i.unitMinorAmount === null) t.unknown += i.quantity;
    else t.minorAmount += i.unitMinorAmount * i.quantity;
    if (!Number.isSafeInteger(t.minorAmount))
      throw new Error("Total exceeds supported precision");
  }
  return totals;
}
export type RetailOffer = {
  id: string;
  name: string;
  category: string;
  minorAmount: number;
  currency: string;
  retailer: string;
  retailerId: string;
  variant: string;
  sku: string;
  url: string;
  observedAt: string;
  available: boolean | null;
};
export function addOffer(
  list: EquipmentList,
  offer: RetailOffer,
): EquipmentList {
  const existing = list.items.find(
    (i) =>
      i.source?.offerId === offer.id &&
      i.currency === offer.currency &&
      i.unitMinorAmount === offer.minorAmount &&
      Date.parse(i.source.observedAt) === Date.parse(offer.observedAt),
  );
  const items = existing
    ? list.items.map((i) =>
        i === existing ? { ...i, quantity: i.quantity + 1 } : i,
      )
    : [
        ...list.items,
        {
          id: crypto.randomUUID(),
          name: offer.name,
          category: categories.includes(
            offer.category as (typeof categories)[number],
          )
            ? offer.category
            : "Other",
          quantity: 1,
          unitMinorAmount: offer.minorAmount,
          currency: offer.currency,
          notes: "",
          source: {
            offerId: offer.id,
            retailer: offer.retailer,
            retailerId: offer.retailerId,
            variant: offer.variant,
            sku: offer.sku,
            url: offer.url,
            observedAt: offer.observedAt,
            available: offer.available,
          },
        },
      ];
  return validateEquipment({ ...list, items });
}
export function equipmentCsv(list: EquipmentList) {
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return [
    [
      "Item",
      "Category",
      "Quantity",
      "Unit amount",
      "Currency",
      "Line amount",
      "Retailer",
      "Variant",
      "SKU",
      "Observed at",
      "URL",
      "Notes",
    ],
    ...list.items.map((i) => [
      i.name,
      i.category,
      i.quantity,
      i.unitMinorAmount === null
        ? ""
        : i.unitMinorAmount / 10 ** currencyDigits(i.currency),
      i.currency,
      i.unitMinorAmount === null
        ? ""
        : (i.unitMinorAmount * i.quantity) / 10 ** currencyDigits(i.currency),
      i.source?.retailer,
      i.source?.variant,
      i.source?.sku,
      i.source?.observedAt,
      i.source?.url,
      i.notes,
    ]),
  ]
    .map((r) => r.map(cell).join(","))
    .join("\r\n");
}
export function applyObservation(
  list: EquipmentList,
  expected: EquipmentItem,
  offer: RetailOffer,
): EquipmentList {
  const current = list.items.find((i) => i.id === expected.id);
  if (
    !current ||
    JSON.stringify(current.source) !== JSON.stringify(expected.source) ||
    current.unitMinorAmount !== expected.unitMinorAmount
  )
    throw new Error(
      "This saved snapshot changed in another tab. Review it again before updating",
    );
  if (
    !current.source ||
    current.source.offerId !== offer.id ||
    current.currency !== offer.currency ||
    (!current.source.imported &&
      Date.parse(offer.observedAt) < Date.parse(current.source.observedAt))
  )
    throw new Error(
      "The observation does not match this saved variant, currency and date",
    );
  const verified = addOffer(emptyEquipment, offer).items[0];
  return validateEquipment({
    ...list,
    items: list.items.map((i) =>
      i.id === expected.id
        ? {
            ...verified,
            id: i.id,
            quantity: i.quantity,
            notes: i.notes,
            category: i.category,
          }
        : i,
    ),
  });
}
