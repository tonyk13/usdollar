## 1. One-shot entry mode

- [ ] 1.1 Refactor `src/scheduler.ts` to support two modes via argv or a new `src/run-once.ts`: a `run-once` mode that calls `shouldRunCatchUp()` → `runReport()` → `process.exit(0)`, with no `cron.schedule` and no `process.stdin.resume()`
- [ ] 1.2 Keep the existing long-lived mode (current `main()` body) intact for `npm run scheduler`
- [ ] 1.3 Add `"run-once": "tsx src/run-once.ts"` (or argv branch) to `package.json` scripts
- [ ] 1.4 Verify `npm run run-once` runs the report if due and exits 0, and exits 0 without running if not due

## 2. launchd plist template

- [ ] 2.1 Create `plist/com.tonyk.usdollar-news.plist.template` with `StartCalendarInterval` (Hour 8, Minute 0), `RunAtLoad: true`, `StandardOutPath`/`StandardErrorPath` using `__LOG_DIR__`, and `ProgramArguments` using `__NODE_PATH__`/`__TSX_PATH__` and `__PROJECT_DIR__`
- [ ] 2.2 Add clear comments in the plist noting the timezone assumption (fires in the Mac's local tz; set Mac to America/New_York or adjust `Hour`)
- [ ] 2.3 Configure `WorkingDirectory` to `__PROJECT_DIR__` so relative `.env` loading works

## 3. Install / uninstall scripts

- [ ] 3.1 Create `scripts/install-launchd.sh` that: resolves `which node` and `which tsx` to absolute paths, substitutes `__PROJECT_DIR__`, `__NODE_PATH__`, `__TSX_PATH__`, `__LOG_DIR__` (e.g. `~/.usdollar-logs`) in the template, writes to `~/Library/LaunchAgents/com.tonyk.usdollar-news.plist`, and runs `launchctl load`
- [ ] 3.2 Create `scripts/uninstall-launchd.sh` that runs `launchctl unload` and removes the plist from `~/Library/LaunchAgents/`
- [ ] 3.3 Make both scripts executable (`chmod +x`) and add a `postinstall` note to README rather than auto-running

## 4. Verify end-to-end

- [ ] 4.1 Run the install script, confirm `launchctl list | grep usdollar` shows the agent
- [ ] 4.2 Temporarily set the plist `StartCalendarInterval` to 2 minutes ahead, reload, and confirm the report fires with no terminal open
- [ ] 4.3 Confirm a second trigger (e.g. `launchctl kickstart` immediately after) does NOT double-run, thanks to `shouldRunCatchUp()`
- [ ] 4.4 Run the uninstall script and confirm the agent is gone from `launchctl list`

## 5. Documentation

- [ ] 5.1 Replace the `nohup` recommendation in README with a "Scheduled Reports (macOS, recommended)" section describing the launchd install
- [ ] 5.2 Keep the existing `npm run scheduler` section, relabeled as "Scheduled Reports (interactive / non-macOS)"
- [ ] 5.3 Add a Troubleshooting note covering: timezone mismatch, `launchctl list` inspection, log file location, and how to manually trigger (`launchctl kickstart gui/$(id -u)/com.tonyk.usdollar-news`)
