#!/bin/sh

set -eu

echo "[all-in-one] starting backend on :${API_PORT}"
bun run ./dist/server.js &
API_PID=$!

echo "[all-in-one] starting frontend static server on :${FRONTEND_PORT}"
PORT="${FRONTEND_PORT}" bun run ./docker/static-server.ts &
FRONTEND_PID=$!

echo "[all-in-one] starting Traefik on :${TRAEFIK_WEB_PORT} (admin :${TRAEFIK_ADMIN_PORT})"
traefik --configFile=/app/traefik.local.yml &
TRAEFIK_PID=$!

NGROK_PID=""
if [ -n "${NGROK_AUTHTOKEN:-}" ]; then
  if [ -n "${NGROK_DOMAIN:-}" ]; then
    echo "[all-in-one] starting ngrok with static domain ${NGROK_DOMAIN}"
    ngrok http --url="${NGROK_DOMAIN}" "http://127.0.0.1:${TRAEFIK_WEB_PORT}" --log=stdout &
  else
    echo "[all-in-one] starting ngrok (ephemeral URL)"
    ngrok http "http://127.0.0.1:${TRAEFIK_WEB_PORT}" --log=stdout &
  fi
  NGROK_PID=$!
else
  echo "[all-in-one] NGROK_AUTHTOKEN not set; skipping ngrok"
fi

term_handler() {
  echo "[all-in-one] shutting down"
  [ -n "${NGROK_PID}" ] && kill "${NGROK_PID}" 2>/dev/null || true
  kill "${TRAEFIK_PID}" 2>/dev/null || true
  kill "${FRONTEND_PID}" 2>/dev/null || true
  kill "${API_PID}" 2>/dev/null || true
}

trap term_handler INT TERM

wait -n "${API_PID}" "${FRONTEND_PID}" "${TRAEFIK_PID}" ${NGROK_PID:-}
EXIT_CODE=$?
term_handler
exit "${EXIT_CODE}"