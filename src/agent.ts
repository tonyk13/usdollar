import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import * as cheerio from "cheerio";

// ─── Shared types ───────────────────────────────────────────────────

interface Article {
	title: string;
	url: string;
	summary: string;
	source: string;
}

interface SourceHealth {
	source: string;
	status: "ok" | "empty" | "error" | "skipped";
	articleCount: number;
	strategiesTried: number;
	matchedStrategy?: string;
	error?: string;
}

interface StrategyResult {
	articles: Article[];
	matchedStrategy: string;
}

type SelectorStrategy = (limit: number) => Promise<StrategyResult>;

interface SourceAdapter {
	name: string;
	url: string;
	strategies: SelectorStrategy[];
	skipped?: boolean;
	skipReason?: string;
}

// ─── Rich browser-like headers (unblocks Reuters, MarketWatch) ──────

const RICH_HEADERS: Record<string, string> = {
	"User-Agent":
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
	Accept:
		"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
	"Accept-Language": "en-US,en;q=0.9",
	"Sec-Fetch-Dest": "document",
	"Sec-Fetch-Mode": "navigate",
	"Sec-Fetch-Site": "none",
	"Upgrade-Insecure-Requests": "1",
};

// ─── Google News RSS helper ─────────────────────────────────────────

async function googleNewsRSS(
	site: string,
	sourceName: string,
	limit: number,
): Promise<StrategyResult> {
	const url = `https://news.google.com/rss/search?q=US+dollar+site:${site}&hl=en-US&gl=US&ceid=US:en`;
	const res = await fetch(url, { headers: RICH_HEADERS });
	if (!res.ok) {
		throw new Error(`Google News RSS HTTP ${res.status} for ${site}`);
	}
	const text = await res.text();
	const $ = cheerio.load(text, { xml: true });
	const articles: Article[] = [];

	$("item")
		.slice(0, limit)
		.each((_, el) => {
			const title = $(el).find("title").text().trim();
			const link = $(el).find("link").text().trim();
			if (title && link) {
				articles.push({
					title: title.replace(/\s*-\s*[^-]+$/, "").trim() || title,
					url: link,
					summary: title,
					source: sourceName,
				});
			}
		});

	return { articles, matchedStrategy: "google-news-rss" };
}

// ─── Direct scrape helpers ──────────────────────────────────────────

async function fetchHTML(url: string): Promise<cheerio.CheerioAPI> {
	const res = await fetch(url, { headers: RICH_HEADERS });
	if (!res.ok) {
		throw new Error(`HTTP ${res.status} for ${url}`);
	}
	const html = await res.text();
	return cheerio.load(html);
}

function resolveUrl(href: string, baseUrl: string): string {
	return href.startsWith("http") ? href : new URL(href, baseUrl).href;
}

// ─── Source adapter map ─────────────────────────────────────────────

