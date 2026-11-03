#!/usr/bin/env bash
# Installs or updates Ink Brain on a Mac: curl -fsSL https://inkbrain.app/install.sh | bash
# Options: --no-start (do not open it afterwards), --uninstall (remove it). INK_BRAIN_DIR changes where it is installed.
set -euo pipefail

REPO="https://github.com/A-Georgiou/ink-brain.git"
HOME_DIR="$HOME/.ink-brain"
APP_DIR="${INK_BRAIN_DIR:-$HOME_DIR/app}"
LAUNCHER="${INK_BRAIN_LAUNCHER:-$HOME/Applications/Ink Brain.app}"
BUNDLE_ID="app.inkbrain.launcher"
ICON_URL="https://inkbrain.app/AppIcon.icns"

if [ -t 1 ]; then
    BOLD=$'\033[1m' DIM=$'\033[2m' PURPLE=$'\033[38;5;141m' GREEN=$'\033[32m' YELLOW=$'\033[33m' RED=$'\033[31m' RESET=$'\033[0m'
else
    BOLD="" DIM="" PURPLE="" GREEN="" YELLOW="" RED="" RESET=""
fi

step() { printf '\n%s●%s %s%s%s\n' "$PURPLE" "$RESET" "$BOLD" "$*" "$RESET"; }
ok() { printf '  %s✓%s %s\n' "$GREEN" "$RESET" "$*"; }
note() { printf '  %s%s%s\n' "$DIM" "$*" "$RESET"; }
warn() { printf '  %s!%s %s\n' "$YELLOW" "$RESET" "$*"; }
fail() {
    printf '\n%s✗ %s%s\n' "$RED" "$*" "$RESET" >&2
    exit 1
}

# Asks a yes or no question on the terminal, even when this script arrives through a pipe; no terminal means no.
ask() {
    local reply
    (exec </dev/tty) 2>/dev/null || return 1
    printf '  %s?%s %s %s[Y/n]%s ' "$PURPLE" "$RESET" "$1" "$DIM" "$RESET" >/dev/tty
    read -r reply </dev/tty || return 1
    [[ -z "$reply" || "$reply" =~ ^[Yy] ]]
}

node_ok() {
    local version major minor
    version=$(node -p 'process.versions.node' 2>/dev/null) || return 1
    IFS=. read -r major minor _ <<<"$version"
    ((major > 22 || (major == 22 && minor >= 12)))
}

usage() {
    printf 'Installs or updates Ink Brain.\n\n  curl -fsSL https://inkbrain.app/install.sh | bash\n  curl -fsSL https://inkbrain.app/install.sh | bash -s -- --uninstall\n\nOptions:\n  --no-start   install or update without opening Ink Brain\n  --uninstall  remove Ink Brain (your settings and memory stay in ~/.ink-brain)\n'
}

# Runs a command quietly, showing what it printed only if it fails.
quietly() {
    local output
    output=$("$@" 2>&1) && return
    printf '%s\n' "$output" | tail -n 25 >&2
    return 1
}

is_checkout() { [ -f "$1/package.json" ] && grep -q '"name": "ink-brain"' "$1/package.json"; }
is_launcher() { [ -f "$1/Contents/Info.plist" ] && grep -q "$BUNDLE_ID" "$1/Contents/Info.plist"; }
running() { pgrep -f "$APP_DIR/node_modules/electron" >/dev/null 2>&1; }

