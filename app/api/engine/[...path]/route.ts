import { roofCapabilities } from "../../../../lib/runtime-env";
import {
  localEstimate,
  withProduction,
} from "../../../../services/solar-engine/model.mjs";
type Context = { params: Promise<{ path: string[] }> };
function numeric(value: unknown, min: number, max: number, fallback: number) {
  if (value === undefined) return fallback;
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    String(value).trim() === ""
  )
    throw new Error("Expected a number");
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max)
    throw new Error(`Value must be between ${min} and ${max}`);
  return n;
}
function values(input: Record<string, unknown>) {
  return {
    capacityKw: numeric(input.capacityKw, 0, 1000, 10),
    latitude: numeric(input.latitude, -66, 66, 40),
    longitude: numeric(input.longitude, -180, 180, 0),
    tilt: numeric(input.tilt, 0, 90, 30),
    azimuth: numeric(input.azimuth, 0, 360, 180),
    lossesPercent: numeric(input.lossesPercent, 0, 99, 14),
    electricityRate: numeric(input.electricityRate, 0, 10, 0.19),
    incentivePercent: numeric(input.incentivePercent, 0, 100, 0),
    costPerWatt: numeric(input.costPerWatt, 0, 30, 3),
    annualUsageKwh: numeric(input.annualUsageKwh, 0, 10000000, 10000),
    ...(input.peakSunHours !== undefined
      ? { peakSunHours: numeric(input.peakSunHours, 0, 24, 4) }
      : {}),
  };
}
async function estimate(input: Record<string, unknown>, signal: AbortSignal) {
  const v = values(input),
    base = localEstimate(v);
  if (input.provider !== "pvgis" || v.capacityKw === 0)
    return { ...base, warnings: [] };
  const q = new URLSearchParams({
    lat: String(v.latitude),
    lon: String(v.longitude),
    peakpower: String(v.capacityKw),
    loss: String(v.lossesPercent),
    angle: String(v.tilt),
    aspect: String(v.azimuth - 180),
    outputformat: "json",
  });
  try {
    const r = await fetch(`https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?${q}`, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]),
    });
    if (!r.ok) throw new Error("Climate provider unavailable");
    const d = await r.json();
    const monthlyKwh = (d.outputs?.monthly?.fixed ?? []).map(
      (m: { E_m: number }) => Math.round(m.E_m),
    );
    return {
      ...withProduction(v, base, monthlyKwh, "EU JRC PVGIS 5.3"),
      providerVersion: "5.3",
      assumptions: {
        latitude: v.latitude,
        longitude: v.longitude,
        tilt: v.tilt,
        azimuth: v.azimuth,
        lossesPercent: v.lossesPercent,
      },
      warnings: [
        "Bill value assumes all generated energy receives the entered rate. Use the financial calculator for your actual export arrangement.",
      ],
      sourceUrl: "https://re.jrc.ec.europa.eu/pvg_tools/en/",
    };
  } catch {
    return {
      ...base,
      warnings: [
        "Live climate data is unavailable. Showing a simplified seasonal planning model.",
      ],
    };
  }
}
async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("A JSON body is required");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 20000) {
      await reader.cancel();
      throw new Error("Request exceeds 20 KB");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export async function POST(request: Request, context: Context) {
  try {
    const { path } = await context.params,
      route = path.join("/");
    if (Number(request.headers.get("content-length")) > 20000)
      return Response.json({ error: "Request too large" }, { status: 413 });
    const input = await readBody(request);
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new Error("Expected an object");
    if (route === "v1/solar/estimates") {
      if (input.arrays !== undefined) {
        if (
          !Array.isArray(input.arrays) ||
          input.arrays.length > 12 ||
          input.arrays.some(
            (a: unknown) => !a || typeof a !== "object" || Array.isArray(a),
          )
        )
          throw new Error("Use up to 12 valid array objects");
        const arrayInputs: (ReturnType<typeof values> & {
          provider: unknown;
        })[] = input.arrays.map((a: Record<string, unknown>) => ({
          ...values({ ...input, ...a }),
          provider: input.provider,
        }));
        const capacityKw = arrayInputs.reduce(
          (sum, a) => sum + a.capacityKw,
          0,
        );
        if (capacityKw > 1000)
          throw new Error("Total capacity exceeds 1000 kW");
        const estimates = await Promise.all(
          arrayInputs.map((a) => estimate(a, request.signal)),
        );
        const monthlyKwh = Array.from({ length: 12 }, (_, i) =>
            estimates.reduce((sum, e) => sum + e.monthlyKwh[i], 0),
          ),
          v = values({ ...input, capacityKw }),
          base = localEstimate(v),
          provider =
            estimates.length &&
            estimates.every((e) => e.provider === "EU JRC PVGIS 5.3")
              ? "EU JRC PVGIS 5.3 · multiple arrays"
              : estimates.some((e) => e.provider === "EU JRC PVGIS 5.3")
                ? "Mixed PVGIS and simplified seasonal estimates"
                : "Solar4U simplified seasonal model · multiple arrays";
        return Response.json({
          data: {
            ...withProduction(v, base, monthlyKwh, provider),
            arrays: estimates,
            warnings: [...new Set(estimates.flatMap((e) => e.warnings))],
          },
        });
      }
      return Response.json({ data: await estimate(input, request.signal) });
    }
    if (route === "v1/solar/roof-analysis")
      return Response.json({
        data: {
          provider: "manual",
          available: false,
          reason:
            "Use /roof-analysis for aerial data and /api/roof for the current provider API.",
        },
      });
    return Response.json(
      { error: "Unsupported engine operation" },
      { status: 404 },
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Invalid request" },
      { status: 400 },
    );
  }
}
export async function GET(request: Request, context: Context) {
  const { path } = await context.params,
    route = path.join("/");
  if (route === "v1/solar/capabilities")
    return Response.json({
      data: {
        ...roofCapabilities(),
        googlePhotorealistic3d: false,
        roofVision: false,
        manual: true,
      },
    });
  if (["v1/locations/search", "v1/solar/geocode"].includes(route)) {
    const q = new URL(request.url).searchParams.get("q")?.trim();
    if (!q || q.length < 2 || q.length > 150)
      return Response.json(
        { error: "Enter a city or postal code (2–150 characters)" },
        { status: 400 },
      );
    try {
      const r = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`,
        { signal: AbortSignal.timeout(8000) },
      );
      if (!r.ok) throw new Error();
      const body = await r.json();
      return Response.json({
        data: (body.results ?? []).map(
          (v: {
            id: number;
            name: string;
            latitude: number;
            longitude: number;
            admin1?: string;
            country?: string;
          }) => ({
            ...v,
            label: [v.name, v.admin1, v.country].filter(Boolean).join(", "),
            state: v.admin1,
            precision: "locality",
          }),
        ),
        attribution:
          "Open-Meteo / GeoNames. Locality matches are not measured building locations.",
      });
    } catch {
      return Response.json(
        { error: "Location service unavailable", data: [] },
        { status: 503 },
      );
    }
  }
  return Response.json(
    { error: "This imagery operation is not available; use /api/roof." },
    { status: 404 },
  );
}
