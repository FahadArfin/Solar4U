# Solar4U

Solar4U is a local-first workspace for DIY solar research and planning. It combines retailer price history, equipment comparison, system estimates, electrical diagram checks, guides, and a community forum in one application.

## What is implemented

- Responsive routes for products, deals, recommendations, guides, calculators, property planning, diagrams, community, and a local dashboard.
- A normalized PostgreSQL catalog and historical-price schema.
- Policy-aware retailer adapter registry for all 36 retailers supplied for the first release.
- Daily midnight `America/New_York` collection coordinator with durable page checkpoints, one-minute per-domain pacing, and isolated failures.
- Streaming and idempotent import of the supplied Signature Solar `.7z` history.
- Local PV production/financial model, optional NREL PVWatts v8 integration, optional Google Solar building insights, and ground-array fitting.
- Diagram component library and deterministic voltage, ampacity, overcurrent, and connectivity checks.
- Forum, project, guide, alert, moderation, job, and audit-ready data models.
- Independent containers for the web, platform API, price worker, solar engine, diagram service, and notification worker.
- PostgreSQL, Redis, and MinIO local infrastructure.
- Terraform and protected GitHub workflows for a later Google Cloud Run deployment.

## Local startup

Requirements:

- Docker Desktop with Docker Compose
- Node.js 22 or later

Copy `.env.example` to `.env` only when you want to add optional provider keys. The application works in manual/fixture mode without them.

```powershell
npm install
npm run local:up
```

Local endpoints:

| Surface | URL |
| --- | --- |
| Solar4U web | http://localhost:3000 |
| Platform API | http://localhost:4000/healthz |
| Solar engine | http://localhost:4001/healthz |
| Diagram service | http://localhost:4002/healthz |
| Notification preview | http://localhost:4003/healthz |
| Price worker | http://localhost:4004/healthz |
| MinIO console | http://localhost:9001 |

Useful commands:

```powershell
npm run local:status
npm run local:logs
npm run local:restart
npm run local:down
npm run history:import
npm run scrape:run
```

`local:down` preserves data. Local volumes can only be deleted with the explicit confirmation:

```powershell
node scripts/local-ops.mjs uninstall "" remove-local-solar4u-data
```

## Historical Signature Solar import

Docker Compose mounts this archive read-only:

`C:\Users\fahad\Documents\Codex\SignatureSolar.7z`

Run:

```powershell
npm run history:import
```

The importer streams `all_products_data.csv` directly from the archive, writes normalized products/offers/observations, and records a deterministic import ID. Running it again returns `already_imported` rather than duplicating history. The source archive and extracted CSV are never copied into Git.

## Retailer collection policy

Each adapter checks `robots.txt` and published terms, discovers retailer-declared sitemaps, reads structured Product JSON-LD, uses one request at a time per domain, and stops on access rejection. Retailer integrations can report `disabled_by_policy` or `degraded`; the collector does not bypass access controls or bot challenges.

The daily cycle begins at 12:00 AM Eastern. Product pages are separated by at least `SCRAPER_PAGE_DELAY_MS=60000` per domain. Different domains can progress independently, with `SCRAPER_RETAILER_CONCURRENCY=12` by default. Daily observations and retries are idempotent, and `scraper_checkpoints` resumes a partial retailer run after a restart.

To add or change a source, edit `services/price-worker/retailers.config.json`. A source needs only an ID, display name, and base URL; `termsUrl` is optional. Standards-compliant Product JSON-LD normally needs no new parser code.

Before enabling broad live collection, set `SCRAPER_CONTACT` in `.env` to a monitored contact, review each retailer’s current terms, and test one retailer:

```powershell
npm run scrape:retailer -- signature-solar
```

## Provider keys

- `NREL_API_KEY`: enables PVWatts v8. `DEMO_KEY` can be used for limited development.
- `GOOGLE_GEOCODING_API_KEY`: enables rooftop-precision address matches and exposes whether a result is rooftop, interpolated, or approximate.
- `GOOGLE_SOLAR_API_KEY`: enables building insights plus the RGB, DSM, roof mask, solar-flux, and hourly-shade layers used by the planner.
- `GOOGLE_MAPS_API_KEY`: enables the static satellite fallback shown behind provider roof sections.
- `GOOGLE_MAP_TILES_API_KEY`: enables the origin-restricted Cesium Photorealistic 3D Tiles viewer. Restrict it to the Map Tiles API and `http://localhost:3000/*`. Google 3D imagery is visual context only; roof geometry must not be extracted or derived from it.
- Google OAuth values are reserved for the final public-authentication phase. The local build uses the seeded private development profile.
- When `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `AUTH_SECRET` are configured, `/signin` enables Auth.js Google OAuth with JWT sessions.
- For local Google OAuth, register `http://localhost:3000` as an Authorized JavaScript origin and `http://localhost:3000/api/auth/callback/google` as the exact Authorized redirect URI (no trailing slash).

Precise addresses should not be committed as fixtures. Google Solar content must be shown with required Google Maps attribution and must follow Google’s storage restrictions.

The address-to-building checks, analytical sources, roof-plane workflow, and 3D usage boundary are documented in [`docs/solar-geospatial-pipeline.md`](docs/solar-geospatial-pipeline.md).

## Optional Roof Vision service

The local stack includes a separate `roof-vision` container on `http://localhost:4005`. In the planner's Sections step, **Analyze permitted imagery** accepts an owner-supplied or otherwise licensed orthophoto. The lightweight CPU backend produces a prompted, editable candidate; a georeferenced GeoTIFF can be placed in the current map automatically. A PNG/JPEG stays image-relative until the user confirms alignment.

The service also exposes DSM RANSAC plane fitting for pitch/azimuth work. It records provenance and confidence and always marks candidates for review. It does not send Google Solar/Maps content through ML.

```powershell
npm run roof-vision:test
npm run roof-vision:logs
```

`ROOF_VISION_TARGET=local` is the default. Set it to `samgeo` only when you intentionally want the much larger optional SamGeo image and have suitable compute/model configuration. See [`docs/open-source-roof-vision.md`](docs/open-source-roof-vision.md).

## Tests

```powershell
npm run lint
npm run build
node --test services/price-worker/tests.mjs
node --test services/solar-engine/tests.mjs
node --test services/diagram-service/tests.mjs
npm run roof-vision:test
docker compose config
```

The test suite uses local fixtures and never contacts live retailers.

## Google Cloud preparation

`infra/terraform` provisions Artifact Registry, Cloud SQL, object storage, Redis, Pub/Sub, Secret Manager, Cloud Scheduler, and a runtime identity. Deployment remains manual through protected GitHub environments.

Configure GitHub’s Google Workload Identity Federation values before using any cloud workflow:

- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_DEPLOY_SERVICE_ACCOUNT`
- repository variable `GCP_PROJECT_ID`

No cloud resources are created by local startup.

## Safety

Solar4U provides planning information, not engineering approval, structural certification, legal advice, or a guarantee of electrical-code compliance. Confirm designs, conductor sizing, overcurrent protection, structural loads, permits, and inspection requirements with qualified professionals and the local authority having jurisdiction.
