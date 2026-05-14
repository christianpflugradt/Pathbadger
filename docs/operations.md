# Operations

## Local workflow

1. `npm install`
2. `npm run verify`
3. `npm run compose:test`
4. `npm run test:browser-smoke` to run the stable fixture-backed browser smoke suite
5. `make run-app` when you want the local app stack in the browser
6. `make run-routing-app` when you need a real routed preview and navigation start in the browser
7. `npm run test:live-route-quality` after `make run-routing-app` when you need repeatable live evidence for instruction-endpoint anchoring, distance-fit honesty, surface-summary honesty, and explicit out-of-region failure handling
8. `make run-routing-app-elevation` when you need a supported local preview that can return non-null elevation gain
9. `npm run test:live-route-elevation` after `make run-routing-app-elevation` when you need repeatable climb-data evidence through the supported frontend proxy
10. `make stopp-app` when you want to stop either local app stack again
11. `make rebuild-app` when you want to rebuild and recreate the map-only local app stack
12. `make rebuild-routing-app` when you want to rebuild and recreate the routing-capable local app stack
13. `make rebuild-routing-app-elevation` when you want to rebuild and recreate the elevation-capable local app stack
14. `make show` when you want the deterministic workspace summary

`npm run compose:test` validates both the default compose graph and the `maps`
profile configuration, builds the `api`, `web`, and `tileserver` services,
waits for them to stay running, verifies the internal api and tile endpoints
inside the stack, verifies the frontend proxy for `/api/health` and
`/styles/basic/style.json`, and then tears the stack down.

The Make targets split the lighter planning boot from the heavier routing boot:

- `make run-app`: generate the selected ignored map dataset if needed, then `docker compose up -d --build`
- `make run-routing-app`: generate map data, download the Schleswig-Holstein routing extract if needed, boot `docker compose --profile maps up -d --build`, and wait until `/routes/generate` can return a real preview with geometry
- `make run-routing-app-elevation`: reuse the supported routing boot but switch GraphHopper to the explicit elevation config, a separate graph cache, and a readiness check that waits for non-null `summary.elevationGainMeters`
- `npm run test:live-route-quality`: hit the frontend-proxied `/api/routes/generate` contract with supported live requests and fail if route geometry, first/last instruction endpoint anchoring, distance-fit honesty, surface-summary honesty, or explicit out-of-region failure behavior drift
- `npm run test:live-route-elevation`: rerun the same live route-quality contract with an extra assertion that the preview summary exposes non-null elevation gain
- `make stopp-app`: `docker compose --profile maps down --remove-orphans`, so the same stop command fully tears down both the default stack and the routing-capable stack
- `make rebuild-app`: stop the current stack, regenerate missing map data if needed, rebuild the default services, and recreate them so the browser sees the latest local changes
- `make rebuild-routing-app`: stop the current stack, regenerate missing map data if needed, ensure routing data exists, rebuild the `maps` profile stack, and wait for routed-preview readiness again
- `make rebuild-routing-app-elevation`: stop the current stack, regenerate missing map data if needed, ensure routing data exists, rebuild the `maps` profile stack with the elevation config, and wait for routed-preview elevation readiness again

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

`data/graphhopper/` now separates the lighter and heavier routing imports:

- `cache/` for the default supported routed-preview workflow without elevation
- `cache-elevation/` for the explicit elevation-capable routed-preview workflow
- `elevation/` for cached SRTM tiles downloaded during the elevation-capable import

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
- `make run-routing-app-elevation` flips `GRAPHHOPPER_HAS_ELEVATION=true`,
  switches GraphHopper to `services/graphhopper/config-elevation.yml`, persists
  downloaded SRTM tiles under `data/graphhopper/elevation`, and keeps its
  imported graph separate under `data/graphhopper/cache-elevation`.
- The first `make run-routing-app` is significantly heavier than `make run-app`
  because GraphHopper must import the extract into `data/graphhopper/cache`
  before route previews can succeed.
