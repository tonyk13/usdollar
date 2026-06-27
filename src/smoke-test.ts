import "dotenv/config";
import { searchUSDNews } from "./agent.js";
import { RuntimeContext } from "@mastra/core/runtime-context";

async function main(): Promise<void> {
	console.log("🔥 Scraping smoke test — baseline (pre-hardening)\n");
	console.log("   Invoking searchUSDNews with source: 'all', limit: 5");
	console.log("   No LLM call, no email. Live network requests only.\n");

	const start = Date.now();
	const result = await searchUSDNews.execute({
		context: { source: "all", limit: 5 },
		runtimeContext: new RuntimeContext(),
	} as Parameters<typeof searchUSDNews.execute>[0]);
	const elapsed = ((Date.now() - start) / 1000).toFixed(1);

	const articles = (result as { articles: Array<{ title: string; url: string; source: string }> }).articles ?? [];

	const bySource = new Map<string, string[]>();
	for (const a of articles) {
		const list = bySource.get(a.source) ?? [];
		list.push(a.title);
		bySource.set(a.source, list);
	}

	const knownSources = ["reuters", "bloomberg", "cnbc", "wsj", "ft", "marketwatch"];
	const padName = 12;
	console.log("─".repeat(70));
	for (const src of knownSources) {
		const titles = bySource.get(src) ?? [];
		const status = titles.length > 0 ? `${titles.length} article${titles.length === 1 ? "" : "s"}` : "EMPTY";
		console.log(`${src.padEnd(padName)} │ ${status.padEnd(12)} │ ${titles[0] ?? ""}`);
		if (titles.length > 1) {
			for (let i = 1; i < titles.length; i++) {
				console.log(`${"".padEnd(padName)} │ ${"".padEnd(12)} │ ${titles[i]}`);
			}
		}
	}
	console.log("─".repeat(70));

	const alive = knownSources.filter((s) => (bySource.get(s) ?? []).length > 0).length;
	const empty = knownSources.filter((s) => (bySource.get(s) ?? []).length === 0);
	console.log(`\nSummary: ${alive}/${knownSources.length} sources returned articles.`);
	if (empty.length > 0) {
		console.log(`Empty sources: ${empty.join(", ")}`);
	}
	console.log(`Total articles: ${articles.length}  ·  Elapsed: ${elapsed}s`);

	process.exit(0);
}

main().catch((err) => {
	console.error("❌ Smoke test failed:", err);
	process.exit(1);
});
