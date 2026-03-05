# Provider Catalog

Complete reference for all data providers included with the tiling window manager. Each provider is an `api/providers/*.ts` module that registers SSE pollers and HTTP route handlers via `ctx.poll()`.

---

## Summary Table

| Provider | Tiles | Auth type | Primary channels | Notes |
|---|---|---|---|---|
| Alpha Vantage | alphavantage-quotes, -sparklines, -market-status, -market-movers, -news-sentiment, -earnings, -earnings-calendar, -fundamentals, -forex-rates, -commodities, -economic-indicators, -insider-transactions | API key | `alphavantage-*` (12 channels) | 5 req/min limit; 12 s delay between symbol calls |
| Azure DevOps | azuredevops-pipelines, -releases, -workitems | Personal access token (Basic) | `azuredevops-pipelines`, `azuredevops-releases`, `azuredevops-workitems` | Releases & work items require `AZURE_DEVOPS_PROJECT` |
| Bitrise | bitrise-builds | API token (Bearer) | `bitrise-builds` | Fetches top 3 apps |
| CircleCI | circleci-pipelines, circleci-insights | API token | `circleci-pipelines`, `circleci-insights` | |
| Clockify | clockify-time-entries, clockify-projects | API key | `clockify-time-entries` | User ID auto-resolved if not set |
| Cloudflare | cloudflare-pages, cloudflare-functions | Bearer token | `cf-pages`, `cf-workers` | Requires Account ID |
| CoinGecko | coingecko-prices, -global, -trending, -price-chart, -defi-overview, -categories, -exchanges, -coin-detail | None (public) | `coingecko-markets`, `coingecko-global`, `coingecko-trending`, `coingecko-price-chart`, `coingecko-defi-overview`, `coingecko-categories`, `coingecko-exchanges`, `coingecko-coin-detail` | No API key required; stale-cache fallback on 429 |
| Discord | discord-server-stats, discord-channels | Bot token | `discord-server-stats` | Guild IDs auto-discovered if not set |
| Docker Hub | dockerhub-repositories, dockerhub-tags | Username (token optional) | `dockerhub-repositories` | Public repos work without token |
| Finnhub | finnhub-quotes, -news, -company-news, -market-news, -earnings-calendar, -earnings-surprises, -analyst-consensus, -fundamentals, -market-status, -insider-transactions, -insider-sentiment, -ipo-calendar, -sec-filings, -company-profile | API token | `finnhub-*` (14 channels) | Symbol-specific channels only poll when `FH_SYMBOLS` is set |
| Google Analytics (GA4) | ga4-sessions-trend, ga4-top-pages, ga4-traffic-sources | Service account JWT | `ga4-sessions-trend` | One channel feeds three tiles |
| GitHub | github-actions | Personal access token (Bearer) | `github-runs` | Rate-limit aware with stale-cache; webhook support |
| HackerNews | hn-top-stories, hn-mentions | None (public) | `hn-top-stories` | Always polls; no env vars required |
| HaveIBeenPwned | hibp-breach-status, hibp-recent-breaches | API key | `hibp-breaches` | 1.6 s delay between per-email requests |
| Instatus | instatus-overview, instatus-incidents | Page ID (API key optional) | `instatus-overview` | Falls back to public summary.json without API key |
| Jira | jira-issues, jira-sprint, jira-projects | Basic (email + API token) | `jira-issues` | One channel feeds three tiles; JQL configurable |
| jsDelivr | jsdelivr-hits, jsdelivr-versions | None (public) | `jsdelivr-hits` | Supports npm and GitHub packages |
| Linear | linear-issues, linear-cycles, linear-teams | API key (Bearer) | `linear-issues` | GraphQL API; one channel feeds three tiles |
| Mailchimp | mailchimp-campaigns, mailchimp-audience | API key (Basic) | `mailchimp-campaigns` | Server suffix extracted from API key |
| Netlify | netlify-deployments | Bearer token | `netlify-deployments` | Webhook support at `/api/webhooks/netlify` |
| npm | npm-downloads, npm-metadata | None (public) | `npm-downloads` | |
| PayPal | paypal-transactions | OAuth2 client credentials | `paypal-data` | Sandbox or live environment; webhook support |
| Plaid | plaid-balances, -transactions, -investment-portfolio, -investment-transactions, -liabilities-overview, -credit-card-details, -mortgage-tracker, -statements | Access token + client credentials | `plaid-accounts`, `plaid-transactions`, `plaid-investment-portfolio`, `plaid-investment-transactions`, `plaid-liabilities-overview`, `plaid-credit-card-details`, `plaid-mortgage-tracker`, `plaid-statements` | Requires pre-obtained `PLAID_ACCESS_TOKEN` (via Link flow) |
| Product Hunt | producthunt-top-launches | API token (Bearer) | `producthunt-top-launches` | GraphQL API |
| Reddit | reddit-posts, reddit-hot-posts, reddit-keyword-monitor | None (public) | `reddit-posts` | Subreddits sourced from tile DB configs at runtime |
| RSS | rss-feed | None | None (on-demand) | No SSE channel; per-tile URL config |
| Shodan | shodan-exposed-services, shodan-vuln-summary | API key | `shodan-search` | One channel feeds two tiles |
| Shopify | shopify-orders, shopify-products | Access token | `shopify-orders`, `shopify-products` | |
| Slack | slack-messages, slack-workspace-stats | Bot token (Bearer) | `slack-messages` | Channels auto-discovered if not set |
| SonarQube | sonarqube-quality, sonarqube-measures, sonarqube-issues | Token (Basic) | `sonarqube-quality`, `sonarqube-measures`, `sonarqube-issues` | Self-hosted or SonarCloud |
| Stripe | stripe-payments, -revenue, -orders, -subscriptions, -customers, -invoices, -refunds, -products, -webhooks | Secret key (Stripe SDK) | `stripe-payments`, `stripe-products`, `stripe-subscriptions`, `stripe-customers`, `stripe-invoices`, `stripe-refunds`, `stripe-revenue`, `stripe-webhooks` | Webhook support; per-resource poll intervals |
| Travis CI | travis-builds | API token (Bearer) | `travis-builds` | |
| Vercel | vercel-deployments | Bearer token | `vercel-deployments` | Webhook support at `/api/webhooks/vercel` |
| VirusTotal | virustotal-domain-threats, virustotal-url-scan | API key | `virustotal-analyses` | 15 s delay between domains (4 req/min free tier) |
| WakaTime | wakatime-summary, wakatime-languages, wakatime-projects | API key (Basic base64) | `wakatime-summary` | One channel feeds three tiles |
| WooCommerce | woocommerce-orders, woocommerce-sales-summary, woocommerce-top-sellers | Consumer key + secret (Basic) | `woocommerce-orders`, `woocommerce-sales-summary`, `woocommerce-top-sellers` | Self-hosted WordPress/WooCommerce site |

