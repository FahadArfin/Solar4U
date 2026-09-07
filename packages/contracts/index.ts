export type Money = { amount: number; currency: "USD" };
export type RetailerStatus = "enabled" | "disabled_by_policy" | "pending_policy_review" | "degraded";
export type ProductCategory = "panel" | "battery" | "inverter" | "charge_controller" | "mounting" | "wire" | "tool" | "power_station" | "other";
export type NormalizedOffer = {
  retailerId: string;
  sourceUrl: string;
  sourceProductId?: string;
  title: string;
  brand?: string;
  model?: string;
  category: ProductCategory;
  price: Money;
  shipping?: Money;
  inStock: boolean;
  condition: "new" | "used" | "refurbished" | "unknown";
  quantity: number;
  watts?: number;
  wattHours?: number;
  observedAt: string;
  evidenceHash: string;
};
export type SolarEstimateInput = {
  capacityKw: number;
  latitude?: number;
  longitude?: number;
  tilt: number;
  azimuth: number;
  lossesPercent: number;
  electricityRate: number;
  annualUsageKwh: number;
};
export type ValidationIssue = {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  componentId?: string;
  suggestion?: string;
};
