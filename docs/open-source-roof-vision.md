# Open-source roof geometry options

Solar4U currently receives pitch, azimuth, panel placement centers, imagery, DSM and solar layers from Google Solar Building Insights. The displayed automatic shapes are planning envelopes around Google's recommended panel centers, not surveyed roof boundaries.

## Shortlist

### SamGeo / segment-geospatial

- Repository: https://github.com/opengeos/segment-geospatial
- License: MIT.
- Best fit: user-assisted extraction of a building or roof outline from a permitted orthophoto. A foreground click, background clicks, or a box prompt can produce a raster mask and GeoJSON polygon.
- Limitation: RGB segmentation identifies visible regions but does not reliably determine roof pitch or distinguish every coplanar roof facet.

### SAT2LOD2

- Repository: https://github.com/GDAOSU/LOD2BuildingModel
- Best fit: automatic LoD2 building and roof-plane reconstruction when both a high-resolution orthophoto and a co-registered DSM are available.
- Limitation: substantially heavier than a browser calculation; it is designed as a Python/CUDA geospatial pipeline and requires licensed input data.

### Microsoft GlobalML Building Footprints

- Repository: https://github.com/microsoft/GlobalMLBuildingFootprints
- License/data terms: CDLA Permissive 2.0 for the released footprints.
- Best fit: isolating the correct building footprint before roof analysis and rejecting neighboring structures.
- Limitation: a footprint is the building outline at ground level, not individual roof planes or pitch.

### Plane Seg

- Repository: https://github.com/ori-drs/plane_seg
- License: BSD 3-Clause.
- Best fit: fitting planar convex hulls to lidar, depth or elevation-map samples.
- Limitation: older C++/ROS-oriented tooling; it needs an elevation surface rather than a normal RGB screenshot.

## Recommended Solar4U pipeline

1. Start with a provider-permitted orthophoto or an owner-supplied drone image. Do not repurpose Google imagery as machine-learning training or inference input unless its applicable license expressly permits it.
2. Fetch an existing Microsoft/local-government building footprint when available to isolate the selected building.
3. Run SamGeo in an optional `roof-vision` worker to produce an editable candidate outline. Keep user point/box prompts so a wrong mask can be corrected immediately.
4. When a lidar/DSM surface is available, fit planes and ridges from height gradients. SAT2LOD2 is the strongest complete reference pipeline; Plane Seg is useful for the lower-level plane-fitting stage.
5. Regularize the candidate polygons, preserve confidence and provenance, and require a review step before panel fitting.
6. Keep Google pitch/azimuth and solar-flux data as independent evidence rather than pretending RGB segmentation measured those values.

## Implemented local service

Solar4U now includes `services/roof-vision`, a separately containerized FastAPI service on port `4005`.

- The default `local` image uses a user box/point prompt plus OpenCV GrabCut. It is deliberately assistive rather than advertised as automatic roof detection.
- GeoTIFF inputs preserve their CRS and return a WGS84 GeoJSON candidate that the planner can align to its current property frame.
- PNG/JPEG candidates stay image-relative and cannot be imported until the operator explicitly confirms the image is north-up and aligned to the planner frame.
- The DSM endpoint performs repeatable RANSAC plane fitting and returns pitch, downslope azimuth, RMSE, sample count, confidence and editable plane polygons.
- Both endpoints reject requests that lack an affirmative source-permission confirmation and source/license note.
- Google Solar and Google Maps raster content is not automatically passed to this service.

API routes:

- `GET /v1/roof-vision/capabilities`
- `POST /v1/roof-vision/segment`
- `POST /v1/roof-vision/planes`

The solar-engine proxies these under `/v1/solar/roof-vision/*`, so the browser does not need direct knowledge of the internal container address.

The optional SamGeo build remains opt-in because model dependencies and checkpoints are much larger:

```powershell
$env:ROOF_VISION_TARGET="samgeo"
docker compose build roof-vision
docker compose up -d roof-vision solar-engine
```

Use a CUDA-capable environment for practical SamGeo inference and provide `SAMGEO_CHECKPOINT` when the model is not managed by the installed package. The normal local stack continues to work without a GPU.
