# Docker deployment guide

Run the local app as a single all-in-one container (frontend + backend + Traefik + optional ngrok).

## Architecture

```
Browser
  └── Traefik :8080 (inside container)
        ├── /api/* /health /ws  →  Bun API :3001
        └── /                   →  static frontend :5187

Optional:
ngrok tunnel → Traefik :8080
```

## Prerequisites

- Docker Desktop (Windows/macOS) or Docker Engine + Compose v2 (Linux)
- Optional: ngrok authtoken if you want public access

## Quick start

```sh
# 1) Copy env template
cp .env.example .env

# 2) (optional) enable ngrok tunnel
# NGROK_AUTHTOKEN=your_authtoken_here

# 3) Build + run all-in-one container
docker compose -f docker-compose.all-in-one.yml up --build
```

## Local URLs

- App: `http://localhost:8080`
- Traefik dashboard: `http://localhost:8081`
- ngrok inspector (when enabled): `http://localhost:4040`

## Environment variables

`docker-compose.all-in-one.yml` uses `env_file: .env` and includes commented placeholder overrides in `environment:`.

Commonly used keys:

- `NGROK_AUTHTOKEN`, `NGROK_DOMAIN`
- `AUTH_ENABLED`, `JWT_SECRET`, `APP_URL`, `SAML_CALLBACK_URL`
- `FLINT_FUNCTION_URL`, `FLINT_AUTH_EMAIL`, `FLINT_AUTH_TOKEN`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

## Registering webhooks

If ngrok is enabled, use your public ngrok URL:

- Stripe: `<public-url>/api/webhooks/stripe`
- GitHub: `<public-url>/api/webhooks/github`
- Vercel: `<public-url>/api/webhooks/vercel`
- Netlify: `<public-url>/api/webhooks/netlify`

For SAML over tunnel, set:

```dotenv
APP_URL=https://your-public-url
SAML_CALLBACK_URL=https://your-public-url/api/auth/saml/callback
```

## Stop / rebuild

```sh
docker compose -f docker-compose.all-in-one.yml down
docker compose -f docker-compose.all-in-one.yml up --build
```
