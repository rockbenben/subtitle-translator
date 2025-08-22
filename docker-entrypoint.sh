#!/bin/sh
set -e
# Check if wget exists
command -v wget >/dev/null 2>&1 || { echo >&2 "wget not found!"; exit 1; }

# Start the dev server in the background
yarn dev &
DEV_PID=$!

# Wait until the app is ready
npx wait-on http://localhost:3000
sleep 2

# Route language list
langs="en zh zh-hant pt es hi ar fr de ja ko ru vi tr bn id it"

for lang in $langs; do
  echo "Warming up /$lang"
  wget --timeout=5 --tries=1 -qO- "http://localhost:3000/$lang" > /dev/null || true
done

# Keep the container running
wait $DEV_PID
