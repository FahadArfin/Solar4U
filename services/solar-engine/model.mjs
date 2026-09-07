const monthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const midMonthDays = [15, 45, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349];

function solarMonthWeights(latitude, tilt) {
  const phi = Math.abs(latitude) * Math.PI / 180;
  const tiltRadians = Math.max(0, Math.min(90, tilt)) * Math.PI / 180;
  const raw = midMonthDays.map((dayOfYear, index) => {
    const declination = 23.45 * Math.sin(2 * Math.PI * (284 + dayOfYear) / 365) * Math.PI / 180;
    const sunsetAngle = Math.acos(Math.max(-1, Math.min(1, -Math.tan(phi) * Math.tan(declination))));
    const daylightHours = 24 * sunsetAngle / Math.PI;
    const noonElevation = Math.max(0.04, Math.sin(Math.PI / 2 - Math.abs(phi - declination)));
    const tiltedIncidence = Math.max(0.08, Math.cos(Math.abs(phi - declination - tiltRadians)));
    return monthDays[index] * daylightHours * noonElevation * (0.55 + 0.45 * tiltedIncidence);
  });
  const total = raw.reduce((sum, value) => sum + value, 0);
  return raw.map(value => value / total);
}

function compassDifference(a, b) {
  return Math.abs(((a - b + 540) % 360) - 180);
}

export function localEstimate(input) {
  const capacityKw = Math.max(0.05, Number(input.capacityKw || 0));
  const losses = Math.min(99, Math.max(-5, Number(input.lossesPercent ?? 14)));
  const latitude = Math.max(-66, Math.min(66, Number(input.latitude ?? 43)));
  const absoluteLatitude = Math.abs(latitude);
  const peakSunHours = Math.max(2.35, Math.min(5.8, Number(input.peakSunHours ?? 5.55 - absoluteLatitude * 0.057)));
  const azimuth = ((Number(input.azimuth ?? 180) % 360) + 360) % 360;
  const idealAzimuth = latitude >= 0 ? 180 : 0;
  const orientationDifference = compassDifference(azimuth, idealAzimuth);
  const orientationFactor = Math.max(0.54, 1 - orientationDifference / 390);
  const tilt = Math.max(0, Math.min(90, Number(input.tilt ?? absoluteLatitude * 0.76)));
  const tiltFactor = Math.max(0.76, 1 - Math.abs(tilt - absoluteLatitude * 0.76) / 175);
  const annualKwh = Math.round(capacityKw * peakSunHours * 365 * (1 - losses / 100) * orientationFactor * tiltFactor);
  const monthlyKwh = solarMonthWeights(latitude, tilt).map(weight => Math.round(annualKwh * weight));
  monthlyKwh[11] += annualKwh - monthlyKwh.reduce((sum, value) => sum + value, 0);
  const rate = Number(input.electricityRate ?? 0.19);
  const annualUsage = Number(input.annualUsageKwh ?? 10000);
  const yearlyBillValue = annualKwh * rate;
  const installedCost = capacityKw * Number(input.costPerWatt ?? 3) * 1000;
  const incentive = installedCost * Number(input.incentivePercent ?? 0.3);
  const netCost = installedCost - incentive;
  const cashFlow = Array.from({ length: 25 }, (_, index) => {
    const year = index + 1;
    const production = annualKwh * Math.pow(0.995, index);
    const value = production * rate * Math.pow(1.025, index);
    return { year, productionKwh: Math.round(production), annualSavings: Math.round(value), cumulativeSavings: Math.round(-netCost + value * year) };
  });
  return {
    provider: "solar4u-local-model",
    providerVersion: "1.1.0",
    assumptions: { peakSunHours, lossesPercent: losses, orientationFactor, tiltFactor, latitude, azimuth, tilt },
    capacityKw,
    annualKwh,
    monthlyKwh,
    billOffsetPercent: Math.min(100, Math.round((annualKwh / Math.max(1, annualUsage)) * 100)),
    yearlyBillValue: Math.round(yearlyBillValue),
    installedCost: Math.round(installedCost),
    netCost: Math.round(netCost),
    suggestedBatteryKwh: Math.ceil(capacityKw * 0.65),
    cashFlow,
  };
}

export function fitGroundArray(input) {
  const areaSqM = Number(input.areaSqM || 0);
  const panelWidthM = Number(input.panelWidthM || 1.134);
  const panelHeightM = Number(input.panelHeightM || 1.722);
  const rowSpacingM = Number(input.rowSpacingM || 1);
  const setbackM = Number(input.setbackM || 0.9);
  const usableArea = Math.max(0, areaSqM - setbackM * Math.sqrt(Math.max(areaSqM, 0)) * 4);
  const footprint = panelWidthM * (panelHeightM + rowSpacingM);
  const panelCount = Math.floor(usableArea / Math.max(footprint, 0.1));
  return { panelCount, usableAreaSqM: Math.round(usableArea * 10) / 10, capacityKw: panelCount * Number(input.panelWatts || 400) / 1000, assumptions: { panelWidthM, panelHeightM, rowSpacingM, setbackM } };
}
