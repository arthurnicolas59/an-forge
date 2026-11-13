#!/usr/bin/env bash
# Crée l'app « an-forge » du Mac : une icône dans Applications, à mettre dans le Dock ou à lancer avec
# Spotlight, qui démarre le tableau de suivi et l'ouvre. macOS seulement.
#
# Usage : install-app.sh [dossier]     (par défaut : ~/Applications)
#   Réinstaller remplace l'app existante. Pour la retirer : supprime le dossier an-forge.app.
#
# L'app passe par le lanceur ~/.an-forge/bin/dashboard, que start.sh tient à jour : elle continue
# de marcher après une mise à jour d'an-forge. Affiche une ligne app=<chemin>.
set -euo pipefail

[ "$(uname)" = "Darwin" ] || { echo "L'app n'existe que pour macOS." >&2; exit 1; }

HERE=$(cd "$(dirname "$0")" && pwd)
DEST=${1:-$HOME/Applications}
APP="$DEST/an-forge.app"
HOME_DIR=${AN_FORGE_HOME:-$HOME/.an-forge}

# Le lanceur doit exister : start.sh l'écrit, sans ouvrir de fenêtre ici.
"$HERE/start.sh" --no-open >/dev/null

mkdir -p "$DEST"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$HERE/../assets/an-forge.icns" "$APP/Contents/Resources/an-forge.icns"

cat >"$APP/Contents/Info.plist" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>an-forge</string>
  <key>CFBundleDisplayName</key><string>an-forge</string>
  <key>CFBundleIdentifier</key><string>local.an-forge.dashboard</string>
  <key>CFBundleExecutable</key><string>an-forge</string>
  <key>CFBundleIconFile</key><string>an-forge</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>LSUIElement</key><true/>
</dict>
</plist>
EOF

# Le programme de l'app : lance le tableau, ou explique quoi faire si le lanceur manque.
cat >"$APP/Contents/MacOS/an-forge" <<EOF
#!/bin/bash
LAUNCHER="$HOME_DIR/bin/dashboard"
if [ -x "\$LAUNCHER" ] && "\$LAUNCHER" >>"$HOME_DIR/app.log" 2>&1; then
  exit 0
fi
/usr/bin/osascript -e 'display dialog "Le tableau an-forge n’a pas pu démarrer. Lance /dashboard une fois dans Claude Code, puis réessaie. Détails : $HOME_DIR/app.log" buttons {"OK"} default button 1 with title "an-forge" with icon caution' >/dev/null
EOF
chmod +x "$APP/Contents/MacOS/an-forge"

# Fait connaître l'app et son icône au Finder, au Dock et à Spotlight.
touch "$APP"
LSREGISTER=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister
[ -x "$LSREGISTER" ] && "$LSREGISTER" -f "$APP" >/dev/null 2>&1 || true

echo "app=$APP"
