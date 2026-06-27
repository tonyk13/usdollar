## ADDED Requirements

### Requirement: Thinking mode operates with tool calls
When this change is implemented, the agent's model SHALL operate with thinking mode enabled while tool calls (`searchUSDNews`, `scrapeWebPage`) continue to function correctly. The system MUST NOT require thinking to be disabled as a precondition for tool use.

#### Scenario: Report generates with thinking enabled and tools invoked
- **WHEN** the agent generates a report with thinking mode enabled
- **THEN** the `searchUSDNews` and `scrapeWebPage` tools are invoked successfully and the report is produced without a tool-call error

#### Scenario: Thinking-disabled workaround is no longer required
- **WHEN** the agent's model configuration is inspected
- **THEN** thinking is configured as enabled (or the model defaults to enabled), and the previous `thinking: { type: "disabled" }` workaround is absent

### Requirement: Model configuration is isolated and documented
The agent's model configuration (provider id, model id, API key env var, thinking-mode setting) SHALL be isolated to a single configuration surface in `agent.ts` (plus the `providerOptions` key in `report.ts`), and the README SHALL document the active model and thinking mode. The "Why Thinking is Disabled" section of the README SHALL be removed or replaced when thinking is enabled.

#### Scenario: README reflects the active configuration
- **WHEN** a reader consults the README after this change is implemented
- **THEN** the README names the active model and states that thinking mode is enabled, and contains no section asserting that thinking must be disabled for tools to work

### Requirement: Swap is reversible
If the model is swapped (Option A), the change SHALL be reversible by reverting the model configuration to the previous Kimi K2.6 settings, with no schema migrations or data format changes required. The previous configuration SHALL be recorded in the design.md of this change for easy revert.

#### Scenario: Reverting to Kimi
- **WHEN** a developer reverts the model configuration to `providerId: "moonshotai"`, `modelId: "kimi-k2.6"`, `apiKey: MOONSHOT_API_KEY`, and restores `providerOptions.moonshotai.thinking = { type: "disabled" }`
- **THEN** the agent operates as it did before this change, with no other code or data changes required
