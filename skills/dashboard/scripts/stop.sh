#!/usr/bin/env bash
# Arrête le tableau de suivi an-forge, s'il tourne.
set -euo pipefail

HOME_DIR=${AN_FORGE_HOME:-$HOME/.an-forge}
PORT=${AN_FORGE_DASHBOARD_PORT:-4317}
PING=$(curl -s --max-time 2 "http://127.0.0.1:$PORT/api/ping" || true)

if printf '%s' "$PING" | grep -q '"app":"an-forge-dashboard"'; then
  kill "$(printf '%s' "$PING" | sed -E 's/.*"pid":([0-9]+).*/\1/')"
  rm -f "$HOME_DIR/dashboard.pid"
  echo "status=stopped"
else
  echo "status=not-running"
fi
