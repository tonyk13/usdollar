### Requirement: Per-source health tracking
The `searchUSDNews` tool SHALL return, alongside the articles list, a `health` array containing one entry per source attempted. Each entry MUST include the source name, a status of `ok`, `empty`, `error`, or `skipped`, the number of articles returned, the number of selector strategies tried, the name of the strategy that matched (if any), and an error message when the source failed with an exception or was skipped.

#### Scenario: Healthy source returns articles
- **WHEN** a source's selector strategy matches one or more articles
- **THEN** its health entry has `status: "ok"`, `articleCount` greater than 0, and `matchedStrategy` set to the strategy name that produced the articles

#### Scenario: Source returns zero articles
- **WHEN** every selector strategy for a source yields zero articles
- **THEN** its health entry has `status: "empty"`, `articleCount: 0`, `strategiesTried` equal to the total number of strategies configured for that source, and `matchedStrategy` unset

#### Scenario: Source throws an error
- **WHEN** fetching or parsing a source raises an exception
- **THEN** its health entry has `status: "error"`, `articleCount: 0`, and an `error` field containing the error message

#### Scenario: Source is intentionally skipped
- **WHEN** a source adapter is configured with `skipped: true` (e.g. paywalled sources that block non-subscriber scraping)
- **THEN** its health entry has `status: "skipped"`, `articleCount: 0`, `strategiesTried: 0`, and an `error` field containing the skip reason

### Requirement: Fallback selector strategies per source
Each active (non-skipped) news source SHALL be described by a source adapter containing an ordered list of selector strategies. The tool MUST try strategies in order and use the first one that yields articles, stopping early once a match is found. Active sources MUST have at least one strategy; having two or more is recommended so that a single selector shift does not silently zero out a source.

#### Scenario: Primary strategy fails, fallback succeeds
- **WHEN** the first strategy for a source returns zero articles and a subsequent strategy returns one or more
- **THEN** the tool uses the articles from the subsequent strategy and records its name as `matchedStrategy` in the health entry

#### Scenario: All strategies fail
- **WHEN** every configured strategy for a source returns zero articles
- **THEN** the source contributes zero articles and its health entry has `status: "empty"`

### Requirement: Source adapter structure
Source-specific scraping logic SHALL be organized as a `Record<string, SourceAdapter>` keyed by source name, where each adapter declares the source's URL, its ordered selector strategies, and an optional `skipped` flag with `skipReason`. The tool's `execute` function MUST iterate this map rather than containing inline, site-agnostic selector logic. Adding or fixing a source MUST touch only its adapter entry.

#### Scenario: Adding a new source
- **WHEN** a developer adds a new entry to the source adapter map with a URL and at least one strategy
- **THEN** the new source is scraped by the tool when `source: "all"` is requested, without any other code changes

#### Scenario: Fixing a broken source
- **WHEN** a site changes its markup and a developer updates that source's strategies in its adapter entry
- **THEN** no other source's behavior is affected

#### Scenario: Skipping a paywalled source
- **WHEN** a developer sets `skipped: true` with a `skipReason` on a source's adapter entry
- **THEN** the tool does not attempt any strategies for that source and reports it as `skipped` in the health metadata

### Requirement: Degraded-mode reporting
When one or more sources have a health status other than `ok`, the generated report MUST include a visible "Source Health" section naming each degraded source and its status, so the recipient knows the report is incomplete. When all sources are `ok`, no such section is required.

#### Scenario: Some sources degraded or skipped
- **WHEN** the tool's `health` array contains any entry with status `empty`, `error`, or `skipped`
- **THEN** the agent's report text includes a section listing each degraded source by name with its status and, for `error` or `skipped` status, a short explanation

#### Scenario: All sources healthy
- **WHEN** every entry in the `health` array has status `ok`
- **THEN** the report omits any source-health warning section

### Requirement: Scraping smoke test
The project SHALL include a script that invokes the `searchUSDNews` tool with `source: "all"` and prints the `health` array without invoking the LLM or sending email. This enables verifying scraping health independently of report generation.

#### Scenario: Running the smoke test
- **WHEN** a developer runs the smoke-test script (`npm run smoke`)
- **THEN** it prints, per source, the name, status, article count, matched strategy, and any error — without making any LLM API call or sending email
