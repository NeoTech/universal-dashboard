# Environment Variables Reference

## Overview

The API server loads environment variables from a `.env` file in the project root using Bun's built-in dotenv support (`--env-file .env` is passed automatically via the `bun run api` script). Variables already present in the process environment take precedence over the file.

**Setup:**

1. Copy `.env.example` to `.env` in the project root:
   ```
   cp .env.example .env
   ```
2. Fill in the credentials for the providers you want to use.
3. Leave any provider section commented out if you do not need it — the server starts fine without those credentials and simply will not serve data for unconfigured providers.

The `.env.example` file is the authoritative template. It is checked into version control and kept in sync with the server code. Never commit your real `.env` file.

---

## Quick-Start Minimum

The server starts with zero configuration. No environment variables are strictly required to bring the API up. However, the following are strongly recommended before you rely on any authenticated features:

| Variable | Why |
|---|---|
| `JWT_SECRET` | Without this, a random secret is generated on every restart, invalidating all existing login sessions. |
| `AUTH_ENABLED` | Set to `true` if you want login to be enforced. Defaults to `false` (open access). |

To run with only the dashboard shell and no provider tiles, an empty `.env` file (or no file at all) is sufficient:

```sh
# Minimal .env — dashboard only, no login required, no provider data
API_PORT=3001
```

---

## Complete Reference

### Core / Server

| Name | Required | Default | Description | Example Value |
|---|---|---|---|---|
| `API_PORT` | No | `3001` | Port the API HTTP server listens on. | `3001` |
| `API_HOST` | No | `0.0.0.0` | Bind address. Use `127.0.0.1` to restrict to localhost only. | `0.0.0.0` |
| `FIXTURES_PORT` | No | `8080` | Port for the fixture/static server used in development and tests. | `8080` |
| `VITE_API_URL` | No | _(empty — uses Vite proxy)_ | Overrides the API base URL used by the browser. Leave unset in local dev so requests go through the Vite dev-server proxy at `localhost:3001`. | `http://localhost:3001` |
| `BACKEND_BASE_URL` | No | _(empty)_ | Prepended to relative URLs when the REST-tile proxy target is a relative path. | `http://my-internal-service:8000` |
| `STRIPE_API_URL` | No | `https://api.stripe.com` | Override the Stripe API base URL — useful with the Stripe CLI local dev server. | `http://localhost:12111` |
| `GITHUB_API_URL` | No | `https://api.github.com` | Override the GitHub API base URL — useful for GitHub Enterprise. | `https://github.example.com/api/v3` |
| `CLOUDFLARE_API_URL` | No | `https://api.cloudflare.com/client/v4` | Override the Cloudflare API base URL. | `https://api.cloudflare.com/client/v4` |
| `PAYPAL_API_URL` | No | _(empty — determined by `PAYPAL_ENV`)_ | Override the PayPal API base URL. When set, this takes priority over `PAYPAL_ENV`. | `https://api-m.sandbox.paypal.com` |
| `NGROK_AUTHTOKEN` | No | — | Required for the Docker Compose stack (`docker compose up --build`). Obtain from the ngrok dashboard. | `2abc...` |
| `NGROK_DOMAIN` | No | _(random ephemeral subdomain)_ | Reserved static ngrok domain (paid plans only). | `your-subdomain.ngrok.app` |
| `TRAEFIK_DASHBOARD_PORT` | No | `8090` | Port for the Traefik management dashboard when running the Docker Compose stack. | `8090` |

---

### Authentication (JWT and SAML)

