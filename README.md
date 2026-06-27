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

### Scheduled Reports — macOS (launchd, recommended)

Install a launchd agent that runs the report daily at 8:00 AM and survives reboot, logout, and terminal closure:

```bash
./scripts/install-launchd.sh
```

The installer:
- Resolves absolute paths to `node` and `tsx` (launchd runs with a minimal PATH)
- Writes a plist to `~/Library/LaunchAgents/com.tonyk.usdollar-news.plist`
- Loads it with `launchctl`

The agent will:
- **Run daily at 8:00 AM local time** (see timezone note below)
- **Catch up on boot/wake** if 8 AM was missed (`RunAtLoad` + `shouldRunCatchUp()` guard prevents double-runs)
- **Log to** `~/.usdollar-logs/usdollar-news.log` and `.err.log`

To uninstall:

```bash
./scripts/uninstall-launchd.sh            # keeps logs
./scripts/uninstall-launchd.sh --purge-logs  # also removes logs
```

**Timezone note:** launchd's `StartCalendarInterval` fires in your Mac's local system timezone. If your Mac is set to America/New_York, it fires at 8:00 AM ET. If your Mac is in another timezone, either change the Mac's timezone or edit the `<integer>8</integer>` in the plist to 8 AM in your local timezone.

### Scheduled Reports — Interactive / Non-macOS

For development or non-macOS systems, run the persistent scheduler in a terminal:

```bash
npm run scheduler
```

The scheduler will:
- **Check on startup**: If your Mac was asleep at 8 AM, it immediately runs the report (catch-up)
- **Run daily at 8:00 AM ET**: Automatically generates and emails the report
- **Keep running**: The process stays alive until you press Ctrl+C

For a single run without keeping a process alive (useful for cron, systemd, or manual triggers):

```bash
npm run run-once
```

This runs the catch-up check, generates the report if due, and exits.

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
│   ├── agent.ts            # Agent definition, tools, and source adapter map
│   ├── mastra.ts           # Mastra framework configuration
│   ├── index.ts            # One-time report entry point
│   ├── scheduler.ts        # Long-lived scheduler (interactive/non-macOS)
│   ├── scheduler-utils.ts  # Shared catch-up + run-report logic
│   ├── run-once.ts         # One-shot entry point (for launchd/cron)
│   ├── report.ts           # Report generation logic
│   ├── smoke-test.ts       # Scraping smoke test (no LLM, no email)
│   └── email.ts            # Email delivery logic
├── plist/                  # launchd plist template
├── scripts/                # install/uninstall launchd scripts
├── .env.example            # Environment variable template
├── .last-run.json          # Tracks last run time for catch-up (gitignored)
├── package.json            # Project dependencies
├── tsconfig.json           # TypeScript configuration
└── README.md               # This file
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
- **Scheduler reliability**: The launchd mode (macOS, recommended) survives reboot and logout. The interactive `npm run scheduler` mode only works while a terminal is open. Use `npm run run-once` for single-run scenarios (cron, systemd, manual triggers).
- Some news sites may block automated scraping or require authentication; results may vary
- The agent is designed for educational and research purposes
- Respect the terms of service of the news sources being scraped

## Troubleshooting Scheduling

**The scheduled report didn't run:**

1. **Check if the launchd agent is loaded:**
   ```bash
   launchctl list | grep usdollar
   ```
   If nothing appears, reinstall with `./scripts/install-launchd.sh`.

2. **Check the logs:**
   ```bash
   cat ~/.usdollar-logs/usdollar-news.log
   cat ~/.usdollar-logs/usdollar-news.err.log
   ```

3. **Check the timezone:** launchd fires `StartCalendarInterval` in your Mac's local timezone. Verify your Mac's timezone:
   ```bash
   sudo systemsetup -gettimezone
   ```
   If it's not America/New_York, either change it or edit the plist's `<integer>8</integer>` to 8 AM in your local timezone, then reload:
   ```bash
   launchctl unload ~/Library/LaunchAgents/com.tonyk.usdollar-news.plist
   launchctl load ~/Library/LaunchAgents/com.tonyk.usdollar-news.plist
   ```

4. **Manually trigger a run:**
   ```bash
   launchctl kickstart gui/$(id -u)/com.tonyk.usdollar-news
   ```

5. **The report ran twice:** This shouldn't happen — `shouldRunCatchUp()` checks `.last-run.json` and skips if today's run already completed. If it did run twice, check that `.last-run.json` exists and contains today's date. The file is at the project root (gitignored).

6. **launchd can't find node or tsx:** The install script bakes absolute paths into the plist. If you moved the project or upgraded node, rerun `./scripts/install-launchd.sh` to regenerate the plist with updated paths.

## License

ISC
