import {
	shouldRunCatchUp,
	runReport,
} from "./scheduler-utils.js";

async function main(): Promise<void> {
	console.log("🚀 USD News Agent — one-shot run\n");

	if (shouldRunCatchUp()) {
		await runReport();
	} else {
		console.log("ℹ️  No report needed. Exiting.\n");
	}

	process.exit(0);
}

main().catch((error) => {
	console.error("❌ Fatal error:", error);
	process.exit(1);
});
