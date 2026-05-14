# Navigation

Navigation is the second major product state after route planning.

## Intended MVP behavior

- show the current route geometry
- track current GPS position
- compute progress locally in the browser
- show next instruction and distance to it
- show completed km, remaining km, total km, current speed, average speed, and progress percent
- warn when the user is off route

## Energy constraints

- avoid backend round trips during active route following
- keep map updates simple and conservative
- treat heading-up mode as optional later work
- surface uncertainty or GPS inaccuracy honestly instead of pretending precision

## Current state

The navigation runtime is now implemented for the supported local browser flow:

- a routed preview can start navigation
- live browser geolocation drives current-position updates
- progress, next instruction, off-route warnings, and speed metrics stay local in the frontend
- map follow stays enabled by default, pauses after a manual pan, and can be explicitly recentered
- low-confidence or stale live GPS fixes now stay conservative, so off-route and progress cues become approximate until a tighter browser update arrives

## Browser and PWA caveats

The supported navigation flow is still browser-first rather than native:

- browser geolocation permission must be granted before live route following can work
- local development can use `http://localhost`, but deployed geolocation should be served over HTTPS
- iPhone browsers and installed PWAs may throttle or pause updates after the app loses focus or the screen locks
- Wake Lock behavior varies by browser, so the app must not pretend it can always keep the device awake
- installed PWAs still inherit browser permission, background, and integration limits rather than behaving like a native app

The MVP is still expected to be useful with the screen on and the app active.

Remaining navigation-adjacent work is now mostly hardening: battery-aware behavior, GPS-noise conservatism, and optional later navigation modes.
