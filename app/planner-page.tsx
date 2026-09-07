"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { fromArrayBuffer } from "geotiff";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  CloudSun,
  ExternalLink,
  Home,
  Info,
  MapPin,
  PackageCheck,
  Pause,
  Play,
  Search,
  Sun,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

type PlannerStage = "site" | "sun" | "sections" | "savings" | "next";
type LocationResult = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  provider: string;
  precision?: string;
  confidence?: "exact" | "interpolated" | "street_address" | "approximate";
  partialMatch?: boolean;
  resultTypes?: string[];
  boundingBox?: number[] | null;
};
type RoofSegment = {
  id: string;
  name: string;
  direction: string;
  azimuth: number;
  tilt: number;
  maxPanels: number;
  flux: number;
  annualPerPanel: number;
  quality: "Excellent" | "Good" | "Fair";
  box: { left: number; top: number; width: number; height: number; rotate: number };
  polygon?: Array<{ x: number; y: number }>;
  geoPolygon?: Array<{ latitude: number; longitude: number }>;
  samplePoints?: Array<{ latitude: number; longitude: number }>;
  source?: "google" | "dsm" | "manual" | "vision" | "demo";
};
type Estimate = {
  provider: string;
  annualKwh: number;
  monthlyKwh: number[];
  installedCost: number;
  netCost: number;
  yearlyBillValue: number;
  billOffsetPercent: number;
  cashFlow: Array<{ year: number; cumulativeSavings: number }>;
};
type SolarCapabilities = {
  googleGeocoding: boolean;
  googleSolar: boolean;
  googleStaticMaps: boolean;
  googlePhotorealistic3d: boolean;
  roofVision?: {
    available: boolean;
    backends?: { promptedLocal?: boolean; dsmPlaneFitting?: boolean; samgeo?: boolean };
    requiresSourcePermission?: boolean;
    notes?: string[];
  };
};
type RoofVisionCandidate = {
  normalizedPolygon: number[][];
  geoPolygon?: { type: "Polygon"; coordinates: number[][][] };
  confidence: number;
};
type DsmRoofPlane = {
  normalizedPolygon: number[][];
  geoPolygon?: { type: "Polygon"; coordinates: number[][][] };
  pitchDegrees: number;
  azimuthDegrees: number;
  confidence: number;
  areaMeters2: number;
  rmseMeters: number;
};

type CesiumViewer = {
  camera: {
    flyTo: (options: Record<string, unknown>) => void;
    zoomIn: (amount: number) => void;
    zoomOut: (amount: number) => void;
    moveRight: (amount: number) => void;
    moveUp: (amount: number) => void;
    positionCartographic?: { height: number };
  };
  clock: { currentTime: unknown; shouldAnimate: boolean };
  entities: {
    add: (options: Record<string, unknown>) => unknown;
    remove: (entity: unknown) => boolean;
  };
  scene: {
    canvas: HTMLCanvasElement;
    globe: { show: boolean };
    primitives: { add: <T>(primitive: T) => T };
    requestRender: () => void;
    sampleHeightMostDetailed: (positions: Array<{ height: number }>) => Promise<Array<{ height: number }>>;
    screenSpaceCameraController: {
      enableInputs: boolean;
      enableRotate: boolean;
      enableTranslate: boolean;
      enableZoom: boolean;
      enableTilt: boolean;
      enableLook: boolean;
      inertiaSpin: number;
      inertiaTranslate: number;
      inertiaZoom: number;
      minimumZoomDistance: number;
      maximumZoomDistance: number;
      maximumMovementRatio: number;
      rotateEventTypes: unknown;
      zoomEventTypes: unknown;
      tiltEventTypes: unknown;
    };
  };
  destroy: () => void;
  isDestroyed: () => boolean;
};

type CesiumInputHandler = {
  setInputAction: (action: (movement: Record<string, unknown>) => void, eventType: unknown) => void;
  destroy: () => void;
  isDestroyed: () => boolean;
};

type CesiumRuntime = {
  Viewer: new (container: HTMLElement, options: Record<string, unknown>) => CesiumViewer;
  Cesium3DTileset: new (options: Record<string, unknown>) => Record<string, unknown>;
  ScreenSpaceEventHandler: new (canvas: HTMLCanvasElement) => CesiumInputHandler;
  ScreenSpaceEventType: {
    RIGHT_DOWN: unknown;
    RIGHT_UP: unknown;
    MOUSE_MOVE: unknown;
  };
  CameraEventType: {
    LEFT_DRAG: unknown;
    MIDDLE_DRAG: unknown;
    RIGHT_DRAG: unknown;
    WHEEL: unknown;
    PINCH: unknown;
  };
  KeyboardEventModifier: { CTRL: unknown };
  Cartesian3: {
    fromDegrees: (longitude: number, latitude: number, height: number) => unknown;
    fromDegreesArray: (coordinates: number[]) => unknown;
  };
  Cartographic: { fromDegrees: (longitude: number, latitude: number) => { height: number } };
  Color: { fromCssColorString: (color: string) => { withAlpha: (alpha: number) => unknown } };
  ClassificationType: { CESIUM_3D_TILE: unknown };
  Math: { toRadians: (degrees: number) => number };
  JulianDate: { fromDate: (date: Date) => unknown };
  ShadowMode: { ENABLED: unknown };
};

const CESIUM_VERSION = "1.105";
const CESIUM_BASE_URL = `https://ajax.googleapis.com/ajax/libs/cesiumjs/${CESIUM_VERSION}/Build/Cesium/`;
let cesiumRuntimePromise: Promise<CesiumRuntime> | null = null;

function loadCesiumRuntime() {
  const cesiumWindow = window as typeof window & { Cesium?: CesiumRuntime; CESIUM_BASE_URL?: string };
  if (cesiumWindow.Cesium) return Promise.resolve(cesiumWindow.Cesium);
  if (cesiumRuntimePromise) return cesiumRuntimePromise;
  cesiumRuntimePromise = new Promise<CesiumRuntime>((resolve, reject) => {
    cesiumWindow.CESIUM_BASE_URL = CESIUM_BASE_URL;
    if (!document.getElementById("solar4u-cesium-css")) {
      const stylesheet = document.createElement("link");
      stylesheet.id = "solar4u-cesium-css";
      stylesheet.rel = "stylesheet";
      stylesheet.href = `${CESIUM_BASE_URL}Widgets/widgets.css`;
      document.head.appendChild(stylesheet);
    }
    const existing = document.getElementById("solar4u-cesium-script") as HTMLScriptElement | null;
    const finish = () => cesiumWindow.Cesium ? resolve(cesiumWindow.Cesium) : reject(new Error("Cesium did not initialize."));
    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", () => reject(new Error("Cesium could not be loaded.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = "solar4u-cesium-script";
    script.src = `${CESIUM_BASE_URL}Cesium.js`;
    script.async = true;
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", () => reject(new Error("Cesium could not be loaded.")), { once: true });
    document.head.appendChild(script);
  });
  return cesiumRuntimePromise;
}

const engine = "http://localhost:4001";
// The live Solar data-layer request uses a 30 m radius. Keeping this frame
// explicit prevents the UI from treating a tightly cropped 60 m image as the
// old 100 m neighborhood view when converting roof coordinates to percentages.
const DATA_LAYER_DIAMETER_METERS = 60;
const DATA_LAYER_PERCENT_PER_METER = 100 / DATA_LAYER_DIAMETER_METERS;
const DATA_LAYER_CACHE_VERSION = "high-60m-01";
const stageOrder: PlannerStage[] = ["site", "sun", "sections", "savings", "next"];
const stageLabels: Record<PlannerStage, string> = {
  site: "Site",
  sun: "Sun",
  sections: "Sections",
  savings: "Savings",
  next: "Next Steps",
};
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const demoSegments: RoofSegment[] = [
  { id: "R1", name: "Main south roof", direction: "South", azimuth: 182, tilt: 29, maxPanels: 14, flux: 94, annualPerPanel: 512, quality: "Excellent", box: { left: 31, top: 48, width: 25, height: 20, rotate: 0 } },
  { id: "R2", name: "Upper west roof", direction: "West", azimuth: 266, tilt: 31, maxPanels: 9, flux: 82, annualPerPanel: 448, quality: "Good", box: { left: 31, top: 24, width: 18, height: 20, rotate: -2 } },
  { id: "R3", name: "Upper east roof", direction: "East", azimuth: 94, tilt: 30, maxPanels: 8, flux: 78, annualPerPanel: 426, quality: "Good", box: { left: 51, top: 25, width: 17, height: 19, rotate: 2 } },
  { id: "R4", name: "Garage north roof", direction: "North", azimuth: 4, tilt: 24, maxPanels: 7, flux: 58, annualPerPanel: 318, quality: "Fair", box: { left: 54, top: 49, width: 17, height: 17, rotate: 1 } },
];

