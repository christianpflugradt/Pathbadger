# Trail Router Web-App: Agent Briefing and Development Operating Manual

This document is the complete starting instruction for an agentic coding assistant working in an empty repository. It describes the target product, technical architecture, development workflow, specification format, quality gates, Git rules, and iteration commands.

The agent must treat this file as the authoritative project brief during repository initialization. The agent must derive structured YAML specifications from it and then use those YAML files as the durable source of truth for ongoing implementation. This revised version intentionally includes strict governance rules, stop conditions, architecture constraints, quality gates, review rubrics, and iteration limits to increase the likelihood that an autonomous coding agent can work without frequent human correction.

---

## 0. Executive control layer for autonomous development

This section is intentionally placed before the product and technical details. The coding agent must use it as the highest-priority operating model whenever instructions conflict or ambiguity appears.

### 0.1 Primary success criterion

The agent's primary objective is not to maximize feature count. The objective is to incrementally create a sustainable, working, self-hosted Trail Router application that satisfies the product goals while minimizing the need for user intervention.

Success means:

- the app becomes usable through many small, verified iterations
- each iteration leaves the repository healthier than before
- the architecture remains simple and consistent
- route generation quality improves over time without breaking navigation
- the user can usually either run `make show` for a deterministic workspace summary or give one of four repo-task commands: `refine`, `implement`, `fix`, or `review`
- the agent does not require frequent clarification because the project rules are explicit

### 0.2 Non-negotiable priorities

When trade-offs appear, apply this priority order:

```yaml
priority_order:
  - correctness_of_core_route_and_navigation_behavior
  - self_hosted_no_registration_architecture
  - small_verified_iterations
  - simplicity_and_low_operational_complexity
  - low_runtime_memory_and_battery_awareness
  - maintainability_and_testability
  - user_experience_for_spontaneous_route_planning
  - feature_completeness
  - polish_and_visual_refinement
```

Implications:

- A boring but working route-generation MVP is better than a sophisticated unfinished optimizer.
- A simple Fastify endpoint is better than a large framework migration.
- A mocked GraphHopper test is better than no test because live data is hard to prepare.
- If exact 20.0 km route fitting conflicts with reliable legal routing in early versions, legal routing wins and the route must show a clear distance warning.
- If heading-up map mode causes battery or stability risk, defer it.

### 0.3 Forbidden autonomous behavior

The agent must not do any of the following unless the user explicitly overrides the rule in a later instruction:

```yaml
forbidden_autonomous_behavior:
  - replacing the chosen frontend framework
  - replacing the chosen backend framework
  - replacing GraphHopper as the routing engine
  - adding a required third-party hosted map or routing provider
  - adding user accounts or authentication
  - adding a route library or saved-route management feature
  - introducing Kubernetes, Terraform, cloud deployment, or managed services
  - introducing microservices beyond the declared Docker Compose services
  - adding PostgreSQL, Redis, or PostGIS before a backlog item proves necessity
  - adding GraphQL
  - adding global state frameworks beyond the approved lightweight state library
  - committing large map artifacts, graph caches, MBTiles, PBF files, logs, or secrets
  - bypassing Git hooks with --no-verify
  - marking work done without running the required checks
  - creating large speculative abstractions for imagined future users
  - implementing multiple unrelated backlog items in one implement command
```

### 0.4 Agent humility and uncertainty policy

The agent must not invent certainty where the project depends on real map data, real GraphHopper behavior, real iPhone browser behavior, or runtime resource constraints.

When uncertain, the agent must:

1. choose the simplest reversible implementation;
2. document the assumption in the relevant YAML item or ADR;
3. add a verification step;
4. avoid broad architectural changes;
5. only ask the user when a stop condition is reached.

The agent should proceed without asking questions when a reasonable default exists in this document.

### 0.5 Stop conditions requiring user input

The agent must stop and ask for explicit user guidance if any of these occurs:

```yaml
stop_conditions:
  - a required architectural decision conflicts with this document
  - the implementation would require a paid or registered third-party dependency
  - a chosen core technology appears technically impossible in the current environment
  - quality gates fail after three genuine fix attempts
  - Docker Compose cannot be made to start because host resources are insufficient
  - a security issue would require changing public exposure or authentication assumptions
  - a backlog item cannot be completed without changing product scope
  - the agent would need to delete or rewrite a large part of existing implementation
  - the Git remote is unavailable for push after initial setup and the command requires push
  - map/routing data licensing or source changes become unclear
```

When stopping, the agent must provide:

- what was attempted
- what failed
- why it matters
- the smallest set of options for the user to decide
- the recommended option

### 0.6 Decision policy for ambiguity

If ambiguity remains but no stop condition applies, choose defaults according to this table:

```yaml
ambiguity_defaults:
  route_type: round_trip
  default_activity: running_walking
  default_surface_preference: mixed
  default_distance_tolerance_meters: 150
  maximum_bidirectional_overlap_meters: 500
  maximum_acceptable_distance_delta_meters: 400
  default_region: Schleswig-Holstein
  default_start_point: last_used_start_point_else_map_click_required
  default_storage: browser_local_storage_only
  default_navigation_map_mode: north_up_follow_position
  default_battery_mode: normal_without_heading_up
  default_tests: unit_tests_plus_limited_smoke_tests
  default_persistence: none
  default_route_candidates_per_request: conservative_small_number_configurable
```

---

## 1. Mission

Build a self-hosted web application for generating and following spontaneous running and cycling routes in Schleswig-Holstein, Germany.

The primary user is one private user. The application does not need commercial-grade guarantees, multi-user scale, billing, account management, legal liability handling, or broad geographic coverage. It should be reliable enough for personal outdoor use and designed sustainably enough that future iterations do not require throwing away the core architecture.

The application must solve a real routing problem: common route planners often create too much asphalt even when trail alternatives exist, struggle with exact target distances, and offer limited influence over surface preferences or route variation.

The app should generate random but useful routes based on:

- activity: walking/running or cycling
- target distance in kilometers
- surface preference: as much trail/unpaved as possible, mixed, as much asphalt as possible, or indifferent
- optional intermediate points or places that the route should pass through
- legal access constraints for pedestrians and cyclists
- operation only within Schleswig-Holstein

The app should then support following the generated route outdoors on an iPhone as a progressive web app or mobile-friendly web app.

## 2. Non-goals

Do not build these features unless a future specification explicitly adds them:

- user accounts
- authentication
- multi-user route libraries
- social sharing
- route marketplace
- route import
- route management UI
- long-term route saving beyond transient session or local last-used defaults
- route notes
- route ratings
- favorite roads or favorite trails
- reversing routes
- cloud provider dependency
- paid map APIs
- Google Maps backend
- mandatory third-party registrations
- global routing
- Germany-wide routing in the initial product
- offline-first native mobile app
- voice navigation
- audio navigation
- commercial safety guarantees

## 3. Core assumptions

- The app is for personal use.
- 90% correctness is acceptable, but obviously illegal or unsafe routes must be avoided as far as OSM data allows.
- The initial map/routing region is Schleswig-Holstein only.
- The server has limited free RAM, approximately 5 GB available, and the application should avoid unnecessary memory pressure.
- Runtime memory should be kept modest; target roughly 1-1.5 GB for the full stack if feasible.
- Heavy data preprocessing may be done as a separate task, but the resulting runtime services must be dockerized.
- No registration should be required for map tiles or routing data.
- OpenStreetMap-derived data is acceptable.
- The user prefers spontaneous routes and does not need a route library.
- Units are always kilometers and kilometers per hour.

## 4. Product concept

There are two major product states.

### 4.0 Canonical user workflow

The default intended journey is simple and map-first:

1. The user begins from the default home-base start at Heidmoorer Straße 18, 24576 Weddelbrook, unless a supported remembered or manually chosen start overrides it.
2. The user optionally adds one or more pass-through points on the map, but this is secondary and often unnecessary.
3. The user sets only the basic route parameters they care about: distance in kilometers and surface preference.
4. The user taps a primary `Generate route` action and receives a real round course that returns to the same start point instead of a point-to-point trip or obvious out-and-back line.
5. If the random route is not appealing, the user can tap again to generate another variation within the same constraints.
6. A normal generated route should stay within a few hundred meters of the requested length, with 400 meters as the hard outer limit for an acceptable default result, and it should ideally avoid any repeated-path overlap in opposite directions.
7. Once a route looks good on the map, the user starts navigation from the same map-first screen.
8. During navigation, the user mainly sees the route and current position on the map plus a compact set of essential guidance metrics.
9. When navigation is finished or manually stopped, the user should be able to return directly to the planning state and start another route quickly.

