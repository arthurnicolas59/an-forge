#!/usr/bin/env bash
# Lance le tableau de suivi an-forge, s'il ne tourne pas déjà, et l'ouvre dans le navigateur.
#
# Usage : start.sh [--no-open]
#   Lancé depuis un projet an-forge (un dépôt git avec un AGENTS.md), il ajoute aussi ce projet
#   à la liste suivie, ~/.an-forge/projects.
#   Si un tableau d'une autre version d'an-forge tourne déjà, il le remplace.
#   Il (ré)écrit aussi ~/.an-forge/bin/dashboard, le lanceur à chemin fixe de l'app an-forge du Mac.
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

# La liste des projets : une ligne par projet, <chemin>, une tabulation, puis owner/name du dépôt GitHub.
# Le tableau a besoin du dépôt : lancé par l'app du Mac, il ne peut pas lire les dossiers des projets.
REGISTRY="$HOME_DIR/projects"
repo_of() {
  git -C "$1" remote get-url origin 2>/dev/null | grep -E 'github\.com[:/]' | sed -E 's#.*github\.com[:/]##; s#\.git$##' || true
}

# Ajoute le projet courant, s'il en est un. Le projet est le checkout principal, même depuis un worktree.
# an-forge lui-même a un AGENTS.md mais n'est pas un projet à suivre.
if COMMON=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null); then
  ROOT=$(dirname "$COMMON")
  if [ -f "$ROOT/AGENTS.md" ] && ! grep -qs '"name": "an-forge"' "$ROOT/.claude-plugin/plugin.json" \
    && ! cut -f1 "$REGISTRY" | grep -qxF "$ROOT"; then
    printf '%s\n' "$ROOT" >> "$REGISTRY"
    echo "project=$ROOT"
  fi
fi

# Complète le dépôt des projets inscrits sans lui, quand leur dossier est lisible.
TMP=$(mktemp)
while IFS=$'\t' read -r P R || [ -n "$P" ]; do
  [ -n "$P" ] || continue
  [ -n "${R:-}" ] || R=$(repo_of "$P")
  if [ -n "$R" ]; then printf '%s\t%s\n' "$P" "$R"; else printf '%s\n' "$P"; fi
done <"$REGISTRY" >"$TMP"
mv "$TMP" "$REGISTRY"

# Le lanceur à chemin fixe, utilisé par l'app an-forge du Mac. Le dossier du plugin change à chaque
# version : le lanceur prend la version installée la plus récente, sinon une copie du tableau rangée
# dans ~/.an-forge/dashboard. Cette copie évite à l'app de lancer un script du Bureau ou des Documents,
# que macOS protège.
RUNTIME="$HOME_DIR/dashboard"
if [ "$HERE" != "$RUNTIME" ]; then
  mkdir -p "$RUNTIME"
  cp "$HERE/server.mjs" "$HERE/index.html" "$HERE/start.sh" "$HERE/stop.sh" "$RUNTIME/"
fi
mkdir -p "$HOME_DIR/bin"
cat >"$HOME_DIR/bin/dashboard" <<EOF
#!/usr/bin/env bash
# Écrit par start.sh du skill dashboard d'an-forge. Ne pas modifier : il est réécrit à chaque lancement.
export PATH="$PATH"
export AN_FORGE_HOME="$HOME_DIR"
export AN_FORGE_DASHBOARD_PORT="$PORT"
LATEST=\$(ls -d "\$HOME"/.claude/plugins/cache/*/an-forge/*/skills/dashboard/scripts/start.sh 2>/dev/null | sort -V | tail -1)
exec "\${LATEST:-$RUNTIME/start.sh}" "\$@"
EOF
chmod +x "$HOME_DIR/bin/dashboard"

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

# Dans sa propre fenêtre, sans onglets ni barre d'adresse, si Google Chrome est là ; sinon dans le navigateur.
if [ "$OPEN" = 1 ]; then
  CHROME="/Applications/Google Chrome.app"
  if [ -d "$CHROME" ]; then open -na "$CHROME" --args --app="$URL"
  elif command -v open >/dev/null; then open "$URL"
  elif command -v xdg-open >/dev/null; then xdg-open "$URL" >/dev/null 2>&1
  fi
fi
