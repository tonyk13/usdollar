## 1. Credential verification in `email.ts`

- [ ] 1.1 Add an exported `verifyEmailConfig(): Promise<void>` to `src/email.ts` that builds the same transporter config as `sendReportEmail` and calls `transporter.verify()`, throwing with the SMTP error message on failure
- [ ] 1.2 Add a 10s timeout wrapper (`Promise.race`) so a hung SMTP server doesn't hang the scheduler indefinitely

## 2. `test-email` command

- [ ] 2.1 Create `src/test-email.ts` that: loads `dotenv`, calls `isEmailConfigured()` — if false, prints setup instructions referencing `.env.example` and the App Password article and exits 1; if true, calls `verifyEmailConfig()` then `sendReportEmail("USD News Agent — test", "<short test body>")` and prints success/failure
- [ ] 2.2 Add `"test-email": "tsx src/test-email.ts"` to `package.json` scripts
- [ ] 2.3 Run `npm run test-email` with no creds → confirm it prints instructions and exits 1, making no LLM call and sending no email

## 3. Verify-on-startup in entry points

- [ ] 3.1 In `src/scheduler.ts` long-lived mode, after the existing `isEmailConfigured()` check in `runReport`, add: when configured, `await verifyEmailConfig()` before `generateUSDReport()`; on throw, log the error and return early (do not generate, do not update `.last-run.json`)
- [ ] 3.2 In the `run-once` entry (from change #2), apply the same verify-when-configured-then-abort-on-failure logic
- [ ] 3.3 Ensure terminal-only mode (email not configured) is unchanged: print the existing warning and proceed to generate + print the report

## 4. `.env.example` and README

- [ ] 4.1 Rewrite the email block of `.env.example`: keep `EMAIL_USER`/`EMAIL_PASS`/`EMAIL_TO`, add an inline comment that `EMAIL_PASS` MUST be a Gmail App Password with the support URL, show `EMAIL_TO` with an example address visibly different from the `EMAIL_USER` example, keep optional `SMTP_HOST`/`SMTP_PORT`
- [ ] 4.2 Update README "Email Setup" section: add a numbered step for `npm run test-email` as the verification step, and clarify the App Password requirement
- [ ] 4.3 Note in README that scheduled runs with invalid email config will abort before generating the report (the fail-loud behavior)

## 5. End-to-end verification

- [ ] 5.1 With real Gmail App Password credentials in `.env`, run `npm run test-email` and confirm the test email arrives in the recipient inbox
- [ ] 5.2 Temporarily set `EMAIL_PASS` to a wrong value, run `npm run test-email`, and confirm it fails with a clear auth error and exits 1
- [ ] 5.3 With valid creds, run `npm run run-once` (or `npm start`) and confirm the report generates and is emailed
- [ ] 5.4 With invalid creds, run `npm run run-once` and confirm it aborts before generating the report (no LLM call, no `.last-run.json` update), with a clear error
