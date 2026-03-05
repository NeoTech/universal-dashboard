FROM oven/bun:1 AS build
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY src/ ./src/
COPY fixtures/ ./fixtures/
COPY e2e/ ./e2e/
COPY public/ ./public/
COPY api/ ./api/
COPY docker/ ./docker/
COPY index.html ./
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY traefik.local.yml ./
COPY traefik.local.routes.yml ./

# Build browser assets
RUN bun run build

# Compile backend, frontend static server and supervisor to linux binaries
RUN bun build ./api/server.ts --compile --target=bun-linux-x64 --outfile /tmp/server
RUN bun build ./docker/static-server.ts --compile --target=bun-linux-x64 --outfile /tmp/frontend
RUN bun build ./docker/supervisor.ts --compile --target=bun-linux-x64 --outfile /tmp/supervisor

FROM traefik:v3 AS traefik-bin
FROM ngrok/ngrok:latest AS ngrok-bin
RUN cp "$(command -v ngrok)" /tmp/ngrok

FROM gcr.io/distroless/base-debian12:nonroot
WORKDIR /app

COPY --from=build /app/dist ./dist
COPY --from=build /app/traefik.local.yml ./traefik.local.yml
COPY --from=build /app/traefik.local.routes.yml ./traefik.local.routes.yml

COPY --from=build /tmp/server ./bin/server
COPY --from=build /tmp/frontend ./bin/frontend
COPY --from=build /tmp/supervisor ./bin/supervisor
COPY --from=traefik-bin /usr/local/bin/traefik ./bin/traefik
COPY --from=ngrok-bin /tmp/ngrok ./bin/ngrok

ENV API_HOST=0.0.0.0
ENV API_PORT=3001
ENV FRONTEND_PORT=5187
ENV TRAEFIK_WEB_PORT=8080
ENV TRAEFIK_ADMIN_PORT=8081

EXPOSE 8080 8081 4040

ENTRYPOINT ["/app/bin/supervisor"]
