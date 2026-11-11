#!/usr/bin/env bash
# Gère le CLAUDE.md du projet, qui ne doit contenir qu'une ligne : @AGENTS.md
#
#   claude-md.sh remove-import   supprime CLAUDE.md s'il ne contient que @AGENTS.md (avant le setup)
#   claude-md.sh write           crée CLAUDE.md avec @AGENTS.md s'il n'existe pas (à la fin)
#
# Un CLAUDE.md avec un autre contenu n'est jamais modifié : code de sortie 2.
set -euo pipefail

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
FILE="$ROOT/CLAUDE.md"

only_import() { [ "$(grep -v '^[[:space:]]*$' "$FILE")" = "@AGENTS.md" ]; }

case "${1:-}" in
  remove-import)
    if [ ! -f "$FILE" ]; then echo "Pas de CLAUDE.md."; exit 0; fi
    if only_import; then rm "$FILE"; echo "CLAUDE.md retiré (il sera recréé à la fin)."; exit 0; fi
    echo "CLAUDE.md contient autre chose que @AGENTS.md : non modifié." >&2; exit 2 ;;
  write)
    if [ ! -f "$FILE" ]; then printf '@AGENTS.md\n' > "$FILE"; echo "CLAUDE.md créé."; exit 0; fi
    if only_import; then echo "CLAUDE.md déjà correct."; exit 0; fi
    echo "CLAUDE.md contient autre chose que @AGENTS.md : non modifié." >&2; exit 2 ;;
  *)
    echo "Usage : claude-md.sh remove-import|write" >&2; exit 1 ;;
esac