function convexHull(points: Array<{ x: number; y: number }>) {
  const unique = [...new Map(points.map(point => [`${point.x.toFixed(5)},${point.y.toFixed(5)}`, point])).values()]
    .sort((a, b) => a.x - b.x || a.y - b.y);
  if (unique.length <= 2) return unique;
  const cross = (origin: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) =>
    (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
  const lower: Array<{ x: number; y: number }> = [];
  for (const point of unique) {
    while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper: Array<{ x: number; y: number }> = [];
  for (const point of [...unique].reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, point) <= 0) upper.pop();
    upper.push(point);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

function mapPointForDataLayer(point: { latitude: number; longitude: number }, center: { latitude: number; longitude: number }) {
  const latitudeMeters = 111320;
  const longitudeMeters = latitudeMeters * Math.cos(center.latitude * Math.PI / 180);
  return {
    x: 50 + (point.longitude - center.longitude) * longitudeMeters * DATA_LAYER_PERCENT_PER_METER,
    y: 50 - (point.latitude - center.latitude) * latitudeMeters * DATA_LAYER_PERCENT_PER_METER,
  };
}

function geoPointForDataLayer(point: { x: number; y: number }, center: { latitude: number; longitude: number }) {
  const latitudeMeters = 111320;
  const longitudeMeters = latitudeMeters * Math.cos(center.latitude * Math.PI / 180);
  return {
    latitude: center.latitude + ((50 - point.y) / DATA_LAYER_PERCENT_PER_METER) / latitudeMeters,
    longitude: center.longitude + ((point.x - 50) / DATA_LAYER_PERCENT_PER_METER) / longitudeMeters,
  };
}

function polygonGeometry(points: Array<{ x: number; y: number }>) {
  const clamped = points.map(point => ({ x: Math.max(0, Math.min(100, point.x)), y: Math.max(0, Math.min(100, point.y)) }));
  const left = Math.min(...clamped.map(point => point.x));
  const right = Math.max(...clamped.map(point => point.x));
  const top = Math.min(...clamped.map(point => point.y));
  const bottom = Math.max(...clamped.map(point => point.y));
  const width = Math.max(2.2, right - left);
  const height = Math.max(2.2, bottom - top);
  return {
    box: { left, top, width, height, rotate: 0 },
    localPolygon: clamped.map(point => ({ x: ((point.x - left) / width) * 100, y: ((point.y - top) / height) * 100 })),
  };
}

function panelEnvelope(
  panelPoints: Array<{ latitude: number; longitude: number }>,
  center: { latitude: number; longitude: number },
) {
  const paddedCorners = panelPoints.flatMap(point => {
    const mapped = mapPointForDataLayer(point, center);
    return [
      { x: mapped.x - 1.05 * DATA_LAYER_PERCENT_PER_METER, y: mapped.y - 1.05 * DATA_LAYER_PERCENT_PER_METER },
      { x: mapped.x + 1.05 * DATA_LAYER_PERCENT_PER_METER, y: mapped.y - 1.05 * DATA_LAYER_PERCENT_PER_METER },
      { x: mapped.x + 1.05 * DATA_LAYER_PERCENT_PER_METER, y: mapped.y + 1.05 * DATA_LAYER_PERCENT_PER_METER },
      { x: mapped.x - 1.05 * DATA_LAYER_PERCENT_PER_METER, y: mapped.y + 1.05 * DATA_LAYER_PERCENT_PER_METER },
    ];
  });
  return convexHull(paddedCorners);
}

function globalPolygonForSegment(segment: RoofSegment) {
  if (segment.polygon?.length) {
    return segment.polygon.map(point => ({
      x: segment.box.left + point.x / 100 * segment.box.width,
      y: segment.box.top + point.y / 100 * segment.box.height,
    }));
  }
  return [
    { x: segment.box.left, y: segment.box.top },
    { x: segment.box.left + segment.box.width, y: segment.box.top },
    { x: segment.box.left + segment.box.width, y: segment.box.top + segment.box.height },
    { x: segment.box.left, y: segment.box.top + segment.box.height },
  ];
}

function directionFor(azimuth: number) {
  const labels = ["North", "North-east", "East", "South-east", "South", "South-west", "West", "North-west"];
  return labels[Math.round((((azimuth % 360) + 360) % 360) / 45) % 8];
}

function haversineMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const radius = 6371000;
  const toRadians = (value: number) => value * Math.PI / 180;
  const deltaLatitude = toRadians(b.latitude - a.latitude);
  const deltaLongitude = toRadians(b.longitude - a.longitude);
  const latitude1 = toRadians(a.latitude);
  const latitude2 = toRadians(b.latitude);
  const term = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(deltaLongitude / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(term), Math.sqrt(1 - term));
}

function geoBoxForDataLayer(
  boundingBox: Record<string, unknown> | undefined,
  center: { latitude: number; longitude: number },
) {
  const southwest = boundingBox?.sw as { latitude?: number; longitude?: number } | undefined;
  const northeast = boundingBox?.ne as { latitude?: number; longitude?: number } | undefined;
  if (![southwest?.latitude, southwest?.longitude, northeast?.latitude, northeast?.longitude].every(Number.isFinite)) return null;
  const latitudeMeters = 111320;
  const longitudeMeters = latitudeMeters * Math.cos(center.latitude * Math.PI / 180);
  const west = (Number(southwest?.longitude) - center.longitude) * longitudeMeters * DATA_LAYER_PERCENT_PER_METER;
  const east = (Number(northeast?.longitude) - center.longitude) * longitudeMeters * DATA_LAYER_PERCENT_PER_METER;
  const north = (Number(northeast?.latitude) - center.latitude) * latitudeMeters * DATA_LAYER_PERCENT_PER_METER;
  const south = (Number(southwest?.latitude) - center.latitude) * latitudeMeters * DATA_LAYER_PERCENT_PER_METER;
  const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
  const left = clamp(50 + west, 0, 97);
  const top = clamp(50 - north, 0, 97);
  return {
    left,
    top,
    width: clamp(east - west, 2.5, 100 - left),
    height: clamp(north - south, 2.5, 100 - top),
    rotate: 0,
  };
}

function normalizeGoogleSegments(
  payload: Record<string, unknown>,
  mapCenter: { latitude: number; longitude: number },
): RoofSegment[] {
  const potential = payload.solarPotential as Record<string, unknown> | undefined;
  const raw = (potential?.roofSegmentStats as Array<Record<string, unknown>> | undefined) || [];
  const panels = (potential?.solarPanels as Array<Record<string, unknown>> | undefined) || [];
  if (!raw.length) return [];
  return raw.slice(0, 8).map((segment, index): RoofSegment | null => {
    const stats = (segment.stats || {}) as Record<string, unknown>;
    const quantiles = (stats.sunshineQuantiles as number[] | undefined) || [];
    const flux = Math.max(42, Math.min(98, Math.round((Number(quantiles.at(-2) || quantiles.at(-1) || 1100) / 1500) * 100)));
    const area = Number(stats.areaMeters2 || stats.groundAreaMeters2 || 20);
    const azimuth = Number(segment.azimuthDegrees || index * 90);
    const panelPoints = panels
      .filter(panel => Number(panel.segmentIndex) === index)
      .map(panel => panel.center as { latitude: number; longitude: number })
      .filter(point => Number.isFinite(point?.latitude) && Number.isFinite(point?.longitude));
    const mapPolygon = panelPoints.length ? panelEnvelope(panelPoints, mapCenter) : [];
    const polygon = mapPolygon.length >= 3 ? polygonGeometry(mapPolygon) : null;
    const georeferencedBox = polygon?.box || geoBoxForDataLayer(segment.boundingBox as Record<string, unknown> | undefined, mapCenter);
    if (!georeferencedBox) return null;
    return {
      id: `R${index + 1}`,
      name: `${directionFor(azimuth)} roof plane`,
      direction: directionFor(azimuth),
      azimuth,
      tilt: Number(Number(segment.pitchDegrees || 25).toFixed(1)),
      maxPanels: Math.max(2, Math.floor(area / 2.05)),
      flux,
      annualPerPanel: Math.round(300 + flux * 2.25),
      quality: flux >= 88 ? "Excellent" : flux >= 70 ? "Good" : "Fair",
      box: georeferencedBox,
      polygon: polygon?.localPolygon,
      geoPolygon: mapPolygon.length >= 3 ? mapPolygon.map(point => geoPointForDataLayer(point, mapCenter)) : undefined,
      samplePoints: panelPoints,
      source: "google",
    };
  }).filter((segment): segment is RoofSegment => Boolean(segment));
}

function angularDifference(a: number, b: number) {
  const difference = Math.abs((((a - b) % 360) + 360) % 360);
  return Math.min(difference, 360 - difference);
}

function normalizeDsmPlanes(
  planePayload: Record<string, unknown>,
  insightsPayload: Record<string, unknown>,
  mapCenter: { latitude: number; longitude: number },
): RoofSegment[] {
  const data = (planePayload.data || {}) as Record<string, unknown>;
  const planes = ((data.planes || []) as DsmRoofPlane[])
    .filter(plane => Array.isArray(plane.normalizedPolygon) && plane.normalizedPolygon.length >= 3)
    .filter(plane => Number(plane.confidence) >= 0.28 && Number(plane.areaMeters2) >= 2)
    .sort((a, b) => Number(b.areaMeters2) - Number(a.areaMeters2));
  const references = normalizeGoogleSegments(insightsPayload, mapCenter);
  const unusedReferences = new Set(references.map((_, index) => index));
  return planes.map((plane, index): RoofSegment => {
    const azimuth = Number(plane.azimuthDegrees || 0);
    const rankedReferences = [...unusedReferences].sort((left, right) => {
      const leftScore = angularDifference(references[left].azimuth, azimuth) + Math.abs(references[left].tilt - Number(plane.pitchDegrees || 0)) * 0.35;
      const rightScore = angularDifference(references[right].azimuth, azimuth) + Math.abs(references[right].tilt - Number(plane.pitchDegrees || 0)) * 0.35;
      return leftScore - rightScore;
    });
    const referenceIndex = rankedReferences[0];
    const reference = Number.isInteger(referenceIndex) ? references[referenceIndex] : undefined;
    if (Number.isInteger(referenceIndex)) unusedReferences.delete(referenceIndex);
    const mapPolygon = plane.normalizedPolygon.map(point => ({
      x: Math.max(0, Math.min(100, Number(point[0]) * 100)),
      y: Math.max(0, Math.min(100, Number(point[1]) * 100)),
    }));
    const geometry = polygonGeometry(mapPolygon);
    const flux = reference?.flux ?? Math.round(62 + Number(plane.confidence || 0.5) * 30);
    const geoRing = plane.geoPolygon?.coordinates?.[0] || [];
    return {
      id: `R${index + 1}`,
      name: `${directionFor(azimuth)} DSM roof plane`,
      direction: directionFor(azimuth),
      azimuth,
      tilt: Number(Number(plane.pitchDegrees || reference?.tilt || 25).toFixed(1)),
      maxPanels: Math.max(1, Math.floor(Number(plane.areaMeters2 || 2.1) / 2.05)),
      flux,
      annualPerPanel: reference?.annualPerPanel ?? Math.round(300 + flux * 2.25),
      quality: flux >= 88 ? "Excellent" : flux >= 70 ? "Good" : "Fair",
      box: geometry.box,
      polygon: geometry.localPolygon,
      geoPolygon: geoRing.length >= 3 ? geoRing.map(point => ({ longitude: Number(point[0]), latitude: Number(point[1]) })) : undefined,
      samplePoints: reference?.samplePoints,
      source: "dsm",
    };
  });
}

function colorForFlux(value: number) {
  const normalized = Math.max(0, Math.min(1, value / 1800));
  const stops = [
    [126, 57, 31],
    [220, 126, 28],
    [247, 201, 54],
    [75, 142, 82],
  ];
  const position = normalized * (stops.length - 1);
  const lower = Math.floor(position);
  const upper = Math.min(stops.length - 1, Math.ceil(position));
  const mix = position - lower;
  return stops[lower].map((channel, index) => Math.round(channel + (stops[upper][index] - channel) * mix));
}

function SolarGeoTiffCanvas({
  url,
  kind,
  band = 0,
  dayBit = 0,
}: {
  url: string;
  kind: "rgb" | "flux" | "shade";
  band?: number;
  dayBit?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    (async () => {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`Solar data layer returned ${response.status}`);
      const tiff = await fromArrayBuffer(await response.arrayBuffer());
      const image = await tiff.getImage();
      const width = image.getWidth();
      const height = image.getHeight();
      const samples = kind === "rgb" ? [0, 1, 2] : [Math.max(0, Math.min(image.getSamplesPerPixel() - 1, band))];
      const rasters = await image.readRasters({ samples });
      if (cancelled || !canvasRef.current) return;
      const canvas = canvasRef.current;
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return;
      const pixels = context.createImageData(width, height);
      const bands = Array.from(rasters as unknown as ArrayLike<ArrayLike<number>>);
      for (let index = 0; index < width * height; index += 1) {
        const target = index * 4;
        if (kind === "rgb") {
          pixels.data[target] = Number(bands[0]?.[index] || 0);
          pixels.data[target + 1] = Number(bands[1]?.[index] || 0);
          pixels.data[target + 2] = Number(bands[2]?.[index] || 0);
          pixels.data[target + 3] = 255;
        } else if (kind === "flux") {
          const value = Number(bands[0]?.[index]);
          if (!Number.isFinite(value) || value <= 0) continue;
          const [red, green, blue] = colorForFlux(value);
          pixels.data[target] = red;
          pixels.data[target + 1] = green;
          pixels.data[target + 2] = blue;
          pixels.data[target + 3] = 112;
        } else {
          const shadeBits = Number(bands[0]?.[index]);
          if (!Number.isFinite(shadeBits) || shadeBits === -9999 || (shadeBits & (1 << dayBit)) !== 0) continue;
          pixels.data[target] = 3;
          pixels.data[target + 1] = 9;
          pixels.data[target + 2] = 17;
          pixels.data[target + 3] = 175;
        }
      }
      context.putImageData(pixels, 0, 0);
    })().catch(() => {
      if (canvasRef.current) canvasRef.current.dataset.unavailable = "true";
    });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [url, kind, band, dayBit]);
  return <canvas ref={canvasRef} className={`roof-geotiff-layer ${kind}`} role="img" aria-label={`${kind} solar geospatial data layer`} />;
}

