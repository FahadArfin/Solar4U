const standardOvercurrentAmps = [
  5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150,
  175, 200, 225, 250, 300, 350, 400,
];
const standardControllerAmps = [
  10, 15, 20, 30, 40, 50, 60, 80, 100, 120, 150, 200,
];

function nextStandard(value, sizes) {
  return sizes.find((size) => size >= value) ?? Math.ceil(value / 50) * 50;
}

function clamp(value, minimum, maximum) {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    String(value).trim() === "" ||
    !Number.isFinite(Number(value))
  )
    throw new Error("Use a finite numeric value");
  return Math.min(maximum, Math.max(minimum, Number(value)));
}
function positive(value, max = 1000000) {
  const n = clamp(value, 0, max);
  if (n <= 0)
    throw new Error(
      "Voltage and positive-only values must be greater than zero",
    );
  return n;
}
function count(value) {
  const n = clamp(value, 1, 100);
  if (!Number.isInteger(Number(value)))
    throw new Error("Module and string counts must be whole numbers");
  return n;
}

export function batteryRuntime(input) {
  const capacityKwh = clamp(
    input.capacityKwh ?? Number(input.capacityWh ?? 0) / 1000,
    0,
    10000,
  );
  const loadWatts = clamp(input.loadWatts ?? 1, 0, 1000000);
  const depthOfDischarge = clamp(input.depthOfDischargePercent ?? 90, 0, 100);
  const efficiency = clamp(
    input.efficiencyPercent ?? Number(input.efficiency ?? 0.9) * 100,
    1,
    100,
  );
  const usableKwh =
    (((capacityKwh * depthOfDischarge) / 100) * efficiency) / 100;
  const runtimeHours = loadWatts > 0 ? (usableKwh * 1000) / loadWatts : null;
  return {
    usableKwh,
    runtimeHours,
    runtimeDays: runtimeHours === null ? null : runtimeHours / 24,
  };
}

export function voltageDrop(input) {
  const voltage = positive(input.voltage ?? 48, 1000);
  const currentA = clamp(input.currentA ?? 0, 0, 1000);
  const lengthFt = clamp(input.lengthFt ?? 0, 0, 10000);
  const ohmsPerKft = clamp(input.ohmsPerKft ?? 0, 0, 1000);
  const dropVolts = (2 * lengthFt * currentA * ohmsPerKft) / 1000;
  const dropPercent = (dropVolts / voltage) * 100;
  return {
    dropVolts,
    dropPercent,
    endVoltage: Math.max(0, voltage - dropVolts),
    status: dropPercent <= 3 ? "good" : dropPercent <= 5 ? "review" : "high",
    maxRecommendedPercent: 3,
  };
}

export function fuseBreaker(input) {
  const continuousCurrentA = clamp(input.continuousCurrentA ?? 0, 0, 1000);
  const conductorAmpacityA = clamp(input.conductorAmpacityA ?? 0, 0, 1000);
  const minimumAmps = continuousCurrentA * 1.25;
  const recommendedAmps =
    minimumAmps > 0 ? nextStandard(minimumAmps, standardOvercurrentAmps) : 0;
  return {
    minimumAmps,
    recommendedAmps,
    conductorSuitable: conductorAmpacityA >= recommendedAmps,
    note: "Confirm terminal ratings, conductor corrections, equipment instructions, and the locally adopted electrical code.",
  };
}

export function arrayVoltage(input) {
  const panelVoc = positive(input.panelVoc ?? 0.1, 1000);
  const panelVmp = positive(input.panelVmp ?? 0.1, 1000);
  const panelIsc = positive(input.panelIsc ?? 0.1, 1000);
  const panelImp = positive(input.panelImp ?? 0.1, 1000);
  if (panelVmp > panelVoc || panelImp > panelIsc)
    throw new Error(
      "Operating voltage/current cannot exceed open-circuit voltage/short-circuit current",
    );
  const seriesCount = count(input.seriesCount ?? 1);
  const parallelCount = count(input.parallelCount ?? 1);
  const minimumTempC = clamp(input.minimumTempC ?? -10, -60, 60);
  const tempCoefficientPercent = Math.abs(
    clamp(input.tempCoefficientPercent ?? -0.28, -2, 0),
  );
  const coldMultiplier =
    1 + (tempCoefficientPercent / 100) * Math.max(0, 25 - minimumTempC);
  return {
    coldVoc: panelVoc * seriesCount * coldMultiplier,
    arrayVmp: panelVmp * seriesCount,
    arrayIsc: panelIsc * parallelCount,
    arrayImp: panelImp * parallelCount,
    arrayWatts: panelVmp * panelImp * seriesCount * parallelCount,
  };
}

