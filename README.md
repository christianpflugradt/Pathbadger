# Pathbadger

Pathbadger is a self-hosted trail-first route planning and navigation project for spontaneous running and cycling routes in Schleswig-Holstein.

This repository is initialized for an agent-driven workflow with three recurring commands:

- `refine`
- `implement`
- `review`

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
4. Use `make run-app` to start the local app stack when you want to open it in the browser.
5. Read the active epic and backlog in `.agent/`.

## Docker notes

- `docker-compose.yml` defines the target service topology from day one.
- `graphhopper` and `tileserver` are behind the `maps` profile until real regional data is prepared.
- `npm run compose:test` now builds and starts the scaffolded `api` and `web` services, checks the api `/health` endpoint, and tears the stack down again.
- The compose smoke covers only the default `api` and `web` services; the `maps` profile remains excluded until real regional data is prepared.
- `make run-app`, `make stopp-app`, and `make rebuild-app` wrap the default compose workflow for local app startup, shutdown, and forced rebuilds.
- `PUBLIC_TILE_STYLE_URL` is the frontend map-style contract. The default local boot uses the bundled `/styles/local-fallback.json` grid, and the variable can be overridden later with a self-hosted style JSON endpoint such as `http://localhost:8080/styles/basic/style.json`.

## Agent workflow

- `refine` updates planning state only.
- `implement` must implement exactly one actionable backlog item or finding.
- `review` audits the workspace and produces structured findings without changing roadmap progress.

The initial setup intentionally focuses on durable scaffolding, not product completeness. The roadmap and metrics start at 0% product progress even though the repository framework is now in place.
