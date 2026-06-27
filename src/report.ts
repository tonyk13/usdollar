import { mastra } from "./mastra.js";

export async function generateUSDReport(): Promise<string> {
	const agent = mastra.getAgent("usdNewsAgent");

	console.log("🔍 Scraping the internet for US Dollar news...\n");

	const result = await agent.generate(
		"Search for the latest US Dollar news from financial markets. Find recent articles about USD exchange rates, Federal Reserve policy, inflation, and economic indicators. Provide a summary of how the US Dollar is performing and what factors are driving its movement.",
		{
			modelSettings: { temperature: 0.6 },
			providerOptions: {
				moonshotai: {
					thinking: { type: "disabled" },
				},
			},
		},
	);

	return result.text;
}