### 4.0.1 Map-first UX principles

These are durable product constraints, not optional polish:

- The map is the center of the product during both planning and navigation.
- On phone, the map should occupy roughly 80% or more of the visible viewport during planning and active guidance whenever practical.
- Route settings should live in a sidebar, drawer, sheet, or similarly collapsible surface so the user can mostly keep seeing the map and the generated route.
- The product must not leave persistent nonessential popups, verbose diagnostics, or explanatory prose on top of the map during the core journey.
- `Generate route`, `Generate another route`, and `Start navigation` must be obvious primary actions without requiring the user to study long instructions first.
- The generated route should remain mostly visible while the user adjusts parameters, regenerates a route, or follows navigation guidance.

### 4.1 Route planning state

The user configures a route request and receives a candidate route. They may generate another random variation until they like one.

Route planning must support:

- start point:
  - default home-base start at Heidmoorer Straße 18, 24576 Weddelbrook unless another supported remembered or manually chosen start overrides it
  - current GPS position
  - a point selected on the map
  - remembered default/favorite start point
  - fallback to last used start point
- activity:
  - running/walking
  - cycling
- target distance in kilometers
- round-trip route shape:
  - the generated route must end back at the start point
  - the generated route should ideally avoid reusing the same path in both directions and may repeat at most 500 meters total of the same path in opposite directions when no better connector exists
  - point-to-point generation is not the default product mode
- surface preference:
  - mostly trail/unpaved
  - mixed
  - mostly asphalt
  - indifferent/ignore surface preference
- optional pass-through points:
  - map-selected points
  - searched places if geocoding is available locally or implemented later
  - the common flow must still feel complete when the user adds no pass-through points at all
- random route generation:
  - generate one route at a time in the MVP
  - allow generating a new variation
  - return a round course that comes back to the start point
  - prefer true loop geometry over out-and-back retracing
  - keep the route visible on the map while the user decides whether to accept it or generate another one
- route feasibility handling:
  - a normal generated route should stay within a few hundred meters of the requested distance, with 400 meters as the hard outer limit for an acceptable default result
  - a normal generated route should also keep repeated-path overlap below 500 meters total and should ideally avoid any overlap in opposite directions
  - if the requested distance is impossible with mandatory pass-through points, show the shortest sensible route and explain that it exceeds the requested distance
  - if no legal route exists between required points, identify the problematic segment or point as clearly as possible
  - if the route leaves the Schleswig-Holstein data region, reject or warn depending on implementation constraints

### 4.2 Route execution state

The user follows the generated route outdoors.

Route execution must support:

- map view centered on current position
- route line visible on the map
- current GPS position visible
- map-dominant mobile guidance instead of form-heavy or diagnostics-heavy layout
- optional heading-up mode
- north indicator or compass indicator
- distance already completed
- distance remaining
- total route distance
- percentage completed
- current speed in km/h
- average speed in km/h
- estimated remaining time if feasible
- next turn instruction
- distance to next turn
- next street/path name if available from routing instructions or OSM data
- off-route warning when the user deviates from the route beyond a configurable threshold
- clear return to the planning state when navigation is stopped or completed

Audio navigation is not required.

## 5. Required feature set

### 5.1 MVP features

Implement these first.

#### Route planning

- Schleswig-Holstein-only routing data.
- Default local starting point at Heidmoorer Straße 18, 24576 Weddelbrook until the user chooses another supported start or a remembered start overrides it.
- Start point selection by map click.
- Optional current position start point using browser geolocation.
- Remember one default/favorite start point locally.
- Remember last used start point locally.
- Activity selection: running/walking or cycling.
- Target distance input in kilometers.
- Surface preference selection:
  - trail/unpaved as much as possible
  - mixed
  - asphalt as much as possible
  - indifferent
- Generate one random route candidate.
- Ensure the generated route is a round course that returns to the same start.
- Prefer true loop geometry over out-and-back routes, with repeated-path overlap ideally zero and never more than 500 meters total.
- Generate another random variation.
- Keep the normal generated result within a few hundred meters of the requested distance, with 400 meters as the hard outer limit unless explicit feasibility constraints are surfaced.
- Display generated route on map.
- Keep the map visible as the main surface on phone while configuring and inspecting the route.
- Keep route settings collapsible instead of permanently occupying most of the viewport.
- Make `Generate route`, `Generate another route`, and `Start navigation` obvious primary actions near the map.
- Display route summary:
  - total distance
  - estimated surface composition
  - trail/unpaved percentage if derivable
  - asphalt percentage if derivable
  - field/track/other percentage if derivable
  - elevation gain if available
  - warning if surface data is incomplete
- Basic pass-through points by selecting one or more map points.
- Basic error handling for impossible or too-long mandatory routes.

#### Navigation

- Start navigation for current route.
- Show route line.
- Show current GPS position.
- Keep the map dominant on phone during active guidance.
- Keep current position centered during navigation unless the user manually pans.
- Show next instruction and distance to instruction.
- Show completed km, remaining km, total km, progress percent.
- Show current speed and average speed.
- Keep the persistent guidance HUD focused on essential turn, progress, and speed metrics.
- Show off-route warning.
- Let the user return cleanly to the planning state after the route is finished or navigation is stopped.
- Use kilometers and km/h only.

#### Engineering

- Docker Compose local development stack.
- Backend service.
- Frontend service.
- Self-hosted routing service.
- Self-hosted tile service or clearly defined local tile artifact strategy.
- No required third-party registration.
- Automated tests.
- Linting and formatting.
- Git hooks for commit message and quality checks.
- Agent workflow files for roadmap, backlog, findings, commands, and state.

### 5.2 Later features

Only implement after MVP is stable or if generated as explicit backlog items by `refine`.

- more sophisticated route candidate scoring
- multiple candidate routes shown simultaneously
- local geocoding/search for places
- optional direction bias such as north/east/south/west
- better distance fitting by adding/removing small loops
- route rerouting after off-route detection
- better heading-up mode and map tilt
- configurable dashboard metrics
- battery saver mode presets
- elevation profile
- more advanced path classification
- local no-go areas
- local no-go segments
- better route explanation text

## 6. Technical target architecture

Use a self-hosted, Docker-based architecture. Avoid temporary provider-based solutions that would later need to be removed.

Recommended stack:

- Frontend: React, TypeScript, Vite
- Map rendering: MapLibre GL JS
- Backend: Node.js, TypeScript, Fastify
- Routing engine: GraphHopper, self-hosted with Schleswig-Holstein OSM PBF data
- Tiles: self-hosted tiles served by TileServer GL or a similarly dockerizable tile server
- Data source: OpenStreetMap extract for Schleswig-Holstein, preferably Geofabrik PBF
- Persistence: start without PostgreSQL unless needed; use local browser storage for default start point and transient local settings
- Optional later persistence: PostgreSQL + PostGIS
- Package manager: npm only
- Monorepo tooling: simple npm workspaces or Turborepo if justified, but avoid unnecessary complexity
- Testing: Vitest for unit tests, limited Playwright smoke tests only if useful and stable
- Lint/format: ESLint + Prettier
- Git hooks: Husky or Lefthook plus commitlint
- Containerization: Dockerfiles for app services and docker-compose.yml for local orchestration

### 6.1 Runtime services

Initial Docker Compose services:

- `web`: frontend PWA served by a lightweight server, or Vite dev server in development
- `api`: Fastify backend
- `graphhopper`: self-hosted GraphHopper routing service
- `tileserver`: self-hosted map tile service

Optional services only when needed:

- `postgres`: route/session/profile persistence or geospatial features
- `redis`: background jobs or cache

Do not add optional services prematurely.

### 6.2 Repository layout

The agent should create a repository structure similar to this:

