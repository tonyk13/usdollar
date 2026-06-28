## Context

This project uses a tiny slice of Mastra — 4 import lines across 3 files (`src/mastra.ts`, `src/agent.ts`, `src/smoke-test.ts`), no memory/storage/workflows/MCP/streaming. It is pinned to `@mastra/core@0.24.9` and `@mastra/mcp@0.14.5` (both pre-1.0). Mastra 1.0 shipped January 2026 with breaking changes; the current latest is 1.47.0. Caret ranges (`^0.24.9`) don't cross the 0.x→1.x boundary, so the project is frozen on a stale major.

Research findings that ground this design (verified against mastra.ai docs, migration guides, and the v1 API reference):

1. **Model router still bundles `moonshotai`.** v1's model router resolves `moonshotai/kimi-k2.6` and auto-reads `MOONSHOT_API_KEY` from env — no `@ai-sdk/*` package install required (confirmed: mastra.ai/models/providers/moonshotai lists `moonshotai/kimi-k2.6` as a supported model with `MOONSHOT_API_KEY` auth). This is the single biggest risk resolved: the project's reliance on Mastra's built-in provider registry survives the upgrade, just with a different config shape.

2. **The v1 object-form `model` config is `{ id, url, apiKey, headers }`** — the 0.x `{ providerId, modelId, apiKey }` shape is gone. The string form `"moonshotai/kimi-k2.6"` is the documented v1 idiom and is cleaner than reconstructing the object form.

3. **`createTool` executor signature changed** from `execute: async ({ context })` to `execute: async (inputData, context)`. Inputs now come from `inputData` (typed from `inputSchema`); `context` is now a namespace object with `context.agent`, `context.workflow`, `context.mcp`, `context.requestContext` sub-properties.

4. **`RuntimeContext` renamed to `RequestContext`** (import from `@mastra/core/request-context`). Only affects `src/smoke-test.ts`, which is the sole user.

5. **`Agent.id` is now required.** The project currently omits it (relies on 0.x defaulting from `name`). Must add `id: "usd-news-agent"`.

6. **Tools with `outputSchema` now validate at runtime** and `tool.execute()` returns a `ValidationError` union. Affects only the smoke test's direct execute call.

7. **The `___MASTRA_TELEMETRY___` global hack is obsolete.** v1 moves telemetry to `@mastra/observability` via an `observability:` config key. Omitting it means no telemetry is emitted and the service starts cleanly — the 0.x internal global that three entry points set is no longer needed.

8. **`@mastra/mcp` is a dead dependency.** Declared in `package.json` but never imported anywhere in `src/`. Confirmed by repo-wide search. Safe to drop.

9. **Node 22.13.0+ required by v1.** Current runtime is Node 24.16.0, so this is a documentation-only constraint (add `engines` to `package.json`).

The current code surfaces (with line numbers from the audit):

- `src/mastra.ts:4` — `new Mastra({ agents: { usdNewsAgent } })` (unchanged in v1)
- `src/agent.ts:417-451` — `new Agent({ name, instructions, model: {providerId, modelId, apiKey}, tools })` (needs `id`, string `model`, executor rewrites)
- `src/agent.ts:235-297` — `scrapeWebPage = createTool({ id, description, inputSchema, outputSchema, execute: async ({context}) })`
- `src/agent.ts:301-413` — `searchUSDNews = createTool({ id, description, inputSchema, outputSchema, execute: async ({context}) })`
- `src/report.ts:4,8-20` — `mastra.getAgent("usdNewsAgent")` + `agent.generate(prompt, { modelSettings, providerOptions })` + `result.text`
- `src/smoke-test.ts:3,11-14` — `RuntimeContext` import + `searchUSDNews.execute({ context, runtimeContext })`
- `src/index.ts:6-9`, `src/scheduler.ts:7-11`, `src/run-once.ts:6-10` — `globalThis.___MASTRA_TELEMETRY___ = true`

## Goals / Non-Goals

