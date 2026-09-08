export type ShoppingGroup =
  | "panels"
  | "mounting"
  | "electrical"
  | "wiring"
  | "inverters"
  | "batteries"
  | "bundles"
  | "other";
export type Classification = {
  group: ShoppingGroup;
  subtype: string;
  basis: string;
  packageNote: string;
  specs: {
    watts: number | null;
    powerW: number | null;
    nominalVoltage: number | null;
    energyKwh: number | null;
    capacityAh: number | null;
    packCount: number | null;
    voltageClass: "high" | "low" | "unknown";
    condition: "new" | "used" | "refurbished" | "unknown";
    currentA: number | null;
    crossSectionMm2: number | null;
    lengthM: number | null;
  };
};
export const shoppingGroups: {
  id: ShoppingGroup;
  name: string;
  category: string;
  description: string;
  subtypes: [string, string][];
}[];
export function classifyOffer(offer: {
  name: string;
  variant?: string;
}): Classification;
