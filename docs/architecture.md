# Architecture

Pathbadger uses a self-hosted, Docker-based architecture that keeps the final deployment shape visible while still leaving room for honest route-quality and hardening work.

## Approved baseline

- Frontend: React + TypeScript + Vite
- Backend: Node.js + TypeScript + Fastify
- Shared code: workspace packages under `packages/`
- Routing engine target: GraphHopper with Schleswig-Holstein OSM data
- Tiles target: self-hosted tile server under the `maps` Docker profile
- Package manager: npm only

## Service model

- `web`: mobile-friendly planning and navigation frontend
- `api`: Fastify service boundary for route preview generation and routing orchestration
- `graphhopper`: self-hosted routing engine for the supported routing-capable local flow
- `tileserver`: self-hosted vector-tile and style service for the supported planning flow

## Current state

- The repository now has a supported local stack that can show real self-hosted cartography, generate a routed preview, and start a browser-verified navigation session.
- Core route planning, surface summaries, navigation progress, live geolocation updates, speed metrics, and follow-position behavior are implemented in the current web and api apps.
- Remaining architecture work is concentrated on route-quality proof, browser-local planning persistence, and hardening concerns such as energy behavior and placeholder cleanup.

## Design guardrails

- Keep product logic in TypeScript packages, not in ad hoc scripts.
- Keep routing/scoring logic centralized and testable.
- Keep active navigation calculations local on the client.
- Keep self-hosted service assumptions explicit in code and docs.
