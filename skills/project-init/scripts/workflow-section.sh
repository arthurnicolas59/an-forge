#!/usr/bin/env bash
# Tient à jour la section « Workflow » d'AGENTS.md : elle appartient à an-forge, le reste du fichier
# appartient au projet. Remplace la section par celle du modèle, sans toucher au reste.
#
# Usage : workflow-section.sh [--check]
#   --check  ne modifie rien, dit seulement où en est la section.
# Affiche une ligne workflow=current|updated|outdated|custom|absent :
#   current   identique au modèle
#   updated   remplacée par celle du modèle (sans --check)
#   outdated  écrite par une ancienne version d'an-forge, à remplacer (avec --check)
#   custom    écrite à la main pour ce projet : jamais remplacée
#   absent    pas d'AGENTS.md, ou pas de section « Workflow »
set -uo pipefail

TEMPLATE="$(cd "$(dirname "$0")/.." && pwd)/templates/AGENTS.md"
ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
CHECK=0
[ "${1:-}" = "--check" ] && CHECK=1

python3 - "$TEMPLATE" "$ROOT/AGENTS.md" "$CHECK" <<'PY'
import re, sys
from pathlib import Path

template, target, check = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3] == "1"

def section(text):
    """Début et fin de la section « ## Workflow » : jusqu'au titre « ## » suivant."""
    m = re.search(r"^## Workflow[ \t]*\n", text, re.M)
    if not m:
        return None
    nxt = re.search(r"^## ", text[m.end():], re.M)
    return m.start(), (m.end() + nxt.start()) if nxt else len(text)

if not target.is_file():
    print("workflow=absent"); sys.exit(0)
text = target.read_text(encoding="utf-8")
ref = template.read_text(encoding="utf-8")
a, b = section(ref)
wanted = ref[a:b]
pos = section(text)
if not pos:
    print("workflow=absent"); sys.exit(0)
start, end = pos
current = text[start:end]
if current.strip() == wanted.strip():
    print("workflow=current"); sys.exit(0)
# Écrite par an-forge : avec le marqueur, ou l'ancienne version sans marqueur.
ours = "an-forge:workflow" in current or "### Niveau feature : la réalisation" in current
if not ours:
    print("workflow=custom"); sys.exit(0)
if check:
    print("workflow=outdated"); sys.exit(0)
if end < len(text) and not wanted.endswith("\n\n"):
    wanted += "\n"
target.write_text(text[:start] + wanted + text[end:], encoding="utf-8")
print("workflow=updated")
PY
