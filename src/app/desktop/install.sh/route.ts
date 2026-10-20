import { originOf } from "@/lib/launch";

/**
 * curl -fsSL <site>/desktop/install.sh | bash
 * Files fetched with curl carry no quarantine flag, so macOS opens the app without
 * the "unidentified developer" prompt. Falls back to ~/Applications without admin rights.
 */
export function GET(req: Request) {
  const { origin } = originOf(req);
  const script = `#!/bin/bash
set -euo pipefail
APP="Lab CS"
URL="${origin}/api/desktop/download/mac-zip"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
echo "Downloading $APP..."
curl -fL --progress-bar "$URL" -o "$TMP/app.zip"
ditto -x -k "$TMP/app.zip" "$TMP/x"
SRC="$(find "$TMP/x" -maxdepth 2 -name "$APP.app" -print -quit)"
if [ -z "$SRC" ]; then echo "Download looked wrong. Try the .dmg from the website."; exit 1; fi
DEST="/Applications"
if [ ! -w "$DEST" ]; then DEST="$HOME/Applications"; mkdir -p "$DEST"; fi
osascript -e "quit app \\"$APP\\"" >/dev/null 2>&1 || true
rm -rf "$DEST/$APP.app"
mv "$SRC" "$DEST/"
xattr -dr com.apple.quarantine "$DEST/$APP.app" 2>/dev/null || true
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$DEST/$APP.app" >/dev/null 2>&1 || true
echo "Installed to $DEST/$APP.app"
open "$DEST/$APP.app" --args --setup "${origin}"
echo "Done. Go back to the website and press Open in app."
`;
  return new Response(script, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
