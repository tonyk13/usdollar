## Context

`/Users/tonyk/Desktop/usdollar` sits inside a git repo whose root is `/Users/tonyk` (the user's home dir). That repo's log is about `index.html` / web-projects; `usdollar/` was never added to it (`git status --porcelain` shows the project as untracked alongside hundreds of other home-dir entries). There is no version-control safety net for the source we're about to start modifying under the other OpenSpec changes. `node_modules/` is ~270 packages and `.env` holds a live API key — both must never be committed.

## Goals / Non-Goals

**Goals:**
- Give `usdollar/` its own git repo, isolated from the home-directory repo.
- Never commit secrets (`.env`) or generated/heavy files (`node_modules/`, `dist/`).
- Capture the project's verification commands in `AGENTS.md` so future AI sessions run lint/typecheck without guessing.
- Make a clean first commit of the existing source as a baseline before any other change is implemented.

**Non-Goals:**
- Pushing to a remote unless the user explicitly opts in.
- Migrating issue tracking, CI, or any tooling beyond the repo itself.
- Changing the home-directory repo in any way.
- Splitting the project into a monorepo or adding submodules.

## Decisions

### Decision 1: `git init` inside `usdollar/`, not a submodule of the home repo
Run `git init` directly in `/Users/tonyk/Desktop/usdollar`. The new `.git/` lives at `usdollar/.git`, completely independent of `/Users/tonyk/.git`.

**Why over alternatives:** A submodule would still require the home repo to track it and adds complexity the user didn't ask for. A subtree merge is overkill. A fresh independent repo is the simplest thing that solves the problem. Alternative considered: move the project out of `~/Desktop` to a "clean" location first — rejected; it would break the existing `package.json` scripts, the OpenSpec `planningHome` resolution, and the user's mental model.

### Decision 2: `.gitignore` contents
Ignore exactly: `.env`, `node_modules/`, `dist/`, `.last-run.json`, `.DS_Store`, `*.log`, and `scheduler.log` (named in the README). Commit `.env.example` (it has no real secrets, only placeholder keys).

**Why:** `.env` holds `MOONSHOT_API_KEY` and potentially `EMAIL_PASS` — these must never be committed. `node_modules/` is regenerable from `package-lock.json` and is large. `dist/` is the `tsc` build output. `.last-run.json` is runtime state. `.DS_Store` is macOS noise. Alternative considered: use GitHub's standard Node `.gitignore` template — rejected as too broad (it ignores things like `coverage/`, `.npm/` that aren't relevant here); a focused list is clearer for a small project.

### Decision 3: First commit includes `openspec/` and `.opencode/`
Both the `openspec/` change proposals (including this one and the other four) and the `.opencode/` skills/config are part of the project's working agreement and should be in version control alongside the source.

**Why:** The OpenSpec artifacts ARE the roadmap; losing them would lose the planning work. `.opencode/` contains the skill definitions the user has set up. Alternative considered: ignore `.opencode/` as "tooling config" — rejected because it's project-specific (the skills reference this repo's OpenSpec setup) and small.

### Decision 4: Add `AGENTS.md` with verification commands
Create `AGENTS.md` at the repo root listing: `npm run build` (tsc typecheck), `npm start` (one-shot run), `npm run smoke` (after change #1 lands), `npm run scheduler`, `npm run run-once` (after change #2 lands). This is the file future AI sessions (including this one) check first to know how to verify work.

**Why:** The system prompt for this very environment says "if unable to find the correct lint/typecheck command, ask the user and suggest writing it to AGENTS.md." Writing it now preempts that for every future session. Alternative considered: put commands in README only — rejected because README is user-facing documentation and AGENTS.md is the convention for AI-facing instructions.

### Decision 5: Remote push is opt-in, deferred to a separate task
The first commit is local-only. A `git remote add origin …` + `git push` task is included but gated on the user providing a remote URL.

**Why:** The user hasn't asked for a remote, and creating a GitHub repo programmatically would be overstepping. The local repo solves the immediate "no safety net" problem. Pushing can happen later with one command.

## Risks / Trade-offs

- **[Risk] User accidentally runs `git init` in the wrong directory** → Mitigation: the install task explicitly `cd`s into `/Users/tonyk/Desktop/usdollar` and verifies `pwd` before `git init`; it aborts if `git rev-parse --show-toplevel` already resolves to the project dir.
- **[Risk] `.env` accidentally staged** → Mitigation: create `.gitignore` BEFORE `git add` anything; the task order enforces this. Add a pre-commit check task that runs `git ls-files | grep -E '\.env$'` and fails if anything matches.
- **[Risk] Home-dir repo and new project repo confuse each other** → Mitigation: the new repo is self-contained at `usdollar/.git`; running git commands inside `usdollar/` always resolves to the project repo, not the home repo.
- **[Trade-off] No remote means no off-machine backup** → Accepted for now; the remote task is included and opt-in.
