# Solar4U roof, ground placement and 3D research audit

Research date: 7 September 2026. This report audits the original application snapshot, not a subsequent redesign. All application inspection was read-only. No application or Nook & Nest files were edited.

Solar4U source: `C:/Users/fahad/OneDrive/Documents/Solar4u`.

Nook & Nest source: `C:/Users/fahad/OneDrive/Documents/ChatGPT/furnishing`.

The useful existing pieces are the provider integration, independent Solar DSM pipeline and editable roof inputs. The major issue is that drawings, panel counts, production and financial results are not derived from one consistent model. A convincing aerial view currently hides substantial gaps in measurement and placement.

## Verified source findings

These findings are established by source inspection and, where stated, direct execution. They are not a claim that a specific paid Google response was obtained or a real property was surveyed during this audit.

| ID | Priority | Original source location | Finding and consequence | Required correction |
| --- | --- | --- | --- | --- |
| SOL-01 | P0 | `app/planner-page.tsx:203` | The browser hardcodes `http://localhost:4001`. Hosted visitors contact their own computer instead of the application's solar backend. | Use same-origin server routes or an explicitly configured public HTTPS service. Keep provider keys server-side. Verify from the published origin. |
| SOL-02 | P1 | `app/planner-page.tsx:350-380` | `normalizeGoogleSegments` ignores supplied panel dimensions, panel count, orientation and `yearlyEnergyDcKwh`. It calculates count from area divided by 2.05 and invents annual production with `300 + flux * 2.25`. | Preserve provider panel placements and provenance. Repack only against validated geometry using the actual chosen module dimensions. Keep DC versus AC explicit. |
| SOL-03 | P1 | `app/planner-page.tsx:363,377` | `segment.azimuthDegrees || index * 90` and `segment.pitchDegrees || 25` replace valid zero values. A flat roof becomes a 25-degree roof; north-facing segments can acquire other directions. | Validate finite numbers and use nullish defaults. Test zero separately from missing data. |
| SOL-04 | P1 | `app/planner-page.tsx:1171,1246` | Manual and image-derived polygon coordinates are percentages of a 60-metre view, but their shoelace area is named and treated as square metres. | Multiply percentage-square area by `(60/100)^2 = 0.36` for the current projected frame; divide by `cos(pitch)` for surface area. Prefer storing metres directly. |
| SOL-05 | P1 | `app/planner-page.tsx:1168` and panel-envelope helpers | A convex hull fills concave roof gaps. A hull around provider panel centres is also not a roof boundary. | Preserve ordered polygon boundaries and holes. Use a provider outline, validated DSM segmentation, or a user-confirmed boundary. |
| SOL-06 | P1 | `app/planner-page.tsx:654,965` | Displayed modules are repeated CSS-grid icons clipped by the roof shape. Capacity assumes every module is 400 W. No dimensioned placement record drives the scene. | Render actual `PanelPlacement[]` in both 2D and 3D. Sum rated watts from those modules. |
| SOL-07 | P1 | `app/planner-page.tsx:855` | GeoTIFF bounds are destructured as longitude and latitude without inspecting or transforming the file's CRS. Projected data can sample the wrong pixels, often clamped to an edge. | Read GeoKeys, transform WGS84 query points into the source CRS, and apply the inverse raster affine transform. Reject outside-raster points instead of clamping them to valid edge pixels. |
| SOL-08 | P1 | `app/planner-page.tsx:837-838` | Cesium lighting uses longitude-derived solar time, while Google shade rasters use regional standard time without DST. | Choose and label one time basis. Convert regional standard time to UTC for scene lighting; read the corresponding shade band. |
| SOL-09 | P1 | `app/planner-page.tsx`, shade sampling effect | Invalid/no shade samples produce `0` shade, and fetch errors are swallowed. Unknown analysis can look fully sunny. | Represent unknown, unavailable and valid sunlight separately. Expose provider failure and sample coverage. |
| SOL-10 | P1 | `services/roof-vision/app.py:422,453` | Plane fitting uses x=column/east and y=row/south, but azimuth is `atan2(-a,-b)`. The north/south component is reversed for a north-up raster. | For this restricted coordinate convention use `atan2(-a,b)`. Better, fit in real projected east/north coordinates from the raster transform. |
| SOL-11 | P1 | `services/roof-vision/app.py:463` | `areaMeters2` is horizontal pixel area. It does not account for plane slope. | Expose horizontal area and surface area separately; surface area is horizontal area divided by cosine of pitch. |
| SOL-12 | P1 | `services/roof-vision/app.py:175-176,465` | `RETR_EXTERNAL` loses holes. Only the largest contour is returned, but all coplanar inliers are removed; disconnected coplanar roof regions can disappear. | Preserve connected components and interior rings. Remove only accepted components or return each accepted component. |
| SOL-13 | P1 | `services/roof-vision/app.py:488` | Equal DSM/mask dimensions are accepted without requiring equal CRS, affine transform and pixel footprint. | Validate alignment or explicitly reproject/resample the mask with nearest-neighbour semantics. |
| SOL-14 | P2 | `services/roof-vision/app.py`, plane result payload | The plane intercept/origin and elevation are discarded. Pitch and azimuth alone cannot place a roof at the correct 3D height. | Return plane equation, normal, centre, elevation datum, CRS, acquisition metadata and fit diagnostics. |
| SOL-15 | P2 | `normalizeDsmPlanes` in `app/planner-page.tsx` | Provider reference planes are matched mainly by angle, not spatial overlap. A similarly facing roof can inherit another roof's sunlight. The score is also a heuristic, not calibrated probability. | Match using spatial intersection/centroids as well as normal similarity. Label heuristic quality honestly and keep unmatched production unknown. |
| SOL-16 | P1 | `services/solar-engine/model.mjs:5` | Monthly weighting takes absolute latitude, yielding northern seasons in the southern hemisphere. | Preserve signed latitude in solar position calculations or use verified climate-model outputs. |
| SOL-17 | P1 | `services/solar-engine/model.mjs:48` | Cumulative savings are computed as current-year value multiplied by year number, rather than summing each year's value. | Maintain a running cumulative sum with explicit costs/replacements and consistent rounding. |
| SOL-18 | P1 | `services/solar-engine/server.mjs:137,154,187` | PVGIS/PVWatts energy overrides retain local-model financial outputs. Multi-array results inherit similar stale financial fields. | Finalize the complete energy result first, then run one financial function against that result. |
| SOL-19 | P1 | `app/planner-page.tsx:1025` | The frontend preserves fallback cash flow while replacing annual/monthly energy with live results. | Use a single fully recalculated result rather than mixing providers at field level. |
| SOL-20 | P1 | `services/solar-engine/model.mjs:66-75` | Ground layout divides an assumed usable area by a footprint. It returns no polygon-safe placements and ignores tilt projection, obstacles, actual plot shape and row design. | Implement actual bounded rectangular placement using metres and return positions. |
| SOL-21 | P1 | `services/solar-engine/model.mjs:70-71` | Zero spacing/setback inputs are replaced by defaults; negative setbacks can manufacture thousands of square metres. | Validate bounded finite non-negative inputs; allow deliberate zero using `??`. Apply count/extent limits. |
| SOL-22 | P1 | `app/planner-page.tsx:1575` | Save stores selected IDs and counts but not custom segments or geometry. No matching restore read exists in this planner. | Save the complete versioned plan; validate and restore it. Report local save completion only after the write succeeds. |
| SOL-23 | P2 | `Photorealistic3DView` | The 3D view displays classifications over imagery; it has no solar panel meshes. | Add independent panel/rack geometry from the same placement records as the top-down editor. |
| SOL-24 | P2 | `normalizeGoogleSegments`, provider request defaults | Roofs are truncated to eight segments and high-quality-only requests can exclude otherwise available coverage. | Make limits explicit, avoid silently dropping useful surfaces, and provide a labelled lower-quality/manual path where appropriate. |

