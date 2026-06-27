import { Mastra } from "@mastra/core/mastra";
import { usdNewsAgent } from "./agent.js";

export const mastra = new Mastra({
	agents: {
		usdNewsAgent,
	},
});
