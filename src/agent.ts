import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import * as cheerio from "cheerio";

// Tool to scrape web pages for USD news
const scrapeWebPage = createTool({
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
	execute: async ({ context }: { context: { url: string } }) => {
		const { url } = context;
		try {
			const response = await fetch(url, {
				headers: {
					"User-Agent":
						"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
				},
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const html = await response.text();
			const $ = cheerio.load(html);

			// Remove script and style elements
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

// Tool to search for USD news using a search engine-like approach
const searchUSDNews = createTool({
	id: "search-usd-news",
	description:
		"Search for recent US Dollar news by scraping known financial news sources",
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
			.describe("Maximum number of articles to retrieve"),
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
	}),
	execute: async ({
		context,
	}: {
		context: { source: string; limit: number };
	}) => {
		const { source, limit } = context;

		const sources: Record<string, string> = {
			reuters: "https://www.reuters.com/markets/currencies/",
			bloomberg: "https://www.bloomberg.com/markets/currencies",
			cnbc: "https://www.cnbc.com/currencies/",
			wsj: "https://www.wsj.com/market-data/currencies",
			ft: "https://www.ft.com/markets/currencies",
			marketwatch: "https://www.marketwatch.com/investing/currencies",
		};

		const urlsToScrape =
			source === "all"
				? Object.entries(sources)
				: [[source, sources[source]]];

		const articles: Array<{
			title: string;
			url: string;
			summary: string;
			source: string;
		}> = [];

		for (const [srcName, url] of urlsToScrape) {
			if (articles.length >= limit) break;
			try {
				const response = await fetch(url, {
					headers: {
						"User-Agent":
							"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
					},
				});

				if (!response.ok) continue;

				const html = await response.text();
				const $ = cheerio.load(html);

				// Extract article titles and links - common patterns across news sites
				$(
					"article, .article, .story, .news-item, [data-testid='article-card'], .headline",
				).each((_, el) => {
					if (articles.length >= limit) return false;

					const title = $(el)
						.find("h2, h3, .title, a")
						.first()
						.text()
						.trim();
					const link = $(el).find("a").first().attr("href");
					const summary = $(el)
						.find("p, .summary, .description")
						.first()
						.text()
						.trim();

					if (title && link) {
						const absoluteUrl = link.startsWith("http")
							? link
							: new URL(link, url).href;
						articles.push({
							title,
							url: absoluteUrl,
							summary: summary || title,
							source: srcName,
						});
					}
				});

				// Fallback: try to find any headlines
				if (articles.length === 0) {
					$("h2, h3").each((_, el) => {
						if (articles.length >= limit) return false;
						const title = $(el).text().trim();
						const link =
							$(el).closest("a").attr("href") ||
							$(el).find("a").attr("href");
						if (title && link && title.length > 10) {
							const absoluteUrl = link.startsWith("http")
								? link
								: new URL(link, url).href;
							articles.push({
								title,
								url: absoluteUrl,
								summary: title,
								source: srcName,
							});
						}
					});
				}
			} catch (error: unknown) {
				console.error(`Failed to scrape ${srcName}:`, error);
			}
		}

		return { articles };
	},
});

// Create the USD news agent
export const usdNewsAgent = new Agent({
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
  `,
	model: {
		providerId: "moonshotai",
		modelId: "kimi-k2.6",
		apiKey: process.env.MOONSHOT_API_KEY,
	},
	tools: {
		scrapeWebPage,
		searchUSDNews,
	},
});
