## 1. Dependencies

- [x] 1.1 In `package.json`, change `@mastra/core` from `^0.24.9` to `^1.47.0`
- [x] 1.2 In `package.json`, remove the `@mastra/mcp` line from `dependencies`
- [x] 1.3 In `package.json`, add `"engines": { "node": ">=22.13.0" }`
- [x] 1.4 Run `npm install` and confirm `@mastra/core@1.x` installs with no peer errors

## 2. Agent + tools (`src/agent.ts`)

- [x] 2.1 In the `new Agent({...})` call, add `id: "usd-news-agent"` as the first field
- [x] 2.2 Replace the `model: { providerId: "moonshotai", modelId: "kimi-k2.6", apiKey: process.env.MOONSHOT_API_KEY }` object with `model: "moonshotai/kimi-k2.6"` (string router form)
- [x] 2.3 In `scrapeWebPage`, change `execute: async ({ context }: { context: { url: string } })` to `execute: async (inputData: { url: string })` and read `url` from `inputData`
- [x] 2.4 In `searchUSDNews`, change `execute: async ({ context }: { context: { source: string; limit: number } })` to `execute: async (inputData: { source: string; limit: number })` and read `source`/`limit` from `inputData`

## 3. Report retrieval (`src/report.ts`)

- [x] 3.1 Change `mastra.getAgent("usdNewsAgent")` to `mastra.getAgentById("usd-news-agent")`. Leave the `generate()` call and `result.text` unchanged.

## 4. Smoke test (`src/smoke-test.ts`)

- [x] 4.1 Replace `import { RuntimeContext } from "@mastra/core/runtime-context"` with `import { RequestContext } from "@mastra/core/request-context"`
- [x] 4.2 Rewrite the `searchUSDNews.execute()` call to v1 shape: first arg is the input object `{ source: "all", limit: 5 }`, second arg is `{ requestContext: new RequestContext() }`
- [x] 4.3 Add `ValidationError` narrowing before reading `.articles`/`.health`: `if ('error' in result && result.error) { console.error(result.message); process.exit(1); }`

## 5. Entry points — remove telemetry hack

- [x] 5.1 In `src/index.ts`, delete the `declare global {...}` + `globalThis.___MASTRA_TELEMETRY___ = true` block
- [x] 5.2 In `src/scheduler.ts`, delete the same block
- [x] 5.3 In `src/run-once.ts`, delete the same block

## 6. Verify

- [x] 6.1 Run `npm run build` (tsc) and confirm no type errors
- [x] 6.2 Run `npm run smoke` and confirm both tools execute + health table prints (no LLM cost)
- [x] 6.3 Run `npm start` and confirm a full report generates end-to-end (model router + agent.generate + email if configured)
