import { serve, json, readJson } from "../shared/http.mjs";
import { localEstimate, fitGroundArray } from "./model.mjs";
import { calculatorHandlers } from "./calculators.mjs";

const dataLayerManifestCache = new Map();
const DATA_LAYER_RADIUS_METERS = 30;
const DATA_LAYER_PIXEL_SIZE_METERS = 0.1;

function roofVisionUrl() {
  return String(process.env.ROOF_VISION_URL || "").replace(/\/$/, "");
}

async function roofVisionCapabilities() {
  if (!roofVisionUrl()) return { available: false, reason: "not_configured" };
  try {
    const response = await fetch(`${roofVisionUrl()}/v1/roof-vision/capabilities`, { signal: AbortSignal.timeout(2500) });
    if (!response.ok) return { available: false, reason: `http_${response.status}` };
    const payload = await response.json();
    return { available: true, ...payload.data };
  } catch (error) {
    return { available: false, reason: error?.message || "unavailable" };
  }
}

async function proxyRoofVision(request, response, requestId, pathname) {
  if (!roofVisionUrl()) return json(response, 503, { error: "roof_vision_not_configured" }, requestId) || true;
  const upstream = await fetch(`${roofVisionUrl()}${pathname}`, {
    method: request.method,
    headers: request.headers["content-type"] ? { "content-type": request.headers["content-type"] } : undefined,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request,
    duplex: request.method === "GET" || request.method === "HEAD" ? undefined : "half",
    signal: AbortSignal.timeout(120000),
  });
  const body = Buffer.from(await upstream.arrayBuffer());
  response.writeHead(upstream.status, {
    "content-type": upstream.headers.get("content-type") || "application/json",
    "access-control-allow-origin": process.env.CORS_ORIGIN || "http://localhost:3000",
    "cache-control": "no-store",
    "x-request-id": requestId,
  });
  response.end(body);
  return true;
}

function googleSolarKey() {
  return process.env.GOOGLE_SOLAR_API_KEY || "";
}

async function getDataLayerManifest(latitude, longitude) {
  const key = googleSolarKey();
  if (!key) throw new Error("google_solar_key_not_configured");
  const cacheKey = `${latitude.toFixed(5)},${longitude.toFixed(5)},${DATA_LAYER_RADIUS_METERS},${DATA_LAYER_PIXEL_SIZE_METERS}`;
  const cached = dataLayerManifestCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.payload;
  const params = new URLSearchParams({
    "location.latitude": latitude.toFixed(6),
    "location.longitude": longitude.toFixed(6),
    radiusMeters: String(DATA_LAYER_RADIUS_METERS),
    view: "FULL_LAYERS",
    requiredQuality: "HIGH",
    pixelSizeMeters: String(DATA_LAYER_PIXEL_SIZE_METERS),
    key,
  });
  const upstream = await fetch(`https://solar.googleapis.com/v1/dataLayers:get?${params}`, {
    signal: AbortSignal.timeout(15000),
  });
  const payload = await upstream.json();
  if (!upstream.ok) throw new Error(payload?.error?.message || `google_data_layers_${upstream.status}`);
  dataLayerManifestCache.set(cacheKey, { payload, expiresAt: Date.now() + 50 * 60 * 1000 });
  return payload;
}

