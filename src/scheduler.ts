import cron from "node-cron";
import {
	shouldRunCatchUp,
	runReport,
} from "./scheduler-utils.js";

async function main(): Promise<void> {
	console.log("🚀 USD News Agent Scheduler starting up...\n");
	console.log("   Schedule: Daily at 8:00 AM ET");
	console.log("   Catch-up: Enabled (runs if missed while asleep)\n");

	// Check if we need to run catch-up on startup
	if (shouldRunCatchUp()) {
		await runReport();
	}

	// Schedule daily run at 8 AM ET
	// Cron expression: 0 8 * * * = At 8:00 AM every day
	// The timezone is set to America/New_York
	cron.schedule("0 8 * * *", async () => {
		console.log("🔔 Scheduled run triggered at 8:00 AM ET\n");
		await runReport();
	}, {
		timezone: "America/New_York",
	});

	console.log("📅 Scheduled: Daily at 8:00 AM ET");
	console.log("💤 Scheduler is running. Press Ctrl+C to stop.\n");

	// Keep the process alive
	process.stdin.resume();
}

main();
