# Operations

## Local workflow

1. `npm install`
2. `npm run verify`
3. `npm run compose:test`
4. `docker compose up -d --build` when you want the local stack

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

## Agent command behavior

- `refine` updates `.agent` planning state only
- `implement` changes exactly one backlog item or finding
- `review` compares the current state with `.agent` specs and [docs/product.md](/Users/cpf/Workspace/personal/Pathbadger/docs/product.md)

`docs/product.md` remains the original vision reference. The live operational contract is stored in `.agent/*.yaml`.
