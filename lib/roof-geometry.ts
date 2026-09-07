import {
  localMetres,
  type LatLng,
  type RoofBuilding,
  type RoofMesh,
} from "./roof-types.ts";
export type Affine = [number, number, number, number, number, number];
export function projectPixel(
  a: Affine,
  x: number,
  y: number,
): [number, number] {
  return [a[0] * x + a[1] * y + a[2], a[3] * x + a[4] * y + a[5]];
}
export function inversePixel(
  a: Affine,
  x: number,
  y: number,
): [number, number] {
  const d = a[0] * a[4] - a[1] * a[3];
  if (!Number.isFinite(d) || Math.abs(d) < 1e-12)
    throw new Error("Raster transform is singular");
  return [
    ((x - a[2]) * a[4] - (y - a[5]) * a[1]) / d,
    ((y - a[5]) * a[0] - (x - a[2]) * a[3]) / d,
  ];
}
export function selectRoofPixels(
  valid: Uint8Array,
  width: number,
  height: number,
  seeds: [number, number][],
) {
  const selected = new Uint8Array(valid.length),
    queue = new Int32Array(valid.length);
  let start = 0,
    end = 0;
  for (const [x, y] of seeds) {
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    const i = y * width + x;
    if (valid[i] && !selected[i]) {
      selected[i] = 1;
      queue[end++] = i;
    }
  }
  while (start < end) {
    const i = queue[start++],
      x = i % width,
      y = Math.floor(i / width);
    for (const j of [
      x > 0 ? i - 1 : -1,
      x < width - 1 ? i + 1 : -1,
      y > 0 ? i - width : -1,
      y < height - 1 ? i + width : -1,
    ])
      if (j >= 0 && valid[j] && !selected[j]) {
        selected[j] = 1;
        queue[end++] = j;
      }
  }
  return { selected, count: end };
}
export function buildRoofMesh(input: {
  width: number;
  height: number;
  mask: ArrayLike<number>;
  heights: ArrayLike<number>;
  noData: number;
  seeds: [number, number][];
  pixelToLatLng: (x: number, y: number) => LatLng;
  building: RoofBuilding;
  resolutionMeters: number;
}): RoofMesh {
  const {
    width: w,
    height: h,
    mask,
    heights,
    building: b,
    pixelToLatLng,
  } = input;
  if (
    w < 2 ||
    h < 2 ||
    w * h > 1_500_000 ||
    mask.length !== w * h ||
    heights.length !== w * h
  )
    throw new Error("Unsupported or mismatched raster dimensions");
  const valid = new Uint8Array(w * h),
    box = b.boundingBox;
  // The provider's bounding box restricts flood fill to the matched building.
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x,
        z = Number(heights[i]);
      if (!mask[i] || !Number.isFinite(z) || z === input.noData || z === -9999)
        continue;
      const ll = pixelToLatLng(x, y);
      if (
        ll.latitude >= box.sw.latitude &&
        ll.latitude <= box.ne.latitude &&
        ll.longitude >= box.sw.longitude &&
        ll.longitude <= box.ne.longitude
      )
        valid[i] = 1;
    }
  const { selected, count } = selectRoofPixels(valid, w, h, input.seeds);
  if (count < 16)
    throw new Error(
      "The proposed panels do not match a usable roof-mask component. Check the selected building.",
    );
  let reference = Infinity;
  for (let i = 0; i < selected.length; i++)
    if (selected[i]) reference = Math.min(reference, Number(heights[i]));
  const step = Math.max(1, Math.ceil(Math.max(w, h) / 230)),
    positions: number[] = [],
    uvs: number[] = [],
    indices: number[] = [],
    vertices = new Map<number, number>();
  let extent = 0;
  function vertex(x: number, y: number) {
    const id = y * w + x,
      old = vertices.get(id);
    if (old !== undefined) return old;
    const ll = pixelToLatLng(x, y),
      [east, north] = localMetres(ll, b.center);
    extent = Math.max(extent, Math.hypot(east, north));
    const index = positions.length / 3;
    positions.push(east, Number(heights[id]) - reference, north);
    uvs.push((x + 0.5) / w, 1 - (y + 0.5) / h);
    vertices.set(id, index);
    return index;
  }
  for (let y = 0; y + step < h; y += step)
    for (let x = 0; x + step < w; x += step) {
      let full = true;
      for (let yy = y; yy <= y + step && full; yy++)
        for (let xx = x; xx <= x + step; xx++)
          if (!selected[yy * w + xx]) {
            full = false;
            break;
          }
      if (!full) continue;
      const a = vertex(x, y),
        c = vertex(x + step, y + step),
        d = vertex(x, y + step),
        e = vertex(x + step, y);
      indices.push(a, c, e, a, d, c);
    }
  if (!indices.length)
    throw new Error(
      "The roof is too fragmented for a reliable surface mesh at this resolution",
    );
  return {
    positions: new Float32Array(positions),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
    referenceHeight: reference,
    selectedPixels: count,
    resolutionMeters: input.resolutionMeters * step,
    boundsMeters: extent,
    warnings: [
      "Only the matched roof mask is reconstructed. Walls, ground elevations and hidden roof details are not inferred.",
    ],
  };
}
export function providerPanelCorners(
  building: RoofBuilding,
  index: number,
  referenceHeight: number,
): number[][] {
  const p = building.solarPotential,
    panel = p.solarPanels[index],
    s = p.roofSegmentStats[panel.segmentIndex];
  if (
    !s ||
    ![
      s.pitchDegrees,
      s.azimuthDegrees,
      s.planeHeightAtCenterMeters,
      p.panelWidthMeters,
      p.panelHeightMeters,
    ].every(Number.isFinite) ||
    p.panelWidthMeters <= 0 ||
    p.panelHeightMeters <= 0
  )
    throw new Error("Incomplete provider panel plane or dimensions");
  const [east, north] = localMetres(panel.center, building.center),
    [de, dn] = localMetres(panel.center, s.center),
    A = (s.azimuthDegrees * Math.PI) / 180,
    B = (s.pitchDegrees * Math.PI) / 180;
  const z =
    s.planeHeightAtCenterMeters -
    Math.tan(B) * (de * Math.sin(A) + dn * Math.cos(A)) -
    referenceHeight;
  const u = [Math.cos(A), 0, -Math.sin(A)],
    v = [-Math.sin(A) * Math.cos(B), Math.sin(B), -Math.cos(A) * Math.cos(B)],
    normal = [
      Math.sin(A) * Math.sin(B),
      Math.cos(B),
      Math.cos(A) * Math.sin(B),
    ];
  const width =
      panel.orientation === "PORTRAIT"
        ? p.panelWidthMeters
        : p.panelHeightMeters,
    depth =
      panel.orientation === "PORTRAIT"
        ? p.panelHeightMeters
        : p.panelWidthMeters;
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([x, y]) =>
    [east, z, north].map(
      (n, i) =>
        n +
        ((x * width) / 2) * u[i] +
        ((y * depth) / 2) * v[i] +
        normal[i] * 0.12,
    ),
  );
}
