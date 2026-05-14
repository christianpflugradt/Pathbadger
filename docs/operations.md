# Operations

## Local workflow

1. `npm install`
2. `npm run verify`
3. `npm run compose:test`
4. `npm run test:browser-smoke` to run the stable fixture-backed browser smoke suite
5. `make run-app` when you want the local app stack in the browser
6. `make run-routing-app` when you need a real routed preview and navigation start in the browser
7. `make stopp-app` when you want to stop either local app stack again
8. `make rebuild-app` when you want to rebuild and recreate the map-only local app stack
9. `make rebuild-routing-app` when you want to rebuild and recreate the routing-capable local app stack
10. `make show` when you want the deterministic workspace summary without relying on agent-side interpretation

`npm run compose:test` validates both the default compose graph and the `maps`
profile configuration, builds the `api`, `web`, and `tileserver` services,
waits for them to stay running, verifies the internal api and tile endpoints
inside the stack, verifies the frontend proxy for `/api/health` and
`/styles/basic/style.json`, and then tears the stack down.

The Make targets split the lighter planning boot from the heavier routing boot:

- `make run-app`: generate the selected ignored map dataset if needed, then `docker compose up -d --build`
- `make run-routing-app`: generate map data, download the Schleswig-Holstein routing extract if needed, boot `docker compose --profile maps up -d --build`, and wait until `/routes/generate` can return a real preview with geometry
- `make stopp-app`: `docker compose down --remove-orphans`
- `make rebuild-app`: stop the current stack, regenerate missing map data if needed, rebuild the default services, and recreate them so the browser sees the latest local changes
- `make rebuild-routing-app`: stop the current stack, regenerate missing map data if needed, ensure routing data exists, rebuild the `maps` profile stack, and wait for routed-preview readiness again

## Package manager policy

This repository is npm-only by explicit user instruction.

- Use `npm`.
- Do not use `pnpm`.
- Do not use `yarn`.
- Do not use any alternative package manager in agent tasks.

## Map and routing data

- OSM extracts live under `data/osm/`
- GraphHopper cache lives under `data/graphhopper/`
- tile artifacts live under `data/tiles/`

`data/tiles/` stays ignored and now holds generated GeoJSON basemap files for the
local tile service:

- `bad-bramstedt-50km.geojson` for the default starter map
- `schleswig-holstein-basemap.geojson` for the broader live map

`data/osm/` now also holds the downloaded Schleswig-Holstein routing extract that
the routing-capable boot reuses:

- `schleswig-holstein-latest.osm.pbf` for GraphHopper import

`graphhopper` stays out of the default map-only app flow and only boots through
the explicit routing-capable workflow. The tile service remains part of the
default supported app flow.

## Tile data scope

- `PATHBADGER_TILE_DATA_SCOPE=starter` is the default supported flow.
- `PATHBADGER_TILE_DATA_SCOPE=schleswig_holstein` switches the local tile
  service to the whole-state dataset.
- `PATHBADGER_TILE_DATA_FILE=/absolute/path/to/custom.geojson` overrides the
  file used by either scope.
- `scripts/ensure-map-data.sh` generates the selected dataset into `data/tiles/`
  when it is missing.

## Routing data

- `scripts/ensure-routing-data.sh` downloads the Schleswig-Holstein OSM extract
  into `data/osm/` when it is missing.
- `PATHBADGER_ROUTING_DATA_URL=https://...` overrides the download source when
  you need to mirror or pin the extract elsewhere.
- `GRAPHHOPPER_HAS_ELEVATION=false` remains the supported default for this local
  flow, so live routed previews keep elevation gain unavailable instead of
  pretending the 2D GraphHopper response contains real climb data.
- The first `make run-routing-app` is significantly heavier than `make run-app`
  because GraphHopper must import the extract into `data/graphhopper/cache`
  before route previews can succeed.

## Tile style contract

- `PUBLIC_API_BASE_URL` is the web-facing route-preview contract for browser requests.
- In the supported compose topology it must stay same-origin at `/api` so the frontend remains the only browser-facing entrypoint.
- Absolute browser API origins are intentionally unsupported unless the proxy contract changes and the API deliberately regains browser CORS support.
- `PUBLIC_TILE_STYLE_URL` is the web-facing map-style contract for future MapLibre integration.
- It must point to a self-hosted style JSON document served by the local tile stack, not a hosted third-party style URL.
- In the supported compose topology it should stay same-origin at `/styles/basic/style.json` so the frontend remains the only browser-facing entrypoint.
- If that style endpoint is unreachable, the planning map must fail honestly instead of substituting bundled placeholder cartography.
- The supported local browser endpoint is `http://localhost:5173/styles/basic/style.json`.
- Do not reintroduce direct browser access to `api`, `tileserver`, or `graphhopper`, and do not depend on client-side CORS for those services. The frontend proxy is the supported front controller.

## Browser smoke

- `npm run test:browser-smoke` runs a fixture-backed Playwright smoke that proves the repo can distinguish four outcomes: a healthy self-hosted map, unreachable style JSON, missing tile data, and an unintended fallback path.
- `npm run test:browser-smoke -- --app-url http://localhost:5173` points that same smoke at the live local app and expects a passing real-map result.
- Navigation-map work also requires the routing-capable local flow because a real browser session cannot enter navigation until `/routes/generate` returns geometry.
- `PATHBADGER_TILE_DATA_SCOPE=schleswig_holstein make run-app` is the intended whole-state live-map configuration once the broader dataset is prepared.
- Map-centered `implement`, `fix`, and `review` work should cite this smoke output alongside any manual browser evidence instead of relying only on unit tests or fixture responses.

## Agent command behavior

- `refine` updates `.agent` planning state only
- `implement` changes exactly one backlog item
- `fix` resolves exactly one open finding from `.agent/findings/`
- `review` compares the current state with `.agent` specs and [docs/product.md](/Users/cpf/Workspace/personal/Pathbadger/docs/product.md), then persists any confirmed defects as finding files
- Any repo task that changes files must stage and create a git commit before reporting completion unless the user explicitly says not to commit yet.
- `review` always audits the whole workspace. Focus hints such as `review security` or `review architecture` may change emphasis, but they must not reduce scope.
- `review <number>` is not a supported shorthand for commit-count review and must never be interpreted that way.
- `show` reports a brief workspace summary from `.agent/roadmap.yaml`, `.agent/epics/`, `.agent/backlog/`, and `.agent/findings/` without changing files
- `make show` is the deterministic shell entrypoint for that same summary and delegates to `scripts/show-workspace-summary.sh`

`docs/product.md` remains the original vision reference. The live operational contract is stored in `.agent/*.yaml`.
