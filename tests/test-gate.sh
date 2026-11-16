#!/usr/bin/env bash
# Teste skills/build-ticket/scripts/gate.sh sur un petit repo jetable.
set -euo pipefail
cd "$(dirname "$0")/.."
GATE="$PWD/skills/build-ticket/scripts/gate.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
PASS=0
fail() { echo "FAIL: $1" >&2; echo "--- sortie :" >&2; cat "$TMP/out" >&2; exit 1; }

export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
R="$TMP/repo"
git init -q -b main "$R"
cd "$R"
mkdir -p scripts .github/workflows tests
printf '#!/usr/bin/env bash\n[ ! -f FAIL ]\n' > scripts/checks.sh
echo "name: checks" > .github/workflows/checks.yml
printf 'test("a", () => {\n  expect(1).toBe(1)\n})\n' > tests/a.test.js
printf '{\n  "scripts": {\n    "test": "vitest run"\n  },\n  "dependencies": {}\n}\n' > package.json
echo "export default {}" > vitest.config.ts
git add -A && git commit -qm init

# Chaque cas part d'une branche neuve depuis main. $1 : nom du cas.
case_start() { git checkout -q main; git checkout -q -B "cas-$1"; }
commit() { git add -A && git commit -qm "$1"; }
run_gate() { set +e; bash "$GATE" main >"$TMP/out" 2>&1; code=$?; set -e; }
has() { grep -qF -- "$1" "$TMP/out"; }

case_start propre
echo "export const x = 1" > app.js; commit app
run_gate
[ $code = 0 ] || fail "propre : code $code"
has "GATE: PASS" || fail "propre : pas de PASS"
has "RÉGLAGES" && fail "propre : signal inattendu"
[ "$(cat "$(git rev-parse --git-dir)/an-forge-gate-pass")" = "$(git rev-parse HEAD)" ] || fail "propre : commit testé non retenu"
PASS=$((PASS + 1))

case_start checks-sh
echo "exit 0" >> scripts/checks.sh; commit checks
run_gate
[ $code = 1 ] && has "modifie scripts/checks.sh" || fail "checks.sh modifié : devait être refusé"
PASS=$((PASS + 1))

case_start workflow
echo "# x" >> .github/workflows/checks.yml; commit wf
run_gate
[ $code = 1 ] && has "modifie .github/workflows/checks.yml" || fail "checks.yml modifié : devait être refusé"
PASS=$((PASS + 1))

case_start echec
touch FAIL; commit fail
run_gate
[ $code = 1 ] && has "GATE: FAIL" || fail "checks en échec : devait échouer"
[ ! -f "$(git rev-parse --git-dir)/an-forge-gate-pass" ] || fail "échec : un commit testé a été retenu"
PASS=$((PASS + 1))

case_start skip
printf 'test.skip("b", () => {})\n' >> tests/a.test.js; commit skip
run_gate
[ $code = 0 ] && has "test désactivé : tests/a.test.js" || fail "test.skip ajouté : non signalé"
PASS=$((PASS + 1))

case_start xit
printf 'xit("c", () => {})\n' > tests/b.spec.js; commit xit
run_gate
has "test désactivé : tests/b.spec.js" || fail "xit ajouté : non signalé"
PASS=$((PASS + 1))

case_start pytest
printf 'import pytest\n\n@pytest.mark.skip\ndef test_x():\n    pass\n' > tests/test_x.py; commit py
run_gate
has "test désactivé : tests/test_x.py" || fail "@pytest.mark.skip : non signalé"
PASS=$((PASS + 1))

case_start exit
printf 'test("d", () => { process.exit(0) })\n' >> tests/a.test.js; commit exit
run_gate
has "test désactivé" && fail "process.exit pris pour xit"
PASS=$((PASS + 1))

case_start config
echo "export default { test: { exclude: ['tests/**'] } }" > vitest.config.ts; commit cfg
run_gate
[ $code = 0 ] && has "réglage modifié : vitest.config.ts" || fail "vitest.config.ts : non signalé"
PASS=$((PASS + 1))

case_start dep
sed -i.bak 's/"dependencies": {}/"dependencies": { "left-pad": "1.0.0" }/' package.json && rm package.json.bak; commit dep
run_gate
has "RÉGLAGES" && fail "ajout de dépendance signalé à tort"
PASS=$((PASS + 1))

case_start script-test
sed -i.bak 's/"test": "vitest run"/"test": "echo ok"/' package.json && rm package.json.bak; commit script
run_gate
has "commandes de checks modifiées : package.json" || fail "script test de package.json : non signalé"
PASS=$((PASS + 1))

case_start suppression
git rm -q tests/a.test.js; commit rm
run_gate
has "supprimé : tests/a.test.js" || fail "test supprimé : non signalé"
PASS=$((PASS + 1))

echo "gate.sh : $PASS cas OK"
