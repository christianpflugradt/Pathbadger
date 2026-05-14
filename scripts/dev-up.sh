#!/usr/bin/env bash

set -euo pipefail

with_routing=0
compose_args=()

for arg in "$@"; do
  case "$arg" in
    --with-routing)
      with_routing=1
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

if [[ "$with_routing" -eq 1 ]]; then
  compose_command+=(--profile maps)
fi

compose_command+=(up -d --build)
compose_command+=("${compose_args[@]}")
"${compose_command[@]}"

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
  local request_json='{"start":{"lat":53.9188,"lon":9.8872},"targetDistanceKm":8,"activity":"running_walking","surfacePreference":"mixed","passThroughPoints":[],"randomSeed":null,"toleranceMeters":150}'

  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    if PATHBADGER_ROUTE_PREVIEW_READY_REQUEST="$request_json" node -e "const request = JSON.parse(process.env.PATHBADGER_ROUTE_PREVIEW_READY_REQUEST); fetch('http://127.0.0.1:5173/api/routes/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) }).then(async (response) => { if (!response.ok) throw new Error('unexpected status ' + response.status); const body = await response.json(); if ((body.status !== 'success' && body.status !== 'partial') || !body.geometry || !Array.isArray(body.geometry.coordinates) || body.geometry.coordinates.length === 0) { throw new Error('route preview is not ready yet'); } }).catch(() => process.exit(1));" >/dev/null 2>&1; then
      echo "Route preview endpoint returned geometry through the frontend proxy and full local stack."
      return 0
    fi

    sleep 2
  done

  echo "Timed out waiting for the frontend-routed route preview endpoint to return geometry." >&2
  docker compose logs --tail=100 web >&2 || true
  docker compose logs --tail=100 api >&2 || true
  docker compose logs --tail=100 graphhopper >&2 || true
  return 1
}

if [[ "$with_routing" -eq 1 ]]; then
  wait_for_route_preview
fi
