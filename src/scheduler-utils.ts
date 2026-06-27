import "dotenv/config";
import { generateUSDReport } from "./report.js";
import { sendReportEmail, isEmailConfigured } from "./email.js";
import fs from "fs";
import path from "path";

const LAST_RUN_FILE = path.join(process.cwd(), ".last-run.json");

interface LastRunData {
	timestamp: string;
}

export function getLastRunTime(): Date | null {
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

export function saveLastRunTime(): void {
	const data: LastRunData = { timestamp: new Date().toISOString() };
	fs.writeFileSync(LAST_RUN_FILE, JSON.stringify(data, null, 2));
}

export function getToday8AMET(): Date {
	const now = new Date();
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

	const etDateStr = `${year}-${month}-${day}T08:00:00-05:00`;
	const etDateDstStr = `${year}-${month}-${day}T08:00:00-04:00`;

	const candidateStd = new Date(etDateStr);
	const candidateDst = new Date(etDateDstStr);

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

export function shouldRunCatchUp(): boolean {
	const lastRun = getLastRunTime();
	const today8AM = getToday8AMET();
	const now = new Date();

	console.log(`🕐 Last run: ${lastRun?.toISOString() || "never"}`);
	console.log(`🕐 Today's 8 AM ET: ${today8AM.toISOString()}`);
	console.log(`🕐 Now: ${now.toISOString()}`);

	if (now < today8AM) {
		console.log("⏳ It's before 8 AM ET. No catch-up needed.\n");
		return false;
	}

	if (!lastRun) {
		console.log("⚡ No previous run found. Running catch-up now.\n");
		return true;
	}

	if (lastRun < today8AM) {
		console.log("⚡ Missed 8 AM run. Running catch-up now.\n");
		return true;
	}

	console.log("✅ 8 AM run already completed today. No catch-up needed.\n");
	return false;
}

export async function runReport(): Promise<void> {
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
			await sendReportEmail(`US Dollar News Report - ${today}`, report);
		} else {
			console.log(
				"\n⚠️  Email not configured. Report was not sent via email.",
			);
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
