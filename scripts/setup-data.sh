#!/usr/bin/env bash

set -euo pipefail

cat <<'EOF'
Expected local data inputs:

- data/osm/schleswig-holstein-latest.osm.pbf
- data/tiles/ for self-hosted tile artifacts
- data/graphhopper/ for generated GraphHopper cache data

This setup script is intentionally informational during initialization.
Later routing-core items should evolve it into a reproducible import workflow.
EOF