**Goals:**
- Upgrade `@mastra/core` to v1 (1.47.0) with all code adapted to v1 APIs.
- Remove the unused `@mastra/mcp` dependency.
- Preserve identical runtime behavior: same agent, same tools, same model (`moonshotai/kimi-k2.6`), same report output, same email delivery.
- Make the upgrade fully reversible with no data migrations.
- Verify via the existing `npm run build` / `npm run smoke` / `npm start` toolchain.

**Non-Goals:**
- Adopting Mastra memory, storage, workflows, MCP, streaming, or observability. The project uses none of these; introducing them is out of scope.
- Running Mastra's automated codemods. The surface is ~6 edit sites; manual edits are cleaner and more controlled than `npx @mastra/codemod@latest v1`, and the codemods won't handle the two real rewrites (model config shape, tool executor signature) anyway.
- Changing the model, agent instructions, tool schemas, or report logic. The `revisit-thinking-mode` parked change remains a separate concern.
- Upgrading `zod`, `cheerio`, `node-cron`, `nodemailer`, or any non-Mastra dependency.
- Adding the `mastra` dev dependency or Mastra Studio/CLI. The project runs via `tsx` directly and has no `mastra dev`/server usage.

## Decisions

### Decision: Use the model-router string form `model: "moonshotai/kimi-k2.6"`

Adopt the v1 string form instead of reconstructing the object form `model: { id: "moonshotai/kimi-k2.6", apiKey: process.env.MOONSHOT_API_KEY }`.

**Why over alternatives:** The string form is the documented v1 idiom (every Mastra docs example uses it), it's shorter, and the router auto-reads `MOONSHOT_API_KEY` from env so the explicit `apiKey` pass-through is redundant. The object form is reserved for advanced cases (custom `url`, `headers`) that this project doesn't need. Alternative considered: object form with explicit key to mirror the 0.x style — rejected as unnecessary verbosity that diverges from the documented pattern.

### Decision: Add `id: "usd-news-agent"` and retrieve via `getAgentById`

v1 makes `Agent.id` mandatory. Use `"usd-news-agent"` (kebab-case, distinct from the display `name: "USD News Scraper"`). Retrieve the agent in `report.ts` via `mastra.getAgentById("usd-news-agent")` rather than `mastra.getAgent("usdNewsAgent")` (the registry key).

**Why over alternatives:** `getAgentById` is the v1-idiomatic, future-proof path the docs emphasize (`getAgent(key)` still works but is the legacy registry-key form). Using a kebab-case `id` distinct from the registry key and display name matches Mastra's own examples. Alternative considered: keep `getAgent("usdNewsAgent")` — rejected because it relies on the registry key rather than the intrinsic id, which v1's tool-registration changes suggest is the less stable form.

### Decision: Manual edits, no codemods

Implement the ~6 edit sites by hand rather than running `npx @mastra/codemod@latest v1`.

**Why over alternatives:** The codemods handle mechanical renames (imports, `RuntimeContext`→`RequestContext`, plural APIs) but the two substantive rewrites — the model config shape change and the `createTool` executor signature change — require judgment the codemods don't provide. With only 4 import lines and 6 edit sites, manual edits are faster to make, easier to review, and avoid codemod side effects on a small surface. Alternative considered: run codemods then hand-fix the remainder — rejected as more steps for no gain on a surface this small.

### Decision: Drop `@mastra/mcp` entirely

Remove `@mastra/mcp` from `package.json` rather than upgrading it to 1.x.

**Why over alternatives:** A repo-wide search confirmed `@mastra/mcp` is never imported by any file in `src/`. It's a dead dependency carried since the project's inception. Dropping it reduces install surface and removes a stale peer-constraint (`@mastra/core >=0.20.1-0 <0.25.0-0`) that would otherwise need bumping. Alternative considered: upgrade to `^1.12.0` for future use — rejected as YAGNI; re-adding is trivial if MCP is ever needed.

### Decision: Remove the `___MASTRA_TELEMETRY___` global hack

Delete the `globalThis.___MASTRA_TELEMETRY___ = true` blocks from all three entry points. Do not add an `observability:` config to replace them.