| Name | Required | Default | Description | Example Value |
|---|---|---|---|---|
| `AUTH_ENABLED` | No | `false` | Set to `true` to require login before accessing the dashboard. | `true` |
| `JWT_SECRET` | Recommended when `AUTH_ENABLED=true` | _(random, ephemeral)_ | Secret used to sign JWT session tokens. Must be stable across restarts to preserve sessions. Use a long random string. | `replace_with_a_long_random_secret` |
| `AUTH_PROVIDER` | No | `local` | Authentication provider. `local` uses a username/password stored in `auth.db`. `saml` delegates login to an external identity provider via SAML 2.0 SSO. | `saml` |
| `APP_URL` | No | _(origin of `SAML_CALLBACK_URL`)_ | Public URL where the Vite frontend (port 8080) is reachable. After SAML login, the browser is redirected to `APP_URL/?token=<jwt>`. In local dev use `http://localhost:8080`. For ngrok, use the ngrok tunnel URL pointing at port 8080. | `http://localhost:8080` |
| `SAML_IDP_METADATA_PATH` | No (SAML Option A) | _(unset)_ | Path to the XML metadata file exported from your IdP (Google Workspace, Okta, Azure AD). Takes priority over `SAML_ENTRY_POINT` and `SAML_CERT` when set. Can be relative to the project root or an absolute path. | `GoogleIDPMetadata.xml` |
| `SAML_ENTRY_POINT` | No (SAML Option B) | _(unset)_ | The IdP Single Sign-On URL that receives the AuthnRequest. Required when `AUTH_PROVIDER=saml` and `SAML_IDP_METADATA_PATH` is not set. | `https://accounts.google.com/o/saml2/idp?idpid=...` |
| `SAML_ISSUER` | No | `tiling-window-manager` | Entity ID / Audience URI. Must exactly match the value configured in the IdP. | `tiling-window-manager` |
| `SAML_CERT` | No (SAML Option B) | _(unset)_ | IdP X.509 certificate — the base64 body without `-----BEGIN/END CERTIFICATE-----` headers. Not needed when `SAML_IDP_METADATA_PATH` is set (the cert is parsed from the XML). | _(base64 cert body)_ |
| `SAML_CALLBACK_URL` | No | `http://localhost:3001/api/auth/saml/callback` | Assertion Consumer Service (ACS) URL. Must match the callback URL registered with the IdP. For ngrok, use the public ngrok URL pointing at port 8080 (Vite proxies `/api/*` internally). | `http://localhost:8080/api/auth/saml/callback` |
| `GITHUB_WEBHOOK_SECRET` | No | _(unset)_ | HMAC-SHA256 secret for verifying incoming GitHub webhooks at `POST /api/webhooks/github` (`X-Hub-Signature-256` header). | `your_github_webhook_secret` |
| `VERCEL_WEBHOOK_SECRET` | No | _(unset)_ | HMAC-SHA1 secret for verifying incoming Vercel webhooks (`x-vercel-signature` header). | `your_vercel_webhook_secret` |
| `NETLIFY_WEBHOOK_SECRET` | No | _(unset)_ | HMAC-SHA256 secret for verifying incoming Netlify webhooks (`X-Webhook-Signature` header). | `your_netlify_webhook_secret` |
| `PAYPAL_WEBHOOK_SECRET` | No | _(unset)_ | Shared secret for verifying incoming PayPal webhooks (HMAC-SHA256 via `paypal-transmission-sig` header). | `your_paypal_webhook_secret` |

---

### MCP (Model Context Protocol)

| Name | Required | Default | Description | Example Value |
|---|---|---|---|---|
| `MCP_ENABLED` | No | `false` | Set to `true` to activate the MCP server endpoint (`GET /api/mcp` for SSE, `POST /api/mcp` for HTTP). Allows LLM agents to query and control the dashboard. | `true` |
| `MCP_AUTH_REQUIRED` | No | _(value of `AUTH_ENABLED`)_ | Whether MCP tool calls (`add_tile`, `remove_tile`, etc.) require a valid JWT. Defaults to the value of `AUTH_ENABLED` when not explicitly set. | `true` |

---

### Stripe

| Name | Required | Default | Description | Example Value |
|---|---|---|---|---|
| `STRIPE_SECRET_KEY` | Yes (for Stripe tiles) | — | Stripe secret API key. Use a test key (`sk_test_...`) for development. | `sk_test_your_key_here` |
| `STRIPE_WEBHOOK_SECRET` | No | — | Webhook signing secret for verifying Stripe webhook events. | `whsec_your_secret_here` |
| `STRIPE_API_URL` | No | `https://api.stripe.com` | Override the Stripe API base URL. See Core/Server section. | `http://localhost:12111` |
| `STRIPE_POLL_MS` | No | `30000` | Poll interval (ms) for fast Stripe resources: payments, refunds, webhooks. | `30000` |
| `STRIPE_SLOW_POLL_MS` | No | `60000` | Poll interval (ms) for slower Stripe resources: products, subscriptions, customers, invoices. | `60000` |
| `STRIPE_REVENUE_POLL_MS` | No | `300000` | Poll interval (ms) for the Stripe revenue chart. | `300000` |

