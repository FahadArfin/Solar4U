import test from "node:test";
import assert from "node:assert/strict";
import { localEstimate, withProduction } from "./model.mjs";
import { controllerShortlist } from "./controller-catalog.mjs";
import {
  arrayVoltage,
  batteryRuntime,
  cableSizing,
  chargeController,
  fuseBreaker,
  payback,
  touBattery,
  voltageDrop,
} from "./calculators.mjs";

test("local estimate reconciles its monthly and annual production", () => {
  const result = localEstimate({
    capacityKw: 10,
    latitude: 43,
    longitude: -78.8,
    tilt: 35,
    azimuth: 180,
  });
  assert.equal(
    result.monthlyKwh.reduce((sum, value) => sum + value, 0),
    result.annualKwh,
  );
});

test("northern winter production is materially lower than summer", () => {
  const north = localEstimate({
    capacityKw: 10,
    latitude: 43,
    tilt: 35,
    azimuth: 180,
  });
  const warm = localEstimate({
    capacityKw: 10,
    latitude: 27.7,
    tilt: 25,
    azimuth: 180,
  });
  assert.ok(north.monthlyKwh[11] < north.monthlyKwh[5] * 0.55);
  assert.ok(
    north.monthlyKwh[11] / north.monthlyKwh[5] <
      warm.monthlyKwh[11] / warm.monthlyKwh[5],
  );
});

test("south-facing array outproduces north-facing array in New York", () => {
  const south = localEstimate({
    capacityKw: 10,
    latitude: 43,
    tilt: 35,
    azimuth: 180,
  });
  const north = localEstimate({
    capacityKw: 10,
    latitude: 43,
    tilt: 35,
    azimuth: 0,
  });
  assert.ok(south.annualKwh > north.annualKwh * 1.5);
});

test("battery runtime applies depth-of-discharge and efficiency", () => {
  assert.equal(
    batteryRuntime({
      capacityKwh: 10,
      loadWatts: 1000,
      depthOfDischargePercent: 80,
      efficiencyPercent: 90,
    }).runtimeHours,
    7.2,
  );
});

test("voltage drop uses round-trip conductor length", () => {
  const result = voltageDrop({
    voltage: 48,
    currentA: 20,
    lengthFt: 50,
    ohmsPerKft: 1,
  });
  assert.equal(result.dropVolts, 2);
  assert.equal(result.status, "review");
});

test("overcurrent recommendation must fit conductor ampacity", () => {
  assert.deepEqual(
    fuseBreaker({ continuousCurrentA: 40, conductorAmpacityA: 60 }),
    {
      minimumAmps: 50,
      recommendedAmps: 50,
      conductorSuitable: true,
      note: "Confirm terminal ratings, conductor corrections, equipment instructions, and the locally adopted electrical code.",
    },
  );
});

test("cold array voltage rises below standard test temperature", () => {
  assert.ok(
    arrayVoltage({
      panelVoc: 50,
      panelVmp: 42,
      panelIsc: 12,
      panelImp: 11,
      seriesCount: 5,
      parallelCount: 2,
      minimumTempC: -10,
      tempCoefficientPercent: -0.28,
    }).coldVoc > 270,
  );
});

test("array-voltage inputs are clamped to the supported design envelope", () => {
  const result = arrayVoltage({
    panelVoc: 1200,
    panelVmp: 1200,
    panelIsc: 1200,
    panelImp: 1200,
    seriesCount: 101,
    parallelCount: 101,
    minimumTempC: -100,
  });
  assert.equal(result.arrayVmp, 100000);
  assert.equal(result.arrayIsc, 100000);
  assert.ok(result.coldVoc > 100000);
});

test("charge controller derives power and current from panel specs and parallel strings", () => {
  const result = chargeController({
    panelVoc: 50,
    panelVmp: 40,
    panelIsc: 12,
    panelImp: 10,
    seriesCount: 10,
    parallelCount: 5,
    batteryVoltage: 51.2,
    minimumTempC: -20,
  });
  assert.equal(result.arrayWatts, 20000);
  assert.equal(result.arrayIsc, 60);
  assert.equal(result.batteryVoltage, 51.2);
  assert.equal(result.minimumOutputAmps, 488.28125);
  assert.equal(result.arrayWithinLimit, true);
});

