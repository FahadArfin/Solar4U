import {
  packRegion,
  testPlacement,
  validateRegion,
  type Point,
  type Region,
} from "./placement.mjs";
export type Vec3 = [number, number, number];
export type Settings = {
  width: number;
  depth: number;
  eaves: number;
  pitch: number;
  azimuth: number;
  roof: "gable" | "mono" | "flat";
  groundWidth: number;
  groundDepth: number;
  groundTilt: number;
  groundAzimuth: number;
  sunAltitude: number;
  setback: number;
  clearance: number;
  moduleWidth: number;
  moduleLength: number;
  moduleWatts: number;
  gap: number;
  serviceGap: number;
  orientation: "best" | "portrait" | "landscape";
};
export type Surface = Region & {
  id: string;
  label: string;
  kind: "roof" | "ground";
  origin: Vec3;
  u: Vec3;
  v: Vec3;
  tilt: number;
  azimuth: number;
  enabled: boolean;
};
export type Panel = {
  id: string;
  surfaceId: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  slopeLength: number;
  tilt: number;
  watts: number;
  orientation: "portrait" | "landscape";
};
export type StudioPlan = {
  schemaVersion: 1;
  units: "metres";
  name: string;
  provenance: "user_dimensions";
  location: { latitude: number; longitude: number };
  settings: Settings;
  surfaces: Surface[];
  panels: Panel[];
  updatedAt: string;
};
export const DEFAULT_SETTINGS: Settings = {
  width: 12,
  depth: 10,
  eaves: 3,
  pitch: 28,
  azimuth: 180,
  roof: "gable",
  groundWidth: 12,
  groundDepth: 12,
  groundTilt: 30,
  groundAzimuth: 180,
  sunAltitude: 20,
  setback: 0.45,
  clearance: 0.3,
  moduleWidth: 1.134,
  moduleLength: 1.722,
  moduleWatts: 440,
  gap: 0.025,
  serviceGap: 0.6,
  orientation: "best",
};
export const radians = (n: number) => (n * Math.PI) / 180;
export const add = (a: Vec3, b: Vec3): Vec3 => [
  a[0] + b[0],
  a[1] + b[1],
  a[2] + b[2],
];
export const scale = (a: Vec3, n: number): Vec3 => [
  a[0] * n,
  a[1] * n,
  a[2] * n,
];
export const point3 = (s: Surface, x: number, y: number): Vec3 =>
  add(s.origin, add(scale(s.u, x), scale(s.v, y)));
