## 0. Status: PARKED — do not start until unparked

- [ ] 0.1 Confirm with the user that this change is unparked and they have obtained a `ZHIPU_API_KEY` from `chat.z.ai`
- [ ] 0.2 Record the current Kimi config in design.md (if not already): `providerId: "moonshotai"`, `modelId: "kimi-k2.6"`, `apiKey: MOONSHOT_API_KEY`, `providerOptions.moonshotai.thinking = { type: "disabled" }`, `temperature: 0.6` — for easy revert

## 1. Spike: GLM-5.2 swap with thinking disabled (isolate the swap)

- [ ] 1.1 In `src/agent.ts`, change the model block to `providerId: "zai"`, `modelId: "glm-5.2"`, `apiKey: process.env.ZHIPU_API_KEY`
- [ ] 1.2 In `src/report.ts`, change `providerOptions` key from `moonshotai` to `zai`, keep `thinking: { type: "disabled" }` and `temperature: 0.6` for this run
- [ ] 1.3 Add `ZHIPU_API_KEY=...` to `.env` (do NOT commit)
- [ ] 1.4 Run `npm start` and confirm a report generates with tools working — if this fails, diagnose auth/model-id/baseURL before proceeding

## 2. Spike: enable thinking on GLM-5.2 (isolate the bug)

- [ ] 2.1 In `src/report.ts`, flip `providerOptions.zai.thinking` to `{ type: "enabled" }` (GLM-5.2 "High" effort)
- [ ] 2.2 Run `npm start` and observe whether tools still work
- [ ] 2.3 If tools work → proceed to section 3 (success path)
- [ ] 2.4 If tools fail with the same `reasoning_content` error as Kimi → record the failure in design.md, proceed to section 4 (Option B or re-park)

## 3. Success path: finalize the swap

- [ ] 3.1 Update `.env.example` to show `ZHIPU_API_KEY=...` (remove or comment the `MOONSHOT_API_KEY` line)
- [ ] 3.2 Update `README.md`: replace Kimi/Moonshot references with GLM-5.2/Z.ai; remove the "Why Thinking is Disabled" section; add a note that thinking mode is enabled and the model is GLM-5.2
- [ ] 3.3 Run `npm start` one more time end-to-end, confirm a full report with thinking on and tools working
- [ ] 3.4 Run `npm run build` (tsc) to confirm no type errors from the config change

## 4. Fallback path: Option B or re-park

- [ ] 4.1 (Only if section 2 failed) Investigate patching ai-sdk/Mastra to preserve `reasoning_content` on tool-call messages — scope a spike
- [ ] 4.2 If Option B is too invasive, update this proposal's status to PARKED with findings, revert any config changes, and leave the Kimi thinking-disabled workaround in place
- [ ] 4.3 If Option B is feasible, implement the patch and re-run the section 2 spike on Kimi with thinking enabled

## 5. Verification

- [ ] 5.1 Confirm the final report quality is acceptable (subjective — run 2-3 reports and compare to pre-change Kimi-disabled output)
- [ ] 5.2 Confirm `npm run build` passes
- [ ] 5.3 If swapped to GLM-5.2, confirm the change is reversible by reverting the config and re-running Kimi (no data/schema migrations)