test("charge controller enforces battery voltage and array-power limits", () => {
  const result = chargeController({
    panelVoc: 1000,
    panelVmp: 1000,
    panelIsc: 1000,
    panelImp: 1000,
    seriesCount: 100,
    parallelCount: 100,
    batteryVoltage: 800,
    minimumTempC: -100,
  });
  assert.equal(result.arrayWatts, 10000000000);
  assert.equal(result.arrayWithinLimit, false);
  assert.equal(result.batteryVoltage, 400);
  assert.equal(result.minimumOutputAmps, 31250000);
});

test("charge controller combines independent arrays without coupling series and parallel counts", () => {
  const result = chargeController({
    panelVoc: 50,
    panelVmp: 40,
    panelIsc: 12,
    panelImp: 10,
    batteryVoltage: 48,
    arrays: [
      { seriesCount: 10, parallelCount: 2 },
      {
        panelVoc: 45,
        panelVmp: 37,
        panelIsc: 11,
        panelImp: 9,
        seriesCount: 6,
        parallelCount: 3,
      },
    ],
  });
  assert.equal(result.arrayWatts, 13994);
  assert.equal(result.arrayIsc, 57);
  assert.equal(result.arrays[0].arrayVmp, 400);
  assert.equal(result.arrays[1].arrayVmp, 222);
});

test("payback produces a bounded 25-year cash flow", () => {
  const result = payback({
    grossCost: 20000,
    incentivePercent: 30,
    annualProductionKwh: 10000,
    electricityRate: 0.2,
  });
  assert.equal(result.cashFlow.length, 25);
  assert.ok(result.paybackYear > 0 && result.paybackYear < 25);
});

test("payback clamps values to the requested maximums", () => {
  const result = payback({
    grossCost: 999999,
    annualProductionKwh: 2000000,
    electricityRate: 5,
    escalationPercent: 20,
    degradationPercent: 8,
    annualMaintenance: 50000,
    incentivePercent: 0,
  });
  assert.equal(result.netCost, 250000);
  assert.equal(result.cashFlow[0].productionKwh, 1000000);
  assert.equal(result.cashFlow[0].annualSavings, 1990000);
  assert.equal(result.cashFlow[1].productionKwh, 950000);
});

test("cable sizing enforces both ampacity and voltage-drop constraints", () => {
  const result = cableSizing({
    voltage: 48,
    currentA: 80,
    lengthFt: 20,
    maxDropPercent: 2,
    material: "copper",
  });
  assert.ok(result.requiredAmpacity >= 100);
  assert.ok(result.dropPercent <= 2);
  assert.match(result.gauge, /AWG/);
});

test("TOU battery recommendation covers emergency autonomy when it is larger", () => {
  const result = touBattery({
    dailyUsageKwh: 20,
    onPeakSharePercent: 35,
    midPeakSharePercent: 30,
    reservePercent: 20,
    roundTripEfficiencyPercent: 90,
    autonomyDays: 2,
  });
  assert.ok(result.emergencyBatteryKwh > result.touBatteryKwh);
  assert.equal(result.recommendedBatteryKwh, result.emergencyBatteryKwh);
});

test("zero battery, zero load, and invalid electrical inputs stay explicit", () => {
  assert.equal(
    batteryRuntime({ capacityKwh: 0, loadWatts: 100 }).runtimeHours,
    0,
  );
  assert.equal(
    batteryRuntime({ capacityKwh: 10, loadWatts: 0 }).runtimeHours,
    null,
  );
  assert.equal(
    voltageDrop({ voltage: 48, currentA: 0, lengthFt: 0 }).dropVolts,
    0,
  );
  assert.throws(() => voltageDrop({ voltage: 0 }), /positive/);
  assert.throws(() => batteryRuntime({ capacityKwh: Infinity }));
  assert.throws(() => arrayVoltage({ seriesCount: 1.5 }));
  assert.throws(() => arrayVoltage({ panelVoc: 30, panelVmp: 40 }));
});

