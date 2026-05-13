# Pathbadger

Pathbadger is a self-hosted trail-first route planning and navigation project for spontaneous running and cycling routes in Schleswig-Holstein.

This repository is initialized for an agent-driven workflow with four recurring commands:

- `refine`
- `implement`
- `review`
- `show`

## Source of truth

- `.agent/*.yaml` is the operational source of truth for planning, governance, backlog, roadmap, and review behavior.
- [docs/product.md](/Users/cpf/Workspace/personal/Pathbadger/docs/product.md) is the initial vision reference and should primarily be consulted during `review` to detect drift from the original product brief.

## Workspace layout

- `apps/api`: Fastify API scaffold
- `apps/web`: React + Vite web scaffold
- `packages/shared`: shared domain types and schemas
- `packages/geo`: geospatial utilities and tests
- `services/graphhopper`: self-hosted GraphHopper configuration placeholders
- `services/tileserver`: self-hosted tile server configuration placeholders
- `.agent`: agent operating model, roadmap, epic, backlog, findings, and review state

## Getting started

1. Run `npm install`.
2. Run `npm run verify`.
3. Run `npm run compose:test`.
4. Run `npm run test:browser-smoke` to exercise the browser smoke fixture suite.
5. Use `make run-app` to start the local app stack when you want to open it in the browser.
6. Read the active epic and backlog in `.agent/`.

## Docker notes

- `docker-compose.yml` defines the target service topology from day one.
- `graphhopper` and `tileserver` are behind the `maps` profile until real regional data is prepared.
- `npm run compose:test` now builds and starts the scaffolded `api` and `web` services, checks the api `/health` endpoint, and tears the stack down again.
- The compose smoke covers only the default `api` and `web` services; the `maps` profile remains excluded until real regional data is prepared.
- `make run-app`, `make stopp-app`, and `make rebuild-app` wrap the default compose workflow for local app startup, shutdown, and forced rebuilds.
- `PUBLIC_TILE_STYLE_URL` is the frontend map-style contract. It must point at a self-hosted style JSON endpoint such as `http://localhost:8080/styles/basic/style.json`, and the app should fail honestly when that style is unreachable instead of drawing a fake fallback map.
- `npm run test:browser-smoke -- --app-url http://localhost:5173` is the browser-level gate for map work. It passes only when the planning map uses a real self-hosted style contract and the page can reach tile-backed map assets without silently falling back.
- While `ITEM-0025` remains open, `npm run test:browser-smoke -- --app-url http://localhost:5173 --expect-cause unreachable_style_json` is the expected supported-app result after `make run-app`, because the default stack still excludes the map profile and should fail honestly.

## Agent workflow

- `refine` updates planning state only.
- `implement` must implement exactly one actionable backlog item or finding.
- `review` audits the workspace and produces structured findings without changing roadmap progress.
- `show` reports a brief workspace summary with open item count, incomplete epic count, and overall roadmap progress from `.agent/roadmap.yaml`.

The initial setup intentionally focuses on durable scaffolding, not product completeness. The roadmap and metrics start at 0% product progress even though the repository framework is now in place.
