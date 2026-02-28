#!/usr/bin/env bash
# webhook-test.sh — Send mock webhook payloads to the local TWM API server.
#
# Usage:
#   ./tools/webhook-test.sh [provider] [API_BASE]
#
#   provider: stripe | github | paypal | vercel | netlify | all  (default: all)
#   API_BASE: base URL of the API server                          (default: http://localhost:3001)
#
# Examples:
#   ./tools/webhook-test.sh               # fire all webhooks at localhost:3001
#   ./tools/webhook-test.sh stripe        # only Stripe
#   ./tools/webhook-test.sh vercel http://localhost:4000

set -euo pipefail

PROVIDER="${1:-all}"
API_BASE="${2:-http://localhost:3001}"

RED='\033[0;31m'
GRN='\033[0;32m'
YLW='\033[1;33m'
BLU='\033[0;34m'
RST='\033[0m'

ok()   { echo -e "  ${GRN}OK${RST}  $1"; }
err()  { echo -e "  ${RED}ERR${RST} $1"; }
info() { echo -e "${BLU}==>${RST} $1"; }

# ── Stripe ─────────────────────────────────────────────────────────────────────
test_stripe() {
  info "Stripe — payment_intent.succeeded"
  local endpoint="${API_BASE}/api/webhooks/stripe"
  local secret="${STRIPE_WEBHOOK_SECRET:-}"
  local ts
  ts=$(date +%s)

  local payload
  payload=$(cat <<'EOF'
{
  "id": "evt_test_webhook",
  "object": "event",
  "type": "payment_intent.succeeded",
  "created": 1700000000,
  "data": {
    "object": {
      "id": "pi_test_123",
      "object": "payment_intent",
      "amount": 2000,
      "currency": "usd",
      "status": "succeeded",
      "description": "Test payment from webhook-test.sh"
    }
  }
}
EOF
  )

  if [[ -n "$secret" ]]; then
    # Generate Stripe-Signature header using HMAC-SHA256
    local signed_payload="${ts}.${payload}"
    local sig
    sig=$(echo -n "$signed_payload" | openssl dgst -sha256 -hmac "$secret" | awk '{print $2}')
    local stripe_sig="t=${ts},v1=${sig}"
    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" \
      -X POST "$endpoint" \
      -H "Content-Type: application/json" \
      -H "Stripe-Signature: ${stripe_sig}" \
      -d "$payload")
    [[ "$status" == "200" ]] && ok "Stripe → HTTP $status" || err "Stripe → HTTP $status"
  else
    echo -e "  ${YLW}WARN${RST} STRIPE_WEBHOOK_SECRET not set — sending unsigned request"
    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" \
      -X POST "$endpoint" \
      -H "Content-Type: application/json" \
      -d "$payload")
    [[ "$status" == "200" ]] && ok "Stripe → HTTP $status (unsigned)" || err "Stripe → HTTP $status"
  fi

  info "Stripe — customer.subscription.created"
  local sub_payload
  sub_payload=$(cat <<'EOF'
{
  "id": "evt_test_sub",
  "object": "event",
  "type": "customer.subscription.created",
  "created": 1700000001,
  "data": {
    "object": {
      "id": "sub_test_123",
      "object": "subscription",
      "status": "active",
      "customer": "cus_test_123",
      "plan": { "id": "price_test", "amount": 999, "currency": "usd", "interval": "month" }
    }
  }
}
EOF
  )
  if [[ -n "$secret" ]]; then
    local ts2; ts2=$(date +%s)
    local sig2
    sig2=$(echo -n "${ts2}.${sub_payload}" | openssl dgst -sha256 -hmac "$secret" | awk '{print $2}')
    local status2
    status2=$(curl -s -o /dev/null -w "%{http_code}" \
      -X POST "$endpoint" \
      -H "Content-Type: application/json" \
      -H "Stripe-Signature: t=${ts2},v1=${sig2}" \
      -d "$sub_payload")
    [[ "$status2" == "200" ]] && ok "Stripe sub → HTTP $status2" || err "Stripe sub → HTTP $status2"
  else
    local status2
    status2=$(curl -s -o /dev/null -w "%{http_code}" \
      -X POST "$endpoint" \
      -H "Content-Type: application/json" \
      -d "$sub_payload")
    [[ "$status2" == "200" ]] && ok "Stripe sub → HTTP $status2 (unsigned)" || err "Stripe sub → HTTP $status2"
  fi
}

