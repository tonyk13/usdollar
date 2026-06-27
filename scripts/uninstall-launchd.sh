#!/bin/bash
# uninstall-launchd.sh — Remove the USD News Agent launchd scheduled task
#
# This script:
#   1. Unloads the agent from launchctl
#   2. Removes the plist from ~/Library/LaunchAgents/
#   3. Optionally removes the log directory
#
# Usage: ./scripts/uninstall-launchd.sh [--purge-logs]

set -euo pipefail

PLIST_NAME="com.tonyk.usdollar-news.plist"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
LOG_DIR="$HOME/.usdollar-logs"
PLIST_PATH="$LAUNCH_AGENTS_DIR/$PLIST_NAME"
LABEL="com.tonyk.usdollar-news"

echo "🗑️  Uninstalling USD News Agent launchd task"
echo ""

# --- Unload if loaded ---
if launchctl list | grep -q "$LABEL" 2>/dev/null; then
    echo "🔄 Unloading from launchctl..."
    launchctl unload "$PLIST_PATH"
    echo "   Unloaded."
else
    echo "ℹ️  Task not currently loaded. Skipping unload."
fi

# --- Remove plist ---
if [ -f "$PLIST_PATH" ]; then
    rm "$PLIST_PATH"
    echo "📝 Removed plist: $PLIST_PATH"
else
    echo "ℹ️  Plist not found at $PLIST_PATH (already removed?)"
fi

# --- Optionally purge logs ---
if [ "${1:-}" = "--purge-logs" ]; then
    if [ -d "$LOG_DIR" ]; then
        rm -rf "$LOG_DIR"
        echo "🗑️  Removed log directory: $LOG_DIR"
    fi
else
    if [ -d "$LOG_DIR" ]; then
        echo "ℹ️  Log directory preserved: $LOG_DIR"
        echo "   To remove logs: ./scripts/uninstall-launchd.sh --purge-logs"
    fi
fi

# --- Verify ---
if launchctl list | grep -q "$LABEL" 2>/dev/null; then
    echo "⚠️  Task still appears in launchctl list. Try:"
    echo "   launchctl remove $LABEL"
else
    echo ""
    echo "✅ Uninstalled successfully."
    echo "   The agent will no longer run automatically."
    echo "   To run manually: npm run scheduler  (terminal-bound)"
    echo "                    npm run run-once   (single run)"
fi
