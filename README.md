# US Dollar News Agent

A Mastra-powered agent that scrapes the internet for news about how the US Dollar (USD) is performing.

## Features

- **Automated Web Scraping**: Scrapes major financial news sources for USD-related articles
- **AI-Powered Analysis**: Uses Kimi K2.6 to analyze and summarize news
- **Multiple News Sources**: Supports Reuters, Bloomberg, CNBC, WSJ, Financial Times, and MarketWatch
- **Structured Data Extraction**: Extracts headlines, summaries, and article links

## Prerequisites

- Node.js >= 20 (the project requires Node.js 20+ for Mastra compatibility)
- A Moonshot API key
- (Optional) A Gmail account with an App Password for email delivery

## Installation

1. Install dependencies:

```bash
npm install
```

2. Set up your environment variables:

```bash
cp .env.example .env
# Edit .env and add your Moonshot API key and email credentials
```

## Usage

### One-time Report

Run the agent manually (TypeScript source is executed directly via `tsx`):

```bash
npm start
```

Or in development mode with auto-reload:

```bash
npm run dev
```

### Scraping Smoke Test

Verify that news sources are reachable and returning articles, without invoking the LLM or sending email:

```bash
npm run smoke
```

This prints a per-source health table showing status, article count, and which strategy matched. Useful for diagnosing scraping issues quickly. See [Troubleshooting Scraping](#troubleshooting-scraping) below.

### Scheduled Reports (8 AM ET Daily)

Run the persistent scheduler that checks daily and emails the report:

```bash
npm run scheduler
```

The scheduler will:
- **Check on startup**: If your Mac was asleep at 8 AM, it immediately runs the report (catch-up)
- **Run daily at 8:00 AM ET**: Automatically generates and emails the report
- **Keep running**: The process stays alive until you press Ctrl+C

### Email Setup

To receive reports via email, add these to your `.env`:

```bash
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password
EMAIL_TO=your_email@gmail.com
```

**For Gmail**: You must use an [App Password](https://support.google.com/accounts/answer/185833), not your regular password.

**Note**: If email is not configured, the report will still be printed to the terminal.

To compile TypeScript to JavaScript:

```bash
npm run build
```

## How It Works

The agent uses two specialized tools to gather and analyze US Dollar news:

1. **`searchUSDNews`**: Scrapes financial news websites for USD-related articles. Each source has a per-source adapter with ordered selector strategies and a Google News RSS fallback. The tool returns both articles and a `health` array reporting the status (`ok`, `empty`, `error`, or `skipped`) of each source.
2. **`scrapeWebPage`**: Deep-scrapes individual article pages for detailed content

The agent then uses **Kimi K2.6** (with thinking disabled) to analyze the scraped data and provide a comprehensive report on:

- USD exchange rate movements
- Federal Reserve policy decisions
- Inflation and economic indicators
- Geopolitical events affecting the dollar
- Market sentiment and forecasts

### Why Thinking is Disabled

Kimi K2.6 is a reasoning model with thinking enabled by default. However, the Moonshot API has a compatibility constraint: when thinking is enabled, tool calls fail because the API expects `reasoning_content` to be present in every assistant message, including tool call messages. The underlying AI SDK (Mastra/ai-sdk) does not preserve this field in the conversation history.

To make tools work, the agent disables thinking mode by passing `thinking: { type: "disabled" }` in the API request. This is a known limitation of the Moonshot API + ai-sdk combination.

## Project Structure

```
├── src/
│   ├── agent.ts       # Agent definition, tools, and source adapter map
│   ├── mastra.ts      # Mastra framework configuration
│   ├── index.ts       # One-time report entry point
│   ├── scheduler.ts   # Persistent scheduler with catch-up logic
│   ├── report.ts      # Report generation logic
│   ├── smoke-test.ts  # Scraping smoke test (no LLM, no email)
│   └── email.ts       # Email delivery logic
├── .env.example       # Environment variable template
├── .last-run.json     # Tracks last run time for catch-up
├── package.json       # Project dependencies
├── tsconfig.json      # TypeScript configuration
└── README.md          # This file
```

## News Sources

The agent scrapes the following sources. Each has a per-source adapter in `src/agent.ts` with ordered strategies (direct scrape → Google News RSS fallback) and health tracking:

| Source | Status | Strategy |
|--------|--------|----------|
| Reuters Markets | ✅ Active | Direct scrape (rich headers + date-pattern links) → RSS fallback |
| CNBC Currencies | ✅ Active | Google News RSS (site is JS-rendered, no static HTML to scrape) |
| MarketWatch | ✅ Active | Direct scrape (rich headers + `/story/` links) → RSS fallback |
| Wall Street Journal | ✅ Active | Direct scrape (existing selectors) → RSS fallback |
| Bloomberg Markets | ⏭️ Skipped | Paywalled — blocks non-subscriber scraping |
| Financial Times | ⏭️ Skipped | Paywalled — blocks non-subscriber scraping |

When a source is `skipped`, `empty`, or `error`, the agent's report includes a **Source Health Warning** section at the top naming the degraded sources so the reader knows the report may be incomplete.

### Scraping Smoke Test

To verify scraping health without invoking the LLM or sending email:

```bash
npm run smoke
```

This runs `src/smoke-test.ts`, which invokes `searchUSDNews` with `source: "all"` and prints a per-source health table (status, article count, matched strategy, errors). Use it to diagnose scraping issues quickly.

## Troubleshooting Scraping

**A source shows `empty` or `error` in the smoke test or report:**

1. **Check the matched strategy.** If the direct-scrape strategy failed and the RSS fallback succeeded, the site may have changed its HTML structure. The direct selectors in the source's adapter entry in `src/agent.ts` need updating.
2. **Check if the site is blocking you.** A `401` or `403` HTTP status means the site is rejecting the request. The rich headers in `RICH_HEADERS` (in `src/agent.ts`) mimic a real browser; if the site has added stronger bot detection, the direct strategy may stop working. The Google News RSS fallback will usually still work.
3. **Check if the site is a JS-rendered SPA.** Sites like CNBC load articles via JavaScript, so no article links appear in the static HTML. These sources rely on the Google News RSS strategy as their primary (or only) strategy.
4. **To fix a broken source:** Update its adapter entry in the `sourceAdapters` map in `src/agent.ts`. Each adapter has an ordered list of strategies — add or modify a strategy to match the site's current HTML structure. Run `npm run smoke` to verify the fix.
5. **To add a new source:** Add a new entry to the `sourceAdapters` map with at least one strategy. The tool will pick it up automatically when `source: "all"` is requested. Add the source name to the `source` enum in the tool's `inputSchema` as well.
6. **To skip a source permanently:** Set `skipped: true` and `skipReason: "..."` on its adapter entry. It will be reported as `skipped` in the health metadata rather than silently failing.

## Notes

- The agent requires a valid Moonshot API key to function
- **K2.6 Configuration**: The agent uses `kimi-k2.6` with `thinking: { type: "disabled" }` and `temperature: 0.6` (required by the Moonshot API for non-thinking mode)
- **Scheduler Catch-Up**: If your Mac is asleep at 8 AM, the scheduler will run the report immediately when you wake it up (if you start the scheduler after 8 AM). However, if the scheduler process itself is not running (e.g., you closed the terminal), it cannot catch up.
- **Keeping the Scheduler Running**: The scheduler only works while the terminal is open. To run it in the background even after closing the terminal:
  ```bash
  nohup npm run scheduler > scheduler.log 2>&1 &
  ```
  Then check the log with: `tail -f scheduler.log`
- Some news sites may block automated scraping or require authentication; results may vary
- The agent is designed for educational and research purposes
- Respect the terms of service of the news sources being scraped

## License

ISC