- The first `make run-routing-app-elevation` is heavier again because GraphHopper
  must also fetch elevation tiles and build a second elevation-enabled graph
  import before the route summary can expose climb data.

## Place search

- `GET /api/places/search?query=...&limit=...` is the supported same-origin place-search boundary for later planner work.
- `PLACE_SEARCH_PROVIDER_URL=http://nominatim:8080` is the api-side environment hook for a self-hosted Nominatim-compatible provider on the Docker internal network. The api app appends `/search` automatically when the configured base URL does not already include it.
- When `PLACE_SEARCH_PROVIDER_URL` is unset, blank, unreachable, or returns malformed data, the boundary responds with `status: "unavailable"` plus an explicit message instead of inventing search results.
- When a configured provider returns no matches, the boundary responds with `status: "empty"` and an explicit no-results message.
- Keep browser traffic on the frontend proxy at `/api/places/search`; do not expose the provider directly to the browser or add client-side CORS dependencies for it.
- A supported local stack check looks like `curl "http://127.0.0.1:5173/api/places/search?query=Bad%20Bramstedt"`, which should return an honest `success`, `empty`, or `unavailable` payload through the frontend proxy.

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

- `npm run test:browser-smoke` runs a fixture-backed Playwright smoke that proves the repo can distinguish five outcomes: a healthy self-hosted map, unreachable style JSON, missing tile data, post-load map runtime errors, and an unintended fallback path.
- `npm run test:browser-smoke -- --app-url http://localhost:5173` points that same smoke at the live local app and expects a passing real-map result.
- Navigation-map work also requires the routing-capable local flow because a real browser session cannot enter navigation until `/routes/generate` returns geometry.
- `PATHBADGER_TILE_DATA_SCOPE=schleswig_holstein make run-app` is the intended whole-state live-map configuration once the broader dataset is prepared.
- Map-centered `implement`, `fix`, and `review` work should cite this smoke output alongside any manual browser evidence instead of relying only on unit tests or fixture responses.

## Live route-quality evidence

- `npm run test:live-route-quality` is the supported repeatable evidence command after `make run-routing-app`.
- It proves three live behaviors through the frontend proxy: geometry-backed previews keep the first and last instruction coordinates anchored to the route geometry endpoints, distance and surface summaries stay internally honest, and out-of-region requests fail explicitly.
- It does not yet prove intermediate instruction ordering or full cue-by-cue alignment along the route geometry.
- Keep the command output together with any browser screenshots when route-quality work changes scoring, legality, region, warning, or instruction behavior.
- For manual browser capture, use the default Bad Bramstedt starter area, generate an `8.0 km` `Running / walking` `Mixed` preview, and record whether the outcome is `success`, `partial`, or `failed` along with the visible warnings, summary, and instruction state.

## Live elevation evidence

- `npm run test:live-route-elevation` is the supported repeatable evidence command after `make run-routing-app-elevation`.
- It reruns the live route-quality checks and additionally fails unless the returned preview summary includes non-null `elevationGainMeters`.
- Keep that JSON output with any browser screenshots when the explicit elevation-capable runtime path changes.

## Agent command behavior

- `refine` updates `.agent` planning state only
- `implement` changes exactly one backlog item
- `fix` resolves exactly one open finding from `.agent/findings/`
- `review` compares the current state with `.agent` specs and [docs/product.md](/Users/cpf/Workspace/personal/Pathbadger/docs/product.md), then persists any confirmed defects as finding files
- Any repo task that changes files must stage and create a git commit before reporting completion unless the user explicitly says not to commit yet.
- `review` always audits the whole workspace. Focus hints such as `review security` or `review architecture` may change emphasis, but they must not reduce scope.
- `review <number>` is not a supported shorthand for commit-count review and must never be interpreted that way.
- `make show` is the deterministic shell entrypoint for the workspace summary and delegates to `scripts/show-workspace-summary.sh`

`docs/product.md` remains the original vision reference. The live operational contract is stored in `.agent/*.yaml`.
