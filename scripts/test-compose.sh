#!/usr/bin/env bash

set -euo pipefail

cleanup() {
  docker compose down --remove-orphans >/dev/null 2>&1 || true
}

print_service_logs() {
  local service="$1"

  echo "----- ${service} logs -----" >&2
  docker compose logs "$service" >&2 || true
  echo "-------------------------" >&2
}

wait_for_running_service() {
  local service="$1"
  local attempts="${2:-30}"

  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    local container_id
    container_id="$(docker compose ps -q "$service")"

    if [[ -z "$container_id" ]]; then
      sleep 2
      continue
    fi

    local status
    status="$(docker inspect --format '{{.State.Status}}' "$container_id")"

    if [[ "$status" == "running" ]]; then
      echo "${service} container is running."
      return 0
    fi

    if [[ "$status" == "exited" || "$status" == "dead" ]]; then
      echo "${service} container failed to stay running." >&2
      print_service_logs "$service"
      return 1
    fi

    sleep 2
  done

  echo "Timed out waiting for ${service} to start." >&2
  print_service_logs "$service"
  return 1
}

wait_for_api_health() {
  local attempts="${1:-30}"

  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    if docker compose exec -T api node -e "fetch('http://127.0.0.1:3001/health').then(async (response) => { if (!response.ok) throw new Error('unexpected status ' + response.status); const body = await response.json(); if (body.status !== 'ok' || body.service !== 'api') throw new Error('unexpected health payload'); }).catch((error) => { console.error(error.message); process.exit(1); });" >/dev/null 2>&1; then
      echo "API health endpoint responded successfully from inside the container."
      return 0
    fi

    sleep 2
  done

  echo "Timed out waiting for the api health endpoint." >&2
  print_service_logs "api"
  return 1
}

trap cleanup EXIT

docker compose config >/dev/null
echo "docker compose configuration is valid."

docker compose up -d --build api web

wait_for_running_service "api"
wait_for_running_service "web"
wait_for_api_health

docker compose ps
echo "Runtime smoke passed for the scaffolded api and web services."
