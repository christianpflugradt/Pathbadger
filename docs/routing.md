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

## Initialization note

This repository setup does not yet implement routing behavior. The purpose of the current scaffold is to make future `implement` items small, testable, and self-hosted by default.