function localEstimate(input: {
  capacityKw: number;
  latitude: number;
  rate: number;
  usage: number;
  costPerWatt: number;
  incentivePercent: number;
  segments: RoofSegment[];
  panelCounts: Record<string, number>;
}): Estimate {
  const annualKwh = Math.round(input.segments.reduce((sum, segment) => sum + segment.annualPerPanel * (input.panelCounts[segment.id] || 0), 0));
  const seasonal = input.latitude > 35
    ? [0.045, 0.055, 0.075, 0.09, 0.105, 0.115, 0.12, 0.105, 0.09, 0.075, 0.065, 0.06]
    : [0.07, 0.075, 0.085, 0.09, 0.095, 0.095, 0.09, 0.09, 0.085, 0.08, 0.075, 0.07];
  const totalWeight = seasonal.reduce((sum, value) => sum + value, 0);
  const monthlyKwh = seasonal.map(value => Math.round(annualKwh * value / totalWeight));
  monthlyKwh[11] += annualKwh - monthlyKwh.reduce((sum, value) => sum + value, 0);
  const installedCost = Math.round(input.capacityKw * input.costPerWatt * 1000);
  const netCost = Math.round(installedCost * (1 - input.incentivePercent / 100));
  let cumulative = -netCost;
  const cashFlow = Array.from({ length: 25 }, (_, index) => {
    cumulative += annualKwh * input.rate * Math.pow(1.025, index) * Math.pow(0.995, index);
    return { year: index + 1, cumulativeSavings: Math.round(cumulative) };
  });
  return {
    provider: "Solar4U local roof model",
    annualKwh,
    monthlyKwh,
    installedCost,
    netCost,
    yearlyBillValue: Math.round(annualKwh * input.rate),
    billOffsetPercent: Math.min(100, Math.round(annualKwh / Math.max(input.usage, 1) * 100)),
    cashFlow,
  };
}

function RoofCanvas({
  segments,
  selectedIds,
  panelCounts,
  imageUrl,
  dataLayerCenter,
  liveData,
  mode,
  hour,
  day,
  zoom,
  onZoomChange,
  onToggle,
  editing = false,
  draftPoints = [],
  onMapPoint,
}: {
  segments: RoofSegment[];
  selectedIds: string[];
  panelCounts: Record<string, number>;
  imageUrl: string;
  dataLayerCenter?: { latitude: number; longitude: number } | null;
  liveData: boolean;
  mode: "flux" | "shadow" | "panels";
  hour: number;
  day: number;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onToggle?: (id: string) => void;
  editing?: boolean;
  draftPoints?: Array<{ x: number; y: number }>;
  onMapPoint?: (point: { x: number; y: number }) => void;
}) {
  const shadowAngle = ((hour - 6) / 13) * 180;
  const shadowLength = 22 + Math.abs(12.5 - hour) * 4 + Math.abs(182 - day) * 0.045;
  const style = {
    "--shadow-angle": `${shadowAngle}deg`,
    "--shadow-length": `${shadowLength}%`,
  } as CSSProperties;
  const dataLayerBase = dataLayerCenter
    ? `${engine}/v1/solar/data-layer?lat=${encodeURIComponent(dataLayerCenter.latitude)}&lon=${encodeURIComponent(dataLayerCenter.longitude)}&frame=${DATA_LAYER_CACHE_VERSION}`
    : "";
  const shadeDate = new Date(Date.UTC(2026, 0, Math.max(1, Math.min(365, day))));
  const shadeMonth = shadeDate.getUTCMonth();
  const shadeDayBit = shadeDate.getUTCDate() - 1;
  const buildingHull = convexHull(segments.filter(segment => segment.source === "google" || segment.source === "dsm").flatMap(globalPolygonForSegment));
  const buildingClip = buildingHull.length >= 3
    ? `polygon(${buildingHull.map(point => `${point.x}% ${point.y}%`).join(",")})`
    : undefined;
  return (
    <div className={`roof-map mode-${mode} ${liveData ? "live-geospatial" : "illustrative-demo"}`} style={style}>
      <div
        className="roof-map-zoom-layer"
        style={{ transform: `scale(${zoom})`, "--roof-map-inverse": String(1 / zoom) } as CSSProperties}
      >
        {liveData && dataLayerBase ? (
          <>
            <SolarGeoTiffCanvas url={`${dataLayerBase}&layer=rgb`} kind="rgb" />
            {mode === "flux" && (
              <div className="roof-selected-building-mask" style={{ clipPath: buildingClip }}>
                <SolarGeoTiffCanvas url={`${dataLayerBase}&layer=annualFlux`} kind="flux" />
              </div>
            )}
            {mode === "shadow" && <SolarGeoTiffCanvas url={`${dataLayerBase}&layer=hourlyShade&month=${shadeMonth}`} kind="shade" band={Math.round(hour) % 24} dayBit={shadeDayBit} />}
          </>
        ) : (
          <img src={imageUrl} alt="Aerial view of a fictional demonstration property" />
        )}
        {mode === "shadow" && !liveData && <div className="roof-shadow-layer" aria-hidden="true" />}
        <div className="roof-map-overlay">
          {segments.map(segment => {
            const count = panelCounts[segment.id] || 0;
            const active = selectedIds.includes(segment.id);
            return (
              <button
                type="button"
                key={segment.id}
                className={`roof-zone flux-${segment.quality.toLowerCase()} ${active ? "selected" : ""} ${liveData ? "georeferenced-envelope" : ""}`}
                style={{
                  left: `${segment.box.left}%`,
                  top: `${segment.box.top}%`,
                  width: `${segment.box.width}%`,
                  height: `${segment.box.height}%`,
                  transform: `rotate(${segment.box.rotate}deg)`,
                  clipPath: segment.polygon?.length ? `polygon(${segment.polygon.map(point => `${point.x}% ${point.y}%`).join(",")})` : undefined,
                  opacity: mode === "panels" && !active ? 0.22 : undefined,
                }}
                onClick={() => onToggle?.(segment.id)}
                aria-label={`${segment.name}, ${segment.quality} solar potential`}
              >
                {mode === "panels" && active ? (
                  <span className="roof-panel-grid">
                    {Array.from({ length: count }).map((_, index) => <i key={index} />)}
                  </span>
                ) : (
                  <b>{segment.id}</b>
                )}
              </button>
            );
          })}
        </div>
        {editing && (
          <div
            className="roof-manual-drawing-surface"
            onClick={event => {
              const bounds = event.currentTarget.getBoundingClientRect();
              onMapPoint?.({
                x: Math.max(0, Math.min(100, (event.clientX - bounds.left) / bounds.width * 100)),
                y: Math.max(0, Math.min(100, (event.clientY - bounds.top) / bounds.height * 100)),
              });
            }}
          >
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Manual roof section drawing canvas">
              {draftPoints.length > 1 && <polyline points={draftPoints.map(point => `${point.x},${point.y}`).join(" ")} />}
              {draftPoints.map((point, index) => <circle key={`${point.x}-${point.y}-${index}`} cx={point.x} cy={point.y} r="0.85" />)}
            </svg>
            <span>Click each roof corner · use at least 3 points</span>
          </div>
        )}
      </div>
      <span className="roof-map-north">N</span>
      <span className="roof-map-scale">~{Math.round(10 / zoom)} m</span>
      <div className="roof-map-zoom-controls" aria-label="Property map zoom controls">
        <button type="button" onClick={() => onZoomChange(Math.min(7, Number((zoom + 0.25).toFixed(2))))} aria-label="Zoom property map in"><ZoomIn size={14} /></button>
        <span>{zoom.toFixed(1)}×</span>
        <button type="button" onClick={() => onZoomChange(Math.max(1, Number((zoom - 0.25).toFixed(2))))} aria-label="Zoom property map out"><ZoomOut size={14} /></button>
      </div>
    </div>
  );
}

