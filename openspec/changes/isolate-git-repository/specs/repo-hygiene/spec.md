## ADDED Requirements

### Requirement: Project repository isolation
The `usdollar` project SHALL be version-controlled in a git repository whose root is the project directory itself, independent of any parent-directory git repository. Running `git rev-parse --show-toplevel` from within the project directory MUST resolve to the project directory, not to a parent directory.

#### Scenario: Resolving the repository root
- **WHEN** a developer runs `git rev-parse --show-toplevel` inside `/Users/tonyk/Desktop/usdollar`
- **THEN** the output is `/Users/tonyk/Desktop/usdollar` (or the project's current absolute path), not `/Users/tonyk` or any other parent

### Requirement: Secrets and generated artifacts are not tracked
The project repository SHALL include a `.gitignore` that prevents `.env`, `node_modules/`, `dist/`, `.last-run.json`, `.DS_Store`, and `*.log` from being committed. After the first commit, `git ls-files` MUST NOT list `.env` or any path under `node_modules/`.

#### Scenario: .env is ignored
- **WHEN** a developer runs `git check-ignore .env` in the project directory
- **THEN** the output names `.env`, confirming it is ignored

#### Scenario: node_modules is ignored
- **WHEN** a developer runs `git check-ignore node_modules/` in the project directory
- **THEN** the output names `node_modules/`, confirming it is ignored

#### Scenario: .env.example is tracked
- **WHEN** a developer runs `git ls-files .env.example`
- **THEN** the output is `.env.example`, confirming the placeholder template is committed (it contains no real secrets)

### Requirement: Verification commands are documented for AI sessions
The repository SHALL include an `AGENTS.md` at its root documenting the project's build, typecheck, run, and test commands so that AI sessions can verify work without guessing or asking.

#### Scenario: AI session reads verification commands
- **WHEN** an AI session opens the repository and reads `AGENTS.md`
- **THEN** it finds the commands for typecheck (`npm run build`), one-shot run (`npm start`), and any other scripts defined in `package.json`, each with a one-line description