---

### PayPal

| Name | Required | Default | Description | Example Value |
|---|---|---|---|---|
| `PAYPAL_CLIENT_ID` | Yes (for PayPal tiles) | — | PayPal REST API client ID. | `your_paypal_client_id` |
| `PAYPAL_CLIENT_SECRET` | Yes (for PayPal tiles) | — | PayPal REST API client secret. | `your_paypal_client_secret` |
| `PAYPAL_ENV` | No | `sandbox` | PayPal environment. `sandbox` uses `api-m.sandbox.paypal.com`; `live` uses `api-m.paypal.com`. Ignored when `PAYPAL_API_URL` is set. | `live` |
| `PAYPAL_API_URL` | No | _(determined by `PAYPAL_ENV`)_ | Override the PayPal API base URL. Takes priority over `PAYPAL_ENV`. | `https://api-m.sandbox.paypal.com` |
| `PAYPAL_WEBHOOK_SECRET` | No | — | Webhook secret for verifying PayPal events. See Authentication section. | `your_paypal_webhook_secret` |
| `PAYPAL_POLL_MS` | No | `60000` | Poll interval (ms) for PayPal transactions and balance. | `60000` |

---

### GitHub

| Name | Required | Default | Description | Example Value |
|---|---|---|---|---|
| `GITHUB_TOKEN` | Yes (for GitHub tiles) | — | Personal access token with `read:org` and `workflow` scopes minimum. | `ghp_your_token` |
| `GITHUB_USER` | No | — | GitHub username. Used when `GITHUB_ORG` is not set. | `username` |
| `GITHUB_ORG` | No | — | GitHub organization slug. Takes priority over `GITHUB_USER` when both are set. | `your-org` |
| `GITHUB_API_URL` | No | `https://api.github.com` | Override the GitHub API base URL for GitHub Enterprise. | `https://github.example.com/api/v3` |
| `GITHUB_WEBHOOK_SECRET` | No | — | Webhook secret for verifying incoming GitHub events. See Authentication section. | `your_github_webhook_secret` |
| `GITHUB_POLL_MS` | No | `30000` | Poll interval (ms) for GitHub Actions workflow runs. | `30000` |

---

### Cloudflare

| Name | Required | Default | Description | Example Value |
|---|---|---|---|---|
| `CF_API_TOKEN` | Yes (for Cloudflare tiles) | — | Cloudflare API token with Account:Read, Pages:Read, and Workers Scripts:Read permissions. | `your_cloudflare_api_token` |
| `CF_ACCOUNT_ID` | Yes (for Cloudflare tiles) | — | Cloudflare account ID. | `your_account_id` |
| `CLOUDFLARE_API_URL` | No | `https://api.cloudflare.com/client/v4` | Override the Cloudflare API base URL. See Core/Server section. | `https://api.cloudflare.com/client/v4` |
| `CF_PAGES_POLL_MS` | No | `60000` | Poll interval (ms) for Cloudflare Pages projects. | `60000` |
| `CF_WORKERS_POLL_MS` | No | `120000` | Poll interval (ms) for Cloudflare Workers scripts. | `120000` |

---

### Vercel

| Name | Required | Default | Description | Example Value |
|---|---|---|---|---|
| `VERCEL_TOKEN` | Yes (for Vercel tiles) | — | Vercel personal access token or team token. | `your_vercel_token` |
| `VERCEL_TEAM_ID` | No | — | Vercel team ID. Required for team-scoped deployments. | `team_abc123` |
| `VERCEL_WEBHOOK_SECRET` | No | — | Signing secret for verifying Vercel webhook events. See Authentication section. | `your_vercel_webhook_secret` |
| `VERCEL_POLL_MS` | No | `30000` | Poll interval (ms) for Vercel deployments. | `30000` |

---

### Netlify

| Name | Required | Default | Description | Example Value |
|---|---|---|---|---|
| `NETLIFY_TOKEN` | Yes (for Netlify tiles) | — | Netlify personal access token. | `your_netlify_token` |
| `NETLIFY_WEBHOOK_SECRET` | No | — | JWT secret for verifying Netlify webhook events. See Authentication section. | `your_netlify_webhook_secret` |
| `NETLIFY_POLL_MS` | No | `30000` | Poll interval (ms) for Netlify deploys. | `30000` |

