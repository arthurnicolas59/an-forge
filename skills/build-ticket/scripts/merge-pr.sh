#!/usr/bin/env bash
# Merge une pull request de ticket, seulement si c'est sans danger pour main :
#   1. la PR contient le dernier main (sinon deux changements corrects séparément pourraient
#      casser main une fois réunis) ;
#   2. le gate a passé sur exactement cette version, quand son worktree est sur cette machine ;
#   3. les checks lancés par GitHub sur la PR ont passé, quand le projet en a.
# Puis merge (squash) et fait le ménage.
#
# Usage : merge-pr.sh <numéro de la PR>
# Codes : 0 mergée · 3 PR pas ouverte · 4 pas à jour avec main · 5 gate pas passé sur cette version
#         6 checks GitHub en échec · 7 checks GitHub encore en cours
set -uo pipefail

N=${1:?Usage : merge-pr.sh <numéro de la PR>}
HERE=$(cd "$(dirname "$0")" && pwd)
COMMON=$(git rev-parse --path-format=absolute --git-common-dir) || exit 2
cd "$(dirname "$COMMON")"

info=$(gh pr view "$N" --json state,headRefName,headRefOid,baseRefName --jq '[.state, .headRefName, .headRefOid, .baseRefName] | @tsv') || exit 2
IFS=$'\t' read -r state head sha base <<<"$info"

if [ "$state" != "OPEN" ]; then
  echo "La PR #$N n'est pas ouverte (état : $state)." >&2
  exit 3
fi

git fetch -q origin
if ! git merge-base --is-ancestor "origin/$base" "$sha" 2>/dev/null; then
  echo "PAS À JOUR : la PR #$N ne contient pas le dernier $base. Remets-la à jour (rebase sur origin/$base, gate, push), puis relance." >&2
  exit 4
fi

wt=$(git worktree list --porcelain | awk -v b="refs/heads/$head" '/^worktree /{p=$2} $0=="branch "b{print p}')
if [ -n "$wt" ]; then
  passed=$(cat "$(git -C "$wt" rev-parse --git-dir)/an-forge-gate-pass" 2>/dev/null || true)
  # Le gate vaut aussi pour une version qui n'ajoute que le brief à celle qu'il a testée.
  if [ -n "$passed" ] && [ "$passed" != "$sha" ] && git merge-base --is-ancestor "$passed" "$sha" 2>/dev/null &&
    git diff --quiet "$passed" "$sha" -- ':(top)' ':(top,exclude)docs/briefs/'; then
    passed=$sha
  fi
  if [ "$passed" != "$sha" ]; then
    echo "GATE À RELANCER : le gate n'a pas passé sur la version poussée de la PR #$N. Lance gate.sh dans $wt, pousse si besoin, puis relance." >&2
    exit 5
  fi
else
  echo "Note : le worktree de $head n'est pas sur cette machine, le gate n'a pas pu être revérifié ici."
fi

ci=$(bash "$HERE/pr-checks.sh" "$N" | sed -n 's/^checks=//p')
case "$ci" in
  ok) ;;
  none) echo "Note : GitHub ne lance aucun check sur ce projet. Relance /project-init pour poser .github/workflows/checks.yml." ;;
  pending)
    echo "CHECKS EN COURS : GitHub n'a pas fini de vérifier la PR #$N. Attends avec pr-checks.sh $N --wait, puis relance." >&2
    exit 7 ;;
  *)
    echo "CHECKS EN ÉCHEC : GitHub refuse la PR #$N. Corrige, relance gate.sh, pousse, puis relance." >&2
    exit 6 ;;
esac

gh pr merge "$N" --squash || exit 1
echo "MERGÉE : PR #$N"
bash "$HERE/cleanup.sh"