**Why over alternatives:** The hack referenced a 0.x-internal global to suppress telemetry warnings. In v1, telemetry moved to `@mastra/observability` and is configured via the `observability:` key on the `Mastra` constructor. Omitting `observability:` means no telemetry is emitted and the service starts cleanly with no warnings — which is exactly the behavior the hack was approximating. Adding `@mastra/observability` to formally disable telemetry would be a new dependency for a no-op. Alternative considered: add `observability: new Observability({...disabled...})` — rejected as adding a dependency to do nothing.

### Decision: Add `ValidationError` narrowing only in the smoke test

The smoke test calls `searchUSDNews.execute()` directly, which in v1 returns `ValidationError` if `outputSchema` validation fails. Add an `if ('error' in result && result.error) {...}` guard before reading `.articles`/`.health`. Do not add similar guards to agent-driven tool calls.

**Why over alternatives:** v1 only returns `ValidationError` from direct `tool.execute()` calls; when the agent invokes tools, Mastra handles validation internally and the agent loop sees the error as tool output. The only direct execute call is in `src/smoke-test.ts`. Alternative considered: remove `outputSchema` from the tools to skip validation entirely — rejected because the schemas document the tool contract and the narrowing is a one-time fix.

## Risks / Trade-offs

- **[Risk] `providerOptions: { moonshotai: { thinking: { type: "disabled" } } }` keying differs in v1** → Mitigation: low risk; `providerOptions` is keyed by provider id in both 0.x and v1, and `moonshotai` is the provider id in both. `npm start` confirms at runtime. Fallback: consult the Moonshot provider-options section of v1 docs if the key is rejected.
- **[Risk] `mastra.getAgent("usdNewsAgent")` (registry key) is removed in a future v1.x** → Mitigation: we're switching to `getAgentById("usd-news-agent")` proactively, so this is moot. If `getAgentById` itself changes, `npm run build` (tsc) catches it.
- **[Risk] `tool.execute()` direct-call shape in smoke test is wrong** → Mitigation: `npm run smoke` is the primary verification signal and exercises exactly this path with no LLM cost. Catches any shape error immediately.
- **[Risk] v1 introduces an unexpected breaking change not covered by the migration guide** → Mitigation: the surface is tiny (4 imports, 6 sites) and `npm run build` + `npm run smoke` cover all of it except the live LLM call, which `npm start` covers. No memory/storage/workflows means no DB migration risk.
- **[Trade-off] Staying on `moonshotai/kimi-k2.6` rather than swapping models** → Accepted; the `revisit-thinking-mode` parked change handles model swaps as a separate concern. This change is purely a framework-version upgrade.
- **[Trade-off] No observability/telemetry** → Accepted; the project never had real telemetry (only the suppression hack). Adding observability is a separate future concern.

## Migration Plan

**Deploy:** Single coordinated change — bump `package.json`, edit the 6 code sites, run `npm install`, verify. No staged rollout, no feature flags, no DB migrations. The project is a single-user scheduled agent, not a multi-tenant service.

**Rollback:** Revert the commit. No data format changes, no schema migrations, no persisted state affected (the only persistence is `.last-run.json` via plain `fs`, unrelated to Mastra). The previous 0.24.9 versions reinstall cleanly from the reverted `package.json`.

**Verification order:**
1. `npm run build` — tsc typecheck catches import-path errors, signature mismatches, missing `id`, type errors in the executor rewrites.
2. `npm run smoke` — exercises both `createTool` executors + `RequestContext` via direct `tool.execute()` with no LLM cost. Primary signal that the tool-layer rewrite is correct.
3. `npm start` — full end-to-end: model router resolves `moonshotai/kimi-k2.6`, `agent.generate()` runs with `providerOptions`, `result.text` is returned, email sends if configured. Small Moonshot API cost.

## Open Questions

None. All high-risk surfaces (model router, provider registry, import paths, executor signature, RequestContext, telemetry) were verified against v1 docs during planning. The `providerOptions` keying is the only residual runtime uncertainty and is covered by `npm start`.