---

### CircleCI

| Name | Required | Default | Description | Example Value |
|---|---|---|---|---|
| `CIRCLECI_TOKEN` | Yes (for CircleCI tiles) | — | CircleCI personal API token. | `your_circleci_token` |
| `CIRCLECI_ORG_SLUG` | Yes (for CircleCI tiles) | — | Organization slug, e.g. `gh/your-org` or `bb/your-org`. | `gh/your-org` |
| `CIRCLECI_POLL_MS` | No | `60000` | Poll interval (ms) for CircleCI pipeline runs. | `60000` |

---

### Travis CI

| Name | Required | Default | Description | Example Value |
|---|---|---|---|---|
| `TRAVIS_TOKEN` | Yes (for Travis CI tiles) | — | Travis CI API token. | `your_travis_token` |
| `TRAVIS_ORG` | Yes (for Travis CI tiles) | — | Travis CI organization or username. | `your-org` |
| `TRAVIS_POLL_MS` | No | `60000` | Poll interval (ms) for Travis CI builds. | `60000` |

---

### Bitrise

| Name | Required | Default | Description | Example Value |
|---|---|---|---|---|
| `BITRISE_TOKEN` | Yes (for Bitrise tiles) | — | Bitrise personal access token. | `your_bitrise_personal_access_token` |
| `BITRISE_POLL_MS` | No | `60000` | Poll interval (ms) for Bitrise builds. | `60000` |

---

### Docker Hub

| Name | Required | Default | Description | Example Value |
|---|---|---|---|---|
| `DOCKERHUB_USERNAME` | Yes (for Docker Hub tiles) | — | Docker Hub username. | `your_dockerhub_username` |
| `DOCKERHUB_TOKEN` | No | — | Docker Hub access token. Optional; required only for private repositories. | `your_dockerhub_access_token` |
| `DOCKERHUB_POLL_MS` | No | `300000` | Poll interval (ms) for Docker Hub image data. | `300000` |

---

### SonarQube

| Name | Required | Default | Description | Example Value |
|---|---|---|---|---|
| `SONARQUBE_URL` | No | `https://sonarcloud.io` | Base URL of the SonarQube or SonarCloud instance. | `https://sonarqube.example.com` |
| `SONARQUBE_TOKEN` | Yes (for SonarQube tiles) | — | SonarQube user token. | `your_sonarqube_token` |
| `SONARQUBE_PROJECT_KEY` | Yes (for SonarQube tiles) | — | Project key to fetch quality metrics for. | `your_project_key` |
| `SONARQUBE_POLL_MS` | No | `120000` | Poll interval (ms) for SonarQube metrics. | `120000` |

---

### Azure DevOps

| Name | Required | Default | Description | Example Value |
|---|---|---|---|---|
| `AZURE_DEVOPS_ORG` | Yes (for Azure DevOps tiles) | — | Azure DevOps organization name. | `your-org` |
| `AZURE_DEVOPS_TOKEN` | Yes (for Azure DevOps tiles) | — | Azure DevOps personal access token (PAT). | `your_azure_pat` |
| `AZURE_DEVOPS_PROJECT` | No | — | Azure DevOps project name. Required for releases and work items. | `your-project` |
| `AZURE_POLL_MS` | No | `60000` | Poll interval (ms) for Azure DevOps pipelines and work items. | `60000` |

---

### npm / jsDelivr

| Name | Required | Default | Description | Example Value |
|---|---|---|---|---|
| `NPM_PACKAGES` | Yes (for npm tiles) | — | Comma-separated list of npm package names to track. | `express,lodash,react` |
| `NPM_POLL_MS` | No | `3600000` | Poll interval (ms) for npm package download stats. | `3600000` |
| `JSDELIVR_PACKAGES` | Yes (for jsDelivr tiles) | — | Comma-separated list of jsDelivr package specs to track. | `npm/express,npm/lodash` |
| `JSDELIVR_POLL_MS` | No | `3600000` | Poll interval (ms) for jsDelivr CDN stats. | `3600000` |

---

### WakaTime / Clockify

