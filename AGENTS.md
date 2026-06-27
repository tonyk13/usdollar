# AGENTS.md — verification commands for AI sessions

This file lists the commands AI sessions (including opencode) should run to verify work in this repo. Check here first before asking the user how to build, typecheck, or run.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run build` | TypeScript typecheck via `tsc` (no emit needed for verification — this compiles to `dist/`) |
| `npm start` | Run the agent once: scrape news, generate report, print to terminal (and email if configured) |
| `npm run dev` | Run `src/index.ts` in watch mode with auto-reload on file changes |
| `npm run scheduler` | Start the persistent node-cron scheduler (daily 8 AM ET, with catch-up on startup) |
| `npm run run-once` | One-shot run: catch-up check → report → exit 0 (for launchd/cron, no long-lived process) |
| `npm run smoke` | Scraping smoke test — invokes `searchUSDNews` with all sources, prints per-source health. No LLM call, no email. |
| `npm test` | No test runner is configured in this project yet |

## Commands arriving with planned OpenSpec changes

These scripts do not exist yet. They will be added by the corresponding change under `openspec/changes/`:

- `npm run test-email` — send a test email to verify SMTP config (from `verify-email-delivery`)

## Conventions

- Source is TypeScript executed directly via `tsx` (no build step needed to run).
- Entry points live in `src/` (`index.ts`, `scheduler.ts`, `agent.ts`, `report.ts`, `email.ts`, `mastra.ts`).
- Secrets live in `.env` (gitignored). Copy `.env.example` to `.env` and fill in real values.
- The project is macOS-targeted (scheduler catch-up logic assumes macOS sleep/wake behavior).
