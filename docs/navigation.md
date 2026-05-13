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

## Initialization note

The navigation runtime is intentionally not implemented yet. The roadmap starts at 0% product progress even though the repository can now support navigation-focused backlog items.