# ── GitHub ─────────────────────────────────────────────────────────────────────
test_github() {
  info "GitHub — workflow_run event"
  local endpoint="${API_BASE}/api/webhooks/github"
  local secret="${GITHUB_WEBHOOK_SECRET:-}"

  local payload
  payload=$(cat <<'EOF'
{
  "action": "completed",
  "workflow_run": {
    "id": 9999999,
    "name": "CI",
    "head_branch": "main",
    "head_sha": "abc1234",
    "run_number": 42,
    "event": "push",
    "status": "completed",
    "conclusion": "success",
    "html_url": "https://github.com/example/repo/actions/runs/9999999",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:01:00Z",
    "repository": { "full_name": "example/repo" }
  },
  "repository": { "full_name": "example/repo" }
}
EOF
  )

  if [[ -n "$secret" ]]; then
    local sig
    sig=$(echo -n "$payload" | openssl dgst -sha256 -hmac "$secret" | awk '{print $2}')
    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" \
      -X POST "$endpoint" \
      -H "Content-Type: application/json" \
      -H "X-GitHub-Event: workflow_run" \
      -H "X-Hub-Signature-256: sha256=${sig}" \
      -d "$payload")
    [[ "$status" == "200" ]] && ok "GitHub → HTTP $status" || err "GitHub → HTTP $status"
  else
    echo -e "  ${YLW}WARN${RST} GITHUB_WEBHOOK_SECRET not set — sending unsigned request"
    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" \
      -X POST "$endpoint" \
      -H "Content-Type: application/json" \
      -H "X-GitHub-Event: workflow_run" \
      -d "$payload")
    [[ "$status" == "200" ]] && ok "GitHub → HTTP $status (unsigned)" || err "GitHub → HTTP $status"
  fi
}

# ── PayPal ─────────────────────────────────────────────────────────────────────
test_paypal() {
  info "PayPal — PAYMENT.SALE.COMPLETED"
  local endpoint="${API_BASE}/api/webhooks/paypal"
  local secret="${PAYPAL_WEBHOOK_SECRET:-}"

  local payload
  payload=$(cat <<'EOF'
{
  "id": "WH-TEST-12345",
  "event_type": "PAYMENT.SALE.COMPLETED",
  "event_version": "1.0",
  "create_time": "2024-01-01T00:00:00Z",
  "resource_type": "sale",
  "resource": {
    "id": "SALE-TEST-001",
    "state": "completed",
    "amount": { "total": "19.99", "currency": "USD" },
    "create_time": "2024-01-01T00:00:00Z"
  }
}
EOF
  )

  if [[ -n "$secret" ]]; then
    local sig
    sig=$(echo -n "$payload" | openssl dgst -sha256 -hmac "$secret" -binary | base64)
    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" \
      -X POST "$endpoint" \
      -H "Content-Type: application/json" \
      -H "PayPal-Transmission-Sig: ${sig}" \
      -d "$payload")
    [[ "$status" == "200" ]] && ok "PayPal → HTTP $status" || err "PayPal → HTTP $status"
  else
    echo -e "  ${YLW}WARN${RST} PAYPAL_WEBHOOK_SECRET not set — sending unsigned request"
    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" \
      -X POST "$endpoint" \
      -H "Content-Type: application/json" \
      -d "$payload")
    [[ "$status" == "200" ]] && ok "PayPal → HTTP $status (unsigned)" || err "PayPal → HTTP $status"
  fi
}

