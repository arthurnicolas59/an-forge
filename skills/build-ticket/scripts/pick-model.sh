#!/usr/bin/env bash
# Choisit le modèle de l'agent qui construit un ticket et celui des relecteurs, toujours de la même façon.
#
# Usage : pick-model.sh <petit|moyen|gros|inconnue> [--eco|--max]
#   petit  → construction sur sonnet
#   moyen  → construction sur opus
#   gros   → construction sur opus
#   --eco  force sonnet, --max force opus (quelle que soit la taille)
# Les relecteurs sont toujours sur opus : on ne relit pas bien avec un petit modèle.
# Une taille inconnue ne se devine pas ici : build-ticket la fait décider par un agent haiku avant d'appeler ce script.
# Affiche deux lignes : build=<sonnet|opus> et review=opus.
set -euo pipefail

TAILLE=${1:-}
OPTION=${2:-}

case "$OPTION" in
  "" | --eco | --max) ;;
  *) echo "Option inconnue : $OPTION (attendu : --eco ou --max)." >&2; exit 2 ;;
esac

case "$OPTION" in
  --eco) BUILD=sonnet ;;
  --max) BUILD=opus ;;
  *)
    case "$TAILLE" in
      petit) BUILD=sonnet ;;
      moyen | gros) BUILD=opus ;;
      *) echo "Taille inconnue : '$TAILLE' (attendu : petit, moyen ou gros)." >&2; exit 2 ;;
    esac
    ;;
esac

echo "build=$BUILD"
echo "review=opus"