function Photorealistic3DView({ latitude, longitude, hour, day, segments }: { latitude: number; longitude: number; hour: number; day: number; segments: RoofSegment[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<CesiumViewer | null>(null);
  const runtimeRef = useRef<CesiumRuntime | null>(null);
  const inputHandlerRef = useRef<CesiumInputHandler | null>(null);
  const groundHeightRef = useRef(120);
  const overlayEntitiesRef = useRef<unknown[]>([]);
  const [status, setStatus] = useState("Loading Google Photorealistic 3D…");
  const [failed, setFailed] = useState(false);
  const [viewerReady, setViewerReady] = useState(false);
  const [shadeBySegment, setShadeBySegment] = useState<Record<string, number>>({});

  const flyHome = useCallback((viewer: CesiumViewer, runtime: CesiumRuntime) => {
    const cameraHeight = groundHeightRef.current + 52;
    viewer.camera.flyTo({
      destination: runtime.Cartesian3.fromDegrees(longitude, latitude - 0.00013, cameraHeight),
      orientation: {
        heading: runtime.Math.toRadians(8),
        pitch: runtime.Math.toRadians(-54),
        roll: 0,
      },
      duration: 1.1,
    });
  }, [latitude, longitude]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      const [runtime, configResponse] = await Promise.all([
        loadCesiumRuntime(),
        fetch(`${engine}/v1/solar/photorealistic-3d-config`, { signal: controller.signal }),
      ]);
      const config = await configResponse.json();
      if (!configResponse.ok || !config.data?.tilesetUrl) throw new Error("The Google Map Tiles key is unavailable.");
      if (cancelled || !containerRef.current) return;
      const viewer = new runtime.Viewer(containerRef.current, {
        imageryProvider: false,
        baseLayerPicker: false,
        animation: false,
        timeline: false,
        fullscreenButton: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        navigationHelpButton: false,
        sceneModePicker: false,
        selectionIndicator: false,
        requestRenderMode: true,
        shadows: true,
      });
      const tileset = new runtime.Cesium3DTileset({
        url: config.data.tilesetUrl,
        showCreditsOnScreen: true,
        maximumScreenSpaceError: 18,
        cacheBytes: 128 * 1024 * 1024,
        maximumCacheOverflowBytes: 64 * 1024 * 1024,
        cullRequestsWhileMoving: true,
        preloadWhenHidden: false,
        preloadFlightDestinations: false,
        dynamicScreenSpaceError: true,
      });
      tileset.shadows = runtime.ShadowMode.ENABLED;
      viewer.scene.primitives.add(tileset);
      viewer.scene.globe.show = false;
      const controls = viewer.scene.screenSpaceCameraController;
      controls.enableInputs = true;
      controls.enableRotate = true;
      controls.enableTranslate = true;
      controls.enableZoom = true;
      controls.enableTilt = true;
      controls.enableLook = true;
      controls.inertiaSpin = 0.84;
      controls.inertiaTranslate = 0.84;
      controls.inertiaZoom = 0.72;
      controls.minimumZoomDistance = 2;
      controls.maximumZoomDistance = 800;
      controls.maximumMovementRatio = 0.08;
      controls.rotateEventTypes = runtime.CameraEventType.LEFT_DRAG;
      controls.zoomEventTypes = [runtime.CameraEventType.WHEEL, runtime.CameraEventType.PINCH];
      controls.tiltEventTypes = [
        runtime.CameraEventType.MIDDLE_DRAG,
        { eventType: runtime.CameraEventType.LEFT_DRAG, modifier: runtime.KeyboardEventModifier.CTRL },
      ];
      // Cesium reserves right-drag for zooming in 3D. Solar4U replaces it with
      // a screen-space translation so the controls match the roof study flow:
      // left rotates, right moves the local work area, and the wheel zooms.
      let rightDragging = false;
      const inputHandler = new runtime.ScreenSpaceEventHandler(viewer.scene.canvas);
      inputHandler.setInputAction(() => {
        rightDragging = true;
      }, runtime.ScreenSpaceEventType.RIGHT_DOWN);
      inputHandler.setInputAction(() => {
        rightDragging = false;
      }, runtime.ScreenSpaceEventType.RIGHT_UP);
      inputHandler.setInputAction(movement => {
        if (!rightDragging) return;
        const start = movement.startPosition as { x: number; y: number } | undefined;
        const end = movement.endPosition as { x: number; y: number } | undefined;
        if (!start || !end) return;
        const height = Math.max(20, viewer.camera.positionCartographic?.height || 78);
        const metersPerPixel = Math.max(0.025, Math.min(0.3, height / 650));
        viewer.camera.moveRight(-(end.x - start.x) * metersPerPixel);
        viewer.camera.moveUp((end.y - start.y) * metersPerPixel);
        viewer.scene.requestRender();
      }, runtime.ScreenSpaceEventType.MOUSE_MOVE);
      inputHandlerRef.current = inputHandler;
      viewer.clock.shouldAnimate = false;
      viewerRef.current = viewer;
      runtimeRef.current = runtime;
      flyHome(viewer, runtime);
      viewer.scene.sampleHeightMostDetailed([runtime.Cartographic.fromDegrees(longitude, latitude)])
        .then(([surface]) => {
          if (cancelled || !Number.isFinite(surface?.height)) return;
          groundHeightRef.current = surface.height;
          flyHome(viewer, runtime);
        })
        .catch(() => {});
      setViewerReady(true);
      setStatus("Left-drag rotate · right-drag move · wheel zoom · 60 m work area");
    })().catch(error => {
      if (cancelled || controller.signal.aborted) return;
      setFailed(true);
      setStatus(error instanceof Error ? error.message : "Photorealistic 3D is unavailable.");
    });
    return () => {
      cancelled = true;
      controller.abort();
      const inputHandler = inputHandlerRef.current;
      inputHandlerRef.current = null;
      if (inputHandler && !inputHandler.isDestroyed()) inputHandler.destroy();
      const viewer = viewerRef.current;
      viewerRef.current = null;
      runtimeRef.current = null;
      setViewerReady(false);
      if (viewer && !viewer.isDestroyed()) viewer.destroy();
    };
  }, [latitude, longitude, flyHome]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const runtime = runtimeRef.current;
    if (!viewer || !runtime) return;
    const localSolarMinutes = Math.round(hour * 60);
    const utcMinutes = localSolarMinutes - Math.round(longitude * 4);
    const date = new Date(Date.UTC(2026, 0, day, 0, utcMinutes));
    viewer.clock.currentTime = runtime.JulianDate.fromDate(date);
    viewer.scene.requestRender();
  }, [day, hour, longitude]);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      const date = new Date(Date.UTC(2026, 0, Math.max(1, Math.min(365, day))));
      const month = date.getUTCMonth();
      const dayBit = date.getUTCDate() - 1;
      const band = Math.max(0, Math.min(23, Math.round(hour)));
      const response = await fetch(`${engine}/v1/solar/data-layer?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&layer=hourlyShade&month=${month}&frame=${DATA_LAYER_CACHE_VERSION}`, { signal: controller.signal });
      if (!response.ok) return;
      const tiff = await fromArrayBuffer(await response.arrayBuffer());
      const image = await tiff.getImage();
      const [minimumLongitude, minimumLatitude, maximumLongitude, maximumLatitude] = image.getBoundingBox();
      const width = image.getWidth();
      const height = image.getHeight();
      const rasters = await image.readRasters({ samples: [band] });
      const values = Array.from(rasters as unknown as ArrayLike<ArrayLike<number>>)[0];
      const next: Record<string, number> = {};
      for (const segment of segments) {
        const samples = segment.samplePoints?.length ? segment.samplePoints : segment.geoPolygon || [];
        let sunny = 0;
        let valid = 0;
        for (const point of samples) {
          const x = Math.max(0, Math.min(width - 1, Math.floor((point.longitude - minimumLongitude) / (maximumLongitude - minimumLongitude) * width)));
          const y = Math.max(0, Math.min(height - 1, Math.floor((maximumLatitude - point.latitude) / (maximumLatitude - minimumLatitude) * height)));
          const value = Number(values?.[y * width + x]);
          if (!Number.isFinite(value) || value === -9999) continue;
          valid += 1;
          if ((value & (1 << dayBit)) !== 0) sunny += 1;
        }
        next[segment.id] = valid ? 1 - sunny / valid : 0;
      }
      setShadeBySegment(next);
    })().catch(() => {});
    return () => controller.abort();
  }, [day, hour, latitude, longitude, segments]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const runtime = runtimeRef.current;
    if (!viewerReady || !viewer || !runtime) return;
    for (const entity of overlayEntitiesRef.current) viewer.entities.remove(entity);
    overlayEntitiesRef.current = [];
    for (const segment of segments) {
      if (!segment.geoPolygon || segment.geoPolygon.length < 3) continue;
      const shade = shadeBySegment[segment.id] || 0;
      const color = shade >= 0.68 ? "#7a3d2f" : shade >= 0.34 ? "#d58b2b" : "#f0c83f";
      const coordinates = segment.geoPolygon.flatMap(point => [point.longitude, point.latitude]);
      const entity = viewer.entities.add({
        polygon: {
          hierarchy: runtime.Cartesian3.fromDegreesArray(coordinates),
          material: runtime.Color.fromCssColorString(color).withAlpha(0.56),
          classificationType: runtime.ClassificationType.CESIUM_3D_TILE,
        },
      });
      overlayEntitiesRef.current.push(entity);
    }
    viewer.scene.requestRender();
  }, [segments, shadeBySegment, viewerReady]);

  return (
    <div className={`roof-photorealistic-3d ${failed ? "failed" : ""}`}>
      <div ref={containerRef} className="roof-cesium-container" onContextMenu={event => event.preventDefault()} />
      <div className="roof-3d-status"><span>{status}</span><b>Solar shade overlay · Google Maps</b></div>
      {!failed && (
        <div className="roof-3d-controls" aria-label="3D property view controls">
          <button type="button" onClick={() => viewerRef.current?.camera.zoomIn(28)} aria-label="Zoom 3D view in"><ZoomIn size={14} /></button>
          <button type="button" onClick={() => viewerRef.current?.camera.zoomOut(28)} aria-label="Zoom 3D view out"><ZoomOut size={14} /></button>
          <button type="button" onClick={() => viewerRef.current && runtimeRef.current && flyHome(viewerRef.current, runtimeRef.current)} aria-label="Reset 3D property view"><Home size={14} /></button>
        </div>
      )}
    </div>
  );
}