# ── Vercel ─────────────────────────────────────────────────────────────────────
test_vercel() {
  info "Vercel — deployment.created"
  local endpoint="${API_BASE}/api/webhooks/vercel"
  local secret="${VERCEL_WEBHOOK_SECRET:-}"

  local payload
  payload=$(cat <<'EOF'
{
  "type": "deployment.created",
  "createdAt": 1700000000000,
  "payload": {
    "deployment": {
      "id": "dpl_test_123",
      "url": "test-deployment.vercel.app",
      "name": "my-project",
      "state": "BUILDING",
      "target": "production",
      "createdAt": 1700000000000
    },
    "project": { "id": "prj_test_123", "name": "my-project" },
    "team": { "id": "team_test_123", "slug": "my-team" }
  }
}
EOF
  )

  if [[ -n "$secret" ]]; then
    local sig
    sig=$(echo -n "$payload" | openssl dgst -sha1 -hmac "$secret" | awk '{print $2}')
    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" \
      -X POST "$endpoint" \
      -H "Content-Type: application/json" \
      -H "x-vercel-signature: ${sig}" \
      -d "$payload")
    [[ "$status" == "200" ]] && ok "Vercel → HTTP $status" || err "Vercel → HTTP $status"
  else
    echo -e "  ${YLW}WARN${RST} VERCEL_WEBHOOK_SECRET not set — sending unsigned request"
    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" \
      -X POST "$endpoint" \
      -H "Content-Type: application/json" \
      -d "$payload")
    [[ "$status" == "200" ]] && ok "Vercel → HTTP $status (unsigned)" || err "Vercel → HTTP $status"
  fi
}

# ── Netlify ────────────────────────────────────────────────────────────────────
test_netlify() {
  info "Netlify — deploy_created"
  local endpoint="${API_BASE}/api/webhooks/netlify"
  local secret="${NETLIFY_WEBHOOK_SECRET:-}"

  local payload
  payload=$(cat <<'EOF'
{
  "event": "deploy_created",
  "id": "dpl-test-123",
  "site_id": "site-test-123",
  "branch": "main",
  "deploy_ssl_url": "https://my-site.netlify.app",
  "state": "building",
  "created_at": "2024-01-01T00:00:00.000Z",
  "published_at": null,
  "deploy_time": null
}
EOF
  )

  if [[ -n "$secret" ]]; then
    local sig
    sig=$(echo -n "$payload" | openssl dgst -sha256 -hmac "$secret" | awk '{print $2}')
    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" \
      -X POST "$endpoint" \
      -H "Content-Type: application/json" \
      -H "X-Webhook-Signature: ${sig}" \
      -d "$payload")
    [[ "$status" == "200" ]] && ok "Netlify → HTTP $status" || err "Netlify → HTTP $status"
  else
    echo -e "  ${YLW}WARN${RST} NETLIFY_WEBHOOK_SECRET not set — sending unsigned request"
    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" \
      -X POST "$endpoint" \
      -H "Content-Type: application/json" \
      -d "$payload")
    [[ "$status" == "200" ]] && ok "Netlify → HTTP $status (unsigned)" || err "Netlify → HTTP $status"
  fi
}

# ── Main ───────────────────────────────────────────────────────────────────────
echo ""
echo "Webhook Test Script"
echo "API: ${API_BASE}"
echo "-----------------------------------"

case "$PROVIDER" in
  stripe)  test_stripe  ;;
  github)  test_github  ;;
  paypal)  test_paypal  ;;
  vercel)  test_vercel  ;;
  netlify) test_netlify ;;
  all)
    test_stripe
    test_github
    test_paypal
    test_vercel
    test_netlify
    ;;
  *)
    echo "Unknown provider: $PROVIDER"
    echo "Usage: $0 [stripe|github|paypal|vercel|netlify|all] [API_BASE]"
    exit 1
    ;;
esac

echo "-----------------------------------"
echo "Done."
