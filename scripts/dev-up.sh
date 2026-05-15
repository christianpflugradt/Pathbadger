#!/usr/bin/env bash

set -euo pipefail

with_routing=1
with_routing_elevation=0
compose_args=()

for arg in "$@"; do
  case "$arg" in
    --without-routing)
      with_routing=0
      ;;
    --with-routing)
      with_routing=1
      ;;
    --with-routing-elevation)
      with_routing=1
      with_routing_elevation=1
      ;;
    *)
      compose_args+=("$arg")
      ;;
  esac
done

./scripts/ensure-map-data.sh

if [[ "$with_routing" -eq 1 ]]; then
  ./scripts/ensure-routing-data.sh
fi

compose_command=(docker compose)
compose_env=()

if [[ "$with_routing" -eq 1 ]]; then
  compose_command+=(--profile maps)
fi

if [[ "$with_routing_elevation" -eq 1 ]]; then
  compose_env+=(
    "GRAPHHOPPER_CONFIG_PATH=/config/config-elevation.yml"
    "GRAPHHOPPER_GRAPH_CACHE=/data/graphhopper/cache-elevation"
    "GRAPHHOPPER_HAS_ELEVATION=true"
  )
fi

compose_command+=(up -d --build)
compose_command+=("${compose_args[@]}")
env "${compose_env[@]}" "${compose_command[@]}"

wait_for_url() {
  local url="$1"
  local label="$2"
  local service="$3"
  local attempts="${4:-30}"

  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    if node -e "fetch(process.argv[1]).then((response) => { if (!response.ok) throw new Error(String(response.status)); }).catch(() => process.exit(1));" "$url" >/dev/null 2>&1; then
      echo "${label} is reachable at ${url}."
      return 0
    fi

    sleep 2
  done

  echo "Timed out waiting for ${label} at ${url}." >&2
  docker compose logs --tail=100 "${service}" >&2 || true
  return 1
}

wait_for_url "http://127.0.0.1:5173" "web frontend" "web"
wait_for_url "http://127.0.0.1:5173/api/health" "frontend api proxy" "web"
wait_for_url "http://127.0.0.1:5173/styles/basic/style.json" "frontend tile-style proxy" "web"

wait_for_route_preview() {
  local attempts="${1:-180}"
  local require_elevation="${2:-0}"
  local request_json='{"start":{"lat":53.9188,"lon":9.8872},"targetDistanceKm":8,"activity":"running_walking","surfacePreference":"mixed","passThroughPoints":[],"randomSeed":null,"toleranceMeters":150}'

  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    if PATHBADGER_ROUTE_PREVIEW_READY_REQUEST="$request_json" PATHBADGER_ROUTE_PREVIEW_REQUIRE_ELEVATION="$require_elevation" node -e "const request = JSON.parse(process.env.PATHBADGER_ROUTE_PREVIEW_READY_REQUEST); const requireElevation = process.env.PATHBADGER_ROUTE_PREVIEW_REQUIRE_ELEVATION === '1'; fetch('http://127.0.0.1:5173/api/routes/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) }).then(async (response) => { if (!response.ok) throw new Error('unexpected status ' + response.status); const body = await response.json(); if ((body.status !== 'success' && body.status !== 'partial') || !body.geometry || !Array.isArray(body.geometry.coordinates) || body.geometry.coordinates.length === 0) { throw new Error('route preview is not ready yet'); } if (requireElevation && !Number.isFinite(body.summary?.elevationGainMeters)) { throw new Error('route preview elevation is not ready yet'); } }).catch(() => process.exit(1));" >/dev/null 2>&1; then
      if [[ "$require_elevation" -eq 1 ]]; then
        echo "Route preview endpoint returned geometry and non-null elevation gain through the frontend proxy and elevation-capable local stack."
      else
        echo "Route preview endpoint returned geometry through the frontend proxy and full local stack."
      fi
      return 0
    fi

    sleep 2
  done

  if [[ "$require_elevation" -eq 1 ]]; then
    echo "Timed out waiting for the frontend-routed route preview endpoint to return geometry and non-null elevation gain." >&2
  else
    echo "Timed out waiting for the frontend-routed route preview endpoint to return geometry." >&2
  fi
  docker compose logs --tail=100 web >&2 || true
  docker compose logs --tail=100 api >&2 || true
  docker compose logs --tail=100 graphhopper >&2 || true
  return 1
}

if [[ "$with_routing" -eq 1 ]]; then
  wait_for_route_preview 180 "$with_routing_elevation"
fi