export function chargeController(input) {
  const shared = {
    panelVoc: positive(input.panelVoc ?? 0.1, 1000),
    panelVmp: positive(input.panelVmp ?? 0.1, 1000),
    panelIsc: positive(input.panelIsc ?? 0.1, 1000),
    panelImp: positive(input.panelImp ?? 0.1, 1000),
  };
  const sourceArrays =
    Array.isArray(input.arrays) && input.arrays.length ? input.arrays : [input];
  if (sourceArrays.length > 12)
    throw new Error("Use at most 12 independent arrays");
  const minimumTempC = clamp(input.minimumTempC ?? -10, -60, 60);
  const tempCoefficientPercent = Math.abs(
    clamp(input.tempCoefficientPercent ?? -0.28, -2, 0),
  );
  const temperatureMultiplier =
    1 + (tempCoefficientPercent / 100) * Math.max(0, 25 - minimumTempC);
  const arrays = sourceArrays.map((array) => {
    const panelVoc = positive(array.panelVoc ?? shared.panelVoc, 1000);
    const panelVmp = positive(array.panelVmp ?? shared.panelVmp, 1000);
    const panelIsc = positive(array.panelIsc ?? shared.panelIsc, 1000);
    const panelImp = positive(array.panelImp ?? shared.panelImp, 1000);
    if (panelVmp > panelVoc || panelImp > panelIsc)
      throw new Error(
        "Operating voltage/current cannot exceed open-circuit voltage/short-circuit current",
      );
    const seriesCount = count(array.seriesCount ?? 1);
    const parallelCount = count(array.parallelCount ?? 1);
    return {
      panelVoc,
      panelVmp,
      panelIsc,
      panelImp,
      seriesCount,
      parallelCount,
      arrayWatts: panelVmp * panelImp * seriesCount * parallelCount,
      arrayVmp: panelVmp * seriesCount,
      arrayIsc: panelIsc * parallelCount,
      arrayImp: panelImp * parallelCount,
      coldArrayVoc: panelVoc * seriesCount * temperatureMultiplier,
    };
  });
  const calculatedArrayWatts = arrays.reduce(
    (sum, array) => sum + array.arrayWatts,
    0,
  );
  const arrayWatts =
    input.arrays === undefined &&
    (input.panelVmp === undefined || input.panelImp === undefined)
      ? clamp(input.arrayWatts ?? 0, 0, 100000)
      : calculatedArrayWatts;
  const batteryVoltage = positive(input.batteryVoltage ?? 48, 400);
  const currentWithMargin = (arrayWatts / batteryVoltage) * 1.25;
  const coldVoc = Math.max(...arrays.map((array) => array.coldArrayVoc), 0);
  return {
    batteryVoltage,
    arrayWatts,
    arrayWithinLimit: arrayWatts <= 100000,
    arrayVmp: Math.max(...arrays.map((array) => array.arrayVmp), 0),
    arrayIsc: arrays.reduce((sum, array) => sum + array.arrayIsc, 0),
    arrayImp: arrays.reduce((sum, array) => sum + array.arrayImp, 0),
    arrays,
    minimumOutputAmps: currentWithMargin,
    suggestedControllerAmps: nextStandard(
      currentWithMargin,
      standardControllerAmps,
    ),
    minimumPvInputVolts: coldVoc * 1.1,
    coldArrayVoc: coldVoc,
  };
}

