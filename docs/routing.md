# Routing

The core product differentiator is route quality, not generic shortest-path output.
Pathbadger generates round courses from and back to the same start point; point-to-point generation is not the normal product flow. A real round course should avoid sending the user over the same path in both directions, with repeated-path overlap ideally at zero and never more than 500 meters total for an accepted default route.

## Intended routing strategy

1. Accept a start point, activity, target distance, surface preference, and optional pass-through points.
2. Generate candidate waypoint sets for round-trip-friendly route shapes that return to the same start point.
3. Ask GraphHopper for legal route candidates.
4. Score candidates by distance fit, legality, surface preference, traffic avoidance, and true loop quality with minimal repeated-path overlap.
5. Return the best route plus honest warnings when the target cannot be matched closely.

## MVP expectations

- one route candidate at a time
- one round-trip route candidate at a time
- explicit random variation regeneration
- honest surface-composition summaries
- clear warnings or failures when data is incomplete or constraints make the requested distance impossible
- a normal accepted round trip should avoid any meaningful out-and-back overlap and must stay below 500 meters total repeated-path overlap
- a normal acceptable route should stay within a few hundred meters of the target distance, with 400 meters as the hard outer limit unless explicit feasibility constraints force a warning or failure

## Current state

The repository now implements a GraphHopper-backed routed-preview loop end to end:

- planning requests reach the api boundary from the web app
- the api scores routed candidates and returns warnings, summary data, geometry, and instructions
- legality and Schleswig-Holstein region guardrails reject unsupported routed candidates before they are presented as acceptable previews
- the supported `make run-app` flow can start a real navigation session from that preview in the browser, while `make run-routing-app` remains an explicit alias for the same runtime, and `npm run test:live-route-quality` now captures repeatable live evidence through the frontend proxy
- the explicit `make run-routing-app-elevation` flow can boot a heavier local GraphHopper import that returns non-null `summary.elevationGainMeters` when terrain data is available

## Supported live route-quality evidence

Use this repo-native flow when you need to capture supported live route-quality evidence on Schleswig-Holstein data:

1. Run `npm run verify`.
2. Run `make run-app`.
3. Run `npm run test:live-route-quality`.
4. Capture the JSON evidence from that command alongside any manual browser screenshots.

`npm run test:live-route-quality` runs three live checks against `http://127.0.0.1:5173/api/routes/generate` through the supported frontend proxy:

- a geometry-backed preview still returns instructions whose first and last instruction coordinates match the returned route geometry
- the same preview reports a distance delta and surface percentages that stay internally honest, including warning codes when distance tolerance or unknown-surface coverage require them
- an impossible `8 km` request with a required pass-through point east of Bimohlen fails explicitly instead of returning a much longer "close enough" loop
- an out-of-region Berlin request fails explicitly with `request_points_out_of_supported_region` instead of pretending that the Schleswig-Holstein-only product scope is supported

The command does not yet validate intermediate instruction ordering or full cue-by-cue alignment along the route geometry, so treat it as endpoint-anchoring evidence rather than end-to-end instruction-alignment proof.

## Supported live elevation evidence

Use this repo-native flow when you need supported evidence that the heavier local routing path is exposing real climb data:

1. Run `npm run verify`.
2. Run `make run-routing-app-elevation`.
3. Run `npm run test:live-route-elevation`.
4. Capture the JSON evidence from that command alongside any manual browser screenshots.

`npm run test:live-route-elevation` reruns the live route-quality checks and also fails unless the returned preview summary includes non-null `elevationGainMeters` through the supported frontend proxy.

## Browser walkthrough

When you want a human-readable local browser walkthrough in addition to the command output:

1. Open `http://localhost:5173/` after `make run-app` or `make run-routing-app` finishes.
2. Keep the default home-base start at Heidmoorer Straße 18, 24576 Weddelbrook, choose `Running / walking`, `8.0 km`, and `Mixed`, then generate a preview.
3. Capture the rendered route line plus the summary and warnings area.

Evidence to capture by outcome:

- Acceptable: status is `success`, the route line is visible, warnings are empty, the summary distance and surface percentages are visible, and the navigation handoff exposes real instructions.
- Partial: status is `partial`, the route line is still visible, the route still stays inside the supported 400 meter distance envelope, and warnings explain a smaller limitation honestly instead of pretending a gross distance miss is acceptable.
- Failed: status is `failed`, `summary` and `geometry` are absent, and the visible warning or the proxied JSON response names the blocking reason explicitly. Use `npm run test:live-route-quality` for the deterministic out-of-region failure capture if the current map-centered browser request does not naturally produce a failed preview.

Remaining routing work is now limited to broader hardening outside the core routed-preview and supported local-runtime contracts.