async function fetchGoogleDataLayer(layerUrl) {
  if (!layerUrl) throw new Error("solar_data_layer_not_available");
  const separator = layerUrl.includes("?") ? "&" : "?";
  const response = await fetch(`${layerUrl}${separator}key=${encodeURIComponent(googleSolarKey())}`, {
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`solar_geotiff_${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function detectMaskedRoofPlanes(latitude, longitude) {
  if (!roofVisionUrl()) throw new Error("roof_vision_not_configured");
  const manifest = await getDataLayerManifest(latitude, longitude);
  const [dsm, buildingMask] = await Promise.all([
    fetchGoogleDataLayer(manifest.dsmUrl),
    fetchGoogleDataLayer(manifest.maskUrl),
  ]);
  const form = new FormData();
  form.append("dsm", new Blob([dsm], { type: "image/tiff" }), "google-solar-dsm.tif");
  form.append("building_mask", new Blob([buildingMask], { type: "image/tiff" }), "google-solar-building-mask.tif");
  form.append("center_latitude", String(latitude));
  form.append("center_longitude", String(longitude));
  form.append("pixel_size_m", String(DATA_LAYER_PIXEL_SIZE_METERS));
  form.append("tolerance_m", "0.14");
  form.append("max_planes", "8");
  form.append("min_pixels", "180");
  form.append("source_consent", "true");
  form.append("source_license", "Google Solar API Data Layers; selected building mask and DSM processed for the current analysis");
  const upstream = await fetch(`${roofVisionUrl()}/v1/roof-vision/solar-planes`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(120000),
  });
  const payload = await upstream.json();
  if (!upstream.ok) throw new Error(payload?.detail || `roof_plane_detection_${upstream.status}`);
  return {
    ...payload,
    data: {
      ...payload.data,
      imageryDate: manifest.imageryDate,
      imageryProcessedDate: manifest.imageryProcessedDate,
      imageryQuality: manifest.imageryQuality,
      pixelSizeMeters: DATA_LAYER_PIXEL_SIZE_METERS,
    },
  };
}

async function pvgisEstimate(input) {
  const compassAzimuth = ((Number(input.azimuth ?? 180) % 360) + 360) % 360;
  const pvgisAspect = compassAzimuth - 180;
  const params = new URLSearchParams({
    lat: String(input.latitude),
    lon: String(input.longitude),
    peakpower: String(input.capacityKw),
    loss: String(input.lossesPercent ?? 14),
    angle: String(input.tilt ?? 30),
    aspect: String(pvgisAspect),
    outputformat: "json",
  });
  const response = await fetch(`https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?${params}`, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`PVGIS returned ${response.status}`);
  const payload = await response.json();
  const monthly = payload.outputs?.monthly?.fixed || [];
  if (monthly.length !== 12) throw new Error("PVGIS returned an incomplete monthly estimate");
  const base = localEstimate(input);
  const monthlyKwh = monthly.map(month => Math.round(Number(month.E_m || 0)));
  const annualKwh = Math.round(payload.outputs?.totals?.fixed?.E_y ?? monthlyKwh.reduce((sum, value) => sum + value, 0));
  return {
    ...base,
    provider: "eu-jrc-pvgis-5.3",
    providerVersion: "5.3",
    annualKwh,
    monthlyKwh,
    yearlyBillValue: Math.round(annualKwh * Number(input.electricityRate ?? 0.19)),
    billOffsetPercent: Math.min(100, Math.round(annualKwh / Math.max(1, Number(input.annualUsageKwh ?? 10000)) * 100)),
    sourceMeta: payload.inputs,
  };
}

async function pvWatts(input) {
  if (Array.isArray(input.arrays) && input.arrays.length) {
    const estimates = await Promise.all(input.arrays.map(array => pvWatts({ ...input, arrays: undefined, ...array, capacityKw: array.capacityKw })));
    const monthlyKwh = Array.from({ length: 12 }, (_, month) => estimates.reduce((sum, estimate) => sum + Number(estimate.monthlyKwh?.[month] || 0), 0));
    const annualKwh = monthlyKwh.reduce((sum, value) => sum + value, 0);
    return {
      ...localEstimate({ ...input, capacityKw: input.arrays.reduce((sum, array) => sum + Number(array.capacityKw || 0), 0) }),
      provider: estimates.every(estimate => estimate.provider === "eu-jrc-pvgis-5.3") ? "eu-jrc-pvgis-5.3-multi-array" : "solar4u-mixed-provider",
      annualKwh, monthlyKwh, yearlyBillValue: Math.round(annualKwh * Number(input.electricityRate ?? 0.19)),
      arrayEstimates: estimates,
      warnings: estimates.flatMap(estimate => estimate.warnings || []),
    };
  }
  if (input.provider === "pvgis") {
    try {
      return await pvgisEstimate(input);
    } catch (error) {
      return { ...localEstimate(input), warnings: [`Live PVGIS estimate unavailable: ${error.message}`] };
    }
  }
  if (!process.env.NREL_API_KEY) return localEstimate(input);
  const params = new URLSearchParams({
    api_key: process.env.NREL_API_KEY,
    system_capacity: String(input.capacityKw),
    module_type: String(input.moduleType ?? 0),
    losses: String(input.lossesPercent ?? 14),
    array_type: String(input.arrayType ?? 1),
    tilt: String(input.tilt ?? 30),
    azimuth: String(input.azimuth ?? 180),
    lat: String(input.latitude),
    lon: String(input.longitude),
  });
  const response = await fetch(`https://developer.nlr.gov/api/pvwatts/v8.json?${params}`);
  if (!response.ok) throw new Error(`PVWatts returned ${response.status}`);
  const payload = await response.json();
  return { ...localEstimate(input), provider: "nrel-pvwatts-v8", providerVersion: payload.version, annualKwh: Math.round(payload.outputs.ac_annual), monthlyKwh: payload.outputs.ac_monthly.map(Math.round), stationInfo: payload.station_info, warnings: payload.warnings };
}

serve({
  name: "solar-engine",
  port: Number(process.env.PORT || 4001),
  router: async (request, response, requestId) => {
    const url = new URL(request.url, "http://local");
    if (request.method === "OPTIONS" && url.pathname.startsWith("/v1/solar/roof-vision/")) {
      response.writeHead(204, {
        "access-control-allow-origin": process.env.CORS_ORIGIN || "http://localhost:3000",
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers": "content-type",
      });
      response.end();
      return true;
    }
    if ((request.method === "GET" || request.method === "POST") && url.pathname.startsWith("/v1/solar/roof-vision/")) {
      const downstreamPath = url.pathname.replace("/v1/solar/roof-vision/", "/v1/roof-vision/");
      return proxyRoofVision(request, response, requestId, downstreamPath);
    }
    if (request.method === "GET" && url.pathname === "/v1/solar/capabilities") {
      const roofVision = await roofVisionCapabilities();
      return json(response, 200, {
        data: {
          googleGeocoding: Boolean(process.env.GOOGLE_GEOCODING_API_KEY || process.env.GOOGLE_SOLAR_API_KEY),
          googleSolar: Boolean(process.env.GOOGLE_SOLAR_API_KEY),
          googleStaticMaps: Boolean(process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_GEOCODING_API_KEY || process.env.GOOGLE_SOLAR_API_KEY),
          googlePhotorealistic3d: Boolean(process.env.GOOGLE_MAP_TILES_API_KEY),
          analyticalLayers: ["building_insights", "rgb", "dsm", "annual_flux", "monthly_flux", "hourly_shade"],
          fallbackGeocoder: "openstreetmap-nominatim",
          dataLayerFrame: {
            radiusMeters: DATA_LAYER_RADIUS_METERS,
            diameterMeters: DATA_LAYER_RADIUS_METERS * 2,
            requestedPixelSizeMeters: DATA_LAYER_PIXEL_SIZE_METERS,
          },
          roofVision,
        },
      }, requestId) || true;
    }
    if (request.method === "GET" && url.pathname === "/v1/solar/photorealistic-3d-config") {
      const key = process.env.GOOGLE_MAP_TILES_API_KEY || "";
      if (!key) return json(response, 503, { error: "google_map_tiles_key_not_configured" }, requestId) || true;
      return json(response, 200, {
        data: {
          tilesetUrl: `https://tile.googleapis.com/v1/3dtiles/root.json?key=${encodeURIComponent(key)}`,
          renderer: "cesiumjs",
          attributionRequired: true,
        },
      }, requestId) || true;
    }
    if (request.method === "GET" && url.pathname === "/v1/solar/map-image") {
      const latitude = Number(url.searchParams.get("lat"));
      const longitude = Number(url.searchParams.get("lon"));
      const mapsKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_GEOCODING_API_KEY || process.env.GOOGLE_SOLAR_API_KEY;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return json(response, 400, { error: "valid_latitude_and_longitude_required" }, requestId) || true;
      }
      if (!mapsKey) return json(response, 503, { error: "google_maps_key_not_configured" }, requestId) || true;
      const mapParams = new URLSearchParams({
        center: `${latitude},${longitude}`,
        zoom: "20",
        size: "640x640",
        scale: "2",
        maptype: "satellite",
        key: mapsKey,
      });
      const mapResponse = await fetch(`https://maps.googleapis.com/maps/api/staticmap?${mapParams}`, {
        signal: AbortSignal.timeout(12000),
      });
      if (!mapResponse.ok) return json(response, mapResponse.status, { error: "google_static_map_unavailable" }, requestId) || true;
      const image = Buffer.from(await mapResponse.arrayBuffer());
      response.writeHead(200, {
        "content-type": mapResponse.headers.get("content-type") || "image/png",
        "cache-control": "private, max-age=3600",
        "access-control-allow-origin": process.env.CORS_ORIGIN || "http://localhost:3000",
        "x-request-id": requestId,
      });
      response.end(image);
      return true;
    }
    if (request.method === "GET" && url.pathname === "/v1/solar/roof-planes") {
      const latitude = Number(url.searchParams.get("lat"));
      const longitude = Number(url.searchParams.get("lon"));
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return json(response, 400, { error: "valid_latitude_and_longitude_required" }, requestId) || true;
      }
      if (!googleSolarKey()) return json(response, 503, { error: "google_solar_key_not_configured" }, requestId) || true;
      if (!roofVisionUrl()) return json(response, 503, { error: "roof_vision_not_configured" }, requestId) || true;
      const result = await detectMaskedRoofPlanes(latitude, longitude);
      return json(response, 200, result, requestId) || true;
    }
    if (request.method === "GET" && url.pathname === "/v1/solar/data-layer") {
      const latitude = Number(url.searchParams.get("lat"));
      const longitude = Number(url.searchParams.get("lon"));
      const layer = String(url.searchParams.get("layer") || "");
      const month = Math.max(0, Math.min(11, Number(url.searchParams.get("month") || 0)));
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return json(response, 400, { error: "valid_latitude_and_longitude_required" }, requestId) || true;
      }
      if (!googleSolarKey()) return json(response, 503, { error: "google_solar_key_not_configured" }, requestId) || true;
      const manifest = await getDataLayerManifest(latitude, longitude);
      const layerUrl = layer === "rgb" ? manifest.rgbUrl
        : layer === "mask" ? manifest.maskUrl
        : layer === "dsm" ? manifest.dsmUrl
        : layer === "annualFlux" ? manifest.annualFluxUrl
        : layer === "monthlyFlux" ? manifest.monthlyFluxUrl
        : layer === "hourlyShade" ? manifest.hourlyShadeUrls?.[month]
        : "";
      if (!layerUrl) return json(response, 404, { error: "solar_data_layer_not_available" }, requestId) || true;
      let body;
      try {
        body = await fetchGoogleDataLayer(layerUrl);
      } catch {
        return json(response, 502, { error: "solar_geotiff_unavailable" }, requestId) || true;
      }
      response.writeHead(200, {
        "content-type": "image/tiff",
        "cache-control": "private, max-age=3000",
        "access-control-allow-origin": process.env.CORS_ORIGIN || "http://localhost:3000",
        "x-solar4u-layer": layer,
        "x-request-id": requestId,
      });
      response.end(body);
      return true;
    }
    if (request.method === "GET" && url.pathname === "/v1/solar/data-layers") {
      const latitude = Number(url.searchParams.get("lat"));
      const longitude = Number(url.searchParams.get("lon"));
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return json(response, 400, { error: "valid_latitude_and_longitude_required" }, requestId) || true;
      }
      if (!googleSolarKey()) return json(response, 503, { error: "google_solar_key_not_configured" }, requestId) || true;
      const manifest = await getDataLayerManifest(latitude, longitude);
      return json(response, 200, {
        data: {
          imageryDate: manifest.imageryDate,
          imageryProcessedDate: manifest.imageryProcessedDate,
          imageryQuality: manifest.imageryQuality,
          layers: {
            rgb: Boolean(manifest.rgbUrl),
            dsm: Boolean(manifest.dsmUrl),
            mask: Boolean(manifest.maskUrl),
            annualFlux: Boolean(manifest.annualFluxUrl),
            monthlyFlux: Boolean(manifest.monthlyFluxUrl),
            hourlyShadeMonths: manifest.hourlyShadeUrls?.length || 0,
          },
        },
      }, requestId) || true;
    }
    if (request.method === "GET" && url.pathname === "/v1/solar/geocode") {
      const query = String(url.searchParams.get("q") || "").trim();
      if (query.length < 4) return json(response, 400, { error: "address_query_too_short" }, requestId) || true;
      const googleKey = process.env.GOOGLE_GEOCODING_API_KEY || process.env.GOOGLE_SOLAR_API_KEY;
      if (googleKey) {
        try {
          const params = new URLSearchParams({ address: query, key: googleKey });
          const upstream = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`, { signal: AbortSignal.timeout(9000) });
          const payload = await upstream.json();
          if (upstream.ok && payload.status === "OK") {
            const results = (payload.results || []).slice(0, 6).map(item => {
              const locationType = item.geometry?.location_type || "APPROXIMATE";
              const exactStreetAddress = item.types?.includes("street_address") && locationType === "ROOFTOP" && !item.partial_match;
              return {
                id: item.place_id,
                label: item.formatted_address,
                latitude: item.geometry.location.lat,
                longitude: item.geometry.location.lng,
                provider: "google-geocoding",
                precision: locationType.toLowerCase(),
                confidence: exactStreetAddress ? "exact" : locationType === "RANGE_INTERPOLATED" ? "interpolated" : "approximate",
                partialMatch: Boolean(item.partial_match),
                resultTypes: item.types || [],
                viewport: item.geometry.viewport || null,
              };
            });
            return json(response, 200, { data: results, attribution: "Geocoding by Google" }, requestId) || true;
          }
        } catch {}
      }
      const params = new URLSearchParams({ q: query, format: "jsonv2", addressdetails: "1", limit: "6" });
      const upstream = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Solar4U/0.1 local planning tool (address search initiated by user)",
        },
        signal: AbortSignal.timeout(9000),
      });
      const payload = await upstream.json();
      const results = (payload || []).map(item => {
        const hasHouseNumber = Boolean(item.address?.house_number && item.address?.road);
        return {
          id: String(item.place_id),
          label: item.display_name,
          latitude: Number(item.lat),
          longitude: Number(item.lon),
          provider: "openstreetmap-nominatim",
          precision: item.addresstype || item.type || "unknown",
          confidence: hasHouseNumber ? "street_address" : "approximate",
          resultTypes: [item.class, item.type, item.addresstype].filter(Boolean),
          boundingBox: Array.isArray(item.boundingbox) ? item.boundingbox.map(Number) : null,
        };
      }).sort((a, b) => {
        const score = value => value.confidence === "street_address" ? 0 : 1;
        return score(a) - score(b);
      });
      return json(response, upstream.ok ? 200 : upstream.status, { data: results, attribution: "© OpenStreetMap contributors; geocoding by Nominatim" }, requestId) || true;
    }
    if (request.method === "GET" && url.pathname === "/v1/locations/search") {
      const query = String(url.searchParams.get("q") || "").trim();
      if (query.length < 2) return json(response, 400, { error: "location_query_too_short" }, requestId) || true;
      const params = new URLSearchParams({ name: query, count: "8", language: "en", format: "json" });
      const upstream = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, { signal: AbortSignal.timeout(8000) });
      const payload = await upstream.json();
      const locations = (payload.results || []).map(item => ({
        id: item.id, name: item.name, latitude: item.latitude, longitude: item.longitude,
        country: item.country || "", countryCode: item.country_code || "",
        state: item.admin1 || "", province: item.admin2 || "", timezone: item.timezone || "",
        label: [item.name, item.admin1, item.country].filter(Boolean).join(", "),
      }));
      return json(response, upstream.ok ? 200 : upstream.status, { data: locations, attribution: "Location search by Open-Meteo; data based on GeoNames." }, requestId) || true;
    }
    if (request.method === "POST" && url.pathname === "/v1/solar/estimates") return json(response, 200, { data: await pvWatts(await readJson(request)) }, requestId) || true;
    if (request.method === "POST" && url.pathname === "/v1/solar/ground-layout") return json(response, 200, { data: fitGroundArray(await readJson(request)) }, requestId) || true;
    if (request.method === "POST" && url.pathname === "/v1/solar/roof-analysis") {
      const body = await readJson(request);
      if (!process.env.GOOGLE_SOLAR_API_KEY) return json(response, 200, { data: { provider: "manual-fallback", available: false, reason: "google_solar_key_not_configured", location: body.location || null } }, requestId) || true;
      const params = new URLSearchParams({ "location.latitude": String(body.latitude), "location.longitude": String(body.longitude), requiredQuality: body.requiredQuality || "HIGH", key: process.env.GOOGLE_SOLAR_API_KEY });
      const upstream = await fetch(`https://solar.googleapis.com/v1/buildingInsights:findClosest?${params}`);
      const payload = await upstream.json();
      return json(response, upstream.ok ? 200 : upstream.status, { data: payload }, requestId) || true;
    }
    if (request.method === "POST" && url.pathname.startsWith("/v1/calculators/")) {
      const type = url.pathname.split("/").pop();
      const body = await readJson(request);
      return json(response, calculatorHandlers[type] ? 200 : 404, calculatorHandlers[type] ? { data: calculatorHandlers[type](body) } : { error: "calculator_not_found" }, requestId) || true;
    }
    return false;
  },
});
