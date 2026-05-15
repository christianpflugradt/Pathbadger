#!/usr/bin/env bash

set -euo pipefail

cat <<'EOF'
Expected local data inputs:

- data/osm/schleswig-holstein-latest.osm.pbf
- data/tiles/bad-bramstedt-50km.geojson for the default starter map slice
- data/tiles/schleswig-holstein-basemap.geojson for the whole-state map slice
- data/graphhopper/ for generated GraphHopper cache data

Useful commands:

- ./scripts/ensure-map-data.sh
- ./scripts/ensure-routing-data.sh
- PATHBADGER_TILE_DATA_SCOPE=schleswig_holstein ./scripts/ensure-map-data.sh
- PATHBADGER_TILE_DATA_SCOPE=schleswig_holstein make run-app
- make run-app

The starter map file is generated on demand into the ignored data directory.
The Schleswig-Holstein file uses the same workflow, but the first build is much
heavier and is intended for the broader live map experience.
The routing helper downloads the Schleswig-Holstein OSM extract on demand and
GraphHopper then imports it into `data/graphhopper/` during the first
`make run-app`.
EOF
