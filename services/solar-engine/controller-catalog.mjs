import { arrayVoltage } from "./calculators.mjs";
const base = "https://www.victronenergy.com/media/pg/";
export const verifiedControllers = [
  {
    model: "SmartSolar MPPT 150/45",
    maxColdVocV: 150,
    maxOperatingPvV: null,
    maxPvIscA: 45,
    maxChargeCurrentA: 45,
    nominalPvPowerW: [650, 1300, 1950, 2600],
    source:
      base +
      "Manual_SmartSolar_MPPT_150-35__150-45/en/technical-specifications.html",
  },
  {
    model: "SmartSolar MPPT 150/60",
    maxColdVocV: 150,
    maxOperatingPvV: 145,
    maxPvIscA: 50,
    maxChargeCurrentA: 60,
    nominalPvPowerW: [860, 1720, 2580, 3440],
    source:
      base +
      "Manual_SmartSolar_MPPT_150-60_up_to_250-70/en/technical-specifications.html",
  },
  {
    model: "SmartSolar MPPT 150/70",
    maxColdVocV: 150,
    maxOperatingPvV: 145,
    maxPvIscA: 50,
    maxChargeCurrentA: 70,
    nominalPvPowerW: [1000, 2000, 3000, 4000],
    source:
      base +
      "Manual_SmartSolar_MPPT_150-60_up_to_250-70/en/technical-specifications.html",
  },
  {
    model: "SmartSolar MPPT 250/100 VE.Can",
    maxColdVocV: 250,
    maxOperatingPvV: 245,
    maxPvIscA: 70,
    maxChargeCurrentA: 100,
    nominalPvPowerW: [1450, 2900, 4350, 5800],
    source:
      base +
      "Manual_SmartSolar_MPPT_150-70_up_to_250-100_VE.Can/en/technical-specifications.html",
  },
];
export function controllerShortlist(input) {
  const array = arrayVoltage(input),
    nominal = Number(input.nominalBatteryVoltage ?? 48),
    charging = Number(input.batteryChargingVoltage ?? 56.8),
    temperature = Number(input.maximumCellTempC ?? 70),
    coefficient = Number(input.vmpCoefficientPercent ?? -0.35);
  if (
    ![12, 24, 36, 48].includes(nominal) ||
    !Number.isFinite(charging) ||
    charging < nominal ||
    charging > nominal * 1.4 ||
    !Number.isFinite(temperature) ||
    temperature < 25 ||
    temperature > 100 ||
    !Number.isFinite(coefficient) ||
    coefficient > 0 ||
    coefficient < -2
  )
    throw new Error(
      "Check the nominal battery, charging voltage and hot-cell assumptions",
    );
  const hotVmp =
    array.arrayVmp * (1 + (coefficient / 100) * (temperature - 25));
  if (Number(input.minimumTempC ?? -15) > temperature || hotVmp <= 0)
    throw new Error(
      "Minimum temperature must not exceed maximum temperature, and the hot-voltage factor must stay positive",
    );
  return {
    array,
    hotVmp,
    chargingVoltage: charging,
    candidates: verifiedControllers.map((c) => {
      const failures = [];
      if (array.coldVoc >= c.maxColdVocV)
        failures.push(
          "Cold open-circuit voltage reaches or exceeds the absolute input limit",
        );
      if (array.arrayIsc > c.maxPvIscA)
        failures.push("PV short-circuit current exceeds the input limit");
      if (hotVmp <= charging + 5)
        failures.push(
          "Hot operating voltage does not exceed charging voltage plus the 5 V startup margin",
        );
      if (c.maxOperatingPvV !== null && array.coldVoc > c.maxOperatingPvV)
        failures.push("Cold PV voltage exceeds the startup ceiling");
      const nominalPower = c.nominalPvPowerW[[12, 24, 36, 48].indexOf(nominal)];
      return {
        ...c,
        failures,
        preliminaryMatch: failures.length === 0,
        nominalPower,
        powerLimited: array.arrayWatts > nominalPower,
        notes: [
          "One MPPT input: strings connected in parallel need compatible operating voltages.",
          "Temperature coefficients apply to every array. Calculate mixed module types separately if their coefficients differ.",
          "Verify actual cell temperatures, battery profile, connector ratings and whole-string allocation.",
          ...(nominal === 36
            ? ["36 V requires manual battery selection."]
            : []),
        ],
      };
    }),
  };
}
