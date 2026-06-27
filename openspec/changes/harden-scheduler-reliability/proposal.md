## Why

The scheduler (`src/scheduler.ts`) only runs while a terminal is open and the `node-cron` process is alive. If the Mac is asleep, logged out, or the terminal was closed at 8 AM ET, the report silently does not run. The README's own answer is `nohup npm run scheduler > scheduler.log 2>&1 &`, which dies on reboot and offers no restart. A "daily" report that doesn't run daily is the core reliability gap of this project.

## What Changes

- Migrate the daily 8 AM ET trigger from `node-cron` + `process.stdin.resume()` to a macOS `launchd` agent (a `~/Library/LaunchAgents/com.tonyk.usdollar-news.plist`).
- Configure the launchd agent with `RunAtLoad: true` so the catch-up check fires automatically on wake/boot if 8 AM was missed — no terminal required.
- Keep the existing catch-up logic in `scheduler.ts` (`shouldRunCatchUp` + `.last-run.json`) as the source of truth for "did we already run today", so launchd simply triggers the same code path.
- Add a `run-once` npm script and entry mode so launchd invokes a single report run and exits (no long-lived process), distinct from the existing interactive `scheduler` script.
- Document the install/uninstall of the plist and remove the `nohup` recommendation from the README.

## Capabilities

### New Capabilities
- `scheduling`: Reliable, reboot-surviving scheduling of the daily USD news report on macOS via launchd, including automatic catch-up when the scheduled time was missed.

### Modified Capabilities
<!-- None. No existing specs to modify (openspec/specs/ is empty). -->

## Impact

- **Affected code**: `src/scheduler.ts` — split into a one-shot mode (for launchd) and the existing persistent mode (for interactive use). `package.json` — add `run-once` script.
- **New files**: a launchd plist template (checked in, e.g. `plist/com.tonyk.usdollar-news.plist.template` with `__PROJECT_DIR__` placeholder) and an install script.
- **Runtime deps**: none new (`node-cron` retained for the interactive `scheduler` mode; launchd replaces it for the production path).
- **Platform scope**: macOS-only. The launchd path is the primary target because the README already assumes macOS (sleep/catch-up wording). Non-macOS users keep using `npm run scheduler`.
- **Rollback**: `launchctl unload` the plist to revert to terminal-bound `node-cron` with no code changes.
