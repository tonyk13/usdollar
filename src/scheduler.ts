import "dotenv/config";
import cron from "node-cron";
import { generateUSDReport } from "./report.js";
import { sendReportEmail, isEmailConfigured } from "./email.js";
import fs from "fs";
import path from "path";

// Disable telemetry warnings
declare global {
	var ___MASTRA_TELEMETRY___: boolean;
}
globalThis.___MASTRA_TELEMETRY___ = true;

const LAST_RUN_FILE = path.join(process.cwd(), ".last-run.json");

interface LastRunData {
	timestamp: string;
}

function getLastRunTime(): Date | null {
	try {
		if (fs.existsSync(LAST_RUN_FILE)) {
			const data: LastRunData = JSON.parse(
				fs.readFileSync(LAST_RUN_FILE, "utf-8"),
			);
			return new Date(data.timestamp);
		}
	} catch {
		// ignore
	}
	return null;
}

function saveLastRunTime(): void {
	const data: LastRunData = { timestamp: new Date().toISOString() };
	fs.writeFileSync(LAST_RUN_FILE, JSON.stringify(data, null, 2));
}

function getToday8AMET(): Date {
	const now = new Date();
	// Create a date string for today in ET, then parse it back as UTC for comparison
	const etFormatter = new Intl.DateTimeFormat("en-US", {
		timeZone: "America/New_York",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	});

	const parts = etFormatter.formatToParts(now);
	const year = parts.find((p) => p.type === "year")?.value;
	const month = parts.find((p) => p.type === "month")?.value;
	const day = parts.find((p) => p.type === "day")?.value;
	const hour = parts.find((p) => p.type === "hour")?.value;
	const minute = parts.find((p) => p.type === "minute")?.value;
	const second = parts.find((p) => p.type === "second")?.value;

	// Construct an ISO string for today at 8:00:00 in ET
	// Then interpret it as ET and convert to UTC
	const etIsoString = `${year}-${month}-${day}T08:00:00`;

	// Parse as ET
	const etDate = new Date(etIsoString + "-05:00"); // ET is UTC-5 (standard time)
	// For daylight saving, we need a more robust approach
	// Let's use a different method: create the date in ET timezone

	// Better approach: use the browser/node's timezone handling
	const etDateStr = `${year}-${month}-${day}T08:00:00-05:00`;
	const etDateDstStr = `${year}-${month}-${day}T08:00:00-04:00`;

	// Try both and pick the one that is "today" in ET
	const candidateStd = new Date(etDateStr);
	const candidateDst = new Date(etDateDstStr);

	// Check which one falls on the same ET day
	const checkDay = (d: Date): boolean => {
		const dParts = etFormatter.formatToParts(d);
		const dYear = dParts.find((p) => p.type === "year")?.value;
		const dMonth = dParts.find((p) => p.type === "month")?.value;
		const dDay = dParts.find((p) => p.type === "day")?.value;
		return dYear === year && dMonth === month && dDay === day;
	};

	if (checkDay(candidateDst)) {
		return candidateDst;
	}
	return candidateStd;
}

function shouldRunCatchUp(): boolean {
	const lastRun = getLastRunTime();
	const today8AM = getToday8AMET();
	const now = new Date();

	console.log(`🕐 Last run: ${lastRun?.toISOString() || "never"}`);
	console.log(`🕐 Today's 8 AM ET: ${today8AM.toISOString()}`);
	console.log(`🕐 Now: ${now.toISOString()}`);

	if (now < today8AM) {
		// It's before 8 AM, no catch-up needed
		console.log("⏳ It's before 8 AM ET. No catch-up needed.\n");
		return false;
	}

	if (!lastRun) {
		// Never run before, and it's after 8 AM
		console.log("⚡ No previous run found. Running catch-up now.\n");
		return true;
	}

	if (lastRun < today8AM) {
		// Last run was before today's 8 AM
		console.log("⚡ Missed 8 AM run. Running catch-up now.\n");
		return true;
	}

	console.log("✅ 8 AM run already completed today. No catch-up needed.\n");
	return false;
}

async function runReport(): Promise<void> {
	console.log("📰 Generating USD news report...\n");

	try {
		const report = await generateUSDReport();
		console.log("\n=== US DOLLAR NEWS REPORT ===\n");
		console.log(report);
		console.log("\n============================");

		if (isEmailConfigured()) {
			const today = new Date().toLocaleDateString("en-US", {
				timeZone: "America/New_York",
				month: "short",
				day: "numeric",
				year: "numeric",
			});
			await sendReportEmail(
				`US Dollar News Report - ${today}`,
				report,
			);
		} else {
			console.log("\n⚠️  Email not configured. Report was not sent via email.");
			console.log(
				"   Set EMAIL_USER and EMAIL_PASS in your .env file to enable email delivery.",
			);
		}

		saveLastRunTime();
		console.log("\n✅ Report complete.\n");
	} catch (error) {
		console.error("❌ Error generating report:", error);
	}
}

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
	cron.schedule(
		"0 8 * * *",
		async () => {
			console.log("🔔 Scheduled run triggered at 8:00 AM ET\n");
			await runReport();
		},
		{
			scheduled: true,
			timezone: "America/New_York",
		},
	);

	console.log("📅 Scheduled: Daily at 8:00 AM ET");
	console.log("💤 Scheduler is running. Press Ctrl+C to stop.\n");

	// Keep the process alive
	process.stdin.resume();
}

main();
