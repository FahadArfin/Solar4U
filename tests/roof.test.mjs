import test from "node:test";
import assert from "node:assert/strict";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData.js";
import {
  buildRoofMesh,
  projectPixel,
  inversePixel,
  selectRoofPixels,
  providerPanelCorners,
} from "../lib/roof-geometry.ts";
import { localMetres } from "../lib/roof-types.ts";
function building() {
  return {
    center: { latitude: 0, longitude: 0 },
    boundingBox: {
      sw: { latitude: -0.001, longitude: -0.001 },
      ne: { latitude: 0.001, longitude: 0.001 },
    },
    solarPotential: {
      panelWidthMeters: 1.04,
      panelHeightMeters: 1.88,
      panelCapacityWatts: 400,
      roofSegmentStats: [
        {
          center: { latitude: 0, longitude: 0 },
          pitchDegrees: 30,
          azimuthDegrees: 180,
          planeHeightAtCenterMeters: 10,
        },
      ],
      solarPanels: [
        {
          center: { latitude: 0, longitude: 0 },
          orientation: "PORTRAIT",
          segmentIndex: 0,
          yearlyEnergyDcKwh: 600,
        },
      ],
    },
  };
}
test("WGS84 metre frame preserves meridional distances at the equator", () => {
  const degrees =
    ((100 / (6378137 * (1 - 6.6943799901413165e-3))) * 180) / Math.PI;
  const [east, north] = localMetres(
    { latitude: degrees, longitude: 0 },
    { latitude: 0, longitude: 0 },
  );
  assert.ok(Math.abs(east) < 1e-9);
  assert.ok(Math.abs(north - 100) < 1e-6);
});
test("rotated and skewed raster transform inverts exactly", () => {
  const a = [0.23, 0.07, 550000, 0.04, -0.24, 4200000];
  const point = projectPixel(a, 7.8, 4.6),
    back = inversePixel(a, ...point);
  assert.ok(Math.abs(back[0] - 7.8) < 1e-7);
  assert.ok(Math.abs(back[1] - 4.6) < 1e-7);
  assert.throws(() => inversePixel([1, 1, 0, 1, 1, 0], 3, 4));
});
test("roof flood selection excludes adjacent disconnected structures and preserves holes", () => {
  const valid = new Uint8Array(100);
  for (let y = 1; y < 9; y++) for (let x = 1; x < 5; x++) valid[y * 10 + x] = 1;
  for (let y = 1; y < 9; y++) for (let x = 7; x < 9; x++) valid[y * 10 + x] = 1;
  valid[43] = 0;
  const { selected, count } = selectRoofPixels(valid, 10, 10, [[2, 2]]);
  assert.equal(count, 31);
  assert.equal(selected[43], 0);
  assert.equal(selected[77], 0);
});
test("mesh triangles preserve missing pixels and face up under Babylon conventions", () => {
  const mask = new Uint8Array(100).fill(1);
  mask[44] = 0;
  const mesh = buildRoofMesh({
    width: 10,
    height: 10,
    mask,
    heights: new Float32Array(100).fill(5),
    noData: -9999,
    seeds: [[0, 0]],
    pixelToLatLng: (x, y) => ({
      longitude: x * 0.00001,
      latitude: -y * 0.00001,
    }),
    building: building(),
    resolutionMeters: 1,
  });
  assert.equal(mesh.selectedPixels, 99);
  assert.equal(mesh.indices.length, (81 - 4) * 6);
  const normals = [];
  VertexData.ComputeNormals(mesh.positions, mesh.indices, normals);
  assert.ok(normals.every((v, i) => i % 3 !== 1 || v > 0.999));
  for (let i = 0; i < mesh.uvs.length; i += 2)
    assert.ok(
      mesh.uvs[i] >= 0 &&
        mesh.uvs[i] <= 1 &&
        mesh.uvs[i + 1] >= 0 &&
        mesh.uvs[i + 1] <= 1,
    );
});
test("provider portrait and landscape dimensions remain actual metres on tilted planes", () => {
  const b = building();
  for (const orientation of ["PORTRAIT", "LANDSCAPE"]) {
    b.solarPotential.solarPanels[0].orientation = orientation;
    const p = providerPanelCorners(b, 0, 5),
      distance = (a, c) => Math.hypot(...a.map((v, i) => v - c[i]));
    assert.ok(
      Math.abs(
        distance(p[0], p[1]) - (orientation === "PORTRAIT" ? 1.04 : 1.88),
      ) < 1e-9,
    );
    assert.ok(
      Math.abs(
        distance(p[0], p[3]) - (orientation === "PORTRAIT" ? 1.88 : 1.04),
      ) < 1e-9,
    );
    const normals = [];
    VertexData.ComputeNormals(p.flat(), [0, 2, 1, 0, 3, 2], normals);
    assert.ok(normals[1] > 0.86);
  }
});