check_mac() {
    step "Checking your Mac"
    [ "$(uname -s)" = "Darwin" ] || fail "Ink Brain runs on macOS only."
    local version
    version=$(sw_vers -productVersion)
    [ "${version%%.*}" -ge 14 ] || fail "Ink Brain needs macOS 14 or later, and this Mac has macOS $version."
    ok "macOS $version on $(uname -m)"

    if ! xcode-select -p >/dev/null 2>&1; then
        xcode-select --install >/dev/null 2>&1 || true
        fail "Ink Brain needs the Xcode Command Line Tools to build its helper. Finish installing them in the window that just opened, then run this command again."
    fi
    xcrun --find swiftc >/dev/null 2>&1 || fail "The Xcode Command Line Tools look incomplete. Run: xcode-select --install"
    ok "Xcode Command Line Tools"

    if ! node_ok; then
        if command -v node >/dev/null 2>&1; then warn "Node.js $(node -v) is too old; Ink Brain needs 22.12 or later."; else warn "Node.js is not installed."; fi
        if command -v brew >/dev/null 2>&1 && ask "Install the latest Node.js with Homebrew?"; then
            brew install node || fail "Homebrew could not install Node.js."
            hash -r
        fi
        node_ok || fail "Install Node.js 22.12 or later from https://nodejs.org (or with Homebrew or nvm), then run this command again."
    fi
    ok "Node.js $(node -v)"
}

check_copilot() {
    step "Checking GitHub Copilot"
    if command -v copilot >/dev/null 2>&1; then
        ok "Copilot CLI is installed"
        return
    fi
    warn "Ink Brain uses your GitHub Copilot subscription, signed in through Copilot CLI."
    if ask "Install GitHub Copilot CLI with npm now?" && npm install -g @github/copilot --no-audit --no-fund --loglevel=error; then
        hash -r
        ok "Copilot CLI is installed"
        if command -v copilot >/dev/null 2>&1 && ask "Sign in to GitHub Copilot now?"; then
            copilot login </dev/tty || warn "Sign-in did not finish. Run copilot login before you ask Ink Brain anything."
        fi
    else
        note "Install it later with npm install -g @github/copilot (or brew install --cask copilot-cli), then sign in with copilot login."
    fi
}

fetch_app() {
    step "Getting Ink Brain"
    if [ -d "$APP_DIR/.git" ]; then
        is_checkout "$APP_DIR" || fail "$APP_DIR is not an Ink Brain checkout. Move it aside or set INK_BRAIN_DIR."
        git -C "$APP_DIR" pull --ff-only --quiet || fail "Could not update $APP_DIR. If you changed files there, move them aside and run this command again."
        ok "Updated to $(git -C "$APP_DIR" log -1 --format='%h, %cr')"
    else
        [ ! -e "$APP_DIR" ] || [ -z "$(ls -A "$APP_DIR" 2>/dev/null)" ] || fail "$APP_DIR already exists and is not empty. Move it aside or set INK_BRAIN_DIR."
        [ -d "$HOME_DIR" ] || mkdir -m 700 "$HOME_DIR"
        mkdir -p "$(dirname "$APP_DIR")"
        git clone --depth 1 --quiet "$REPO" "$APP_DIR" || fail "Could not download Ink Brain from $REPO."
        ok "Downloaded into $APP_DIR"
    fi

    step "Installing its parts"
    note "This can take a minute the first time."
    (cd "$APP_DIR" && quietly npm install --no-audit --no-fund) || fail "npm could not install Ink Brain's dependencies. Check the messages above, then run this command again."
    ok "Dependencies"
    (cd "$APP_DIR" && quietly node -e "require('electron')") || fail "Could not download Electron. Check your connection and run this command again."
    ok "Electron"
    (cd "$APP_DIR" && quietly npm run build:helper) || fail "Could not build the Ink Brain helper with swiftc. Check that the Xcode Command Line Tools are installed."
    ok "Native helper"
}

