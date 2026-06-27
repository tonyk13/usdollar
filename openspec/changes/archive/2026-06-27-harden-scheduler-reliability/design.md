## Context

`scheduler.ts` today does three things in one long-lived process:
1. On startup, runs `shouldRunCatchUp()` (compares `.last-run.json` to today's 8 AM ET) and runs the report if missed.
2. Registers `cron.schedule("0 8 * * *", ..., { timezone: "America/New_York" })` for the daily run.
3. Calls `process.stdin.resume()` to keep the process alive until Ctrl+C.

This only works while a terminal stays open. The catch-up logic is sound; the process-supervision layer is the weak point. launchd is macOS's native process supervisor and is already running on every Mac — it survives reboots, handles sleep/wake, and can run jobs at load or on a calendar schedule.

## Goals / Non-Goals

**Goals:**
- The report runs at 8 AM ET every day without a terminal open, surviving reboot and logout.
- Missed runs (Mac asleep at 8 AM) catch up automatically on wake.
- The same `generateUSDReport` + `sendReportEmail` + `saveLastRunTime` code path is reused — no second implementation of the report logic.
- Interactive `npm run scheduler` still works for development/manual runs.

**Non-Goals:**
- Cross-platform scheduling (Linux systemd, Windows Task Scheduler). This project is macOS-targeted per the README; non-macOS users keep the existing node-cron mode.
- A daemon that does anything other than run-the-report-then-exit. No web UI, no status server.
- Removing `node-cron` from dependencies. It stays for the interactive mode.
- Changing the report-generation or email logic itself.

## Decisions

### Decision 1: launchd `StartCalendarInterval` over a `launchd` keep-alive daemon
The plist uses `StartCalendarInterval` with `Hour: 8, Minute: 0` and the `America/New_York`-aware approach: launchd calendar intervals are in local system time, so we set the Mac's timezone expectation in docs and rely on the OS. Plus `RunAtLoad: true` so that on wake/boot after a missed 8 AM, the agent fires immediately and `shouldRunCatchUp()` decides whether to actually run.

**Why over alternatives:** A keep-alive daemon that polls "is it past 8 AM and haven't I run?" reintroduces the long-lived-process problem we're solving. `StartCalendarInterval` is the launchd-native cron equivalent. Alternative considered: a `cron` system crontab entry — rejected because launchd is the macOS-blessed supervisor, handles sleep/wake more gracefully, and doesn't require crontab editing.

**Note on timezone:** launchd `StartCalendarInterval` fires in the Mac's local system timezone. The existing `getToday8AMET()` logic in `scheduler.ts` already computes 8 AM ET robustly. We document that the Mac's clock should be set to America/New_York (or that the plist hour should be adjusted to 8 AM in the Mac's local tz). `shouldRunCatchUp()` remains the guard so a slightly-off timezone never double-runs.

### Decision 2: One-shot entry mode (`run-once`) over having launchd run the persistent scheduler
Add a `run-once` script that invokes a new entry in `scheduler.ts` (or a small `src/run-once.ts`) which: runs catch-up check → runs report if needed → exits 0. launchd invokes this. The long-lived `scheduler` mode stays for interactive use.

**Why:** launchd jobs should be short-lived and exit. Running the persistent `npm run scheduler` under launchd would fight the supervisor (launchd would keep restarting it, or `process.stdin.resume()` would hang waiting for stdin that doesn't exist). A one-shot that does the work and exits is the correct launchd citizen.

### Decision 3: Keep `shouldRunCatchUp()` + `.last-run.json` as the single source of truth for "did we run today"
launchd's `RunAtLoad` will fire the one-shot on every wake/boot. The one-shot calls the existing `shouldRunCatchUp()`; if the report already ran today (`.last-run.json` is after today's 8 AM ET), it exits without running. This means double-triggers (launchd calendar fire + a wake shortly after) are safe.

**Why over alternatives:** Moving "did we run today" into launchd state would split the truth across two systems. Keeping it in `.last-run.json` means the interactive and launchd paths share identical guard logic. Alternative considered: trust launchd's `StartCalendarInterval` alone and drop catch-up — rejected because it wouldn't catch "asleep at 8 AM" until the next wake, and `RunAtLoad` fires on every load, not just missed-schedule catch-up.

### Decision 4: Plist checked in as a template, install script fills paths
Commit `plist/com.tonyk.usdollar-news.plist.template` with `__PROJECT_DIR__`, `__NODE_PATH__`, and `__LOG_DIR__` placeholders. A small `scripts/install-launchd.sh` substitutes absolute paths and copies to `~/Library/LaunchAgents/`, then `launchctl load`s it.

**Why:** A committed plist with absolute paths is non-portable across machines. A template + install script keeps the repo clean and makes the install explicit. Alternative considered: generate the plist at install time from scratch in the script — rejected because the template makes the launchd config reviewable in git.

## Risks / Trade-offs

- **[Risk] launchd timezone mismatch** if the Mac isn't set to America/New_York → Mitigation: `shouldRunCatchUp()` guards against double-runs; document the timezone assumption in the README and in the plist comments. If the user's Mac is in another tz, they edit the plist `Hour` to 8 AM local.
- **[Risk] `RunAtLoad` fires the report at unwanted times** (e.g. every `launchctl reload`) → Mitigation: `shouldRunCatchUp()` returns false if today's run already happened, so redundant loads are no-ops.
- **[Risk] launchd can't find `node`/`tsx`** because it runs with a minimal PATH → Mitigation: the install script resolves absolute paths to `tsx` and `node` (`which tsx`) and bakes them into the plist; the plist's `ProgramArguments` uses absolute binary paths.
- **[Risk] User uninstalls but `.last-run.json` lingers** → Mitigation: uninstall script optionally removes `.last-run.json`; document that removing the plist reverts to interactive mode cleanly.
- **[Trade-off] macOS-only production path** → Accepted, matches the project's existing macOS framing. Linux/Windows users keep `npm run scheduler`.
- **[Trade-off] Two scheduling modes to document** → Accepted; the README will clearly mark launchd as "recommended (macOS)" and node-cron as "interactive/development".
