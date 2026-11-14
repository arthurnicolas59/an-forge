#!/usr/bin/env bash
# Reconstruit les cartes d'an-forge (docs/) à partir de leurs données, puis vérifie
# que chaque skill de skills/ figure sur la carte « an-forge par phase ».
#
#   docs/skill-map/map.json  → docs/skill-map/index.html  (skill visual, vérifiée dans Chrome)
#   docs/mattpocock/map.json → docs/mattpocock/index.html (carte d'Eric Tech, reprise telle quelle)
#
# Usage : scripts/build-maps.sh            reconstruit et vérifie
#         scripts/build-maps.sh --check    vérifie seulement que chaque skill a sa place
#         scripts/build-maps.sh --thumbs   reconstruit aussi les vignettes de docs/index.html
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"

check() {
  python3 - <<'PY'
import json, pathlib, sys
skills = sorted(p.parent.name for p in pathlib.Path("skills").glob("*/SKILL.md"))
smap = json.load(open("docs/skill-map/map.json"))
on_map = {n["id"] for n in smap["nodes"]}
bad = []
for s in skills:
    if s not in on_map: bad.append(f"{s} n'a pas de nœud dans docs/skill-map/map.json")
for n in smap["nodes"]:
    src = n.get("source")
    for f in ([src] if isinstance(src, str) else src or []):
        if not pathlib.Path(f.split(":")[0]).exists():
            bad.append(f"{n['id']} : la source {f} n'existe pas")
# Le panneau de détail affiche 4 puces au plus (le reste est collé à la 4e, puis coupé),
# et coupe une puce trop longue. Une puce = une phrase.
import re
for n in smap["nodes"]:
    puces = [x for x in re.split(r"(?<=[.!?])\s+(?=[A-ZÀ-Ý`/])|;\s+", n.get("how", "")) if x]
    if len(puces) > 4: bad.append(f"{n['id']} : « how » fait {len(puces)} puces, 4 au plus")
    for x in puces:
        if len(x) > 150: bad.append(f"{n['id']} : une puce de « how » dépasse 150 caractères")
for b in bad: print("CARTE :", b)
if bad: sys.exit(1)
print(f"Cartes : les {len(skills)} skills ont leur place.")
PY
}

check
[ "${1:-}" = "--check" ] && exit 0

python3 docs/_shared/sync_explore.py
python3 docs/_shared/build_skillmap.py mattpocock
python3 skills/visual/scripts/visual.py render --map docs/skill-map/map.json \
  --out docs/skill-map/index.html --no-open \
  --source-base https://github.com/arthurnicolas59/an-forge/blob/main/ \
  --shots "${TMPDIR:-/tmp}/an-forge-map-shots"
python3 scripts/translate-map.py docs/skill-map/index.html

if [ "${1:-}" = "--thumbs" ]; then
  CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  command -v google-chrome >/dev/null 2>&1 && CHROME=google-chrome
  for t in skill-map mattpocock; do
    PROFILE=$(mktemp -d)
    "$CHROME" --headless=new --disable-gpu --user-data-dir="$PROFILE" --hide-scrollbars \
      --virtual-time-budget=5000 --window-size=1440,900 \
      --screenshot="$ROOT/docs/assets/thumbs/$t.png" "file://$ROOT/docs/$t/index.html" >/dev/null 2>&1
    rm -rf "$PROFILE"
    command -v sips >/dev/null 2>&1 && sips -Z 960 "docs/assets/thumbs/$t.png" >/dev/null
  done
  echo "Vignettes refaites dans docs/assets/thumbs/."
fi
