import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Solar4U application shell", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Solar4U/);
  assert.match(html, /Plan smarter/);
  assert.match(html, /href="\/calculators"/);
  assert.match(html, /Planning information only/);
});

test("calculator route contains the complete interactive workspace", async () => {
  const response = await render("/calculators");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Solar calculators/);
  assert.doesNotMatch(html, /Location-aware PV production/);
  assert.match(html, /Advanced settings/);
  assert.match(html, /world-map-equirectangular/);
  assert.match(html, /Battery runtime/);
  assert.match(html, /Charge controller/);
  assert.match(html, /Solar cable gauge/);
  assert.match(html, /TOU battery/);

  const source = await readFile(new URL("../app/calculators-page.tsx", import.meta.url), "utf8");
  assert.match(source, /Live PVGIS climate data \(default\)/);
  assert.match(source, /Monthly production/);
  assert.match(source, /Panel orientation/);
  assert.match(source, /function OrientationCompass/);
  assert.match(source, /Hover to preview/);
  assert.match(source, /Exact heading/);
  assert.match(source, /Northeast/);
  assert.match(source, /Multiple arrays/);
  assert.match(source, /Recommended charge controllers/);
  assert.match(source, /SmartSolar MPPT 150\/45/);
  assert.doesNotMatch(source, /Enter one module&apos;s nameplate values/);
  assert.match(source, /SHARED PANEL SPECIFICATION/);
  assert.match(source, /Add another array/);
  assert.match(source, /Use different panel specs/);
  assert.match(source, /Parallel strings/);
  assert.match(source, /values=\{\[12,24,48,400\]\}/);
  assert.match(source, /max=\{60\}/);
  assert.match(source, /max=\{20\}/);
  assert.match(source, /arrayWatts<=100000/);
  assert.match(source, /max=\{250000\}/);
  assert.match(source, /Dynamic cable size chart/);
  assert.match(source, /No-grid \/ no-solar autonomy/);
  assert.match(source, /role="tablist"/);
});

test("planner route contains the five-stage roof solar workflow", async () => {
  const response = await render("/planner");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Solar roof planner/);
  assert.match(html, /Let&#x27;s find your property/);
  assert.match(html, /Open a fictional demo property/);
  assert.match(html, /Sun/);
  assert.match(html, /Sections/);
  assert.match(html, /Savings/);
  assert.match(html, /Next Steps/);

  const source = await readFile(new URL("../app/planner-page.tsx", import.meta.url), "utf8");
  const engineSource = await readFile(new URL("../services/solar-engine/server.mjs", import.meta.url), "utf8");
  assert.match(source, /Google Solar/);
  assert.match(source, /Sun and shadow study/);
  assert.match(source, /Review roof sections/);
  assert.match(source, /Monthly production/);
  assert.match(source, /25-year cumulative cash flow/);
  assert.match(source, /Save this project/);
  assert.match(source, /roof-analysis-demo-aerial\.png/);
  assert.match(source, /Confirm property and check roof/);
  assert.match(source, /Photorealistic3DView/);
  assert.match(source, /3D property/);
  assert.match(source, /Zoom property map in/);
  assert.match(source, /prompted image candidates/);
  assert.match(source, /Draw a roof section/);
  assert.match(source, /Analyze permitted imagery/);
  assert.match(source, /roof-vision\/segment/);
  assert.match(source, /I confirm I may process this imagery/);
  assert.match(source, /Solar shade overlay/);
  assert.match(source, /segmentIndex/);
  assert.match(source, /Left-drag rotate · right-drag move · wheel zoom/);
  assert.match(source, /screenSpaceCameraController/);
  assert.match(source, /ScreenSpaceEventHandler/);
  assert.match(source, /RIGHT_DOWN/);
  assert.match(source, /maximumScreenSpaceError: 18/);
  assert.match(source, /DATA_LAYER_CACHE_VERSION = "high-60m-01"/);
  assert.match(engineSource, /DATA_LAYER_RADIUS_METERS = 30/);
  assert.match(engineSource, /DATA_LAYER_PIXEL_SIZE_METERS = 0\.1/);
  assert.match(engineSource, /requiredQuality: "HIGH"/);
  assert.match(source, /matched a building \$\{buildingOffsetMeters\} m/);
  assert.match(source, /RGB, flux, DSM and hourly shade layers/);
  assert.match(source, /SolarGeoTiffCanvas/);
  assert.match(source, /layer=annualFlux/);
  assert.match(source, /layer=hourlyShade/);
  assert.match(source, /Georeferenced analytical mode/);
  assert.match(source, /isolates the selected building with Google/);
  assert.match(source, /thin plane outlines come from the surface model/);
  assert.match(source, /v1\/solar\/roof-planes/);
  assert.match(engineSource, /v1\/roof-vision\/solar-planes/);
  assert.match(engineSource, /selected building mask and DSM/);
  assert.doesNotMatch(source, /setStage\("sun"\).*fictional demo/s);
});

