#!/usr/bin/env bash

set -euo pipefail

docker compose --profile maps down --remove-orphans
