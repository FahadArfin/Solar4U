import { runtimeKeys } from "../../../lib/runtime-env";
import type { RoofBuilding, LatLng } from "../../../lib/roof-types";
import { localMetres } from "../../../lib/roof-types";
type Keys = {
  GOOGLE_SOLAR_API_KEY?: string;
  GOOGLE_GEOCODING_API_KEY?: string;
  GOOGLE_MAPS_API_KEY?: string;
};
type Manifest = {
  dsmUrl: string;
  maskUrl: string;
  rgbUrl?: string;
  imageryDate: unknown;
  imageryQuality: string;
};
const manifests = new Map<
  string,
  { expires: number; data: Promise<Manifest> }
>();
// A bounded, per-isolate backstop. Account-wide billing limits belong in the provider project.
const budgets = new Map<string, { remaining: number; reset: number }>();
let activeRequests = 0;
function takeBudget(request: Request) {
  const now = Date.now(),
    id = request.headers.get("cf-connecting-ip") ?? "local";
  for (const [k, v] of budgets) if (v.reset <= now) budgets.delete(k);
  let b = budgets.get(id);
  if (!b) {
    if (budgets.size >= 512) return false;
    b = { remaining: 30, reset: now + 60000 };
    budgets.set(id, b);
  }
  if (b.remaining <= 0 || activeRequests >= 6) return false;
  b.remaining--;
  activeRequests++;
  return true;
}
function keys(): Keys {
  const e = runtimeKeys();
  return {
    GOOGLE_SOLAR_API_KEY:
      e.GOOGLE_SOLAR_API_KEY ?? process.env.GOOGLE_SOLAR_API_KEY,
    GOOGLE_GEOCODING_API_KEY:
      e.GOOGLE_GEOCODING_API_KEY ?? process.env.GOOGLE_GEOCODING_API_KEY,
    GOOGLE_MAPS_API_KEY:
      e.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY,
  };
}
function key(kind: "solar" | "geocode") {
  const k = keys();
  const value =
    (kind === "solar" ? k.GOOGLE_SOLAR_API_KEY : k.GOOGLE_GEOCODING_API_KEY) ||
    k.GOOGLE_MAPS_API_KEY;
  if (!value)
    throw new Error(
      "This provider is not configured. Use the measured studio.",
    );
  return value;
}
function number(v: unknown, min: number, max: number) {
  if (typeof v !== "number" && typeof v !== "string")
    throw new Error("Coordinates and radius must be numbers");
  if (typeof v === "string" && v.trim() === "")
    throw new Error("A coordinate is missing");
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max)
    throw new Error(`Value must be ${min}–${max}`);
  return n;
}
function location(v: Record<string, unknown>): LatLng {
  return {
    latitude: number(v.latitude, -66, 66),
    longitude: number(v.longitude, -180, 180),
  };
}
async function google(url: URL, kind: "solar" | "geocode") {
  url.searchParams.set("key", key(kind));
  const r = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    redirect: "manual",
  }).catch(() => {
    throw new Error(
      "The roof provider request could not complete. Try again later.",
    );
  });
  if (!r.ok)
    throw new Error(
      r.status === 404
        ? "No roof imagery is available at this location."
        : r.status === 429
          ? "The roof provider is busy. Try again later."
          : `Roof provider unavailable (${r.status}).`,
    );
  return r.json();
}
function reply(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
async function manifest(p: LatLng, radius: number): Promise<Manifest> {
  const id = `${p.latitude.toFixed(6)},${p.longitude.toFixed(6)},${radius}`;
  const now = Date.now();
  for (const [k, v] of manifests) if (v.expires < now) manifests.delete(k);
  let m = manifests.get(id);
  if (!m) {
    const u = new URL("https://solar.googleapis.com/v1/dataLayers:get");
    u.searchParams.set("location.latitude", String(p.latitude));
    u.searchParams.set("location.longitude", String(p.longitude));
    u.searchParams.set("radiusMeters", String(radius));
    u.searchParams.set("pixelSizeMeters", "0.25");
    u.searchParams.set("view", "IMAGERY_LAYERS");
    u.searchParams.set("requiredQuality", "MEDIUM");
    if (manifests.size >= 32) manifests.delete(manifests.keys().next().value!);
    const data = google(u, "solar").catch((e) => {
      manifests.delete(id);
      throw e;
    });
    m = { expires: now + 50 * 60 * 1000, data };
    manifests.set(id, m);
  }
  return m.data;
}
class PayloadTooLarge extends Error {}
async function boundedBytes(response: Response, max = 12_000_000) {
  if (Number(response.headers.get("content-length")) > max)
    throw new PayloadTooLarge(
      max === 2000 ? "Roof request exceeds 2 KB" : "Roof image is too large",
    );
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty imagery response");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw new PayloadTooLarge(
        max === 2000 ? "Roof request exceeds 2 KB" : "Roof image is too large",
      );
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  return bytes;
}
export async function GET(request: Request) {
  let budgeted = false;
  try {
    const u = new URL(request.url),
      op = u.searchParams.get("op");
    if (op === "capabilities") {
      const k = keys();
      return reply({
        solar: !!(k.GOOGLE_SOLAR_API_KEY || k.GOOGLE_MAPS_API_KEY),
        geocoding: !!(k.GOOGLE_GEOCODING_API_KEY || k.GOOGLE_MAPS_API_KEY),
      });
    }
    if (!["search", "layer", "metadata"].includes(op ?? ""))
      return reply({ error: "Unknown roof operation" }, 404);
    if (!takeBudget(request))
      return reply(
        {
          error:
            "Too many roof requests. Please wait a minute before retrying.",
        },
        429,
      );
    budgeted = true;
    if (op === "search") {
      const q = u.searchParams.get("q")?.trim();
      if (!q || q.length < 5 || q.length > 200)
        throw new Error("Enter a complete address (5–200 characters)");
      const target = new URL(
        "https://maps.googleapis.com/maps/api/geocode/json",
      );
      target.searchParams.set("address", q);
      const j = await google(target, "geocode");
      if (j.status !== "OK" && j.status !== "ZERO_RESULTS")
        throw new Error(
          "Address search is unavailable. Enter exact coordinates instead.",
        );
      return reply({
        results: (j.results ?? []).slice(0, 5).map(
          (r: {
            formatted_address: string;
            geometry: {
              location: { lat: number; lng: number };
              location_type: string;
            };
            partial_match?: boolean;
          }) => ({
            label: r.formatted_address,
            latitude: r.geometry.location.lat,
            longitude: r.geometry.location.lng,
            precision: r.geometry.location_type,
            partial: !!r.partial_match,
          }),
        ),
      });
    }
    if (op === "layer" || op === "metadata") {
      const p = location(Object.fromEntries(u.searchParams)),
        radius = number(u.searchParams.get("radius"), 30, 120),
        layer = u.searchParams.get("layer");
      if (op === "layer" && !["dsm", "mask", "rgb"].includes(layer ?? ""))
        throw new Error("Unknown roof layer");
      const m = await manifest(p, radius);
      if (op === "metadata")
        return reply({
          imageryDate: m.imageryDate,
          imageryQuality: m.imageryQuality,
        });
      const source = m[`${layer}Url` as "dsmUrl" | "maskUrl" | "rgbUrl"];
      if (!source) throw new Error("Requested imagery is unavailable");
      const target = new URL(source);
      if (
        target.protocol !== "https:" ||
        target.hostname !== "solar.googleapis.com" ||
        !/^\/v1\/(solar\/)?geoTiff:get$/.test(target.pathname)
      )
        throw new Error("Unexpected imagery source");
      target.searchParams.set("key", key("solar"));
      const r = await fetch(target, {
        signal: AbortSignal.timeout(20000),
        redirect: "manual",
      }).catch(() => {
        throw new Error(
          "Imagery download could not complete. Try again later.",
        );
      });
      if (!r.ok) throw new Error(`Imagery download unavailable (${r.status})`);
      return new Response(await boundedBytes(r), {
        headers: {
          "Content-Type": "image/tiff",
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    return reply({ error: "Unknown roof operation" }, 404);
  } catch (e) {
    return reply(
      { error: e instanceof Error ? e.message : "Roof service unavailable" },
      e instanceof PayloadTooLarge ? 413 : 400,
    );
  } finally {
    if (budgeted) activeRequests--;
  }
}
export async function POST(request: Request) {
  let budgeted = false;
  try {
    if (Number(request.headers.get("content-length")) > 2000)
      return reply({ error: "Request too large" }, 413);
    const raw = new TextDecoder().decode(
      await boundedBytes(new Response(request.body), 2000),
    );
    const input = JSON.parse(raw);
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new Error("Expected coordinates");
    const p = location(input);
    if (!takeBudget(request))
      return reply(
        {
          error:
            "Too many roof requests. Please wait a minute before retrying.",
        },
        429,
      );
    budgeted = true;
    const u = new URL(
      "https://solar.googleapis.com/v1/buildingInsights:findClosest",
    );
    u.searchParams.set("location.latitude", String(p.latitude));
    u.searchParams.set("location.longitude", String(p.longitude));
    u.searchParams.set("requiredQuality", "MEDIUM");
    const b = (await google(u, "solar")) as RoofBuilding;
    const potential = b.solarPotential;
    if (
      !b.center ||
      !b.boundingBox ||
      !potential?.solarPanels?.length ||
      !potential.roofSegmentStats?.length
    )
      throw new Error(
        "The provider has no usable panel or roof plane data for this building",
      );
    if (potential.solarPanels.length > 3000)
      throw new Error("This building exceeds the residential viewer limit");
    const data: RoofBuilding = {
      name: b.name,
      center: b.center,
      boundingBox: b.boundingBox,
      postalCode: b.postalCode,
      administrativeArea: b.administrativeArea,
      imageryDate: b.imageryDate,
      imageryQuality: b.imageryQuality,
      solarPotential: {
        panelWidthMeters: potential.panelWidthMeters,
        panelHeightMeters: potential.panelHeightMeters,
        panelCapacityWatts: potential.panelCapacityWatts,
        roofSegmentStats: potential.roofSegmentStats,
        solarPanels: potential.solarPanels,
        solarPanelConfigs: potential.solarPanelConfigs ?? [],
      },
      fetchedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
      distanceMeters: Math.round(Math.hypot(...localMetres(b.center, p))),
    };
    return reply({ data });
  } catch (e) {
    return reply(
      { error: e instanceof Error ? e.message : "Roof lookup unavailable" },
      e instanceof PayloadTooLarge ? 413 : 400,
    );
  } finally {
    if (budgeted) activeRequests--;
  }
}
