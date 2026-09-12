import {
  addOffer,
  emptyEquipment,
  validateEquipment,
  type EquipmentList,
  type EquipmentItem,
  type RetailOffer,
} from "./equipment.ts";

export const BUILD_PREFS_KEY = "solar4u-builder-preferences-v1";

export const emptyBuildPreferences = {
  schemaVersion: 1 as const,
  updatedAt: "",
  purpose: "backup",
  mounting: "roof",
  currency: "USD",
  budget: null as number | null,
};

export function validateBuildPreferences(
  value: unknown,
): typeof emptyBuildPreferences {
  const p = value as typeof emptyBuildPreferences;

  if (
    !p ||
    typeof p.updatedAt !== "string" ||
    (p.updatedAt !== "" && !Number.isFinite(Date.parse(p.updatedAt))) ||
    p.schemaVersion !== 1 ||
    !["backup", "offgrid", "grid", "mobile"].includes(p.purpose) ||
    !["roof", "ground"].includes(p.mounting) ||
    !["USD", "CAD", "AUD", "EUR", "GBP"].includes(p.currency) ||
    (p.budget !== null &&
      (!Number.isSafeInteger(p.budget) || p.budget < 0 || p.budget > 1e10))
  )
    throw new Error("Invalid builder preferences");

  return {
    schemaVersion: 1,
    updatedAt: p.updatedAt,
    purpose: p.purpose,
    mounting: p.mounting,
    currency: p.currency,
    budget: p.budget,
  };
}

/** Keep the original row identity and notes. Never silently replace a concurrent edit. */

export function replaceBuildOffer(
  list: EquipmentList,
  expected: EquipmentItem,
  offer: RetailOffer,
  quantity: number,
): EquipmentList {
  const current = list.items.find((i) => i.id === expected.id);

  if (!current || JSON.stringify(current) !== JSON.stringify(expected))
    throw new Error(
      "This part changed in another tab. Return to your build and choose Replace again.",
    );

  const replacement = addOffer(emptyEquipment, offer).items[0];

  return validateEquipment({
    ...list,
    items: list.items.map((i) =>
      i.id === current.id
        ? { ...replacement, id: current.id, quantity, notes: current.notes }
        : i,
    ),
  });
}

export const buildPurposes = [
  {
    id: "backup",
    name: "Home backup",
    description: "Keep essential loads running",
    tip: "Start with the loads you want to keep running. Choose an inverter and battery together, then size the solar charging side.",
  },

  {
    id: "offgrid",
    name: "Off-grid retreat",
    description: "Make your own everyday power",
    tip: "Start with daily energy use and your lowest-sun season. Battery autonomy, charging and a backup source matter here.",
  },

  {
    id: "grid",
    name: "Everyday solar",
    description: "Generate power for your home",
    tip: "Start with usable roof or ground space. Grid connection, inverter approval and export rules depend on your utility. A battery is optional.",
  },

  {
    id: "mobile",
    name: "Van & weekend",
    description: "Take a little sunshine along",
    tip: "Start with your available space and daily loads. Include vibration-rated mounting and suitable charging from other sources if needed.",
  },
] as const;
