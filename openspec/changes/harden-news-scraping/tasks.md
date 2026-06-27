## 1. Source adapter foundation

- [ ] 1.1 Define the `Article`, `SourceHealth`, `SelectorStrategy`, and `SourceAdapter` TypeScript types in `src/agent.ts`
- [ ] 1.2 Build a `sourceAdapters: Record<string, SourceAdapter>` map covering the 6 existing sources (reuters, bloomberg, cnbc, wsj, ft, marketwatch), each with its existing URL
- [ ] 1.3 For each adapter, write at least two ordered selector strategies (extract the current shared selector block as strategy #1, add a distinct fallback as strategy #2)

## 2. Rewire `searchUSDNews` to use adapters

- [ ] 2.1 Replace the inline site-agnostic selector pass in `searchUSDNews.execute` with iteration over `sourceAdapters`
- [ ] 2.2 For each adapter, run strategies in order, stop on first match, collect articles
- [ ] 2.3 Build a `SourceHealth` entry per source (status, articleCount, strategiesTried, matchedStrategy, error) capturing ok/empty/error outcomes
- [ ] 2.4 Extend the tool's `outputSchema` to include `health: z.array(SourceHealthSchema)` alongside the existing `articles` field

## 3. Degraded-mode reporting

- [ ] 3.1 Update the agent's `instructions` in `agent.ts` to require a "## Source Health" section when any source reports `empty` or `error`, naming each degraded source and its status
- [ ] 3.2 Run a report with one adapter pointed at an intentionally bad URL; verify the warning section appears in the agent's output
- [ ] 3.3 If the agent omits the warning unreliably, add deterministic post-processing in `report.ts` that prepends a source-health section built from tool `health` data before returning the report text

## 4. Scraping smoke test

- [ ] 4.1 Create `src/smoke-test.ts` that imports the `searchUSDNews` tool, invokes it with `source: "all"`, and prints the `health` array formatted per source
- [ ] 4.2 Add an `npm run smoke` script to `package.json` that runs it via `tsx`
- [ ] 4.3 Verify `npm run smoke` makes no LLM call and sends no email, and that it correctly reports a deliberately broken source as `error` or `empty`

## 5. Documentation

- [ ] 5.1 Update `README.md` "News Sources" section to mention per-source health tracking and the smoke test
- [ ] 5.2 Add a short "Troubleshooting scraping" note describing how to read the Source Health section and update a source's strategies in the adapter map