```text
trail-router/
  README.md
  docker-compose.yml
  docker-compose.dev.yml              # optional if useful
  package.json
  package-lock.json
  tsconfig.base.json
  .editorconfig
  .gitignore
  .env.example
  .agent/
    README.md
    state.yaml
    commands.yaml
    roadmap.yaml
    architecture.yaml
    product.yaml
    quality.yaml
    backlog/
      README.md
    findings/
      README.md
    epics/
      README.md
    reviews/
      README.md
    decisions/
      README.md
  apps/
    web/
      package.json
      Dockerfile
      src/
    api/
      package.json
      Dockerfile
      src/
  packages/
    shared/
      package.json
      src/
    geo/
      package.json
      src/
  services/
    graphhopper/
      README.md
      config.yml
      custom-models/
        run-trail.json
        bike-mixed.json
    tileserver/
      README.md
      config.json
  data/
    README.md
    osm/
      .gitkeep
    graphhopper/
      .gitkeep
    tiles/
      .gitkeep
  scripts/
    README.md
    setup-data.sh
    dev-up.sh
    dev-down.sh
    verify.sh
    test-compose.sh
  docs/
    product.md
    architecture.md
    routing.md
    navigation.md
    operations.md
```

Generated map/routing artifacts must not be committed unless explicitly small and intended. Use `.gitignore` for PBF, graph-cache, MBTiles, logs, and local environment files.

## 7. Data and map requirements

### 7.1 Region

Initial region is Schleswig-Holstein only.

Use an OSM PBF extract such as:

```text
schleswig-holstein-latest.osm.pbf
```

Store local data under:

```text
data/osm/
data/graphhopper/
data/tiles/
```

Do not commit large map artifacts to Git.

### 7.2 Routing data

GraphHopper must import or load Schleswig-Holstein OSM data.

The agent should prefer a setup where:

- the GraphHopper container can run locally with mounted data
- import/cache generation is documented and scriptable
- runtime starts from an existing graph cache where possible
- memory limits are configured conservatively
- the app can fail clearly if routing data is missing

### 7.3 Tile data

The app must not depend on Google Maps or a registration-based tile provider.

Use self-hosted tiles. Acceptable approaches:

- TileServer GL serving regional MBTiles
- another Docker-friendly OSM tile solution if justified

The frontend must be configured to point at the self-hosted tile endpoint.

If full vector tile generation is too heavy for the first implementation, the agent must still keep the architecture self-hosted and document the data preparation step. It may include a placeholder tile artifact path and a clear error message, but it must not silently fall back to a third-party registered service, and the placeholder must have an explicit tracked removal item.

### 7.4 Temporary placeholders and fallbacks

Temporary placeholders are allowed only when all of the following are true:

- the placeholder is explicitly called out in the roadmap, epic, or backlog item
- the user-visible state is labeled as temporary, unavailable, or incomplete
- an open backlog item already exists to remove or replace the placeholder
- roadmap progress and any done state exclude the capability that still depends on the placeholder

Forbidden:

- fallbacks that make a missing capability look finished
- user-visible placeholders without a linked removal item
- closing an epic or phase while a core user journey still depends on a temporary placeholder

## 8. Routing behavior

### 8.1 Activity modes

Support two activity modes:

#### Running/walking

Allowed route candidates should prefer:

- paths
- tracks
- footways
- pedestrian ways
- trails/unpaved ways where legal
- quiet roads only when necessary

Avoid or reject:

- motorways
- trunk roads where pedestrian access is prohibited
- private/no-access roads
- ways with foot=no or access=no where applicable
- unsafe or unsuitable roads where OSM tags indicate no pedestrian use

#### Cycling

Allowed route candidates should prefer:

- cycleways
- tracks where bicycles are allowed
- quiet roads
- asphalt or trail depending on surface preference

Avoid or reject:

- motorways
- ways with bicycle=no
- private/no-access roads
- foot-only paths if cycling is prohibited
- roads unsuitable for cycling as indicated by OSM tags

### 8.2 Surface preferences

Surface preference values:

```yaml
surfacePreference:
  enum:
    - trail
    - mixed
    - asphalt
    - indifferent
```

Interpretation:

- `trail`: maximize unpaved/trail/path/track/ground/gravel/forest-like segments while remaining legal and routable
- `mixed`: prefer a balanced route with meaningful unpaved/trail content but do not over-optimize
- `asphalt`: prefer paved/asphalt roads or paths, while still avoiding illegal roads
- `indifferent`: do not materially score surface composition; optimize mostly for route feasibility and target distance

It is acceptable that `trail` cannot produce 100% trail. The UI should present actual surface composition and warn when classification is uncertain.

### 8.3 Route generation strategy

The app should not rely on a single shortest-path route.

The backend should generate route candidates using a strategy such as:

1. Determine start point and target distance.
2. Generate random candidate waypoint sets within plausible radius.
3. Respect optional pass-through points.
4. Bias candidate points by optional direction if implemented.
5. Request routes from GraphHopper.
6. Evaluate each route.
7. Score route according to distance error, surface preference, legality, road class, and usability.
8. Return the best candidate for MVP.
9. On user request, generate a new candidate with a different random seed.

For round trips, candidate generation may use triangles, loops, or multiple intermediate points. Avoid routes that simply go out and back along the same line. If a short unavoidable connector forces some retracing, the repeated-path overlap should stay below 500 meters total and should ideally be zero.
Point-to-point generation is not the normal Pathbadger product mode.

### 8.4 Distance handling

Target distance is important.

Initial tolerance may be configurable, defaulting to something like:

```yaml
distanceToleranceMeters: 150
maximumBidirectionalOverlapMeters: 500
maximumAcceptableDistanceDeltaMeters: 400
```

Behavior:

- Try to generate a round course within the internal tolerance.
- Prefer routes with no repeated-path overlap in opposite directions; never accept a normal route that exceeds 500 meters total of such overlap.
- Do not present a normal route as acceptable if it exceeds the target by more than 400 meters in either direction.
- If not possible within the allowed effort budget, return an explicit failure or feasibility warning rather than silently accepting a much longer or shorter loop.
- If mandatory points imply a route longer than target, return the shortest feasible route and explain the minimum distance.
- Later, implement a distance fitter that adds or removes small loops to approach the target more precisely.

### 8.5 Route scoring

The agent should create a dedicated scoring module. Avoid scattering scoring logic across controllers.

A conceptual scoring model:

```text
score =
  distance_fit_score
  + surface_preference_score
  + low_traffic_score
  + loop_quality_score
  + access_legality_score
  + elevation_score
  - forbidden_segment_penalty
  - excessive_major_road_penalty
  - out_and_back_penalty
```

Forbidden segments should be hard rejects, not merely penalties, when known from data.

### 8.6 Surface statistics

The backend should produce route statistics if possible:

- total distance km
- distance by surface type
- percentage by surface type
- paved/asphalt percentage
- unpaved/trail percentage
- track/path/field/other percentage
- unknown percentage
- elevation gain if available

Represent unknown data honestly. Do not invent precision.

## 9. Navigation behavior

### 9.1 Browser APIs

Use browser geolocation:

```text
navigator.geolocation.watchPosition()
```

Use HTTPS in production. Local development can rely on localhost behavior.

### 9.2 Local navigation calculations

During active navigation, avoid unnecessary backend calls.

The frontend should keep route geometry and instructions locally and compute:

- nearest point on route polyline
- progress along route
- remaining distance
- distance to next instruction
- off-route distance
- current speed if provided by GPS or computed conservatively
- average speed from session track

### 9.3 Map modes

Initial modes:

- north-up mode
- follow-position mode

Later modes:

- heading-up mode
- tilted map mode

Heading-up and tilt can increase complexity and energy usage. Implement only when stable.

### 9.4 Off-route handling

Initial off-route behavior:

- detect if user is more than a threshold away from route, for example 30-50 meters
- show visible warning
- do not automatically reroute in MVP

Later:

- offer reroute to rejoin the route
- offer route recalculation

### 9.5 Navigation metrics

Show at minimum:

- completed km
- remaining km
- total km
- percent complete
- current speed km/h
- average speed km/h
- next turn instruction
- distance to next turn

Settings may later choose which metrics to display.

## 10. Energy usage requirements

Battery consumption matters, especially on iPhone.

Design choices:

- avoid frequent backend calls during navigation
- use local route-following calculations
- avoid unnecessary map animations
- make heading-up optional
- make map tilt optional or defer it
- allow a battery saver mode
- avoid excessive GPS update work
- do not perform heavy route generation in the browser
- cache route geometry locally during a navigation session
- reduce re-renders in React during GPS updates
- keep map layers simple