---

## Provider Sections

---

### Alpha Vantage

> Surfaces real-time and historical US stock quotes, sparklines, market status, top movers, news sentiment, earnings history, EPS calendar, fundamentals, forex rates, commodity prices, macroeconomic indicators, and insider transactions.

**Tiles:** `alphavantage-quotes` (Stock Quotes), `alphavantage-sparklines` (Price Sparklines), `alphavantage-market-status` (Market Status), `alphavantage-market-movers` (Market Movers), `alphavantage-news-sentiment` (News & Sentiment), `alphavantage-earnings` (EPS Earnings), `alphavantage-earnings-calendar` (Earnings Calendar), `alphavantage-fundamentals` (Stock Fundamentals), `alphavantage-forex-rates` (Forex Rates), `alphavantage-commodities` (Commodities), `alphavantage-economic-indicators` (Economic Indicators), `alphavantage-insider-transactions` (Insider Activity)

**Channels:** `alphavantage-quotes`, `alphavantage-sparklines`, `alphavantage-market-status`, `alphavantage-market-movers`, `alphavantage-news-sentiment`, `alphavantage-earnings`, `alphavantage-earnings-calendar`, `alphavantage-fundamentals`, `alphavantage-forex-rates`, `alphavantage-commodities`, `alphavantage-economic-indicators`, `alphavantage-insider-transactions`

