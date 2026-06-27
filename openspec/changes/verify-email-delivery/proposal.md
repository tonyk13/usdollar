## Why

The current `.env` is 69 bytes — it holds only `MOONSHOT_API_KEY`, no email credentials. The scheduler (`scheduler.ts:133-149`) checks `isEmailConfigured()` and, when false, prints a warning to the terminal but still marks the run as complete. So today the "daily report" is never actually emailed; it only prints to a terminal no one is looking at. `email.ts` has no way to verify credentials work before the scheduled run, and no test-send command. A report that's "delivered" only to stdout is the gap.

## What Changes

- Add a `test-email` npm script that sends a small confirmation email using the configured `EMAIL_*` credentials and reports success or the specific failure (auth, network, wrong port) to the terminal.
- Add credential validation to `email.ts`: a `verifyEmailConfig()` that creates the transporter and calls `transporter.verify()` to confirm SMTP connectivity/auth before any report is sent.
- Fail loudly when `EMAIL_*` vars are present but invalid: the scheduler and one-shot entry points MUST call `verifyEmailConfig()` on startup (when email is configured) and abort with a clear error if verification fails, rather than silently failing at send time after generating a report.
- Update `.env.example` with clearer Gmail App Password instructions and a `EMAIL_TO` example distinct from `EMAIL_USER` (so users notice the recipient field).
- Update README with a step-by-step email setup section including the `npm run test-email` verification step.

## Capabilities

### New Capabilities
- `email-delivery`: Delivery of the generated USD news report to a recipient via SMTP, including credential validation, a test-send command, and fail-loud behavior when configured credentials are invalid.

### Modified Capabilities
<!-- None. No existing specs to modify (openspec/specs/ is empty). -->

## Impact

- **Affected code**: `src/email.ts` (add `verifyEmailConfig`), `src/scheduler.ts` and `src/run-once.ts` (call verify on startup when configured), `package.json` (add `test-email` script), new `src/test-email.ts` entry point.
- **Affected files**: `.env.example` (clearer email block), `README.md` (email setup + test step).
- **Dependencies**: none new (`nodemailer` already provides `transporter.verify()`).
- **Behavior change**: a scheduled run with invalid email creds now aborts before report generation instead of generating-then-failing. This is intentional (fail loud, early).