test("learn route contains the technical curriculum and external discussion library", async () => {
  const response = await render("/guides");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Learn the basics/);
  assert.match(html, /Search lessons/);
  assert.match(html, /Solar power flow and system types/);
  assert.match(html, /TECHNICAL REFERENCE/);
  assert.match(html, /Manufacturer and authority manual shelf/);
  assert.match(html, /REAL-LIFE WORKED EXAMPLE/);
  assert.match(html, /Primary technical references/);
  assert.match(html, /learn-system-overview\.png/);
  assert.match(html, /Extra Discussions/);

  const source = await readFile(new URL("../app/guides-page.tsx", import.meta.url), "utf8");
  assert.match(source, /Series, parallel, and series-parallel arrays/);
  assert.match(source, /Battery chemistry and BMS fundamentals/);
  assert.match(source, /Permits, utility review, and inspection packet/);
  assert.match(source, /Commissioning and initial power-on/);
  assert.match(source, /PV module anatomy and datasheet literacy/);
  assert.match(source, /Professional solar tool selection/);
  assert.match(source, /PV connector assembly and crimp inspection/);
  assert.match(source, /Roof rails, rail-less systems, and attachment families/);
  assert.match(source, /Solar pergolas, carports, and canopies/);
  assert.match(source, /lessonEnhancements/);
  assert.match(source, /NREL/);
  assert.match(source, /UL Solutions/);
  assert.match(source, /IronRidge/);
  assert.match(source, /OSHA/);
  assert.match(source, /79/);
  assert.match(source, /cleversolarpower\.com\/blog\//);

  const professionalSource = await readFile(new URL("../app/professional-guide-data.ts", import.meta.url), "utf8");
  assert.match(professionalSource, /model: "393 FC"/);
  assert.match(professionalSource, /PV-CZM-61100/);
  assert.match(professionalSource, /IronRidge/);
  assert.match(professionalSource, /PVKIT 2\.0/);
  assert.match(professionalSource, /learn-tools-workbench\.png/);
  assert.match(professionalSource, /learn-mounting-types\.png/);
});

test("community route contains the persistent forum workspace", async () => {
  const response = await render("/community");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Technical solar discussions/);
  assert.match(html, /Recent community posts/);
  assert.match(html, /Post new topic/);
  assert.match(html, /New Products/);
  assert.match(html, /DIY Solar General/);
  assert.match(html, /Online Deals/);
  assert.match(html, /Other Equipment for Sale/);

  const source = await readFile(new URL("../app/community-page.tsx", import.meta.url), "utf8");
  assert.match(source, /Solar4U forums/);
  assert.match(source, /MemberProfileDialog/);
  assert.match(source, /function threadPath/);
  assert.match(source, /padStart\(2, "0"\)/);
  assert.match(source, /\/threads\/\$\{slugify\(thread\.title\)/);
  assert.doesNotMatch(source, /Showing threads in/);
  assert.match(source, /Celebrate/);
  assert.match(source, /\/api\/community/);
  assert.match(source, /Latest/);
  assert.match(source, /Unanswered/);
  assert.match(source, /Bookmarked/);
  assert.match(source, /Field-tested/);
  assert.match(source, /Accepted solution/);
  assert.match(source, /Moderation queue/);
  assert.match(source, /Marketplace caution/);
  assert.doesNotMatch(source, /Forum guidance is planning assistance/);
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/);

  const apiSource = await readFile(new URL("../services/platform-api/forum.mjs", import.meta.url), "utf8");
  assert.match(apiSource, /setReaction/);
  assert.match(apiSource, /setAcceptedAnswer/);
  assert.match(apiSource, /createReport/);
  assert.match(apiSource, /forum_thread_bookmarks/);
  assert.match(apiSource, /field_tested/);

  const migrationSource = await readFile(new URL("../infra/postgres/002-community.sql", import.meta.url), "utf8");
  assert.match(migrationSource, /create table if not exists forum_categories/);
  assert.match(migrationSource, /'new-products'/);
  assert.match(migrationSource, /'promotions'/);
  assert.match(migrationSource, /'online-deals'/);
  assert.match(migrationSource, /'for-sale'/);
});

