# Operations

## Local workflow

1. `npm install`
2. `npm run verify`
3. `npm run compose:test`
4. `docker compose up -d --build` when you want the local stack

`npm run compose:test` validates the compose file, builds the scaffolded `api` and `web` services, waits for them to stay running, verifies the api `/health` response from inside the container, and then tears the stack down.

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
- The current default is `http://localhost:8080/styles/basic/style.json`, matching the expected TileServer GL style document when the `maps` profile is running.

## Agent command behavior

- `refine` updates `.agent` planning state only
- `implement` changes exactly one backlog item or finding
- `review` compares the current state with `.agent` specs and [docs/product.md](/Users/cpf/Workspace/personal/Pathbadger/docs/product.md)

`docs/product.md` remains the original vision reference. The live operational contract is stored in `.agent/*.yaml`.