export function touBattery(input) {
  const dailyUsageKwh = clamp(
      input.dailyUsageKwh ?? input.peakUsageKwh ?? 0,
      0,
      10000,
    ),
    peakRate = clamp(input.peakRate ?? 0, 0, 10),
    midPeakRate = clamp(input.midPeakRate ?? 0, 0, 10),
    offPeakRate = clamp(input.offPeakRate ?? 0, 0, 10),
    onPeakShare = clamp(input.onPeakSharePercent ?? 35, 0, 100),
    midPeakShare = clamp(input.midPeakSharePercent ?? 30, 0, 100 - onPeakShare),
    roundTripEfficiency = positive(input.roundTripEfficiencyPercent ?? 90, 100),
    dischargeEfficiency = positive(input.dischargeEfficiencyPercent ?? 95, 100),
    reserve = clamp(input.reservePercent ?? 10, 0, 95),
    autonomyDays = clamp(input.autonomyDays ?? 1, 0, 30);
  if (roundTripEfficiency > dischargeEfficiency)
    throw new Error(
      "Round-trip efficiency cannot exceed discharge efficiency for the same energy boundaries",
    );
  const usableFraction = (dischargeEfficiency / 100) * (1 - reserve / 100),
    shiftableKwh = (dailyUsageKwh * (onPeakShare + midPeakShare)) / 100,
    touBatteryKwh = shiftableKwh / usableFraction,
    emergencyBatteryKwh = (dailyUsageKwh * autonomyDays) / usableFraction,
    recommendedBatteryKwh = Math.max(touBatteryKwh, emergencyBatteryKwh),
    avoidedDailyCost =
      dailyUsageKwh *
      ((onPeakShare / 100) * peakRate + (midPeakShare / 100) * midPeakRate),
    rechargeKwh = shiftableKwh / (roundTripEfficiency / 100),
    dailySavings = avoidedDailyCost - rechargeKwh * offPeakRate;
  return {
    shiftableKwh,
    touBatteryKwh,
    emergencyBatteryKwh,
    recommendedBatteryKwh,
    rechargeKwh,
    dailySavings,
    annualSavings: dailySavings * 365,
    onPeakShare,
    midPeakShare,
    offPeakShare: 100 - onPeakShare - midPeakShare,
    dischargeEfficiency,
    roundTripEfficiency,
  };
}

const cableCatalog = [
  {
    gauge: "16 AWG",
    copperOhms: 4.016,
    aluminumOhms: 6.385,
    copperAmpacity: 10,
    aluminumAmpacity: 8,
    copperCost: 0.62,
    aluminumCost: 0.44,
  },
  {
    gauge: "14 AWG",
    copperOhms: 2.525,
    aluminumOhms: 4.016,
    copperAmpacity: 15,
    aluminumAmpacity: 12,
    copperCost: 0.78,
    aluminumCost: 0.55,
  },
  {
    gauge: "12 AWG",
    copperOhms: 1.588,
    aluminumOhms: 2.525,
    copperAmpacity: 20,
    aluminumAmpacity: 15,
    copperCost: 1.02,
    aluminumCost: 0.7,
  },
  {
    gauge: "10 AWG",
    copperOhms: 0.999,
    aluminumOhms: 1.588,
    copperAmpacity: 30,
    aluminumAmpacity: 25,
    copperCost: 1.42,
    aluminumCost: 0.94,
  },
  {
    gauge: "8 AWG",
    copperOhms: 0.6282,
    aluminumOhms: 0.9987,
    copperAmpacity: 40,
    aluminumAmpacity: 35,
    copperCost: 2.05,
    aluminumCost: 1.28,
  },
  {
    gauge: "6 AWG",
    copperOhms: 0.3951,
    aluminumOhms: 0.6282,
    copperAmpacity: 55,
    aluminumAmpacity: 45,
    copperCost: 3.05,
    aluminumCost: 1.82,
  },
  {
    gauge: "4 AWG",
    copperOhms: 0.2485,
    aluminumOhms: 0.3951,
    copperAmpacity: 70,
    aluminumAmpacity: 55,
    copperCost: 4.4,
    aluminumCost: 2.5,
  },
  {
    gauge: "2 AWG",
    copperOhms: 0.1563,
    aluminumOhms: 0.2485,
    copperAmpacity: 95,
    aluminumAmpacity: 75,
    copperCost: 6.5,
    aluminumCost: 3.55,
  },
  {
    gauge: "1/0 AWG",
    copperOhms: 0.0983,
    aluminumOhms: 0.1563,
    copperAmpacity: 125,
    aluminumAmpacity: 100,
    copperCost: 9.8,
    aluminumCost: 5.15,
  },
  {
    gauge: "2/0 AWG",
    copperOhms: 0.0779,
    aluminumOhms: 0.1239,
    copperAmpacity: 145,
    aluminumAmpacity: 115,
    copperCost: 12.4,
    aluminumCost: 6.2,
  },
  {
    gauge: "4/0 AWG",
    copperOhms: 0.049,
    aluminumOhms: 0.0779,
    copperAmpacity: 195,
    aluminumAmpacity: 150,
    copperCost: 19.5,
    aluminumCost: 9.4,
  },
];