test("small arrays never acquire negative months from rounding", () => {
  for (let i = 0; i < 100; i++) {
    const r = localEstimate({ capacityKw: i / 10000, latitude: 43 });
    assert.ok(r.monthlyKwh.every((n) => n >= 0));
    assert.equal(
      r.annualKwh,
      r.monthlyKwh.reduce((a, b) => a + b, 0),
    );
  }
  assert.equal(localEstimate({ capacityKw: 10, peakSunHours: 0 }).annualKwh, 0);
});

test("climate production recomputes cash flow and uses incentive percentages", () => {
  for (const incentivePercent of [0, 30, 100]) {
    const input = {
      capacityKw: 10,
      costPerWatt: 3,
      incentivePercent,
      electricityRate: 0.2,
      annualUsageKwh: 0,
    };
    const r = withProduction(
      input,
      localEstimate(input),
      Array(12).fill(500),
      "test climate",
    );
    assert.equal(r.netCost, Math.round(30000 * (1 - incentivePercent / 100)));
    assert.equal(r.cashFlow[0].productionKwh, 6000);
    assert.equal(r.cashFlow[0].annualSavings, 1200);
    assert.equal(r.cashFlow[0].cumulativeSavings, 1200 - r.netCost);
    assert.equal(r.energyOffsetPercent, null);
  }
});

test("cable sizing gives no recommendation when the table cannot qualify", () => {
  const r = cableSizing({ voltage: 48, currentA: 200, lengthFt: 20 });
  assert.equal(r.gauge, null);
  assert.equal(r.estimatedCableCost, null);
  assert.equal(r.meetsDesignTarget, false);
});

test("TOU normalizes shares and distinguishes capacity losses from recharge cost", () => {
  const input = {
    dailyUsageKwh: 20,
    onPeakSharePercent: 90,
    midPeakSharePercent: 30,
    peakRate: 0.1,
    midPeakRate: 0.1,
    offPeakRate: 0.2,
    reservePercent: 0,
    autonomyDays: 0,
    dischargeEfficiencyPercent: 100,
    roundTripEfficiencyPercent: 80,
  };
  const r = touBattery(input);
  assert.equal(r.midPeakShare, 10);
  assert.equal(r.offPeakShare, 0);
  assert.equal(r.touBatteryKwh, 20);
  assert.equal(r.rechargeKwh, 25);
  assert.equal(r.dailySavings, -3);
  assert.equal(
    touBattery({ ...input, dischargeEfficiencyPercent: 80 }).touBatteryKwh,
    25,
  );
});

test("controller shortlist checks startup, real PV Isc limits, and whole strings", () => {
  const input = {
    panelVoc: 49.5,
    panelVmp: 41.7,
    panelIsc: 10.4,
    panelImp: 9.6,
    seriesCount: 1,
    parallelCount: 1,
    nominalBatteryVoltage: 48,
    batteryChargingVoltage: 56.8,
  };
  assert.ok(
    controllerShortlist(input).candidates.every((c) => !c.preliminaryMatch),
  );
  const two = controllerShortlist({ ...input, seriesCount: 2 });
  assert.ok(two.candidates[0].preliminaryMatch);
  const overcurrent = controllerShortlist({
    ...input,
    seriesCount: 2,
    parallelCount: 5,
  });
  assert.equal(overcurrent.candidates[0].maxPvIscA, 45);
  assert.ok(
    overcurrent.candidates[0].failures.some((s) => s.includes("short-circuit")),
  );
  assert.throws(() => controllerShortlist({ ...input, seriesCount: 2.2 }));
  assert.throws(() => controllerShortlist({ ...input, minimumTempC: 60, maximumCellTempC: 25 }));
  assert.throws(() => controllerShortlist({ ...input, maximumCellTempC: 100, vmpCoefficientPercent: -2 }));
});
test("TOU rejects inconsistent efficiency boundaries", () => {
  assert.throws(() => touBattery({roundTripEfficiencyPercent:100,dischargeEfficiencyPercent:1}));
});
