#!/usr/bin/env bash
# Teste skills/project-architecture/scripts/architecture.py sur un projet jetable.
set -euo pipefail
cd "$(dirname "$0")/.."
A="$PWD/skills/project-architecture/scripts/architecture.py"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
PASS=0
fail() { echo "FAIL: $1" >&2; [ -f "$TMP/out" ] && cat "$TMP/out" >&2; exit 1; }
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t

R="$TMP/recettes"
git init -q -b main "$R"
cd "$R"
mkdir -p src/app/recettes src/components tests .github/workflows .cache node_modules/lib
for f in src/app/page.tsx src/app/recettes/page.tsx src/components/Carte.tsx tests/a.test.ts \
  .github/workflows/checks.yml .cache/x node_modules/lib/i.js; do echo x > "$f"; done
echo "node_modules/" > .gitignore
H="$TMP/out"
check() { set +e; python3 "$A" check >"$H" 2>&1; code=$?; set -e; }
tree_block() { sed -n '/^```text$/,/^```$/p' ARCHITECTURE.md; }

# 1. Pas de fiche : check le dit (code 3) ; init la crée, une seule fois, au nom du projet.
check
[ $code = 3 ] && grep -qx "architecture=missing" "$H" || fail "sans fiche : code 3 attendu"
python3 "$A" init >"$H"; grep -q "architecture=created" "$H" || fail "init"
grep -q "^# Architecture de recettes" ARCHITECTURE.md || fail "nom du projet dans le titre"
cp ARCHITECTURE.md "$TMP/avant"
python3 "$A" init >"$H"; grep -qx "architecture=exists" "$H" || fail "init sur une fiche existante"
cmp -s ARCHITECTURE.md "$TMP/avant" || fail "init a écrasé la fiche"
PASS=$((PASS + 1))

# 2. Une fiche neuve n'est pas à jour : texte « À REMPLIR » et dossiers absents.
check
[ $code = 1 ] && grep -q "À REMPLIR" "$H" && grep -q "dossier pas encore dans la fiche : src/" "$H" || fail "fiche neuve : stale attendu"
PASS=$((PASS + 1))

# 3. tree dessine les vrais dossiers, sur 2 niveaux : ni dossiers cachés (sauf .github), ni dossiers ignorés.
python3 "$A" tree >"$H"
grep -qx "nouveaux=6 disparus=0" "$H" || fail "6 dossiers attendus"
tree_block | grep -q "workflows/" || fail ".github/workflows absent"
tree_block | grep -qE "\.cache|node_modules" && fail "dossier caché ou ignoré dessiné"
tree_block | grep -q "recettes/ *#" && fail "3e niveau dessiné (src/app/recettes)"
tree_block | grep -q "├── src/ *# À EXPLIQUER" || fail "dossier nouveau non marqué À EXPLIQUER"
PASS=$((PASS + 1))

# 4. Une fois tout expliqué, check passe.
python3 - <<'PY'
import re
p = "ARCHITECTURE.md"
s = open(p, encoding="utf-8").read().replace("À REMPLIR", "Texte écrit")
n = iter(range(100))
s = re.sub(r"# À EXPLIQUER", lambda m: f"# Explication {next(n)}", s)
open(p, "w", encoding="utf-8").write(s)
PY
check
[ $code = 0 ] && grep -qx "architecture=ok" "$H" || fail "fiche complète : ok attendu"
PASS=$((PASS + 1))

# 5. Un dossier ajouté et un dossier supprimé : check le voit ; tree garde les explications existantes.
mkdir -p src/hooks && echo x > src/hooks/use.ts
rm -r tests
check
[ $code = 1 ] && grep -q "pas encore dans la fiche : src/hooks/" "$H" && grep -q "n'existe plus : tests/" "$H" || fail "ajout/suppression non vus"
expl=$(tree_block | grep "components/" | sed 's/.*# //')
python3 "$A" tree >"$H"
grep -qx "nouveaux=1 disparus=1" "$H" || fail "tree : 1 nouveau, 1 disparu"
tree_block | grep -q "components/ *# $expl" || fail "explication de components perdue"
tree_block | grep -q "hooks/ *# À EXPLIQUER" || fail "hooks non marqué"
tree_block | grep -q "tests/" && fail "tests/ toujours dessiné"
PASS=$((PASS + 1))

# 6. La profondeur se règle dans le marqueur.
sed -i.bak 's/an-forge:dossiers profondeur=2/an-forge:dossiers profondeur=3/' ARCHITECTURE.md && rm ARCHITECTURE.md.bak
python3 "$A" tree >"$H"
tree_block | grep -q "recettes/ *# À EXPLIQUER" || fail "profondeur=3 : src/app/recettes attendu"
PASS=$((PASS + 1))

# 7. Un arbre retouché à la main (alignement) est signalé ; sans marqueurs, check l'explique.
python3 - <<'PY'
p = "ARCHITECTURE.md"
s = open(p, encoding="utf-8").read().replace("# À EXPLIQUER", "# Expliqué")
s = s.replace("── src/  ", "── src/")
open(p, "w", encoding="utf-8").write(s)
PY
check
[ $code = 1 ] && grep -q "pas dessiné comme le script" "$H" || fail "arbre retouché non signalé"
sed -i.bak '/an-forge:dossiers/d' ARCHITECTURE.md && rm ARCHITECTURE.md.bak
check
[ $code = 1 ] && grep -q "pas de marqueurs" "$H" || fail "marqueurs absents non signalés"
PASS=$((PASS + 1))

echo "architecture.py : $PASS cas OK"
