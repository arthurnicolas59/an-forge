#!/usr/bin/env bash
# Copie les modèles an-forge dans le projet courant : AGENTS.md à la racine et scripts/checks.sh.
# N'écrase jamais un fichier existant.
set -euo pipefail

TEMPLATES="$(cd "$(dirname "$0")/.." && pwd)/templates"
ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

if [ -e "$ROOT/AGENTS.md" ]; then
  echo "AGENTS.md existe déjà : rien copié."
else
  cp "$TEMPLATES/AGENTS.md" "$ROOT/AGENTS.md"
  echo "AGENTS.md copié depuis le modèle an-forge."
fi

if [ -e "$ROOT/scripts/checks.sh" ]; then
  echo "scripts/checks.sh existe déjà : rien copié."
else
  mkdir -p "$ROOT/scripts"
  cp "$TEMPLATES/checks.sh" "$ROOT/scripts/checks.sh"
  chmod +x "$ROOT/scripts/checks.sh"
  echo "scripts/checks.sh copié depuis le modèle an-forge."
fi
