#!/usr/bin/env bash

set -euo pipefail

target_path="$(pwd)/data/osm/schleswig-holstein-latest.osm.pbf"
download_url="${PATHBADGER_ROUTING_DATA_URL:-https://download.geofabrik.de/europe/germany/schleswig-holstein-latest.osm.pbf}"
temp_path="${target_path}.partial"

mkdir -p "$(dirname "$target_path")"

if [[ -s "$target_path" ]]; then
  echo "Using existing routing data at ${target_path}."
  exit 0
fi

echo "Downloading routing data from ${download_url} to ${target_path}."
rm -f "$temp_path"

if ! curl -fL --progress-bar "$download_url" -o "$temp_path"; then
  rm -f "$temp_path"
  echo "Failed to download routing data from ${download_url}." >&2
  exit 1
fi

mv "$temp_path" "$target_path"
echo "Routing data is ready at ${target_path}."
