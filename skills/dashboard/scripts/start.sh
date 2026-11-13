#!/usr/bin/env bash
# Lance le tableau de suivi an-forge, s'il ne tourne pas déjà, et l'ouvre dans le navigateur.
#
# Usage : start.sh [--no-open]
#   Lancé depuis un projet an-forge (un dépôt git avec un AGENTS.md), il ajoute aussi ce projet
#   à la liste suivie, ~/.an-forge/projects.
#   Si un tableau d'une autre version d'an-forge tourne déjà, il le remplace.
#
# Affiche des lignes clé=valeur : url, status (started|running|restarted), project (si ajouté).
# La variable AN_FORGE_HOME remplace ~/.an-forge, AN_FORGE_DASHBOARD_PORT le port (4317).
set -euo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
HOME_DIR=${AN_FORGE_HOME:-$HOME/.an-forge}
PORT=${AN_FORGE_DASHBOARD_PORT:-4317}
URL="http://127.0.0.1:$PORT"
OPEN=1
[ "${1:-}" = "--no-open" ] && OPEN=0

command -v node >/dev/null || { echo "Node.js est nécessaire (version 18 ou plus) : https://nodejs.org" >&2; exit 1; }
command -v gh >/dev/null || { echo "La commande gh (GitHub CLI) est nécessaire : https://cli.github.com" >&2; exit 1; }
MAJOR=$(node -p 'process.versions.node.split(".")[0]')
[ "$MAJOR" -ge 18 ] || { echo "Node.js 18 ou plus est nécessaire (installé : $(node -v))." >&2; exit 1; }

mkdir -p "$HOME_DIR"
touch "$HOME_DIR/projects"

# Ajoute le projet courant, s'il en est un. Le projet est le checkout principal, même depuis un worktree.
if COMMON=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null); then
  ROOT=$(dirname "$COMMON")
  # an-forge lui-même a un AGENTS.md mais n'est pas un projet à suivre.
  if [ -f "$ROOT/AGENTS.md" ] && ! grep -qs '"name": "an-forge"' "$ROOT/.claude-plugin/plugin.json" \
    && ! grep -qxF "$ROOT" "$HOME_DIR/projects"; then
    echo "$ROOT" >> "$HOME_DIR/projects"
    echo "project=$ROOT"
  fi
fi

PIDFILE="$HOME_DIR/dashboard.pid"
LOG="$HOME_DIR/dashboard.log"

# Ce qui répond sur le port : notre tableau (et de quel dossier), autre chose, ou rien.
PING=$(curl -s --max-time 2 "$URL/api/ping" || true)
STATUS=started
if printf '%s' "$PING" | grep -q '"app":"an-forge-dashboard"'; then
  if printf '%s' "$PING" | grep -qF "\"dir\":\"$HERE\""; then
    STATUS=running
  else
    # Une autre version d'an-forge : on l'arrête pour lancer celle-ci.
    OLD=$(printf '%s' "$PING" | sed -E 's/.*"pid":([0-9]+).*/\1/')
    kill "$OLD" 2>/dev/null || true
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      curl -s --max-time 1 "$URL/api/ping" >/dev/null || break
      sleep 0.3
    done
    STATUS=restarted
  fi
elif [ -n "$PING" ] || curl -s --max-time 2 -o /dev/null "$URL"; then
  echo "Le port $PORT est déjà pris par un autre programme. Choisis-en un autre avec AN_FORGE_DASHBOARD_PORT." >&2
  exit 1
fi

if [ "$STATUS" != running ]; then
  AN_FORGE_HOME="$HOME_DIR" AN_FORGE_DASHBOARD_PORT="$PORT" nohup node "$HERE/server.mjs" >>"$LOG" 2>&1 &
  echo $! >"$PIDFILE"
  for _ in $(seq 1 25); do
    curl -s --max-time 1 "$URL/api/ping" >/dev/null && break
    sleep 0.2
  done
  curl -s --max-time 1 "$URL/api/ping" >/dev/null || { echo "Le tableau n'a pas démarré. Regarde $LOG" >&2; exit 1; }
fi

echo "url=$URL"
echo "status=$STATUS"

if [ "$OPEN" = 1 ]; then
  if command -v open >/dev/null; then open "$URL"
  elif command -v xdg-open >/dev/null; then xdg-open "$URL" >/dev/null 2>&1
  fi
fi