test("short thread permalink route renders the community workspace", async () => {
  const response = await render("/threads/signature-solar-new-product-06");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Solar4U/);
});

test("community test route contains the isolated color-design lab", async () => {
  const response = await render("/community-test");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Choose a Solar4U direction/);
  assert.match(html, /Editorial navy/);
  assert.match(html, /Editorial taupe/);
  assert.match(html, /Blue dusk/);
  assert.doesNotMatch(html, /Spectrum/);
  assert.doesNotMatch(html, /Playground/);
  assert.doesNotMatch(html, /Modern slate/);
  assert.match(html, /site-theme-toggle/);
  assert.match(html, /aria-label="Switch to dark mode"/);
  assert.match(html, /lucide-sun/);
  assert.match(html, /lucide-moon/);
  assert.match(html, /AWARD-INSPIRED LAYOUT/);
  assert.match(html, /Technical grid/);
  assert.match(html, /Editorial cards/);
  assert.match(html, /Color bands/);
  assert.match(html, /theme-editorial-taupe mode-light layout-mosaic/);
});

test("editorial display mode is available and remembered across the site", async () => {
  const source = await readFile(new URL("../app/solar-app.tsx", import.meta.url), "utf8");
  assert.match(source, /site-editorial-theme mode-\$\{displayMode\}/);
  assert.match(source, /showDisplayMode/);
  assert.match(source, /solar4u-display-mode/);
  assert.match(source, /solar4u-community-display-mode/);
  assert.match(source, /window\.localStorage\.setItem/);

  const response = await render("/");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /site-editorial-theme mode-light/);
  assert.match(html, /aria-label="Switch to dark mode"/);
});

test("products group exposes deals, catalog, and the Solar Part Picker", async () => {
  const productsResponse = await render("/products");
  assert.equal(productsResponse.status, 200);
  const productsHtml = await productsResponse.text();
  assert.match(productsHtml, /Solar Part Picker/);
  assert.match(productsHtml, /Catalog List/);
  assert.match(productsHtml, /href="\/deals"/);

  const catalogResponse = await render("/catalog");
  assert.equal(catalogResponse.status, 200);
  const catalogHtml = await catalogResponse.text();
  assert.match(catalogHtml, /Catalog List/);
  assert.match(catalogHtml, /Search products, model or specification/);

  const pickerResponse = await render("/solar-part-picker");
  assert.equal(pickerResponse.status, 200);
  const pickerHtml = await pickerResponse.text();
  assert.match(pickerHtml, /Build a complete solar system one category at a time/);
  assert.match(pickerHtml, /Solar Generation/);
  assert.match(pickerHtml, /Inverters &amp; Power Stations/);
  assert.match(pickerHtml, /Electrical Protection/);
  assert.match(pickerHtml, /Wiring &amp; Terminations/);
  assert.match(pickerHtml, /Tools &amp; PPE/);
  assert.match(pickerHtml, /Compatibility check active/);

  const pickerSource = await readFile(new URL("../app/solar-part-picker.tsx", import.meta.url), "utf8");
  assert.match(pickerSource, /Compatibility filter/);
  assert.match(pickerSource, /All manufacturers/);
  assert.match(pickerSource, /Save build locally/);
  assert.match(pickerSource, /solar4u-part-picker-build/);
  assert.match(pickerSource, /Battery and inverter voltage conflict/);
  assert.match(pickerSource, /returnTo=/);
  assert.match(pickerSource, /window\.history\.replaceState/);
  assert.match(pickerSource, /type PickerBuild = Partial<Record<CategoryId, BuildEntry\[\]>>/);
  assert.match(pickerSource, /Add 1 more/);
  assert.match(pickerSource, /Product lines/);
});

