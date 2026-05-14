# Pathbadger

Pathbadger is a self-hosted trail-first route planning and navigation project for spontaneous running and cycling routes in Schleswig-Holstein.

This repository is initialized for an agent-driven workflow with five recurring commands:

- `show`
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
7. Use `make show` when you want the deterministic workspace summary without the agent.
8. Read the active epic and backlog in `.agent/`.

## Docker notes

- `docker-compose.yml` defines the target service topology from day one.
- Only `web` is intended to be internet facing in the compose topology. Browser traffic for route previews, map styles, and tile data must stay same-origin through the frontend proxy, while `api`, `tileserver`, and `graphhopper` stay on the Docker internal network.
- `graphhopper` now stays behind the explicit routing-capable local flow instead of the default map-only boot, while the `tileserver` continues to boot in the default app flow.
- `npm run compose:test` now builds and starts `api`, `web`, and `tileserver`, checks the api `/health` endpoint, verifies the tile style endpoint from inside the stack, and tears everything down again.
- `make run-app`, `make stopp-app`, and `make rebuild-app` wrap the default map-only compose workflow for local app startup, shutdown, and forced rebuilds.
- `make run-routing-app` and `make rebuild-routing-app` start the same local app plus GraphHopper through the `maps` profile and wait until the API can return a real routed preview with geometry.
- `make run-app` and `make rebuild-app` call `scripts/ensure-map-data.sh`, which generates the selected ignored map dataset under `data/tiles/` when it is missing.
- `make run-routing-app` also calls `scripts/ensure-routing-data.sh`, which downloads `data/osm/schleswig-holstein-latest.osm.pbf` on first use and then lets GraphHopper import it into `data/graphhopper/cache`.
- The supported routing-capable flow currently keeps `GRAPHHOPPER_HAS_ELEVATION=false`, so live preview elevation stays honestly unavailable until a later elevation-capable GraphHopper setup is introduced.
- `PATHBADGER_TILE_DATA_SCOPE=starter` is the default and uses a real 50 km Bad Bramstedt slice. `PATHBADGER_TILE_DATA_SCOPE=schleswig_holstein` switches the tile service to a whole-state dataset file under `data/tiles/`.
- `PATHBADGER_TILE_DATA_FILE=/absolute/path/to/custom.geojson` overrides the default file for either scope when you want the tile service to use another generated dataset.
- `PUBLIC_API_BASE_URL` defaults to `/api`, and `PUBLIC_TILE_STYLE_URL` defaults to `/styles/basic/style.json`, so browser calls stay on the frontend origin and the web container can act as the front controller.
- Absolute browser values for `PUBLIC_API_BASE_URL` are intentionally unsupported in the current topology. Keep it same-origin through the frontend proxy, for example `/api`.
- Do not reintroduce direct browser calls to `api`, `tileserver`, or `graphhopper`, and do not add client-side CORS dependencies for those services. In the supported topology they are internal-only backends behind the frontend proxy.
- `npm run test:browser-smoke -- --app-url http://localhost:5173` is the browser-level gate for map work. It passes only when the planning map uses a real self-hosted style contract and the page can reach tile-backed map assets without silently falling back.
- `make run-routing-app` is the supported local navigation-verification flow. Its first run is heavier because it downloads about 150 MB of Schleswig-Holstein OSM data and imports the GraphHopper cache before route previews can succeed.
- `PATHBADGER_TILE_DATA_SCOPE=schleswig_holstein make run-app` remains the intended whole-state live-map configuration once you are ready to build and use the broader tile dataset locally.

## Agent workflow

- `refine` updates planning state only.
- `implement` must implement exactly one actionable backlog item.
- `fix` must resolve exactly one open finding from `.agent/findings/`.
- `review` audits the full workspace and produces structured findings without changing roadmap progress. Extra tokens may only add focus and must never narrow the review to a commit range or patch subset.
- `show` reports a brief workspace summary with open item count, incomplete epic count, unfixed finding count, and overall roadmap progress from `.agent/roadmap.yaml`.
- `make show` runs the same deterministic shell summary through `scripts/show-workspace-summary.sh`.

The repository now supports a real self-hosted planning flow and a first browser-verified navigation loop. Remaining roadmap work is focused on route-quality proof, browser-local planning persistence, and broader hardening rather than on basic scaffolding.
