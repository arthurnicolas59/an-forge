#!/usr/bin/env bash
# Teste skills/project-dashboard/scripts/dashboard.py sur un projet jetable, avec des tickets fixés
# dans tests/fixtures/dashboard/github.json (un ticket dans chaque état possible).
set -euo pipefail
cd "$(dirname "$0")/.."
D="$PWD/skills/project-dashboard/scripts/dashboard.py"
FIX="$PWD/tests/fixtures/dashboard"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
PASS=0
fail() { echo "FAIL: $1" >&2; [ -f "$TMP/out" ] && cat "$TMP/out" >&2; exit 1; }
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t

R="$TMP/recettes"
git init -q -b main "$R"
cd "$R"
echo "# Recettes du soir" > AGENTS.md
mkdir -p docs/adr
printf '# Supabase pour les données\n\nOn garde les recettes et les comptes dans Supabase : base et connexion au même endroit, gratuit au début.\n' > docs/adr/0001-supabase.md
printf '# Recettes\n\n## Language\n\n**Profil de goûts**:\nCe que la personne aime, n aime pas, et ne peut pas manger.\n_Avoid_: Préférences\n' > GLOSSARY.md
git add -A && git commit -qm init
H="$TMP/out"
page="$R/.an-forge/dashboard/index.html"
render() { set +e; python3 "$D" render --from-json "$FIX/github.json" >"$H" 2>&1; code=$?; set -e; }
has() { grep -qF -- "$1" "$page" || fail "$2 : « $1 » absent de la page"; }

# 1. Sans description : status la dit manquante, la page se fabrique quand même.
python3 "$D" status >"$H"
grep -qx "description=missing" "$H" || fail "status sans description"
render
[ $code = 0 ] || fail "render sans description : code $code"
has "pas encore écrite" "sans description"
PASS=$((PASS + 1))

# 2. La page n'est jamais commitée : .an-forge/ est exclu de git.
[ -z "$(git status --porcelain)" ] || fail ".an-forge/ apparaît dans git status"
PASS=$((PASS + 1))

# 3. Avec la description, avant stamp : stale ; après stamp : ok.
cp "$FIX/description.json" .an-forge/dashboard/description.json
python3 "$D" status >"$H"; grep -qx "description=stale" "$H" || fail "description non tamponnée : stale attendu"
python3 "$D" stamp >"$H"
python3 "$D" status >"$H"; grep -qx "description=ok" "$H" || fail "après stamp : ok attendu"
PASS=$((PASS + 1))

# 4. AGENTS.md change : la description redevient stale.
echo "Stack : Next.js" >> AGENTS.md
python3 "$D" status >"$H"; grep -qx "description=stale" "$H" || fail "AGENTS.md changé : stale attendu"
python3 "$D" stamp >/dev/null
echo "# Architecture" > ARCHITECTURE.md
python3 "$D" status >"$H"; grep -qx "description=stale" "$H" || fail "ARCHITECTURE.md ajouté : stale attendu"
python3 "$D" stamp >/dev/null
PASS=$((PASS + 1))

# 5. Chaque état de ticket est calculé.
git branch -q ticket/7-favorites
render
[ $code = 0 ] || fail "render : code $code"
has "Recettes du soir" "titre"
has "Terminé" "#2 et #3 fermés"
has "PR à relire" "#4 a une PR ouverte"
has "Attend un autre ticket" "#5 bloqué par #4 (Blocked by dans le corps)"
has "attend #4" "#5 bloqué par #4"
has "Une question t&#x27;attend" "#6 needs-info"
has "En construction" "#7 a une branche"
has "Arrêté, à regarder" "#9 ready-for-human"
has "Corriger l&#x27;accent" "#8 petite demande fermée"
PASS=$((PASS + 1))

# 6. Les chiffres : 9 tickets (6 de la spec, 2 petites demandes… dont #2 n'est pas compté deux fois).
has "<b>3/8</b>" "3 terminés sur 8"
has "38%" "pourcentage"
PASS=$((PASS + 1))

# 7. À faire maintenant : la question d'abord, puis la PR à relire.
grep -o 'class="next">.*' "$page" | grep -qE 'Réponds.*#6.*Lis le brief.*PR #12' || fail "ordre des prochaines actions"
PASS=$((PASS + 1))

# 8. Architecture, stack, décisions, lexique, livraisons.
has "La base de données" "architecture"
has "Supabase (PostgreSQL)" "stack"
has "Supabase pour les données" "décision"
has "Profil de goûts</b><span>Ce que la personne aime" "lexique"
has "13 novembre 2026" "livraison datée"
PASS=$((PASS + 1))

# 9. Une description invalide est refusée, avec la raison.
python3 - <<'PY'
import json; p=".an-forge/dashboard/description.json"; d=json.load(open(p)); d["architecture"]=d["architecture"][:1]; d["architecture"][0]["icone"]="licorne"
json.dump(d, open(p, "w"))
PY
render
[ $code = 1 ] && grep -q "architecture" "$H" && grep -q "licorne" "$H" || fail "description invalide : refus attendu"
PASS=$((PASS + 1))

# 10. Projet sans GitHub, tickets dans .scratch/.
rm .an-forge/dashboard/description.json
mkdir -p docs/agents .scratch/favoris/issues
echo "Issues live as markdown files in .scratch/ (Local Markdown)" > docs/agents/issue-tracker.md
printf '# Favoris\n' > .scratch/favoris/spec.md
printf '# Ajouter aux favoris\nStatus: done\n' > .scratch/favoris/issues/01-ajouter.md
printf '# Voir ses favoris\nStatus: ready-for-agent\nBlocked by: 01\n' > .scratch/favoris/issues/02-voir.md
printf '# Trier\nStatus: needs-info\n' > .scratch/favoris/issues/03-trier.md
set +e; python3 "$D" render >"$H" 2>&1; code=$?; set -e
[ $code = 0 ] || fail "render local : code $code"
has "Tickets lus dans .scratch/" "tracker local"
has "<b>1/3</b>" "1 terminé sur 3 en local"
has "Prêt à construire" "02 prêt (01 est fini)"
PASS=$((PASS + 1))

echo "dashboard.py : $PASS cas OK"