**Required env vars:**
- `ALPHA_VANTAGE_KEY` — API key from [alphavantage.co](https://www.alphavantage.co/support/#api-key)
- `AV_SYMBOLS` — comma-separated list of stock symbols (e.g. `AAPL,MSFT,GOOG`); max 5 per poll cycle [optional but needed for quote/sparkline/earnings/fundamentals/forex channels]

**Optional env vars:**
- `AV_FOREX_PAIRS` — comma-separated currency pairs (default: `EUR/USD,GBP/USD,USD/JPY`); max 5

**Poll interval:** quotes/sparklines/news-sentiment/forex-rates: 1 h (`AV_POLL_MS` / `AV_SPARK_POLL_MS` / `AV_NEWS_POLL_MS` / `AV_FOREX_POLL_MS`); market-status/market-movers: 15 min (`AV_MKTSTATUS_POLL_MS` / `AV_MOVERS_POLL_MS`); earnings/fundamentals/commodities: 6 h (`AV_EARNINGS_POLL_MS` / `AV_FUNDA_POLL_MS` / `AV_COMMOD_POLL_MS`); earnings-calendar/economic-indicators/insider-transactions: 24 h (`AV_CALENDAR_POLL_MS` / `AV_ECON_POLL_MS` / `AV_INSIDER_POLL_MS`)

**Notes:** The free tier enforces 5 requests per minute. The provider inserts a 12 s delay between per-symbol calls to avoid hitting the limit. A maximum of 5 symbols are processed per poll cycle. The `alphavantage-insider-transactions` tile requires an Alpha Vantage Premium subscription.

---

### Azure DevOps

> Surfaces Azure Pipelines runs, release environment statuses, and Azure Boards work items.

**Tiles:** `azuredevops-pipelines` (Pipelines), `azuredevops-releases` (Releases), `azuredevops-workitems` (Work Items)

**Channels:** `azuredevops-pipelines`, `azuredevops-releases`, `azuredevops-workitems`

**Required env vars:**
- `AZURE_DEVOPS_ORG` — Azure DevOps organization name
- `AZURE_DEVOPS_TOKEN` — Personal access token from [dev.azure.com](https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate)
- `AZURE_DEVOPS_PROJECT` — Project name (required for releases and work items; optional for pipelines)

**Poll interval:** 1 min (overridable via `AZURE_POLL_MS`)

**Notes:** Authentication uses HTTP Basic with the PAT as the password and an empty username. The work items query defaults to open items ordered by last changed date; customize it by modifying the WIQL query in the provider if needed.

---

### Bitrise

> Surfaces mobile CI build results from Bitrise.

**Tiles:** `bitrise-builds` (Builds)

**Channels:** `bitrise-builds`

**Required env vars:**
- `BITRISE_TOKEN` — Personal access token from [app.bitrise.io/me/profile#/security](https://devcenter.bitrise.io/en/accounts/personal-access-tokens.html)

**Poll interval:** 1 min (overridable via `BITRISE_POLL_MS`)

**Notes:** The provider fetches the first 10 apps for the authenticated account and retrieves the latest 10 builds from each of the first 3 apps. This limits the total to 30 builds per poll.

---

### CircleCI

> Surfaces CircleCI pipeline runs and 30-day workflow success rate and duration insights.

**Tiles:** `circleci-pipelines` (Pipelines), `circleci-insights` (Insights)

**Channels:** `circleci-pipelines`, `circleci-insights`

**Required env vars:**
- `CIRCLECI_TOKEN` — Personal API token from [app.circleci.com/settings/user/tokens](https://circleci.com/docs/managing-api-tokens/)
- `CIRCLECI_ORG_SLUG` — Organization slug, e.g. `gh/myorg`

**Poll interval:** 1 min (overridable via `CIRCLECI_POLL_MS`)

**Notes:** The pipelines channel also fetches workflow details for the first 10 pipelines. Insights use the `last-30-days` reporting window.

---

### Clockify

> Surfaces Clockify time entries with project name resolution.

**Tiles:** `clockify-time-entries` (Time Entries), `clockify-projects` (Projects)

**Channels:** `clockify-time-entries`

**Required env vars:**
- `CLOCKIFY_API_KEY` — API key from [app.clockify.me/user/settings](https://clockify.me/developers-api)
- `CLOCKIFY_WORKSPACE_ID` — Workspace ID (visible in the Clockify workspace settings URL)

**Optional env vars:**
- `CLOCKIFY_USER_ID` — User ID; auto-resolved from `/api/v1/user` if not set

**Poll interval:** 5 min (overridable via `CLOCKIFY_POLL_MS`)

**Notes:** The provider fetches the last 50 time entries and resolves project names for the first 20 of them. Both clock tiles share the single `clockify-time-entries` channel.

---

### Cloudflare

> Surfaces Cloudflare Pages deployment history and Workers script inventory.

**Tiles:** `cloudflare-pages` (Pages Deployments), `cloudflare-functions` (Workers Scripts)

**Channels:** `cf-pages` (consumed by `cloudflare-pages` tile), `cf-workers` (consumed by `cloudflare-functions` tile)

**Required env vars:**
- `CF_API_TOKEN` — API token from [dash.cloudflare.com/profile/api-tokens](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/) with Pages and Workers read permissions
- `CF_ACCOUNT_ID` — Account ID from the Cloudflare dashboard overview page

**Poll interval:** Pages: 1 min (`CF_PAGES_POLL_MS`); Workers: 2 min (`CF_WORKERS_POLL_MS`)

**Notes:** The SSE channel names differ from the tile type strings: `cf-pages` feeds `cloudflare-pages` and `cf-workers` feeds `cloudflare-functions`. An on-demand route is also available at `GET /api/cloudflare/pages/:projectName/deployments` for per-project deployment history.

---

### CoinGecko

> Surfaces live cryptocurrency prices, global market stats, trending coins, 7-day price charts, DeFi overview, category rankings, exchange trust scores, and detailed per-coin stats.

**Tiles:** `coingecko-prices` (Crypto Prices), `coingecko-global` (Market Overview), `coingecko-trending` (Trending Coins), `coingecko-price-chart` (Crypto Price Chart), `coingecko-defi-overview` (DeFi Overview), `coingecko-categories` (Coin Categories), `coingecko-exchanges` (Crypto Exchanges), `coingecko-coin-detail` (Coin Detail)

**Channels:** `coingecko-markets` (→ `coingecko-prices` tile), `coingecko-global`, `coingecko-trending`, `coingecko-price-chart`, `coingecko-defi-overview`, `coingecko-categories`, `coingecko-exchanges`, `coingecko-coin-detail`

**Required env vars:** None — the public CoinGecko API requires no key.

**Optional env vars:**
- `COINGECKO_COINS` — comma-separated CoinGecko coin IDs (default: `bitcoin,ethereum,solana,cardano,polkadot`); max 5 for price chart; max 20 for markets list
- `CG_COIN_ID` — single coin ID to display in the Coin Detail tile (e.g. `bitcoin`)

**Poll interval:** markets/coin-detail: 5 min (`CG_POLL_MS` / `CG_DETAIL_POLL_MS`); global/price-chart/defi: 10 min (`CG_DEFI_POLL_MS` / `CG_CHART_POLL_MS`); trending: 15 min (`CG_TRENDING_POLL_MS`); categories/exchanges: 30 min (`CG_CAT_POLL_MS` / `CG_EXCH_POLL_MS`)

**Notes:** All endpoints fall back to a stale in-memory cache on HTTP 429 rate-limit responses. The price chart introduces a 2 s delay between per-coin requests. No API key is needed for the free public tier.

---

### Discord

> Surfaces Discord guild (server) member counts, online counts, and activity statistics.

**Tiles:** `discord-server-stats` (Server Stats), `discord-channels` (Channels)

**Channels:** `discord-server-stats`

**Required env vars:**
- `DISCORD_BOT_TOKEN` — Bot token from [discord.com/developers/applications](https://discord.com/developers/docs/getting-started)

**Optional env vars:**
- `DISCORD_GUILD_IDS` — comma-separated guild (server) IDs; auto-discovered from the bot's guild list (up to 5) if not set

**Poll interval:** 5 min (overridable via `DISCORD_POLL_MS`)

**Notes:** The bot must be a member of the guilds it monitors. Up to 5 guilds are fetched per poll. Both Discord tiles share the single `discord-server-stats` channel.

---

### Docker Hub

> Surfaces Docker Hub image repository listings and pull counts.

**Tiles:** `dockerhub-repositories` (Repositories), `dockerhub-tags` (Image Tags)

**Channels:** `dockerhub-repositories`

**Required env vars:**
- `DOCKERHUB_USERNAME` — Docker Hub username

**Optional env vars:**
- `DOCKERHUB_TOKEN` — Docker Hub password / access token from [hub.docker.com/settings/security](https://docs.docker.com/docker-hub/access-tokens/); required for private repositories

**Poll interval:** 1 min (overridable via `DOCKERHUB_POLL_MS`)

**Notes:** Public repositories are accessible without a token. When a token is provided the provider exchanges it for a short-lived JWT via the Docker Hub login endpoint. Both tiles share the single `dockerhub-repositories` channel.

---

### Finnhub

> Surfaces real-time stock/forex quotes, financial news, earnings data, analyst recommendations, fundamental metrics, insider activity, IPO calendar, SEC filings, and company profiles.

**Tiles:** `finnhub-quotes` (Market Quotes), `finnhub-news` (Financial News), `finnhub-company-news` (Company News), `finnhub-market-news` (Market News), `finnhub-earnings-calendar` (Earnings Calendar), `finnhub-earnings-surprises` (Earnings Surprises), `finnhub-analyst-consensus` (Analyst Consensus), `finnhub-fundamentals` (Stock Fundamentals), `finnhub-market-status` (Market Status), `finnhub-insider-transactions` (Insider Transactions), `finnhub-insider-sentiment` (Insider Sentiment), `finnhub-ipo-calendar` (IPO Calendar), `finnhub-sec-filings` (SEC Filings), `finnhub-company-profile` (Company Profile)

**Channels:** `finnhub-quotes`, `finnhub-news`, `finnhub-company-news`, `finnhub-market-news`, `finnhub-earnings-calendar`, `finnhub-earnings-surprises`, `finnhub-analyst-consensus`, `finnhub-fundamentals`, `finnhub-market-status`, `finnhub-insider-transactions`, `finnhub-insider-sentiment`, `finnhub-ipo-calendar`, `finnhub-sec-filings`, `finnhub-company-profile`

**Required env vars:**
- `FINNHUB_TOKEN` — API key from [finnhub.io/dashboard](https://finnhub.io/docs/api/authentication)

**Optional env vars:**
- `FH_SYMBOLS` — comma-separated ticker symbols (e.g. `AAPL,MSFT`); required for company-news, earnings-surprises, analyst-consensus, fundamentals, insider-transactions, insider-sentiment, sec-filings, and company-profile channels
- `FH_NEWS_CATEGORY` — news category for the general news channel (default: `general`; options: `general`, `forex`, `crypto`, `merger`)

**Poll interval:** quotes/market-status: 1 min (`FINNHUB_POLL_MS` / `FH_MKTSTATUS_POLL_MS`); news/company-news/market-news: 5 min (`FH_NEWS_POLL_MS` / `FH_CNEWS_POLL_MS` / `FH_MKTNS_POLL_MS`); earnings-calendar/ipo-calendar/surprises/analyst-consensus/fundamentals/insider-tx/insider-sentiment/sec-filings: 1 h; company-profile: 6 h (`FH_PROFILE_POLL_MS`)

**Notes:** The 7 symbol-specific channels (`finnhub-company-news`, `finnhub-earnings-surprises`, `finnhub-analyst-consensus`, `finnhub-fundamentals`, `finnhub-insider-transactions`, `finnhub-insider-sentiment`, `finnhub-sec-filings`, `finnhub-company-profile`) are only registered when `FH_SYMBOLS` is set. Up to 5 symbols are processed per cycle. The market news channel fetches general, forex, and crypto categories in a single poll.

---

### Google Analytics (GA4)

> Surfaces GA4 session trends, top pages by pageview, and traffic source breakdowns.

**Tiles:** `ga4-sessions-trend` (Sessions Trend), `ga4-top-pages` (Top Pages), `ga4-traffic-sources` (Traffic Sources)

**Channels:** `ga4-sessions-trend`

**Required env vars:**
- `GA4_SERVICE_ACCOUNT_JSON` — Full JSON content of a Google service account key file with the `analytics.readonly` scope ([create service account](https://developers.google.com/analytics/devguides/reporting/data/v1/quickstart-client-libraries))
- `GA4_PROPERTY_ID` — GA4 property ID (numeric, found in Google Analytics Admin > Property Settings)

**Poll interval:** 1 h (overridable via `GA4_POLL_MS`)

**Notes:** The provider implements the JWT / service account OAuth2 flow directly using the Web Crypto API — no Google client library is required. The access token is cached and refreshed automatically. All three GA4 tiles consume data from the single `ga4-sessions-trend` channel which returns a 14-day time series.

---

### GitHub

> Surfaces GitHub Actions workflow run status across an organization or a user's repositories.

**Tiles:** `github-actions` (Workflow Runs)

**Channels:** `github-runs` (consumed by `github-actions` tile)

**Required env vars:**
- `GITHUB_TOKEN` — Personal access token or fine-grained token with `actions:read` scope ([create token](https://docs.github.com/en/authentication/keeping-your-account-and-data-safe/managing-your-personal-access-tokens))
- `GITHUB_ORG` — Organization slug (use this for org-level run access) **or** `GITHUB_USER` — GitHub username (fetches across owned repos)

**Optional env vars:**
- `GITHUB_WEBHOOK_SECRET` — Shared secret for validating incoming `POST /api/webhooks/github` payloads

**Poll interval:** 30 s (overridable via `GITHUB_POLL_MS`)

**Notes:** Webhook support is available at `POST /api/webhooks/github`; a push or workflow event triggers an immediate on-demand refresh of the `github-runs` channel. The provider is rate-limit aware: it tracks the `x-ratelimit-reset` header and serves stale cached data rather than failing when the limit is exceeded. For user-mode, repository fetches are batched in groups of 5 to avoid burst-rate violations, and up to 50 repositories are scanned.

---

### HackerNews

> Surfaces the top 30 HackerNews stories and enables keyword-based story monitoring.

**Tiles:** `hn-top-stories` (Top Stories), `hn-mentions` (Keyword Monitor)

**Channels:** `hn-top-stories` (consumed by both `hn-top-stories` and `hn-mentions` tiles)

**Required env vars:** None — uses the public HackerNews Firebase API.

**Poll interval:** 5 min (overridable via `HN_POLL_MS`)

**Notes:** This provider always polls regardless of whether any tile is configured (no env gate). Keyword filtering for the `hn-mentions` tile is performed client-side against the shared story feed. Both tiles share the single `hn-top-stories` channel.

---

### HaveIBeenPwned

> Checks configured email addresses against the HaveIBeenPwned breach database and lists recently published breaches.

**Tiles:** `hibp-breach-status` (Breach Status), `hibp-recent-breaches` (Recent Breaches)

**Channels:** `hibp-breaches` (consumed by both `hibp-breach-status` and `hibp-recent-breaches` tiles)

**Required env vars:**
- `HIBP_API_KEY` — API key from [haveibeenpwned.com/API/Key](https://haveibeenpwned.com/API/v3#Authorisation)
- `HIBP_EMAILS` — comma-separated email addresses to monitor

**Poll interval:** 6 h (overridable via `HIBP_POLL_MS`)

**Notes:** A 1.6 s delay is inserted between per-email requests to respect the HIBP rate limit. Both tiles consume the same channel payload which contains breach history keyed by email address.

---

### Instatus

> Surfaces an Instatus status page overview including component health and active incidents.

**Tiles:** `instatus-overview` (Status Page), `instatus-incidents` (Incidents)

**Channels:** `instatus-overview`

**Required env vars:**
- `INSTATUS_PAGE_ID` — Page ID (subdomain of your Instatus page, e.g. `mycompany` for `mycompany.instatus.com`, or the ID from the [Instatus API](https://instatus.com/help/api))

**Optional env vars:**
- `INSTATUS_API_KEY` — API key from [instatus.com/app/developer](https://instatus.com/developers); when omitted the provider uses the public `summary.json` endpoint

**Poll interval:** 1 min (overridable via `INSTATUS_POLL_MS`)

**Notes:** Without `INSTATUS_API_KEY` the provider calls `https://{INSTATUS_PAGE_ID}.instatus.com/summary.json`, which is publicly accessible. With an API key it calls the authenticated API and also returns active maintenance windows. Both tiles share the single `instatus-overview` channel.

---

### Jira

> Surfaces Jira issues, active sprint progress, and project listings using a configurable JQL query.

**Tiles:** `jira-issues` (Issues), `jira-sprint` (Sprint), `jira-projects` (Projects)

**Channels:** `jira-issues`

**Required env vars:**
- `JIRA_HOST` — Atlassian Cloud hostname, e.g. `mycompany.atlassian.net`
- `JIRA_EMAIL` — Atlassian account email address
- `JIRA_API_TOKEN` — API token from [id.atlassian.com/manage-profile/security/api-tokens](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/)

**Optional env vars:**
- `JIRA_JQL` — JQL query string (default: `assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC`)

**Poll interval:** 2 min (overridable via `JIRA_POLL_MS`)

**Notes:** All three Jira tiles consume the same `jira-issues` channel payload. The sprint and projects tiles derive their views from the issue data returned by the configured JQL query. Only the Jira Cloud REST API v3 is supported.

---

### jsDelivr

> Surfaces jsDelivr CDN request hit counts and bandwidth statistics for npm or GitHub packages.

**Tiles:** `jsdelivr-hits` (CDN Hits), `jsdelivr-versions` (Package Versions)

**Channels:** `jsdelivr-hits`

**Required env vars:**
- `JSDELIVR_PACKAGES` — comma-separated package identifiers; use bare names for npm packages (e.g. `lodash`) or `gh/owner/repo` for GitHub packages

**Poll interval:** 1 h (overridable via `JSDELIVR_POLL_MS`)

**Notes:** Uses the public jsDelivr statistics API at `data.jsdelivr.com`; no authentication required. Both tiles share the single `jsdelivr-hits` channel. The API returns yearly hit totals and a breakdown by date.

---

### Linear

> Surfaces open Linear issues, current cycle progress, and team overviews via the Linear GraphQL API.

**Tiles:** `linear-issues` (Issues), `linear-cycles` (Cycles), `linear-teams` (Teams)

**Channels:** `linear-issues`

**Required env vars:**
- `LINEAR_API_KEY` — Personal API key from [linear.app/settings/api](https://developers.linear.app/docs/graphql/working-with-the-graphql-api#personal-api-keys)

**Poll interval:** 2 min (overridable via `LINEAR_POLL_MS`)

**Notes:** Uses the Linear GraphQL API (`api.linear.app/graphql`). The query fetches 50 non-completed/non-cancelled issues ordered by last update. All three tiles consume the same `linear-issues` channel; the cycles and teams views are derived client-side from the issue payload.

---

### Mailchimp

> Surfaces recent Mailchimp email campaign performance including open rates and click rates, and audience subscriber stats.

**Tiles:** `mailchimp-campaigns` (Campaigns), `mailchimp-audience` (Audience)

**Channels:** `mailchimp-campaigns`

**Required env vars:**
- `MAILCHIMP_API_KEY` — API key from [mailchimp.com/account/api/](https://mailchimp.com/developer/marketing/guides/quick-start/) — the server suffix (e.g. `us14`) is extracted automatically from the key

**Poll interval:** 5 min (overridable via `MAILCHIMP_POLL_MS`)

**Notes:** The Mailchimp data center suffix is parsed from the `MAILCHIMP_API_KEY` string (everything after the last `-`). Both tiles share the single `mailchimp-campaigns` channel which returns the 25 most recent campaigns sorted by send time.

---

### Netlify

> Surfaces Netlify site deployment history across all sites in the account.

**Tiles:** `netlify-deployments` (Deployments)

**Channels:** `netlify-deployments`

**Required env vars:**
- `NETLIFY_TOKEN` — Personal access token from [app.netlify.com/user/applications/personal](https://docs.netlify.com/api/get-started/#authentication)

**Optional env vars:**
- `NETLIFY_WEBHOOK_SECRET` — Shared secret for validating `POST /api/webhooks/netlify` payloads (HMAC-SHA256)

**Poll interval:** 30 s (overridable via `NETLIFY_POLL_MS`)

**Notes:** The provider fetches the first 10 sites and the last 5 deployments per site (up to 5 sites). Webhook support is available at `POST /api/webhooks/netlify`; a deploy event triggers an immediate on-demand refresh. The optional `x-webhook-signature` header is verified against `NETLIFY_WEBHOOK_SECRET` when set.

---

### npm

> Surfaces npm package download counts (last month) and package metadata.

**Tiles:** `npm-downloads` (Downloads), `npm-metadata` (Package Info)

**Channels:** `npm-downloads`

**Required env vars:**
- `NPM_PACKAGES` — comma-separated npm package names (e.g. `lodash,react,express`)

**Poll interval:** 1 h (overridable via `NPM_POLL_MS`)

**Notes:** Uses the public npm downloads API (`api.npmjs.org`); no authentication required. Both tiles share the `npm-downloads` channel. The downloads channel returns monthly totals; the metadata view (versions, license, description) is fetched on-demand by the tile.

---

### PayPal

> Surfaces PayPal transaction history and account balances for the last 30 days.

**Tiles:** `paypal-transactions` (Transactions)

**Channels:** `paypal-data` (consumed by `paypal-transactions` tile)

**Required env vars:**
- `PAYPAL_CLIENT_ID` — App client ID from the [PayPal Developer Dashboard](https://developer.paypal.com/api/rest/)
- `PAYPAL_CLIENT_SECRET` — App client secret from the same dashboard

**Optional env vars:**
- `PAYPAL_ENV` — `sandbox` (default) or `live`
- `PAYPAL_WEBHOOK_SECRET` — Shared secret for validating `POST /api/webhooks/paypal` payloads (HMAC-SHA256)

**Poll interval:** 1 min (overridable via `PAYPAL_POLL_MS`)

**Notes:** Uses the OAuth2 client credentials flow; the access token is automatically cached and refreshed. Set `PAYPAL_ENV=live` to connect to production. Webhook support is available at `POST /api/webhooks/paypal`; a payment event triggers an on-demand refresh of the `paypal-data` channel.

---

### Plaid

> Surfaces bank account balances, transactions, investment portfolio holdings, investment transactions, liabilities (credit cards, mortgage, student loans), and account statements via Plaid's financial data network.

**Tiles:** `plaid-balances` (Account Balances), `plaid-transactions` (Transactions), `plaid-investment-portfolio` (Investment Portfolio), `plaid-investment-transactions` (Investment Transactions), `plaid-liabilities-overview` (Liabilities Overview), `plaid-credit-card-details` (Credit Card Details), `plaid-mortgage-tracker` (Mortgage Tracker), `plaid-statements` (Statements)

**Channels:** `plaid-accounts` (→ `plaid-balances` tile), `plaid-transactions`, `plaid-investment-portfolio`, `plaid-investment-transactions`, `plaid-liabilities-overview`, `plaid-credit-card-details`, `plaid-mortgage-tracker`, `plaid-statements`

**Required env vars:**
- `PLAID_CLIENT_ID` — Client ID from [dashboard.plaid.com/team/keys](https://plaid.com/docs/api/tokens/#link-token-create)
- `PLAID_SECRET` — Secret (environment-specific) from the same dashboard
- `PLAID_ACCESS_TOKEN` — Item access token obtained after completing the Plaid Link flow for a financial institution

**Optional env vars:**
- `PLAID_ENV` — `sandbox` (default), `development`, or `production`

**Poll interval:** accounts/transactions: 5 min (`PLAID_POLL_MS`); investment-portfolio/investment-transactions: 10 min (`PLAID_INV_POLL_MS` / `PLAID_INVTX_POLL_MS`); liabilities-overview/credit-card-details: 30 min (`PLAID_LIAB_POLL_MS` / `PLAID_CC_POLL_MS`); mortgage-tracker/statements: 1 h (`PLAID_MORT_POLL_MS` / `PLAID_STMT_POLL_MS`)

**Notes:** The `PLAID_ACCESS_TOKEN` must be obtained in advance by running a Plaid Link flow (not automated by this server). Use `PLAID_ENV=sandbox` with test credentials for development. Investment, liabilities, and statement endpoints require the corresponding Plaid products to be enabled on the item.

---

### Product Hunt

> Surfaces the top Product Hunt product launches of the day ranked by votes.

**Tiles:** `producthunt-top-launches` (Top Launches)

**Channels:** `producthunt-top-launches`

**Required env vars:**
- `PRODUCTHUNT_API_TOKEN` — Developer token from [api.producthunt.com/v2/oauth/applications](https://api.producthunt.com/v2/docs)

**Poll interval:** 1 h (overridable via `PH_POLL_MS`)

**Notes:** Uses the Product Hunt GraphQL API. The query fetches the top 20 posts by votes and includes thumbnail, topics, and author information.

---

### Reddit

> Surfaces hot posts from configured subreddits, with client-side support for keyword monitoring.

**Tiles:** `reddit-posts` (Posts — base), `reddit-hot-posts` (Hot Posts), `reddit-keyword-monitor` (Keyword Monitor)

**Channels:** `reddit-posts` (consumed by `reddit-posts`, `reddit-hot-posts`, and `reddit-keyword-monitor` tiles)

**Required env vars:** None — uses the public Reddit JSON API.

**Optional env vars:**
- `REDDIT_SUBREDDITS` — comma-separated subreddit names (fallback env var; used only when no tile in the database has a `subreddits` field configured)

**Poll interval:** 5 min (overridable via `REDDIT_POLL_MS`)

**Notes:** This provider always polls (no env gate). Subreddits are sourced at poll time from the `subreddits` field stored on Reddit tile configs in the layout database, spanning all users and workspaces. `REDDIT_SUBREDDITS` is only used as a fallback when no tile has that field set. Per-tile config fields: `subreddits` (comma-separated subreddit names) and `fetchLimit` (max posts to retrieve; shared across tiles in the DB). Keyword filtering for the `reddit-keyword-monitor` tile is applied client-side.

---

### RSS

> Displays any RSS 2.0 or Atom feed in a tile.

**Tiles:** `rss-feed` (RSS Feed)

**Channels:** None — on-demand only (no SSE poller).

**Required env vars:** None

**Poll interval:** N/A — the tile fetches on-demand at render time; responses are cached server-side for 5 min.

**Notes:** The feed URL and `maxItems` are configured per-tile (not via env vars). The server-side route `GET /api/rss/feed?url=<encoded_url>&maxItems=<n>` parses the XML and returns normalized `{ title, link, pubDate, summary }` items. Maximum `maxItems` is capped at 200.

---

### Shodan

> Surfaces internet-exposed services and port listings, and CVE vulnerability summaries, for a configured search query.

**Tiles:** `shodan-exposed-services` (Exposed Services), `shodan-vuln-summary` (Vulnerability Summary)

**Channels:** `shodan-search` (consumed by both `shodan-exposed-services` and `shodan-vuln-summary` tiles)

**Required env vars:**
- `SHODAN_API_KEY` — API key from [account.shodan.io](https://developer.shodan.io/api#introduction)

**Optional env vars:**
- `SHODAN_QUERY` — Shodan search query string (default: `apache`)

**Poll interval:** 1 h (overridable via `SHODAN_POLL_MS`)

**Notes:** Both tiles share the single `shodan-search` channel. The query result includes matched host data with service and port information. Shodan free accounts have limited search credits; consider longer poll intervals to preserve quota.

---

### Shopify

> Surfaces recent Shopify orders and the active product catalog.

**Tiles:** `shopify-orders` (Orders), `shopify-products` (Products)

**Channels:** `shopify-orders`, `shopify-products`

**Required env vars:**
- `SHOPIFY_SHOP` — Shop domain, e.g. `mystore.myshopify.com`
- `SHOPIFY_ACCESS_TOKEN` — Admin API access token from [partners.shopify.com](https://shopify.dev/docs/api/admin-rest) (custom app or private app)

**Poll interval:** orders: 2 min default (`SHOPIFY_POLL_MS` also affects products with a default of 10 min); products: 10 min (`SHOPIFY_POLL_MS`)

**Notes:** Uses the Shopify Admin REST API version `2024-07`. The orders endpoint fetches the last 25 orders with any status; the products endpoint fetches 25 active products. Both poll intervals respond to a single `SHOPIFY_POLL_MS` env var, but the code defaults differ (120 000 ms for orders, 600 000 ms for products).

---

### Slack

> Surfaces recent messages from Slack channels and workspace-level member/channel statistics.

**Tiles:** `slack-messages` (Messages), `slack-workspace-stats` (Workspace)

**Channels:** `slack-messages`

**Required env vars:**
- `SLACK_BOT_TOKEN` — Bot OAuth token (`xoxb-…`) from [api.slack.com/apps](https://api.slack.com/authentication/basics)

**Optional env vars:**
- `SLACK_CHANNELS` — comma-separated channel IDs (e.g. `C01234,C05678`); auto-discovers the first 3 public channels if not set

**Poll interval:** 30 s (overridable via `SLACK_POLL_MS`)

**Notes:** The bot must be invited to private channels before they can be monitored. Up to 3 channels are polled, with the last 10 messages each (30 messages total). Both tiles share the `slack-messages` channel.

---

### SonarQube

> Surfaces quality gate statuses, code metrics (bugs, coverage, vulnerabilities, duplication), and open issue lists from a SonarQube instance.

**Tiles:** `sonarqube-quality` (Quality Gates), `sonarqube-measures` (Code Measures), `sonarqube-issues` (Issues)

**Channels:** `sonarqube-quality`, `sonarqube-measures`, `sonarqube-issues`

**Required env vars:**
- `SONARQUBE_URL` — Base URL of the SonarQube instance (e.g. `https://sonarqube.mycompany.com`) or SonarCloud URL
- `SONARQUBE_TOKEN` — User or project token from SonarQube **Administration > Security > Tokens** ([docs](https://next.sonarqube.com/sonarqube/web_api))

**Poll interval:** 1 min (overridable via `SONARQUBE_POLL_MS`)

**Notes:** The quality channel scans up to 20 projects; the measures channel fetches 5 metrics (`bugs`, `vulnerabilities`, `code_smells`, `coverage`, `duplicated_lines_density`) for up to 5 projects; the issues channel returns open BLOCKER, CRITICAL, and MAJOR issues. Works with both self-hosted SonarQube and SonarCloud.

---

### Stripe

> Surfaces Stripe payments, revenue trend, subscriptions, customers, invoices, refunds, product catalog, and webhook event log with full CRUD support via the Stripe SDK.

**Tiles:** `stripe-payments` (Recent Payments), `stripe-revenue` (Revenue Trend), `stripe-orders` (Orders), `stripe-subscriptions` (Subscriptions), `stripe-customers` (Customers), `stripe-invoices` (Invoices), `stripe-refunds` (Refunds), `stripe-products` (Products), `stripe-webhooks` (Webhook Events)

**Channels:** `stripe-payments`, `stripe-products`, `stripe-subscriptions`, `stripe-customers`, `stripe-invoices`, `stripe-refunds`, `stripe-revenue`, `stripe-webhooks`

**Required env vars:**
- `STRIPE_SECRET_KEY` — Secret key (`sk_live_…` or `sk_test_…`) from [dashboard.stripe.com/apikeys](https://stripe.com/docs/keys)

**Optional env vars:**
- `STRIPE_WEBHOOK_SECRET` — Webhook signing secret (`whsec_…`) for validating `POST /api/webhooks/stripe` payloads
- `STRIPE_POLL_MS` — Poll interval for payments, refunds, and webhooks channels (default: 30 000 ms)
- `STRIPE_SLOW_POLL_MS` — Poll interval for products, subscriptions, customers, and invoices (default: 60 000 ms)
- `STRIPE_REVENUE_POLL_MS` — Poll interval for the revenue channel (default: 300 000 ms / 5 min)

**Poll interval:** payments/refunds/webhooks: 30 s; products/subscriptions/customers/invoices: 1 min; revenue: 5 min (see optional env vars above)

**Notes:** Webhook support is available at `POST /api/webhooks/stripe`. The provider also exposes extensive CRUD routes (create/update/delete products, capture/refund/cancel payments, create prices, update subscriptions, etc.) alongside the read routes. Order workflow statuses (new, processing, packing, shipped, done) are persisted locally in `api/order-statuses.db`.

---

### Travis CI

> Surfaces Travis CI build results for an organization.

**Tiles:** `travis-builds` (Builds)

**Channels:** `travis-builds`

**Required env vars:**
- `TRAVIS_TOKEN` — API token from [app.travis-ci.com/account/preferences](https://developer.travis-ci.com/authentication)
- `TRAVIS_ORG` — Travis CI organization or user slug (e.g. `myorg`)

**Poll interval:** 1 min (overridable via `TRAVIS_POLL_MS`)

**Notes:** Uses the Travis CI v3 API at `api.travis-ci.com`. The query fetches the last 25 builds with repository, branch, and commit details included.

---

### Vercel

> Surfaces Vercel project deployment history across all projects in the account or team.

**Tiles:** `vercel-deployments` (Deployments)

**Channels:** `vercel-deployments`

**Required env vars:**
- `VERCEL_TOKEN` — Personal access token from [vercel.com/account/tokens](https://vercel.com/docs/rest-api#authentication/token-overview)

**Optional env vars:**
- `VERCEL_TEAM_ID` — Team ID (e.g. `team_abc123`) to scope deployments to a specific team
- `VERCEL_WEBHOOK_SECRET` — Shared secret for validating `POST /api/webhooks/vercel` payloads (HMAC-SHA1)

**Poll interval:** 30 s (overridable via `VERCEL_POLL_MS`)

**Notes:** Webhook support is available at `POST /api/webhooks/vercel`; a deployment event triggers an on-demand refresh of the `vercel-deployments` channel. The optional `x-vercel-signature` header is verified using HMAC-SHA1 when `VERCEL_WEBHOOK_SECRET` is set. The provider fetches the last 20 deployments.

---

### VirusTotal

> Surfaces domain threat analysis reports including malicious/suspicious engine counts and reputation scores.

**Tiles:** `virustotal-domain-threats` (Domain Threats), `virustotal-url-scan` (URL Scanner)

**Channels:** `virustotal-analyses` (consumed by both `virustotal-domain-threats` and `virustotal-url-scan` tiles)

**Required env vars:**
- `VIRUSTOTAL_API_KEY` — API key from [virustotal.com/gui/my-apikey](https://developers.virustotal.com/reference/overview#authentication)
- `VT_DOMAINS` — comma-separated domain names to scan (e.g. `example.com,myapp.io`)

**Poll interval:** 24 h (overridable via `VT_POLL_MS`)

**Notes:** The free VirusTotal API tier allows 4 requests per minute. The provider inserts a 15 s delay between per-domain requests to stay within this limit. Both tiles share the single `virustotal-analyses` channel. The long 24 h default interval is intentional to conserve API quota.

---

### WakaTime

> Surfaces daily coding time summaries, language breakdowns, and per-project time distributions.

**Tiles:** `wakatime-summary` (Coding Time), `wakatime-languages` (Languages), `wakatime-projects` (Projects)

**Channels:** `wakatime-summary`

**Required env vars:**
- `WAKATIME_API_KEY` — API key from [wakatime.com/settings/api-key](https://wakatime.com/developers#authentication)

**Poll interval:** 5 min (overridable via `WAKATIME_POLL_MS`)

**Notes:** The API key is Base64-encoded and sent as Basic auth. The channel returns 7-day summary data. All three tiles consume the single `wakatime-summary` channel; the languages and projects breakdowns are extracted from the same summary payload.

---

### WooCommerce

> Surfaces WooCommerce order lists, 30-day sales KPIs, and best-selling product rankings from a self-hosted WordPress/WooCommerce store.

**Tiles:** `woocommerce-orders` (Orders), `woocommerce-sales-summary` (Sales Summary), `woocommerce-top-sellers` (Top Sellers)

**Channels:** `woocommerce-orders`, `woocommerce-sales-summary`, `woocommerce-top-sellers`

**Required env vars:**
- `WC_BASE_URL` — Base URL of the WordPress site (e.g. `https://myshop.com`)
- `WC_CONSUMER_KEY` — REST API consumer key generated in **WooCommerce > Settings > Advanced > REST API** ([docs](https://woocommerce.github.io/woocommerce-rest-api-docs/#authentication))
- `WC_CONSUMER_SECRET` — REST API consumer secret from the same screen

**Poll interval:** orders: 2 min default; sales-summary: 10 min default; top-sellers: 30 min default (all controlled via `WC_POLL_MS` env var override, which overrides all three when set)

**Notes:** Uses HTTP Basic authentication with the consumer key and secret. The sales summary endpoint queries the WooCommerce Reports API for a 30-day window. The top sellers endpoint uses the `month` period and returns up to 20 products. All three channels are independent pollers.
