export type CalculatorId =
  | "pv"
  | "battery"
  | "voltage"
  | "fuse"
  | "array"
  | "controller"
  | "cable"
  | "tou"
  | "payback";
export type Values = Record<string, number>;
export type CalcField = {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step?: number;
  choices?: number[];
};
export type CalcDefinition = {
  id: CalculatorId;
  name: string;
  description: string;
  formula: string;
  note: string;
  source: string;
  sourceName: string;
  fields: CalcField[];
  defaults: Values;
};
const field = (
  key: string,
  label: string,
  unit: string,
  min: number,
  max: number,
  step = 0.1,
): CalcField => ({ key, label, unit, min, max, step });
export const moduleFields = [
  field("panelVoc", "Open-circuit voltage · Voc", "V", 0.1, 1000),
  field("panelVmp", "Operating voltage · Vmp", "V", 0.1, 1000),
  field("panelIsc", "Short-circuit current · Isc", "A", 0.1, 1000),
  field("panelImp", "Operating current · Imp", "A", 0.1, 1000),
  field("seriesCount", "Modules per string", "", 1, 100, 1),
  field("parallelCount", "Parallel strings", "", 1, 100, 1),
];
export const moduleDefaults = {
  panelVoc: 49.5,
  panelVmp: 41.7,
  panelIsc: 10.4,
  panelImp: 9.6,
  seriesCount: 2,
  parallelCount: 2,
};
export const pvArrayFields = [
  field("capacityKw", "Array nameplate", "kW", 0, 1000),
  field("tilt", "Tilt from horizontal", "°", 0, 90, 1),
  field("azimuth", "Azimuth from north", "°", 0, 360, 1),
];
const wiring =
  "https://www.victronenergy.com/media/pg/The_Wiring_Unlimited_book/en/dc-wiring.html";