const sourceAdapters: Record<string, SourceAdapter> = {
	reuters: {
		name: "reuters",
		url: "https://www.reuters.com/markets/currencies/",
		strategies: [
			async (limit) => {
				const $ = await fetchHTML(
					"https://www.reuters.com/markets/currencies/",
				);
				const articles: Article[] = [];
				$("a[href]")
					.filter((_, el) => {
						const h = $(el).attr("href") || "";
						const text = $(el).text().trim();
						return (
							text.length > 20 &&
							!/^(<img|<svg)/.test(text) &&
							/\/(markets|world|business)\/[a-z-]+\/[a-z-]+-\d{4}-\d{2}-\d{2}/.test(h)
						);
					})
					.slice(0, limit)
					.each((_, el) => {
						const h = $(el).attr("href") || "";
						articles.push({
							title: $(el).text().trim(),
							url: resolveUrl(h, "https://www.reuters.com"),
							summary: $(el).text().trim(),
							source: "reuters",
						});
					});
				return { articles, matchedStrategy: "direct-date-link" };
			},
			(limit) => googleNewsRSS("reuters.com", "reuters", limit),
		],
	},

	cnbc: {
		name: "cnbc",
		url: "https://www.cnbc.com/currencies/",
		strategies: [
			// CNBC is a JS-rendered SPA — direct scraping doesn't work.
			// Google News RSS is the primary strategy.
			(limit) => googleNewsRSS("cnbc.com", "cnbc", limit),
		],
	},

	marketwatch: {
		name: "marketwatch",
		url: "https://www.marketwatch.com/investing/currencies",
		strategies: [
			async (limit) => {
				const $ = await fetchHTML(
					"https://www.marketwatch.com/investing/currencies",
				);
				const articles: Article[] = [];
				$("a[href]")
					.filter((_, el) => {
						const h = $(el).attr("href") || "";
						const text = $(el).text().trim();
						return text.length > 15 && /\/story\//.test(h);
					})
					.slice(0, limit)
					.each((_, el) => {
						const h = $(el).attr("href") || "";
						articles.push({
							title: $(el).text().trim(),
							url: resolveUrl(h, "https://www.marketwatch.com"),
							summary: $(el).text().trim(),
							source: "marketwatch",
						});
					});
				return { articles, matchedStrategy: "direct-story-link" };
			},
			(limit) => googleNewsRSS("marketwatch.com", "marketwatch", limit),
		],
	},

	wsj: {
		name: "wsj",
		url: "https://www.wsj.com/market-data/currencies",
		strategies: [
			async (limit) => {
				const $ = await fetchHTML(
					"https://www.wsj.com/market-data/currencies",
				);
				const articles: Article[] = [];
				$(
					"article, .article, .story, .news-item, [data-testid='article-card'], .headline",
				)
					.slice(0, limit)
					.each((_, el) => {
						const title = $(el)
							.find("h2, h3, .title, a")
							.first()
							.text()
							.trim();
						const link = $(el).find("a").first().attr("href");
						if (title && link) {
							articles.push({
								title,
								url: resolveUrl(link, "https://www.wsj.com"),
								summary: title,
								source: "wsj",
							});
						}
					});
				return { articles, matchedStrategy: "direct-wsj-selectors" };
			},
			(limit) => googleNewsRSS("wsj.com", "wsj", limit),
		],
	},

	bloomberg: {
		name: "bloomberg",
		url: "https://www.bloomberg.com/markets/currencies",
		strategies: [],
		skipped: true,
		skipReason: "Paywalled — blocks non-subscriber scraping",
	},

	ft: {
		name: "ft",
		url: "https://www.ft.com/markets/currencies",
		strategies: [],
		skipped: true,
		skipReason: "Paywalled — blocks non-subscriber scraping",
	},
};

// ─── Tool: scrape individual web pages ──────────────────────────────