export const rect = (w: number, d: number): Point[] => [
  [0, 0],
  [w, 0],
  [w, d],
  [0, d],
];
export function validateSettings(s: Settings) {
  const bounds: Record<string, [number, number]> = {
    width: [3, 40],
    depth: [3, 40],
    eaves: [1, 12],
    pitch: [0, 60],
    azimuth: [0, 360],
    groundWidth: [3, 50],
    groundDepth: [3, 50],
    groundTilt: [0, 60],
    groundAzimuth: [0, 360],
    sunAltitude: [5, 80],
    setback: [0, 5],
    clearance: [0, 5],
    moduleWidth: [0.4, 2.5],
    moduleLength: [0.5, 3.5],
    moduleWatts: [1, 1000],
    gap: [0, 0.5],
    serviceGap: [0, 10],
  };
  for (const [key, [min, max]] of Object.entries(bounds)) {
    const value = s[key as keyof Settings];
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < min ||
      value > max
    )
      throw new Error(`${key} must be between ${min} and ${max}`);
  }
  if (
    !["gable", "mono", "flat"].includes(s.roof) ||
    !["portrait", "landscape", "best"].includes(s.orientation)
  )
    throw new Error("Invalid roof type or module orientation");
  return s;
}
export function makeSurfaces(s: Settings): Surface[] {
  validateSettings(s);
  const tilt = s.roof === "flat" ? 0 : s.pitch,
    roofDepth = s.roof === "gable" ? s.depth / 2 : s.depth;
  const face = (id: string, label: string, azimuth: number): Surface => {
    const a = radians(azimuth),
      b = radians(tilt),
      u: Vec3 = [Math.cos(a), 0, -Math.sin(a)],
      v: Vec3 = [
        -Math.sin(a) * Math.cos(b),
        Math.sin(b),
        -Math.cos(a) * Math.cos(b),
      ];
    return {
      id,
      label,
      kind: "roof",
      origin: add(scale(u, -s.width / 2), [
        (Math.sin(a) * s.depth) / 2,
        s.eaves,
        (Math.cos(a) * s.depth) / 2,
      ]),
      u,
      v,
      tilt,
      azimuth,
      outer: rect(s.width, roofDepth / Math.cos(b)),
      holes: [],
      enabled: true,
    };
  };
  const surfaces = [face("roof-front", "Main roof", s.azimuth)];
  if (s.roof === "gable")
    surfaces.push({
      ...face("roof-back", "Opposite roof", (s.azimuth + 180) % 360),
      enabled: false,
    });
  const ga = radians(s.groundAzimuth),
    u: Vec3 = [Math.cos(ga), 0, -Math.sin(ga)],
    v: Vec3 = [-Math.sin(ga), 0, -Math.cos(ga)];
  surfaces.push({
    id: "ground",
    label: "Ground array",
    kind: "ground",
    origin: add(
      [
        (Math.abs(Math.cos(radians(s.azimuth))) * s.width) / 2 +
          (Math.abs(Math.sin(radians(s.azimuth))) * s.depth) / 2 +
          Math.hypot(s.groundWidth, s.groundDepth) / 2 +
          3,
        0,
        0,
      ],
      add(scale(u, -s.groundWidth / 2), scale(v, -s.groundDepth / 2)),
    ),
    u,
    v,
    tilt: s.groundTilt,
    azimuth: s.groundAzimuth,
    outer: rect(s.groundWidth, s.groundDepth),
    holes: [],
    enabled: true,
  });
  return surfaces;
}
export function groundSpacing(
  length: number,
  tilt: number,
  sunAltitude: number,
  serviceGap: number,
) {
  const b = radians(tilt),
    depth = length * Math.cos(b),
    rise = length * Math.sin(b),
    gap = Math.max(serviceGap, rise / Math.tan(radians(sunAltitude)));
  return { depth, rise, gap, pitch: depth + gap };
}
export function fillSurface(surface: Surface, s: Settings): Panel[] {
  if (!surface.enabled) return [];
  const variants =
    s.orientation === "best"
      ? (["portrait", "landscape"] as const)
      : ([s.orientation] as Array<"portrait" | "landscape">);
  let best: Panel[] = [];
  for (const orientation of variants) {
    const width = orientation === "portrait" ? s.moduleWidth : s.moduleLength,
      length = orientation === "portrait" ? s.moduleLength : s.moduleWidth,
      ground = groundSpacing(length, s.groundTilt, s.sunAltitude, s.serviceGap);
    const depth = surface.kind === "ground" ? ground.depth : length,
      gapY = surface.kind === "ground" ? ground.gap : s.gap;
    const packed = packRegion(surface, {
      width,
      depth,
      gapX: s.gap,
      gapY,
      setback: s.setback,
      clearance: s.clearance,
      limit: 400,
    });
    const panels = packed.map((r, i) => ({
      ...r,
      id: `${surface.id}-${orientation}-${i}`,
      surfaceId: surface.id,
      slopeLength: length,
      tilt: surface.tilt,
      watts: s.moduleWatts,
      orientation,
    }));
    if (panels.length > best.length) best = panels;
  }
  return best;
}
export function createPlan(settings: Settings = DEFAULT_SETTINGS): StudioPlan {
  const surfaces = makeSurfaces(settings);
  return {
    schemaVersion: 1,
    units: "metres",
    name: "My solar plan",
    provenance: "user_dimensions",
    location: { latitude: 40, longitude: -75 },
    settings: { ...settings },
    surfaces,
    panels: surfaces.flatMap((s) => fillSurface(s, settings)),
    updatedAt: new Date().toISOString(),
  };
}
export function refill(plan: StudioPlan, surfaceId?: string): StudioPlan {
  return {
    ...plan,
    panels: surfaceId
      ? [
          ...plan.panels.filter((p) => p.surfaceId !== surfaceId),
          ...plan.surfaces
            .filter((s) => s.id === surfaceId)
            .flatMap((s) => fillSurface(s, plan.settings)),
        ]
      : plan.surfaces.flatMap((s) => fillSurface(s, plan.settings)),
    updatedAt: new Date().toISOString(),
  };
}
export function panelCorners(surface: Surface, p: Panel): Vec3[] {
  return [
    [p.x, p.y],
    [p.x + p.width, p.y],
    [p.x + p.width, p.y + p.depth],
    [p.x, p.y + p.depth],
  ].map(([x, y]) => {
    const world = point3(surface, x, y);
    world[1] +=
      surface.kind === "ground"
        ? 0.7 +
          ((y - p.y) / p.depth) * p.slopeLength * Math.sin(radians(p.tilt))
        : 0.085;
    return world;
  });
}
export function canPlace(plan: StudioPlan, p: Panel) {
  const surface = plan.surfaces.find((s) => s.id === p.surfaceId);
  if (
    !surface?.enabled ||
    !testPlacement(
      surface,
      {
        centre: [p.x + p.width / 2, p.y + p.depth / 2],
        widthM: p.width,
        depthM: p.depth,
        rotationDegrees: 0,
      },
      {
        edgeSetbackM: plan.settings.setback,
        holeClearanceM: plan.settings.clearance,
      },
    ).valid
  )
    return false;
  const gapX = plan.settings.gap,
    gapY =
      surface.kind === "ground"
        ? groundSpacing(
            p.slopeLength,
            p.tilt,
            plan.settings.sunAltitude,
            plan.settings.serviceGap,
          ).gap
        : gapX;
  return !plan.panels.some((q) => {
    const pairGap =
      surface.kind === "ground"
        ? Math.max(
            gapY,
            groundSpacing(
              q.slopeLength,
              q.tilt,
              plan.settings.sunAltitude,
              plan.settings.serviceGap,
            ).gap,
          )
        : gapY;
    return (
      q.id !== p.id &&
      q.surfaceId === p.surfaceId &&
      p.x < q.x + q.width + gapX - 1e-7 &&
      p.x + p.width + gapX > q.x + 1e-7 &&
      p.y < q.y + q.depth + pairGap - 1e-7 &&
      p.y + p.depth + pairGap > q.y + 1e-7
    );
  });
}
export function decodePlan(raw: string): StudioPlan {
  if (raw.length > 2_000_000) throw new Error("Plan file exceeds 2 MB");
  const p = JSON.parse(raw) as StudioPlan;
  if (
    p.schemaVersion !== 1 ||
    p.units !== "metres" ||
    p.provenance !== "user_dimensions" ||
    typeof p.name !== "string" ||
    p.name.length > 100
  )
    throw new Error("Choose a Solar4U metre-based plan export");
  validateSettings(p.settings);
  p.location ??= { latitude: 40, longitude: -75 };
  if (
    !Number.isFinite(p.location.latitude) ||
    Math.abs(p.location.latitude) > 66 ||
    !Number.isFinite(p.location.longitude) ||
    Math.abs(p.location.longitude) > 180
  )
    throw new Error(
      "Location must use a latitude from -66 to 66 and longitude from -180 to 180",
    );
  if (
    !Array.isArray(p.surfaces) ||
    p.surfaces.length < 1 ||
    p.surfaces.length > 8 ||
    !Array.isArray(p.panels) ||
    p.panels.length > 1200
  )
    throw new Error("Invalid surface or panel collection");
  const expected = makeSurfaces(p.settings);
  if (p.surfaces.length !== expected.length)
    throw new Error("Unexpected surface count");
  const ids = new Set<string>();
  for (const s of p.surfaces) {
    if (
      typeof s.id !== "string" ||
      s.id.length > 80 ||
      ids.has(s.id) ||
      typeof s.label !== "string" ||
      s.label.length > 100 ||
      !["roof", "ground"].includes(s.kind) ||
      typeof s.enabled !== "boolean"
    )
      throw new Error("Invalid surface");
    ids.add(s.id);
    const base = expected.find((e) => e.id === s.id);
    if (
      !base ||
      s.kind !== base.kind ||
      s.tilt !== base.tilt ||
      s.azimuth !== base.azimuth ||
      [...s.origin, ...s.u, ...s.v].some(
        (n, i) =>
          Math.abs(n - [...base.origin, ...base.u, ...base.v][i]) > 1e-6,
      )
    )
      throw new Error(
        "Surface plane does not match its measured property settings",
      );
    validateRegion(s);
    if (
      s.outer.some(
        ([x, y]) =>
          x < 0 ||
          y < 0 ||
          x > Math.max(...base.outer.map((v) => v[0])) + 1e-6 ||
          y > Math.max(...base.outer.map((v) => v[1])) + 1e-6,
      )
    )
      throw new Error("Custom boundary extends outside the measured surface");
    for (const v of [s.origin, s.u, s.v])
      if (
        !Array.isArray(v) ||
        v.length !== 3 ||
        v.some((n) => !Number.isFinite(n) || Math.abs(n) > 500)
      )
        throw new Error("Invalid surface transform");
    if (
      Math.abs(Math.hypot(...s.u) - 1) > 0.001 ||
      Math.abs(Math.hypot(...s.v) - 1) > 0.001 ||
      Math.abs(s.u.reduce((n, x, i) => n + x * s.v[i], 0)) > 0.001
    )
      throw new Error("Surface axes must be orthonormal");
    if (
      !Number.isFinite(s.tilt) ||
      s.tilt < 0 ||
      s.tilt > 60 ||
      !Number.isFinite(s.azimuth)
    )
      throw new Error("Invalid roof plane");
  }
  const panelIds = new Set<string>();
  for (const panel of p.panels) {
    if (
      typeof panel.id !== "string" ||
      panel.id.length > 100 ||
      panelIds.has(panel.id) ||
      !ids.has(panel.surfaceId) ||
      ![
        panel.x,
        panel.y,
        panel.width,
        panel.depth,
        panel.slopeLength,
        panel.tilt,
        panel.watts,
      ].every(Number.isFinite) ||
      panel.width < 0.3 ||
      panel.depth < 0.2 ||
      panel.slopeLength < 0.3 ||
      panel.tilt < 0 ||
      panel.tilt > 60 ||
      panel.watts < 1 ||
      panel.watts > 1000 ||
      !["portrait", "landscape"].includes(panel.orientation)
    )
      throw new Error("Invalid panel geometry");
    panelIds.add(panel.id);
    const sf = p.surfaces.find((s) => s.id === panel.surfaceId)!;
    const width =
        panel.orientation === "portrait"
          ? p.settings.moduleWidth
          : p.settings.moduleLength,
      length =
        panel.orientation === "portrait"
          ? p.settings.moduleLength
          : p.settings.moduleWidth,
      depth =
        sf.kind === "ground" ? length * Math.cos(radians(sf.tilt)) : length;
    if (
      Math.abs(width - panel.width) > 1e-6 ||
      Math.abs(length - panel.slopeLength) > 1e-6 ||
      Math.abs(depth - panel.depth) > 1e-6 ||
      panel.tilt !== sf.tilt ||
      panel.watts !== p.settings.moduleWatts
    )
      throw new Error(
        "Panel dimensions do not match the configured module and plane",
      );
    if (!canPlace(p, panel))
      throw new Error(
        "A panel overlaps another panel, an exclusion, or a required clearance",
      );
  }
  return p;
}