| Name | Required | Default | Description | Example Value |
|---|---|---|---|---|
| `WAKATIME_API_KEY` | Yes (for WakaTime tiles) | — | WakaTime API key from your account settings. | `your_wakatime_api_key` |
| `WAKATIME_POLL_MS` | No | `300000` | Poll interval (ms) for WakaTime coding stats. | `300000` |
| `CLOCKIFY_API_KEY` | Yes (for Clockify tiles) | — | Clockify API key from your profile. | `your_clockify_api_key` |
| `CLOCKIFY_WORKSPACE_ID` | Yes (for Clockify tiles) | — | Clockify workspace ID. | `your_workspace_id` |
| `CLOCKIFY_USER_ID` | No | _(current user)_ | Clockify user ID. Defaults to the token owner when not set. | `your_user_id` |
| `CLOCKIFY_POLL_MS` | No | `300000` | Poll interval (ms) for Clockify time entries. | `300000` |

---

### Linear / Jira

| Name | Required | Default | Description | Example Value |
|---|---|---|---|---|
| `LINEAR_API_KEY` | Yes (for Linear tiles) | — | Linear personal API key (prefix `lin_api_`). | `lin_api_your_key` |
| `LINEAR_POLL_MS` | No | `120000` | Poll interval (ms) for Linear issues. | `120000` |
| `JIRA_HOST` | Yes (for Jira tiles) | — | Jira Cloud hostname. | `your-org.atlassian.net` |
| `JIRA_EMAIL` | Yes (for Jira tiles) | — | Email address of the Jira user associated with the API token. | `you@example.com` |
| `JIRA_API_TOKEN` | Yes (for Jira tiles) | — | Jira API token generated from your Atlassian account. | `your_jira_api_token` |
| `JIRA_JQL` | No | — | JQL filter applied when fetching issues. | `project = MY_PROJECT AND status != Done` |
| `JIRA_POLL_MS` | No | `120000` | Poll interval (ms) for Jira issues. | `120000` |

---

### Slack / Discord

| Name | Required | Default | Description | Example Value |
|---|---|---|---|---|
| `SLACK_BOT_TOKEN` | Yes (for Slack tiles) | — | Slack bot token (prefix `xoxb-`). The bot must be added to the channels you want to monitor. | `xoxb-your-bot-token` |
| `SLACK_CHANNELS` | No | — | Comma-separated Slack channel IDs to monitor. Auto-discovered from the bot's joined channels (up to 5) if not set. | `C012345678,C087654321` |
| `SLACK_POLL_MS` | No | `30000` | Poll interval (ms) for Slack channel messages. | `30000` |
| `DISCORD_BOT_TOKEN` | Yes (for Discord tiles) | — | Discord bot token. The bot must have the Message Content intent enabled. | `your_discord_bot_token` |
| `DISCORD_GUILD_IDS` | No | — | Comma-separated Discord server (guild) IDs to monitor. Auto-discovered from the bot's guild list (up to 5) if not set. | `123456789,987654321` |
| `DISCORD_POLL_MS` | No | `300000` | Poll interval (ms) for Discord server activity. | `300000` |

---

### Mailchimp

| Name | Required | Default | Description | Example Value |
|---|---|---|---|---|
| `MAILCHIMP_API_KEY` | Yes (for Mailchimp tiles) | — | Mailchimp API key. The key includes the datacenter suffix (e.g. `abc123-us1`). | `abc123-us1` |
| `MAILCHIMP_POLL_MS` | No | `300000` | Poll interval (ms) for Mailchimp audience and campaign stats. | `300000` |

---

### Google Analytics (GA4)

| Name | Required | Default | Description | Example Value |
|---|---|---|---|---|
| `GA4_PROPERTY_ID` | Yes (for GA4 tiles) | — | GA4 numeric property ID (not the measurement ID). | `123456789` |
| `GA4_SERVICE_ACCOUNT_JSON` | Yes (for GA4 tiles) | — | Google service account credentials as inline JSON. The service account must have the Analytics Viewer role on the property. | `{"type":"service_account","project_id":"..."}` |
| `GA4_POLL_MS` | No | `3600000` | Poll interval (ms) for GA4 analytics data. | `3600000` |

---

### Instatus