export const calculators: CalcDefinition[] = [
  {
    id: "pv",
    name: "Solar production",
    description:
      "Compare locations and orientations, then request a climate-based estimate.",
    formula:
      "Annual energy ≈ nameplate × sun hours × 365 × system and orientation factors",
    note: "The instant seasonal model is simplified. PVGIS uses climate data. Neither option includes a full study of nearby obstacles or your utility bill.",
    source:
      "https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis_en",
    sourceName: "EU JRC · PVGIS",
    fields: [
      ...pvArrayFields,
      field("latitude", "Latitude", "°", -66, 66, 0.0001),
      field("longitude", "Longitude", "°", -180, 180, 0.0001),
      field("lossesPercent", "System losses", "%", 0, 99),
      field("peakSunHours", "Daily peak sun hours · local model", "h", 0, 12),
      field(
        "electricityRate",
        "Value per generated kWh",
        "$ / kWh",
        0,
        10,
        0.01,
      ),
      field(
        "annualUsageKwh",
        "Annual electricity use",
        "kWh",
        0,
        10000000,
        100,
      ),
    ],
    defaults: {
      capacityKw: 10,
      tilt: 35,
      azimuth: 180,
      latitude: 43,
      longitude: -78.8,
      lossesPercent: 14,
      peakSunHours: 3.55,
      electricityRate: 0.19,
      annualUsageKwh: 10000,
    },
  },
  {
    id: "battery",
    name: "Battery runtime",
    description: "Estimate how long a steady load can run from stored energy.",
    formula:
      "Hours = nominal kWh × usable fraction × discharge efficiency × 1,000 ÷ load W",
    note: "Uses a steady load and a full starting charge. Cold weather, ageing, inverter idle draw and startup surges can reduce real runtime.",
    source: wiring,
    sourceName: "Victron · Wiring Unlimited",
    fields: [
      field("capacityKwh", "Nominal battery energy", "kWh", 0, 10000),
      field("loadWatts", "Average running load", "W", 0, 1000000, 10),
      field(
        "depthOfDischargePercent",
        "Allowed depth of discharge",
        "%",
        0,
        100,
        1,
      ),
      field(
        "efficiencyPercent",
        "Discharge and inverter efficiency",
        "%",
        1,
        100,
        1,
      ),
    ],
    defaults: {
      capacityKwh: 10,
      loadWatts: 750,
      depthOfDischargePercent: 90,
      efficiencyPercent: 92,
    },
  },
  {
    id: "voltage",
    name: "Voltage drop",
    description: "Check a DC conductor pair using its round-trip resistance.",
    formula: "Drop V = 2 × one-way ft × current A × Ω per 1,000 ft ÷ 1,000",
    note: "This checks resistance loss, not conductor ampacity or installation suitability. Enter resistance at the intended conductor temperature.",
    source: wiring,
    sourceName: "Victron · DC wiring",
    fields: [
      field("voltage", "Source voltage", "V", 0.1, 1000),
      field("currentA", "Running current", "A", 0, 1000),
      field("lengthFt", "One-way conductor length", "ft", 0, 10000, 1),
      field(
        "ohmsPerKft",
        "Conductor resistance",
        "Ω / 1,000 ft",
        0,
        1000,
        0.0001,
      ),
    ],
    defaults: { voltage: 48, currentA: 30, lengthFt: 40, ohmsPerKft: 0.3951 },
  },
  {
    id: "fuse",
    name: "Fuse & breaker",
    description:
      "Compare a continuous-load planning value with conductor ampacity.",
    formula:
      "Planning minimum = continuous current × 125%; round up to a standard size",
    note: "The 125% assumption is a planning case, not a universal rule. PV source circuits, terminal ratings, derating and manufacturer instructions need separate review.",
    source: wiring,
    sourceName: "Victron · Fuses and circuit breakers",
    fields: [
      field("continuousCurrentA", "Continuous load current", "A", 0, 1000),
      field("conductorAmpacityA", "Corrected conductor ampacity", "A", 0, 1000),
    ],
    defaults: { continuousCurrentA: 40, conductorAmpacityA: 60 },
  },
  {
    id: "array",
    name: "Array voltage",
    description:
      "Translate module specifications into string and array values.",
    formula:
      "Cold Voc = module Voc × series count × [1 + |Voc coefficient| / 100 × max(0, 25°C − minimum temperature)]",
    note: "For temperatures above 25°C, the maximum-voltage check conservatively retains STC Voc. Use a manufacturer coefficient and site design temperature.",
    source:
      "https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_150-35__150-45/en/installation.html",
    sourceName: "Victron · PV configuration",
    fields: [
      ...moduleFields,
      field(
        "minimumTempC",
        "Minimum design cell temperature",
        "°C",
        -60,
        60,
        1,
      ),
      field(
        "tempCoefficientPercent",
        "Voc temperature coefficient",
        "% / °C",
        -2,
        0,
        0.01,
      ),
    ],
    defaults: {
      ...moduleDefaults,
      seriesCount: 8,
      minimumTempC: -15,
      tempCoefficientPercent: -0.28,
    },
  },
  {
    id: "controller",
    name: "Charge controller",
    description:
      "Check each independent array against a small, verified model catalog.",
    formula:
      "Check cold Voc, PV Isc, operating limits, hot Vmp and the actual battery charging voltage",
    note: "Results are a preliminary shortlist. Parallel connector pairs on these models share one MPPT. Confirm battery profiles, connector current, temperature assumptions and whole-string allocation before choosing equipment.",
    source:
      "https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_150-60_up_to_250-70/en/technical-specifications.html",
    sourceName: "Victron · Manufacturer specifications",
    fields: [
      {
        ...field(
          "nominalBatteryVoltage",
          "Nominal battery system",
          "V",
          12,
          48,
          1,
        ),
        choices: [12, 24, 36, 48],
      },
      field(
        "batteryChargingVoltage",
        "Highest battery charging voltage",
        "V",
        12,
        67.2,
      ),
      field(
        "minimumTempC",
        "Minimum design cell temperature",
        "°C",
        -60,
        60,
        1,
      ),
      field(
        "maximumCellTempC",
        "Maximum operating cell temperature",
        "°C",
        25,
        100,
        1,
      ),
      field(
        "tempCoefficientPercent",
        "Shared Voc coefficient · all arrays",
        "% / °C",
        -2,
        0,
        0.01,
      ),
      field(
        "vmpCoefficientPercent",
        "Shared Vmp coefficient · all arrays",
        "% / °C",
        -2,
        0,
        0.01,
      ),
    ],
    defaults: {
      nominalBatteryVoltage: 48,
      batteryChargingVoltage: 56.8,
      minimumTempC: -15,
      maximumCellTempC: 70,
      tempCoefficientPercent: -0.28,
      vmpCoefficientPercent: -0.35,
    },
  },
  {
    id: "cable",
    name: "Cable sizing",
    description:
      "Find the smallest modeled conductor meeting both entered constraints.",
    formula:
      "A candidate must satisfy corrected ampacity ≥ current × 125% AND the voltage-drop target",
    note: "The catalog uses conservative example ampacities and resistance values. Actual wiring method, temperature, terminals and local rules determine permissible ampacity. Displayed cable costs are illustrative, not retailer quotes.",
    source: wiring,
    sourceName: "Victron · Cable selection",
    fields: [
      field("voltage", "Source voltage", "V", 0.1, 1000),
      field("currentA", "Continuous running current", "A", 0, 1000),
      field("lengthFt", "One-way conductor length", "ft", 0, 10000, 1),
      field("maxDropPercent", "Maximum voltage drop", "%", 0.25, 10, 0.25),
    ],
    defaults: { voltage: 48, currentA: 30, lengthFt: 40, maxDropPercent: 2 },
  },
  {
    id: "tou",
    name: "Time-of-use battery",
    description:
      "Compare daily rate shifting with a separate full-charge backup target.",
    formula:
      "Daily value = avoided peak/mid cost − shifted AC energy ÷ round-trip efficiency × off-peak rate",
    note: "Capacity uses discharge efficiency and minimum state of charge. Recharge cost uses round-trip efficiency. Backup starts from a full battery; routine rate shifting can reduce the energy available for an unexpected outage.",
    source: "https://www.eia.gov/todayinenergy/detail.php?id=46756",
    sourceName: "EIA · Round-trip battery efficiency",
    fields: [
      field("dailyUsageKwh", "Daily AC energy use", "kWh", 0, 10000),
      field("onPeakSharePercent", "On-peak consumption share", "%", 0, 100, 1),
      field(
        "midPeakSharePercent",
        "Mid-peak consumption share",
        "%",
        0,
        100,
        1,
      ),
      field("peakRate", "On-peak energy rate", "$ / kWh", 0, 10, 0.01),
      field("midPeakRate", "Mid-peak energy rate", "$ / kWh", 0, 10, 0.01),
      field("offPeakRate", "Off-peak energy rate", "$ / kWh", 0, 10, 0.01),
      field(
        "roundTripEfficiencyPercent",
        "Round-trip AC efficiency",
        "%",
        1,
        100,
        1,
      ),
      field(
        "dischargeEfficiencyPercent",
        "Discharge efficiency",
        "%",
        1,
        100,
        1,
      ),
      field("reservePercent", "Minimum state of charge", "%", 0, 95, 1),
      field(
        "autonomyDays",
        "Backup duration from full charge",
        "days",
        0,
        30,
        0.5,
      ),
    ],
    defaults: {
      dailyUsageKwh: 30,
      onPeakSharePercent: 35,
      midPeakSharePercent: 30,
      peakRate: 0.38,
      midPeakRate: 0.22,
      offPeakRate: 0.12,
      roundTripEfficiencyPercent: 90,
      dischargeEfficiencyPercent: 95,
      reservePercent: 20,
      autonomyDays: 2,
    },
  },
  {
    id: "payback",
    name: "Payback & cash flow",
    description:
      "Explore the impact of cost, useful solar energy and your own incentives.",
    formula:
      "Annual savings = declining useful production × escalating energy value − annual maintenance",
    note: "Simple, undiscounted cash flow excludes financing, replacement costs and taxes. Enter a blended energy value reflecting self-consumption and exports. The default incentive is 0%; the US residential §25D credit ended for installations completed after 2025.",
    source:
      "https://www.irs.gov/newsroom/faqs-for-modification-of-sections-25c-25d-25e-30c-30d-45l-45w-and-179d-under-public-law-119-21-139-stat-72-july-4-2025-commonly-known-as-the-one-big-beautiful-bill-obbb",
    sourceName: "IRS · Current residential credit guidance",
    fields: [
      field("grossCost", "Installed system cost", "$", 0, 250000, 100),
      field(
        "incentivePercent",
        "Eligible incentive entered by you",
        "%",
        0,
        100,
        1,
      ),
      field(
        "annualProductionKwh",
        "Annual useful or credited generation",
        "kWh",
        0,
        1000000,
        100,
      ),
      field(
        "electricityRate",
        "Blended value of generated energy",
        "$ / kWh",
        0,
        2,
        0.01,
      ),
      field(
        "escalationPercent",
        "Annual energy-value escalation",
        "%",
        0,
        10,
        0.1,
      ),
      field(
        "degradationPercent",
        "Annual production degradation",
        "%",
        0,
        5,
        0.1,
      ),
      field(
        "annualMaintenance",
        "Annual maintenance allowance",
        "$",
        0,
        10000,
        10,
      ),
    ],
    defaults: {
      grossCost: 30000,
      incentivePercent: 0,
      annualProductionKwh: 11000,
      electricityRate: 0.19,
      escalationPercent: 2.5,
      degradationPercent: 0.5,
      annualMaintenance: 100,
    },
  },
];
export function validateValues(
  id: CalculatorId,
  changes: Record<string, unknown>,
) {
  const definition = calculators.find((c) => c.id === id)!;
  for (const [key, value] of Object.entries(changes)) {
    const f = definition.fields.find((f) => f.key === key);
    if (
      !f ||
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < f.min ||
      value > f.max ||
      (f.step === 1 && !Number.isInteger(value)) ||
      (f.choices && !f.choices.includes(value))
    )
      throw new Error(`Invalid ${f?.label ?? key}`);
  }
  return changes as Values;
}