Potential battery modes:

```yaml
batteryModes:
  normal:
    gpsUpdateHandling: normal
    mapAnimations: limited
    headingUp: optional
  saver:
    gpsUpdateHandling: reduced
    mapAnimations: minimal
    headingUp: false
    mapPitch: 0
```

The MVP does not need perfect power optimization, but the architecture must not be wasteful.

## 10A. Architecture governance and dependency policy

This section freezes the initial technical shape. The agent may refine internal implementation but must not drift into a different stack.

### 10A.1 Approved technologies

```yaml
approved_stack:
  language:
    - TypeScript
  package_manager:
    - npm
  frontend:
    framework: React
    build_tool: Vite
    map_renderer: MapLibre GL JS
    state: Zustand
    server_state: TanStack Query
    routing: React Router
  backend:
    runtime: Node.js
    framework: Fastify
    validation: Zod
    logging: pino_or_fastify_logger
  geospatial:
    routing_engine: GraphHopper
    map_data: OpenStreetMap Schleswig-Holstein PBF
    tile_server: TileServer GL or justified Docker-compatible self-hosted equivalent
  tests:
    unit: Vitest
    ui_smoke: Playwright only for stable smoke tests
  quality:
    lint: ESLint
    format: Prettier
    hooks: Lefthook or Husky
    commits: commitlint with Conventional Commits
  containers:
    orchestration: Docker Compose
```

### 10A.2 Disallowed dependencies unless explicitly approved

```yaml
forbidden_dependencies:
  frontend:
    - Next.js
    - Angular
    - Vue
    - Redux
    - MobX
  backend:
    - NestJS
    - Express replacement for Fastify
    - GraphQL
  data:
    - MongoDB
    - required hosted database
  operations:
    - Kubernetes
    - cloud-only infrastructure
    - mandatory SaaS APIs
  maps_and_routing:
    - Google Maps backend
    - Mapbox account requirement
    - paid routing APIs
    - registration-required tile provider as core dependency
```

### 10A.3 Framework replacement rule

The agent must not replace a core framework because another tool would be easier. Replacement is allowed only when all are true:

1. an existing ADR documents the problem;
2. a review finding marks the current technology as a blocker;
3. a migration backlog item is created by `refine`;
4. the user explicitly approves the migration.

### 10A.4 Simplicity budget

Every new library, service, or package must have a concrete reason. Before adding one, the agent must ask internally:

- Does this solve a current backlog item?
- Can TypeScript standard library or existing dependencies handle it?
- Does this increase runtime memory, build time, or cognitive load?
- Can it be isolated behind a small adapter?

If the answer is not compelling, do not add the dependency.

### 10A.5 Resource budget

The full local runtime stack should aim for conservative memory usage.

```yaml
resource_budget:
  server_available_ram_context: approximately_5_gb_free
  preferred_runtime_total: 1_to_1_5_gb_if_feasible
  graphhopper_target: 512mb_to_1024mb_initial
  api_target: 128mb_to_256mb
  web_target: 64mb_to_128mb
  tileserver_target: 256mb_to_512mb
  avoid:
    - germany_wide_import_initially
    - heavy_database_services_without_need
    - browser_side_route_generation_heavy_computation
```

The agent must document if real measurements exceed these budgets.

### 10A.6 Architecture Decision Records

The agent must maintain ADRs under:

```text
docs/adr/
```

Use ADRs for decisions that affect architecture or future maintenance. Initial ADRs should include:

- using GraphHopper for self-hosted routing
- using MapLibre for map rendering
- using Schleswig-Holstein-only OSM data initially
- avoiding route persistence and user accounts
- using Docker Compose rather than cloud infrastructure
- using browser-local storage for preferences

ADR format:

```markdown
# ADR-0001: Title

## Status

accepted | superseded | proposed

## Context

What decision was needed and why.

## Decision

What was chosen.

## Consequences

Positive and negative consequences.

## Alternatives considered

Other options and why they were rejected.
```

---

## 10B. Product governance and scope discipline

### 10B.1 Product invariants

The agent must keep these product invariants true:

```yaml
product_invariants:
  - the app is for spontaneous routes, not route library management
  - running/walking and cycling are the only initial activities
  - route planning and route execution are the two main states
  - Schleswig-Holstein is the initial operating region
  - kilometers and km/h are the only units
  - access restrictions are hard constraints when known
  - surface preference affects route scoring and summary
  - route summary must be honest about unknown surface data
  - navigation should work without backend calls during active following
```

### 10B.2 Removed features must stay removed

These features were explicitly rejected and must not reappear as backlog items unless the user later requests them:

```yaml
removed_features:
  - route_library
  - route_import
  - route_export_as_core_need
  - route_notes
  - route_ratings
  - favorite_way_preference
  - reverse_route
  - social_sharing
  - user_accounts
```

GPX export may be useful technically, but it is not a user-priority feature. Do not implement it before core route generation and navigation unless it becomes necessary for testing or debugging.

### 10B.3 Product acceptance philosophy

For product behavior, prefer visible honest feedback over silent failure:

- If the route is 20.4 km instead of 20.0 km, show the delta.
- If only 35% of surface tags are known, show unknown percentage.
- If the route leaves the data boundary, warn or fail explicitly.
- If mandatory pass-through points force a longer route, show the shortest feasible route and explain why.
- If GPS accuracy is poor, show accuracy state rather than pretending precision.

---

## 11. Agent operating model

The agent must operate the repository through four primary commands:

```text
refine
implement
fix
review
```

The agent may also perform initial repository setup from this document. During initial setup, it must not commit.

After the repository is connected to a remote Git repository by the user, every subsequent `refine`, `implement`, `fix`, and `review` command must end with a successful commit and push unless explicitly instructed otherwise or technically impossible.

### 11.1 Initial setup command

When first given this document in an empty directory, the agent must:

1. Create the repository file structure.
2. Create `.agent/` workspace.
3. Convert this document into structured YAML specifications.
4. Create product, architecture, quality, roadmap, and command specs.
5. Create initial backlog and first epic.
6. Create project README and docs.
7. Create base package/workspace files.
8. Create Docker Compose skeleton.
9. Create placeholder services if necessary, but keep them clearly inert and track their removal explicitly.
10. Create scripts for verification.
11. Do not commit.
12. Clearly tell the user that the initial setup is complete and that they can connect the remote repository.

### 11.2 `refine`

Purpose: update planning state only.

`refine` must:

1. Inspect the full workspace.
2. Read `.agent/roadmap.yaml`, `.agent/state.yaml`, `.agent/product.yaml`, `.agent/architecture.yaml`, `.agent/quality.yaml`, current epics, backlog items, and findings.
3. Compare current implementation with the big picture.
4. Determine what is completed, partially completed, blocked, or missing.
5. Close completed backlog items.
6. Close completed findings if they are fixed.
7. Close current epic if all its items are complete.
8. Update roadmap progress honestly.
9. Select or create the next epic based on remaining product/technical scope.
10. Break the next epic into small implementable backlog items.
11. Ensure each backlog item has clear acceptance criteria and verification steps.
12. Avoid changing source code unless strictly necessary to keep agent specs valid.
13. Commit and push planning/spec changes.

`refine` must also inventory user-visible temporary placeholders, ensure each one has a linked exit item, and keep the related epic or phase incomplete until that exit item is done.

`refine` may modify:

- `.agent/state.yaml`
- `.agent/roadmap.yaml`
- `.agent/epics/*`
- `.agent/backlog/*`
- `.agent/findings/*` only to close fixed findings
- docs that summarize planning state

`refine` must not implement product code except for trivial documentation/spec consistency fixes.

### 11.3 `implement`

Purpose: implement exactly one actionable backlog item.

`implement` must:

1. Select exactly one open backlog item.
2. Prefer highest priority and unblocked status.
3. Read acceptance criteria.
4. Modify code/config/tests/docs needed for that one item.
5. Add or update tests.
6. Run quality checks.
7. Start Docker Compose if the item requires integration verification.
8. Stop Docker Compose after verification.
9. Update the item status and implementation notes.
10. Commit and push.

If `implement` discovers that a new user-visible placeholder is necessary but not already tracked, it must block the current item and hand control back to `refine` rather than shipping an unplanned placeholder.

`implement` must not:

- silently implement multiple unrelated backlog items
- rewrite the roadmap
- delete large parts of the architecture without explicit item scope
- skip tests because they are inconvenient
- commit broken code

If hooks or tests fail, the agent must fix the issue and retry until the quality gate passes or a genuine blocker is documented.

### 11.3A `fix`

Purpose: resolve exactly one open finding.

`fix` must:

1. Select exactly one open finding from `.agent/findings/`.
2. Prefer the highest-severity unblocked finding.
3. Read the finding evidence, recommendation, acceptance criteria, and verification steps.
4. Make the smallest viable change that resolves that one finding.
5. Add or update tests.
6. Run quality checks.
7. Start Docker Compose if the finding requires integration verification.
8. Stop Docker Compose after verification.
9. Update the finding status and closure notes.
10. Commit and push.

`fix` must not:

- silently resolve multiple unrelated findings
- rewrite the roadmap
- close a finding without verification evidence
- commit broken code

### 11.4 `review`

Purpose: audit the whole workspace and produce findings.

`review` must:

1. Inspect the full workspace.
2. Treat any extra tokens after `review` as optional emphasis hints only, never as permission to narrow the audit to a commit, diff, or file subset.
3. Compare implementation against product and architecture specs.
4. Check quality, security, maintainability, and consistency.
5. Look for dead code, duplication, weak tests, config drift, missing docs, and security issues.
6. Run static checks if available.
7. Optionally run tests and Docker Compose verification if appropriate.
8. Produce findings as structured items under `.agent/findings/`.
9. Do not modify roadmap progress.
10. Do not change product scope.
11. Do not close or create epics unless explicitly part of review metadata, not roadmap state.
12. Commit and push review findings.

`review` is the correction mechanism when implementation quality is poor or when the agent previously marked something complete incorrectly.

`review` must also scan for user-visible placeholders, stubs, demo data, and fallback behavior; verify that each one has a tracked exit item; and raise at least a high-severity finding when a placeholder is orphaned or survives inside a done state.

### 11.5 Command transaction model

Each mutating command must be treated as a transaction with phases:

```yaml
command_transaction:
  phases:
    - read_state
    - plan_minimal_change
    - apply_change
    - verify
    - update_agent_metadata
    - commit
    - push
    - report
```

If a phase fails, the agent must not pretend success. It must either fix the failure within the command scope or stop with a clear blocker.

### 11.6 `implement` item selection algorithm

When `implement` is invoked, choose exactly one item using this order:

1. P0 backlog items in current epic;
2. P1 backlog items in current epic;
3. blocked-item unblocking chores if they are the smallest next step;
4. ask for `refine` if no actionable backlog item exists.

### 11.6A `fix` finding selection algorithm

When `fix` is invoked, choose exactly one finding using this order:

1. critical severity open findings;
2. high severity open findings;
3. medium severity open findings;
4. low severity open findings;
5. ask for `review` or `refine` if no open finding exists.

Shared tie-breakers for `implement` and `fix`:

- choose the smallest item that moves the product forward;
- prefer foundation and verification work before feature work;
- prefer route correctness before UI polish;
- prefer code with tests over UI-only polish.

### 11.7 Maximum item size

The agent must keep each `implement` small.

```yaml
item_size_limits:
  target_changed_files_max: 12
  hard_changed_files_max: 20
  target_net_lines_changed_max: 500
  hard_net_lines_changed_max: 900
  target_duration: one_focused_iteration
```

If an item requires more than this, the agent must split it during `refine` before implementing.

Exceptions are allowed for initial generated scaffolding, lockfile changes, or mechanical formatting, but the agent must document the reason in the item notes.

### 11.8 Definition of Ready

An item may be implemented only if it has:

```yaml
definition_of_ready:
  - clear_title
  - parent_epic_or_finding_origin
  - scope
  - acceptance_criteria
  - verification_steps
  - no_unresolved_architecture_conflict
  - estimated_small_enough_for_one_implement
```

If not ready, `implement` must either select a different item or create a finding that refinement is needed.

### 11.9 Definition of Done

An item can be marked done only if all applicable conditions hold:

```yaml
definition_of_done:
  - acceptance_criteria_met
  - relevant_tests_added_or_updated
  - lint_passes
  - typecheck_passes
  - unit_tests_pass
  - formatting_passes
  - docker_compose_config_valid_if_stack_touched
  - runtime_smoke_test_passes_if_service_wiring_touched
  - documentation_updated_if_behavior_or_commands_changed
  - no_new_secrets_or_large_artifacts_committed
  - no_unrelated_scope_changes
  - commit_created_with_valid_conventional_commit
  - push_successful_when_remote_available
```

If any condition is not applicable, document why in the item implementation notes.

### 11.10 `refine` must not become design churn

`refine` is allowed to update the plan, but it must not constantly redesign the product.

Rules:

- Keep the current roadmap phases unless a concrete implementation fact requires adjustment.
- Do not create more than one active epic.
- Do not create more than 5 to 8 open backlog items for the active epic unless necessary.
- Prefer completing the active epic before opening another.
- Do not add nice-to-have features while P0/P1 MVP gaps remain.
- Do not inflate progress percentages; progress must correspond to tested, working behavior.

### 11.11 `review` finding quality bar

A review finding must be actionable. It must not be a vague suggestion.

Good finding:

```yaml
title: Add input validation for route generation request
severity: high
category: security
evidence:
  - apps/api/src/routes/generate.ts accepts unvalidated JSON
impact: malformed input can crash route generation or produce unsafe requests
recommendation: validate request body with shared Zod schema before routing logic
acceptance_criteria:
  - invalid activity values return 400
  - invalid coordinates return 400
  - tests cover invalid body cases
```

Bad finding:

```yaml
title: Improve code
recommendation: make it cleaner
```

### 11.12 Review must separate defects from ideas

`review` must categorize output as:

```yaml
review_output_types:
  finding: violation_or_defect_that_should_be_fixed
  improvement_candidate: useful_but_not_currently_required
  accepted_risk: known_limitation_deliberately_not_fixed_now
```

Only findings become implementable items. Improvement candidates may be recorded in review notes but must not flood the backlog.

### 11.13 Self-correction loop

If hooks, tests, or compose checks fail during `implement`, the agent must:

1. inspect the failure;
2. make the smallest fix;
3. rerun the failing check first;
4. rerun full verification;
5. retry commit/push.

After three failed attempts on the same root issue, stop and report a blocker.

### 11.14 Commit and push boundaries

Each successful command should usually produce one commit. If a command necessarily produces multiple commits, each commit must be coherent and hook-clean.

`implement` commit message format:

```text
type(scope): concise result
```

Commit body should include item ID:

```text
Refs: ITEM-0007
```

`review` commit body should include generated finding IDs.

`refine` commit body should include affected epic/item IDs.

---

## 12. Agent workspace specification

The agent must maintain structured YAML files. Markdown can explain, but YAML is the primary state format.

### 12.1 `.agent/product.yaml`

Must include:

```yaml
product:
  name: trail-router
  purpose: spontaneous self-hosted route generation and route following for running and cycling in Schleswig-Holstein
  region: Schleswig-Holstein
  users:
    - private_single_user
  activities:
    - running_walking
    - cycling
  units:
    distance: km
    speed: kmh
  non_goals: []
  feature_groups:
    route_planning: []
    navigation: []
    settings: []
    diagnostics: []
```

### 12.2 `.agent/architecture.yaml`

Must include:

```yaml
architecture:
  stack:
    frontend: React + TypeScript + Vite
    map: MapLibre GL JS
    backend: Node.js + TypeScript + Fastify
    routing: GraphHopper self-hosted
    tiles: self-hosted TileServer GL or equivalent
    data: OpenStreetMap Schleswig-Holstein PBF
  services:
    web: {}
    api: {}
    graphhopper: {}
    tileserver: {}
  constraints:
    no_registration_required: true
    no_google_maps_backend: true
    docker_compose_required: true
    low_memory_runtime: true
```

### 12.3 `.agent/quality.yaml`

Must define:

```yaml
quality:
  required_checks:
    - lint
    - typecheck
    - unit_tests
    - docker_compose_config_validation
  optional_checks:
    - playwright_smoke
    - docker_compose_runtime_smoke
  commit_policy:
    conventional_commits: true
    require_scope: true
    commit_must_pass_hooks: true
  security:
    no_secrets_committed: true
    validate_inputs: true
    avoid_untrusted_shell_execution: true
```