| Name | Required | Default | Description | Example Value |
|---|---|---|---|---|
| `INSTATUS_PAGE_ID` | Yes (for Instatus tiles) | — | Instatus status page ID. | `your_page_id` |
| `INSTATUS_API_KEY` | Yes (for Instatus tiles) | — | Instatus API key from your account. | `your_instatus_api_key` |
| `INSTATUS_POLL_MS` | No | `60000` | Poll interval (ms) for Instatus component and incident data. | `60000` |

---

### HackerNews

No API key is required. The HackerNews provider uses the public Firebase API.

| Name | Required | Default | Description | Example Value |
|---|---|---|---|---|
| `HN_POLL_MS` | No | `300000` | Poll interval (ms) for HackerNews top stories. | `300000` |

---

### Alpha Vantage

| Name | Required | Default | Description | Example Value |
|---|---|---|---|---|
| `ALPHA_VANTAGE_KEY` | Yes (for Alpha Vantage tiles) | — | Alpha Vantage API key. Free tier is limited to 5 requests/minute and 500 requests/day. | `your_alphavantage_api_key` |
| `AV_SYMBOLS` | Yes (for Alpha Vantage tiles) | — | Comma-separated stock ticker symbols to fetch. | `AAPL,TSLA,MSFT` |
| `AV_POLL_MS` | No | `3600000` | Poll interval (ms) for Alpha Vantage quote data. Set conservatively to avoid hitting the free-tier rate limit. | `3600000` |

---

### CoinGecko

No API key is required for the public tier.

| Name | Required | Default | Description | Example Value |
|---|---|---|---|---|
| `COINGECKO_COINS` | Yes (for CoinGecko tiles) | — | Comma-separated CoinGecko coin IDs to fetch. | `bitcoin,ethereum,solana` |
| `CG_POLL_MS` | No | `300000` | Poll interval (ms) for CoinGecko price data. | `300000` |

---

### Finnhub

| Name | Required | Default | Description | Example Value |
|---|---|---|---|---|
| `FINNHUB_TOKEN` | Yes (for Finnhub tiles) | — | Finnhub API token. | `your_finnhub_api_token` |
| `FH_SYMBOLS` | Yes (for Finnhub tiles) | — | Comma-separated stock ticker symbols to fetch. | `AAPL,TSLA,MSFT` |
| `FINNHUB_POLL_MS` | No | `60000` | Poll interval (ms) for Finnhub quote data. | `60000` |

---

### Plaid

| Name | Required | Default | Description | Example Value |
|---|---|---|---|---|
| `PLAID_CLIENT_ID` | Yes (for Plaid tiles) | — | Plaid client ID from the Plaid dashboard. | `your_plaid_client_id` |
| `PLAID_SECRET` | Yes (for Plaid tiles) | — | Plaid secret for the selected environment. | `your_plaid_secret` |
| `PLAID_ACCESS_TOKEN` | Yes (for Plaid tiles) | — | Plaid access token obtained during the Link flow. | `access-sandbox-your-token` |
| `PLAID_ENV` | No | `sandbox` | Plaid environment. One of `sandbox`, `development`, or `production`. | `production` |
| `PLAID_POLL_MS` | No | `300000` | Poll interval (ms) for Plaid transaction and balance data. | `300000` |

---

### HaveIBeenPwned

| Name | Required | Default | Description | Example Value |
|---|---|---|---|---|
| `HIBP_API_KEY` | Yes (for HIBP tiles) | — | HaveIBeenPwned API key from the HIBP website. | `your_hibp_api_key` |
| `HIBP_EMAILS` | Yes (for HIBP tiles) | — | Comma-separated email addresses to monitor for breaches. | `user@example.com,admin@example.com` |
| `HIBP_POLL_MS` | No | `21600000` | Poll interval (ms) for breach checks. Defaults to 6 hours; the API rate-limits to 1 request per 1.5 seconds per email. | `21600000` |

---

### VirusTotal

| Name | Required | Default | Description | Example Value |
|---|---|---|---|---|
| `VIRUSTOTAL_API_KEY` | Yes (for VirusTotal tiles) | — | VirusTotal API key. Free tier is limited to 4 requests/minute. | `your_virustotal_api_key` |
| `VT_DOMAINS` | Yes (for VirusTotal tiles) | — | Comma-separated domain names to scan. | `example.com,another.com` |
| `VT_POLL_MS` | No | `86400000` | Poll interval (ms) for VirusTotal domain reports. Defaults to 24 hours to avoid exceeding the free-tier rate limit. | `86400000` |

