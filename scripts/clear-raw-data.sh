#!/usr/bin/env bash
set -euo pipefail

RAW_DIR="$(cd "$(dirname "$0")/../server/data/raw" && pwd)"

for subdir in logs metrics traces; do
  dir="$RAW_DIR/$subdir"
  if [ -d "$dir" ]; then
    count=$(find "$dir" -name '*.json' -type f | wc -l | tr -d ' ')
    rm -f "$dir"/*.json
    echo "Cleared $count files from $subdir/"
  fi
done

echo "Done."
