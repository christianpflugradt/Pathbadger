#!/usr/bin/env bash

set -euo pipefail

scope="${PATHBADGER_TILE_DATA_SCOPE:-starter}"

case "$scope" in
  starter)
    target_path="$(pwd)/data/tiles/bad-bramstedt-50km.geojson"
    ;;
  schleswig_holstein)
    target_path="$(pwd)/data/tiles/schleswig-holstein-basemap.geojson"
    ;;
  *)
    echo "Unsupported PATHBADGER_TILE_DATA_SCOPE: ${scope}" >&2
    exit 1
    ;;
esac

if [[ -s "$target_path" ]]; then
  echo "Using existing ${scope} map data at ${target_path}."
  exit 0
fi

echo "Generating ${scope} map data at ${target_path}."
npm --prefix services/tileserver run refresh:data -- --scope "$scope" --output "$target_path"