test("product detail route contains retailer offers, specifications, and history views", async () => {
  const response = await render("/products/demo-product");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Details &amp; prices/);
  assert.match(html, /Price history/);
  assert.match(html, /Add to PV build/);
  assert.match(html, /CURRENT OFFERS/);
  assert.match(html, /NORMALIZED CATALOG/);

  const source = await readFile(new URL("../app/product-detail-page.tsx", import.meta.url), "utf8");
  assert.match(source, /\/v1\/products\/\$\{encodeURIComponent\(productId\)\}/);
  assert.match(source, /source_url/);
  assert.match(source, /Retailer price history/);
  assert.match(source, /solar4u-part-picker-pending/);
  assert.match(source, /Back to Solar Part Picker/);
  const routeSource = await readFile(new URL("../app/products/[product]/page.tsx", import.meta.url), "utf8");
  assert.match(routeSource, /requestedReturn\.startsWith\("\/solar-part-picker"\)/);
});

test("solar product taxonomy prioritizes mounts over incidental panel language", async () => {
  const { classifySolarProduct, extractSolarSpecifications } = await import("../services/shared/product-taxonomy.mjs");
  const mount = classifySolarProduct(
    "28 inch adjustable RV tilt mount",
    "Designed for rooftop RICH SOLAR MEGA series solar panels",
  );
  assert.equal(mount.pickerCategory, "mounting");
  assert.ok(mount.confidence >= 0.9);
  const panel = extractSolarSpecifications(
    "410W bifacial TOPCon solar panel",
    "Voc 37.2 V, Vmp 31.4 V, Isc 14.1 A, Imp 13.1 A. 1722 x 1134 x 30 mm.",
  );
  assert.deepEqual({ voc: panel.voc, vmp: panel.vmp, isc: panel.isc, imp: panel.imp }, { voc: 37.2, vmp: 31.4, isc: 14.1, imp: 13.1 });
});

test("admin route contains the restricted scraper operations workspace", async () => {
  const response = await render("/admin");
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /Scraper administration|Scraper operations/);
  assert.match(html, /RESTRICTED OPERATIONS|PRICE WORKER/);
});

test("community replies use the compact rich-text editor", async () => {
  const source = await readFile(new URL("../app/community-page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /ADD TO THE RECORD/);
  assert.match(source, /aria-label="Reply formatting"/);
  assert.match(source, /rows=\{5\}/);
  assert.match(source, /ForumFormattedText body=\{reply\}/);
});

test("community topic controls use accessible bookmark and watch icons", async () => {
  const source = await readFile(new URL("../app/community-page.tsx", import.meta.url), "utf8");
  assert.match(source, /aria-label=\{thread\.bookmarked \? "Remove bookmark" : "Bookmark discussion"\}/);
  assert.match(source, /aria-label=\{thread\.followed \? "Stop watching topic" : "Watch topic"\}/);
  assert.match(source, /<Bookmark size=\{18\}/);
  assert.match(source, /<Eye size=\{19\}/);
});

test("community avatars use person silhouettes with stable color tones", async () => {
  const source = await readFile(new URL("../app/community-page.tsx", import.meta.url), "utf8");
  assert.match(source, /<UserRound \/>/);
  assert.match(source, /className=\{`community-avatar \$\{size\} tone-\$\{tone\}`\}/);
  assert.doesNotMatch(source, /community-avatar \$\{size\}`[^>]*>\{initials\(member\.name\)\}/);
});
