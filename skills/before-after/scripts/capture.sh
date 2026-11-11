#!/usr/bin/env bash
# Fait une capture d'écran d'une page web, toujours de la même façon (Playwright, Chromium, taille fixe).
#
# Usage : capture.sh <url> <fichier.png> [--size LxH] [--mobile] [--full]
#   --size LxH  taille de la fenêtre, par exemple 900x560 (par défaut 1280x800).
#               Une fenêtre plus petite cadre sur ce qui compte et évite le vide autour.
#   --mobile    taille d'un téléphone (iPhone 13)
#   --full      toute la hauteur de la page, pas seulement le haut
#
# La première fois, Playwright télécharge Chromium (environ 150 Mo, gardé en cache ensuite).
set -euo pipefail

PLAYWRIGHT="playwright@1.64.1"

if [ $# -lt 2 ]; then
  echo "Usage : capture.sh <url> <fichier.png> [--size LxH] [--mobile] [--full]" >&2
  exit 2
fi

URL=$1
OUT=$2
shift 2

opts=(--viewport-size "1280,800")
while [ $# -gt 0 ]; do
  case "$1" in
    --size)
      if ! [[ "${2:-}" =~ ^([0-9]+)x([0-9]+)$ ]]; then
        echo "--size attend une taille comme 900x560" >&2; exit 2
      fi
      opts=(--viewport-size "${BASH_REMATCH[1]},${BASH_REMATCH[2]}")
      shift ;;
    --mobile) opts=(--device "iPhone 13") ;;
    --full) full=1 ;;
    *) echo "Option inconnue : $1" >&2; exit 2 ;;
  esac
  shift
done
[ "${full:-0}" = 1 ] && opts+=(--full-page)

if ! command -v npx >/dev/null 2>&1; then
  echo "npx est introuvable : installe Node.js 20 ou plus." >&2
  exit 1
fi

if ! curl -s -o /dev/null --max-time 10 "$URL"; then
  echo "La page $URL ne répond pas : l'application est-elle lancée ?" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT")"
if ! out=$(npx -y "$PLAYWRIGHT" install chromium 2>&1); then
  echo "$out" >&2
  echo "Impossible d'installer Chromium pour Playwright." >&2
  exit 1
fi
npx -y "$PLAYWRIGHT" screenshot "${opts[@]}" --wait-for-timeout 1000 "$URL" "$OUT" >/dev/null
echo "Capture enregistrée : $OUT"
