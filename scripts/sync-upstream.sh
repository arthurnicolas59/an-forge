#!/usr/bin/env bash
# Montre ce qui a changé chez les auteurs des skills copiés dans an-forge, depuis la dernière synchro.
# Chaque source a son fichier scripts/<source>.lock : son repo, le commit copié et la liste des skills.
# Rien n'est modifié automatiquement : on reprend les changements à la main.
#
# Usage : scripts/sync-upstream.sh                     toutes les sources, résumé des fichiers changés
#         scripts/sync-upstream.sh mattpocock          une seule source
#         scripts/sync-upstream.sh mattpocock --full  diff complet
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
FULL=""
SOURCES=()
for arg in "$@"; do
  case "$arg" in
    --full) FULL=1 ;;
    *) SOURCES+=("$arg") ;;
  esac
done
if [ ${#SOURCES[@]} -eq 0 ]; then
  for f in "$ROOT"/scripts/*.lock; do SOURCES+=("$(basename "$f" .lock)"); done
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

for src in "${SOURCES[@]}"; do
  LOCK="$ROOT/scripts/$src.lock"
  [ -f "$LOCK" ] || { echo "Pas de fichier $LOCK."; exit 1; }
  REPO=$(awk '/^repo /{print $2}' "$LOCK")
  OLD=$(awk '/^commit /{print $2}' "$LOCK")

  echo "== $src =="
  git clone -q --filter=blob:none "$REPO" "$TMP/$src"
  NEW=$(git -C "$TMP/$src" rev-parse HEAD)

  if [ "$OLD" = "$NEW" ]; then
    echo "À jour : aucun changement depuis ${OLD:0:7}."
    echo
    continue
  fi

  paths=()
  while read -r _ name path; do
    paths+=("$path")
    if [ ! -e "$TMP/$src/$path" ]; then
      echo "⚠ $name n'existe plus à $path chez $src (renommé ou supprimé)."
    fi
  done < <(grep -E '^(skill|copy) ' "$LOCK")

  echo "Changements entre ${OLD:0:7} et ${NEW:0:7} :"
  git -C "$TMP/$src" --no-pager diff --stat "$OLD" "$NEW" -- "${paths[@]}"
  if [ -n "$FULL" ]; then
    git -C "$TMP/$src" --no-pager diff "$OLD" "$NEW" -- "${paths[@]}"
  fi
  echo
  echo "Reprends à la main ce qui t'intéresse dans skills/, puis remplace la ligne commit"
  echo "de scripts/$src.lock par : commit $NEW"
  echo
done