The current monetary model also values production at a single retail rate and defaults incentives. Product design should let the user set import rate, export rate, self-consumption assumptions and incentives explicitly; do not present a universal incentive or an export value as an established fact.

## Exact executable reproduction

Executed read-only against the original Solar4U checkout with Node. No provider requests or file writes were needed.

```js
import { localEstimate, fitGroundArray } from './services/solar-engine/model.mjs';
const north = localEstimate({ capacityKw: 10, latitude: 43, azimuth: 180 });
const south = localEstimate({ capacityKw: 10, latitude: -43, azimuth: 0 });
const sum = north.cashFlow.reduce((s, r) => s + r.annualSavings, 0) - north.netCost;
console.log(JSON.stringify({
  northMonthly: north.monthlyKwh,
  southMonthly: south.monthlyKwh,
  lastCumulative: north.cashFlow.at(-1).cumulativeSavings,
  sumOfAnnualSavings: sum,
  groundZeroSetback: fitGroundArray({ areaSqM: 100, setbackM: 0, rowSpacingM: 0 }),
  groundNegativeSetback: fitGroundArray({ areaSqM: 100, setbackM: -100 }),
}, null, 2));
```

Actual output:

```json
{
  "northMonthly": [353, 465, 762, 1010, 1247, 1297, 1303, 1140, 851, 606, 383, 311],
  "southMonthly": [353, 465, 762, 1010, 1247, 1297, 1303, 1140, 851, 606, 383, 311],
  "lastCumulative": 53104,
  "sumOfAnnualSavings": 38106,
  "groundZeroSetback": {
    "panelCount": 20,
    "usableAreaSqM": 64,
    "capacityKw": 8,
    "assumptions": {
      "panelWidthM": 1.134,
      "panelHeightM": 1.722,
      "rowSpacingM": 1,
      "setbackM": 0.9
    }
  },
  "groundNegativeSetback": {
    "panelCount": 1328,
    "usableAreaSqM": 4100,
    "capacityKw": 531.2,
    "assumptions": {
      "panelWidthM": 1.134,
      "panelHeightM": 1.722,
      "rowSpacingM": 1,
      "setbackM": -100
    }
  }
}
```

