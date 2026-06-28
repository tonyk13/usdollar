import "dotenv/config";
import { generateUSDReport } from "./report.js";
import { sendReportEmail, isEmailConfigured } from "./email.js";

async function main(): Promise<void> {
	try {
		const report = await generateUSDReport();

		console.log("\n=== US DOLLAR NEWS REPORT ===\n");
		console.log(report);
		console.log("\n============================");

		if (isEmailConfigured()) {
			await sendReportEmail(
				"US Dollar News Report",
				report,
			);
		}
	} catch (error) {
		console.error("Error running the agent:", error);
		process.exit(1);
	}
}

main();
