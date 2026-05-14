#!/usr/bin/env bash

set -euo pipefail

./scripts/ensure-map-data.sh

docker compose up -d --build "$@"

wait_for_url() {
  local url="$1"
  local label="$2"
  local attempts="${3:-30}"

  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    if node -e "fetch(process.argv[1]).then((response) => { if (!response.ok) throw new Error(String(response.status)); }).catch(() => process.exit(1));" "$url" >/dev/null 2>&1; then
      echo "${label} is reachable at ${url}."
      return 0
    fi

    sleep 2
  done

  echo "Timed out waiting for ${label} at ${url}." >&2
  docker compose logs --tail=100 "${label}" >&2 || true
  return 1
}

wait_for_url "http://127.0.0.1:3001/health" "api"
wait_for_url "http://127.0.0.1:8080/styles/basic/style.json" "tileserver"
wait_for_url "http://127.0.0.1:5173" "web"
