#!/usr/bin/env bash
# Vérifie la structure du skill explain-project : métadonnées, sept parties, lecture seule.
# (Le skill n'a pas de script : on teste ce qui peut l'être, pas la qualité des explications.)
set -euo pipefail
cd "$(dirname "$0")/.."
S=skills/explain-project/SKILL.md
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

# 2. Les sept parties demandées sont dans le skill.
for p in "Présentation" "Architecture" "Fonctionnement" "Technologies" "Fichiers importants" "Points de vigilance" "Pour aller plus loin"; do
  grep -q "\*\*$p\*\*" "$S" || fail "partie manquante : $p"
done
PASS=$((PASS + 1))

# 3. La lecture seule et la distinction faits / hypothèses sont écrites.
grep -q "^## Lecture seule" "$S" || fail "section Lecture seule absente"
grep -q "^## Faits et hypothèses" "$S" || fail "section Faits et hypothèses absente"
grep -q "N'invente jamais" "$S" || fail "règle « n'invente jamais » absente"
PASS=$((PASS + 1))

# 4. Pas de dépendance à un outil précis, pas de script, pas de commande qui écrit.
! grep -qiE "claude code|codex|cursor|copilot|gemini" "$S" || fail "outil précis cité"
[ -z "$(ls skills/explain-project | grep -v '^SKILL.md$')" ] || fail "le skill ne doit contenir que SKILL.md"
! grep -qE '^\s*(npm|pip|yarn|pnpm) +(install|add)|git +(commit|push|add)|rm +-' "$S" || fail "commande qui écrit"
PASS=$((PASS + 1))

# 5. Il renvoie vers les skills existants au lieu de les refaire.
for r in "project-architecture" "project-dashboard"; do grep -q "$r" "$S" || fail "renvoi manquant : $r"; done
PASS=$((PASS + 1))

echo "explain-project : $PASS cas OK"
