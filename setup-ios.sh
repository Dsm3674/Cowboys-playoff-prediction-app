#!/bin/bash
# ============================================================
# LoneStar AI — one-command iOS setup for macOS
#
#   bash ~/Documents/Cowboys-playoff-prediction-app/setup-ios.sh
#
# Installs anything missing (Node.js, CocoaPods), builds the
# web app into the iOS project, and opens Xcode ready to run.
# Safe to re-run any time — finished steps are skipped.
# ============================================================

say()  { printf "\n\033[1;36m▸ %s\033[0m\n" "$1"; }
ok()   { printf "\033[1;32m  ✓ %s\033[0m\n" "$1"; }
fail() { printf "\n\033[1;31m✗ %s\033[0m\n\n%s\n\n" "$1" "Copy everything above and paste it to Claude — it will tell you the fix."; exit 1; }

# ── 0. Find the repo (this script lives at its root) ─────────
cd "$(dirname "$0")" || fail "Couldn't find the project folder."
REPO="$(pwd)"
say "Project: $REPO"

[ -d "$REPO/frontend" ] || fail "No 'frontend' folder here — this script must stay inside the Cowboys-playoff-prediction-app folder."
[ -d "$REPO/frontend/ios" ] || fail "This copy of the project is too old (no frontend/ios folder). Re-download the repo from GitHub and run this script again from the new copy."

# ── 1. Xcode ─────────────────────────────────────────────────
say "Checking Xcode…"
if [ ! -d "/Applications/Xcode.app" ]; then
  fail "Xcode isn't installed yet. Install 'Xcode' from the Mac App Store (it's large, ~10GB), open it once, accept the license, then run this script again."
fi
# Point the build tools at the full Xcode app, not the bare Command Line
# Tools — otherwise cap sync fails with "requires Xcode, but active
# developer directory is a command line tools instance".
if ! xcode-select -p 2>/dev/null | grep -q "Xcode.app"; then
  say "Pointing build tools at Xcode (needs your Mac password)…"
  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer || fail "Couldn't select Xcode as the active developer directory."
  sudo xcodebuild -license accept 2>/dev/null || true
fi
ok "Xcode found"

# ── 2. Node.js ───────────────────────────────────────────────
say "Checking Node.js…"
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  say "Node.js is missing — downloading the official installer (needs your Mac password)…"
  PKG_NAME=$(curl -fsSL https://nodejs.org/dist/latest-v22.x/ | grep -o 'node-v[0-9.]*\.pkg' | head -1)
  [ -n "$PKG_NAME" ] || fail "Couldn't reach nodejs.org — check your internet connection and re-run."
  curl -fL -o /tmp/node-lts.pkg "https://nodejs.org/dist/latest-v22.x/$PKG_NAME" || fail "Node.js download failed — check your internet connection and re-run."
  sudo installer -pkg /tmp/node-lts.pkg -target / || fail "Node.js install failed."
  export PATH="/usr/local/bin:$PATH"
  command -v node >/dev/null 2>&1 || fail "Node installed but not found — quit Terminal completely (Cmd+Q), reopen it, and run this script again."
fi
ok "Node $(node -v)"

# ── 3. CocoaPods ─────────────────────────────────────────────
say "Checking CocoaPods…"
if ! command -v pod >/dev/null 2>&1; then
  say "CocoaPods is missing — installing (needs your Mac password; the password typing is invisible, that's normal)…"
  if ! sudo gem install cocoapods; then
    say "gem install didn't work — trying Homebrew instead (this can take a while)…"
    if ! command -v brew >/dev/null 2>&1; then
      NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || fail "Homebrew install failed."
      export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
    fi
    brew install cocoapods || fail "CocoaPods could not be installed."
  fi
  command -v pod >/dev/null 2>&1 || fail "CocoaPods installed but not found — quit Terminal (Cmd+Q), reopen, and run this script again."
fi
ok "CocoaPods $(pod --version)"

# ── 4. JavaScript dependencies ───────────────────────────────
say "Installing project dependencies…"
cd "$REPO/frontend" || fail "Couldn't enter the frontend folder."
npm install --no-audit --no-fund || fail "npm install failed."
ok "JS dependencies ready"

# ── 5. Native iOS dependencies ───────────────────────────────
say "Installing iOS native dependencies…"
( cd ios/App && pod install ) || fail "pod install failed."
ok "iOS pods ready"

# ── 6. Build the app into the iOS project ────────────────────
say "Building the web app…"
npm run ios:build || fail "Build failed."
ok "App built and synced into the iOS project"

# ── 7. Open Xcode ────────────────────────────────────────────
say "Opening Xcode…"
npx cap open ios || open ios/App/App.xcworkspace

printf "\n\033[1;32m════════════════════════════════════════════════════\033[0m\n"
printf "\033[1;32m  All set! In the Xcode window that just opened:\033[0m\n"
printf "\033[1;32m   1. Top toolbar: click the device name next to 'App'\033[0m\n"
printf "\033[1;32m   2. Pick any iPhone simulator (e.g. iPhone 16 Pro)\033[0m\n"
printf "\033[1;32m   3. Press the ▶ play button\033[0m\n"
printf "\033[1;32m  (If the device list is empty: Xcode menu → Settings →\033[0m\n"
printf "\033[1;32m   Components → download the iOS Simulator, then retry.)\033[0m\n"
printf "\033[1;32m════════════════════════════════════════════════════\033[0m\n\n"