### 12.4 `.agent/roadmap.yaml`

Must include the big picture and progress estimate.

Example structure:

```yaml
roadmap:
  version: 1
  overall_progress_percent: 0
  phases:
    - id: foundation
      title: Repository, specs, tooling, Docker skeleton
      status: planned
      progress_percent: 0
    - id: routing-core
      title: Self-hosted GraphHopper routing for Schleswig-Holstein
      status: planned
      progress_percent: 0
    - id: map-ui
      title: MapLibre map UI and route display
      status: planned
      progress_percent: 0
    - id: route-generation
      title: Random route generation, scoring, distance handling
      status: planned
      progress_percent: 0
    - id: navigation
      title: GPS route following and navigation metrics
      status: planned
      progress_percent: 0
    - id: hardening
      title: QA, energy behavior, security, docs, operations
      status: planned
      progress_percent: 0
  current_epic: null
  completed_summary: []
  remaining_summary: []
```

### 12.5 `.agent/state.yaml`

Must include:

```yaml
state:
  initialized: true
  current_command: null
  current_epic: null
  current_item: null
  last_refine: null
  last_implement: null
  last_review: null
  remote_connected: false
  require_commit_and_push_after_initial_setup: true
```

The agent may update `remote_connected` after detecting a Git remote.

### 12.5A `.agent/governance.yaml`

Must include all hard operating rules in machine-readable form:

```yaml
governance:
  priority_order:
    - correctness_of_core_route_and_navigation_behavior
    - self_hosted_no_registration_architecture
    - small_verified_iterations
    - simplicity_and_low_operational_complexity
    - low_runtime_memory_and_battery_awareness
    - maintainability_and_testability
    - user_experience_for_spontaneous_route_planning
    - feature_completeness
    - polish_and_visual_refinement
  forbidden_autonomous_behavior: []
  stop_conditions: []
  item_size_limits:
    target_changed_files_max: 12
    hard_changed_files_max: 20
    target_net_lines_changed_max: 500
    hard_net_lines_changed_max: 900
  command_rules:
    refine_updates_roadmap: true
    implement_exactly_one_item: true
    review_does_not_update_roadmap: true
```

### 12.5B `.agent/dependencies.yaml`

Must include approved and forbidden technologies:

```yaml
dependencies:
  approved_stack: {}
  forbidden_dependencies: {}
  dependency_addition_policy:
    require_current_item_need: true
    prefer_existing_dependency: true
    document_reason_in_item_notes: true
```

### 12.5C `.agent/testing.yaml`

Must define test layers and when each is required:

```yaml
testing:
  unit:
    required_for:
      - geo_calculations
      - scoring
      - validation
      - candidate_generation
      - route_progress
  integration:
    required_for:
      - api_routes
      - graphhopper_adapter_with_mocked_http
      - docker_compose_config
  playwright_smoke:
    limited_to:
      - app_loads
      - planning_form_renders
      - route_preview_from_fixture
      - navigation_view_from_fixture
    avoid:
      - brittle_map_pixel_assertions
      - full_real_gps_tests
```

### 12.5D `.agent/review-rubric.yaml`

Must define review categories and severity rules:

```yaml
review_rubric:
  categories:
    - architecture
    - product_gap
    - correctness
    - security
    - maintainability
    - duplication
    - dead_code
    - performance
    - battery
    - testing
    - documentation
    - operations
    - mobile_usability
  severity_rules:
    critical: breaks_build_or_security_or_core_route_safety
    high: blocks_mvp_or_creates_likely_wrong_routes
    medium: degrades_maintainability_or_user_experience
    low: minor_quality_gap
  finding_requirements:
    - evidence
    - impact
    - recommendation
    - acceptance_criteria
    - verification
```

### 12.5E `.agent/metrics.yaml`

Must track objective project health signals:

```yaml
metrics:
  product_progress:
    overall_percent: 0
    route_planning_percent: 0
    routing_core_percent: 0
    navigation_percent: 0
    hardening_percent: 0
  quality:
    open_critical_findings: 0
    open_high_findings: 0
    test_status: unknown
    lint_status: unknown
    typecheck_status: unknown
    compose_status: unknown
  runtime:
    measured_memory_mb: null
    graphhopper_memory_mb: null
    api_memory_mb: null
    web_memory_mb: null
    tileserver_memory_mb: null
```

---

### 12.6 Backlog item format

Backlog items are YAML files under `.agent/backlog/`.

Naming:

```text
ITEM-0001-short-slug.yaml
```

Required structure:

```yaml
id: ITEM-0001
type: feature | chore | bug | finding | test | docs | infra
priority: P0 | P1 | P2 | P3
status: open | in_progress | done | blocked
scope: api | web | graphhopper | tileserver | docker | agent | docs | shared | geo | qa
origin: refine | review | user
parent_epic: EPIC-0001
title: short imperative title
summary: concise description
acceptance_criteria:
  - criterion
verification:
  - command or manual check
implementation_notes: []
created_at: ISO-8601 timestamp
updated_at: ISO-8601 timestamp
closed_at: null
```

Optional when a backlog item intentionally introduces or preserves a temporary placeholder:

```yaml
temporary_placeholder:
  user_visible: true | false
  label: short_description_of_the_placeholder_state
  exit_item: ITEM-0002
  exit_criteria:
    - criterion
```

### 12.7 Epic format

Epics are YAML files under `.agent/epics/`.

Naming:

```text
EPIC-0001-short-slug.yaml
```

Required structure:

```yaml
id: EPIC-0001
status: open | done | blocked
phase: foundation | routing-core | map-ui | route-generation | navigation | hardening
title: short title
objective: clear outcome
success_criteria:
  - criterion
items:
  - ITEM-0001
created_at: ISO-8601 timestamp
updated_at: ISO-8601 timestamp
closed_at: null
```

### 12.8 Finding format

Findings are YAML files under `.agent/findings/`.

Naming:

```text
FINDING-0001-short-slug.yaml
```

Required structure:

```yaml
id: FINDING-0001
status: open | in_progress | done | accepted_risk
severity: critical | high | medium | low
category: security | correctness | maintainability | performance | testing | docs | architecture | product_gap
title: short finding title
evidence:
  - file or behavior reference
impact: why it matters
recommendation: what to change
acceptance_criteria:
  - criterion
verification:
  - command or check
created_at: ISO-8601 timestamp
updated_at: ISO-8601 timestamp
closed_at: null
```

## 13. Git and commit policy

### 13.1 Initial setup

During initial setup from this document:

- create files
- do not commit
- do not push
- tell the user to connect the remote repository

### 13.2 After initial setup

For every `refine`, `implement`, and `review` after a Git remote exists:

- changes must end in a successful commit and push
- if commit fails, fix and retry
- if push fails because no remote exists, update state and report clearly
- never bypass hooks with `--no-verify` unless explicitly authorized by the user

### 13.3 Conventional commits

Use Conventional Commits.

Allowed types:

- `feat`
- `fix`
- `docs`
- `style`
- `refactor`
- `perf`
- `test`
- `build`
- `ci`
- `chore`
- `revert`

Required scopes:

- `web`
- `api`
- `geo`
- `shared`
- `routing`
- `tiles`
- `docker`
- `agent`
- `docs`
- `qa`
- `deps`

Format:

```text
type(scope): summary
```

Examples:

```text
feat(api): add route request schema
chore(agent): create initial roadmap and backlog
fix(web): prevent navigation progress from exceeding total distance
test(geo): cover polyline projection edge cases
```

### 13.4 Hooks

Install hooks to enforce:

- commit message type and scope
- linting
- type checking
- unit tests where feasible
- formatting checks
- secret scanning if lightweight tool is available

Pre-commit should be reasonably fast. Heavier integration checks may run pre-push.

## 14. Quality assurance strategy

### 14.1 Unit tests

Use unit tests for:

- route request validation
- scoring functions
- distance calculations
- polyline projection
- route progress calculation
- off-route distance calculation
- instruction selection
- surface composition aggregation
- random candidate generation constraints

### 14.2 Integration tests

Use integration tests for:

- API route generation endpoint with mocked GraphHopper
- API error handling
- Docker Compose config validity
- GraphHopper adapter behavior with mocked HTTP responses

### 14.3 UI tests

Do not overinvest in Playwright at the beginning.

