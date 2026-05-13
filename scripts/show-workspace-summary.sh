#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
backlog_dir="$repo_root/.agent/backlog"
epics_dir="$repo_root/.agent/epics"
roadmap_file="$repo_root/.agent/roadmap.yaml"

count_not_done() {
  awk '
    /^status:[[:space:]]*/ {
      if ($2 != "done") {
        count++
      }
      nextfile
    }
    END {
      print count + 0
    }
  ' "$@"
}

open_items="$(count_not_done "$backlog_dir"/*.yaml)"
incomplete_epics="$(count_not_done "$epics_dir"/*.yaml)"
roadmap_progress="$(
  sed -n 's/^  overall_progress_percent: //p' "$roadmap_file" | head -n 1
)"

printf 'Open items: %s\n' "$open_items"
printf 'Incomplete epics: %s\n' "$incomplete_epics"
printf 'Roadmap progress: %s%%\n' "$roadmap_progress"
