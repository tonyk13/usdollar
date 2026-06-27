## Context

`email.ts` exposes three things today: `getEmailConfig()` (reads env vars with Gmail defaults), `isEmailConfigured()` (truthy check on user/pass/to — no SMTP round-trip), and `sendReportEmail()` (creates a transporter and calls `sendMail`, throwing on auth failure). The scheduler calls `isEmailConfigured()` and, on false, prints a warning but continues to "complete" the run. There is no path that verifies the SMTP connection works ahead of time, and no standalone way to send a test message.

The `.env` file on disk has no `EMAIL_*` entries, so every scheduled run today silently falls through to the "not configured" warning and the report lives only in the terminal.

## Goals / Non-Goals

**Goals:**
- A user can run one command (`npm run test-email`) to confirm their email setup works end-to-end before relying on the scheduler.
- The scheduler/one-shot aborts early with a clear error if `EMAIL_*` are set but invalid, rather than generating a full report and then failing at send time.
- README walks a new user from "no email creds" to "verified test email in inbox" without guesswork.
- No new dependencies.

**Non-Goals:**
- Supporting non-Gmail providers beyond what the existing `SMTP_HOST`/`SMTP_PORT` env vars already allow. The defaults stay Gmail; other providers are config-only.
- HTML-formatted email or attachments. Report stays plain text, matching current behavior.
- Retrying failed sends with backoff. Out of scope; a failed send aborts the run loudly.
- Changing the recipient list to multiple addresses. `EMAIL_TO` stays a single address (matching current `config.to`).

## Decisions

### Decision 1: `verifyEmailConfig()` uses `nodemailer`'s built-in `transporter.verify()`
Add an exported `verifyEmailConfig(): Promise<void>` that builds the same transporter as `sendReportEmail` and calls `transporter.verify()`. On success it resolves; on failure it throws an error with the SMTP error message.

**Why over alternatives:** `transporter.verify()` is the nodemailer-blessed way to check connectivity + auth without sending a message. Rolling our own SMTP handshake would duplicate that. Alternative considered: send a throwaway test email as the verify step — rejected because it leaves clutter in the inbox and conflates "creds work" with "send works"; `verify()` is cleaner. The dedicated `test-email` command (Decision 2) does send a real message for end-to-end confidence.

### Decision 2: `test-email` script sends a small real message
New `src/test-email.ts` calls `isEmailConfigured()` → if false, prints setup instructions and exits 1; if true, calls `verifyEmailConfig()` → then `sendReportEmail("USD News Agent — test", "This is a test email from the USD News Agent. If you received this, email delivery is working.")`. Prints a clear success or failure message.

**Why over alternatives:** `verify()` alone proves SMTP auth but not deliverability to the actual recipient. A tiny test email closes the loop end-to-end (spam filters, wrong `EMAIL_TO`, etc.). Alternative considered: rely on `verify()` only — rejected because it wouldn't catch a wrong `EMAIL_TO` or a Gmail spam filter; the test email is the real proof.

### Decision 3: Scheduler/one-shot verify-on-startup when configured, abort on failure
In `scheduler.ts` (long-lived mode) and `run-once` mode (from change #2), right after confirming `isEmailConfigured()` is true, call `await verifyEmailConfig()`. If it throws, print the error and exit non-zero WITHOUT generating the report. If email is NOT configured, keep current behavior (print warning, proceed to print report to terminal) — don't abort, since the user may intentionally run terminal-only.

**Why over alternatives:** Generating a full report (which costs an LLM API call and scraping time) and then failing at send is wasteful and confusing. Verifying first means a config typo fails in 1 second, not after a 30-second report run. Alternative considered: verify only in `test-email`, let the scheduler fail at send time — rejected because the whole point is to make the scheduled path reliable without manual testing. Alternative considered: abort even when email is not configured — rejected because terminal-only mode is a legitimate choice the README documents.

### Decision 4: `.env.example` email block gets explicit App Password framing and a distinct `EMAIL_TO`
Rewrite the email section of `.env.example` to: (a) link to the Gmail App Password support article inline, (b) state that `EMAIL_PASS` MUST be an App Password, not a regular password, (c) show `EMAIL_TO` as a separate field with an example that's visibly different from `EMAIL_USER`, (d) keep the optional `SMTP_HOST`/`SMTP_PORT` lines.

**Why:** The current `.env.example` is correct but terse; users miss the App Password requirement and the `EMAIL_TO` field (which defaults to `EMAIL_USER` if omitted, hiding the fact that it exists). Making these explicit reduces setup error. Alternative considered: leave `.env.example` and put all guidance in README — rejected because the example file is where users copy from; the friction is at copy time, not doc time.

## Risks / Trade-offs

- **[Risk] `transporter.verify()` against Gmail can be slow or rate-limited** → Mitigation: it's a single call on startup, not per-article; acceptable. If it becomes an issue, add a timeout (Decision 1 can wrap `verify()` in a `Promise.race` with a 10s timeout).
- **[Risk] Verify-on-startup aborts a scheduled run that would have succeeded at send time** → Mitigation: `verify()` is strictly weaker than `sendMail` — if `verify()` fails, `sendMail` would have failed too. False negatives are very rare. The test-email script lets the user confirm ahead of time.
- **[Risk] User sets `EMAIL_*` but intends terminal-only** → Mitigation: the abort only happens when `isEmailConfigured()` is true. If they want terminal-only, they leave `EMAIL_*` unset and get the existing warning behavior.
- **[Trade-off] Slightly slower startup for scheduled runs** → Accepted; a ~1s SMTP verify is worth catching a config typo before a 30s report run.
