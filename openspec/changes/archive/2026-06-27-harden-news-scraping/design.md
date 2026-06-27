## Context

Today, `searchUSDNews` (in `src/agent.ts`) holds a `sources` map of 6 name→URL entries and runs one shared selector pass against every site:

```
$("article, .article, .story, .news-item, [data-testid='article-card'], .headline")
  → find("h2, h3, .title, a").first()
  → find("a").first().attr("href")
```

If that pass yields nothing, a fallback pass walks `h2, h3` and grabs the closest anchor. Both passes are site-agnostic. There is no record of which pass matched, no per-source success flag surfaced to the caller, and no way to know a site broke without reading the report and noticing missing coverage. The tool's `outputSchema` returns only `articles[]` — no health metadata escapes the tool boundary.

`scrapeWebPage` (the per-article deep scraper) is a separate concern and is NOT in scope here; it operates on URLs the agent has already chosen.

## Goals / Non-Goals

**Goals:**
- Make scraping failures visible instead of silent.
- Localize per-site selector knowledge so fixing one source doesn't require reasoning about five others.
- Surface source-health information in the final delivered report.
- Keep the change small and dependency-free (no new npm packages).

**Non-Goals:**
- Defeating anti-bot protections (paywalls, Cloudflare, JS-rendered SPA content). Out of scope; sites that block scraping will continue to be marked as failed sources.
- Replacing `cheerio` with a headless browser. Too heavy for this project.
- Changing `scrapeWebPage`'s contract.
- Auto-healing selectors via LLM inspection of page HTML. Interesting but out of scope for this change.

## Decisions

### Decision 1: Source adapter map over a polymorphic class hierarchy
Each source is described by a plain data object + a function, keyed by source name in a `Record<string, SourceAdapter>`. An adapter exposes: `name`, `url`, and an ordered array of `selectorStrategy` functions each returning `Article[]`.

**Why over alternatives:** A class hierarchy (abstract `Source` with subclasses) is heavier than this project needs and adds indirection. A plain map keeps everything in one file, trivially serializable, and a one-line edit to add a strategy. Alternatives considered: (a) one config JSON of selectors only — rejected because some sites need post-processing logic beyond "pick these selectors"; (b) external plugin files per source — rejected as over-modularization for 6 sources.

### Decision 2: Health metadata travels in the tool's outputSchema
Extend `outputSchema` from `{ articles: Article[] }` to `{ articles: Article[], health: SourceHealth[] }` where `SourceHealth = { source: string, status: "ok" | "empty" | "error", articleCount: number, strategiesTried: number, matchedStrategy?: string, error?: string }`.

**Why:** The agent (LLM) consumes tool output and writes the report. If health data stays inside the tool, the agent never sees it and can't mention degraded sources. Putting it in the schema makes it part of the conversation the model can act on. Alternative considered: logging health to stderr only — rejected because it wouldn't reach the emailed report.

### Decision 3: Degraded-mode reporting via agent instructions, not post-processing
Rather than string-scanning the agent's prose to inject a "Source health" section programmatically, update the agent's `instructions` in `agent.ts` to require: "If the tool reports any source with status `empty` or `error`, your report MUST begin with a '## Source Health Warning' section listing each degraded source and its status."

**Why:** The agent already writes the report; having it format health info uses the existing pipeline and natural language. Post-processing the model's text to splice in a section is fragile and fights the agent's voice. Alternative considered: deterministic post-processing — rejected for fragility; reconsider only if the model proves unreliable at including the section.

### Decision 4: Strategies tried in order, first match wins, but ALL strategies run for health accounting
For a given source, run every strategy in the adapter's ordered list, collect articles from the first one that yields any, but record how many strategies were tried and which one matched (for the health record). Stop early on first match for efficiency; record `strategiesTried` as the count up to and including the match.

**Why:** Balances performance (stop on match) with observability (know which strategy saved us). Alternative considered: run all strategies and merge — rejected because it risks duplicate articles across strategies and complicates dedup.

## Risks / Trade-offs

- **[Risk] The agent ignores the "Source Health Warning" instruction** → Mitigation: after implementation, run a report with a deliberately-broken source (point one adapter at a bad URL) and verify the warning appears. If unreliable, fall back to deterministic post-processing of tool `health` data before passing to email.
- **[Risk] Selector strategies rot over time too** → Mitigation: the smoke-test script (optional task) makes rot detectable without waiting for a scheduled run. Health metadata makes rot visible in every report.
- **[Risk] Extending `outputSchema` breaks existing callers** → Mitigation: `articles` field is unchanged; `health` is additive. `report.ts` reads `result.text` (the agent's prose), not the raw tool output, so it's unaffected.
- **[Trade-off] More code in `agent.ts`** → Accepted. Localized complexity is better than invisible fragility.
