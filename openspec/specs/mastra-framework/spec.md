## ADDED Requirements

### Requirement: Mastra packages on v1
The project SHALL depend on `@mastra/core` at a v1.x version (>=1.0.0). The `@mastra/mcp` dependency SHALL be absent from `package.json` (it was declared but never imported). The `package.json` `engines.node` field SHALL declare `>=22.13.0` to document Mastra v1's Node requirement.

#### Scenario: package.json reflects v1 dependencies
- **WHEN** the `dependencies` section of `package.json` is inspected after this change
- **THEN** `@mastra/core` is pinned to a `^1.x` range, `@mastra/mcp` is not present, and no other `@mastra/*` package is required for the agent to run

#### Scenario: Node engine constraint is declared
- **WHEN** the `engines` field of `package.json` is inspected
- **THEN** it declares `"node": ">=22.13.0"`, matching Mastra v1's minimum Node version

### Requirement: Agent constructed with v1 API
The `Agent` instance in `src/agent.ts` SHALL be constructed with an explicit `id` field (v1 makes `id` mandatory). The `model` field SHALL use the model-router string form `"moonshotai/kimi-k2.6"` rather than the 0.x object form `{ providerId, modelId, apiKey }`. The `name`, `instructions`, and `tools` fields SHALL be unchanged from the pre-upgrade configuration.

#### Scenario: Agent config uses v1 shapes
- **WHEN** the `new Agent({...})` call in `src/agent.ts` is inspected
- **THEN** it includes `id: "usd-news-agent"`, `model: "moonshotai/kimi-k2.6"`, the existing `name`, `instructions`, and `tools` keys, and no `providerId`/`modelId` object-form model config

#### Scenario: Model router resolves the provider without an installed provider package
- **WHEN** the agent runs (`npm start`)
- **THEN** the `moonshotai/kimi-k2.6` model string is resolved by Mastra's model router using the `MOONSHOT_API_KEY` environment variable, with no `@ai-sdk/*` provider package installed as a direct dependency

### Requirement: Tool executors use v1 (inputData, context) signature
Both `createTool` definitions (`scrapeWebPage`, `searchUSDNews`) in `src/agent.ts` SHALL use the v1 executor signature `execute: async (inputData, context)`, reading validated inputs from `inputData` (typed from `inputSchema`). The 0.x signature `execute: async ({ context })` SHALL NOT appear. The `id`, `description`, `inputSchema`, and `outputSchema` fields SHALL be unchanged.

#### Scenario: scrapeWebPage reads url from inputData
- **WHEN** the `scrapeWebPage` tool's `execute` function is inspected
- **THEN** its signature is `async (inputData, context)` and it reads `inputData.url` (not `context.url`)

#### Scenario: searchUSDNews reads source and limit from inputData
- **WHEN** the `searchUSDNews` tool's `execute` function is inspected
- **THEN** its signature is `async (inputData, context)` and it reads `inputData.source` and `inputData.limit` (not `context.source` / `context.limit`)

### Requirement: Agent retrieved by intrinsic id
`src/report.ts` SHALL retrieve the agent via `mastra.getAgentById("usd-news-agent")` (the intrinsic `id`), not via the registry key `mastra.getAgent("usdNewsAgent")`. The `agent.generate(prompt, { modelSettings, providerOptions })` call and `result.text` usage SHALL be unchanged.

#### Scenario: report retrieves agent by id
- **WHEN** the agent retrieval line in `src/report.ts` is inspected
- **THEN** it calls `mastra.getAgentById("usd-news-agent")` and the subsequent `generate` call and `result.text` access are unchanged from the pre-upgrade code

### Requirement: Direct tool execution uses RequestContext and v1 execute shape
`src/smoke-test.ts` SHALL import `RequestContext` from `@mastra/core/request-context` (not `RuntimeContext` from `@mastra/core/runtime-context`). The direct `searchUSDNews.execute()` call SHALL use the v1 shape `execute(inputData, { requestContext })` where `inputData` is the tool's input object and `requestContext` is a `new RequestContext()`. The smoke test SHALL narrow the result for `ValidationError` before accessing `outputSchema`-typed fields, because v1 validates `outputSchema` at runtime on direct execute calls.

#### Scenario: smoke test imports RequestContext
- **WHEN** the imports in `src/smoke-test.ts` are inspected
- **THEN** `RequestContext` is imported from `@mastra/core/request-context` and no `RuntimeContext` import remains

#### Scenario: smoke test calls execute with v1 shape and narrows ValidationError
- **WHEN** the `searchUSDNews.execute()` call in `src/smoke-test.ts` is inspected
- **THEN** it passes the input object as the first argument and `{ requestContext: new RequestContext() }` as the second, and the code checks `if ('error' in result && result.error)` before reading `.articles` or `.health`

### Requirement: Clean startup without telemetry workaround
The entry points (`src/index.ts`, `src/scheduler.ts`, `src/run-once.ts`) SHALL NOT set the `globalThis.___MASTRA_TELEMETRY___` global. The `Mastra` instance in `src/mastra.ts` SHALL NOT configure an `observability:` key (omitting it means no telemetry is emitted, which is the intended behavior). The services SHALL start cleanly with no Mastra telemetry warnings.

#### Scenario: no telemetry global in entry points
- **WHEN** `src/index.ts`, `src/scheduler.ts`, and `src/run-once.ts` are inspected
- **THEN** none of them contain `___MASTRA_TELEMETRY___` or set `globalThis.___MASTRA_TELEMETRY___`

#### Scenario: no observability config in mastra instance
- **WHEN** the `new Mastra({...})` call in `src/mastra.ts` is inspected
- **THEN** the config object contains only the `agents` key and no `observability`, `telemetry`, or `tracing` key

### Requirement: Upgrade is reversible
Reverting this change SHALL restore the pre-upgrade Mastra 0.24.x behavior with no data migrations, schema changes, or persisted-state transformations. The only persistence in the project (`.last-run.json` via plain `fs` in `src/scheduler-utils.ts`) is unrelated to Mastra and SHALL be unaffected by the upgrade or rollback.

#### Scenario: rollback restores 0.24.x behavior
- **WHEN** a developer reverts the commit that implements this change and runs `npm install`
- **THEN** `@mastra/core@0.24.9` and `@mastra/mcp@0.14.5` reinstall, the agent runs as before on the 0.x APIs, and no data migration or `.last-run.json` transformation is required
