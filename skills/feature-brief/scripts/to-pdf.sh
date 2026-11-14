#!/usr/bin/env bash
# Transforme un brief HTML en PDF A4 (Playwright, Chromium).
#
# Usage : to-pdf.sh <dossier-du-brief> [fichier.pdf]
#   Par défaut, écrit brief.pdf dans le dossier du brief.
#
# La première fois, Playwright télécharge Chromium (environ 150 Mo, gardé en cache ensuite).
set -euo pipefail

PLAYWRIGHT="playwright@1.64.1"

if [ $# -lt 1 ]; then
  echo "Usage : to-pdf.sh <dossier-du-brief> [fichier.pdf]" >&2
  exit 2
fi

DIR=$(cd "$1" && pwd)
OUT=${2:-"$DIR/brief.pdf"}

if [ ! -f "$DIR/index.html" ]; then
  echo "Introuvable : $DIR/index.html (lance d'abord render.py)." >&2
  exit 1
fi
if ! command -v npx >/dev/null 2>&1; then
  echo "npx est introuvable : installe Node.js 20 ou plus, ou imprime index.html en PDF depuis un navigateur." >&2
  exit 1
fi

if ! out=$(npx -y "$PLAYWRIGHT" install chromium 2>&1); then
  echo "$out" >&2
  echo "Impossible d'installer Chromium pour Playwright." >&2
  exit 1
fi
# Attend que la page soit prête : les schémas avant/après sont dessinés au chargement.
npx -y "$PLAYWRIGHT" pdf --paper-format A4 --wait-for-selector "html[data-ready]" "file://$DIR/index.html" "$OUT" >/dev/null
echo "PDF écrit : $OUT"
