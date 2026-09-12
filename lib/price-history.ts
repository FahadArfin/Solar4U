export type PricePoint = [string, number, boolean | null];
export function parsePriceHistory(value: unknown): PricePoint[] {
  if (!Array.isArray(value) || value.length > 10000)
    throw new Error("Invalid price history response");
  const dates = new Map<string, PricePoint>();
  for (const row of value) {
    if (
      !Array.isArray(row) ||
      row.length !== 3 ||
      typeof row[0] !== "string" ||
      !Number.isFinite(Date.parse(row[0])) ||
      !Number.isSafeInteger(row[1]) ||
      row[1] < 0 ||
      row[1] > 1e10 ||
      ![true, false, null].includes(row[2])
    )
      throw new Error("Invalid price history observation");
    const date = new Date(row[0]).toISOString();
    dates.set(date, [date, row[1], row[2]]);
  }
  return [...dates.values()].sort((a, b) => a[0].localeCompare(b[0]));
}
export function historySummary(points: PricePoint[]) {
  if (!points.length) return null;
  return {
    low: Math.min(...points.map((p) => p[1])),
    high: Math.max(...points.map((p) => p[1])),
    first: points[0][1],
    latest: points[points.length - 1][1],
    change: points[points.length - 1][1] - points[0][1],
  };
}