export function cableSizing(input) {
  const voltage = positive(input.voltage ?? 48, 1000);
  const currentA = clamp(input.currentA ?? 0, 0, 1000);
  const lengthFt = clamp(input.lengthFt ?? 0, 0, 10000);
  const maxDropPercent = clamp(input.maxDropPercent ?? 2, 0.25, 10);
  const material =
    String(input.material ?? "copper").toLowerCase() === "aluminum"
      ? "aluminum"
      : "copper";
  const requiredAmpacity = currentA * 1.25;
  const candidates = cableCatalog.map((cable) => {
    const ohmsPerKft =
      material === "copper" ? cable.copperOhms : cable.aluminumOhms;
    const ampacity =
      material === "copper" ? cable.copperAmpacity : cable.aluminumAmpacity;
    const dropVolts = (2 * lengthFt * currentA * ohmsPerKft) / 1000;
    return {
      ...cable,
      ohmsPerKft,
      ampacity,
      dropVolts,
      dropPercent: (dropVolts / voltage) * 100,
    };
  });
  const selected =
    candidates.find(
      (cable) =>
        cable.ampacity >= requiredAmpacity &&
        cable.dropPercent <= maxDropPercent,
    ) ?? null;
  if (!selected)
    return {
      gauge: null,
      material,
      requiredAmpacity,
      dropVolts: null,
      dropPercent: null,
      estimatedCableCost: null,
      estimatedCostPerFt: null,
      conductorFeet: lengthFt * 2,
      meetsDesignTarget: false,
      largestEvaluated: candidates.at(-1),
    };
  const costPerFt =
    material === "copper" ? selected.copperCost : selected.aluminumCost;
  return {
    gauge: selected.gauge,
    material,
    requiredAmpacity,
    dropVolts: selected.dropVolts,
    dropPercent: selected.dropPercent,
    estimatedCableCost: costPerFt * lengthFt * 2,
    estimatedCostPerFt: costPerFt,
    conductorFeet: lengthFt * 2,
    meetsDesignTarget:
      selected.ampacity >= requiredAmpacity &&
      selected.dropPercent <= maxDropPercent,
  };
}

export function payback(input) {
  const grossCost = clamp(input.grossCost ?? 0, 0, 250000);
  const incentivePercent = clamp(input.incentivePercent ?? 0, 0, 100);
  const annualProductionKwh = clamp(input.annualProductionKwh ?? 0, 0, 1000000);
  const electricityRate = clamp(input.electricityRate ?? 0, 0, 2);
  const escalationPercent = clamp(input.escalationPercent ?? 2.5, 0, 10);
  const degradationPercent = clamp(input.degradationPercent ?? 0.5, 0, 5);
  const annualMaintenance = clamp(input.annualMaintenance ?? 100, 0, 10000);
  const netCost = grossCost * (1 - incentivePercent / 100);
  let cumulative = -netCost;
  let paybackYear = null;
  const cashFlow = Array.from({ length: 25 }, (_, index) => {
    const year = index + 1;
    const production =
      annualProductionKwh * Math.pow(1 - degradationPercent / 100, index);
    const rate = electricityRate * Math.pow(1 + escalationPercent / 100, index);
    const annualSavings = production * rate - annualMaintenance;
    cumulative += annualSavings;
    if (paybackYear === null && cumulative >= 0) paybackYear = year;
    return {
      year,
      productionKwh: production,
      annualSavings,
      cumulativeSavings: cumulative,
    };
  });
  return {
    netCost,
    firstYearSavings: cashFlow[0]?.annualSavings || 0,
    paybackYear,
    twentyFiveYearNet: cumulative,
    cashFlow,
  };
}

export const calculatorHandlers = {
  "battery-runtime": batteryRuntime,
  "voltage-drop": voltageDrop,
  "fuse-breaker": fuseBreaker,
  "array-voltage": arrayVoltage,
  "charge-controller": chargeController,
  "tou-battery": touBattery,
  "cable-sizing": cableSizing,
  payback,
};
