## 1. Pre-flight

- [x] 1.1 Verify the current state: run `git rev-parse --show-toplevel` from `/Users/tonyk/Desktop/usdollar` and confirm it resolves to `/Users/tonyk` (the home-dir repo), documenting the "before" state
- [x] 1.2 Confirm no existing `.git` inside `usdollar/` (`ls -la .git` should fail)

## 2. .gitignore and AGENTS.md

- [x] 2.1 Create `.gitignore` in `/Users/tonyk/Desktop/usdollar` with entries: `.env`, `node_modules/`, `dist/`, `.last-run.json`, `.DS_Store`, `*.log`, `scheduler.log`
- [x] 2.2 Create `AGENTS.md` at the repo root listing: `npm run build` (tsc typecheck), `npm start` (one-shot report), `npm run dev` (watch mode), `npm run scheduler` (persistent scheduler), and note that `npm run smoke` and `npm run run-once` will arrive with other changes
- [x] 2.3 Verify `git check-ignore .env` and `git check-ignore node_modules/` both report the paths as ignored (once `.git` exists — defer this check to after step 3.1)

## 3. Initialize the repository

- [x] 3.1 Run `git init` inside `/Users/tonyk/Desktop/usdollar` (verify `pwd` is the project dir first; abort if `.git` already exists)
- [x] 3.2 Run `git rev-parse --show-toplevel` and confirm it now resolves to `/Users/tonyk/Desktop/usdollar`
- [x] 3.3 `git add` the source files: `src/`, `package.json`, `package-lock.json`, `tsconfig.json`, `README.md`, `.env.example`, `.gitignore`, `AGENTS.md`, `openspec/`, `.opencode/`
- [x] 3.4 Pre-commit secret check: run `git ls-files --cached | grep -E '(^|/)\.env$|^node_modules/'` and confirm it returns nothing (no staged secrets or node_modules)
- [ ] 3.5 Make the first commit with a message like `Initial commit: USD news agent project baseline`

## 4. Verify the commit

- [ ] 4.1 Run `git ls-files | grep -E '\.env$'` and confirm no `.env` file is tracked (only `.env.example` should appear)
- [ ] 4.2 Run `git ls-files | grep -E '^node_modules/'` and confirm nothing matches
- [ ] 4.3 Run `git status` and confirm it shows "nothing to commit, working tree clean"
- [ ] 4.4 Confirm `git log --oneline` shows the single baseline commit

## 5. Optional remote (gated on user input)

- [ ] 5.1 Ask the user whether to push to a remote and, if yes, get the remote URL (e.g. `github.com/tonyk13/usdollar`)
- [ ] 5.2 If yes: `git remote add origin <url>`, `git branch -M main`, `git push -u origin main`
- [ ] 5.3 If no: leave the repo local-only and note in a follow-up that pushing is one command away