export default function PlannerPage() {
  const [stage, setStage] = useState<PlannerStage>("site");
  const [furthestStage, setFurthestStage] = useState(0);
  const [query, setQuery] = useState("");
  const [locations, setLocations] = useState<LocationResult[]>([]);
  const [pendingLocation, setPendingLocation] = useState<LocationResult | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationResult | null>(null);
  const [locationAttribution, setLocationAttribution] = useState("");
  const [segments, setSegments] = useState<RoofSegment[]>(demoSegments);
  const [selectedIds, setSelectedIds] = useState<string[]>(demoSegments.slice(0, 3).map(segment => segment.id));
  const [panelCounts, setPanelCounts] = useState<Record<string, number>>(Object.fromEntries(demoSegments.map(segment => [segment.id, segment.maxPanels])));
  const [isDemo, setIsDemo] = useState(true);
  const [aerialUrl, setAerialUrl] = useState("/images/roof-analysis-demo-aerial.png");
  const [dataLayerCenter, setDataLayerCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  const [capabilities, setCapabilities] = useState<SolarCapabilities | null>(null);
  const [analysisBlocked, setAnalysisBlocked] = useState("");
  const [providerNote, setProviderNote] = useState("Illustrative local demo · connect Google Solar for live roof geometry");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [hour, setHour] = useState(13);
  const [day, setDay] = useState(196);
  const [playing, setPlaying] = useState(false);
  const [mapZoom, setMapZoom] = useState(1);
  const [shadowView, setShadowView] = useState<"3d" | "shade">("shade");
  const [manualEditorOpen, setManualEditorOpen] = useState(false);
  const [draftRoofPoints, setDraftRoofPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [manualRoofName, setManualRoofName] = useState("Custom roof plane");
  const [manualRoofPitch, setManualRoofPitch] = useState(30);
  const [manualRoofAzimuth, setManualRoofAzimuth] = useState(180);
  const [visionPanelOpen, setVisionPanelOpen] = useState(false);
  const [visionFile, setVisionFile] = useState<File | null>(null);
  const [visionPreview, setVisionPreview] = useState("");
  const [visionConsent, setVisionConsent] = useState(false);
  const [visionSource, setVisionSource] = useState("User-owned property image");
  const [visionBackend, setVisionBackend] = useState<"auto" | "local" | "samgeo">("auto");
  const [visionAligned, setVisionAligned] = useState(false);
  const [visionCandidate, setVisionCandidate] = useState<RoofVisionCandidate | null>(null);
  const [visionStatus, setVisionStatus] = useState("");
  const [usage, setUsage] = useState(10000);
  const [rate, setRate] = useState(0.19);
  const [costPerWatt, setCostPerWatt] = useState(3);
  const [incentive, setIncentive] = useState(30);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [saved, setSaved] = useState(false);

  const activeSegments = useMemo(() => segments.filter(segment => selectedIds.includes(segment.id)), [segments, selectedIds]);
  const totalPanels = activeSegments.reduce((sum, segment) => sum + (panelCounts[segment.id] || 0), 0);
  const capacityKw = totalPanels * 0.4;
  const currentStageIndex = stageOrder.indexOf(stage);
  const fallback = useMemo(() => localEstimate({
    capacityKw,
    latitude: selectedLocation?.latitude || 43,
    rate,
    usage,
    costPerWatt,
    incentivePercent: incentive,
    segments: activeSegments,
    panelCounts,
  }), [capacityKw, selectedLocation, rate, usage, costPerWatt, incentive, activeSegments, panelCounts]);
  const result = estimate || fallback;
  const paybackYear = result.cashFlow.find(item => item.cumulativeSavings >= 0)?.year || null;

  useEffect(() => {
    fetch(`${engine}/v1/solar/capabilities`)
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(payload => setCapabilities(payload.data))
      .catch(() => setCapabilities(null));
  }, []);

  useEffect(() => () => {
    if (visionPreview) URL.revokeObjectURL(visionPreview);
  }, [visionPreview]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setHour(value => value >= 19 ? 6 : value + 0.25), 180);
    return () => window.clearInterval(timer);
  }, [playing]);

  useEffect(() => {
    if (stageOrder.indexOf(stage) < 3 || !capacityKw) return;
    const controller = new AbortController();
    const arrays = activeSegments.map(segment => ({
      capacityKw: (panelCounts[segment.id] || 0) * 0.4,
      azimuth: segment.azimuth,
      tilt: segment.tilt,
    }));
    fetch(`${engine}/v1/solar/estimates`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "pvgis",
        latitude: selectedLocation?.latitude || 43,
        longitude: selectedLocation?.longitude || -78.9,
        capacityKw,
        arrays,
        lossesPercent: 14,
        electricityRate: rate,
        annualUsageKwh: usage,
        costPerWatt,
        incentivePercent: incentive / 100,
      }),
      signal: controller.signal,
    })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(payload => {
        const remote = payload.data;
        setEstimate({
          ...fallback,
          provider: remote.provider || fallback.provider,
          annualKwh: Number(remote.annualKwh || fallback.annualKwh),
          monthlyKwh: remote.monthlyKwh || fallback.monthlyKwh,
          yearlyBillValue: Math.round(Number(remote.annualKwh || fallback.annualKwh) * rate),
          billOffsetPercent: Math.min(100, Math.round(Number(remote.annualKwh || fallback.annualKwh) / Math.max(usage, 1) * 100)),
        });
      })
      .catch(() => setEstimate(null));
    return () => controller.abort();
  }, [stage, capacityKw, activeSegments, panelCounts, selectedLocation, rate, usage, costPerWatt, incentive, fallback]);

  const goTo = (next: PlannerStage) => {
    const index = stageOrder.indexOf(next);
    if (index <= furthestStage) setStage(next);
  };
  const advance = (next: PlannerStage) => {
    const index = stageOrder.indexOf(next);
    setFurthestStage(value => Math.max(value, index));
    setStage(next);
  };
  const searchAddress = async () => {
    if (query.trim().length < 4) {
      setError("Enter a complete address, city, or postal code.");
      return;
    }
    setSearching(true);
    setError("");
    try {
      const response = await fetch(`${engine}/v1/solar/geocode?q=${encodeURIComponent(query.trim())}`);
      const payload = await response.json();
      if (!response.ok || !payload.data?.length) throw new Error("No matching property was found.");
      setLocations(payload.data);
      setPendingLocation(null);
      setLocationAttribution(payload.attribution || "");
    } catch (searchError) {
      setLocations([]);
      setError(searchError instanceof Error ? searchError.message : "Address search is unavailable.");
    } finally {
      setSearching(false);
    }
  };
  const analyzeLocation = async (location: LocationResult) => {
    setSelectedLocation(location);
    setSearching(true);
    setError("");
    setAnalysisBlocked("");
    try {
      const response = await fetch(`${engine}/v1/solar/roof-analysis`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ latitude: location.latitude, longitude: location.longitude, requiredQuality: "HIGH" }),
      });
      const payload = await response.json();
      const live = response.ok && payload.data?.solarPotential && payload.data?.center;
      if (!live) {
        const reason = payload.data?.reason === "google_solar_key_not_configured"
          ? "Live roof analysis is not configured. Add a billing-enabled Google Solar API key, then restart the solar-engine container."
          : "Google Solar did not return building insights for this exact location. Try another result or use the clearly labeled fictional demo.";
        setAnalysisBlocked(reason);
        setIsDemo(false);
        setDataLayerCenter(null);
        return;
      }
      const matchedCenter = {
        latitude: Number(payload.data.center.latitude),
        longitude: Number(payload.data.center.longitude),
      };
      const buildingOffsetMeters = Math.round(haversineMeters(location, matchedCenter));
      if (buildingOffsetMeters > 45) {
        setAnalysisBlocked(`Google Solar matched a building ${buildingOffsetMeters} m from the selected address point. Solar4U stopped before showing the wrong roof. Choose another address result or verify a more precise rooftop coordinate.`);
        setIsDemo(false);
        setDataLayerCenter(null);
        return;
      }
      const googleSegments = normalizeGoogleSegments(payload.data, matchedCenter);
      let nextSegments = googleSegments;
      let geometryBackend = "Google roof-segment references";
      try {
        const planeResponse = await fetch(`${engine}/v1/solar/roof-planes?lat=${encodeURIComponent(matchedCenter.latitude)}&lon=${encodeURIComponent(matchedCenter.longitude)}`);
        const planePayload = await planeResponse.json();
        const detectedPlanes = planeResponse.ok ? normalizeDsmPlanes(planePayload, payload.data, matchedCenter) : [];
        if (detectedPlanes.length >= 2) {
          nextSegments = detectedPlanes;
          geometryBackend = `selected-building DSM plane fit · ${detectedPlanes.length} connected roof surfaces`;
        }
      } catch {
        // Building Insights remains a reviewable fallback when the local DSM worker is unavailable.
      }
      if (!nextSegments.length) {
        setAnalysisBlocked("Google Solar returned the building but neither the masked DSM worker nor Building Insights produced reviewable roof sections. Use the manual roof workflow or an owner-provided DSM survey.");
        setIsDemo(false);
        setDataLayerCenter(null);
        return;
      }
      setSegments(nextSegments);
      setSelectedIds(nextSegments.slice(0, 3).map(segment => segment.id));
      setPanelCounts(Object.fromEntries(nextSegments.map(segment => [segment.id, segment.maxPanels])));
      setAerialUrl(`${engine}/v1/solar/map-image?lat=${encodeURIComponent(matchedCenter.latitude)}&lon=${encodeURIComponent(matchedCenter.longitude)}`);
      setDataLayerCenter(matchedCenter);
      const footprint = nextSegments.flatMap(globalPolygonForSegment);
      const footprintWidth = footprint.length ? Math.max(...footprint.map(point => point.x)) - Math.min(...footprint.map(point => point.x)) : 18;
      const footprintHeight = footprint.length ? Math.max(...footprint.map(point => point.y)) - Math.min(...footprint.map(point => point.y)) : 18;
      // Fill roughly 70% of the analytical card with the selected building while
      // retaining enough of the 60 m data-layer frame to recognize its immediate lot.
      setMapZoom(Number(Math.min(4.5, Math.max(1.25, 70 / Math.max(footprintWidth, footprintHeight, 16))).toFixed(2)));
      setShadowView(capabilities?.googlePhotorealistic3d ? "3d" : "shade");
      setIsDemo(false);
      setProviderNote(`Google Solar ${payload.data.imageryQuality || "BASE"} · address-to-building offset ${buildingOffsetMeters} m · ${geometryBackend} · RGB, flux, DSM and hourly shade layers`);
      advance("sun");
    } catch {
      setAnalysisBlocked("The live roof provider was unavailable. Solar4U did not substitute a different house. Check the solar-engine status or use the fictional demo.");
      setIsDemo(false);
      setDataLayerCenter(null);
    } finally {
      setSearching(false);
    }
  };
  const useDemo = () => {
    const demoLocation = {
      id: "demo",
      label: "Fictional demonstration property",
      latitude: 43.0,
      longitude: -78.9,
      provider: "solar4u-demo",
    };
    setSelectedLocation(demoLocation);
    setPendingLocation(null);
    setSegments(demoSegments);
    setSelectedIds(demoSegments.slice(0, 3).map(segment => segment.id));
    setPanelCounts(Object.fromEntries(demoSegments.map(segment => [segment.id, segment.maxPanels])));
    setAerialUrl("/images/roof-analysis-demo-aerial.png");
    setDataLayerCenter(null);
    setMapZoom(1);
    setShadowView("shade");
    setIsDemo(true);
    setProviderNote("Illustrative fictional demo · not the searched property · no analytical geospatial layers");
    setAnalysisBlocked("");
    advance("sun");
  };
  const toggleSegment = (id: string) => setSelectedIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const saveManualRoofSection = () => {
    const hull = convexHull(draftRoofPoints);
    if (hull.length < 3) return;
    const geometry = polygonGeometry(hull);
    const areaMeters2 = Math.abs(hull.reduce((sum, point, index) => {
      const next = hull[(index + 1) % hull.length];
      return sum + point.x * next.y - next.x * point.y;
    }, 0) / 2);
    const id = `M${segments.filter(segment => segment.source === "manual").length + 1}`;
    const solarAlignment = Math.max(0.35, (1 + Math.cos((manualRoofAzimuth - 180) * Math.PI / 180)) / 2);
    const flux = Math.round(55 + solarAlignment * 40);
    const segment: RoofSegment = {
      id,
      name: manualRoofName.trim() || `Manual roof plane ${id}`,
      direction: directionFor(manualRoofAzimuth),
      azimuth: manualRoofAzimuth,
      tilt: manualRoofPitch,
      maxPanels: Math.max(1, Math.min(100, Math.floor(areaMeters2 / 2.05))),
      flux,
      annualPerPanel: Math.round(300 + flux * 2.25),
      quality: flux >= 88 ? "Excellent" : flux >= 70 ? "Good" : "Fair",
      box: geometry.box,
      polygon: geometry.localPolygon,
      geoPolygon: dataLayerCenter ? hull.map(point => geoPointForDataLayer(point, dataLayerCenter)) : undefined,
      source: "manual",
    };
    setSegments(current => [...current, segment]);
    setSelectedIds(current => [...current, id]);
    setPanelCounts(current => ({ ...current, [id]: segment.maxPanels }));
    setDraftRoofPoints([]);
    setManualRoofName("Custom roof plane");
    setManualEditorOpen(false);
  };
  const analyzeRoofImage = async () => {
    if (!visionFile || !visionConsent || !visionSource.trim()) return;
    setVisionStatus("Analyzing the prompted property crop…");
    setVisionCandidate(null);
    const form = new FormData();
    form.append("image", visionFile);
    form.append("backend", visionBackend);
    form.append("source_consent", "true");
    form.append("source_license", visionSource.trim());
    form.append("prompt", JSON.stringify({
      coordinates: "normalized",
      bbox: [0.06, 0.06, 0.94, 0.94],
      positivePoints: [[0.5, 0.5]],
      negativePoints: [[0.02, 0.02], [0.98, 0.02], [0.02, 0.98], [0.98, 0.98]],
    }));
    try {
      const response = await fetch(`${engine}/v1/solar/roof-vision/segment`, { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || payload.error || "Roof Vision could not analyze the image.");
      setVisionCandidate(payload.data.candidate);
      setVisionStatus(`${payload.data.backend} candidate · ${Math.round(payload.data.candidate.confidence * 100)}% algorithm confidence · review required`);
    } catch (error) {
      setVisionStatus(error instanceof Error ? error.message : "Roof Vision is unavailable.");
    }
  };
  const chooseVisionFile = (file: File | null) => {
    setVisionFile(file);
    setVisionPreview(file && !file.name.toLowerCase().match(/\.tiff?$/) ? URL.createObjectURL(file) : "");
    setVisionCandidate(null);
    setVisionStatus("");
    setVisionAligned(false);
  };
  const addVisionCandidate = () => {
    if (!visionCandidate) return;
    let hull: Array<{ x: number; y: number }> = [];
    const geoRing = visionCandidate.geoPolygon?.coordinates?.[0] || [];
    if (geoRing.length >= 3 && dataLayerCenter) {
      hull = convexHull(geoRing.map(([longitude, latitude]) => mapPointForDataLayer({ latitude, longitude }, dataLayerCenter)));
    } else if (visionAligned) {
      hull = convexHull(visionCandidate.normalizedPolygon.map(([x, y]) => ({ x: x * 100, y: y * 100 })));
    }
    if (hull.length < 3) {
      setVisionStatus("This image has no map coordinates. Confirm that its edges match the current north-up planner frame before importing it.");
      return;
    }
    const geometry = polygonGeometry(hull);
    const areaMeters2 = Math.abs(hull.reduce((sum, point, index) => {
      const next = hull[(index + 1) % hull.length];
      return sum + point.x * next.y - next.x * point.y;
    }, 0) / 2);
    const id = `V${segments.filter(segment => segment.source === "vision").length + 1}`;
    const solarAlignment = Math.max(0.35, (1 + Math.cos((manualRoofAzimuth - 180) * Math.PI / 180)) / 2);
    const flux = Math.round(55 + solarAlignment * 40);
    const segment: RoofSegment = {
      id,
      name: manualRoofName.trim() || `Roof Vision candidate ${id}`,
      direction: directionFor(manualRoofAzimuth),
      azimuth: manualRoofAzimuth,
      tilt: manualRoofPitch,
      maxPanels: Math.max(1, Math.min(100, Math.floor(areaMeters2 / 2.05))),
      flux,
      annualPerPanel: Math.round(300 + flux * 2.25),
      quality: flux >= 88 ? "Excellent" : flux >= 70 ? "Good" : "Fair",
      box: geometry.box,
      polygon: geometry.localPolygon,
      geoPolygon: dataLayerCenter ? hull.map(point => geoPointForDataLayer(point, dataLayerCenter)) : undefined,
      source: "vision",
    };
    setSegments(current => [...current, segment]);
    setSelectedIds(current => [...current, id]);
    setPanelCounts(current => ({ ...current, [id]: segment.maxPanels }));
    setVisionCandidate(null);
    setVisionStatus(`${id} added as editable planning geometry. Verify pitch, edges, setbacks, and obstructions.`);
  };
  const updateRoofSegment = (id: string, updates: Partial<Pick<RoofSegment, "tilt" | "azimuth">>) => {
    setSegments(current => current.map(segment => segment.id === id
      ? { ...segment, ...updates, direction: updates.azimuth === undefined ? segment.direction : directionFor(updates.azimuth) }
      : segment));
  };
  const maxMonthly = Math.max(...result.monthlyKwh, 1);
  const maxCash = Math.max(...result.cashFlow.map(item => Math.abs(item.cumulativeSavings)), 1);

  return (
    <main className="roof-planner">
      <header className="roof-planner-heading">
        <div>
          <span className="eyebrow">PROPERTY SOLAR WORKBENCH</span>
          <h1>Solar roof planner</h1>
          <p>Find the brightest roof planes, fit a practical array, and model monthly production plus long-term value.</p>
        </div>
        {selectedLocation && <div className="roof-location-chip"><MapPin size={15} /><span><small>Analyzing</small><b>{selectedLocation.label}</b></span></div>}
      </header>

      <nav className="roof-stage-tabs" aria-label="Roof planning stages">
        {stageOrder.map((item, index) => (
          <button
            type="button"
            key={item}
            className={item === stage ? "active" : index < currentStageIndex ? "complete" : ""}
            disabled={index > furthestStage}
            onClick={() => goTo(item)}
          >
            <span>{index < currentStageIndex ? <Check size={14} /> : index + 1}</span>
            {stageLabels[item]}
          </button>
        ))}
      </nav>

      {stage === "site" && (
        <section className="roof-site-stage">
          <div className="roof-site-search">
            <span className="eyebrow">STEP 1 · SITE</span>
            <h2>Let&apos;s find your property.</h2>
            <p>Search worldwide by street address, city, or postal code. Solar4U sends the query only when you press Search.</p>
            <div className="roof-address-form">
              <MapPin size={19} aria-hidden="true" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                onKeyDown={event => event.key === "Enter" && searchAddress()}
                placeholder="Enter an address, city, or postal code"
                aria-label="Property address"
              />
              <button type="button" onClick={searchAddress} disabled={searching}><Search size={16} /> {searching ? "Searching…" : "Search"}</button>
            </div>
            {error && <div className="roof-error"><Info size={14} /> {error}</div>}
            {locations.length > 0 && (
              <div className="roof-location-results">
                {locations.map(location => (
                  <button type="button" key={location.id} className={pendingLocation?.id === location.id ? "selected" : ""} onClick={() => setPendingLocation(location)}>
                    <MapPin size={15} />
                    <span>
                      <b>{location.label}</b>
                      <small>{location.provider.replaceAll("-", " ")} · {location.precision || "unknown precision"}</small>
                    </span>
                    <em className={location.confidence || "approximate"}>{location.confidence === "exact" ? "Rooftop" : location.confidence === "street_address" ? "Address" : location.confidence || "Approximate"}</em>
                  </button>
                ))}
                <small>{locationAttribution}</small>
              </div>
            )}
            {pendingLocation && (
              <div className="roof-location-confirm">
                <iframe
                  title="Map for confirming the selected address point"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${pendingLocation.longitude - 0.002}%2C${pendingLocation.latitude - 0.0013}%2C${pendingLocation.longitude + 0.002}%2C${pendingLocation.latitude + 0.0013}&layer=mapnik&marker=${pendingLocation.latitude}%2C${pendingLocation.longitude}`}
                />
                <div>
                  <span>
                    <small>Selected coordinate</small>
                    <b>{pendingLocation.latitude.toFixed(6)}, {pendingLocation.longitude.toFixed(6)}</b>
                  </span>
                  <p>{pendingLocation.confidence === "exact"
                    ? "Google identifies this as a rooftop-level street-address point."
                    : "This geocoder result is not guaranteed to be rooftop-precise. Confirm the marker before requesting the closest Solar API building."}</p>
                  <button type="button" onClick={() => analyzeLocation(pendingLocation)} disabled={searching}>
                    {searching ? "Checking building…" : "Confirm property and check roof"} <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}
            {analysisBlocked && <div className="roof-analysis-blocked"><Info size={16} /><span><b>Roof analysis stopped</b>{analysisBlocked}</span></div>}
            <div className="roof-demo-link">
              <span>Want to explore before connecting provider keys?</span>
              <button type="button" onClick={useDemo}>Open a fictional demo property <ArrowRight size={14} /></button>
            </div>
            {capabilities && (
              <div className="roof-provider-readiness">
                <span className={capabilities.googleGeocoding ? "ready" : ""}><i /> Exact-address geocoding</span>
                <span className={capabilities.googleSolar ? "ready" : ""}><i /> Solar RGB / DSM / flux / shade</span>
                <span className={capabilities.googlePhotorealistic3d ? "ready" : ""}><i /> Photorealistic 3D context</span>
              </div>
            )}
          </div>
          <div className="roof-how-it-works">
            <article><Sun size={21} /><span>01</span><h3>Analyze sunlight</h3><p>Review roof flux and seasonal shade.</p></article>
            <article><Home size={21} /><span>02</span><h3>Choose roof sections</h3><p>Compare orientation, pitch, and panel fit.</p></article>
            <article><BarChart3 size={21} /><span>03</span><h3>Estimate value</h3><p>Model monthly energy and 25-year cash flow.</p></article>
          </div>
        </section>
      )}

      {stage === "sun" && (
        <section className="roof-work-stage">
          <header className="roof-stage-intro">
            <div><span className="eyebrow">STEP 2 · SUN</span><h2>See how sunlight moves across the roof.</h2><p>Brighter roof planes receive more annual solar energy. Use the controls to inspect directional shade throughout the day and year.</p></div>
            <span className={isDemo ? "demo" : "live"}><CloudSun size={15} /> {providerNote}</span>
          </header>
          <div className="roof-sun-grid">
            <div className="roof-map-card">
              <header><div><b>Annual roof potential</b><small>Low energy</small></div><span>High energy</span></header>
              <RoofCanvas segments={segments} selectedIds={selectedIds} panelCounts={panelCounts} imageUrl={aerialUrl} dataLayerCenter={dataLayerCenter} liveData={!isDemo && Boolean(dataLayerCenter)} mode="flux" hour={hour} day={day} zoom={mapZoom} onZoomChange={setMapZoom} />
              <footer><span><i className="low" /> Lower yield</span><span><i className="mid" /> Good</span><span><i className="high" /> Excellent</span></footer>
            </div>
            <div className="roof-map-card shadow-card">
              <header><div><b>Sun and shadow study</b><small>{Math.floor(hour).toString().padStart(2, "0")}:{Math.round((hour % 1) * 60).toString().padStart(2, "0")}</small></div><span>Day {day}</span></header>
              {!isDemo && dataLayerCenter && capabilities?.googlePhotorealistic3d && (
                <div className="roof-view-switch" role="group" aria-label="Sun study view">
                  <button type="button" className={shadowView === "3d" ? "active" : ""} onClick={() => setShadowView("3d")}>3D property</button>
                  <button type="button" className={shadowView === "shade" ? "active" : ""} onClick={() => setShadowView("shade")}>2D diagnostic layer</button>
                </div>
              )}
              {shadowView === "3d" && !isDemo && dataLayerCenter ? (
                <Photorealistic3DView latitude={dataLayerCenter.latitude} longitude={dataLayerCenter.longitude} hour={hour} day={day} segments={segments} />
              ) : (
                <RoofCanvas segments={segments} selectedIds={selectedIds} panelCounts={panelCounts} imageUrl={aerialUrl} dataLayerCenter={dataLayerCenter} liveData={!isDemo && Boolean(dataLayerCenter)} mode="shadow" hour={hour} day={day} zoom={mapZoom} onZoomChange={setMapZoom} />
              )}
              <div className="roof-time-controls">
                <button type="button" onClick={() => setPlaying(value => !value)} aria-label={playing ? "Pause shadow animation" : "Play shadow animation"}>{playing ? <Pause size={15} /> : <Play size={15} />}</button>
                <label><span>Time <b>{Math.floor(hour)}:{Math.round((hour % 1) * 60).toString().padStart(2, "0")}</b></span><input type="range" min="6" max="19" step=".25" value={hour} onChange={event => setHour(Number(event.target.value))} /></label>
                <label><span>Date <b>Day {day}</b></span><input type="range" min="1" max="365" value={day} onChange={event => setDay(Number(event.target.value))} /></label>
              </div>
            </div>
          </div>
          <aside className="roof-geospatial-method">
            <div>
              <strong>{isDemo ? "Illustrative mode" : "Georeferenced analytical mode"}</strong>
              <p>{isDemo
                ? "This fictional scene demonstrates the controls only. It is not an estimate for the searched property."
                : "Solar4U isolates the selected building with Google's aligned mask, fits connected planes to the 10 cm DSM, and cross-checks pitch and azimuth against Building Insights. The RGB, annual flux, and hourly shade layers remain in the same geographic frame."}</p>
            </div>
            <div>
              <strong>Editable planning geometry</strong>
              <p>The thin plane outlines come from the surface model, not rectangular panel envelopes. You can still draw or correct sections below; DSM-derived edges are planning geometry and should be verified against lidar or field measurements before final design work.</p>
            </div>
          </aside>
          <div className="roof-stage-actions"><button type="button" className="secondary-button" onClick={() => setStage("site")}><ArrowLeft size={15} /> Back</button><button type="button" className="primary-button" onClick={() => advance("sections")}>Review roof sections <ArrowRight size={15} /></button></div>
        </section>
      )}

      {stage === "sections" && (
        <section className="roof-work-stage">
          <header className="roof-stage-intro">
            <div><span className="eyebrow">STEP 3 · SECTIONS</span><h2>{activeSegments.length} roof sections selected for solar.</h2><p>Choose the planes you want to use, then adjust panel count to leave room for setbacks, access paths, vents, and future field verification.</p></div>
            <div className="roof-array-total"><small>Current design</small><b>{totalPanels} panels · {capacityKw.toFixed(1)} kW</b></div>
          </header>
          <div className={`roof-manual-editor ${manualEditorOpen ? "open" : ""}`}>
            <div>
              <span><b>Roof geometry</b><small>Provider geometry, prompted image candidates, and hand-drawn corrections all remain editable</small></span>
              <div className="roof-geometry-actions">
                <button type="button" onClick={() => setVisionPanelOpen(value => !value)}>{visionPanelOpen ? "Close Roof Vision" : "+ Analyze permitted imagery"}</button>
                <button type="button" onClick={() => { setManualEditorOpen(value => !value); setDraftRoofPoints([]); }}>{manualEditorOpen ? "Close editor" : "+ Draw a roof section"}</button>
              </div>
            </div>
            {visionPanelOpen && (
              <div className="roof-vision-panel">
                <div className="roof-vision-copy">
                  <b>Roof Vision · optional local analysis</b>
                  <p>Upload your own or otherwise permitted north-up property crop. GeoTIFFs preserve map coordinates; PNG/JPEG candidates require explicit alignment before they can enter this map.</p>
                  <span className={capabilities?.roofVision?.available ? "available" : "unavailable"}>{capabilities?.roofVision?.available ? `Service ready · local${capabilities.roofVision.backends?.samgeo ? " + SamGeo" : ""}` : "Service is not running"}</span>
                </div>
                <div className="roof-vision-fields">
                  <label><span>Orthophoto or GeoTIFF</span><input type="file" accept="image/png,image/jpeg,image/tiff,.tif,.tiff" onChange={event => chooseVisionFile(event.target.files?.[0] || null)} /></label>
                  <label><span>Source / license</span><input value={visionSource} onChange={event => setVisionSource(event.target.value)} /></label>
                  <label><span>Backend</span><select value={visionBackend} onChange={event => setVisionBackend(event.target.value as "auto" | "local" | "samgeo")}><option value="auto">Best available</option><option value="local">Prompted local</option><option value="samgeo" disabled={!capabilities?.roofVision?.backends?.samgeo}>SamGeo</option></select></label>
                </div>
                <label className="roof-vision-consent"><input type="checkbox" checked={visionConsent} onChange={event => setVisionConsent(event.target.checked)} /><span>I confirm I may process this imagery. Do not upload Google Solar/Maps imagery unless its terms explicitly permit this use.</span></label>
                {visionFile && !visionFile.name.toLowerCase().match(/\.tiff?$/) && <label className="roof-vision-consent"><input type="checkbox" checked={visionAligned} onChange={event => setVisionAligned(event.target.checked)} /><span>This image is north-up and its edges match the current planner map frame.</span></label>}
                {visionPreview && (
                  <div className="roof-vision-preview">
                    <img src={visionPreview} alt="Uploaded permitted property crop" />
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                      <rect x="6" y="6" width="88" height="88" />
                      {visionCandidate && <polygon points={visionCandidate.normalizedPolygon.map(([x, y]) => `${x * 100},${y * 100}`).join(" ")} />}
                    </svg>
                  </div>
                )}
                <div className="roof-vision-actions">
                  <button type="button" onClick={analyzeRoofImage} disabled={!visionFile || !visionConsent || !capabilities?.roofVision?.available}>Analyze prompted crop</button>
                  <button type="button" className="save" onClick={addVisionCandidate} disabled={!visionCandidate || (!visionCandidate.geoPolygon && !visionAligned)}>Add candidate as roof section</button>
                  {visionStatus && <span>{visionStatus}</span>}
                </div>
              </div>
            )}
            {manualEditorOpen && (
              <div className="roof-manual-fields">
                <label><span>Section name</span><input value={manualRoofName} onChange={event => setManualRoofName(event.target.value)} /></label>
                <label><span>Pitch</span><input type="number" min="0" max="85" step="0.5" value={manualRoofPitch} onChange={event => setManualRoofPitch(Math.max(0, Math.min(85, Number(event.target.value))))} /></label>
                <label><span>Azimuth</span><input type="number" min="0" max="359" value={manualRoofAzimuth} onChange={event => setManualRoofAzimuth(Math.max(0, Math.min(359, Number(event.target.value))))} /></label>
                <span className="roof-draft-count">{draftRoofPoints.length} corners</span>
                <button type="button" onClick={() => setDraftRoofPoints(current => current.slice(0, -1))} disabled={!draftRoofPoints.length}>Undo point</button>
                <button type="button" onClick={() => setDraftRoofPoints([])} disabled={!draftRoofPoints.length}>Clear</button>
                <button type="button" className="save" onClick={saveManualRoofSection} disabled={draftRoofPoints.length < 3}>Save section</button>
              </div>
            )}
          </div>
          <div className="roof-section-layout">
            <div className="roof-section-map"><RoofCanvas segments={segments} selectedIds={selectedIds} panelCounts={panelCounts} imageUrl={aerialUrl} dataLayerCenter={dataLayerCenter} liveData={!isDemo && Boolean(dataLayerCenter)} mode="panels" hour={hour} day={day} zoom={mapZoom} onZoomChange={setMapZoom} onToggle={toggleSegment} editing={manualEditorOpen} draftPoints={draftRoofPoints} onMapPoint={point => setDraftRoofPoints(current => [...current, point])} /></div>
            <div className="roof-section-cards">
              {segments.map(segment => {
                const active = selectedIds.includes(segment.id);
                return (
                  <article key={segment.id} className={active ? "selected" : ""}>
                    <button type="button" className="roof-section-select" onClick={() => toggleSegment(segment.id)} aria-pressed={active}>
                      <span>{active && <Check size={13} />}</span>
                      <div><small>{segment.id} · {segment.direction} · {segment.tilt}° tilt · {segment.source === "manual" ? "user drawn" : segment.source === "vision" ? "Roof Vision candidate" : segment.source === "dsm" ? "masked DSM fit" : segment.source === "google" ? "Google detected" : "demo"}</small><b>{segment.name}</b></div>
                      <em className={segment.quality.toLowerCase()}>{segment.quality}</em>
                    </button>
                    <div className="roof-energy-gauge"><i style={{ width: `${segment.flux}%` }} /></div>
                    <div className="roof-section-metrics"><span><small>Solar score</small><b>{segment.flux}/100</b></span><span><small>Estimated output</small><b>{(segment.annualPerPanel * (panelCounts[segment.id] || 0)).toLocaleString()} kWh/yr</b></span></div>
                    <div className="roof-plane-inputs">
                      <label><span>Roof pitch</span><input type="number" min="0" max="85" step="0.5" value={segment.tilt} onChange={event => updateRoofSegment(segment.id, { tilt: Math.max(0, Math.min(85, Number(event.target.value))) })} /></label>
                      <label><span>Azimuth</span><input type="number" min="0" max="359" value={segment.azimuth} onChange={event => updateRoofSegment(segment.id, { azimuth: Math.max(0, Math.min(359, Number(event.target.value))) })} /></label>
                      {(segment.source === "manual" || segment.source === "vision") && <button type="button" onClick={() => { setSegments(current => current.filter(item => item.id !== segment.id)); setSelectedIds(current => current.filter(id => id !== segment.id)); }}>Remove</button>}
                    </div>
                    {active && <label><span>Panel count <b>{panelCounts[segment.id]} of {segment.maxPanels}</b></span><input type="range" min="1" max={segment.maxPanels} value={panelCounts[segment.id]} onChange={event => setPanelCounts(current => ({ ...current, [segment.id]: Number(event.target.value) }))} /></label>}
                  </article>
                );
              })}
            </div>
          </div>
          <div className="roof-stage-actions"><button type="button" className="secondary-button" onClick={() => setStage("sun")}><ArrowLeft size={15} /> Back</button><button type="button" className="primary-button" disabled={!totalPanels} onClick={() => advance("savings")}>Estimate production and savings <ArrowRight size={15} /></button></div>
        </section>
      )}

      {stage === "savings" && (
        <section className="roof-work-stage">
          <header className="roof-stage-intro savings-intro">
            <div><span className="eyebrow">STEP 4 · SAVINGS</span><h2>{result.annualKwh.toLocaleString()} kWh estimated in year one.</h2><p>Adjust the household and project assumptions. Monthly production uses live PVGIS climate data when available and falls back to the reproducible local roof model.</p></div>
            <div className="roof-provider-label"><CloudSun size={16} /><span><small>Production model</small><b>{result.provider.replaceAll("-", " ")}</b></span></div>
          </header>
          <div className="roof-savings-layout">
            <aside className="roof-scenario-panel">
              <h3>Adjust your scenario</h3>
              <label><span>Yearly electricity use <b>{usage.toLocaleString()} kWh</b></span><input type="range" min="2000" max="40000" step="250" value={usage} onChange={event => setUsage(Number(event.target.value))} /></label>
              <label><span>Electricity rate <b>${rate.toFixed(2)}/kWh</b></span><input type="range" min=".05" max=".75" step=".01" value={rate} onChange={event => setRate(Number(event.target.value))} /></label>
              <label><span>Installed cost <b>${costPerWatt.toFixed(2)}/W</b></span><input type="range" min="1" max="8" step=".05" value={costPerWatt} onChange={event => setCostPerWatt(Number(event.target.value))} /></label>
              <label><span>Incentives and credits <b>{incentive}%</b></span><input type="range" min="0" max="60" value={incentive} onChange={event => setIncentive(Number(event.target.value))} /></label>
              <div className="roof-scenario-note"><Info size={14} /><span>Financing, export compensation, taxes, maintenance, roof work, and utility-specific rules are not included in this first-pass model.</span></div>
            </aside>
            <div className="roof-financial-panel">
              <div className="roof-financial-headline">
                <p>Estimated net cost <b>${result.netCost.toLocaleString()}</b>. {paybackYear ? <>Break even around <b>year {paybackYear}</b>.</> : <>Payback extends beyond 25 years.</>}</p>
                <span>Year-one bill value <b>${result.yearlyBillValue.toLocaleString()}</b> · {result.billOffsetPercent}% usage offset</span>
              </div>
              <div className="roof-key-metrics">
                <article><small>System size</small><b>{capacityKw.toFixed(1)} kW</b><span>{totalPanels} × 400 W panels</span></article>
                <article><small>Gross installed cost</small><b>${result.installedCost.toLocaleString()}</b><span>Before incentives</span></article>
                <article><small>25-year position</small><b className={result.cashFlow[24]?.cumulativeSavings >= 0 ? "positive" : ""}>${result.cashFlow[24]?.cumulativeSavings.toLocaleString()}</b><span>Modeled cumulative value</span></article>
              </div>
              <section className="roof-monthly-chart">
                <header><div><h3>Monthly production</h3><p>Winter and summer variation for this location and selected roof planes.</p></div><b>{result.annualKwh.toLocaleString()} kWh/year</b></header>
                <div>{result.monthlyKwh.map((value, index) => <span key={monthNames[index]}><i style={{ height: `${Math.max(7, value / maxMonthly * 100)}%` }} /><b>{value.toLocaleString()}</b><small>{monthNames[index]}</small></span>)}</div>
              </section>
              <section className="roof-cash-chart">
                <header><h3>25-year cumulative cash flow</h3><span><i /> Cost recovery <i /> Net positive</span></header>
                <div>{result.cashFlow.map(item => <span key={item.year}><i className={item.cumulativeSavings >= 0 ? "positive" : ""} style={{ height: `${Math.max(4, Math.abs(item.cumulativeSavings) / maxCash * 100)}%` }} /><small>{item.year % 5 === 0 || item.year === 1 ? item.year : ""}</small></span>)}</div>
              </section>
            </div>
          </div>
          <div className="roof-stage-actions"><button type="button" className="secondary-button" onClick={() => setStage("sections")}><ArrowLeft size={15} /> Back</button><button type="button" className="primary-button" onClick={() => advance("next")}>Review next steps <ArrowRight size={15} /></button></div>
        </section>
      )}

      {stage === "next" && (
        <section className="roof-work-stage roof-next-stage">
          <header className="roof-stage-intro">
            <div><span className="eyebrow">STEP 5 · NEXT STEPS</span><h2>Your roof plan is ready for equipment research.</h2><p>Carry the selected array size into the Solar Part Picker, save this local project, or print a first-pass report for discussion with an installer or qualified professional.</p></div>
            <div className="roof-ready-badge"><Check size={19} /><span><small>Planning result</small><b>{capacityKw.toFixed(1)} kW · {result.annualKwh.toLocaleString()} kWh/year</b></span></div>
          </header>
          <div className="roof-next-grid">
            <article><PackageCheck size={23} /><span>01</span><h3>Build the equipment list</h3><p>Start with compatible modules, inverters, storage, protection, conductors, and mounting hardware.</p><Link href="/solar-part-picker?category=generation">Open Solar Part Picker <ExternalLink size={14} /></Link></article>
            <article><Home size={23} /><span>02</span><h3>Verify the property</h3><p>Confirm roof dimensions, structure, covering condition, obstructions, setbacks, access, and attachment layout on site.</p><Link href="/guides#roof-survey">Open roof survey guide <ExternalLink size={14} /></Link></article>
            <article><BarChart3 size={23} /><span>03</span><h3>Check rates and incentives</h3><p>Replace generic assumptions with the utility tariff, export rules, financing terms, incentives, tax advice, and contractor pricing.</p><Link href="/calculators">Open solar calculators <ExternalLink size={14} /></Link></article>
          </div>
          <div className="roof-plan-summary">
            <div><small>Selected roof planes</small><b>{activeSegments.map(segment => segment.id).join(", ")}</b></div>
            <div><small>Array</small><b>{totalPanels} panels · {capacityKw.toFixed(1)} kW</b></div>
            <div><small>Year-one production</small><b>{result.annualKwh.toLocaleString()} kWh</b></div>
            <div><small>Estimated net cost</small><b>${result.netCost.toLocaleString()}</b></div>
          </div>
          <div className="roof-stage-actions">
            <button type="button" className="secondary-button" onClick={() => setStage("savings")}><ArrowLeft size={15} /> Back</button>
            <button type="button" className="secondary-button" onClick={() => window.print()}><BarChart3 size={15} /> Print report</button>
            <button type="button" className="primary-button" onClick={() => {
              window.localStorage.setItem("solar4u-roof-plan", JSON.stringify({ selectedLocation, selectedIds, panelCounts, usage, rate, costPerWatt, incentive }));
              setSaved(true);
            }}>{saved ? <><Check size={15} /> Saved locally</> : "Save this project"}</button>
          </div>
        </section>
      )}
    </main>
  );
}
