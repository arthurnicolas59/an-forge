#!/usr/bin/env bash
# Vérifie les règles de version d'an-forge (voir AGENTS.md) :
#   1. si la branche touche skills/, agents/ ou scripts/, la version de .claude-plugin/plugin.json a augmenté ;
#   2. le badge de version du README affiche la même version que plugin.json.
#
# Usage : scripts/check-version.sh [<base>]     (par défaut origin/main)
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
BASE=${1:-origin/main}

version() { python3 -c 'import json,sys; print(json.load(sys.stdin)["version"])'; }
NOW=$(version < .claude-plugin/plugin.json)
bad=0

if ! grep -qF "badge/version-$NOW-" README.md; then
  echo "VERSION : le badge du README n'affiche pas $NOW (la version de .claude-plugin/plugin.json)."
  bad=1
fi

if git rev-parse --verify -q "$BASE^{commit}" >/dev/null; then
  MB=$(git merge-base "$BASE" HEAD)
  if [ -n "$(git diff --name-only "$MB" -- skills agents scripts)" ]; then
    BEFORE=$(git show "$MB:.claude-plugin/plugin.json" | version)
    newer=$(python3 - "$BEFORE" "$NOW" <<'PY'
import sys
a, b = (tuple(int(x) for x in v.split(".")) for v in sys.argv[1:3])
print("yes" if b > a else "no")
PY
)
    if [ "$newer" != yes ]; then
      echo "VERSION : la branche change skills/, agents/ ou scripts/ mais la version reste $BEFORE → $NOW. Augmente-la dans .claude-plugin/plugin.json (et le badge du README)."
      bad=1
    fi
  fi
else
  echo "Note : $BASE introuvable, seule la cohérence du badge est vérifiée."
fi

[ $bad = 0 ] && echo "Version : $NOW, règles respectées."
exit $bad
