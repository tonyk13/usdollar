#!/bin/bash
# install-launchd.sh — Install the USD News Agent launchd scheduled task
#
# This script:
#   1. Resolves absolute paths for node, tsx, and the project directory
#   2. Substitutes placeholders in the plist template
#   3. Copies the plist to ~/Library/LaunchAgents/
#   4. Loads it with launchctl
#
# Usage: ./scripts/install-launchd.sh

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TEMPLATE="$PROJECT_DIR/plist/com.tonyk.usdollar-news.plist.template"
PLIST_NAME="com.tonyk.usdollar-news.plist"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
LOG_DIR="$HOME/.usdollar-logs"
PLIST_PATH="$LAUNCH_AGENTS_DIR/$PLIST_NAME"

# --- Resolve paths ---
NODE_PATH="$(which node)"
if [ -z "$NODE_PATH" ]; then
    echo "❌ Could not find 'node' in PATH. Install Node.js first."
    exit 1
fi

TSX_PATH="$PROJECT_DIR/node_modules/tsx/dist/cli.mjs"
if [ ! -f "$TSX_PATH" ]; then
    echo "❌ Could not find tsx at $TSX_PATH"
    echo "   Run 'npm install' in $PROJECT_DIR first."
    exit 1
fi

NODE_PATH_REAL="$(realpath "$NODE_PATH")"
TSX_PATH_REAL="$(realpath "$TSX_PATH")"
PROJECT_DIR_REAL="$(realpath "$PROJECT_DIR")"

echo "📦 Installing USD News Agent launchd task"
echo "   Project:  $PROJECT_DIR_REAL"
echo "   Node:     $NODE_PATH_REAL"
echo "   tsx:      $TSX_PATH_REAL"
echo "   Logs:     $LOG_DIR"
echo ""

# --- Create directories ---
mkdir -p "$LAUNCH_AGENTS_DIR"
mkdir -p "$LOG_DIR"

# --- Unload existing if present ---
if launchctl list | grep -q "com.tonyk.usdollar-news" 2>/dev/null; then
    echo "🔄 Unloading existing task..."
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
fi

# --- Substitute placeholders and write plist ---
echo "📝 Writing plist to $PLIST_PATH..."
sed \
    -e "s|__PROJECT_DIR__|$PROJECT_DIR_REAL|g" \
    -e "s|__NODE_PATH__|$NODE_PATH_REAL|g" \
    -e "s|__TSX_PATH__|$TSX_PATH_REAL|g" \
    -e "s|__LOG_DIR__|$LOG_DIR|g" \
    "$TEMPLATE" > "$PLIST_PATH"

# --- Load with launchctl ---
echo "🔄 Loading with launchctl..."
launchctl load "$PLIST_PATH"

# --- Verify ---
if launchctl list | grep -q "com.tonyk.usdollar-news"; then
    echo ""
    echo "✅ Installed successfully!"
    echo ""
    echo "   The agent will run:"
    echo "     • Daily at 8:00 AM local time"
    echo "     • On boot/wake if 8 AM was missed (RunAtLoad + catch-up logic)"
    echo ""
    echo "   Logs: $LOG_DIR/usdollar-news.log"
    echo "         $LOG_DIR/usdollar-news.err.log"
    echo ""
    echo "   To verify:   launchctl list | grep usdollar"
    echo "   To trigger:  launchctl kickstart gui/$(id -u)/com.tonyk.usdollar-news"
    echo "   To uninstall: ./scripts/uninstall-launchd.sh"
else
    echo "❌ Installation may have failed. Check:"
    echo "   launchctl list | grep usdollar"
    echo "   plutil -lint $PLIST_PATH"
    exit 1
fi
