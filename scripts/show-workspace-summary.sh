#!/usr/bin/env bash

set -euo pipefail
shopt -s nullglob

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
backlog_dir="$repo_root/.agent/backlog"
epics_dir="$repo_root/.agent/epics"
findings_dir="$repo_root/.agent/findings"
roadmap_file="$repo_root/.agent/roadmap.yaml"

backlog_files=("$backlog_dir"/*.yaml)
epic_files=("$epics_dir"/*.yaml)
finding_files=("$findings_dir"/*.yaml)

require_path() {
  local path="$1"
  if [[ ! -e "$path" ]]; then
    printf 'Missing required show input: %s\n' "$path" >&2
    exit 1
  fi
}

count_not_done() {
  if [[ "$#" -eq 0 ]]; then
    printf '0\n'
    return
  fi
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

count_unfixed_findings() {
  if [[ "$#" -eq 0 ]]; then
    printf '0\n'
    return
  fi
  awk '
    /^status:[[:space:]]*/ {
      if ($2 != "done" && $2 != "accepted_risk") {
        count++
      }
      nextfile
    }
    END {
      print count + 0
    }
  ' "$@"
}

require_path "$roadmap_file"

open_items="$(count_not_done "${backlog_files[@]}")"
incomplete_epics="$(count_not_done "${epic_files[@]}")"
unfixed_findings="$(count_unfixed_findings "${finding_files[@]}")"
roadmap_progress="$(awk '/^  overall_progress_percent: / { print $2; exit }' "$roadmap_file")"

if [[ -z "$roadmap_progress" ]]; then
  printf 'Missing roadmap overall_progress_percent in %s\n' "$roadmap_file" >&2
  exit 1
fi

printf 'Open items: %s\n' "$open_items"
printf 'Incomplete epics: %s\n' "$incomplete_epics"
printf 'Unfixed findings: %s\n' "$unfixed_findings"
printf 'Roadmap progress: %s%%\n' "$roadmap_progress"
