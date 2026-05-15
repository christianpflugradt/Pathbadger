# Navigation

Navigation is the second major product state after route planning.

## Intended MVP behavior

- show the current route geometry
- keep the map as the dominant surface on phone during active guidance
- track current GPS position
- compute progress locally in the browser
- show next instruction and distance to it
- show completed km, remaining km, total km, current speed, average speed, estimated remaining time when feasible, and progress percent
- keep the persistent HUD compact and focused on essential turn and progress metrics instead of large planning or diagnostics panels
- warn when the user is off route
- offer a clear return to planning when navigation ends or is stopped

## Energy constraints

- avoid backend round trips during active route following
- keep map updates simple and conservative
- keep heading-up optional and guarded instead of turning it on by default
- surface uncertainty or GPS inaccuracy honestly instead of pretending precision

## Current state

The navigation runtime is now implemented for the supported local browser flow:

- a routed preview can start navigation
- live browser geolocation drives current-position updates
- progress, next instruction, off-route warnings, and speed metrics stay local in the frontend
- estimated remaining time now appears only when fresh route progress and speed evidence are strong enough to justify it, and stays explicitly unavailable when GPS or pace evidence is weak
- map follow stays enabled by default, pauses after a manual pan, and can be explicitly recentered
- navigation can optionally switch into a guarded heading-up mode, but it stays north-up by default and falls back honestly when heading data is weak or Battery saver is active
- low-confidence or stale live GPS fixes now stay conservative, so off-route and progress cues become approximate until a tighter browser update arrives
- navigation now exposes `Normal GPS` and `Battery saver` runtime modes, with saver mode relaxing browser geolocation to lower live-update churn at the cost of older or rougher fixes
- user feedback has now clarified that future iterations must further reduce non-map chrome on phone and keep the active guidance HUD tighter around the route and essential metrics

## Browser and PWA caveats

The supported navigation flow is still browser-first rather than native:

- browser geolocation permission must be granted before live route following can work
- local development can use `http://localhost`, but deployed geolocation should be served over HTTPS
- iPhone browsers and installed PWAs may throttle or pause updates after the app loses focus or the screen locks
- Wake Lock behavior varies by browser, so the app must not pretend it can always keep the device awake
- installed PWAs still inherit browser permission, background, and integration limits rather than behaving like a native app

The MVP is still expected to be useful with the screen on and the app active.

Current additive navigation work is now centered on the reopened map-first phone HUD and next-route reset flow, rather than on first-pass live orientation or ETA support.
