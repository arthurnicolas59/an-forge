#!/usr/bin/env bash
# Lance tous les tests d'an-forge (tests/test-*.sh). Code de sortie 0 seulement si tous passent.
set -uo pipefail
cd "$(dirname "$0")"
failed=0
for t in test-*.sh; do
  bash "$t" || { echo "ÉCHEC : $t" >&2; failed=1; }
done
exit $failed
