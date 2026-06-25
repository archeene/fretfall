#!/usr/bin/env bash
# FretFall launcher — serves the app on localhost and opens your browser.
# Mic access requires a "secure context"; localhost qualifies, file:// does not.
set -e
cd "$(dirname "$0")"

PORT="${PORT:-8753}"
URL="http://localhost:${PORT}/index.html"

echo "🎸 FretFall starting on ${URL}"

# Start a static server in the background
if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server "$PORT" --bind 0.0.0.0 >/dev/null 2>&1 &
elif command -v python >/dev/null 2>&1; then
  python -m http.server "$PORT" --bind 0.0.0.0 >/dev/null 2>&1 &
else
  echo "Need python3 (or python) to serve the app." >&2
  exit 1
fi
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null' EXIT

sleep 1

# Open the default browser across platforms (incl. WSL)
if command -v wslview >/dev/null 2>&1; then wslview "$URL"
elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL"
elif command -v explorer.exe >/dev/null 2>&1; then explorer.exe "$URL" || true
elif command -v open >/dev/null 2>&1; then open "$URL"
else echo "Open this in your browser: $URL"
fi

echo "Server running (pid $SERVER_PID). Press Ctrl+C to stop."
wait $SERVER_PID
