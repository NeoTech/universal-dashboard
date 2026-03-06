# Tiling Window Manager Dashboard

A self-hosted developer dashboard that aggregates live data from 35+ API providers into a freely-arrangeable tiled canvas. Data is streamed to the browser in real time via Server-Sent Events (SSE) from a built-in Bun API server. Tiles are persisted per workspace and update automatically — no manual refresh needed.

Built with SolidJS + Bun. Ships as a single all-in-one container: static frontend, API server, Traefik reverse proxy, and an optional ngrok tunnel for public access.

---

## What is inside the image

The image is compiled from a multi-stage build that produces four self-contained binaries and a static frontend bundle:

| Component | Binary | Listens on |
|---|---|---|
| API server (Bun) | `bin/server` | `3001` (internal) |
| Static frontend server | `bin/frontend` | `5187` (internal) |
| Traefik reverse proxy | `bin/traefik` | `8080` (web), `8081` (admin) |
| ngrok tunnel (optional) | `bin/ngrok` | `4040` (inspector) |
| Process supervisor | `bin/supervisor` | — entrypoint — |

The supervisor starts all four processes, monitors their health, and is the container's single entrypoint (`ENTRYPOINT ["/app/bin/supervisor"]`). The base image is `gcr.io/distroless/base-debian12:nonroot` — minimal attack surface, no shell.

### Internal traffic routing

```
Browser
  └── Traefik :8080
        ├── /api/*  /health  /ws  →  Bun API    :3001
        └── /                     →  Frontend   :5187

Optional:
  ngrok tunnel → Traefik :8080
```

---

## Quick start

```sh
# 1. Pull the image
docker pull neotech/universal-dashboard

# 2. Create an env file from the example (see variable reference below)
cp .env.example .env

# 3. Run
docker run -d \
  --env-file .env \
  -p 8080:8080 \
  -p 8081:8081 \
  -v $(pwd)/data:/data \
  neotech/universal-dashboard
```

Or with Docker Compose (recommended):

```yaml
services:
  dashboard:
    image: neotech/universal-dashboard
    env_file: .env
    ports:
      - "8080:8080"   # app
      - "8081:8081"   # traefik admin
    volumes:
      - ./data:/data
    restart: unless-stopped
```

Open **http://localhost:8080** for the dashboard and **http://localhost:8081** for the Traefik admin panel.

---

## Docker Compose — full example

```yaml
services:
  dashboard:
    image: neotech/universal-dashboard
    env_file: .env
    environment:
      # --- Networking (defaults shown, override if needed) ---
      API_HOST: "0.0.0.0"
      API_PORT: "3001"
      FRONTEND_PORT: "5187"
      TRAEFIK_WEB_PORT: "8080"
      TRAEFIK_ADMIN_PORT: "8081"

      # --- Persistence ---
      AUTH_DB_PATH: "/data/auth.db"
      FLINT_DB_PATH: "/data/flint-cache.db"
      ORDER_STATUS_DB_PATH: "/data/order-statuses.db"

      # --- MCP (LLM agent integration) ---
      MCP_ENABLED: "true"
      MCP_AUTH_REQUIRED: "false"

      # --- Auth (pass from .env) ---
      AUTH_ENABLED: "${AUTH_ENABLED}"
      JWT_SECRET: "${JWT_SECRET}"

      # --- Optional: public tunnel ---
      NGROK_AUTHTOKEN: "${NGROK_AUTHTOKEN}"
      NGROK_DOMAIN: "${NGROK_DOMAIN}"

      # --- Providers (add only those you use) ---
      STRIPE_SECRET_KEY: "${STRIPE_SECRET_KEY}"
      STRIPE_WEBHOOK_SECRET: "${STRIPE_WEBHOOK_SECRET}"
      GITHUB_TOKEN: "${GITHUB_TOKEN}"
      CF_API_TOKEN: "${CF_API_TOKEN}"
      CF_ACCOUNT_ID: "${CF_ACCOUNT_ID}"
    ports:
      - "8080:8080"
      - "8081:8081"
      - "4040:4040"   # ngrok web inspector (optional)
    volumes:
      - ./data:/data  # persists auth.db and cache databases
    restart: unless-stopped
```

