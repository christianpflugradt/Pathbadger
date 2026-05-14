# Routing

The core product differentiator is route quality, not generic shortest-path output.

## Intended routing strategy

1. Accept a start point, activity, target distance, surface preference, and optional pass-through points.
2. Generate candidate waypoint sets for round-trip-friendly route shapes.
3. Ask GraphHopper for legal route candidates.
4. Score candidates by distance fit, legality, surface preference, traffic avoidance, and loop quality.
5. Return the best route plus honest warnings when the target cannot be matched closely.

## MVP expectations

- one route candidate at a time
- explicit random variation regeneration
- honest surface-composition summaries
- clear warnings when data is incomplete or constraints force longer routes

## Current state

The repository now implements a first GraphHopper-backed routed-preview loop end to end:

- planning requests reach the api boundary from the web app
- the api scores routed candidates and returns warnings, summary data, geometry, and instructions
- the supported `make run-routing-app` flow can start a real navigation session from that preview in the browser

Remaining routing work is focused on route-quality proof against live Schleswig-Holstein data, broader hardening, and optional later capabilities such as elevation-capable previews.
