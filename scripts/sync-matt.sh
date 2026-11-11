#!/usr/bin/env bash
# Montre ce qui a changé chez Matt Pocock depuis la dernière synchro,
# pour les skills copiés dans an-forge (liste et commit dans scripts/mattpocock.lock).
# Rien n'est modifié automatiquement : nos copies ont été adaptées, on reprend les changements à la main.
#
# Usage : scripts/sync-matt.sh          résumé des fichiers changés
#         scripts/sync-matt.sh --full   diff complet
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
LOCK="$ROOT/scripts/mattpocock.lock"
OLD=$(awk '/^commit /{print $2}' "$LOCK")

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
git clone -q --filter=blob:none https://github.com/mattpocock/skills.git "$TMP/up"
NEW=$(git -C "$TMP/up" rev-parse HEAD)

if [ "$OLD" = "$NEW" ]; then
  echo "À jour : aucun changement depuis $OLD."
  exit 0
fi

paths=()
while read -r _ name path; do
  paths+=("$path")
  if [ ! -d "$TMP/up/$path" ]; then
    echo "⚠ $name n'existe plus à $path chez Matt (renommé ou supprimé)."
  fi
done < <(grep '^skill ' "$LOCK")

echo "Changements chez Matt entre ${OLD:0:7} et ${NEW:0:7} :"
git -C "$TMP/up" --no-pager diff --stat "$OLD" "$NEW" -- "${paths[@]}"

if [ "${1:-}" = "--full" ]; then
  git -C "$TMP/up" --no-pager diff "$OLD" "$NEW" -- "${paths[@]}"
fi

echo
echo "Reprends à la main ce qui t'intéresse dans skills/, puis remplace la ligne commit"
echo "de scripts/mattpocock.lock par : commit $NEW"