Recommended initial Playwright smoke tests only:

- app loads
- map container renders with test configuration or mocked map
- route request form can be filled
- navigation screen can render from fixture route

Avoid brittle map pixel tests.

### 14.4 Docker Compose verification

Provide scripts:

```text
scripts/dev-up.sh
scripts/dev-down.sh
scripts/verify.sh
scripts/test-compose.sh
```

`verify.sh` should run:

- install check or dependency check if needed
- lint
- typecheck
- unit tests
- format check

`test-compose.sh` should:

- validate compose config
- start required services if possible
- run health checks
- stop services

The agent should use Docker Compose during `implement` when the item touches service wiring or integration.

### 14.5 Security checks

The app is private but still must avoid obvious mistakes:

- no secrets committed
- no API keys required for core operation
- no unauthenticated destructive admin endpoints exposed unintentionally
- validate API inputs with schemas
- avoid arbitrary file path access
- avoid arbitrary shell execution
- keep browser-facing traffic same-origin through the frontend proxy and only add CORS deliberately when that proxy contract is intentionally changed
- avoid exposing GraphHopper or tile server publicly unless intended
- document production reverse proxy assumptions

## 15. Backend API requirements

### 15.1 Core endpoints

Initial API endpoints:

```text
GET /health
POST /routes/generate
POST /routes/analyze
```

Later endpoints:

```text
POST /routes/reroute
GET /config/client
```

### 15.2 Route generation request

Conceptual schema:

```yaml
RouteGenerateRequest:
  start:
    lat: number
    lon: number
  targetDistanceKm: number
  activity: running_walking | cycling
  surfacePreference: trail | mixed | asphalt | indifferent
  passThroughPoints:
    - lat: number
      lon: number
  randomSeed: string | null
  toleranceMeters: number
```

### 15.3 Route generation response

Conceptual schema:

```yaml
RouteGenerateResponse:
  routeId: string
  status: success | partial | failed
  warnings:
    - code: string
      message: string
  summary:
    totalDistanceKm: number
    targetDistanceKm: number
    distanceDeltaMeters: number
    elevationGainMeters: number | null
    surface:
      asphaltPercent: number | null
      trailUnpavedPercent: number | null
      fieldTrackOtherPercent: number | null
      unknownPercent: number | null
  geometry:
    type: LineString
    coordinates:
      - [lon, lat]
  instructions:
    - distanceFromStartMeters: number
      distanceToNextMeters: number | null
      type: string
      text: string
      streetName: string | null
      coordinate: [lon, lat]
  debug:
    candidateCount: number
    score: number | null
```

Do not expose excessive debug data in production unless behind config.

## 16. Frontend requirements

### 16.1 Planning screen

Fields:

- start point selector
- activity selector
- target distance input
- surface preference selector
- pass-through point mode
- generate route button
- generate another variation button

Route preview:

- route line
- start marker
- pass-through markers
- summary panel
- warnings
- start navigation button

### 16.2 Navigation screen

Elements:

- map
- route line
- current position marker
- next instruction panel
- distance to next turn
- completed km
- remaining km
- total km
- percent complete
- current speed
- average speed
- off-route warning
- stop navigation button

### 16.3 Local settings

Persist locally:

- favorite/default start point
- last start point
- last activity
- last surface preference
- preferred navigation map mode
- battery mode if implemented

Use localStorage or IndexedDB. Keep it simple.

## 17. Implementation standards

### 17.1 TypeScript

- Use strict TypeScript.
- Share common route types between API and frontend via `packages/shared`.
- Keep geospatial utility code in `packages/geo`.
- Validate API inputs using a schema library such as Zod.

### 17.2 Error handling

Return structured errors:

```yaml
error:
  code: ROUTE_NOT_FOUND | OUT_OF_REGION | INVALID_REQUEST | ROUTING_ENGINE_UNAVAILABLE | DATA_MISSING
  message: user-readable message
  details: optional diagnostic object
```

Do not expose stack traces to the frontend in production.

### 17.3 Logging

Use structured logging in the backend.

Log:

- route generation request metadata without sensitive data
- routing engine failures
- candidate generation failures
- timing metrics

Do not log precise user location unnecessarily in production logs unless needed for debugging and clearly documented.

### 17.4 Configuration

Use environment variables and `.env.example`.

Important values:

```text
API_PORT
GRAPHHOPPER_URL
TILESERVER_URL
PUBLIC_API_BASE_URL
PUBLIC_TILE_STYLE_URL
REGION_NAME
MAX_TARGET_DISTANCE_KM
DEFAULT_DISTANCE_TOLERANCE_METERS
```

`PUBLIC_API_BASE_URL` must stay same-origin at `/api` in the supported browser-facing topology. Absolute browser API origins are unsupported unless the frontend proxy contract is intentionally changed and the API deliberately regains browser CORS support.

`PUBLIC_TILE_STYLE_URL` must point at a real self-hosted style document. If it
is unreachable, the planning map must fail with an explicit error state instead
of substituting bundled or synthetic cartography.

## 18. Suggested roadmap phases

### Phase 1: Foundation

Goal: repository, tooling, specs, Docker skeleton.

Deliverables:

- monorepo structure
- `.agent` specs
- README
- package manager setup
- lint/typecheck/test setup
- Docker Compose skeleton
- Git hooks
- verification scripts

### Phase 2: Routing core

Goal: self-hosted GraphHopper integration for Schleswig-Holstein.

Deliverables:

- GraphHopper service config
- data setup docs/scripts
- API health checks
- GraphHopper adapter
- route request/response schemas
- mocked adapter tests

### Phase 3: Map UI

Goal: display map and route preview.

Deliverables:

- MapLibre integration
- self-hosted tile style config
- route line rendering
- start/pass-through point selection
- planning form

### Phase 4: Route generation and scoring

Goal: random route generation matching user preferences.

Deliverables:

- candidate generator
- scoring module
- surface preference mapping
- distance tolerance logic
- warnings for partial fit
- route summary/statistics

### Phase 5: Navigation

Goal: follow route outdoors.

Deliverables:

- browser GPS watch
- progress calculation
- next instruction display
- speed metrics
- off-route detection
- follow-position map behavior

### Phase 6: Hardening

Goal: improve reliability, maintainability, energy behavior.

Deliverables:

- performance/battery improvements
- robust error handling
- review findings cleanup
- documentation
- operational notes

## 19. Initial backlog recommendation

During initial setup, create an initial epic for foundation and small items such as:

- create monorepo package structure
- create `.agent` YAML specs
- configure TypeScript base
- configure ESLint and Prettier
- configure Vitest
- create Docker Compose skeleton
- create Fastify API skeleton with `/health`
- create Vite React app skeleton
- create shared types package
- create geo utilities package
- add Git hooks and commitlint
- create verification scripts

Do not implement GraphHopper and MapLibre in the same first item. Keep items small.

## 20. Acceptance rules for agent behavior

The agent succeeds when:

- it creates durable YAML specs from this document
- it keeps roadmap, epics, backlog, and findings consistent
- `refine` updates planning only
- `implement` implements exactly one item
- `review` creates findings without changing roadmap progress
- quality checks are automated
- commits follow Conventional Commit rules
- Docker Compose is maintained and tested
- the architecture remains self-hosted
- no registration-based map/routing dependency is introduced
- Schleswig-Holstein remains the initial routing region
- route quality and navigation usability remain central priorities

The agent fails if it:

- implements multiple unrelated items in one `implement`
- silently changes product scope
- uses Google Maps or a paid/registered provider as a core dependency
- commits secrets or large map artifacts
- bypasses hooks
- marks items done without verification
- updates roadmap progress during `review`
- ignores surface preferences
- treats forbidden access as a soft preference instead of a hard constraint
- builds route saving/management features that were explicitly removed from scope

## 20A. Route-quality acceptance criteria

The route generator is the core product differentiator. The agent must not treat any path from GraphHopper as automatically good.

### 20A.1 Minimum viable route quality

A generated route is acceptable for MVP only if:

```yaml
minimum_route_quality:
  - starts_close_to_requested_start
  - returns_to_start_for_round_trip
  - uses_activity_appropriate_profile
  - avoids_known_forbidden_access
  - has_total_distance_reported
  - has_distance_delta_reported
  - has_geometry_renderable_on_map
  - has_instructions_or_honest_instruction_gap
  - has_surface_summary_or_unknown_surface_warning
```

