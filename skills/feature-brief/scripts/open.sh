#!/usr/bin/env bash
# Ouvre un brief dans le navigateur de l'ordinateur, avec ses images.
#
# Usage : open.sh <dossier-du-brief>
#
# Les images sont des fichiers à côté de index.html. Un aperçu qui ouvre la page seule
# (comme le panneau d'aperçu d'un outil d'IA) ne les montre pas : ce script passe donc
# toujours par le vrai navigateur. S'il n'en trouve pas, il dit comment servir le dossier.
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage : open.sh <dossier-du-brief>" >&2
  exit 2
fi

DIR=$(cd "$1" && pwd)
PAGE="$DIR/index.html"

if [ ! -f "$PAGE" ]; then
  echo "Introuvable : $PAGE (lance d'abord render.py)" >&2
  exit 2
fi

if command -v open >/dev/null 2>&1 && [ "$(uname)" = "Darwin" ]; then
  open "$PAGE"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$PAGE" >/dev/null 2>&1 &
elif command -v explorer.exe >/dev/null 2>&1; then
  explorer.exe "$(wslpath -w "$PAGE" 2>/dev/null || echo "$PAGE")" || true
else
  echo "Pas de navigateur trouvé. Pour voir le brief avec ses images :"
  echo "  python3 -m http.server 8765 --bind 127.0.0.1 --directory \"$DIR\""
  echo "  puis ouvre http://127.0.0.1:8765/"
  exit 0
fi

echo "Brief ouvert dans le navigateur : $PAGE"
