import {
  classifyOffer,
  type Classification,
} from "../services/price-worker/classification.mjs";
import { addOffer, emptyEquipment, type RetailOffer } from "./equipment.ts";
import { parsePriceHistory, type PricePoint } from "./price-history.ts";
export const COMPONENT_LIBRARY_KEY = "solar4u-component-library-v1";
export type ComponentRecord = {
  offer: RetailOffer;
  points: PricePoint[];
  specs: Classification["specs"];
};
export type ComponentLibrary = {
  schemaVersion: 1;
  updatedAt: string;
  records: ComponentRecord[];
};
export const emptyComponentLibrary: ComponentLibrary = {
  schemaVersion: 1,
  updatedAt: "",
  records: [],
};
function cleanOffer(offer: RetailOffer): RetailOffer {
  if (!offer || typeof offer !== "object")
    throw new Error("Invalid component record");
  const row = addOffer(emptyEquipment, offer).items[0],
    source = row.source!;
  return {
    id: source.offerId,
    name: row.name.replace(/\s+/g, " "),
    category: row.category,
    minorAmount: row.unitMinorAmount!,
    currency: row.currency,
    retailer: source.retailer,
    retailerId: source.retailerId,
    variant: source.variant,
    sku: source.sku,
    url: source.url,
    observedAt: source.observedAt,
    available: source.available,
  };
}
export function validateComponentLibrary(value: unknown): ComponentLibrary {
  const v = value as ComponentLibrary;
  if (
    !v ||
    v.schemaVersion !== 1 ||
    typeof v.updatedAt !== "string" ||
    (v.updatedAt && !Number.isFinite(Date.parse(v.updatedAt))) ||
    !Array.isArray(v.records) ||
    v.records.length > 100
  )
    throw new Error("Invalid component library (maximum 100 products)");
  const ids = new Set<string>();
  return {
    schemaVersion: 1,
    updatedAt: v.updatedAt,
    records: v.records.map((record) => {
      const offer = cleanOffer(record.offer),
        key = `${offer.id}:${offer.currency}`;
      if (ids.has(key)) throw new Error("Duplicate component record");
      ids.add(key);
      return {
        offer,
        points: parsePriceHistory(record.points),
        specs: classifyOffer(offer).specs,
      };
    }),
  };
}
export function rememberComponent(
  library: ComponentLibrary,
  value: RetailOffer,
  points: PricePoint[] = [],
): ComponentLibrary {
  const offer = cleanOffer(value),
    index = library.records.findIndex(
      (r) => r.offer.id === offer.id && r.offer.currency === offer.currency,
    ),
    old = library.records[index];
  if (index < 0 && library.records.length >= 100)
    throw new Error(
      "Your device catalog holds 100 products. Export it and remove an unneeded saved product before adding more.",
    );
  const record = {
    specs: classifyOffer(offer).specs,
    offer:
      old && Date.parse(old.offer.observedAt) > Date.parse(offer.observedAt)
        ? old.offer
        : offer,
    points: parsePriceHistory([
      ...(old?.points ?? []),
      ...points,
      [offer.observedAt, offer.minorAmount, offer.available],
    ]),
  };
  return validateComponentLibrary({
    ...library,
    records:
      index < 0
        ? [...library.records, record]
        : library.records.map((r, i) => (i === index ? record : r)),
  });
}
