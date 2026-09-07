# Solar geospatial pipeline

The roof planner separates address selection, analytical geometry, solar/shade data, and 3D visualization. A convincing aerial picture is not evidence that the selected building or roof planes are correct.

## 1. Address to building

1. Geocode the complete address and retain the provider precision, result types, viewport, coordinates, and partial-match flag.
2. Show the user the selected point on a map before requesting solar analysis.
3. Ask Google Solar `buildingInsights:findClosest` for the confirmed point.
4. Compare the returned building center with the confirmed point. The UI stops when they differ by more than 45 m instead of silently showing a nearby building.
5. Use the Solar building center, rather than the original geocoder point, to request imagery and analytical layers.

`ROOFTOP` geocodes are preferred. Interpolated and approximate results remain visible but are labelled and require confirmation.

## 2. First-party live analysis

Google Solar is the primary licensed live path:

- Building Insights supplies roof-segment pitch, azimuth, center/bounds, panel layouts, and production summaries.
- Data Layers supplies RGB imagery, a digital surface model (DSM), a building mask, annual/monthly solar flux, and hourly shade.
- The UI groups Google-recommended panel centers by `segmentIndex`, builds a padded convex envelope for each detected plane, and keeps those polygons in the same geographic data-layer frame. Provider bounding boxes are used only when a segment has no panel-placement points.
- The RGB and flux/shade GeoTIFFs are requested by the server so provider keys are not exposed to the browser.
- Solar4U requests the provider's 0.1 m data-layer pixel size inside a 30 m radius (60 m diameter) property frame. The tighter frame avoids enlarging a coarse neighborhood crop, while the returned imagery remains limited by the native quality available for that building.

These panel-placement envelopes are better than axis-aligned boxes but are still not survey boundaries. Users can draw replacement/additional polygons and override pitch or azimuth; exact plane boundaries require a provider polygon product or the DSM segmentation pipeline below.

## 3. Higher-accuracy roof polygons

For open/licensed lidar or an owner-provided drone survey:

1. Align the DSM or point cloud with a building footprint and remove ground and vegetation where classification is available.
2. Estimate surface normals and identify planar candidates.
3. Fit planes with a robust method such as RANSAC, cluster connected coplanar points, and split at ridges, hips, and valleys.
4. Clip plane boundaries to the building mask or footprint and simplify only within a known positional tolerance.
5. Derive pitch and azimuth from the fitted plane normal.
6. Detect setbacks and obstacles separately; never infer a usable panel rectangle from a roof bounding box alone.
7. Store source, resolution, acquisition date, coordinate reference system, algorithm version, residual error, and confidence with every segment.

Every automatically extracted roof needs an editable review step before panel placement.

## 4. Shade and solar exposure

For Google-covered buildings, use the Solar hourly-shade and flux layers because they are aligned with the provider DSM.

For licensed or open DSMs, a GRASS GIS worker can use:

- `r.horizon` to precompute horizon obstruction by direction;
- `r.sun` for direct, diffuse, reflected, and global irradiation;
- `r.sunmask` for an instantaneous sun/shadow check.

Inputs must include the DSM, geographic location and CRS, timestamp and time zone, atmospheric assumptions, roof orientation, and obstacle geometry. Results are planning estimates, not survey-grade structural or electrical measurements.

## 5. Owner-provided photogrammetry

OpenDroneMap can produce an orthophoto, DSM, and point cloud from a lawful owner-supplied survey. Ground control and sufficient image overlap materially affect accuracy. Roof planes and measurements must be checked in 3D; an apparently correct 2D point can lie on the ground or vegetation.

## 6. Google 3D imagery boundary

Photorealistic 3D Tiles are displayed with Cesium as an orbitable contextual visualization when a billed, origin-restricted Map Tiles key is configured. The planner's date and time controls update the scene lighting and decode the Solar API hourly shade bitmask. Independent Solar roof-plane classifications are draped over the 3D tiles, while Google/Cesium attribution remains visible.

The initial camera is focused on the property and immediate neighboring context. Left-drag rotates, right-drag translates, the wheel zooms, and the home button returns to the 60 m work area. Cesium still reads the Google root tileset metadata, but detail requests are view-culled and capped by a local cache budget so the planner does not retain an unnecessary district-sized scene.

Google's Map Tiles terms prohibit extracting, tracing, or deriving geometry from the 3D tiles. Solar4U therefore does not use that imagery to calculate roof planes, pitch, shade, or panel placement. Analytical geometry comes from Google Solar data or a separately licensed, open, or owner-provided DSM. Independent roof overlays can be displayed on top of the 3D context.

## 7. Fallback behavior

- No precise geocode: remain on the address step and request user confirmation or correction.
- Solar result is for a different building: stop and show the measured offset.
- No Solar coverage or key: offer the clearly labelled fictional demo or a manual roof/ground polygon workflow.
- No usable DSM: do not manufacture roof sections from a stock image.
