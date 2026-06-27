## ADDED Requirements

### Requirement: Reboot-surviving scheduled trigger
The system SHALL support a launchd-based scheduling mode on macOS that triggers the report at 8 AM local time every day without requiring an open terminal, and that survives reboot and logout.

#### Scenario: Mac awake at 8 AM
- **WHEN** the Mac is awake and the launchd agent is installed
- **THEN** the report generation is triggered at 8 AM local time with no terminal open

#### Scenario: Mac rebooted before 8 AM
- **WHEN** the Mac reboots at 7:55 AM with the launchd agent installed
- **THEN** the 8 AM report still fires at 8 AM that day without manual intervention

#### Scenario: Mac asleep at 8 AM, wakes later
- **WHEN** the Mac was asleep at 8 AM and wakes at 9:30 AM with the launchd agent installed and `RunAtLoad: true`
- **THEN** the report generation is triggered on wake, and the catch-up logic decides whether to run based on `.last-run.json`

### Requirement: One-shot entry mode
The system SHALL provide a `run-once` entry mode that performs the catch-up check, runs the report if needed, and exits with status 0, without keeping a long-lived process alive. This mode is suitable for invocation by launchd.

#### Scenario: launchd invokes one-shot and a run is due
- **WHEN** the `run-once` mode is invoked and `shouldRunCatchUp()` returns true
- **THEN** the report is generated, emailed if configured, `.last-run.json` is updated, and the process exits 0

#### Scenario: launchd invokes one-shot and no run is due
- **WHEN** the `run-once` mode is invoked and `shouldRunCatchUp()` returns false
- **THEN** no report is generated and the process exits 0 without error

### Requirement: Catch-up remains the single source of truth
Both the launchd `run-once` path and the interactive `scheduler` path SHALL use the same `shouldRunCatchUp()` logic and `.last-run.json` state to decide whether to run. A redundant trigger (e.g. launchd calendar fire plus a `RunAtLoad` shortly after) MUST NOT cause a double run.

#### Scenario: Double trigger in the same day
- **WHEN** the report has already run today (`.last-run.json` is after today's 8 AM ET) and a second trigger fires
- **THEN** `shouldRunCatchUp()` returns false and no second report is generated

### Requirement: Plist template and install script
The repository SHALL include a launchd plist template with placeholders for project directory, node/tsx binary paths, and log directory, plus an install script that resolves those placeholders to absolute paths, copies the plist to `~/Library/LaunchAgents/`, and loads it with `launchctl`. An uninstall script SHALL unload and remove the plist.

#### Scenario: Installing the launchd agent
- **WHEN** the user runs the install script
- **THEN** the plist is written to `~/Library/LaunchAgents/` with absolute paths to the project and to `tsx`, loaded via `launchctl`, and a confirmation message is printed

#### Scenario: Uninstalling the launchd agent
- **WHEN** the user runs the uninstall script
- **THEN** the agent is unloaded via `launchctl unload`, the plist is removed from `~/Library/LaunchAgents/`, and the system reverts to requiring the interactive `scheduler` mode

### Requirement: Interactive mode preserved
The existing `npm run scheduler` interactive mode SHALL continue to work unchanged for development and manual runs, and for non-macOS users. The launchd mode is an additional, recommended path on macOS, not a replacement for it.

#### Scenario: Developer runs interactive scheduler
- **WHEN** a user runs `npm run scheduler`
- **THEN** the long-lived node-cron process starts, catch-up runs on startup, and the daily 8 AM schedule is registered, exactly as before
