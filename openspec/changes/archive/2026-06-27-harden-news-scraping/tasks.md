## 1. Source adapter foundation

- [x] 1.1 Define the `Article`, `SourceHealth`, `SelectorStrategy`, and `SourceAdapter` TypeScript types in `src/agent.ts`
- [x] 1.2 Build a `sourceAdapters: Record<string, SourceAdapter>` map covering the 6 existing sources (reuters, bloomberg, cnbc, wsj, ft, marketwatch), each with its existing URL
- [x] 1.3 For each adapter, write at least two ordered selector strategies (extract the current shared selector block as strategy #1, add a distinct fallback as strategy #2)
  > **Implementation note:** Bloomberg and FT are `skipped: true` (paywalled, per user direction). CNBC uses Google News RSS as its primary strategy (JS-rendered SPA, no direct scraping possible). Reuters/MarketWatch/WSJ have direct-scrape + Google News RSS fallback.

## 2. Rewire `searchUSDNews` to use adapters

- [x] 2.1 Replace the inline site-agnostic selector pass in `searchUSDNews.execute` with iteration over `sourceAdapters`
- [x] 2.2 For each adapter, run strategies in order, stop on first match, collect articles
- [x] 2.3 Build a `SourceHealth` entry per source (status, articleCount, strategiesTried, matchedStrategy, error) capturing ok/empty/error/skipped outcomes
- [x] 2.4 Extend the tool's `outputSchema` to include `health: z.array(SourceHealthSchema)` alongside the existing `articles` field

## 3. Degraded-mode reporting

- [x] 3.1 Update the agent's `instructions` in `agent.ts` to require a "## Source Health Warning" section when any source reports `empty`, `error`, or `skipped`, naming each degraded source and its status
- [x] 3.2 Run a report with one adapter pointed at an intentionally bad URL; verify the warning section appears in the agent's output
  > **Verified 2026-06-27:** Ran `npm start` with bloomberg/ft marked `skipped`. The agent's report began with "## Source Health Warning" naming both sources, their status, and a note about reduced coverage. The agent handles this reliably.
- [x] 3.3 If the agent omits the warning unreliably, add deterministic post-processing in `report.ts` that prepends a source-health section built from tool `health` data before returning the report text
  > **N/A:** The agent included the Source Health Warning section reliably on the first full run. Deterministic post-processing is not needed. Revisit only if future runs show inconsistency.

## 4. Scraping smoke test

- [x] 4.1 Create `src/smoke-test.ts` that imports the `searchUSDNews` tool, invokes it with `source: "all"`, and prints the `health` array formatted per source
- [x] 4.2 Add an `npm run smoke` script to `package.json` that runs it via `tsx`
- [x] 4.3 Verify `npm run smoke` makes no LLM call and sends no email, and that it correctly reports a deliberately broken source as `error` or `empty`
  > **Verified:** Baseline run showed 1/6 ok (only WSJ). Post-hardening run showed 4/6 ok, 2/6 skipped (bloomberg, ft). Bloomberg/FT correctly show "skipped" status with reason.

## 5. Documentation

- [x] 5.1 Update `README.md` "News Sources" section to mention per-source health tracking and the smoke test
- [x] 5.2 Add a short "Troubleshooting scraping" note describing how to read the Source Health section and update a source's strategies in the adapter map