---

## Exposed ports

| Port | Purpose |
|---|---|
| `8080` | Main app (Traefik web entry point) |
| `8081` | Traefik admin dashboard |
| `4040` | ngrok web inspector (only active when `NGROK_AUTHTOKEN` is set) |

---

## Volumes

| Mount path | Purpose |
|---|---|
| `/data` | Persists SQLite databases: `auth.db` (users/sessions), `flint-cache.db` (tile cache), `order-statuses.db` (e-commerce status tracking). Without this volume, all state is lost on container restart. |

---

## Environment variable reference

The server starts fine with no variables set. Provider tiles activate only when their required credentials are present. Variables already in the process environment take priority over `.env`.

### Core / networking

| Variable | Default | Description |
|---|---|---|
| `API_HOST` | `0.0.0.0` | Bind address for the API server. Use `127.0.0.1` to restrict to localhost. |
| `API_PORT` | `3001` | Internal port for the Bun API server. |
| `FRONTEND_PORT` | `5187` | Internal port for the static frontend server. |
| `TRAEFIK_WEB_PORT` | `8080` | Traefik web entry point (the public-facing port). |
| `TRAEFIK_ADMIN_PORT` | `8081` | Traefik admin/dashboard port. |
| `BACKEND_BASE_URL` | _(empty)_ | Prepended to relative URLs when the REST-tile proxy target is a relative path. |
| `VITE_API_URL` | _(empty)_ | Overrides the API base URL used by the browser. Leave unset in normal operation. |

### Authentication

| Variable | Default | Description |
|---|---|---|
| `AUTH_ENABLED` | `false` | Set to `true` to require login before accessing the dashboard. |
| `JWT_SECRET` | _(random, ephemeral)_ | Secret used to sign JWT session tokens. Must be set to a stable value to preserve sessions across restarts. |
| `AUTH_PROVIDER` | `local` | `local` (username/password) or `saml` (SSO via SAML 2.0). |
| `APP_URL` | _(origin of callback URL)_ | Public URL of the frontend. Required for SAML login redirect and when running behind ngrok. |
| `SAML_IDP_METADATA_PATH` | _(unset)_ | Path to IdP XML metadata file (Google Workspace, Okta, Azure AD). Takes priority over `SAML_ENTRY_POINT`. |
| `SAML_ENTRY_POINT` | _(unset)_ | IdP Single Sign-On URL. Required for SAML when metadata file is not provided. |
| `SAML_CERT` | _(unset)_ | IdP X.509 certificate body (base64, without PEM headers). Not needed when using `SAML_IDP_METADATA_PATH`. |
| `SAML_CALLBACK_URL` | `http://localhost:3001/api/auth/saml/callback` | Assertion Consumer Service URL registered with the IdP. |
| `SAML_ISSUER` | `tiling-window-manager` | Entity ID / Audience URI. Must match the value configured in the IdP. |

### Persistence (database paths)

| Variable | Default | Description |
|---|---|---|
| `AUTH_DB_PATH` | `./auth.db` | Path to the SQLite file for user accounts and sessions. |
| `FLINT_DB_PATH` | `./flint-cache.db` | Path to the Flint tile-cache SQLite database. |
| `ORDER_STATUS_DB_PATH` | `./order-statuses.db` | Path to the order-status tracking SQLite database. |

### MCP (LLM agent integration)

| Variable | Default | Description |
|---|---|---|
| `MCP_ENABLED` | `false` | Activates the Model Context Protocol endpoint (`/api/mcp`). Allows LLM agents to query and control the dashboard. |
| `MCP_AUTH_REQUIRED` | _(mirrors `AUTH_ENABLED`)_ | Whether MCP tool calls require a valid JWT. |

### Public tunnel (ngrok)