---

### Shodan

| Name | Required | Default | Description | Example Value |
|---|---|---|---|---|
| `SHODAN_API_KEY` | Yes (for Shodan tiles) | — | Shodan API key from your account. | `your_shodan_api_key` |
| `SHODAN_QUERY` | Yes (for Shodan tiles) | — | Shodan search query used to fetch results. | `org:YourOrg` |
| `SHODAN_POLL_MS` | No | `3600000` | Poll interval (ms) for Shodan search results. | `3600000` |

---

### WooCommerce / Shopify

| Name | Required | Default | Description | Example Value |
|---|---|---|---|---|
| `WC_BASE_URL` | Yes (for WooCommerce tiles) | — | Base URL of the WooCommerce store. | `https://your-store.com` |
| `WC_CONSUMER_KEY` | Yes (for WooCommerce tiles) | — | WooCommerce REST API consumer key. | `ck_your_consumer_key` |
| `WC_CONSUMER_SECRET` | Yes (for WooCommerce tiles) | — | WooCommerce REST API consumer secret. | `cs_your_consumer_secret` |
| `WC_POLL_MS` | No | `120000` | Poll interval (ms) for WooCommerce order and product data. | `120000` |
| `SHOPIFY_SHOP` | Yes (for Shopify tiles) | — | Shopify store hostname. | `your-store.myshopify.com` |
| `SHOPIFY_ACCESS_TOKEN` | Yes (for Shopify tiles) | — | Shopify Admin API access token (prefix `shpat_`). | `shpat_your_access_token` |
| `SHOPIFY_POLL_MS` | No | `120000` | Poll interval (ms) for Shopify order and product data. | `120000` |

---

### Reddit

No API key is required. This provider uses the public Reddit JSON API.

| Name | Required | Default | Description | Example Value |
|---|---|---|---|---|
| `REDDIT_SUBREDDITS` | No | — | Comma-separated subreddit names. Acts as a server-level fallback; individual tiles can override this with their own `subreddits` tile config. | `programming,webdev` |
| `REDDIT_KEYWORDS` | No | — | Optional keyword filter applied to post titles. Leave empty to disable filtering. | `typescript` |
| `REDDIT_POLL_MS` | No | `300000` | Poll interval (ms) for Reddit post feeds. | `300000` |

---

### Product Hunt

| Name | Required | Default | Description | Example Value |
|---|---|---|---|---|
| `PRODUCTHUNT_API_TOKEN` | Yes (for Product Hunt tiles) | — | Product Hunt API token from the developer dashboard. | `your_producthunt_api_token` |
| `PH_POLL_MS` | No | `3600000` | Poll interval (ms) for Product Hunt daily launches. | `3600000` |

---

### Polling Intervals

All `*_POLL_MS` variables control how often the API server pushes fresh data to connected SSE clients. Tiles themselves do not poll — the server streams updates to all connected browsers via Server-Sent Events.

The table below is a consolidated reference of every interval variable:

