#!/usr/bin/env bash
# Teste skills/build-ticket/scripts/merge-pr.sh avec un faux gh : un repo jetable, son « origin » local,
# et des réponses de GitHub fixées par variables d'environnement.
set -euo pipefail
cd "$(dirname "$0")/.."
SCRIPTS="$PWD/skills/build-ticket/scripts"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
PASS=0
fail() { echo "FAIL: $1" >&2; echo "--- sortie :" >&2; cat "$TMP/out" >&2; exit 1; }

# Le faux gh. FAKE_CHECKS : ok|fail|pending|none. FAKE_LABEL=1 : la PR porte checks-modifies.
mkdir -p "$TMP/bin"
cat >"$TMP/bin/gh" <<'GH'
#!/usr/bin/env bash
args="$*"
case "$args" in
  "pr view"*statusCheckRollup*"first // empty"*) exit 0 ;;
  "pr view"*statusCheckRollup*"length == 0"*) echo "${FAKE_CHECKS:-ok}" ;;
  "pr view"*statusCheckRollup*) exit 0 ;;
  "pr view"*headRefOid*)
    accept=false; [ "${FAKE_LABEL:-0}" = 1 ] && accept=true
    printf 'OPEN\t%s\t%s\tmain\t%s\t%s\n' "$FAKE_HEAD" "$FAKE_SHA" "${FAKE_DRAFT:-true}" "$accept" ;;
  "pr ready"*) echo ready >>"$FAKE_LOG" ;;
  "pr merge"*) echo merge >>"$FAKE_LOG" ;;
  "repo view"*) exit 1 ;;
  *) exit 0 ;;
esac
GH
chmod +x "$TMP/bin/gh"
export PATH="$TMP/bin:$PATH" FAKE_LOG="$TMP/log"
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t

git init -q --bare -b main "$TMP/origin.git"
R="$TMP/projet"
git clone -q "$TMP/origin.git" "$R" 2>/dev/null
cd "$R"
git checkout -q -b main
mkdir -p scripts .github/workflows
printf '#!/usr/bin/env bash\nexit 0\n' > scripts/checks.sh
echo "name: checks" > .github/workflows/checks.yml
git add -A && git commit -qm init && git push -q origin main

# Une branche de ticket poussée, avec un worktree, en partant de main. $1 : nom, $2 : fichier à changer.
ticket() {
  local wt="${WTBASE:-$TMP}/wt-$1"
  git worktree add -q -b "ticket/$1" "$wt" main
  echo "x" >> "$wt/$2"
  git -C "$wt" add -A && git -C "$wt" commit -qm "$1"
  git -C "$wt" push -q origin "ticket/$1"
  export FAKE_HEAD="ticket/$1" FAKE_SHA=$(git -C "$wt" rev-parse HEAD)
  WT=$wt
}
run_merge() { rm -f "$FAKE_LOG"; set +e; bash "$SCRIPTS/merge-pr.sh" 1 >"$TMP/out" 2>&1; code=$?; set -e; }
merged() { grep -qx merge "$FAKE_LOG" 2>/dev/null; }

# 1. Tout est vérifié : sortie du brouillon puis merge.
ticket ok app.js
(cd "$WT" && bash "$SCRIPTS/gate.sh" main >/dev/null)
FAKE_CHECKS=ok run_merge
[ $code = 0 ] && merged || fail "tout vert : devait merger (code $code)"
grep -qx ready "$FAKE_LOG" || fail "tout vert : la PR n'est pas sortie du brouillon"
PASS=$((PASS + 1))

# 2. Gate pas passé sur cette version.
ticket gate app2.js
FAKE_CHECKS=ok run_merge
[ $code = 5 ] && ! merged || fail "gate absent : code 5 attendu, obtenu $code"
PASS=$((PASS + 1))

# 3. La PR modifie scripts/checks.sh : refusée, même avec un gate et des checks verts.
ticket checks scripts/checks.sh
FAKE_CHECKS=ok run_merge
[ $code = 8 ] && ! merged || fail "checks.sh modifié : code 8 attendu, obtenu $code"
PASS=$((PASS + 1))

# 4. Pareil pour un workflow.
ticket wf .github/workflows/checks.yml
FAKE_CHECKS=ok run_merge
[ $code = 8 ] || fail "workflow modifié : code 8 attendu, obtenu $code"
PASS=$((PASS + 1))

# 5. Avec l'étiquette checks-modifies, la PR passe ce contrôle (puis le gate est demandé : code 5).
FAKE_LABEL=1 FAKE_CHECKS=ok run_merge
[ $code = 5 ] || fail "étiquette checks-modifies : code 5 attendu, obtenu $code"
PASS=$((PASS + 1))

# 6. Rien de vérifiable : pas de worktree ici et aucun check GitHub.
ticket nowt app3.js
git worktree remove --force "$WT"
FAKE_CHECKS=none run_merge
[ $code = 9 ] && ! merged || fail "rien de vérifié : code 9 attendu, obtenu $code"
PASS=$((PASS + 1))

# 7. Pas de worktree ici, mais les checks GitHub sont verts : merge.
FAKE_CHECKS=ok run_merge
[ $code = 0 ] && merged || fail "checks GitHub verts sans worktree : devait merger (code $code)"
PASS=$((PASS + 1))

# 8. Checks GitHub en échec, puis en cours.
FAKE_CHECKS=fail run_merge
[ $code = 6 ] || fail "checks en échec : code 6 attendu, obtenu $code"
FAKE_CHECKS=pending run_merge
[ $code = 7 ] || fail "checks en cours : code 7 attendu, obtenu $code"
PASS=$((PASS + 1))

# 9. La PR ne contient pas le dernier main.
ticket retard app4.js
(cd "$WT" && bash "$SCRIPTS/gate.sh" main >/dev/null)
echo "y" > autre.js && git add -A && git commit -qm autre && git push -q origin main
FAKE_CHECKS=ok run_merge
[ $code = 4 ] || fail "pas à jour : code 4 attendu, obtenu $code"
PASS=$((PASS + 1))

# 10. Le worktree du ticket est dans un dossier dont le chemin contient un espace
# (comme « Software Factory ») : le gate qui y a passé est bien retrouvé, la PR est mergée.
WTBASE="$TMP/dossier avec espace"
mkdir -p "$WTBASE"
ticket espace app5.js
(cd "$WT" && bash "$SCRIPTS/gate.sh" main >/dev/null)
FAKE_CHECKS=ok run_merge
[ $code = 0 ] && merged || fail "chemin avec espace : devait merger (code $code)"
unset WTBASE
PASS=$((PASS + 1))

echo "merge-pr.sh : $PASS cas OK"
