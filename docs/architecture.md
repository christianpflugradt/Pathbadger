# Architecture

Pathbadger starts with a self-hosted, Docker-based architecture that keeps the final deployment shape visible from day one without pretending the routing stack is already complete.

## Approved baseline

- Frontend: React + TypeScript + Vite
- Backend: Node.js + TypeScript + Fastify
- Shared code: workspace packages under `packages/`
- Routing engine target: GraphHopper with Schleswig-Holstein OSM data
- Tiles target: self-hosted tile server under the `maps` Docker profile
- Package manager: npm only

## Service model

- `web`: mobile-friendly frontend shell
- `api`: Fastify service boundary for routing and analysis
- `graphhopper`: self-hosted routing engine placeholder
- `tileserver`: self-hosted map tile placeholder

## Current state

- The repository skeleton, hooks, verification scripts, and agent metadata are present.
- API and web entrypoints exist as scaffolds only.
- Routing-core behavior, map rendering, and navigation calculations remain future work.

## Design guardrails

- Keep product logic in TypeScript packages, not in ad hoc scripts.
- Keep routing/scoring logic centralized and testable.
- Keep active navigation calculations local on the client when implemented.
- Keep self-hosted service assumptions explicit in code and docs.
