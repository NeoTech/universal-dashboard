#!/bin/sh
# docker/ngrok-entrypoint.sh
#
# Wrapper for the official ngrok/ngrok Docker image.
# Supports an optional static domain via NGROK_DOMAIN (paid ngrok plans).
# NGROK_AUTHTOKEN is picked up automatically by the ngrok binary from env.

set -e

if [ -n "$NGROK_DOMAIN" ]; then
  echo "[ngrok] using static domain: $NGROK_DOMAIN"
  exec /ngrok http --url="$NGROK_DOMAIN" traefik:80 --log-level=info
else
  echo "[ngrok] requesting an ephemeral tunnel..."
  exec /ngrok http traefik:80 --log-level=info
fi