This confirms identical northern/southern seasonality, approximately $14,998 disagreement within one result, ignored zero inputs and an invalid 531.2 kW layout on a 100 m² plot. The comparison sums already-rounded annual fields, so a corrected implementation should calculate in full precision and round only display output.

Two additional defects are exact mathematical source deductions rather than claims of a live DSM test:

- In a 60 m square displayed as 100 by 100 units, a 10-by-10-unit rectangle is 6 by 6 metres: 36 m² horizontal area. Current manual logic reads 100 m².
- For north-up DSM `z = c + b * row`, positive `b` means elevation rises southward, so the downslope-facing azimuth is north (0°). Current `atan2(0,-b)` yields south (180°). Existing Python tests slope only across columns and therefore do not exercise this failure.

## One source of truth for geometry

Create a versioned metre-based `SitePlan` rather than putting geometric truth in screen percentages:

```ts
type Point2 = { x: number; y: number };
type Point3 = { east: number; north: number; up: number };
type Polygon = { outer: Point2[]; holes: Point2[][] };
type ModuleSpec = { id: string; widthM: number; lengthM: number; thicknessM: number; watts: number };
type Surface = {
  id: string;
  kind: 'roof' | 'ground';
  boundary: Polygon;
  origin: Point3;
  tiltDegrees: number;
  azimuthDegrees: number;
  edgeSetbackM: number;
  obstacles: Polygon[];
  source: 'measured' | 'google-solar' | 'owner-survey' | 'illustrative';
};
type PanelPlacement = {
  id: string;
  surfaceId: string;
  moduleId: string;
  centre: Point3;
  corners: [Point3, Point3, Point3, Point3];
  row: number;
  orientation: 'portrait' | 'landscape';
};
```

