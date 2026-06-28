## Why

The project pins `@mastra/core@^0.24.9` (installed 0.24.9) and `@mastra/mcp@^0.14.5` (installed 0.14.5), both pre-1.0. Mastra shipped 1.0 in January 2026 and is now at 1.47.0, with breaking changes (mandatory agent `id`, `createTool` executor signature, `RuntimeContext`→`RequestContext`, restructured imports, removed telemetry global). Caret ranges don't cross the 0.x→1.x boundary, so the project is frozen on a stale major version and can't receive fixes. This change upgrades to v1 and removes the now-unused `@mastra/mcp` dependency.

## What Changes

- **BREAKING**: Bump `@mastra/core` from `^0.24.9` to `^1.47.0` (peer of all other Mastra packages).
- Remove `@mastra/mcp` from dependencies — it is declared but never imported anywhere in `src/`.
- Add mandatory `id: "usd-news-agent"` to the `Agent` constructor (v1 makes `id` required; previously defaulted from `name`).
- **BREAKING**: Change the Agent `model` config from object form `{ providerId, modelId, apiKey }` to the v1 model-router string form `"moonshotai/kimi-k2.6"`. The old object shape is no longer accepted; v1's model router still resolves `moonshotai` and auto-reads `MOONSHOT_API_KEY` from env (verified at mastra.ai/models/providers/moonshotai).
- **BREAKING**: Rewrite both `createTool` executors (`scrapeWebPage`, `searchUSDNews`) to the v1 `(inputData, context)` signature. The 0.x signature `execute: async ({ context })` is replaced by `execute: async (inputData, context)`, reading inputs from `inputData` instead of `context`.
- Retrieve the agent via `mastra.getAgentById("usd-news-agent")` (v1-idiomatic) instead of `mastra.getAgent("usdNewsAgent")` (registry key).
- **BREAKING**: In `src/smoke-test.ts`, rename `RuntimeContext`→`RequestContext` (import from `@mastra/core/request-context`) and update the direct `tool.execute()` call to the v1 shape `(inputData, { requestContext })`. Add `ValidationError` narrowing before reading tool output, since v1 validates `outputSchema` at runtime.
- Remove the `globalThis.___MASTRA_TELEMETRY___ = true` hack from `src/index.ts`, `src/scheduler.ts`, and `src/run-once.ts`. In v1, omitting `observability:` config means no telemetry is emitted and the service starts cleanly; the internal global is obsolete.
- Add `"engines": { "node": ">=22.13.0" }` to `package.json` to document v1's Node requirement (current runtime is Node 24, so this is documentation only).
- No changes to `src/mastra.ts` (`new Mastra({ agents })` shape is unchanged), agent instructions, tool schemas, `agent.generate()` options, `result.text` usage, or email/scheduler logic.

## Capabilities

### New Capabilities
- `mastra-framework`: The contract for how the project integrates with the Mastra framework — package versions, agent construction (id + model-router string), tool executor signature, request-context usage, agent retrieval, and clean startup without telemetry workarounds. Covers `src/mastra.ts`, `src/agent.ts`, `src/report.ts`, `src/smoke-test.ts`, and the entry points' Mastra-related globals.

### Modified Capabilities
<!-- None. openspec/specs/ is empty — this is the first spec. -->

## Impact

- **Affected code**: `package.json` (deps + engines), `src/agent.ts` (Agent constructor + both `createTool` executors), `src/report.ts` (agent retrieval), `src/smoke-test.ts` (RequestContext + direct execute), `src/index.ts`/`src/scheduler.ts`/`src/run-once.ts` (remove telemetry global blocks).
- **Dependencies**: `@mastra/core` 0.24.9→1.47.0; `@mastra/mcp` removed. No new dependencies (model router handles provider resolution; no `@ai-sdk/*` package needed).
- **APIs**: No external API changes. The agent's behavior, output, and email delivery are unchanged.
- **Verification**: `npm run build` (tsc) catches most shape errors; `npm run smoke` exercises the tools + RequestContext directly with no LLM cost (primary signal); `npm start` confirms the model router + `agent.generate` end-to-end (small Moonshot API cost).
- **Risk**: The `providerOptions: { moonshotai: { thinking: { type: "disabled" } } }` keying is undocumented in v1 examples but low-risk; `npm start` confirms at runtime. The parked `revisit-thinking-mode` change remains compatible (string form `"zai/glm-5.2"` works the same way).
- **Reversibility**: Fully reversible by reverting `package.json` and the ~6 edit sites; no data or schema migrations (no storage/memory in use).
