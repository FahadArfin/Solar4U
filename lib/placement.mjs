// Geometry in metres. Full rectangle containment with Euclidean boundary clearances.
const EPS = 1e-8;
const cross = (a, b, c) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const edges = (ring) => ring.map((a, i) => [a, ring[(i + 1) % ring.length]]);

function pointSegmentDistance(p, a, b) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const length2 = dx * dx + dy * dy;
  if (!length2) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(
    0,
    Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length2),
  );
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

// Returns -1 outside, 0 on the boundary, 1 strictly inside.
function classifyRing(p, ring) {
  let inside = false;
  for (const [a, b] of edges(ring)) {
    if (pointSegmentDistance(p, a, b) <= EPS) return 0;
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside ? 1 : -1;
}

function inRegion(p, region) {
  return (
    classifyRing(p, region.outer) >= 0 &&
    region.holes.every((h) => classifyRing(p, h) <= 0)
  );
}

function rectangleFrame(rect) {
  if (
    ![...rect.centre, rect.widthM, rect.depthM, rect.rotationDegrees].every(
      Number.isFinite,
    ) ||
    rect.widthM <= EPS ||
    rect.depthM <= EPS
  )
    throw new Error("Invalid rectangle");
  const theta = (rect.rotationDegrees * Math.PI) / 180;
  const c = Math.cos(theta),
    s = Math.sin(theta);
  const hx = rect.widthM / 2,
    hy = rect.depthM / 2;
  const world = ([x, y]) => [
    rect.centre[0] + c * x - s * y,
    rect.centre[1] + s * x + c * y,
  ];
  const local = (p) => {
    const x = p[0] - rect.centre[0],
      y = p[1] - rect.centre[1];
    return [c * x + s * y, -s * x + c * y];
  };
  return {
    hx,
    hy,
    local,
    corners: [
      [-hx, -hy],
      [hx, -hy],
      [hx, hy],
      [-hx, hy],
    ].map(world),
  };
}

// Slab clip a finite segment to the rectangle, then check the clipped open
// interval. Boundary-only tangencies and collinear edge contact are allowed.
function segmentEntersOpenRectangle(a, b, frame) {
  const p = frame.local(a),
    q = frame.local(b);
  let enter = 0,
    leave = 1;
  for (let axis = 0; axis < 2; axis++) {
    const h = axis ? frame.hy : frame.hx;
    const d = q[axis] - p[axis];
    if (Math.abs(d) <= EPS) {
      if (p[axis] < -h - EPS || p[axis] > h + EPS) return false;
    } else {
      let lo = (-h - p[axis]) / d,
        hi = (h - p[axis]) / d;
      if (lo > hi) [lo, hi] = [hi, lo];
      enter = Math.max(enter, lo);
      leave = Math.min(leave, hi);
      if (enter > leave) return false;
    }
  }
  const t = (enter + leave) / 2;
  const x = p[0] + t * (q[0] - p[0]),
    y = p[1] + t * (q[1] - p[1]);
  return Math.abs(x) < frame.hx - EPS && Math.abs(y) < frame.hy - EPS;
}

function segmentDistance(a, b, c, d) {
  const o1 = cross(a, b, c),
    o2 = cross(a, b, d),
    o3 = cross(c, d, a),
    o4 = cross(c, d, b);
  if (
    ((o1 < 0 && o2 > 0) || (o1 > 0 && o2 < 0)) &&
    ((o3 < 0 && o4 > 0) || (o3 > 0 && o4 < 0))
  )
    return 0;
  return Math.min(
    pointSegmentDistance(a, c, d),
    pointSegmentDistance(b, c, d),
    pointSegmentDistance(c, a, b),
    pointSegmentDistance(d, a, b),
  );
}

function distanceToRing(corners, ring) {
  let minimum = Infinity;
  for (const [a, b] of edges(corners))
    for (const [c, d] of edges(ring))
      minimum = Math.min(minimum, segmentDistance(a, b, c, d));
  return minimum;
}

export function testPlacement(region, rect, options = {}) {
  const {
    edgeSetbackM = 0,
    holeClearanceM = 0,
    boundaryTouchAllowed = true,
  } = options;
  if (
    ![edgeSetbackM, holeClearanceM].every((n) => Number.isFinite(n) && n >= 0)
  )
    throw new Error("Invalid clearance");
  const frame = rectangleFrame(rect);
  const allCornersInRegion = frame.corners.every((p) => inRegion(p, region));
  const centreInRegion = inRegion(rect.centre, region);
  const boundaryEntersInterior = [region.outer, ...region.holes].some((ring) =>
    edges(ring).some(([a, b]) => segmentEntersOpenRectangle(a, b, frame)),
  );
  const minOuterDistanceM = distanceToRing(frame.corners, region.outer);
  const minHoleDistanceM = region.holes.length
    ? Math.min(...region.holes.map((h) => distanceToRing(frame.corners, h)))
    : null;
  const minCornerToOuterBoundaryM = Math.min(
    ...frame.corners.flatMap((p) =>
      edges(region.outer).map(([a, b]) => pointSegmentDistance(p, a, b)),
    ),
  );
  const clearancePass =
    minOuterDistanceM + EPS >= edgeSetbackM &&
    (minHoleDistanceM === null || minHoleDistanceM + EPS >= holeClearanceM);
  const touchPass =
    boundaryTouchAllowed ||
    (minOuterDistanceM > EPS &&
      (minHoleDistanceM === null || minHoleDistanceM > EPS));
  return {
    valid:
      allCornersInRegion &&
      centreInRegion &&
      !boundaryEntersInterior &&
      clearancePass &&
      touchPass,
    allCornersInRegion,
    centreInRegion,
    boundaryEntersInterior,
    minOuterDistanceM,
    minHoleDistanceM,
    minCornerToOuterBoundaryM,
  };
}

export function validateRegion(region) {
  if (
    !region ||
    !Array.isArray(region.outer) ||
    !Array.isArray(region.holes) ||
    region.holes.length > 16
  )
    throw new Error("A boundary and at most 16 exclusion zones are required");
  const rings = [region.outer, ...region.holes];
  for (const ring of rings) {
    if (
      !Array.isArray(ring) ||
      ring.length < 3 ||
      ring.length > 64 ||
      ring.some(
        (p) =>
          !Array.isArray(p) ||
          p.length !== 2 ||
          p.some((n) => !Number.isFinite(n) || Math.abs(n) > 100),
      )
    )
      throw new Error(
        "Use 3–64 finite metre coordinates per boundary, within 100 m",
      );
    if (
      Math.abs(
        ring.reduce((s, a, i) => {
          const b = ring[(i + 1) % ring.length];
          return s + a[0] * b[1] - b[0] * a[1];
        }, 0),
      ) < 0.01
    )
      throw new Error("Boundary must enclose a positive area");
    const e = edges(ring);
    for (let i = 0; i < e.length; i++) {
      if (pointSegmentDistance(e[i][0], e[i][1], e[i][1]) < EPS)
        throw new Error("Duplicate boundary vertices");
      for (let j = i + 1; j < e.length; j++) {
        if (j === i + 1 || (i === 0 && j === e.length - 1)) continue;
        if (segmentDistance(...e[i], ...e[j]) < EPS)
          throw new Error("Boundary edges must not cross or touch themselves");
      }
    }
  }
  for (let i = 1; i < rings.length; i++) {
    if (rings[i].some((p) => classifyRing(p, region.outer) !== 1))
      throw new Error("Exclusions must be completely inside the boundary");
    for (let j = 0; j < i; j++) {
      if (
        edges(rings[i]).some((e) =>
          edges(rings[j]).some((f) => segmentDistance(...e, ...f) < EPS),
        )
      )
        throw new Error("Boundaries and exclusions must not cross or touch");
      if (
        j > 0 &&
        (classifyRing(rings[i][0], rings[j]) >= 0 ||
          classifyRing(rings[j][0], rings[i]) >= 0)
      )
        throw new Error("Exclusion zones must not overlap");
    }
  }
  return true;
}
export function packRegion(
  region,
  { width, depth, gapX, gapY, setback, clearance, limit = 400 },
) {
  validateRegion(region);
  if (
    ![width, depth, gapX, gapY, setback, clearance].every(Number.isFinite) ||
    width < 0.3 ||
    depth < 0.2 ||
    gapX < 0 ||
    gapY < 0 ||
    setback < 0 ||
    clearance < 0
  )
    throw new Error("Invalid module size or spacing");
  const xs = region.outer.map((p) => p[0]),
    ys = region.outer.map((p) => p[1]);
  const minX = Math.min(...xs) + setback,
    minY = Math.min(...ys) + setback,
    maxX = Math.max(...xs) - setback,
    maxY = Math.max(...ys) - setback;
  if (((maxX - minX) * (maxY - minY)) / (width * depth) > 20000)
    throw new Error("Boundary is too large for this interactive layout");
  const columns = Math.max(
      0,
      Math.floor((maxX - minX + gapX + EPS) / (width + gapX)),
    ),
    rows = Math.max(0, Math.floor((maxY - minY + gapY + EPS) / (depth + gapY)));
  const spareX = Math.max(
      0,
      maxX - minX - (columns * width + Math.max(0, columns - 1) * gapX),
    ),
    spareY = Math.max(
      0,
      maxY - minY - (rows * depth + Math.max(0, rows - 1) * gapY),
    );
  let best = [];
  let attempts = 0;
  for (const offsetX of [...new Set([0, Math.round((spareX / 2) * 1e8) / 1e8])])
    for (const offsetY of [
      ...new Set([0, Math.round((spareY / 2) * 1e8) / 1e8]),
    ]) {
      const accepted = [];
      outer: for (let row = 0; row < rows; row++)
        for (let col = 0; col < columns; col++) {
          if (++attempts > 15000) break outer;
          const x = minX + offsetX + col * (width + gapX),
            y = minY + offsetY + row * (depth + gapY);
          if (
            testPlacement(
              region,
              {
                centre: [x + width / 2, y + depth / 2],
                widthM: width,
                depthM: depth,
                rotationDegrees: 0,
              },
              { edgeSetbackM: setback, holeClearanceM: clearance },
            ).valid
          )
            accepted.push({ x, y, width, depth });
          if (accepted.length >= Math.min(limit, 400)) break outer;
        }
      if (accepted.length > best.length) best = accepted;
    }
  return best;
}