export const scrapeWebPage = createTool({
	id: "scrape-web-page",
	description:
		"Scrape a web page and extract article content, headlines, and summaries relevant to the US Dollar",
	inputSchema: z.object({
		url: z.string().url().describe("The URL of the web page to scrape"),
	}),
	outputSchema: z.object({
		title: z.string().describe("The title of the page"),
		content: z.string().describe("Extracted text content from the page"),
		links: z.array(z.string()).describe("Relevant links found on the page"),
	}),
	execute: async ({ url }: { url: string }) => {
		try {
			const response = await fetch(url, {
				headers: RICH_HEADERS,
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const html = await response.text();
			const $ = cheerio.load(html);

			$("script, style, nav, footer, header, aside").remove();

			const title =
				$("title").text().trim() ||
				$("h1").first().text().trim() ||
				"Untitled";
			const content = $("body")
				.text()
				.replace(/\s+/g, " ")
				.trim()
				.substring(0, 10000);
			const links: string[] = [];

			$("a[href]").each((_, el) => {
				const href = $(el).attr("href");
				if (href && (href.startsWith("http") || href.startsWith("/"))) {
					const absoluteUrl = href.startsWith("http")
						? href
						: new URL(href, url).href;
					links.push(absoluteUrl);
				}
			});

			return {
				title,
				content: content.substring(0, 5000),
				links: links.slice(0, 20),
			};
		} catch (error: unknown) {
			return {
				title: "Error",
				content: `Failed to scrape ${url}: ${error instanceof Error ? error.message : String(error)}`,
				links: [],
			};
		}
	},
});

// ─── Tool: search for USD news across sources ───────────────────────

export const searchUSDNews = createTool({
	id: "search-usd-news",
	description:
		"Search for recent US Dollar news by scraping known financial news sources. Returns articles and per-source health metadata.",
	inputSchema: z.object({
		source: z
			.enum([
				"reuters",
				"bloomberg",
				"cnbc",
				"wsj",
				"ft",
				"marketwatch",
				"all",
			])
			.default("all")
			.describe("News source to scrape"),
		limit: z
			.number()
			.min(1)
			.max(10)
			.default(5)
			.describe("Maximum number of articles to retrieve per source"),
	}),
	outputSchema: z.object({
		articles: z
			.array(
				z.object({
					title: z.string(),
					url: z.string(),
					summary: z.string(),
					source: z.string(),
				}),
			)
			.describe("List of news articles about the US Dollar"),
		health: z
			.array(
				z.object({
					source: z.string(),
					status: z.enum(["ok", "empty", "error", "skipped"]),
					articleCount: z.number(),
					strategiesTried: z.number(),
					matchedStrategy: z.string().optional(),
					error: z.string().optional(),
				}),
			)
			.describe("Per-source health report"),
	}),
	execute: async ({ source = "all", limit = 5 }) => {
		const adaptersToRun =
			source === "all"
				? Object.values(sourceAdapters)
				: [sourceAdapters[source]].filter(Boolean);

		const articles: Article[] = [];
		const health: SourceHealth[] = [];

		for (const adapter of adaptersToRun) {
			if (adapter.skipped) {
				health.push({
					source: adapter.name,
					status: "skipped",
					articleCount: 0,
					strategiesTried: 0,
					error: adapter.skipReason,
				});
				continue;
			}

			let adapterHealth: SourceHealth = {
				source: adapter.name,
				status: "empty",
				articleCount: 0,
				strategiesTried: 0,
			};

			for (const strategy of adapter.strategies) {
				adapterHealth.strategiesTried++;
				try {
					const result = await strategy(limit);
					if (result.articles.length > 0) {
						articles.push(...result.articles.slice(0, limit));
						adapterHealth = {
							source: adapter.name,
							status: "ok",
							articleCount: result.articles.length,
							strategiesTried: adapterHealth.strategiesTried,
							matchedStrategy: result.matchedStrategy,
						};
						break;
					}
				} catch (e) {
					adapterHealth.error =
						e instanceof Error ? e.message : String(e);
				}
			}

			if (adapterHealth.status !== "ok" && adapterHealth.error) {
				adapterHealth.status = "error";
			}

			health.push(adapterHealth);
		}

		return { articles, health };
	},
});

// ─── The agent ──────────────────────────────────────────────────────

export const usdNewsAgent = new Agent({
	id: "usd-news-agent",
	name: "USD News Scraper",

	instructions: `
    You are a specialized financial news agent focused on the US Dollar (USD).
    Your task is to:
    1. Search for recent news about the US Dollar from major financial news sources
    2. Scrape and analyze article content to extract key information
    3. Provide concise summaries of USD performance, market trends, and relevant economic events
    4. Focus on: USD exchange rates, Federal Reserve policy, inflation data, economic indicators, and geopolitical events affecting the dollar

    When providing information:
    - Always cite your sources
    - Highlight the most impactful news items
    - Note the direction of USD movement (strengthening/weakening) when mentioned
    - Include relevant timestamps when available
    - Be concise but thorough

    IMPORTANT — Source Health Reporting:
    The searchUSDNews tool returns a "health" array alongside articles. If any source
    has a status other than "ok" (i.e. "empty", "error", or "skipped"), you MUST begin
    your report with a "## Source Health Warning" section listing each degraded source,
    its status, and a brief explanation. This tells the reader which sources are missing
    from today's report so they know it may be incomplete.
  `,
	model: "moonshotai/kimi-k2.6",
	tools: {
		scrapeWebPage,
		searchUSDNews,
	},
});
