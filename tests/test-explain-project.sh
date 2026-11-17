#!/usr/bin/env bash
# Vérifie la structure du skill explain-project : métadonnées, quatre niveaux, annexes, lecture seule.
# (Le skill n'a pas de script : on teste ce qui peut l'être, pas la qualité des explications.)
set -euo pipefail
cd "$(dirname "$0")/.."
D=skills/explain-project
S=$D/SKILL.md
L=$D/LONG.md
N=$D/NON-DEVELOPER.md
PASS=0
fail() { echo "FAIL: $1" >&2; exit 1; }

# 1. Frontmatter : seulement name et description, name = nom du dossier.
[ -f "$S" ] || fail "SKILL.md absent"
head -1 "$S" | grep -qx -- "---" || fail "frontmatter absent"
fm=$(sed -n '2,/^---$/p' "$S" | sed '$d')
keys=$(printf '%s\n' "$fm" | grep -oE '^[a-z-]+:' | tr -d ':' | tr '\n' ' ')
[ "$keys" = "name description " ] || fail "frontmatter : name et description seulement (trouvé : $keys)"
printf '%s\n' "$fm" | grep -qx "name: explain-project" || fail "name différent du dossier"
PASS=$((PASS + 1))

# 2. V3 : les quatre niveaux de lecture sont dans le skill, dans l'ordre.
prev=0
for p in "Niveau 1 : comprendre en deux minutes" "Niveau 2 : comprendre le fonctionnement" "Niveau 3 : savoir intervenir" "Niveau 4 : approfondir"; do
  n=$(grep -n "^### $p" "$S" | head -1 | cut -d: -f1)
  [ -n "$n" ] || fail "niveau manquant : $p"
  [ "$n" -gt "$prev" ] || fail "niveau dans le désordre : $p"
  prev=$n
done
PASS=$((PASS + 1))

# 3. La lecture seule et la distinction fait / déduction / à confirmer sont écrites.
grep -q "^## Lecture seule" "$S" || fail "section Lecture seule absente"
grep -q "\*\*fait\*\*.*\*\*déduction\*\*.*\*\*à confirmer\*\*" "$S" || fail "statuts fait / déduction / à confirmer absents"
grep -q "N'invente jamais" "$S" || fail "règle « n'invente jamais » absente"
PASS=$((PASS + 1))

# 4. Pas de dépendance à un outil précis, pas de script, pas de commande qui écrit.
! grep -qiE "claude code|codex|cursor|copilot|gemini" "$D"/*.md || fail "outil précis cité"
[ "$(ls "$D" | tr '\n' ' ')" = "LONG.md NON-DEVELOPER.md SKILL.md " ] || fail "le skill ne contient que SKILL.md, LONG.md et NON-DEVELOPER.md"
! grep -qE '^\s*(npm|pip|yarn|pnpm) +(install|add)|git +(commit|push|add)|rm +-' "$D"/*.md || fail "commande qui écrit"
PASS=$((PASS + 1))

# 5. Il renvoie vers les skills existants au lieu de les refaire.
for r in "project-architecture" "project-dashboard"; do grep -q "$r" "$S" || fail "renvoi manquant : $r"; done
PASS=$((PASS + 1))

# 6. V2 : technologies détaillées, carte d'intervention, fiabilité des références.
grep -q "à créer" "$S" || fail "règle « fichier à créer » absente"
grep -q "N'invente pas d'architecture" "$S" || fail "règle « pas d'architecture inventée » absente"
grep -q "^## Fiabilité des références" "$S" || fail "section Fiabilité des références absente"
for t in "Inspecté" "Non inspecté" "Hypothèses restantes" "Limites"; do
  grep -q "\*\*$t\*\*" "$S" || fail "synthèse de fiabilité : $t manquant"
done
grep -q "N'affirme jamais qu'un test passe" "$S" || fail "règle « jamais affirmer qu'un test passe » absente"
grep -q "ce qu'impliquerait de la remplacer" "$L" || fail "technologies : remplacement/suppression absent"
PASS=$((PASS + 1))

# 7. Deux formats : court par défaut, --long pour le détail, mêmes règles de fiabilité.
grep -q "^## Deux formats" "$S" || fail "section Deux formats absente"
grep -q '\*\*Court (par défaut)\*\*' "$S" || fail "format court par défaut absent"
grep -q -- '--long' "$S" || fail "option --long absente"
grep -q "mêmes dans les deux formats" "$S" || fail "règle « mêmes règles dans les deux formats » absente"
PASS=$((PASS + 1))

# 8. Le court reste pédagogique, surtout pour un non-développeur.
grep -q "ni plus sec" "$S" || fail "règle « court reste pédagogique » absente"
grep -q "langage courant" "$N" || fail "règle non-développeur (langage courant) absente"
grep -q "(LONG.md)" "$S" || fail "renvoi vers LONG.md absent"
grep -q "(NON-DEVELOPER.md)" "$S" || fail "renvoi vers NON-DEVELOPER.md absent"
PASS=$((PASS + 1))

# 9. Pour un non-développeur : l'image ne remplace pas le mécanisme, et une raison technique est donnée.
grep -q "l'image ouvre la porte" "$N" || fail "règle « image puis mécanisme » absente"
grep -q "raison technique" "$N" || fail "règle « raison technique » absente"
PASS=$((PASS + 1))

# 10. V3 : priorité à la compréhension, style naturel, relecture avant réponse.
grep -q "La priorité est la compréhension" "$S" || fail "priorité compréhension absente"
grep -q "^## Style d'écriture" "$S" || fail "section Style d'écriture absente"
grep -q "Métaphores rares" "$S" || fail "règle « métaphores rares » absente"
grep -q "^## Relecture avant de répondre" "$S" || fail "section Relecture absente"
grep -q "aucun chemin de fichier n'est tronqué" "$S" || fail "relecture : chemins tronqués absent"
grep -q "La précision ne se sacrifie pas" "$S" || fail "règle précision absente"
PASS=$((PASS + 1))

echo "explain-project : $PASS cas OK"
