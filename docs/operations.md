# Operations

## Local workflow

1. `npm install`
2. `npm run verify`
3. `npm run compose:test`
4. `npm run test:browser-smoke` to run the stable fixture-backed browser smoke suite
5. `make run-app` when you want the local app stack in the browser
6. `make stopp-app` when you want to stop that stack again
7. `make rebuild-app` when you want to rebuild and recreate the local app stack

`npm run compose:test` validates the compose file, builds the scaffolded `api` and `web` services, waits for them to stay running, verifies the api `/health` response from inside the container, and then tears the stack down.

The Make targets wrap the default compose flow:

- `make run-app`: `docker compose up -d --build`
- `make stopp-app`: `docker compose down --remove-orphans`
- `make rebuild-app`: stop the current stack, rebuild the default services, and recreate them so the browser sees the latest local changes

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

The `maps` profile is reserved for the real self-hosted map stack once data-preparation items are implemented.
The compose smoke does not start `graphhopper` or `tileserver` yet, so map-data validation remains later work.

## Tile style contract

- `PUBLIC_TILE_STYLE_URL` is the web-facing map-style contract for future MapLibre integration.
- It must point to a self-hosted style JSON document served by the local tile stack, not a hosted third-party style URL.
- If that style endpoint is unreachable, the planning map must fail honestly instead of substituting bundled placeholder cartography.
- Override it with `http://localhost:8080/styles/basic/style.json` or another self-hosted TileServer GL style document once the local tile stack is running.

## Browser smoke

- `npm run test:browser-smoke` runs a fixture-backed Playwright smoke that proves the repo can distinguish four outcomes: a healthy self-hosted map, unreachable style JSON, missing tile data, and an unintended fallback path.
- `npm run test:browser-smoke -- --app-url http://localhost:5173` points that same smoke at the live local app and expects a passing real-map result.
- `npm run test:browser-smoke -- --app-url http://localhost:5173 --expect-cause unreachable_style_json` is the honest expected result for the current default `make run-app` flow while the tile-stack bootstrap item is still open.
- Map-centered `implement` and `review` work should cite this smoke output alongside any manual browser evidence instead of relying only on unit tests or fixture responses.

## Agent command behavior

- `refine` updates `.agent` planning state only
- `implement` changes exactly one backlog item or finding
- `review` compares the current state with `.agent` specs and [docs/product.md](/Users/cpf/Workspace/personal/Pathbadger/docs/product.md)
- `show` reports a brief workspace summary from `.agent/roadmap.yaml`, `.agent/epics/`, and `.agent/backlog/` without changing files

`docs/product.md` remains the original vision reference. The live operational contract is stored in `.agent/*.yaml`.
