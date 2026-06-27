## Why

Kimi K2.6 is a reasoning model with thinking enabled by default, but the agent disables thinking via `thinking: { type: "disabled" }` (`report.ts:12-16`) because of a Moonshot API + ai-sdk incompatibility: when thinking is enabled, tool calls fail because the API expects `reasoning_content` on every assistant message including tool-call messages, and the ai-sdk does not preserve that field in conversation history. Disabling thinking makes tools work but weakens the analysis the model can produce. The README documents this as a known limitation. This change is PARKED: during an explore session the user evaluated swapping to GLM-5.2 (which has the same `thinking` field shape) and decided to stick with Kimi for now. This proposal captures the parked investigation so it isn't forgotten.

## What Changes

**Status: PARKED — not for implementation now.** When unparked, the change would be one of two paths:

- **Option A (model swap):** Change `providerId` from `moonshotai` to `zai` (or `zhipuai`), `modelId` from `kimi-k2.6` to `glm-5.2`, `apiKey` from `MOONSHOT_API_KEY` to `ZHIPU_API_KEY`, and the `providerOptions` key from `moonshotai` to `zai`. Update `.env.example` and README. Then test whether GLM-5.2's thinking-enabled mode hits the same tool-call bug as Kimi.
- **Option B (patch the ai-sdk workaround):** Stay on Kimi but patch the conversation-history handling so `reasoning_content` is preserved on tool-call messages, enabling Kimi's thinking mode with tools. More invasive; touches ai-sdk or Mastra internals.

In both cases, the end goal is: tools work AND thinking is enabled, giving the agent stronger analysis for the daily report.

## Capabilities

### New Capabilities
- `model-config`: Configuration and behavior of the LLM driving the news agent, including provider, model id, thinking-mode setting, and the interaction between reasoning models and tool calls.

### Modified Capabilities
<!-- None. No existing specs to modify (openspec/specs/ is empty). -->

## Impact

- **Affected code (Option A)**: `src/agent.ts` (model block), `src/report.ts` (providerOptions key), `.env.example`, `README.md`. ~3-line code change.
- **Affected code (Option B)**: ai-sdk or Mastra conversation-history serialization — unclear surface area without a spike.
- **Dependencies**: none new for Option A (Mastra's provider registry already has `zai`/`zhipuai` entries). Option B may require a forked or pinned ai-sdk version.
- **Key unknown**: whether GLM-5.2 (Option A) or Kimi with a patch (Option B) actually allows thinking + tools simultaneously. Must be verified by a spike before committing to either path.
- **Priority**: P3 / parked. Revisit when there's a reason to prioritize analysis quality (e.g. reports feeling shallow) or when ai-sdk/Mastra ships a fix for the `reasoning_content` preservation.
