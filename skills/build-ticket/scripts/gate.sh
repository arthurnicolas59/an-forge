#!/usr/bin/env bash
# Le gate : la branche passe-t-elle les checks du projet ?
# À lancer depuis le worktree du ticket.
#
# Usage : gate.sh <base>     (par exemple origin/main)
#
# Échoue si la branche a modifié scripts/checks.sh ou .github/workflows/checks.yml
# (on ne change pas les règles pour passer), sinon lance scripts/checks.sh. Code de sortie 0 seulement si tout passe.
# Signale aussi, sans échouer, les tests existants que la branche a supprimés ou dont elle a retiré des lignes.
# Signale de même les réglages qui décident de ce que les checks vérifient (configuration des tests, du lint,
# du typecheck, commandes de package.json) et les tests désactivés (.skip, .only, xit, @pytest.mark.skip…).
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

# Les tests qui existaient avant : supprimés, ou avec des lignes retirées. Un signal, pas un refus :
# le ticket peut le demander. Mais un test qu'on retire pour faire passer les checks doit se voir.
TEST_FILE='(^|/)(tests?|__tests__|specs?|e2e|cypress)/|[._-](test|spec)\.[^/]+$|(^|/)test_[^/]+\.py$'
MB=$(git merge-base "$BASE" HEAD)
TOUCHED=$(
  git diff --name-only --diff-filter=D "$MB" | grep -E "$TEST_FILE" | sed 's/^/  supprimé : /'
  git diff --numstat --diff-filter=M "$MB" | awk -F'\t' '$2 != "0" && $2 != "-" {print $3}' | grep -E "$TEST_FILE" | sed 's/^/  modifié  : /'
)

# Les réglages des checks : changer ces fichiers peut faire passer les checks sans que le code soit bon
# (un test exclu, une règle de lint coupée, un typecheck moins strict). Un signal aussi, pas un refus.
CONFIG_FILE='(^|/)(pyproject\.toml|setup\.cfg|tox\.ini|pytest\.ini|conftest\.py|\.coveragerc|mypy\.ini|ruff\.toml|\.flake8|Makefile|tsconfig[^/]*\.json|\.eslintrc[^/]*|eslint\.config\.[^/]+|\.eslintignore|biome\.jsonc?|(vitest|jest|playwright|cypress|karma|babel)\.config\.[^/]+)$|^\.github/workflows/'
# Dans package.json, seules comptent les lignes des commandes de checks et des réglages de jest / eslint :
# ajouter une dépendance n'est pas un signal.
PKG_KEYS='^[-+][[:space:]]*"(test|lint|typecheck|type-check|check|checks|build|jest|eslintConfig|vitest)[^"]*"[[:space:]]*:'
# Un test désactivé ajouté par la branche, dans un fichier de test.
# (Sans \b, que le grep de macOS ne connaît pas toujours.)
SKIP_MARK='(^|[^A-Za-z0-9_.])((it|test|describe|context|suite)\.(skip|only|todo)([^A-Za-z0-9_]|$)|x(it|test|describe)[[:space:]]*\(|t\.Skip[[:space:]]*\()|@pytest\.mark\.(skip|xfail)|pytest\.skip[[:space:]]*\(|@unittest\.skip|@Disabled|@Ignore'
CONFIG=$(
  git diff --name-only "$MB" | grep -E "$CONFIG_FILE" | sed 's/^/  réglage modifié : /'
  git diff --name-only "$MB" | grep -E '(^|/)package\.json$' | while read -r f; do
    git diff -U0 "$MB" -- "$f" | grep -qE "$PKG_KEYS" && echo "  commandes de checks modifiées : $f"
  done
  git diff --name-only --diff-filter=AMR "$MB" | grep -E "$TEST_FILE" | while read -r f; do
    git diff -U0 "$MB" -- "$f" | grep -E '^\+' | grep -v '^+++' | grep -qE "$SKIP_MARK" && echo "  test désactivé : $f"
  done
)

LOG="$(git rev-parse --git-dir)/an-forge-checks.log"
PASSED="$(git rev-parse --git-dir)/an-forge-gate-pass"
rm -f "$PASSED"
# Sans modification en cours, ce qui est testé est exactement le dernier commit : on pourra le prouver au merge.
# Le dossier des briefs ne compte pas : ses images et son texte ne changent rien aux checks.
CLEAN=0
[ -z "$(git status --porcelain -- ':(top)' ':(top,exclude)docs/briefs/')" ] && CLEAN=1
start=$(date +%s)
bash scripts/checks.sh >"$LOG" 2>&1
code=$?
secs=$(( $(date +%s) - start ))

if [ $code -eq 0 ]; then
  [ "$CLEAN" = 1 ] && git rev-parse HEAD >"$PASSED"
  echo "GATE: PASS (${secs}s) — sortie complète : $LOG"
  if [ -n "$TOUCHED" ]; then
    echo "TESTS EXISTANTS TOUCHÉS — remets-les en l'état, sauf si le ticket le demande ; ce qui reste sera affiché dans le brief :"
    echo "$TOUCHED"
  fi
  if [ -n "$CONFIG" ]; then
    echo "RÉGLAGES DES CHECKS TOUCHÉS — annule ces changements, sauf si le ticket les demande ; ce qui reste sera affiché dans le brief :"
    echo "$CONFIG"
  fi
  exit 0
fi

echo "GATE: FAIL (code $code, ${secs}s) — fin de la sortie ci-dessous, complète dans $LOG" >&2
tail -n 60 "$LOG" >&2
exit 1
