#!/usr/bin/env bash
# Copie le modèle AGENTS.md à la racine du projet courant. N'écrase jamais un fichier existant.
set -euo pipefail

TEMPLATE="$(cd "$(dirname "$0")/.." && pwd)/templates/AGENTS.md"
ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

if [ -e "$ROOT/AGENTS.md" ]; then
  echo "AGENTS.md existe déjà : rien copié."
  exit 0
fi

cp "$TEMPLATE" "$ROOT/AGENTS.md"
echo "AGENTS.md copié depuis le modèle an-forge."
