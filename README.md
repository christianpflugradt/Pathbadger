# Pathbadger

Pathbadger is a self-hosted trail-first route planning and navigation project for spontaneous running and cycling routes in Schleswig-Holstein.

This repository is initialized for an agent-driven workflow with four recurring repo task commands:

- `refine`
- `implement`
- `fix`
- `review`

## Source of truth

- `.agent/*.yaml` is the operational source of truth for planning, governance, backlog, roadmap, and review behavior.
- [docs/product.md](/Users/cpf/Workspace/personal/Pathbadger/docs/product.md) is the initial vision reference and should primarily be consulted during `review` to detect drift from the original product brief.

## Workspace layout

- `apps/api`: Fastify API for route preview generation and GraphHopper-backed routing orchestration
- `apps/web`: React + Vite web app for live planning and first-pass navigation
- `packages/shared`: shared domain types and schemas
- `packages/geo`: geospatial utilities and tests
- `services/graphhopper`: self-hosted GraphHopper configuration and compose runtime
- `services/tileserver`: self-hosted tile server configuration and compose runtime
- `.agent`: agent operating model, roadmap, epic, backlog, findings, and review state

## Getting started

1. Run `npm install`.
2. Run `npm run verify`.
3. Run `npm run compose:test`.
4. Run `npm run test:browser-smoke` to exercise the browser smoke fixture suite.
5. Use `make run-app` to start the local app stack when you want to open it in the browser.
6. Use `make run-routing-app` when you need a real routed preview and navigation start in the browser.
7. Run `npm run test:live-route-quality` after `make run-routing-app` when you need repeatable live route-quality evidence through the supported frontend proxy.
8. Use `make run-routing-app-elevation` when you need a supported local routed preview that can report non-null elevation gain.
9. Run `npm run test:live-route-elevation` after `make run-routing-app-elevation` when you need repeatable evidence that the elevation-capable stack is returning climb data honestly.
10. Use `make show` when you want the deterministic workspace summary.
11. Read the active epic and backlog in `.agent/`.

## Docker notes

- `docker-compose.yml` defines the target service topology from day one.
- Only `web` is intended to be internet facing in the compose topology. Browser traffic for route previews, map styles, and tile data must stay same-origin through the frontend proxy, while `api`, `tileserver`, and `graphhopper` stay on the Docker internal network.
- `graphhopper` now stays behind the explicit routing-capable local flow instead of the default map-only boot, while the `tileserver` continues to boot in the default app flow.
- `npm run compose:test` now builds and starts `api`, `web`, and `tileserver`, checks the api `/health` endpoint, verifies the tile style endpoint from inside the stack, and tears everything down again.
- `make run-app`, `make stopp-app`, and `make rebuild-app` wrap the default map-only compose workflow for local app startup, shutdown, and forced rebuilds, while `make stopp-app` also tears down the routing-capable profile if it is running.
- `make run-routing-app` and `make rebuild-routing-app` start the same local app plus GraphHopper through the `maps` profile and wait until the API can return a real routed preview with geometry.
- `make run-routing-app-elevation` and `make rebuild-routing-app-elevation` boot a distinct, heavier GraphHopper config that reuses the same Schleswig-Holstein extract but builds a separate elevation-enabled cache before the API reports non-null climb data.
- `make run-app` and `make rebuild-app` call `scripts/ensure-map-data.sh`, which generates the selected ignored map dataset under `data/tiles/` when it is missing.
- `make run-routing-app` and `make run-routing-app-elevation` both call `scripts/ensure-routing-data.sh`, which downloads `data/osm/schleswig-holstein-latest.osm.pbf` on first use.
- `GET /api/places/search?query=...&limit=...` is now the supported same-origin place-search boundary that the planner uses for searched starts and pass-through picks. It stays unavailable by default until `PLACE_SEARCH_PROVIDER_URL` points the api container at a self-hosted Nominatim-compatible search service on the Docker internal network.
- The default supported routing-capable flow keeps `GRAPHHOPPER_HAS_ELEVATION=false`, so live preview elevation stays honestly unavailable unless you opt into `make run-routing-app-elevation`.
- The elevation-capable boot switches GraphHopper to `services/graphhopper/config-elevation.yml`, stores the imported graph under `data/graphhopper/cache-elevation`, and persists downloaded SRTM tiles under `data/graphhopper/elevation`.
- `PATHBADGER_TILE_DATA_SCOPE=starter` is the default and uses a real 50 km Bad Bramstedt slice. `PATHBADGER_TILE_DATA_SCOPE=schleswig_holstein` switches the tile service to a whole-state dataset file under `data/tiles/`.
- `PATHBADGER_TILE_DATA_FILE=/absolute/path/to/custom.geojson` overrides the default file for either scope when you want the tile service to use another generated dataset.
- `PUBLIC_API_BASE_URL` defaults to `/api`, and `PUBLIC_TILE_STYLE_URL` defaults to `/styles/basic/style.json`, so browser calls stay on the frontend origin and the web container can act as the front controller.
- Absolute browser values for `PUBLIC_API_BASE_URL` are intentionally unsupported in the current topology. Keep it same-origin through the frontend proxy, for example `/api`.
- Do not reintroduce direct browser calls to `api`, `tileserver`, or `graphhopper`, and do not add client-side CORS dependencies for those services. In the supported topology they are internal-only backends behind the frontend proxy.
- Keep place-search calls on that same proxy boundary too. Even when a local provider is configured, the browser-supported contract remains `/api/places/search`; the provider itself should stay internal-only behind the api container.
- `npm run test:browser-smoke -- --app-url http://localhost:5173` is the browser-level gate for map work. It passes only when the planning map uses a real self-hosted style contract and the page can reach tile-backed map assets without silently falling back.
- `npm run test:live-route-quality` is the live routing-quality gate for routing work after `make run-routing-app`. It proves route geometry, first/last instruction endpoint anchoring, distance-fit honesty, surface-summary honesty, and explicit out-of-region failure handling against the supported local stack.
- `npm run test:live-route-elevation` is the repeatable elevation-evidence gate after `make run-routing-app-elevation`. It reruns the live route-quality checks and adds a requirement that the returned route summary includes non-null `elevationGainMeters`.
- `make run-routing-app` is the supported local navigation-verification flow. Its first run is heavier because it downloads about 150 MB of Schleswig-Holstein OSM data and imports the GraphHopper cache before route previews can succeed.
- `make run-routing-app-elevation` is intentionally heavier than `make run-routing-app` because GraphHopper must also download and cache SRTM elevation tiles and build a separate elevation-enabled graph import before climb data becomes available.
- `PATHBADGER_TILE_DATA_SCOPE=schleswig_holstein make run-app` remains the intended whole-state live-map configuration once you are ready to build and use the broader tile dataset locally.

## Agent workflow

- `refine` updates planning state only.
- `implement` must implement exactly one actionable backlog item.
- `fix` must resolve exactly one open finding from `.agent/findings/`.
- `review` audits the full workspace and produces structured findings without changing roadmap progress. Extra tokens may only add focus and must never narrow the review to a commit range or patch subset.
- `make show` runs the deterministic shell workspace summary through `scripts/show-workspace-summary.sh`.

The repository now supports a real self-hosted planning flow, live route-quality evidence against Schleswig-Holstein data, a browser-verified navigation loop, and an explicit elevation-capable local routing workflow.
