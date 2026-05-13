#!/usr/bin/env bash

set -euo pipefail

docker compose config >/dev/null
echo "docker compose configuration is valid."

if [[ "${PATHBADGER_RUNTIME_SMOKE:-0}" == "1" ]]; then
  docker compose up -d api web
  docker compose ps
  docker compose down --remove-orphans
else
  echo "Runtime smoke skipped. Set PATHBADGER_RUNTIME_SMOKE=1 after service wiring is ready."
fi