| Variable | Default (ms) | Default (human) | Applies to |
|---|---|---|---|
| `STRIPE_POLL_MS` | `30000` | 30 s | Stripe payments, refunds, webhooks |
| `STRIPE_SLOW_POLL_MS` | `60000` | 1 min | Stripe products, subscriptions, customers, invoices |
| `STRIPE_REVENUE_POLL_MS` | `300000` | 5 min | Stripe revenue chart |
| `GITHUB_POLL_MS` | `30000` | 30 s | GitHub Actions workflow runs |
| `CF_PAGES_POLL_MS` | `60000` | 1 min | Cloudflare Pages projects |
| `CF_WORKERS_POLL_MS` | `120000` | 2 min | Cloudflare Workers scripts |
| `PAYPAL_POLL_MS` | `60000` | 1 min | PayPal transactions and balance |
| `VERCEL_POLL_MS` | `30000` | 30 s | Vercel deployments |
| `NETLIFY_POLL_MS` | `30000` | 30 s | Netlify deploys |
| `CIRCLECI_POLL_MS` | `60000` | 1 min | CircleCI pipeline runs |
| `TRAVIS_POLL_MS` | `60000` | 1 min | Travis CI builds |
| `BITRISE_POLL_MS` | `60000` | 1 min | Bitrise builds |
| `DOCKERHUB_POLL_MS` | `300000` | 5 min | Docker Hub image stats |
| `SONARQUBE_POLL_MS` | `120000` | 2 min | SonarQube quality metrics |
| `AZURE_POLL_MS` | `60000` | 1 min | Azure DevOps pipelines and work items |
| `NPM_POLL_MS` | `3600000` | 1 h | npm package download stats |
| `JSDELIVR_POLL_MS` | `3600000` | 1 h | jsDelivr CDN stats |
| `WAKATIME_POLL_MS` | `300000` | 5 min | WakaTime coding stats |
| `CLOCKIFY_POLL_MS` | `300000` | 5 min | Clockify time entries |
| `LINEAR_POLL_MS` | `120000` | 2 min | Linear issues |
| `JIRA_POLL_MS` | `120000` | 2 min | Jira issues |
| `SLACK_POLL_MS` | `30000` | 30 s | Slack channel messages |
| `DISCORD_POLL_MS` | `300000` | 5 min | Discord server activity |
| `MAILCHIMP_POLL_MS` | `300000` | 5 min | Mailchimp campaign and audience stats |
| `GA4_POLL_MS` | `3600000` | 1 h | Google Analytics 4 data |
| `INSTATUS_POLL_MS` | `60000` | 1 min | Instatus component and incident data |
| `HN_POLL_MS` | `300000` | 5 min | HackerNews top stories |
| `AV_POLL_MS` | `3600000` | 1 h | Alpha Vantage stock quotes |
| `CG_POLL_MS` | `300000` | 5 min | CoinGecko crypto prices |
| `FINNHUB_POLL_MS` | `60000` | 1 min | Finnhub stock quotes |
| `PLAID_POLL_MS` | `300000` | 5 min | Plaid transaction and balance data |
| `HIBP_POLL_MS` | `21600000` | 6 h | HaveIBeenPwned breach checks |
| `VT_POLL_MS` | `86400000` | 24 h | VirusTotal domain reports |
| `SHODAN_POLL_MS` | `3600000` | 1 h | Shodan search results |
| `WC_POLL_MS` | `120000` | 2 min | WooCommerce order and product data |
| `SHOPIFY_POLL_MS` | `120000` | 2 min | Shopify order and product data |
| `REDDIT_POLL_MS` | `300000` | 5 min | Reddit post feeds |
| `PH_POLL_MS` | `3600000` | 1 h | Product Hunt daily launches |

---

## poll-settings.json

`poll-settings.json` (in the project root) provides a runtime override mechanism for poll intervals and other SSE channel behaviours. It is read by the API server on start-up and can be updated at runtime through the `PATCH /api/poll-settings` endpoint — no restart required.

The file has three top-level keys:

### `paused`

An array of SSE channel names whose polling the server should suspend. A paused channel stops emitting events until it is removed from this list. This is useful when you are using webhook delivery for a channel instead of polling (e.g. Stripe events arriving via `POST /api/webhooks/stripe`) and do not want redundant duplicate refreshes.

```json
"paused": [
  "stripe-payments",
  "stripe-subscriptions"
]
```

### `intervals`

An object mapping an SSE channel name to a poll interval in milliseconds. Values here override the corresponding `*_POLL_MS` environment variable at runtime without restarting the server.

```json
"intervals": {
  "reddit-posts": 300000
}
```

### `webhookChannels`

An array of SSE channel names that are expected to receive data via inbound webhooks rather than by active polling. The server records these so that UI clients can display the correct status (webhook-driven vs. polling) on the tile.

```json
"webhookChannels": [
  "stripe-payments",
  "stripe-subscriptions"
]
```

### Runtime API

Send a `PATCH /api/poll-settings` request with a JSON body containing any of the three keys above to merge updates into the current settings. The server writes the result back to `poll-settings.json` so changes persist across restarts.

```sh
curl -X PATCH http://localhost:3001/api/poll-settings \
  -H 'Content-Type: application/json' \
  -d '{"intervals": {"reddit-posts": 60000}}'
```