| Variable | Default | Description |
|---|---|---|
| `NGROK_AUTHTOKEN` | _(unset)_ | ngrok auth token. When set, the supervisor starts ngrok and routes `TRAEFIK_WEB_PORT` through a public tunnel. |
| `NGROK_DOMAIN` | _(ephemeral subdomain)_ | Static ngrok domain (paid plans). |

### Webhook secrets

| Variable | Provider |
|---|---|
| `GITHUB_WEBHOOK_SECRET` | GitHub (`POST /api/webhooks/github`) |
| `VERCEL_WEBHOOK_SECRET` | Vercel (`POST /api/webhooks/vercel`) |
| `NETLIFY_WEBHOOK_SECRET` | Netlify (`POST /api/webhooks/netlify`) |
| `PAYPAL_WEBHOOK_SECRET` | PayPal (`POST /api/webhooks/paypal`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe (`POST /api/webhooks/stripe`) |

### Provider credentials

Only set what you need. Omitted providers simply show a "not configured" state in the tile.

| Provider | Required variables |
|---|---|
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (optional) |
| PayPal | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV` (`sandbox`/`live`) |
| GitHub | `GITHUB_TOKEN`, `GITHUB_ORG` or `GITHUB_USER` |
| Cloudflare | `CF_API_TOKEN`, `CF_ACCOUNT_ID` |
| Vercel | `VERCEL_TOKEN`, `VERCEL_TEAM_ID` (optional) |
| Netlify | `NETLIFY_TOKEN` |
| CircleCI | `CIRCLECI_TOKEN`, `CIRCLECI_ORG_SLUG` |
| Travis CI | `TRAVIS_TOKEN`, `TRAVIS_ORG` |
| Bitrise | `BITRISE_TOKEN` |
| Docker Hub | `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` (optional, private repos) |
| SonarQube | `SONARQUBE_TOKEN`, `SONARQUBE_URL`, `SONARQUBE_PROJECT_KEY` |
| Azure DevOps | `AZURE_DEVOPS_ORG`, `AZURE_DEVOPS_TOKEN`, `AZURE_DEVOPS_PROJECT` (optional) |
| npm / jsDelivr | `NPM_PACKAGES`, `JSDELIVR_PACKAGES` (comma-separated) |
| WakaTime | `WAKATIME_API_KEY` |
| Clockify | `CLOCKIFY_API_KEY`, `CLOCKIFY_WORKSPACE_ID` |
| Linear | `LINEAR_API_KEY` |
| Jira | `JIRA_HOST`, `JIRA_EMAIL`, `JIRA_API_TOKEN` |
| Slack | `SLACK_BOT_TOKEN`, `SLACK_CHANNELS` (optional) |
| Discord | `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_IDS` (optional) |
| Mailchimp | `MAILCHIMP_API_KEY` |
| Google Analytics (GA4) | `GA4_PROPERTY_ID`, `GA4_SERVICE_ACCOUNT_JSON` |
| Instatus | `INSTATUS_PAGE_ID`, `INSTATUS_API_KEY` |
| HackerNews | _(no key required)_ |
| Alpha Vantage | `ALPHA_VANTAGE_KEY`, `AV_SYMBOLS` |
| CoinGecko | `COINGECKO_COINS` _(no key required for public tier)_ |
| Finnhub | `FINNHUB_TOKEN`, `FH_SYMBOLS` |
| Plaid | `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ACCESS_TOKEN` |
| HaveIBeenPwned | `HIBP_API_KEY`, `HIBP_EMAILS` |
| VirusTotal | `VIRUSTOTAL_API_KEY`, `VT_DOMAINS` |
| Shodan | `SHODAN_API_KEY`, `SHODAN_QUERY` |
| WooCommerce | `WC_BASE_URL`, `WC_CONSUMER_KEY`, `WC_CONSUMER_SECRET` |
| Shopify | `SHOPIFY_SHOP`, `SHOPIFY_ACCESS_TOKEN` |
| Reddit | `REDDIT_SUBREDDITS` _(no key required)_ |
| Product Hunt | `PRODUCTHUNT_API_TOKEN` |

### Poll intervals

All providers have a corresponding `*_POLL_MS` variable that controls how often the server fetches fresh data and pushes it to SSE clients. Defaults are conservative; lower values increase API usage.

| Variable | Default | Applies to |
|---|---|---|
| `STRIPE_POLL_MS` | `30000` (30 s) | Stripe payments, refunds, webhooks |
| `STRIPE_SLOW_POLL_MS` | `60000` (1 min) | Stripe products, subscriptions, invoices |
| `STRIPE_REVENUE_POLL_MS` | `300000` (5 min) | Stripe revenue chart |
| `GITHUB_POLL_MS` | `30000` (30 s) | GitHub Actions runs |
| `CF_PAGES_POLL_MS` | `60000` (1 min) | Cloudflare Pages |
| `CF_WORKERS_POLL_MS` | `120000` (2 min) | Cloudflare Workers |
| `PAYPAL_POLL_MS` | `60000` (1 min) | PayPal transactions |
| `VERCEL_POLL_MS` | `30000` (30 s) | Vercel deployments |
| `NETLIFY_POLL_MS` | `30000` (30 s) | Netlify deploys |
| `CIRCLECI_POLL_MS` | `60000` (1 min) | CircleCI pipelines |
| `BITRISE_POLL_MS` | `60000` (1 min) | Bitrise builds |
| `DOCKERHUB_POLL_MS` | `300000` (5 min) | Docker Hub image stats |
| `AZURE_POLL_MS` | `60000` (1 min) | Azure DevOps |
| `NPM_POLL_MS` | `3600000` (1 h) | npm download stats |
| `WAKATIME_POLL_MS` | `300000` (5 min) | WakaTime coding stats |
| `CLOCKIFY_POLL_MS` | `300000` (5 min) | Clockify time entries |
| `LINEAR_POLL_MS` | `120000` (2 min) | Linear issues |
| `JIRA_POLL_MS` | `120000` (2 min) | Jira issues |
| `SLACK_POLL_MS` | `30000` (30 s) | Slack messages |
| `DISCORD_POLL_MS` | `300000` (5 min) | Discord activity |
| `GA4_POLL_MS` | `3600000` (1 h) | Google Analytics 4 |
| `CG_POLL_MS` | `300000` (5 min) | CoinGecko prices |
| `FINNHUB_POLL_MS` | `60000` (1 min) | Finnhub quotes |
| `HIBP_POLL_MS` | `21600000` (6 h) | HaveIBeenPwned checks |
| `VT_POLL_MS` | `86400000` (24 h) | VirusTotal domain reports |
| `REDDIT_POLL_MS` | `300000` (5 min) | Reddit post feeds |

---

## Registering webhooks

When ngrok is enabled, use your public tunnel URL for inbound webhook endpoints:

| Provider | Webhook URL |
|---|---|
| Stripe | `<public-url>/api/webhooks/stripe` |
| GitHub | `<public-url>/api/webhooks/github` |
| Vercel | `<public-url>/api/webhooks/vercel` |
| Netlify | `<public-url>/api/webhooks/netlify` |
| PayPal | `<public-url>/api/webhooks/paypal` |

For SAML SSO over a public tunnel:

```dotenv
APP_URL=https://your-ngrok-domain.ngrok.app
SAML_CALLBACK_URL=https://your-ngrok-domain.ngrok.app/api/auth/saml/callback
```

---

## Runtime poll-interval overrides

Poll intervals can be adjusted at runtime without restarting the container via the `PATCH /api/poll-settings` endpoint. Changes are written back to `poll-settings.json` and persist across restarts.

```sh
# Change Reddit polling to 60 seconds while the container is running
curl -X PATCH http://localhost:8080/api/poll-settings \
  -H 'Content-Type: application/json' \
  -d '{"intervals": {"reddit-posts": 60000}}'

# Pause a channel that is driven by webhooks instead
curl -X PATCH http://localhost:8080/api/poll-settings \
  -H 'Content-Type: application/json' \
  -d '{"paused": ["stripe-payments"]}'
```

---

## License

Elastic License 2.0. Free to use for internal and personal deployments. Commercial SaaS redistribution requires a separate agreement.