### 20A.2 Rejection rules

Reject or fail route candidates when known:

```yaml
hard_reject_candidate_if:
  - uses_motorway_or_trunk_unsuitable_for_activity
  - violates_foot_no_for_running_walking
  - violates_bicycle_no_for_cycling
  - uses_access_private_or_access_no_without_exception
  - leaves_region_without_explicit_warning_strategy
  - geometry_is_empty_or_invalid
  - distance_is_zero_or_nonsensical
```

### 20A.3 Surface scoring expectations

The scoring module must make surface preference observable in tests. Unit tests must show that, all else being roughly equal:

- `trail` preference ranks more unpaved/path/track-like routes higher than asphalt-heavy routes;
- `asphalt` preference ranks paved/asphalt routes higher than trail-heavy routes;
- `mixed` does not collapse into always-shortest-route behavior;
- `indifferent` reduces surface impact and primarily values feasibility and distance fit.

### 20A.4 Distance fit expectations

The first implementation may not always hit the exact target, but it must be honest.

```yaml
distance_behavior:
  default_tolerance_meters: 150
  maximum_bidirectional_overlap_meters: 500
  maximum_acceptable_distance_delta_meters: 400
  success: within_tolerance_within_400_meter_limit_and_within_500_meter_overlap_limit
  partial: only_when_explicit_feasibility_constraints_force_a_nonideal_round_trip
  minimum_route_exceeds_target: return_shortest_feasible_with_warning
  failed: no_legal_round_trip_within_allowed_distance_or_routing_engine_unavailable
```

## 20B. Mobile and battery acceptance criteria

### 20B.1 Navigation runtime behavior

During navigation, the frontend should not continuously call the backend. It should compute progress, remaining distance, next instruction, and off-route status locally from the route geometry.

### 20B.2 GPS handling

GPS updates must be handled efficiently:

- throttle expensive React state updates;
- avoid recalculating the entire route on every position update when incremental calculation is possible;
- avoid excessive map animations;
- allow a simple battery saver setting later;
- use accuracy data to avoid overreacting to noisy GPS.

### 20B.3 iPhone/PWA caveats

The agent must document browser limitations rather than hiding them:

- geolocation requires user permission;
- production geolocation requires HTTPS;
- background behavior on iPhone may be limited;
- Wake Lock support may vary;
- PWA behavior may differ from native apps.

The MVP must still be useful with the screen on and the app active.

## 20C. Security and privacy baseline

Even for private use, the app must avoid careless exposure.

```yaml
security_baseline:
  - no_secrets_in_git
  - no_required_api_keys_for_core_features
  - validate_all_api_inputs
  - avoid_exposing_stack_traces_to_client
  - deliberate_cors_configuration
  - no_arbitrary_file_reads
  - no_arbitrary_shell_execution_from_api
  - no_public_write_admin_endpoints
  - location_logging_minimized
  - production_exposure_documented
```

If GraphHopper or TileServer is exposed through a reverse proxy, the agent must document that they are internal services by default and should not be unintentionally public. The supported browser-facing topology keeps them behind the frontend proxy instead of calling them directly from the client.

## 20D. Initial setup exact deliverables

During initial setup, the agent must create, at minimum:

```yaml
initial_setup_deliverables:
  repository:
    - README.md
    - package.json
    - package-lock.json
    - tsconfig.base.json
    - docker-compose.yml
    - .gitignore
    - .editorconfig
    - .env.example
  agent_specs:
    - .agent/product.yaml
    - .agent/architecture.yaml
    - .agent/governance.yaml
    - .agent/dependencies.yaml
    - .agent/quality.yaml
    - .agent/testing.yaml
    - .agent/review-rubric.yaml
    - .agent/roadmap.yaml
    - .agent/state.yaml
    - .agent/metrics.yaml
    - .agent/commands.yaml
  agent_directories:
    - .agent/backlog
    - .agent/epics
    - .agent/findings
    - .agent/reviews
    - .agent/decisions
  docs:
    - docs/product.md
    - docs/architecture.md
    - docs/routing.md
    - docs/navigation.md
    - docs/operations.md
    - docs/adr/ADR-0001-graphhopper.md
    - docs/adr/ADR-0002-maplibre.md
    - docs/adr/ADR-0003-schleswig-holstein-only.md
  scripts:
    - scripts/verify.sh
    - scripts/dev-up.sh
    - scripts/dev-down.sh
    - scripts/test-compose.sh
    - scripts/setup-data.sh
  apps:
    - apps/api
    - apps/web
  packages:
    - packages/shared
    - packages/geo
  services:
    - services/graphhopper
    - services/tileserver
```

The generated code may be skeletal, but verification commands should exist and either pass or fail with a clear documented reason.

## 20E. How to get closest to 10/10 autonomous success

The agent must apply these habits consistently:

1. Keep every implementation step small.
2. Prefer explicit YAML state over hidden assumptions.
3. Record durable architectural decisions as ADRs.
4. Use tests for route math and scoring before relying on UI behavior.
5. Keep runtime services self-hosted from day one.
6. Mock external/routing behavior in tests where real OSM artifacts are heavy.
7. Do not introduce persistence until there is a proven need.
8. Do not polish UI before the core route loop works.
9. Do not let review create noisy unprioritized backlogs.
10. Treat user location and route data as private.
11. Report blockers early instead of inventing fragile workarounds.
12. Keep the roadmap honest and conservative.

---

## 21. First instruction to the agent

When this document is given to the coding agent in an empty directory, the user instruction should be interpreted as:

```text
Initialize the Trail Router project from this briefing.
Create the repository structure, agent workspace, YAML specifications, initial roadmap, first epic, initial backlog, tooling skeleton, Docker Compose skeleton, and documentation.
Do not commit during this initial setup.
After setup, report what was created and what the user should do before running make show, refine, implement, fix, or review.
```

After the user connects a Git remote, the recurring repo-task commands are:

```text
refine
implement
fix
review
```

Use `make show` when a deterministic workspace summary is needed.

Each mutating recurring command must end with successful commit and push when a remote is available.

---

## 22. Final self-check before the agent starts

Before doing any work, the coding agent must answer these internally and proceed only if the answer is yes:

```yaml
startup_self_check:
  understands_product: true
  understands_two_main_states: true
  understands_self_hosted_requirement: true
  understands_schleswig_holstein_only: true
  understands_no_route_library: true
  understands_initial_setup_no_commit: true
  understands_after_remote_commit_and_push_required: true
  understands_refine_implement_review_separation: true
  understands_architecture_freeze: true
  understands_small_item_policy: true
  understands_quality_gates: true
```

If any answer would be false, the agent must inspect this document again and create the missing YAML/spec files before implementation.

## 23. Final instruction style for the user

After initial setup, the user should be able to use simple commands:

```text
refine
implement
fix
review
```

The agent must interpret these repo-task commands according to this document, not as generic natural-language requests.
Use `make show` for the deterministic workspace summary.

Optional user command variants may be supported:

```text
implement next
fix highest-priority finding
review security
review architecture
refine roadmap
```

These variants may change emphasis, but they must not reduce scope. For example, `review security` is still a whole-workspace review with a security emphasis, and `review 1` is not a supported shorthand for "review one commit".

But the plain commands must remain sufficient.

## 24. Expected first several iterations

The initial autonomous sequence should usually look like this:

1. Initial setup from this document, no commit.
2. User connects remote repository.
3. `refine`: verify and polish foundation epic/backlog.
4. `implement`: create tooling and verification foundation.
5. `implement`: create API skeleton and health endpoint.
6. `implement`: create web skeleton and basic layout.
7. `implement`: create shared schemas and route request types.
8. `implement`: create geo utility package with distance/polyline tests.
9. `review`: audit architecture/tooling drift.
10. `refine`: move to GraphHopper integration epic when foundation is stable.

The agent should not jump directly into sophisticated route optimization before the repository can build, test, lint, and run a minimal Docker Compose stack.

## 25. Final quality principle

A route app used outdoors must be boringly reliable. Prioritize stable route display, honest warnings, legal access handling, and understandable navigation over clever AI behavior or broad feature count.

The AI component in this project is the development agent and possibly later a parameter helper. The production app itself should rely on deterministic routing, scoring, validation, and geospatial calculations rather than opaque AI decisions.
