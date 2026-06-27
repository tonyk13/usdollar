## Context

Two facts from the explore session ground this design:

1. **Mastra already knows the way to GLM.** `@mastra/core` ships a built-in provider registry (that's how `providerId: "moonshotai"` resolves today without any installed moonshot package). The registry has entries for `zai` (`https://api.z.ai/api/paas/v4`, env `ZHIPU_API_KEY`) and `zhipuai` (`https://open.bigmodel.cn/api/paas/v4`, env `ZHIPU_API_KEY`). The registry's model list tops out at `glm-4.6` (stale snapshot), but the API accepts `glm-5.2` as a model id regardless.

2. **GLM-5.2 is real and fresh.** Zhipu/Z.ai released it June 13, 2026: MoE (~744B total / ~40B active), 1M context, 128K output, MIT license, two thinking-effort levels (High, Max). Its docs use the same `thinking: { type: "enabled" }` request shape as Moonshot. It launched via the GLM Coding Plan first, with the public API rolling out the following week.

The current Kimi config (`agent.ts:235-239`, `report.ts:8-18`):

```
model: { providerId: "moonshotai", modelId: "kimi-k2.6", apiKey: MOONSHOT_API_KEY }
providerOptions: { moonshotai: { thinking: { type: "disabled" } } }
modelSettings: { temperature: 0.6 }
```

The bug: with thinking enabled on Kimi, the Moonshot API expects `reasoning_content` on every assistant message including tool-call messages; ai-sdk drops it; tool calls fail. The workaround disables thinking, which makes tools work but sacrifices reasoning.

## Goals / Non-Goals

**Goals (when unparked):**
- Enable thinking mode on whichever model the agent uses, while keeping tool calls working.
- Make the swap (if Option A) a small, reversible change with no new dependencies.
- Verify the fix end-to-end: a real report run with thinking ON and tools succeeding.

**Non-Goals:**
- Upgrading ai-sdk or Mastra versions as part of this change (unless Option B forces it).
- Multi-model routing or fallback (e.g. "try GLM, fall back to Kimi"). Out of scope.
- Benchmarking Kimi-vs-GLM report quality. Subjective; the bar is "tools work + thinking on".
- Changing the agent's instructions or tools. This change is about the model layer only.

## Decisions

### Decision (PARKED): Recommended path is Option A (GLM-5.2 swap), attempted before Option B
If unparked, first try swapping the model config to GLM-5.2 via the `zai` provider with thinking ENABLED, and run a real report. If tools work under GLM-5.2's thinking mode (the bug may be Moonshot-specific rather than ai-sdk-generic), the change is ~3 lines and we're done. If GLM-5.2 hits the same bug, fall back to Option B (patch `reasoning_content` preservation).

**Why over alternatives:** Option A is tiny and reversible; Option B is invasive and may require forking ai-sdk. Trying the cheap thing first is the right order. Alternative considered: go straight to Option B to stay on Kimi — rejected because the user already has a Moonshot key working and GLM-5.2's 1M context and fresher training are side-benefits; if Option A works, there's no reason to do Option B at all.

### Decision: Safe first-run config mirrors current settings, then enable thinking
On the first run after a swap, keep `temperature: 0.6` and `thinking: { type: "disabled" }` (just under the `zai` key) to confirm the swap itself works — API accepts the model id, auth works, tools work. THEN flip `thinking` to `{ type: "enabled" }` (GLM-5.2 "High" effort) on a second run and check whether tools still work.

**Why:** Isolates variables. If the first run fails, it's the swap (auth, model id, baseURL); if the second run fails, it's the thinking+tools bug. Alternative considered: flip both at once — rejected because a failure would be ambiguous.

### Decision: If GLM-5.2 thinking+tools works, delete the "Why Thinking is Disabled" README section
The README currently documents the Kimi bug as a known limitation. If we move to GLM-5.2 and thinking works, that section is obsolete and should be replaced with a note about the active model and thinking mode.

**Why:** Stale documentation of a workaround you no longer have is worse than no documentation. Alternative considered: keep it as historical note — rejected as clutter.

### Decision: If neither option works, leave parked and document the spike result
If Option A's thinking+tools fails AND Option B is deemed too invasive, update this proposal with the spike findings and leave the change parked. The thinking-disabled workaround stays.

**Why:** Forced migration to a worse state isn't the goal. The workaround is acceptable; this change is an optimization, not a fix for a broken system.

## Risks / Trade-offs

- **[Risk] GLM-5.2 has the same ai-sdk tool-call bug as Kimi** → Mitigation: the two-run protocol (disabled first, enabled second) detects this cheaply. Fallback is Option B or staying parked.
- **[Risk] GLM-5.2 API access requires a separate key/plan the user doesn't have** → Mitigation: confirmed during explore that pay-per-token `ZHIPU_API_KEY` from `chat.z.ai` works with the `zai` provider. The user needs to obtain a key before unparking.
- **[Risk] Report quality changes with a different model** → Mitigation: subjective; run a few reports and compare. The 1M context and fresher training of GLM-5.2 are likely net-positive for news analysis.
- **[Trade-off] Two API keys to manage if we keep Kimi as fallback** → Accepted if we go Option A; rejected otherwise (single model is simpler).
- **[Trade-off] GLM-5.2 is very new (released days before this proposal)** → Accepted; the model id is stable and the API is the mature Zhipu v4 endpoint. If stability matters, wait a few weeks before unparking.

## Open Questions

- Does GLM-5.2's `thinking: { type: "enabled" }` mode work with ai-sdk tool calls, or does it hit the same `reasoning_content` preservation bug as Kimi? (Resolve via the two-run spike when unparked.)
- Should we use `zai` (api.z.ai) or `zhipuai` (open.bigmodel.cn) as the provider? Both use `ZHIPU_API_KEY`. The `zai` endpoint is the international one and is recommended in Z.ai's docs; `zhipuai` is the domestic Chinese endpoint. Default to `zai` unless the user's account is on the domestic platform.
- Is GLM-5.2 available on the user's Zhipu account/plan? (User must confirm before unparking.)
