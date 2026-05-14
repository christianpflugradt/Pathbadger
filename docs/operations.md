# Operations

## Local workflow

1. `npm install`
2. `npm run verify`
3. `npm run compose:test`
4. `npm run test:browser-smoke` to run the stable fixture-backed browser smoke suite
5. `make run-app` when you want the local app stack in the browser
6. `make stopp-app` when you want to stop that stack again
7. `make rebuild-app` when you want to rebuild and recreate the local app stack

`npm run compose:test` validates the compose file, builds the `api`, `web`, and
`tileserver` services, waits for them to stay running, verifies the api
`/health` response and the tile style endpoint from inside the stack, and then
tears the stack down.

The Make targets wrap the default compose flow:

- `make run-app`: generate the selected ignored map dataset if needed, then `docker compose up -d --build`
- `make stopp-app`: `docker compose down --remove-orphans`
- `make rebuild-app`: stop the current stack, regenerate missing map data if needed, rebuild the default services, and recreate them so the browser sees the latest local changes

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

`graphhopper` remains behind the `maps` profile for later routing-data work.
The default supported app flow now includes the tile service directly.

## Tile data scope

- `PATHBADGER_TILE_DATA_SCOPE=starter` is the default supported flow.
- `PATHBADGER_TILE_DATA_SCOPE=schleswig_holstein` switches the local tile
  service to the whole-state dataset.
- `PATHBADGER_TILE_DATA_FILE=/absolute/path/to/custom.geojson` overrides the
  file used by either scope.
- `scripts/ensure-map-data.sh` generates the selected dataset into `data/tiles/`
  when it is missing.

## Tile style contract

- `PUBLIC_TILE_STYLE_URL` is the web-facing map-style contract for future MapLibre integration.
- It must point to a self-hosted style JSON document served by the local tile stack, not a hosted third-party style URL.
- If that style endpoint is unreachable, the planning map must fail honestly instead of substituting bundled placeholder cartography.
- The supported local endpoint is `http://localhost:8080/styles/basic/style.json`.

## Browser smoke

- `npm run test:browser-smoke` runs a fixture-backed Playwright smoke that proves the repo can distinguish four outcomes: a healthy self-hosted map, unreachable style JSON, missing tile data, and an unintended fallback path.
- `npm run test:browser-smoke -- --app-url http://localhost:5173` points that same smoke at the live local app and expects a passing real-map result.
- `PATHBADGER_TILE_DATA_SCOPE=schleswig_holstein make run-app` is the intended whole-state live-map configuration once the broader dataset is prepared.
- Map-centered `implement` and `review` work should cite this smoke output alongside any manual browser evidence instead of relying only on unit tests or fixture responses.

## Agent command behavior

- `refine` updates `.agent` planning state only
- `implement` changes exactly one backlog item or finding
- `review` compares the current state with `.agent` specs and [docs/product.md](/Users/cpf/Workspace/personal/Pathbadger/docs/product.md)
- `show` reports a brief workspace summary from `.agent/roadmap.yaml`, `.agent/epics/`, and `.agent/backlog/` without changing files

`docs/product.md` remains the original vision reference. The live operational contract is stored in `.agent/*.yaml`.
