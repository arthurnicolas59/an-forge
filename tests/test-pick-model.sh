#!/usr/bin/env bash
# Teste skills/build-ticket/scripts/pick-model.sh.
set -euo pipefail
cd "$(dirname "$0")/.."
P=skills/build-ticket/scripts/pick-model.sh
PASS=0
fail() { echo "FAIL: $1" >&2; exit 1; }
want() {  # $1 sortie attendue (lignes séparées par /), $2 label, le reste : arguments
  local exp=$1 label=$2; shift 2
  local out; out=$("$P" "$@" | tr '\n' '/')
  [ "$out" = "$exp" ] || fail "$label : attendu '$exp', obtenu '$out'"
  PASS=$((PASS + 1))
}
refuse() {  # $1 label, le reste : arguments
  local label=$1; shift
  if "$P" "$@" >/dev/null 2>&1; then fail "$label : devait être refusé"; fi
  PASS=$((PASS + 1))
}
want "build=sonnet/review=opus/" "petit"           petit
want "build=opus/review=opus/"   "moyen"           moyen
want "build=opus/review=opus/"   "gros"            gros
want "build=sonnet/review=opus/" "gros avec --eco" gros --eco
want "build=opus/review=opus/"   "petit avec --max" petit --max
want "build=sonnet/review=opus/" "--eco sans taille fiable" moyen --eco
refuse "taille inconnue"  inconnue
refuse "taille vide"      ""
refuse "option inconnue"  petit --turbo
echo "PASS: test-pick-model.sh ($PASS cas)"