make_launcher() {
    step "Adding Ink Brain to your Applications"
    if [ -e "$LAUNCHER" ]; then
        is_launcher "$LAUNCHER" || fail "$LAUNCHER already exists and was not made by this installer. Move it aside and run this command again."
        rm -rf "$LAUNCHER"
    fi
    local contents="$LAUNCHER/Contents"
    mkdir -p "$contents/MacOS" "$contents/Resources"
    cat >"$contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key><string>Ink Brain</string>
    <key>CFBundleDisplayName</key><string>Ink Brain</string>
    <key>CFBundleIdentifier</key><string>$BUNDLE_ID</string>
    <key>CFBundleExecutable</key><string>ink-brain</string>
    <key>CFBundleIconFile</key><string>AppIcon</string>
    <key>CFBundlePackageType</key><string>APPL</string>
    <key>CFBundleShortVersionString</key><string>1.0</string>
    <key>LSMinimumSystemVersion</key><string>14.0</string>
    <key>LSUIElement</key><true/>
</dict>
</plist>
PLIST
    # Apps opened from Finder do not see your shell's PATH, so the launcher remembers where Node.js is.
    {
        printf '#!/bin/bash\n# Starts Ink Brain from %s. Written by https://inkbrain.app/install.sh\n' "$APP_DIR"
        printf 'export PATH=%q:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin\n' "$(dirname "$(command -v node)")"
        printf 'cd %q || exit 1\n' "$APP_DIR"
        printf 'exec npm start >%q 2>&1\n' "$HOME_DIR/launcher.log"
    } >"$contents/MacOS/ink-brain"
    chmod +x "$contents/MacOS/ink-brain"
    curl -fsSL "$ICON_URL" -o "$contents/Resources/AppIcon.icns" 2>/dev/null || note "Could not fetch the app icon; Ink Brain will use a plain one."
    touch "$LAUNCHER"
    ok "$LAUNCHER"
}

uninstall() {
    step "Removing Ink Brain"
    if running; then warn "Ink Brain is running. Quit it from its menu bar icon first, then run this again."; exit 1; fi
    if is_checkout "$APP_DIR"; then
        # The Copilot extension is shared, so it is only removed when it points at this copy of Ink Brain.
        local shim="${COPILOT_HOME:-$HOME/.copilot}/extensions/ink-brain/extension.mjs"
        if [ -f "$shim" ] && grep -qF "$APP_DIR/" "$shim"; then
            (cd "$APP_DIR" && quietly node scripts/install-extension.mjs --uninstall) || warn "Could not remove the Copilot extension at $shim"
        fi
        rm -rf "$APP_DIR"
        ok "Removed $APP_DIR"
    else
        note "No Ink Brain checkout in $APP_DIR"
    fi
    if is_launcher "$LAUNCHER"; then
        rm -rf "$LAUNCHER"
        ok "Removed $LAUNCHER"
    fi
    printf '\nYour settings and memory are still in %s. Delete that folder to remove them as well.\n' "$HOME_DIR"
}

main() {
    local start=1
    for arg in "$@"; do
        case "$arg" in
            --no-start) start=0 ;;
            --uninstall)
                uninstall
                return
                ;;
            -h | --help)
                usage
                return
                ;;
            *) fail "Unknown option: $arg (try --help)" ;;
        esac
    done

    printf '\n%sInk Brain%s %s· circle anything, ask, see it explained%s\n' "$BOLD" "$RESET" "$DIM" "$RESET"
    check_mac
    check_copilot
    local was_running=0
    running && was_running=1
    fetch_app
    make_launcher

    printf '\n%s%sInk Brain is installed.%s\n\n' "$GREEN" "$BOLD" "$RESET"
    printf '  Open it any time from Spotlight or Launchpad: %sInk Brain%s\n' "$BOLD" "$RESET"
    printf '  First launch: allow %sInk Brain Helper%s to use Screen Recording, the Microphone and Speech Recognition, then click %sRestart helper%s.\n' "$BOLD" "$RESET" "$BOLD" "$RESET"
    printf '  Then press %s⌥ ⇧ Space%s, circle anything and ask.\n\n' "$BOLD" "$RESET"
    printf '  %sUpdate: run this command again. Uninstall: curl -fsSL https://inkbrain.app/install.sh | bash -s -- --uninstall%s\n' "$DIM" "$RESET"

    if [ "$was_running" = 1 ]; then
        warn "Ink Brain was already running. Quit it from the menu bar and open it again to use the update."
    elif [ "$start" = 1 ]; then
        open "$LAUNCHER" && printf '\n  Starting Ink Brain. Look for the ink drop in your menu bar.\n'
    fi
}

main "$@"
