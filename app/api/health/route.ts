import { roofCapabilities } from "../../../lib/runtime-env";
export function GET() {
  return Response.json(
    {
      status: "ok",
      application: "Solar4U",
      runtime: "hosted",
      version: "revamp",
      productionModel: "PVGIS with labeled seasonal fallback",
      priceData:
        "Daily at 07:17 UTC; per-source health and timestamps at /api/prices",
      roofProvidersConfigured: roofCapabilities(),
      aerialRoof: "/roof-analysis",
      projectStorage: "this device + JSON export",
      checkedAt: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
