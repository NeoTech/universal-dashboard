# Docker deployment guide

Deploy the full TWM stack (dashboard + API + reverse proxy + public tunnel) with a single command.

## Architecture

```
Browser
  └── ngrok (public HTTPS URL)
        └── Traefik :80
              ├── /api/*   /health  →  api container  :3001
              └── /*                →  dashboard container  :8080
```

The SolidJS frontend is a pre-built static SPA. It makes relative `/api/*` requests which Traefik routes to the API container — no origin-switching, no CORS, no `VITE_API_URL` needed.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine + Compose v2
- An [ngrok account](https://dashboard.ngrok.com/signup) (free tier is fine)
- Your `NGROK_AUTHTOKEN` from <https://dashboard.ngrok.com/get-started/your-authtoken>

## Quick start

```sh
# 1. Copy the example env file and fill in your keys
cp .env.example .env

# Required for the tunnel — everything else is optional
echo "NGROK_AUTHTOKEN=your_authtoken_here" >> .env

# 2. Build images and start all services
docker compose up --build

# 3. Watch the output — the ngrok-url service prints the public URL:
#
#   ┌─────────────────────────────────────────────┐
#   │  TWM is publicly accessible at:             │
#   │  https://abc123.ngrok-free.app              │
#   │                                             │
#   │  Webhook base URL:                          │
#   │  https://abc123.ngrok-free.app/api/webhooks/│
#   └─────────────────────────────────────────────┘
```

Open the printed URL in a browser. The Traefik dashboard is available at <http://localhost:8090>.

## Registering webhooks

Once you have the public URL, register it with your providers:

| Provider | Webhook URL |
|----------|-------------|
| Stripe | `<public-url>/api/webhooks/stripe` |
| GitHub | `<public-url>/api/webhooks/github` |
| Vercel | `<public-url>/api/webhooks/vercel` |
| Netlify | `<public-url>/api/webhooks/netlify` |

The `APP_URL` in `.env` should also be set to the public URL when using SAML SSO:

```dotenv
APP_URL=https://abc123.ngrok-free.app
SAML_CALLBACK_URL=https://abc123.ngrok-free.app/api/auth/saml/callback
```

## Static domain (paid ngrok plans)

If you have a reserved domain, set it in `.env`:

```dotenv
NGROK_DOMAIN=your-subdomain.ngrok.app
```

The ngrok entrypoint script picks this up automatically and passes `--url` to the tunnel command.

## Persisting data across container restarts

By default, `auth.db` (user accounts) and `poll-settings.json` (tile poll state) live inside the API container and are lost when it is recreated. To persist them, add bind mounts to the `api` service in `docker-compose.yml`:

```yaml
  api:
    # ...
    volumes:
      - ./auth.db:/app/auth.db
      - ./poll-settings.json:/app/poll-settings.json
```

Then create the files on the host before the first run:

```sh
touch auth.db poll-settings.json
```

## SAML IdP metadata

If you use SAML SSO, the IdP metadata XML file needs to be mounted into the API container:

```yaml
  api:
    volumes:
      - ./GoogleIDPMetadata.xml:/app/GoogleIDPMetadata.xml:ro
```

Set `SAML_IDP_METADATA_PATH=GoogleIDPMetadata.xml` in `.env` (relative to the API container's `/app` directory, but the constant in server.ts resolves relative to `api/server.ts` — so the path should be `../GoogleIDPMetadata.xml` in the container, or use an absolute path).

## Stopping

```sh
docker compose down          # stop and remove containers (images kept)
docker compose down --rmi local --volumes  # full cleanup
```

## Rebuilding after code changes

```sh
docker compose up --build    # rebuilds only layers that changed
```

## Traefik dashboard

The Traefik management UI is available at <http://localhost:8090> (or whatever port `TRAEFIK_DASHBOARD_PORT` is set to). It shows live routing rules, service health, and request statistics.
