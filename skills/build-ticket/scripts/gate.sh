#!/usr/bin/env bash
# Le gate : la branche passe-t-elle les checks du projet ?
# À lancer depuis le worktree du ticket.
#
# Usage : gate.sh <base>     (par exemple origin/main)
#
# Échoue si la branche a modifié scripts/checks.sh ou .github/workflows/checks.yml
# (on ne change pas les règles pour passer), sinon lance scripts/checks.sh. Code de sortie 0 seulement si tout passe.
# Quand tout passe sans modification en cours, retient le commit testé (lu par merge-pr.sh).
# La sortie complète est gardée dans .git du worktree (chemin affiché), la fin est affichée en cas d'échec.
set -uo pipefail

if [ $# -lt 1 ]; then
  echo "Usage : gate.sh <base>" >&2
  exit 2
fi
BASE=$1

ROOT=$(git rev-parse --show-toplevel) || exit 2
cd "$ROOT"

if [ ! -f scripts/checks.sh ]; then
  echo "GATE: FAIL — scripts/checks.sh est introuvable. Lance /project-init pour le créer." >&2
  exit 1
fi

for f in scripts/checks.sh .github/workflows/checks.yml; do
  if ! git diff --quiet "$(git merge-base "$BASE" HEAD)" -- "$f"; then
    echo "GATE: FAIL — la branche modifie $f. Annule ce changement : on ne change pas les checks pour faire passer une branche." >&2
    exit 1
  fi
done

LOG="$(git rev-parse --git-dir)/an-forge-checks.log"
PASSED="$(git rev-parse --git-dir)/an-forge-gate-pass"
rm -f "$PASSED"
# Sans modification en cours, ce qui est testé est exactement le dernier commit : on pourra le prouver au merge.
CLEAN=0
[ -z "$(git status --porcelain)" ] && CLEAN=1
start=$(date +%s)
bash scripts/checks.sh >"$LOG" 2>&1
code=$?
secs=$(( $(date +%s) - start ))

if [ $code -eq 0 ]; then
  [ "$CLEAN" = 1 ] && git rev-parse HEAD >"$PASSED"
  echo "GATE: PASS (${secs}s) — sortie complète : $LOG"
  exit 0
fi

echo "GATE: FAIL (code $code, ${secs}s) — fin de la sortie ci-dessous, complète dans $LOG" >&2
tail -n 60 "$LOG" >&2
exit 1
