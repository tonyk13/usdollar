import "dotenv/config";
import { searchUSDNews } from "./agent.js";
import { RequestContext } from "@mastra/core/request-context";
import { noopObserve, isValidationError } from "@mastra/core/tools";

async function main(): Promise<void> {
	console.log("🔥 Scraping smoke test\n");
	console.log("   Invoking searchUSDNews with source: 'all', limit: 5");
	console.log("   No LLM call, no email. Live network requests only.\n");

	const start = Date.now();
	const result = await searchUSDNews.execute!(
		{ source: "all", limit: 5 },
		{ observe: noopObserve, requestContext: new RequestContext() },
	);
	const elapsed = ((Date.now() - start) / 1000).toFixed(1);

	if (!result) {
		console.error("❌ Tool returned no output");
		process.exit(1);
	}

	if (isValidationError(result)) {
		console.error("❌ Tool output validation failed:", result.message);
		process.exit(1);
	}

	const articles = result.articles ?? [];
	const health = result.health ?? [];

	const bySource = new Map<string, string[]>();
	for (const a of articles) {
		const list = bySource.get(a.source) ?? [];
		list.push(a.title);
		bySource.set(a.source, list);
	}

	const padName = 14;
	console.log("─".repeat(75));
	console.log("SOURCE HEALTH");
	console.log("─".repeat(75));
	for (const h of health) {
		const statusIcon =
			h.status === "ok" ? "✅" :
			h.status === "skipped" ? "⏭️" :
			h.status === "error" ? "❌" : "⚠️";
		const matched = h.matchedStrategy ? ` via ${h.matchedStrategy}` : "";
		const err = h.error ? ` (${h.error.slice(0, 40)})` : "";
		console.log(`${statusIcon} ${h.source.padEnd(padName)} │ ${h.status.padEnd(8)} │ ${h.articleCount} articles │ strategies tried: ${h.strategiesTried}${matched}${err}`);
	}

	console.log("\n" + "─".repeat(75));
	console.log("ARTICLES BY SOURCE");
	console.log("─".repeat(75));
	const knownSources = ["reuters", "cnbc", "marketwatch", "wsj", "bloomberg", "ft"];
	for (const src of knownSources) {
		const titles = bySource.get(src) ?? [];
		if (titles.length === 0 && !health.find((h) => h.source === src)) continue;
		const status = titles.length > 0 ? `${titles.length} article${titles.length === 1 ? "" : "s"}` : "none";
		console.log(`\n${src.padEnd(padName)} │ ${status}`);
		for (const t of titles) {
			console.log(`  ${"".padEnd(padName)} │ ${t.slice(0, 70)}`);
		}
	}
	console.log("\n" + "─".repeat(75));

	const okCount = health.filter((h) => h.status === "ok").length;
	const skippedCount = health.filter((h) => h.status === "skipped").length;
	const degradedCount = health.filter((h) => h.status === "empty" || h.status === "error").length;
	console.log(`\nSummary: ${okCount} ok · ${degradedCount} degraded · ${skippedCount} skipped`);
	console.log(`Total articles: ${articles.length}  ·  Elapsed: ${elapsed}s`);

	process.exit(0);
}

main().catch((err) => {
	console.error("❌ Smoke test failed:", err);
	process.exit(1);
});
