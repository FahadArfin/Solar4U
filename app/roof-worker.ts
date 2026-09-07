import { fromArrayBuffer, type GeoTIFFImage } from "geotiff";
import { toProj4 } from "geotiff-geokeys-to-proj4";
import proj4 from "proj4";
import {
  buildRoofMesh,
  inversePixel,
  projectPixel,
  type Affine,
} from "../lib/roof-geometry";
import type { RoofBuilding } from "../lib/roof-types";
function affine(image: GeoTIFFImage): Affine {
  const m = image.fileDirectory.getValue("ModelTransformation");
  if (m) return [m[0], m[1], m[3], m[4], m[5], m[7]];
  const o = image.getOrigin(),
    r = image.getResolution();
  return [r[0], 0, o[0], 0, r[1], o[1]];
}
async function layer(url: string) {
  const r = await fetch(url);
  if (!r.ok) {
    const j = await r.json();
    throw new Error(j.error ?? "Imagery download failed");
  }
  const t = await fromArrayBuffer(await r.arrayBuffer());
  const image = await t.getImage();
  if (image.getWidth() * image.getHeight() > 1_500_000)
    throw new Error("Imagery exceeds the supported resolution");
  return image;
}
self.onmessage = async (
  event: MessageEvent<{
    building: RoofBuilding;
    urls: { dsm: string; mask: string; rgb: string };
  }>,
) => {
  try {
    const { building, urls } = event.data;
    const metadataUrl = new URL(urls.dsm);
    metadataUrl.searchParams.set("op", "metadata");
    metadataUrl.searchParams.delete("layer");
    const [dsm, mask, metadata] = await Promise.all([
      layer(urls.dsm),
      layer(urls.mask),
      fetch(metadataUrl).then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Imagery metadata unavailable");
        return j;
      }),
    ]);
    const a = affine(dsm),
      ma = affine(mask);
    if (
      dsm.getWidth() !== mask.getWidth() ||
      dsm.getHeight() !== mask.getHeight() ||
      JSON.stringify(dsm.getGeoKeys()) !== JSON.stringify(mask.getGeoKeys()) ||
      a.some((n, i) => Math.abs(n - ma[i]) > 1e-8) ||
      dsm.pixelIsArea() !== mask.pixelIsArea()
    )
      throw new Error(
        "The roof mask and elevation raster have incompatible coordinate systems",
      );
    const crs = toProj4(dsm.getGeoKeys() ?? {});
    if (Object.keys(crs.errors).length)
      throw new Error(
        "The imagery coordinate system could not be fully resolved",
      );
    const projection = proj4(crs.proj4, "EPSG:4326"),
      offset = dsm.pixelIsArea() ? 0.5 : 0;
    const pixelToLatLng = (x: number, y: number) => {
      const xy = projectPixel(a, x + offset, y + offset),
        c = crs.convertCoordinates({ x: xy[0], y: xy[1] }),
        ll = projection.forward([c.x, c.y]);
      return { latitude: ll[1], longitude: ll[0] };
    };
    const seeds = building.solarPotential.solarPanels.map((p) => {
      const xy = projection.inverse([p.center.longitude, p.center.latitude]),
        px = inversePixel(
          a,
          xy[0] / crs.conversionParameters.x,
          xy[1] / crs.conversionParameters.y,
        );
      const sample = dsm.pixelIsArea() ? Math.floor : Math.round;
      return [sample(px[0]), sample(px[1])] as [number, number];
    });
    const [heights, maskValues] = await Promise.all([
      dsm.readRasters({ samples: [0], interleave: true }),
      mask.readRasters({ samples: [0], interleave: true }),
    ]);
    const mesh = buildRoofMesh({
      width: dsm.getWidth(),
      height: dsm.getHeight(),
      mask: maskValues,
      heights,
      noData: dsm.getGDALNoData() ?? -9999,
      seeds,
      pixelToLatLng,
      building,
      resolutionMeters:
        Math.hypot(a[0], a[3]) * Math.abs(crs.conversionParameters.x),
    });
    mesh.imageryDate = metadata.imageryDate;
    mesh.imageryQuality = metadata.imageryQuality;
    if (
      JSON.stringify(metadata.imageryDate) !==
      JSON.stringify(building.imageryDate)
    )
      mesh.warnings.push(
        "The roof elevation imagery and proposed-panel analysis have different acquisition dates. Review any differences before using the overlay.",
      );
    let texture: ImageBitmap | undefined;
    try {
      const rgb = await layer(urls.rgb);
      if (
        rgb.getWidth() !== dsm.getWidth() ||
        rgb.getHeight() !== dsm.getHeight() ||
        JSON.stringify(rgb.getGeoKeys()) !== JSON.stringify(dsm.getGeoKeys()) ||
        rgb.pixelIsArea() !== dsm.pixelIsArea() ||
        affine(rgb).some((n, i) => Math.abs(n - a[i]) > 1e-8)
      )
        throw new Error("Colour imagery uses a different grid");
      const raster = await rgb.readRGB({ interleave: true }),
        rgba = new Uint8ClampedArray(rgb.getWidth() * rgb.getHeight() * 4);
      for (let i = 0; i < rgba.length / 4; i++) {
        rgba[i * 4] = raster[i * 3];
        rgba[i * 4 + 1] = raster[i * 3 + 1];
        rgba[i * 4 + 2] = raster[i * 3 + 2];
        rgba[i * 4 + 3] = 255;
      }
      texture = await createImageBitmap(
        new ImageData(rgba, rgb.getWidth(), rgb.getHeight()),
      );
    } catch {
      mesh.warnings.push(
        "Aerial colour imagery is unavailable; the measured roof is shown in a neutral material.",
      );
    }
    self.postMessage(
      { mesh, texture },
      {
        transfer: [
          mesh.positions.buffer,
          mesh.indices.buffer,
          mesh.uvs.buffer,
          ...(texture ? [texture] : []),
        ],
      },
    );
  } catch (e) {
    self.postMessage({
      error: e instanceof Error ? e.message : "Roof reconstruction failed",
    });
  }
};
