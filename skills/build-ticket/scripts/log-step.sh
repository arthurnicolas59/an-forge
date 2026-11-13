#!/usr/bin/env bash
# Note une étape de /build-ticket dans le journal, pour que le tableau de suivi la montre.
#
# Usage : log-step.sh <numéro> <étape> "<phrase simple>"
#         log-step.sh <numéro> critere <numéro du critère> "<preuve>"
#   étape : isoler | avant | construire | tester | relire | apres | brief | pr | arrete
#   La phrase dit, sans jargon, ce qui se passe ou ce qui a été fait.
#   Pour « arrete », elle dit pourquoi l'agent s'est arrêté.
#   « critere » coche un critère d'acceptation du ticket : son rang dans la liste du ticket
#   (1 pour le premier), puis la preuve qu'il est couvert.
#
# Le journal est rangé hors du projet, pour ne créer aucun commit et survivre au ménage du ticket :
#   ~/.an-forge/journal/<projet>/<numéro>.jsonl   une ligne JSON par étape
#   ~/.an-forge/projects                          un chemin de projet par ligne
# La variable AN_FORGE_HOME remplace ~/.an-forge (utile pour tester).
#
# Le journal ne sert qu'au suivi : si ce script échoue, le ticket continue.
set -euo pipefail

STEPS="isoler avant construire tester relire apres brief pr arrete critere"

usage() {
  echo "Usage : log-step.sh <numéro> <étape> \"<phrase simple>\"" >&2
  echo "        log-step.sh <numéro> critere <numéro du critère> \"<preuve>\"" >&2
  exit 2
}

[ $# -ge 3 ] || usage

NUM=$1
STEP=$2
shift 2

# Pour « critere », le premier argument est le rang du critère dans la liste du ticket.
CRITERION=null
if [ "$STEP" = "critere" ]; then
  [ $# -ge 2 ] || usage
  if ! [[ "$1" =~ ^[1-9][0-9]*$ ]]; then
    echo "Le numéro du critère doit être un nombre à partir de 1 : $1" >&2
    exit 2
  fi
  CRITERION=$1
  shift
fi
MESSAGE="$*"

if ! [[ "$NUM" =~ ^[0-9]+$ ]]; then
  echo "Le numéro du ticket doit être un nombre : $NUM" >&2
  exit 2
fi
case " $STEPS " in
  *" $STEP "*) ;;
  *) echo "Étape inconnue : $STEP (attendu : $STEPS)" >&2; exit 2 ;;
esac

# Le projet est le checkout principal, même si on est dans un worktree.
COMMON=$(git rev-parse --path-format=absolute --git-common-dir)
ROOT=$(dirname "$COMMON")
PROJECT=$(basename "$ROOT")

HOME_DIR=${AN_FORGE_HOME:-$HOME/.an-forge}
DIR="$HOME_DIR/journal/$PROJECT"
mkdir -p "$DIR"

# Inscrit le projet dans la liste, une seule fois.
REGISTRY="$HOME_DIR/projects"
touch "$REGISTRY"
grep -qxF "$ROOT" "$REGISTRY" || echo "$ROOT" >> "$REGISTRY"

# Échappe une chaîne pour JSON : antislash, guillemets, tabulations et retours à la ligne.
json() {
  local s=$1
  s=${s//\\/\\\\}
  s=${s//\"/\\\"}
  s=${s//$'\t'/ }
  s=${s//$'\r'/ }
  s=${s//$'\n'/ }
  printf '"%s"' "$s"
}

TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)
BRANCH=$(git branch --show-current 2>/dev/null || true)

printf '{"time":%s,"project":%s,"ticket":%s,"step":%s,"criterion":%s,"message":%s,"branch":%s}\n' \
  "$(json "$TIME")" "$(json "$PROJECT")" "$NUM" "$(json "$STEP")" "$CRITERION" "$(json "$MESSAGE")" "$(json "$BRANCH")" \
  >> "$DIR/$NUM.jsonl"

echo "journal=$DIR/$NUM.jsonl"
