## Why

The agent scrapes six financial news sites with a single shared CSS selector strategy (`agent.ts:156-205`). When any site changes its markup, that source silently returns zero articles and the report degrades with no signal to the user. There is no per-source health tracking, no fallback selectors, and no warning when output is thin. A daily report that quietly becomes garbage is worse than one that fails loudly.

## What Changes

- Per-source parse-success tracking: each scraped source reports whether it returned articles, how many, and which selectors matched.
- Fallback selector strategies per site: each known source gets an ordered list of selector strategies tried in sequence instead of one shared block.
- Degraded-mode reporting: when one or more sources return zero articles, the final report MUST include a visible "Source health" section naming the failed sources rather than silently omitting them.
- Source adapter structure: refactor the inline selector logic in `searchUSDNews` into a per-source adapter map so adding or fixing a source touches one place.
- Optional: a smoke-test script that exercises all sources without invoking the LLM, to verify scraping health independently of report generation.

## Capabilities

### New Capabilities
- `news-sourcing`: Scraping and extraction of USD-related articles from external financial news sources, including per-source health tracking, fallback selector strategies, and degraded-mode reporting.

### Modified Capabilities
<!-- None. No existing specs to modify (openspec/specs/ is empty). -->

## Impact

- **Affected code**: `src/agent.ts` — the `searchUSDNews` tool's execute body is the primary change surface; `scrapeWebPage` is unaffected.
- **Affected output**: `src/report.ts` — the agent's prompt and/or post-processing must surface source-health metadata in the final report text.
- **Dependencies**: none new (continues to use `cheerio`).
- **Risk surface**: selector maintenance becomes an ongoing chore but is now localized and observable.