Production and finance belong in separate calculated records keyed by a hash/version of the geometry and assumptions. Include geographic anchor, CRS, vertical datum, imagery/source date, provider version, acquisition/expiry time, module specifications and validation state in the real persisted schema. Do not persist secret provider keys. A browser diagram and a 3D viewport must consume the same placement records.

### Roof coordinate basis

Let ENU mean east, north, up; let A be the downslope compass azimuth and β the roof tilt. Relative to the roof plane centre:

```text
up(east,north) = centreUp - tan(β) * [sin(A)*east + cos(A)*north]
surfaceArea = horizontalArea / cos(β)

crossSlope = ( cos(A),           -sin(A),           0 )
upSlope    = (-sin(A)*cos(β),     -cos(A)*cos(β),    sin(β))
normal     = ( sin(A)*sin(β),      cos(A)*sin(β),    cos(β))
```

These orthonormal vectors provide a plane-space packing basis. Project boundaries to the plane; pack module rectangles using actual surface width/length; transform accepted corners back into ENU. Offset visible panel faces slightly along the normal to avoid coincident surfaces. For Babylon with x=east, y=up, z=south, map `(east,north,up)` to `(east,up,-north)` consistently.

Google Building Insights supplies panel dimensions and positions plus plane pitch, azimuth, centre and centre height. Its panel energy is DC kWh. Preserve rather than replace these fields. Source: [Building Insights reference](https://developers.google.com/maps/documentation/solar/reference/rest/v1/buildingInsights/findClosest).

The provider describes centre height above sea level, while Cesium geographic Cartesian construction uses height above its ellipsoid. A georeferenced overlay needs an explicit vertical datum transformation or an independently validated local offset; do not silently treat the two elevations as identical. Source: [Cesium Cartesian3 reference](https://cesium.com/learn/cesiumjs/ref-doc/Cartesian3.html).

### Practical roof packing requirements

1. Validate finite bounded coordinates, at least three distinct vertices, nonzero area and no self-intersections. Normalize ring closure/winding. Holes must be inside the boundary and non-overlapping.
2. Inset the permitted region by the selected edge/access setbacks; expand obstacle regions by their clearances. Treat these as user/project assumptions, not universal legal values.
3. Try portrait and landscape modules, selected orientation directions and several grid offsets. Evaluate all accepted whole rectangles.
4. Require full polygon containment, no edge crossing, no overlap with holes/obstacles and no overlap with accepted panels. Corner-only containment fails for concave regions.
5. Score by the selected objective: panel count, estimated production or target size. Use deterministic tie-breaking and retain IDs where geometry is unchanged.
6. Return actual corners, count, DC capacity, excluded-region reasons and assumptions. Display a valid empty result for plots that fit nothing.
7. Allow remove, move and rotate with validation feedback, reversible preview and one undo step for automatic placement.

Triangulation is a rendering step, not validation or polygon repair. Earcut supports polygon holes but its output should not be used as a substitute for validating the source polygon. Source: [Mapbox Earcut repository](https://github.com/mapbox/earcut).

### Ground placement requirements

For a table with surface length L along its tilt direction:

```text
projectedDepth = L * cos(β)
rise = L * sin(β)
conservativeGap = max(serviceGap, rise / tan(minimumDesignSunAltitude))
rowPitch = projectedDepth + conservativeGap
```

This is a conservative geometric planning rule for a selected sun-altitude criterion. It does not guarantee year-round zero shading and is not a building-code setback. Show the design altitude and access gap. For a later time-window optimizer, evaluate solar elevation and azimuth through a selected winter period and project each row's shadow along the row-normal direction. Roof-mounted coplanar arrays should not inherit ground-row spacing.

Pack the projected footprints within the ground polygon, considering fences, foundations, trees, easements/access regions and terrain. Model lower-edge clearance and rack posts separately. Label flat ground as an assumption unless terrain data are provided. Keep the definition of ground coverage ratio explicit and consistent with the production model.

PVWatts V8 supports fixed open-rack versus roof-mounted arrays, tilt, compass azimuth, GCR, inverter efficiency, DC/AC ratio, albedo and bifaciality. Run distinct arrays separately and sum their energy before financial modelling. Source: [PVWatts V8 API](https://developer.nlr.gov/docs/solar/pvwatts/v8/).

## Production, shade and finance

- Read GeoTIFF GeoKeys and source units before spatial sampling. Google's official example uses `geotiff`, `geotiff-geokeys-to-proj4` and `proj4`. Prefer transforming a query point into raster coordinates over assuming the response is a north-aligned WGS84 rectangle. Source: [Solar data-layer example](https://developers.google.com/maps/documentation/solar/data-layers).
- Hourly shade is a monthly file, 24 hourly bands, and day bits indexed from zero. A set bit means sun; invalid data are not sun. The time basis is regional standard time with no DST or leap day. Cache the decoded monthly raster in memory during playback instead of repeatedly downloading it at each slider tick. Source: [Solar GeoTIFF documentation](https://developers.google.com/maps/documentation/solar/geotiff).
- Google's annual flux incorporates orientation, weather and surrounding obstruction shading. It is independent of module efficiency; production uses module kilowattage and other system losses. Avoid double-counting shade or treating DC energy as delivered AC energy. Source: [Solar API concepts](https://developers.google.com/maps/documentation/solar/concepts).
- A climate provider's horizon estimate does not establish detailed chimney/tree shading for the selected roof. PVGIS documents a coarse terrain horizon and separate user horizon inputs. Label local obstruction uncertainty where no suitable DSM/obstacles exist. Source: [PVGIS 5 documentation](https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/using-pvgis-5_en).
- Use one financial function after final annual/monthly production is established. Compute annual import displacement plus export revenue less costs; maintain a running cumulative sum. Include explicitly entered incentive, degradation, escalation, maintenance and replacement assumptions.
- Preserve result state and provider errors. An unavailable live result should not silently masquerade as a precise address analysis. A local estimate must remain clearly labelled.

## Nook & Nest inspection and exact Babylon imports

Read `C:/Users/fahad/OneDrive/Documents/ChatGPT/furnishing/AGENTS.md` in full across the initial read and final tail verification. This was read-only work; its worktree/edit/release rules do not require a Nook & Nest branch for this research artifact. The useful product patterns are preserving real dimensions, camera framing, saved schema, picking and undo; separating local saves from explicit online saves; validating imported data before replacing a working project; and keeping controls functional without WebMCP.

Current Nook & Nest package declarations are `@babylonjs/core: ^8.0.0` and `@babylonjs/loaders: ^8.0.0`; the inspected installed core is **8.0.0**. These are verified local versions, not a claim that 8.0.0 is the newest upstream release. For a focused first scene, only core is necessary; loaders is needed for GLB survey/model imports.

These exact focused module paths are used by the inspected scene controller and terrain code:

```ts
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';

// Required registration imports when these scene features are used:
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import '@babylonjs/core/Culling/ray';
import '@babylonjs/core/Rendering/outlineRenderer';
```

Optional GLB import, verified in `src/scene/FurnitureModelLibrary.ts`:

```ts
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF/2.0';
```

Use a client-only lazily loaded scene component; create the engine in an effect after the canvas exists, observe its container size, and dispose listeners, observers, meshes, materials and engine on unmount. Do not reconstruct the entire scene when only selection or a module colour changes. Use an ID-to-mesh map for incremental updates.

Specific reusable patterns:

| Verified file | Pattern to adapt | Boundary |
| --- | --- | --- |
| `src/scene/SceneController.ts:1-20,67-85` | Focused Babylon imports, orbit/pan/zoom, shadows, persistent camera and selection. | It imports furniture catalog, floors, global store and snapping extensively; do not copy the whole controller. |
| `src/cameraPolicy.ts:3-11` | Reframe only for project/floor changes, close zoom 0.25 m, near clip 0.005 m, gentle pan sensitivity. | Adapt limits to a building/ground site. Do not reset zoom on every layout edit. |
| `src/scene/TerrainScene.ts` | VertexData positions/indices/normals, `ComputeNormals`, signature-based geometry update and disposal. | Terrain strokes are illustrative editing, not measured survey elevations. |
| `src/floorGeometry.ts:4-35,53,74` | Measured dimensions, rectangle operations, exact boundary and parsing helpers. | These are millimetre floor/grid utilities. They are not a general concave roof polygon/setback engine. |
| `src/planValidation.ts:3-17` | Version checks, finite bounded numbers, maximum sizes, unique IDs and reference integrity before import. | Create a Solar4U schema/validator; do not call the furniture validator on solar data. |

Nook & Nest stores many dimensions in millimetres and divides by 1000 at the renderer boundary. Solar4U can simplify this by storing geometry in metres from the start. Maintain one documented convention throughout. Panel instances share geometry/materials but retain individual transforms and picking identity. Source: [Babylon instances documentation](https://doc.babylonjs.com/features/featuresDeepDive/mesh/copies/instances).

## Realistic 3D and reconstruction scope

A practical first release is an editable house shell built from confirmed building dimensions, roof planes and an explicit height assumption, plus dimensioned panel meshes and ground racks. The output should say whether the property is measured, provider-derived or illustrative. A generic editable home is not an automatic reconstruction of the searched house.

For actual owner survey reconstruction, OpenDroneMap can produce a georeferenced point cloud, textured model, orthophoto and optional DSM/DTM. This needs adequate imagery/overlap and a suitable processing worker; ground control affects accuracy. An address or single unconstrained image is not enough to promise a reliable survey model. Sources: [ODM outputs](https://docs.opendronemap.org/outputs/), [ODM surveying and processing guidance](https://docs.opendronemap.org/tutorials/).

Google Photorealistic 3D Tiles should remain visual context, displayed with its required attribution. Do not extract or derive permanent roof meshes, dimensions, masks or training data from the tiles. Analytical placement geometry must come from Solar API data or separately licensed/open/owner-provided survey data. Source: [Google Map Tiles policies](https://developers.google.com/maps/documentation/tile/policies).

Google Solar's permitted use covers energy feasibility/design and qualifying downstream transactions. Solar data has a 30-day temporary-cache allowance with a specific exception for fixed media incorporated into qualifying downstream materials. Record provider expiry separately from user-authored plan data. Source: [Google Maps service-specific terms](https://cloud.google.com/maps-platform/terms/maps-service-terms).

Keep Google Maps and third-party attributions visible. The Solar policy also specifies a solar-source attribution beside relevant data/imagery and describes attribution for derived environmental content. Source: [Solar policies and attributions](https://developers.google.com/maps/documentation/solar/policies).

## Minimum meaningful validation

- Concave L-shaped roof, courtyard/skylight hole, chimney clearance, repeated/collinear vertices, bow-tie self-intersection and invalid hole.
- Narrow plot and tiny roof that fit zero modules; exact-fit rectangles; portrait/landscape comparison; arbitrary surface azimuth.
- Four cardinal roof directions, zero-degree tilt, steep roof bounds and correct surface-versus-horizontal area.
- Synthetic north/east/south/west DSM slopes; disconnected coplanar regions; masked hole; mismatched CRS/affine transforms; rotated raster.
- Ground table projected depth/rise, chosen row shadow criterion, access gaps, parcel edges, rack clearance and terrain assumptions.
- Count, DC watts, panel dimensions and rendered placements agree in both SVG and 3D.
- Both hemispheres, provider-produced monthly arrays, zero output, missing provider, invalid climate coordinates and provider warning propagation.
- Financial sum consistency, import/export split, no incentive, degradation, replacements and empty/zero systems.
- Save/reload preserves every surface, obstacle, placement and assumption; invalid import leaves the current plan untouched; stale provider data are identified.
- Public-origin API operation, desktop/mobile rendering, pointer and keyboard selection, viewport resize, camera preservation, disposal and WebGL unavailable fallback.

Passing geometry tests or loading a model does not prove a real roof is correctly reconstructed. Capture a full browser interaction and retain a separately labelled field/survey acceptance boundary.
