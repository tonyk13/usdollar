## Why

The `usdollar/` project directory currently lives untracked inside a git repository whose root is the user's entire home directory (`/Users/tonyk`). `git status` from inside the project shows hundreds of unrelated home-directory entries, none of the project's source is committed anywhere, and there is no isolation between this project and the rest of the user's files. The OpenSpec changes being planned (scraping hardening, scheduler migration, email verification) will modify source that has no version-control safety net.

## What Changes

- Initialize `/Users/tonyk/Desktop/usdollar` as its own git repository (separate from the home-directory repo).
- Add a `.gitignore` covering `.env`, `node_modules/`, `.last-run.json`, `.DS_Store`, and `dist/`.
- Make the first commit of the existing source tree (`src/`, `package.json`, `package-lock.json`, `tsconfig.json`, `README.md`, `.env.example`, `openspec/`).
- Optionally push to a new dedicated remote (e.g. `github.com/tonyk13/usdollar`), if the user chooses.
- Add an `AGENTS.md` capturing the project's lint/typecheck/run commands so future AI sessions know how to verify work.

## Capabilities

### New Capabilities
<!-- None. This is a repository-hygiene/infra change, not a system-behavior change. -->

### Modified Capabilities
<!-- None. -->

## Impact

- **Affected code**: none. No source files change.
- **Affected files**: new `.gitignore`, new `AGENTS.md`, new `.git/` inside `usdollar/`.
- **Dependencies**: none.
- **Risk**: low. The home-directory repo is unaffected (it never tracked `usdollar/` anyway). The new repo is additive.
- **Pre-condition**: the `usdollar/` directory must be removed from any tracking in the home-dir repo (it isn't tracked there today, so this is a no-op), and `git init` must run inside `usdollar/` so the new repo's `.git` is local to the project.
