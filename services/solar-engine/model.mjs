const monthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const midMonthDays = [15, 45, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349];
function finite(value, min, max) {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    String(value).trim() === "" ||
    !Number.isFinite(Number(value))
  )
    throw new Error("Use finite numeric values");
  return Math.max(min, Math.min(max, Number(value)));
}
export function solarMonthWeights(latitude, tilt) {
  const phi = (latitude * Math.PI) / 180,
    tiltRadians = (tilt * Math.PI) / 180;
  const raw = midMonthDays.map((day, i) => {
    const declination =
      (23.45 * Math.sin((2 * Math.PI * (284 + day)) / 365) * Math.PI) / 180;
    const sunset = Math.acos(
      Math.max(-1, Math.min(1, -Math.tan(phi) * Math.tan(declination))),
    );
    const daylight = (24 * sunset) / Math.PI,
      elevation = Math.max(
        0.04,
        Math.sin(Math.PI / 2 - Math.abs(phi - declination)),
      );
    return (
      monthDays[i] *
      daylight *
      elevation *
      (0.55 +
        0.45 *
          Math.max(
            0.08,
            Math.cos(
              Math.abs(
                phi - declination - Math.sign(latitude || 1) * tiltRadians,
              ),
            ),
          ))
    );
  });
  const total = raw.reduce((a, b) => a + b, 0);
  return raw.map((n) => n / total);
}
export function productionFinancials(input, annualKwh) {
  const capacity = finite(input.capacityKw ?? 0, 0, 1000),
    rate = finite(input.electricityRate ?? 0.19, 0, 10),
    usage = finite(input.annualUsageKwh ?? 10000, 0, 10000000),
    installedCost = capacity * finite(input.costPerWatt ?? 3, 0, 30) * 1000,
    incentive = finite(input.incentivePercent ?? 0, 0, 100),
    netCost = installedCost * (1 - incentive / 100);
  let cumulative = -Math.round(netCost);
  const cashFlow = Array.from({ length: 25 }, (_, i) => {
    const productionKwh = Math.round(annualKwh * Math.pow(0.995, i)),
      annualSavings = Math.round(productionKwh * rate * Math.pow(1.025, i));
    cumulative += annualSavings;
    return {
      year: i + 1,
      productionKwh,
      annualSavings,
      cumulativeSavings: cumulative,
    };
  });
  const energyOffsetPercent =
    usage > 0 ? Math.min(100, Math.round((annualKwh / usage) * 100)) : null;
  return {
    yearlyBillValue: Math.round(annualKwh * rate),
    installedCost: Math.round(installedCost),
    netCost: Math.round(netCost),
    energyOffsetPercent,
    billOffsetPercent: energyOffsetPercent,
    cashFlow,
  };
}
export function withProduction(input, base, monthlyKwh, provider) {
  if (
    monthlyKwh.length !== 12 ||
    monthlyKwh.some((n) => !Number.isFinite(n) || n < 0)
  )
    throw new Error("Expected twelve nonnegative production values");
  const annualKwh = monthlyKwh.reduce((a, b) => a + b, 0);
  return {
    ...base,
    ...productionFinancials(input, annualKwh),
    provider,
    annualKwh,
    monthlyKwh,
  };
}
export function localEstimate(input) {
  const capacityKw = finite(input.capacityKw ?? 0, 0, 1000),
    losses = finite(input.lossesPercent ?? 14, 0, 99),
    latitude = finite(input.latitude ?? 43, -66, 66),
    absoluteLatitude = Math.abs(latitude),
    peakSunHours = finite(
      input.peakSunHours ??
        Math.max(2.35, Math.min(5.8, 5.55 - absoluteLatitude * 0.057)),
      0,
      24,
    ),
    azimuth = finite(input.azimuth ?? 180, 0, 360),
    tilt = finite(input.tilt ?? absoluteLatitude * 0.76, 0, 90);
  const diff = Math.abs(
      ((azimuth - (latitude >= 0 ? 180 : 0) + 540) % 360) - 180,
    ),
    orientationFactor = Math.max(0.54, 1 - diff / 390),
    tiltFactor = Math.max(
      0.76,
      1 - Math.abs(tilt - absoluteLatitude * 0.76) / 175,
    ),
    annualKwh = Math.round(
      capacityKw *
        peakSunHours *
        365 *
        (1 - losses / 100) *
        orientationFactor *
        tiltFactor,
    ),
    exactMonths = solarMonthWeights(latitude, tilt).map((n) => n * annualKwh),
    monthlyKwh = exactMonths.map(Math.floor);
  const remainder = annualKwh - monthlyKwh.reduce((a, b) => a + b, 0);
  const order = exactMonths
    .map((n, i) => ({ i, fraction: n - monthlyKwh[i] }))
    .sort((a, b) => b.fraction - a.fraction);
  for (let i = 0; i < remainder; i++) monthlyKwh[order[i].i]++;
  return {
    provider: "Solar4U simplified seasonal model",
    providerVersion: "2.0.0",
    assumptions: {
      peakSunHours,
      lossesPercent: losses,
      orientationFactor,
      tiltFactor,
      latitude,
      azimuth,
      tilt,
    },
    capacityKw,
    annualKwh,
    monthlyKwh,
    ...productionFinancials(input, annualKwh),
    suggestedBatteryKwh: Math.ceil(capacityKw * 0.65),
  };
}
export function fitGroundArray(input) {
  const areaSqM = Number(input.areaSqM ?? 0),
    panelWidthM = Number(input.panelWidthM ?? 1.134),
    panelHeightM = Number(input.panelHeightM ?? 1.722),
    rowSpacingM = Number(input.rowSpacingM ?? 1),
    setbackM = Number(input.setbackM ?? 0.9),
    panelWatts = Number(input.panelWatts ?? 400);
  if (
    ![
      areaSqM,
      panelWidthM,
      panelHeightM,
      rowSpacingM,
      setbackM,
      panelWatts,
    ].every(Number.isFinite) ||
    areaSqM < 0 ||
    areaSqM > 1000000 ||
    panelWidthM <= 0 ||
    panelHeightM <= 0 ||
    rowSpacingM < 0 ||
    setbackM < 0 ||
    panelWatts < 0
  )
    throw new Error("Invalid ground dimensions");
  const side = Math.max(0, Math.sqrt(areaSqM) - 2 * setbackM),
    panelCount =
      Math.floor(side / panelWidthM) *
      Math.max(
        0,
        Math.floor((side + rowSpacingM) / (panelHeightM + rowSpacingM)),
      );
  return {
    panelCount,
    usableAreaSqM: Math.round(side * side * 10) / 10,
    capacityKw: (panelCount * panelWatts) / 1000,
    assumptions: { panelWidthM, panelHeightM, rowSpacingM, setbackM },
  };
}
