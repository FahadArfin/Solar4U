export type LatLng = { latitude: number; longitude: number };
export type RoofDate = { year: number; month: number; day: number };
export type RoofBuilding = {
  name: string;
  center: LatLng;
  boundingBox: { sw: LatLng; ne: LatLng };
  postalCode?: string;
  administrativeArea?: string;
  imageryDate: RoofDate;
  imageryQuality: string;
  solarPotential: {
    panelWidthMeters: number;
    panelHeightMeters: number;
    panelCapacityWatts: number;
    roofSegmentStats: {
      center: LatLng;
      pitchDegrees: number;
      azimuthDegrees: number;
      planeHeightAtCenterMeters: number;
    }[];
    solarPanels: {
      center: LatLng;
      orientation: "PORTRAIT" | "LANDSCAPE";
      segmentIndex: number;
      yearlyEnergyDcKwh: number;
    }[];
    solarPanelConfigs: { panelsCount: number; yearlyEnergyDcKwh: number }[];
  };
  fetchedAt: string;
  expiresAt: string;
  distanceMeters: number;
};
export type RoofMesh = {
  imageryDate?: RoofDate;
  imageryQuality?: string;
  positions: Float32Array;
  indices: Uint32Array;
  uvs: Float32Array;
  referenceHeight: number;
  selectedPixels: number;
  resolutionMeters: number;
  boundsMeters: number;
  warnings: string[];
};
export function localMetres(point: LatLng, origin: LatLng): [number, number] {
  const radians = Math.PI / 180,
    e2 = 6.6943799901413165e-3;
  const ecef = (p: LatLng) => {
    const lat = p.latitude * radians,
      lon = p.longitude * radians,
      N = 6378137 / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
    return [
      N * Math.cos(lat) * Math.cos(lon),
      N * Math.cos(lat) * Math.sin(lon),
      N * (1 - e2) * Math.sin(lat),
    ];
  };
  const a = ecef(point),
    b = ecef(origin),
    d = a.map((v, i) => v - b[i]),
    lat = origin.latitude * radians,
    lon = origin.longitude * radians;
  return [
    -Math.sin(lon) * d[0] + Math.cos(lon) * d[1],
    -Math.sin(lat) * Math.cos(lon) * d[0] -
      Math.sin(lat) * Math.sin(lon) * d[1] +
      Math.cos(lat) * d[2],
  ];
}
export function roofRadius(b: RoofBuilding) {
  const sw = localMetres(b.boundingBox.sw, b.center),
    ne = localMetres(b.boundingBox.ne, b.center);
  return Math.max(
    30,
    Math.ceil(Math.max(Math.hypot(...sw), Math.hypot(...ne)) + 4),
  );
}
