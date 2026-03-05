/**
 * TWM API Server — Stripe proxy + GitHub Actions + Cloudflare + PayPal
 * Run: bun run api
 * Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, GITHUB_TOKEN, CF_API_TOKEN, CF_ACCOUNT_ID,
 *      PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_ENV, API_PORT (default 3001), API_HOST (default 0.0.0.0)
 *      Provider URL overrides: STRIPE_API_URL, GITHUB_API_URL, CLOUDFLARE_API_URL, PAYPAL_API_URL, BACKEND_BASE_URL
 */

import { createServer as httpCreateServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHmac, randomBytes, pbkdf2Sync } from 'node:crypto';
import { authDb } from './db.ts';
import { buildAuthnRequest, deflateEncode, buildSpMetadata, verifySamlResponse, parseIdpMetadata } from './saml.ts';
import { readLayout, writeLayout, listWorkspaces, hasActiveTiles, CHANNEL_TO_TILE_TYPES } from './mcp-layout.ts';
import type { ProviderRouteHandler, ServerContext } from './providers/types.ts';
import { register as registerStripe, getStripe } from './providers/stripe.ts';
import { register as registerGithub } from './providers/github.ts';
import { register as registerCloudflare } from './providers/cloudflare.ts';
import { register as registerPaypal } from './providers/paypal.ts';
import { register as registerVercel } from './providers/vercel.ts';
import { register as registerNetlify } from './providers/netlify.ts';
import { register as registerCircleci } from './providers/circleci.ts';
import { register as registerTravisci } from './providers/travisci.ts';
import { register as registerBitrise } from './providers/bitrise.ts';
import { register as registerSonarqube } from './providers/sonarqube.ts';
import { register as registerAzuredevops } from './providers/azuredevops.ts';
import { register as registerDockerhub } from './providers/dockerhub.ts';
import { register as registerNpm } from './providers/npm.ts';
import { register as registerJsdelivr } from './providers/jsdelivr.ts';
import { register as registerWakatime } from './providers/wakatime.ts';
import { register as registerClockify } from './providers/clockify.ts';
import { register as registerLinear } from './providers/linear.ts';
import { register as registerJira } from './providers/jira.ts';
import { register as registerSlack } from './providers/slack.ts';
import { register as registerDiscord } from './providers/discord.ts';
import { register as registerMailchimp } from './providers/mailchimp.ts';
import { register as registerGa4 } from './providers/ga4.ts';
import { register as registerInstatus } from './providers/instatus.ts';
import { register as registerHackernews } from './providers/hackernews.ts';
import { register as registerRss } from './providers/rss.ts';
import { register as registerAlphavantage } from './providers/alphavantage.ts';
import { register as registerCoingecko } from './providers/coingecko.ts';
import { register as registerFinnhub } from './providers/finnhub.ts';
import { register as registerPlaid } from './providers/plaid.ts';
import { register as registerHibp } from './providers/hibp.ts';
import { register as registerVirustotal } from './providers/virustotal.ts';
import { register as registerShodan } from './providers/shodan.ts';
import { register as registerWoocommerce } from './providers/woocommerce.ts';
import { register as registerShopify } from './providers/shopify.ts';
import { register as registerReddit } from './providers/reddit.ts';
import { register as registerProducthunt } from './providers/producthunt.ts';
import { register as registerFlint, flintFetch } from './providers/flint.ts';
import { createWsServer, handleWsUpgrade, setTokenVerifier, broadcastCommandResult, broadcastCommandProgress, broadcastResource } from './ws/flint-hub.ts';
import { recoverStuckCommands, startProcessingLoop, onCommandLifecycle, setCommandExecutor } from './providers/flint-queue.ts';
import { purgeExpired } from './db/flint-db.ts';

// ── Order workflow status store (SQLite via bun:sqlite) ───────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));

// ── .env file paths ───────────────────────────────────────────────────────────
const ENV_PATH          = join(__dirname, '..', '.env');
const POLL_SETTINGS_PATH = join(__dirname, '..', 'poll-settings.json');

/** Parse an env file string into a key→value record (comments/blanks ignored). */
function parseEnvFile(content: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1); // preserve leading spaces in value
    if (key) vars[key] = val;
  }
  return vars;
}

/**
 * Write updated vars back into an existing env file string.
 * Preserves all comment lines and structure; replaces values in-place.
 * Keys not found in the original are appended at the end.
 * Also un-comments a commented-out key if it exists in updates.
 */
function patchEnvFile(existing: string, updates: Record<string, string>): string {
  const handled = new Set<string>();
  const lines = existing.split('\n').map(line => {
    const trimmed = line.trim();
    // Active assignment: KEY=value
    if (trimmed && !trimmed.startsWith('#')) {
      const eq = trimmed.indexOf('=');
      if (eq >= 0) {
        const key = trimmed.slice(0, eq).trim();
        if (key && key in updates) {
          handled.add(key);
          return `${key}=${updates[key]}`;
        }
      }
    }
    // Commented-out assignment: # KEY=value  → un-comment if user provided a value
    if (trimmed.startsWith('#')) {
      const rest = trimmed.slice(1).trim();
      const eq = rest.indexOf('=');
      if (eq >= 0) {
        const key = rest.slice(0, eq).trim();
        if (key && key in updates && updates[key] !== '') {
          handled.add(key);
          return `${key}=${updates[key]}`;
        }
      }
    }
    return line;
  });
  // Append keys that weren't in the file at all
  for (const [key, val] of Object.entries(updates)) {
    if (!handled.has(key) && val !== '') lines.push(`${key}=${val}`);
  }
  return lines.join('\n');
}


// ── Auth database (imported from db.ts) ──────────────────────────────────────

// JWT secret: stable across restarts only if JWT_SECRET is in .env.
const JWT_SECRET: string = process.env['JWT_SECRET'] ?? (() => {
  const s = randomBytes(32).toString('hex');
  console.warn('  [auth] WARNING: JWT_SECRET not in .env — ephemeral secret generated. All tokens invalidated on restart. Add JWT_SECRET to .env to persist sessions.');
  return s;
})();

/** Whether login is required. Set AUTH_ENABLED=true in .env to enable. */
const AUTH_ENABLED: boolean = process.env['AUTH_ENABLED'] === 'true';

/** Whether the MCP server endpoint is active. Set MCP_ENABLED=true in .env. */
const MCP_ENABLED: boolean = process.env['MCP_ENABLED'] === 'true';
/** Whether MCP tools require a valid JWT. Defaults to AUTH_ENABLED when unset. */
const MCP_AUTH_REQUIRED: boolean =
  process.env['MCP_AUTH_REQUIRED'] !== undefined
    ? process.env['MCP_AUTH_REQUIRED'] === 'true'
    : AUTH_ENABLED;

// ── SAML SSO config ────────────────────────────────────────────────────────────
/** Authentication provider: 'local' (default) or 'saml' for SAML 2.0 SSO. */
const AUTH_PROVIDER: 'local' | 'saml' =
  (process.env['AUTH_PROVIDER'] === 'saml') ? 'saml' : 'local';

const SAML_ISSUER       = process.env['SAML_ISSUER']       ?? 'tiling-window-manager';
const SAML_CALLBACK_URL = process.env['SAML_CALLBACK_URL'] ?? 'http://localhost:3001/api/auth/saml/callback';
// APP_URL: where the SPA frontend is served. Used to redirect back to the UI after SAML login.
// Defaults to the origin of SAML_CALLBACK_URL (correct when both are behind the same proxy).
// Set explicitly (e.g. APP_URL=http://localhost:8080) when the API and frontend run on different origins.
const APP_URL = process.env['APP_URL'] ?? (() => { try { const u = new URL(SAML_CALLBACK_URL); return `${u.protocol}//${u.host}`; } catch { return 'http://localhost:8080'; } })();

// SAML_IDP_METADATA_PATH takes priority over individual SAML_ENTRY_POINT/SAML_CERT vars.
// Point it at the XML file exported from your IdP (Google Workspace, Okta, Azure AD, etc.)
let SAML_ENTRY_POINT = process.env['SAML_ENTRY_POINT'] ?? '';
/** IdP certificate PEM (base64 body, with or without -----BEGIN/END----- headers). */
let SAML_CERT        = process.env['SAML_CERT']        ?? '';

const SAML_IDP_METADATA_PATH = process.env['SAML_IDP_METADATA_PATH'] ?? '';
if (SAML_IDP_METADATA_PATH) {
  try {
    const metaXml = readFileSync(
      SAML_IDP_METADATA_PATH.startsWith('/') || SAML_IDP_METADATA_PATH.match(/^[A-Za-z]:\\/)
        ? SAML_IDP_METADATA_PATH
        : join(__dirname, '..', SAML_IDP_METADATA_PATH),
      'utf8',
    );
    const meta = parseIdpMetadata(metaXml);
    SAML_ENTRY_POINT = meta.entryPoint;
    SAML_CERT        = meta.cert;
    console.log(`  [saml] loaded IdP metadata from ${SAML_IDP_METADATA_PATH}`);
    console.log(`  [saml] entry point: ${SAML_ENTRY_POINT}`);
  } catch (e) {
    console.error(`  [saml] ERROR reading SAML_IDP_METADATA_PATH (${SAML_IDP_METADATA_PATH}):`, e instanceof Error ? e.message : e);
  }
}

if (AUTH_PROVIDER === 'saml' && !SAML_ENTRY_POINT) {
  console.warn('  [saml] WARNING: AUTH_PROVIDER=saml but SAML_ENTRY_POINT is not set — SSO login will fail.');
}
if (AUTH_PROVIDER === 'saml' && !SAML_CERT) {
  console.warn('  [saml] WARNING: AUTH_PROVIDER=saml but SAML_CERT is not set — signature verification will fail.');
}

interface JwtPayload { sub: number; username: string; iat: number; exp: number; }
const JWT_EXPIRY_S = 30 * 86400; // 30 days

function signJwt(sub: number, username: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = { sub, username, iat: now, exp: now + JWT_EXPIRY_S };
  const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const b = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const s = createHmac('sha256', JWT_SECRET).update(`${h}.${b}`).digest('base64url');
  return `${h}.${b}.${s}`;
}

function verifyJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [h, b, s] = parts as [string, string, string];
    const expected = createHmac('sha256', JWT_SECRET).update(`${h}.${b}`).digest('base64url');
    if (s !== expected) return null;
    const payload = JSON.parse(Buffer.from(b, 'base64url').toString('utf8')) as JwtPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

function extractToken(req: IncomingMessage): JwtPayload | null {
  const auth = req.headers.authorization ?? '';
  if (auth.startsWith('Bearer ')) return verifyJwt(auth.slice(7));
  // Plain Token header — simpler for MCP / agent clients
  const tokenHeader = req.headers['token'];
  if (tokenHeader && typeof tokenHeader === 'string') return verifyJwt(tokenHeader);
  // EventSource cannot set headers — accept token as query param for SSE
  const qs = new URL(req.url ?? '/', 'http://localhost').searchParams;
  const t = qs.get('token');
  return t ? verifyJwt(t) : null;
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const idx = stored.indexOf(':');
  if (idx < 0) return false;
  const salt = stored.slice(0, idx);
  const hash = stored.slice(idx + 1);
  const attempt = pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
  return attempt === hash;
}

// Prepared auth statements
const stmtFindUser    = authDb.prepare<{ id: number; username: string; password_hash: string }, [string]>('SELECT id, username, password_hash FROM users WHERE username = ? COLLATE NOCASE');
const stmtInsertUser  = authDb.prepare<{ id: number }, [string, string]>('INSERT INTO users (username, password_hash) VALUES (?, ?) RETURNING id');
const stmtGetLayout    = authDb.prepare<{ tiles_json: string }, [number, string]>('SELECT tiles_json FROM tile_layouts WHERE user_id = ? AND workspace = ?');
const stmtUpsertLayout = authDb.prepare<void, [number, string, string, number]>('INSERT INTO tile_layouts (user_id, workspace, tiles_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, workspace) DO UPDATE SET tiles_json=excluded.tiles_json, updated_at=excluded.updated_at');
const stmtDeleteLayout = authDb.prepare<void, [number, string]>('DELETE FROM tile_layouts WHERE user_id = ? AND workspace = ?');

// ── Provider base-URL overrides (for local mocks / enterprise endpoints) ──────
const STRIPE_API_URL     = process.env['STRIPE_API_URL']     ?? 'https://api.stripe.com';
const GITHUB_API_URL     = process.env['GITHUB_API_URL']     ?? 'https://api.github.com';
const CLOUDFLARE_API_URL = process.env['CLOUDFLARE_API_URL'] ?? 'https://api.cloudflare.com/client/v4';
const PAYPAL_API_URL     = process.env['PAYPAL_API_URL']     ?? '';   // empty = use PAYPAL_ENV logic
const BACKEND_BASE_URL   = process.env['BACKEND_BASE_URL']   ?? '';   // prepended when proxy url is relative

// ── CORS ──────────────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS });
  res.end(JSON.stringify(data));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
  });
}

// ── Shared SSE broadcast infrastructure ──────────────────────────────────────
/**
 * The set of all currently connected SSE clients (one `ServerResponse` per tab).
 * Entries are added in `handleSseStream()` and removed on the `close` event.
 * `broadcastSse` and `broadcastSseEphemeral` iterate this set to fan-out events.
 */
const sseClients = new Set<ServerResponse>();

/**
 * Persistent SSE event cache: maps each SSE event/channel name to the most
 * recently broadcast payload for that channel.
 *
 * - **Populated by** `broadcastSse()` on every successful poll cycle.
 * - **Not written by** `broadcastSseEphemeral()` — ephemeral events are never cached.
 * - **Consumed by** `handleSseStream()` which replays the entire cache to every
 *   new SSE client so tiles render immediately without waiting for the next poll.
 * - **Lifecycle**: entries live for the duration of the server process; there is
 *   no TTL or eviction. Stale data is overwritten by the next successful fetch.
 */
const resourceCache = new Map<string, unknown>();

/** Route handlers registered by provider modules — populated by startPollers(). */
const providerHandlers: ProviderRouteHandler[] = [];

/**
 * Registry of on-demand refresh functions keyed by SSE event name.
 * Populated by poll() so that POST /api/refresh/:event can trigger an
 * immediate re-fetch + broadcast without waiting for the next interval.
 */
const refreshRegistry = new Map<string, () => Promise<void>>();

/** Stored setInterval handles so intervals can be cancelled and replaced. */
const pollerIntervals = new Map<string, ReturnType<typeof setInterval>>();

/** Stored run functions so set-interval can restart with a new period. */
const pollerRunFns = new Map<string, () => Promise<void>>();

interface PollSettings {
  paused: string[];
  intervals: Record<string, number>; // event → ms override
  webhookChannels?: string[];        // channels delivered via provider webhooks
}

function loadPollSettings(): PollSettings {
  try {
    if (existsSync(POLL_SETTINGS_PATH)) {
      const s = JSON.parse(readFileSync(POLL_SETTINGS_PATH, 'utf8')) as PollSettings;
      const pausedList = s.paused ?? [];
      const intervalKeys = Object.keys(s.intervals ?? {});
      const webhookList = s.webhookChannels ?? [];
      if (pausedList.length || intervalKeys.length || webhookList.length) {
        console.log('  [poll] restored settings from poll-settings.json');
        for (const ch of pausedList)
          console.log(`  [poll]   paused:   ${ch}`);
        for (const [ch, ms] of Object.entries(s.intervals ?? {}))
          console.log(`  [poll]   interval: ${ch.padEnd(32)}  ${fmtMs(ms)}`);
        for (const ch of webhookList)
          console.log(`  [poll]   webhook:  ${ch}`);
      }
      return s;
    }
  } catch { /* corrupt file — ignore */ }
  return { paused: [], intervals: {}, webhookChannels: [] };
}

function fmtMs(ms: number): string {
  return ms >= 3_600_000 ? `${ms / 3_600_000}h`
       : ms >= 60_000   ? `${ms / 60_000}m`
       :                   `${ms / 1000}s`;
}

function savePollSettings(): void {
  const settings: PollSettings = {
    paused: [...pausedPollers],
    intervals: Object.fromEntries(pollerCustomIntervals),
    webhookChannels: [...webhookMode],
  };
  try { writeFileSync(POLL_SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8'); } catch { /* ignore */ }
}

const _savedSettings = loadPollSettings();

/**
 * Channels paused by the client (refreshInterval = 0).
 * Persisted to poll-settings.json so restarts respect the paused state.
 */
const pausedPollers = new Set<string>(_savedSettings.paused);

/**
 * Client-specified poll intervals (ms) that override the .env defaults.
 * Persisted to poll-settings.json.
 */
const pollerCustomIntervals = new Map<string, number>(Object.entries(_savedSettings.intervals));

/**
 * Channels delivered via provider webhooks instead of periodic polling.
 * These channels are also added to pausedPollers so the regular polling loop
 * skips them; they are refreshed on demand when a webhook arrives.
 * Persisted to poll-settings.json under webhookChannels.
 */
const webhookMode = new Set<string>(_savedSettings.webhookChannels ?? []);
// Ensure webhook channels are also reflected in pausedPollers on startup.
for (const ch of webhookMode) pausedPollers.add(ch);

/**
 * Broadcast an SSE event to every connected client and **cache** the payload
 * in `resourceCache` so it is replayed to clients that connect later.
 *
 * Use this for all regular poll results. The cache ensures that a freshly
 * opened browser tab receives the current data instantly without waiting for
 * the next poll cycle.
 *
 * @param event - SSE event name (also used as the `resourceCache` key).
 * @param data  - JSON-serialisable payload broadcast to all clients.
 */
function broadcastSse(event: string, data: unknown): void {
  resourceCache.set(event, data);
  const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of [...sseClients]) {
    try { client.write(chunk); } catch { sseClients.delete(client); }
  }
  // Also push to WebSocket subscribers (no-op when no one is subscribed)
  broadcastResource(event, data);
}

/**
 * Broadcast an SSE event without caching it in resourceCache.
 * Use this for ephemeral commands (e.g. tile-op) that must not be replayed
 * to clients that connect after the event has already been applied.
 */
function broadcastSseEphemeral(event: string, data: unknown): void {
  const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of [...sseClients]) {
    try { client.write(chunk); } catch { sseClients.delete(client); }
  }
}

/**
 * Upgrade an HTTP connection to a persistent SSE stream.
 *
 * On connect the handler:
 * 1. Writes the `text/event-stream` response headers.
 * 2. Replays every entry in `resourceCache` so tiles receive current data
 *    immediately without waiting for the next poll cycle.
 * 3. Adds the response object to `sseClients` so future broadcasts reach it.
 * 4. Starts a 25-second keepalive comment ping to prevent NAT/proxy timeouts.
 * 5. Removes the client from `sseClients` and clears the keepalive timer when
 *    the underlying TCP connection closes.
 *
 * @param req - The incoming HTTP request (used for IP logging and close detection).
 * @param res - The HTTP response; left open as an SSE stream.
 */
function handleSseStream(req: IncomingMessage, res: ServerResponse): void {
  const clientIp = req.socket.remoteAddress ?? 'unknown';
  console.log(`  [sse]  client connected   ip=${clientIp}  total=${sseClients.size + 1}`);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    ...CORS,
  });
  // Send current cached data immediately so tiles populate without waiting
  let replayed = 0;
  for (const [ev, data] of resourceCache) {
    res.write(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`);
    replayed++;
  }
  console.log(`  [sse]  replayed ${replayed} cached events to new client`);
  res.write(': connected\n\n');
  sseClients.add(res);
  // Trigger immediate refreshes for channels that have active tiles but no
  // cached data (e.g. a tile type added for the first time — the initial poll
  // was skipped via hasActiveTiles because the DB row didn't exist yet).
  // Use a short delay so the SSE headers are flushed before the first data.
  setTimeout(() => {
    for (const [ch, runFn] of refreshRegistry) {
      if (!resourceCache.has(ch) && hasActiveTiles(ch)) {
        void runFn();
      }
    }
  }, 200);
  // Keep the TCP connection alive so proxies/NAT gateways don't silently drop it.
  // Without this, idle connections die after 30-120 s and browser EventSource
  // reconnects are throttled to minutes when the tab is backgrounded.
  const keepaliveTimer = setInterval(() => {
    try { res.write(': keepalive\n\n'); } catch { clearInterval(keepaliveTimer); }
  }, 25_000);
  req.on('close', () => {
    clearInterval(keepaliveTimer);
    sseClients.delete(res);
    console.log(`  [sse]  client disconnected ip=${clientIp}  total=${sseClients.size}`);
  });
}

// ── Server-side resource pollers ──────────────────────────────────────────────

/**
 * Maps every SSE channel name to the env vars required to enable it.
 * Used at startup to broadcast `env-status` so tiles can show a friendly
 * "missing configuration" banner instead of a perpetual loading state.
 */
const CHANNEL_ENV_MAP: Record<string, string[]> = {
  // Payments
  'stripe-payments':       ['STRIPE_SECRET_KEY'],
  'stripe-orders':         ['STRIPE_SECRET_KEY'],
  'stripe-products':       ['STRIPE_SECRET_KEY'],
  'stripe-subscriptions':  ['STRIPE_SECRET_KEY'],
  'stripe-customers':      ['STRIPE_SECRET_KEY'],
  'stripe-invoices':       ['STRIPE_SECRET_KEY'],
  'stripe-refunds':        ['STRIPE_SECRET_KEY'],
  'stripe-revenue':        ['STRIPE_SECRET_KEY'],
  'stripe-webhooks':       ['STRIPE_SECRET_KEY'],
  'paypal-data':           ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'],
  // Deployments
  'vercel-deployments':    ['VERCEL_TOKEN'],
  'netlify-deployments':   ['NETLIFY_TOKEN'],
  // CI
  'github-runs':           ['GITHUB_TOKEN', 'GITHUB_ORG or GITHUB_USER'],
  'circleci-pipelines':    ['CIRCLECI_TOKEN', 'CIRCLECI_ORG_SLUG'],
  'circleci-insights':     ['CIRCLECI_TOKEN', 'CIRCLECI_ORG_SLUG'],
  'travis-builds':         ['TRAVIS_TOKEN', 'TRAVIS_ORG'],
  'bitrise-builds':        ['BITRISE_TOKEN'],
  'dockerhub-repositories':['DOCKERHUB_USERNAME'],
  'sonarqube-quality':     ['SONARQUBE_URL', 'SONARQUBE_TOKEN'],
  'sonarqube-measures':    ['SONARQUBE_URL', 'SONARQUBE_TOKEN'],
  'sonarqube-issues':      ['SONARQUBE_URL', 'SONARQUBE_TOKEN'],
  'azuredevops-pipelines': ['AZURE_DEVOPS_ORG', 'AZURE_DEVOPS_TOKEN'],
  'azuredevops-releases':  ['AZURE_DEVOPS_ORG', 'AZURE_DEVOPS_TOKEN', 'AZURE_DEVOPS_PROJECT'],
  'azuredevops-workitems': ['AZURE_DEVOPS_ORG', 'AZURE_DEVOPS_TOKEN', 'AZURE_DEVOPS_PROJECT'],
  'cf-pages':              ['CF_API_TOKEN', 'CF_ACCOUNT_ID'],
  'cf-workers':            ['CF_API_TOKEN', 'CF_ACCOUNT_ID'],
  // Packages
  'npm-downloads':         ['NPM_PACKAGES'],
  'jsdelivr-hits':         ['JSDELIVR_PACKAGES'],
  // Productivity
  'wakatime-summary':      ['WAKATIME_API_KEY'],
  'wakatime-languages':    ['WAKATIME_API_KEY'],
  'wakatime-projects':     ['WAKATIME_API_KEY'],
  'clockify-time-entries': ['CLOCKIFY_API_KEY', 'CLOCKIFY_WORKSPACE_ID'],
  'clockify-projects':     ['CLOCKIFY_API_KEY', 'CLOCKIFY_WORKSPACE_ID'],
  'linear-issues':         ['LINEAR_API_KEY'],
  'linear-cycles':         ['LINEAR_API_KEY'],
  'linear-teams':          ['LINEAR_API_KEY'],
  'jira-issues':           ['JIRA_HOST', 'JIRA_EMAIL', 'JIRA_API_TOKEN'],
  'jira-sprint':           ['JIRA_HOST', 'JIRA_EMAIL', 'JIRA_API_TOKEN'],
  'jira-projects':         ['JIRA_HOST', 'JIRA_EMAIL', 'JIRA_API_TOKEN'],
  // Comms
  'slack-messages':        ['SLACK_BOT_TOKEN'],
  'slack-workspace-stats': ['SLACK_BOT_TOKEN'],
  'discord-server-stats':  ['DISCORD_BOT_TOKEN'],
  'discord-channels':      ['DISCORD_BOT_TOKEN'],
  'mailchimp-campaigns':   ['MAILCHIMP_API_KEY'],
  'mailchimp-audience':    ['MAILCHIMP_API_KEY'],
  // Analytics
  'ga4-sessions-trend':    ['GA4_SERVICE_ACCOUNT_JSON', 'GA4_PROPERTY_ID'],
  'ga4-top-pages':         ['GA4_SERVICE_ACCOUNT_JSON', 'GA4_PROPERTY_ID'],
  'ga4-traffic-sources':   ['GA4_SERVICE_ACCOUNT_JSON', 'GA4_PROPERTY_ID'],
  'instatus-overview':     ['INSTATUS_PAGE_ID'],
  'instatus-incidents':    ['INSTATUS_PAGE_ID'],
  // Finance
  'alphavantage-quotes':              ['ALPHA_VANTAGE_KEY', 'AV_SYMBOLS'],
  'alphavantage-sparklines':          ['ALPHA_VANTAGE_KEY', 'AV_SYMBOLS'],
  'alphavantage-market-status':       ['ALPHA_VANTAGE_KEY'],
  'alphavantage-market-movers':       ['ALPHA_VANTAGE_KEY'],
  'alphavantage-news-sentiment':      ['ALPHA_VANTAGE_KEY'],
  'alphavantage-earnings':            ['ALPHA_VANTAGE_KEY', 'AV_SYMBOLS'],
  'alphavantage-earnings-calendar':   ['ALPHA_VANTAGE_KEY'],
  'alphavantage-fundamentals':        ['ALPHA_VANTAGE_KEY', 'AV_SYMBOLS'],
  'alphavantage-forex-rates':         ['ALPHA_VANTAGE_KEY', 'AV_FOREX_PAIRS'],
  'alphavantage-commodities':         ['ALPHA_VANTAGE_KEY'],
  'alphavantage-economic-indicators': ['ALPHA_VANTAGE_KEY'],
  'alphavantage-insider-transactions':['ALPHA_VANTAGE_KEY', 'AV_SYMBOLS'],
  'coingecko-markets':                ['COINGECKO_COINS'],
  'coingecko-prices':                 ['COINGECKO_COINS'],
  'coingecko-price-chart':            ['COINGECKO_COINS'],
  'coingecko-coin-detail':            ['COINGECKO_COINS'],
  'finnhub-quotes':                   ['FINNHUB_TOKEN', 'FH_SYMBOLS'],
  'finnhub-news':                     ['FINNHUB_TOKEN'],
  'finnhub-company-news':             ['FINNHUB_TOKEN', 'FH_SYMBOLS'],
  'finnhub-market-news':              ['FINNHUB_TOKEN'],
  'finnhub-earnings-calendar':        ['FINNHUB_TOKEN'],
  'finnhub-earnings-surprises':       ['FINNHUB_TOKEN', 'FH_SYMBOLS'],
  'finnhub-analyst-consensus':        ['FINNHUB_TOKEN', 'FH_SYMBOLS'],
  'finnhub-fundamentals':             ['FINNHUB_TOKEN', 'FH_SYMBOLS'],
  'finnhub-market-status':            ['FINNHUB_TOKEN'],
  'finnhub-insider-transactions':     ['FINNHUB_TOKEN', 'FH_SYMBOLS'],
  'finnhub-insider-sentiment':        ['FINNHUB_TOKEN', 'FH_SYMBOLS'],
  'finnhub-ipo-calendar':             ['FINNHUB_TOKEN'],
  'finnhub-sec-filings':              ['FINNHUB_TOKEN', 'FH_SYMBOLS'],
  'finnhub-company-profile':          ['FINNHUB_TOKEN', 'FH_SYMBOLS'],
  'plaid-accounts':                   ['PLAID_ACCESS_TOKEN', 'PLAID_CLIENT_ID', 'PLAID_SECRET'],
  'plaid-balances':                   ['PLAID_ACCESS_TOKEN', 'PLAID_CLIENT_ID', 'PLAID_SECRET'],
  'plaid-transactions':               ['PLAID_ACCESS_TOKEN', 'PLAID_CLIENT_ID', 'PLAID_SECRET'],
  'plaid-investment-portfolio':       ['PLAID_ACCESS_TOKEN', 'PLAID_CLIENT_ID', 'PLAID_SECRET'],
  'plaid-investment-transactions':    ['PLAID_ACCESS_TOKEN', 'PLAID_CLIENT_ID', 'PLAID_SECRET'],
  'plaid-liabilities-overview':       ['PLAID_ACCESS_TOKEN', 'PLAID_CLIENT_ID', 'PLAID_SECRET'],
  'plaid-credit-card-details':        ['PLAID_ACCESS_TOKEN', 'PLAID_CLIENT_ID', 'PLAID_SECRET'],
  'plaid-mortgage-tracker':           ['PLAID_ACCESS_TOKEN', 'PLAID_CLIENT_ID', 'PLAID_SECRET'],
  'plaid-statements':                 ['PLAID_ACCESS_TOKEN', 'PLAID_CLIENT_ID', 'PLAID_SECRET'],
  // Security
  'hibp-breaches':                    ['HIBP_API_KEY', 'HIBP_EMAILS'],
  'virustotal-analyses':              ['VIRUSTOTAL_API_KEY', 'VT_DOMAINS'],
  'shodan-search':                    ['SHODAN_API_KEY'],
  // E-commerce
  'woocommerce-orders':               ['WC_BASE_URL', 'WC_CONSUMER_KEY', 'WC_CONSUMER_SECRET'],
  'woocommerce-sales-summary':        ['WC_BASE_URL', 'WC_CONSUMER_KEY', 'WC_CONSUMER_SECRET'],
  'woocommerce-top-sellers':          ['WC_BASE_URL', 'WC_CONSUMER_KEY', 'WC_CONSUMER_SECRET'],
  'shopify-orders':                   ['SHOPIFY_SHOP', 'SHOPIFY_ACCESS_TOKEN'],
  'shopify-products':                 ['SHOPIFY_SHOP', 'SHOPIFY_ACCESS_TOKEN'],
  // Social
  'reddit-posts':                     [], // subreddits configured per-tile; REDDIT_SUBREDDITS is optional fallback
  // Note: reddit-hot-posts and reddit-keyword-monitor are UI aliases for
  // reddit-posts via TILE_SSE_CHANNEL — they share the same poller and
  // env-status lookup, so they do not need separate entries here.
  'producthunt-top-launches':         ['PRODUCTHUNT_API_TOKEN'],
};

function startPollers(): void {
  const ts = () => new Date().toISOString().replace('T', ' ').slice(0, 23);

  // Auto-detect webhook mode from env secrets — if a provider's webhook secret
  // is configured, assume the webhook endpoint is registered with that provider
  // and suspend periodic polling for all of its channels.
  const webhookSecretProviders: Array<{ secret: string; channels: string[] }> = [
    { secret: 'STRIPE_WEBHOOK_SECRET',  channels: ['stripe-payments', 'stripe-subscriptions', 'stripe-products', 'stripe-customers', 'stripe-invoices', 'stripe-refunds', 'stripe-revenue', 'stripe-webhooks'] },
    { secret: 'GITHUB_WEBHOOK_SECRET',  channels: ['github-runs'] },
    { secret: 'PAYPAL_WEBHOOK_SECRET',  channels: ['paypal-data'] },
    { secret: 'VERCEL_WEBHOOK_SECRET',  channels: ['vercel-deployments'] },
    { secret: 'NETLIFY_WEBHOOK_SECRET', channels: ['netlify-deployments'] },
  ];
  for (const { secret, channels } of webhookSecretProviders) {
    if (process.env[secret]) {
      for (const ch of channels) {
        if (!webhookMode.has(ch)) {
          webhookMode.add(ch);
          pausedPollers.add(ch);
          console.log(`  [poll] webhook-auto ${ch.padEnd(30)}  (${secret} is set)`);
        }
      }
    }
  }
  // Persist any newly auto-detected webhook channels.
  savePollSettings();

    /**
     * Register a recurring poller for an SSE channel inside the provider framework.
     *
     * Behaviour:
     * - Runs `fn` **once immediately** (initial fetch / cache warm-up) regardless
     *   of paused or webhook-mode state, so tiles populate on first load.
     * - For webhook-mode channels the `setInterval` is skipped entirely; the
     *   channel is refreshed on demand when a webhook arrives.
     * - The effective interval is resolved as:
     *   `pollerCustomIntervals.get(event) ?? ms`
     *   allowing the client to override the default via `PATCH /api/poll/:event`.
     * - The run function is stored in both `refreshRegistry` (for on-demand
     *   `POST /api/refresh/:event`) and `pollerRunFns` (for `set-interval` ops).
     *
     * @param event - SSE event / channel name (e.g. `"stripe-payments"`).
     * @param ms    - Default poll interval in milliseconds.
     * @param fn    - Async function that fetches and returns the channel payload.
     *               Its return value is passed directly to `broadcastSse()`.
     */
    function poll(event: string, ms: number, fn: () => Promise<unknown>, initialDelayMs = 0): void {
    const effectiveMs = pollerCustomIntervals.get(event) ?? ms;
    const isWebhook = webhookMode.has(event);

    console.log(`  [poll] registered  ${event.padEnd(32)}  ${isWebhook ? '(WEBHOOK — polling suspended)' : `every ${fmtMs(effectiveMs)}${pausedPollers.has(event) ? '  (PAUSED)' : ''}` }`);

    const run = () => {
      if (!hasActiveTiles(event)) {
        console.log(`  [poll] skip       ${event.padEnd(32)}  (no active tiles)`);
        return Promise.resolve();
      }
      const t0 = Date.now();
      console.log(`  [poll] fetching    ${event}`);
      return fn()
        .then((d) => {
          const elapsed = Date.now() - t0;
          const size = JSON.stringify(d).length;
          console.log(`  [poll] ✓ done      ${event.padEnd(32)}  ${elapsed}ms  ~${(size / 1024).toFixed(1)} KB  ${ts()}`);
          broadcastSse(event, d);
        })
        .catch((e: unknown) => {
          const elapsed = Date.now() - t0;
          const msg = e instanceof Error ? e.message : String(e);
          console.error(`  [poll] ✗ error     ${event.padEnd(32)}  ${elapsed}ms  ${msg}  ${ts()}`);
          broadcastSse(event, { error: msg });
        });
    };

    // Always do one initial fetch to populate the SSE cache — even in webhook
    // mode tiles need data immediately on load without waiting for a webhook.
    // initialDelayMs > 0 staggers aggregation pollers that depend on primary
    // pollers being warm (avoids N simultaneous requests at startup).
    if (initialDelayMs > 0) {
      setTimeout(() => { void run(); }, initialDelayMs);
    } else {
      void run();
    }
    // Skip the interval entirely for webhook-driven channels.
    if (!isWebhook) {
      pollerIntervals.set(event, setInterval(() => { if (!pausedPollers.has(event)) void run(); }, effectiveMs));
    }
    pollerRunFns.set(event, () => run() as Promise<void>);
    refreshRegistry.set(event, () => run() as Promise<void>);
  }

  // ── Register all providers via ServerContext ──────────────────────────────────
  const ctx: ServerContext = {
    json,
    readBody,
    route,
    poll,
    broadcastSse,
    broadcastSseEphemeral,
    resourceCache,
    refreshRegistry,
    STRIPE_API_URL: process.env['STRIPE_API_URL'] ?? 'https://api.stripe.com',
    GITHUB_API_URL: process.env['GITHUB_API_URL'] ?? 'https://api.github.com',
    CLOUDFLARE_API_URL: process.env['CLOUDFLARE_API_URL'] ?? 'https://api.cloudflare.com/client/v4',
    PAYPAL_API_URL: process.env['PAYPAL_API_URL'] ?? 'https://api.paypal.com',
    BACKEND_BASE_URL: process.env['BACKEND_BASE_URL'] ?? '',
  };
  providerHandlers.push(
    registerStripe(ctx),
    registerGithub(ctx),
    registerCloudflare(ctx),
    registerPaypal(ctx),
    registerVercel(ctx),
    registerNetlify(ctx),
    registerCircleci(ctx),
    registerTravisci(ctx),
    registerBitrise(ctx),
    registerSonarqube(ctx),
    registerAzuredevops(ctx),
    registerDockerhub(ctx),
    registerNpm(ctx),
    registerJsdelivr(ctx),
    registerWakatime(ctx),
    registerClockify(ctx),
    registerLinear(ctx),
    registerJira(ctx),
    registerSlack(ctx),
    registerDiscord(ctx),
    registerMailchimp(ctx),
    registerGa4(ctx),
    registerInstatus(ctx),
    registerHackernews(ctx),
    registerRss(ctx),
    registerAlphavantage(ctx),
    registerCoingecko(ctx),
    registerFinnhub(ctx),
    registerPlaid(ctx),
    registerHibp(ctx),
    registerVirustotal(ctx),
    registerShodan(ctx),
    registerWoocommerce(ctx),
    registerShopify(ctx),
    registerReddit(ctx),
    registerProducthunt(ctx),
    registerFlint(ctx),
  );

  console.log(`
  ${providerHandlers.length} providers registered — initial fetches running in background...
`);

  // Broadcast which channels are unconfigured so tiles can render a helpful
  // "missing env vars" banner instead of showing a perpetual loading spinner.
  const missingEnvMap: Record<string, string[]> = {};
  for (const [channel, vars] of Object.entries(CHANNEL_ENV_MAP)) {
    if (!refreshRegistry.has(channel)) {
      missingEnvMap[channel] = vars;
    }
  }
  broadcastSse('env-status', missingEnvMap);
}

// ── Generic API proxy (for Custom API tiles) ────────────────────────────────

async function handleApiProxy(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const bodyText = await readBody(req);
  let payload: { url: string; method?: string; headers?: Record<string, string>; body?: string };
  try { payload = JSON.parse(bodyText) as typeof payload; }
  catch { json(res, 400, { ok: false, error: 'Invalid JSON body' }); return; }

  const { url, method = 'GET', headers = {}, body: reqBody } = payload;
  if (!url || typeof url !== 'string') {
    json(res, 400, { ok: false, error: '"url" is required' }); return;
  }

  // Resolve relative URLs against BACKEND_BASE_URL if configured.
  const resolvedUrl = !url.startsWith('http') && BACKEND_BASE_URL
    ? `${BACKEND_BASE_URL.replace(/\/$/, '')}/${url.replace(/^\//, '')}`
    : url;

  const upper = method.toUpperCase();
  const hasBody = !['GET', 'HEAD', 'DELETE'].includes(upper) && reqBody != null;

  try {
    const r = await fetch(resolvedUrl, {
      method: upper,
      headers: hasBody
        ? { 'Content-Type': 'application/json', ...headers }
        : headers,
      body: hasBody ? reqBody : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    const text = await r.text();
    let data: unknown;
    const ct = r.headers.get('content-type') ?? '';
    if (ct.includes('json')) {
      try { data = JSON.parse(text); } catch { data = text; }
    } else {
      data = text;
    }
    json(res, 200, { ok: r.ok, status: r.status, statusText: r.statusText, data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    json(res, 200, { ok: false, error: msg });
  }
}

// ── Test-connection handler ─────────────────────────────────────────────────

async function handleTestConnection(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readBody(req);
  let payload: { type: 'rest' | 'ws' | 'graphql'; url: string; query?: string; headers?: Record<string, string> };
  try { payload = JSON.parse(body) as typeof payload; }
  catch { json(res, 400, { ok: false, error: 'Invalid JSON body' }); return; }

  if (payload.type === 'graphql') {
    try {
      const introspection = payload.query ?? '{__typename}';
      const r = await fetch(payload.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(payload.headers ?? {}),
        },
        body: JSON.stringify({ query: introspection }),
        signal: AbortSignal.timeout(10_000),
      });
      const text = await r.text().catch(() => '');
      const preview = text.slice(0, 300);
      json(res, 200, { ok: r.ok, status: r.status, statusText: r.statusText, preview });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      json(res, 200, { ok: false, error: msg });
    }
    return;
  }

  if (payload.type === 'rest') {
    try {
      const headers = payload.headers ?? {};
      const r = await fetch(payload.url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(10_000),
      });
      const text = await r.text().catch(() => '');
      const preview = text.slice(0, 300);
      json(res, 200, { ok: r.ok, status: r.status, statusText: r.statusText, preview });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      json(res, 200, { ok: false, error: msg });
    }
    return;
  }

  if (payload.type === 'ws') {
    try {
      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(payload.url);
        const timer = setTimeout(() => {
          ws.close();
          reject(new Error('Connection timed out after 5 seconds'));
        }, 5000);
        ws.addEventListener('open', () => {
          clearTimeout(timer);
          ws.close();
          resolve();
        });
        ws.addEventListener('error', () => {
          clearTimeout(timer);
          reject(new Error('WebSocket connection failed — check the URL and that the server is reachable'));
        });
      });
      json(res, 200, { ok: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      json(res, 200, { ok: false, error: msg });
    }
    return;
  }

  json(res, 400, { ok: false, error: 'type must be "rest" or "ws"' });
}

// ── Route-handler wrappers (one per endpoint) ─────────────────────────────────
const SLOW_MS = 5000; // warn if a proxy call takes longer than this

async function route<T>(res: ServerResponse, fn: () => Promise<T>): Promise<void> {
  const t0 = Date.now();
  try {
    const data = await fn();
    const elapsed = Date.now() - t0;
    if (elapsed > SLOW_MS) console.warn(`  [api]  ⚠ slow response ${elapsed}ms`);
    json(res, 200, data);
  } catch (e) {
    const elapsed = Date.now() - t0;
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error(`  [api]  ✗ error ${elapsed}ms  ${msg}`);
    json(res, 502, { error: msg });
  }
}

// ── MCP (Model Context Protocol) server ──────────────────────────────────────

let TWM_VERSION = '0.0.0';
try {
  const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')) as { version?: string };
  TWM_VERSION = pkg.version ?? '0.0.0';
} catch { /* ignore */ }

/** Connected MCP SSE clients (GET /api/mcp transport). */
const mcpSseClients = new Set<ServerResponse>();

/** Push a JSON-RPC 2.0 notification to all connected MCP SSE clients. */
function broadcastMcpNotification(method: string, params: unknown): void {
  const msg = JSON.stringify({ jsonrpc: '2.0', method, params });
  const chunk = `data: ${msg}\n\n`;
  for (const client of [...mcpSseClients]) {
    try { client.write(chunk); } catch { mcpSseClients.delete(client); }
  }
}

interface McpRequest {
  jsonrpc: '2.0';
  id: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

type McpResponse =
  | { jsonrpc: '2.0'; id: number | string | null; result: unknown }
  | { jsonrpc: '2.0'; id: number | string | null; error: { code: number; message: string } };

function mcpResult(id: number | string | null, result: unknown): McpResponse {
  return { jsonrpc: '2.0', id, result };
}
function mcpError(id: number | string | null, code: number, message: string): McpResponse {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

/** Dispatch a single JSON-RPC 2.0 MCP request and return the response. */
async function dispatchMcp(rpc: McpRequest, jwtUser: JwtPayload | null): Promise<McpResponse> {
  const { id, method, params } = rpc;

  if (method === 'initialize') {
    return mcpResult(id, {
      protocolVersion: '2024-11-05',
      serverInfo: { name: 'twm', version: TWM_VERSION },
      capabilities: { tools: {}, resources: {}, prompts: {} },
    });
  }

  if (method === 'tools/list') {
    return mcpResult(id, {
      tools: [
        {
          name: 'add_tile',
          description: 'Append a new tile to the current dashboard layout.',
          inputSchema: {
            type: 'object',
            properties: {
              type:      { type: 'string',  description: 'Tile type (e.g. "ws", "stripe-payments")' },
              config:    { type: 'object',  description: 'Provider-specific config. For reddit tile types (reddit-hot-posts, reddit-keyword-monitor, reddit-posts) include subreddits (comma-separated subreddit names, e.g. "MachineLearning,LocalLLaMA") and optionally keywords (comma-separated filter terms for reddit-keyword-monitor).' },
              x:         { type: 'number',  description: 'Grid column' },
              y:         { type: 'number',  description: 'Grid row' },
              w:         { type: 'number',  description: 'Width in grid columns' },
              h:         { type: 'number',  description: 'Height in grid rows' },
              workspace: { type: 'string',  description: 'Workspace name (default: dashboard-1)' },
            },
            required: ['type'],
          },
        },
        {
          name: 'remove_tile',
          description: 'Remove a tile from the dashboard by its id.',
          inputSchema: {
            type: 'object',
            properties: {
              id:        { type: 'string', description: 'Tile id to remove' },
              workspace: { type: 'string', description: 'Workspace name (default: dashboard-1)' },
            },
            required: ['id'],
          },
        },
        {
          name: 'update_tile',
          description: 'Merge a patch object into an existing tile.',
          inputSchema: {
            type: 'object',
            properties: {
              id:        { type: 'string', description: 'Tile id to update' },
              patch:     { type: 'object', description: 'Key/value pairs to merge into the tile' },
              workspace: { type: 'string', description: 'Workspace name (default: dashboard-1)' },
            },
            required: ['id', 'patch'],
          },
        },
        {
          name: 'reload_env',
          description: 'Reload the server .env file and apply updated environment variables.',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'get_tile_data',
          description: 'Return the latest cached data for a given SSE channel or tile ID. SSE-based tiles (e.g. stripe-payments) use their channel name. Client-side tiles (rest, custom-api, websocket, graphql) report their data by tile ID — pass the tile\'s UUID as the channel value.',
          inputSchema: {
            type: 'object',
            properties: {
              channel:   { type: 'string', description: 'SSE event/channel name or tile UUID' },
              workspace: { type: 'string', description: 'Workspace name (default: dashboard-1)' },
            },
            required: ['channel'],
          },
        },
        {
          name: 'list_tiles',
          description: 'Return the full list of tiles currently on the dashboard, including their IDs, types, positions, and config. If workspace is omitted, returns tiles grouped by all workspaces.',
          inputSchema: {
            type: 'object',
            properties: {
              workspace: { type: 'string', description: 'Workspace name. Omit to get tiles from all workspaces.' },
            },
          },
        },
        {
          name: 'list_workspaces',
          description: 'Return all workspace names for the current user. Use this before list_tiles or add_tile to find the correct workspace name.',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'remove_dashboard',
          description: 'Remove an entire dashboard (workspace) and all its tiles from the server.',
          inputSchema: {
            type: 'object',
            properties: {
              workspace: { type: 'string', description: 'Workspace name to remove' },
            },
            required: ['workspace'],
          },
        },
      ],
    });
  }

  if (method === 'tools/call') {
    const toolName = params?.['name'] as string | undefined;
    const args = (params?.['arguments'] ?? {}) as Record<string, unknown>;

    // Read-only tools are always permitted; write tools require auth when MCP_AUTH_REQUIRED.
    const isWriteTool = toolName === 'add_tile' || toolName === 'remove_tile' || toolName === 'update_tile' || toolName === 'reload_env' || toolName === 'remove_dashboard';
    if (isWriteTool && MCP_AUTH_REQUIRED && !jwtUser) {
      return mcpError(id, -32001, 'Unauthorized — provide a JWT via Authorization: Bearer <token>');
    }

    // Snap a number to the 16px grid
    const snap16 = (n: number) => Math.round(n / 16) * 16;
    // Workspace — falls back to 'dashboard-1' which is the default workspace name.
    const ws = (args['workspace'] as string | undefined) ?? 'dashboard-1';

    if (toolName === 'add_tile') {
      const tileType = args['type'] as string | undefined;
      if (!tileType) return mcpError(id, -32602, 'add_tile requires "type"');
      const configFields = (args['config'] && typeof args['config'] === 'object' && !Array.isArray(args['config']))
        ? args['config'] as Record<string, unknown>
        : {};
      // Nest config under the correct sub-key so renderTile can find it.
      // Provider tiles (e.g. stripe-payments) don't use sub-keys — spread flat.
      const configSubKey: Record<string, string> = {
        'rest': 'rest', 'websocket': 'ws', 'custom-api': 'customApi',
        'graphql': 'graphql', 'rss-feed': 'rss',
      };
      const subKey = configSubKey[tileType];
      const nestedConfig = subKey ? { [subKey]: configFields } : configFields;
      const newTile: Record<string, unknown> = {
        id: crypto.randomUUID(),
        type: tileType,
        x: snap16(Number(args['x'] ?? 8)),
        y: snap16(Number(args['y'] ?? 8)),
        w: snap16(Number(args['w'] ?? 400)),
        h: snap16(Number(args['h'] ?? 300)),
        ...nestedConfig,
      };

      // Use broadcastSseEphemeral so tile-op is NOT stored in resourceCache.
      // Caching tile-op would cause it to replay on new SSE connections, adding the same tile twice.
      broadcastSseEphemeral('tile-op', { op: 'add', tile: newTile, workspace: ws });
      if (jwtUser) {
        const layout = readLayout(jwtUser.sub, ws);
        layout.push(newTile);
        writeLayout(jwtUser.sub, ws, layout);
      }
      broadcastMcpNotification('notifications/resources/updated', { uri: 'dashboard://tiles' });
      // Trigger an immediate poll for any channel that now has its first tile.
      // This ensures the tile gets data without waiting for the next interval.
      if (typeof tileType === 'string') {
        // Build reverse mapping: tile type → channel(s)
        const channelsForType: string[] = [];
        for (const [ch, types] of Object.entries(CHANNEL_TO_TILE_TYPES)) {
          if (types.includes(tileType)) channelsForType.push(ch);
        }
        // Fall back to channel name == tile type when not in the exceptions map.
        if (channelsForType.length === 0) channelsForType.push(tileType);
        for (const ch of channelsForType) {
          if (!resourceCache.has(ch)) {
            // No cached data yet — fire immediately so the tile doesn't spin.
            void refreshRegistry.get(ch)?.();
          }
        }
        // Reddit tiles must always refresh so the poller picks up the new subreddit.
        if (['reddit-posts', 'reddit-hot-posts', 'reddit-keyword-monitor'].includes(tileType)) {
          void refreshRegistry.get('reddit-posts')?.();
        }
      }
      return mcpResult(id, { content: [{ type: 'text', text: JSON.stringify({ ok: true, tile: newTile }, null, 2) }] });
    }

    if (toolName === 'remove_tile') {
      const tileId = args['id'] as string | undefined;
      if (!tileId) return mcpError(id, -32602, 'remove_tile requires "id"');
      broadcastSseEphemeral('tile-op', { op: 'remove', id: tileId, workspace: ws });
      if (jwtUser) {
        const layout = readLayout(jwtUser.sub, ws);
        const updated = layout.filter((t) => (t as Record<string, unknown>)['id'] !== tileId);
        writeLayout(jwtUser.sub, ws, updated);
      }
      broadcastMcpNotification('notifications/resources/updated', { uri: 'dashboard://tiles' });
      // If a reddit tile was removed, refresh the poller to drop its subreddits from the pool.
      void refreshRegistry.get('reddit-posts')?.();
      return mcpResult(id, { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] });
    }

    if (toolName === 'update_tile') {
      const tileId = args['id'] as string | undefined;
      const patch  = args['patch'] as Record<string, unknown> | undefined;
      if (!tileId || !patch) return mcpError(id, -32602, 'update_tile requires "id" and "patch"');
      broadcastSseEphemeral('tile-op', { op: 'update', id: tileId, patch, workspace: ws });
      if (jwtUser) {
        const layout = readLayout(jwtUser.sub, ws);
        const updated = layout.map((t) => {
          const tile = t as Record<string, unknown>;
          return tile['id'] === tileId ? { ...tile, ...patch, id: tile['id'] } : tile;
        });
        writeLayout(jwtUser.sub, ws, updated);
      }
      broadcastMcpNotification('notifications/resources/updated', { uri: 'dashboard://tiles' });
      // If subreddits were changed on a reddit tile, refresh the poller with the new union.
      if (patch && typeof patch['subreddits'] === 'string') {
        void refreshRegistry.get('reddit-posts')?.();
      }
      return mcpResult(id, { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] });
    }

    if (toolName === 'reload_env') {
      try {
        const content = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : '';
        const vars = parseEnvFile(content);
        const reloaded: string[] = [];
        for (const [k, v] of Object.entries(vars)) {
          if (process.env[k] !== v) { process.env[k] = v; reloaded.push(k); }
        }
        // Reddit poller is always registered at startup — no env var needed.
        console.log(`  [mcp]  reload-env  ${reloaded.length} keys: ${reloaded.join(', ') || '(none)'}`);
        return mcpResult(id, { content: [{ type: 'text', text: JSON.stringify({ ok: true, reloaded }) }] });
      } catch (e) {
        return mcpError(id, -32603, e instanceof Error ? e.message : 'reload_env failed');
      }
    }

    if (toolName === 'get_tile_data') {
      const channel = args['channel'] as string | undefined;
      if (!channel) return mcpError(id, -32602, 'get_tile_data requires "channel"');

      // 1. Check the SSE resource cache (populated by server-side pollers for
      //    provider tiles like stripe-revenue, github-actions, etc.).
      const cached = resourceCache.get(channel);
      if (cached !== undefined) {
        return mcpResult(id, { content: [{ type: 'text', text: JSON.stringify({ channel, data: cached }, null, 2) }] });
      }

      // 2. Channel looks like a UUID — treat it as a tile ID and fetch its data
      //    server-side from the DB-backed tile config. This works even when the
      //    browser is closed. Currently supports REST tiles (type='rest').
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (UUID_RE.test(channel) && jwtUser) {
        const layout = readLayout(jwtUser.sub, ws);
        const tile = layout.find((t) => (t as Record<string, unknown>)['id'] === channel) as Record<string, unknown> | undefined;
        if (tile) {
          const restCfg = tile['rest'] as { url?: string; headers?: Record<string, string> } | undefined;
          if (restCfg?.url) {
            try {
              const fetchRes = await fetch(restCfg.url, { headers: restCfg.headers ?? {} });
              const ct = fetchRes.headers.get('content-type') ?? '';
              const data = ct.includes('json') ? await fetchRes.json() : await fetchRes.text();
              resourceCache.set(channel, data);
              return mcpResult(id, { content: [{ type: 'text', text: JSON.stringify({ channel, data }, null, 2) }] });
            } catch (e) {
              return mcpError(id, -32603, `Failed to fetch tile data: ${e instanceof Error ? e.message : String(e)}`);
            }
          }
          // Tile exists but isn't a fetchable type — return tile type info
          return mcpResult(id, { content: [{ type: 'text', text: JSON.stringify({ channel, data: null, note: `Tile type '${tile['type']}' requires browser to report data` }, null, 2) }] });
        }
      }

      return mcpResult(id, { content: [{ type: 'text', text: JSON.stringify({ channel, data: null }, null, 2) }] });
    }

    if (toolName === 'list_tiles') {
      if (!jwtUser) return mcpResult(id, { content: [{ type: 'text', text: '[]' }] });
      if (args['workspace']) {
        const tiles = readLayout(jwtUser.sub, ws);
        return mcpResult(id, { content: [{ type: 'text', text: JSON.stringify(tiles, null, 2) }] });
      }
      // No workspace specified — return tiles grouped by all workspaces
      const allWorkspaces = listWorkspaces(jwtUser.sub);
      const all: Record<string, unknown[]> = {};
      for (const w of allWorkspaces) all[w] = readLayout(jwtUser.sub, w);
      return mcpResult(id, { content: [{ type: 'text', text: JSON.stringify(all, null, 2) }] });
    }

    if (toolName === 'list_workspaces') {
      const workspaces = jwtUser ? listWorkspaces(jwtUser.sub) : [];
      return mcpResult(id, { content: [{ type: 'text', text: JSON.stringify(workspaces, null, 2) }] });
    }

    if (toolName === 'remove_dashboard') {
      const targetWs = args['workspace'] as string | undefined;
      if (!targetWs) return mcpError(id, -32602, 'remove_dashboard requires "workspace"');
      if (!jwtUser) return mcpError(id, -32001, 'Unauthorized');
      stmtDeleteLayout.run(jwtUser.sub, targetWs);
      broadcastSseEphemeral('tile-op', { op: 'remove-dashboard', workspace: targetWs });
      broadcastMcpNotification('notifications/resources/updated', { uri: 'dashboard://tiles' });
      return mcpResult(id, { content: [{ type: 'text', text: JSON.stringify({ ok: true, removed: targetWs }) }] });
    }

    return mcpError(id, -32601, `Unknown tool: ${toolName}`);
  }

  if (method === 'resources/list') {
    return mcpResult(id, {
      resources: [
        {
          uri:         'dashboard://tiles',
          name:        'Dashboard tiles',
          description: 'Full tile layout array for the current user.',
          mimeType:    'application/json',
        },
        {
          uri:         'dashboard://layout',
          name:        'Dashboard layout metadata',
          description: 'Active SSE channels and connection statistics.',
          mimeType:    'application/json',
        },
      ],
    });
  }

  if (method === 'resources/read') {
    const uri = params?.['uri'] as string | undefined;
    if (uri === 'dashboard://tiles') {
      const tiles = jwtUser ? readLayout(jwtUser.sub, (listWorkspaces(jwtUser.sub)[0] ?? 'dashboard-1')) : [];
      return mcpResult(id, {
        contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(tiles, null, 2) }],
      });
    }
    if (uri === 'dashboard://layout') {
      const meta = {
        channels:          [...resourceCache.keys()],
        activeConnections: sseClients.size,
        mcpConnections:    mcpSseClients.size,
      };
      return mcpResult(id, {
        contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(meta, null, 2) }],
      });
    }
    return mcpError(id, -32602, `Unknown resource URI: ${uri}`);
  }

  if (method === 'prompts/list') {
    return mcpResult(id, {
      prompts: [
        {
          name:        'dashboard_summary',
          description: 'Markdown summary of all tiles in the current dashboard.',
        },
      ],
    });
  }

  if (method === 'prompts/get') {
    const promptName = params?.['name'] as string | undefined;
    if (promptName === 'dashboard_summary') {
      const tiles = jwtUser ? readLayout(jwtUser.sub, (listWorkspaces(jwtUser.sub)[0] ?? 'dashboard-1')) : [];
      const rows = tiles.map((t) => {
        const tile = t as Record<string, unknown>;
        const cfg  = (tile['config'] ?? {}) as Record<string, unknown>;
        const type  = String(tile['type']  ?? '');
        const title = String(cfg['title']  ?? cfg['label'] ?? '');
        const ep    = String(cfg['url']    ?? cfg['endpoint'] ?? cfg['channel'] ?? '');
        return `| ${type} | ${title} | ${ep} |`;
      });
      const header = '| type | title | endpoint |\n|------|-------|----------|';
      const text   = `# Dashboard Summary\n\n${header}\n${rows.join('\n') || '| — | no tiles | — |'}`;
      return mcpResult(id, {
        messages: [
          { role: 'user', content: { type: 'text', text } },
        ],
      });
    }
    return mcpError(id, -32602, `Unknown prompt: ${promptName}`);
  }

  return mcpError(id, -32601, `Method not found: ${method}`);
}

/** Handle POST /api/mcp — stateless HTTP JSON-RPC 2.0 transport. */
async function handleMcpPost(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const jwtUser = extractToken(req);
  let rpc: McpRequest;
  try {
    const body = await readBody(req);
    rpc = JSON.parse(body) as McpRequest;
  } catch {
    json(res, 400, mcpError(null, -32700, 'Parse error'));
    return;
  }
  if (rpc.jsonrpc !== '2.0' || !rpc.method) {
    json(res, 400, mcpError(rpc.id ?? null, -32600, 'Invalid Request'));
    return;
  }
  const response = await dispatchMcp(rpc, jwtUser);
  json(res, 200, response);
}

/** Handle GET /api/mcp — SSE transport; pushes JSON-RPC 2.0 notifications. */
function handleMcpSse(req: IncomingMessage, res: ServerResponse): void {
  const clientIp = req.socket.remoteAddress ?? 'unknown';
  console.log(`  [mcp]  SSE connected  ip=${clientIp}  total=${mcpSseClients.size + 1}`);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    ...CORS,
  });
  // Send endpoint event so MCP clients know where to POST requests.
  res.write(`event: endpoint\ndata: /api/mcp\n\n`);
  res.write(': connected\n\n');
  mcpSseClients.add(res);
  req.on('close', () => {
    mcpSseClients.delete(res);
    console.log(`  [mcp]  SSE disconnected ip=${clientIp}  total=${mcpSseClients.size}`);
  });
}

// ── Main request router ───────────────────────────────────────────────────────
async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const { pathname } = url;
  const method = req.method ?? 'GET';

  if (method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }
  if (pathname === '/health') { json(res, 200, { ok: true }); return; }

  if (!pathname.startsWith('/api/')) { json(res, 404, { error: 'Not found' }); return; }

  // ── SSE stream ─────────────────────────────────────────────────────────────
  if (pathname === '/api/sse' && method === 'GET') {
    if (AUTH_ENABLED && !extractToken(req)) { json(res, 401, { error: 'Unauthorized' }); return; }
    handleSseStream(req, res); return;
  }

  // ── MCP endpoint ───────────────────────────────────────────────────────────
  if (pathname === '/api/mcp') {
    if (!MCP_ENABLED) { json(res, 503, { error: 'MCP is not enabled. Set MCP_ENABLED=true in .env.' }); return; }
    if (method === 'GET') {
      handleMcpSse(req, res); return;
    }
    if (method === 'POST') {
      await handleMcpPost(req, res); return;
    }
    json(res, 405, { error: 'Method Not Allowed' }); return;
  }

  // ── Auth routes (always public) ────────────────────────────────────────────
  if (pathname === '/api/auth/config' && method === 'GET') {
    const samlLoginUrl = AUTH_PROVIDER === 'saml' && SAML_ENTRY_POINT ? '/api/auth/saml/login' : null;
    json(res, 200, { enabled: AUTH_ENABLED, provider: AUTH_PROVIDER, samlLoginUrl });
    return;
  }

  // ── SAML SSO routes ──────────────────────────────────────────────────────────
  if (pathname === '/api/auth/saml/login' && method === 'GET') {
    if (AUTH_PROVIDER !== 'saml') { json(res, 404, { error: 'SAML not enabled (set AUTH_PROVIDER=saml)' }); return; }
    if (!SAML_ENTRY_POINT) { json(res, 503, { error: 'SAML_ENTRY_POINT not configured' }); return; }
    const id       = `_twm${randomBytes(16).toString('hex')}`;
    const instant  = new Date().toISOString();
    const xml      = buildAuthnRequest({ id, issueInstant: instant, entryPoint: SAML_ENTRY_POINT, issuer: SAML_ISSUER, callbackUrl: SAML_CALLBACK_URL });
    const encoded  = encodeURIComponent(deflateEncode(xml));
    const relay    = encodeURIComponent(req.url ? new URL(req.url, 'http://localhost').searchParams.get('RelayState') ?? '/' : '/');
    const sep      = SAML_ENTRY_POINT.includes('?') ? '&' : '?';
    console.log(`  [saml] redirecting to IdP id=${id}`);
    res.writeHead(302, { Location: `${SAML_ENTRY_POINT}${sep}SAMLRequest=${encoded}&RelayState=${relay}` });
    res.end();
    return;
  }

  if (pathname === '/api/auth/saml/callback' && method === 'POST') {
    if (AUTH_PROVIDER !== 'saml') { json(res, 404, { error: 'SAML not enabled' }); return; }
    try {
      const body = await readBody(req);
      // Body is application/x-www-form-urlencoded
      const params   = new URLSearchParams(body);
      const samlResp = params.get('SAMLResponse');
      if (!samlResp) { json(res, 400, { error: 'Missing SAMLResponse' }); return; }
      if (!SAML_CERT) { json(res, 503, { error: 'SAML_CERT not configured' }); return; }

      const nameId = verifySamlResponse(samlResp, SAML_CERT);

      // Upsert user in auth.db (SAML users have an empty password_hash)
      let user = stmtFindUser.get(nameId);
      if (!user) {
        const rows = stmtInsertUser.all(nameId, 'saml:' + randomBytes(16).toString('hex'));
        user = { id: rows[0]!.id, username: nameId, password_hash: '' };
        console.log(`  [saml] new user     nameId=${nameId} id=${user.id}`);
      } else {
        console.log(`  [saml] login        nameId=${nameId} id=${user.id}`);
      }

      const token     = signJwt(user.id, user.username);
      const relayState = params.get('RelayState') ?? '/';
      // Build redirect: always go to the frontend (APP_URL) so the SPA can consume the token.
      // RelayState is a relative path (e.g. '/'); resolve it against APP_URL.
      const destPath   = relayState.startsWith('/') ? relayState : '/';
      const dest       = `${APP_URL}${destPath}`;
      res.writeHead(302, { Location: `${dest.includes('?') ? dest + '&' : dest + '?'}token=${encodeURIComponent(token)}` });
      res.end();
    } catch (e) {
      console.error('  [saml] callback error:', e);
      json(res, 401, { error: e instanceof Error ? e.message : 'SAML authentication failed' });
    }
    return;
  }

  if (pathname === '/api/auth/saml/metadata' && method === 'GET') {
    const xml = buildSpMetadata({ entityId: SAML_ISSUER, callbackUrl: SAML_CALLBACK_URL });
    res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' });
    res.end(xml);
    return;
  }
  if (pathname === '/api/auth/register' && method === 'POST') {
    if (!AUTH_ENABLED) { json(res, 403, { error: 'Registration is disabled (AUTH_ENABLED is not set)' }); return; }
    try {
      const body = await readBody(req);
      const { username, password } = JSON.parse(body) as { username?: string; password?: string };
      if (!username || username.trim().length < 2) { json(res, 400, { error: 'Username must be at least 2 characters' }); return; }
      if (!password || password.length < 6) { json(res, 400, { error: 'Password must be at least 6 characters' }); return; }
      const existing = stmtFindUser.get(username.trim());
      if (existing) { json(res, 409, { error: 'Username already taken' }); return; }
      const hash = hashPassword(password);
      const [{ id }] = stmtInsertUser.all(username.trim(), hash);
      const token = signJwt(id, username.trim());
      console.log(`  [auth] registered  user=${username.trim()} id=${id}`);
      json(res, 201, { token, user: { id, username: username.trim() } });
    } catch (e) { json(res, 500, { error: e instanceof Error ? e.message : 'Registration failed' }); }
    return;
  }
  if (pathname === '/api/auth/login' && method === 'POST') {
    try {
      const body = await readBody(req);
      const { username, password } = JSON.parse(body) as { username?: string; password?: string };
      if (!username || !password) { json(res, 400, { error: 'Username and password required' }); return; }
      const user = stmtFindUser.get(username.trim());
      if (!user || !verifyPassword(password, user.password_hash)) {
        json(res, 401, { error: 'Invalid username or password' }); return;
      }
      const token = signJwt(user.id, user.username);
      console.log(`  [auth] login       user=${user.username} id=${user.id}`);
      json(res, 200, { token, user: { id: user.id, username: user.username } });
    } catch (e) { json(res, 500, { error: e instanceof Error ? e.message : 'Login failed' }); }
    return;
  }
  if (pathname === '/api/auth/me' && method === 'GET') {
    const jwtUser = extractToken(req);
    if (!jwtUser) { json(res, 401, { error: 'Unauthorized' }); return; }
    json(res, 200, { id: jwtUser.sub, username: jwtUser.username });
    return;
  }

  // ── Auth middleware — guards all routes below when AUTH_ENABLED ────────────
  // Webhook receive routes are intentionally public — providers cannot supply
  // a user JWT, so signature verification is the sole authentication mechanism.
  // Tile data report route is also public — the tile UUID is the credential and
  // the endpoint is rate-limited; no sensitive data is exposed.
  const isWebhookRoute   = pathname.startsWith('/api/webhooks/') && method === 'POST';
  const isTileDataReport = pathname.startsWith('/api/tiles/') && pathname.endsWith('/data') && method === 'POST';
  const isPublicReddit   = pathname === '/api/reddit/posts' && method === 'GET';
  if (AUTH_ENABLED && !isWebhookRoute && !isTileDataReport && !isPublicReddit && !extractToken(req)) {
    json(res, 401, { error: 'Unauthorized' });
    return;
  }

  // ── Per-user layouts ───────────────────────────────────────────────────────

  // List all workspace names for the current user
  if (pathname === '/api/workspaces' && method === 'GET') {
    const jwtUser = extractToken(req);
    if (!jwtUser) { json(res, 401, { error: 'Unauthorized' }); return; }
    const workspaces = listWorkspaces(jwtUser.sub);
    json(res, 200, { workspaces });
    return;
  }

  if (pathname.startsWith('/api/layout/')) {
    const workspace = decodeURIComponent(pathname.slice('/api/layout/'.length));
    const jwtUser = extractToken(req);
    if (!jwtUser) { json(res, 401, { error: 'Unauthorized' }); return; }
    if (method === 'GET') {
      const row = stmtGetLayout.get(jwtUser.sub, workspace);
      if (!row) { json(res, 200, { tiles: null }); return; }
      json(res, 200, { tiles: JSON.parse(row.tiles_json) });
      return;
    }
    if (method === 'POST') {
      try {
        const body = await readBody(req);
        const { tiles } = JSON.parse(body) as { tiles: unknown[] };
        stmtUpsertLayout.run(jwtUser.sub, workspace, JSON.stringify(tiles), Math.floor(Date.now() / 1000));
        json(res, 200, { ok: true });
      } catch (e) { json(res, 400, { error: e instanceof Error ? e.message : 'Bad request' }); }
      return;
    }
    if (method === 'DELETE') {
      stmtDeleteLayout.run(jwtUser.sub, workspace);
      json(res, 200, { ok: true });
      return;
    }
  }
  if (pathname === '/api/proxy' && method === 'POST') {
    await handleApiProxy(req, res); return;
  }
  if (pathname === '/api/test-connection' && method === 'POST') {
    await handleTestConnection(req, res); return;
  }

  // ── Server control ────────────────────────────────────────────────────────
  if (pathname === '/api/server/reload-env' && method === 'POST') {
    try {
      const content = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : '';
      const vars = parseEnvFile(content);
      const reloaded: string[] = [];
      for (const [k, v] of Object.entries(vars)) {
        if (process.env[k] !== v) {
          process.env[k] = v;
          reloaded.push(k);
        }
      }
      console.log(`  [env]  reload-env  ${reloaded.length} keys updated: ${reloaded.join(', ') || '(none)'}`);
      json(res, 200, { ok: true, reloaded });
    } catch (e: unknown) {
      json(res, 500, { ok: false, error: e instanceof Error ? e.message : 'Failed to reload .env' });
    }
    return;
  }
  if (pathname === '/api/server/restart' && method === 'POST') {
    console.log('  [server] restarting on user request');
    json(res, 200, { ok: true });
    // Under bun --watch / PM2 / nodemon the supervisor respawns on exit.
    // Do NOT spawn a child — that causes port conflicts when the supervisor
    // also restarts at the same time.
    setTimeout(() => process.exit(0), 200);
    return;
  }

  if (pathname === '/api/server/info' && method === 'GET') {
    const port = parseInt(process.env['API_PORT'] ?? '3001', 10);
    const host = process.env['API_HOST'] ?? '0.0.0.0';
    json(res, 200, {
      host,
      port,
      boundAddress: `${host === '0.0.0.0' ? 'localhost' : host}:${port}`,
      stripeApiUrl:     STRIPE_API_URL,
      githubApiUrl:     GITHUB_API_URL,
      cloudflareApiUrl: CLOUDFLARE_API_URL,
      paypalApiUrl:     PAYPAL_API_URL || (
        (process.env['PAYPAL_ENV'] ?? 'sandbox') === 'live'
          ? 'https://api-m.paypal.com'
          : 'https://api-m.sandbox.paypal.com'
      ),
      backendBaseUrl: BACKEND_BASE_URL,
    });
    return;
  }

  // ── Env file read / write ──────────────────────────────────────────────────
  if (pathname === '/api/env') {
    if (method === 'GET') {
      try {
        // Read active .env; fall back to .env.example if .env not found
        const content = existsSync(ENV_PATH)
          ? readFileSync(ENV_PATH, 'utf8')
          : '';
        const vars = parseEnvFile(content);
        json(res, 200, { vars });
      } catch (e: unknown) {
        json(res, 500, { error: e instanceof Error ? e.message : 'Failed to read .env' });
      }
      return;
    }
    if (method === 'POST') {
      try {
        const body = await readBody(req);
        const payload = JSON.parse(body) as { vars: Record<string, string> };
        if (!payload.vars || typeof payload.vars !== 'object') {
          json(res, 400, { error: 'Body must be { vars: Record<string, string> }' }); return;
        }
        // Load existing content (or blank) and patch it
        const existing = existsSync(ENV_PATH)
          ? readFileSync(ENV_PATH, 'utf8')
          : '';
        const patched = patchEnvFile(existing, payload.vars);
        writeFileSync(ENV_PATH, patched, 'utf8');
        console.log(`  [env]  wrote ${Object.keys(payload.vars).length} vars → ${ENV_PATH}`);
        json(res, 200, { ok: true });
      } catch (e: unknown) {
        json(res, 500, { error: e instanceof Error ? e.message : 'Failed to write .env' });
      }
      return;
    }
  }

  // ── Poll control ──────────────────────────────────────────────────────────
  // POST /api/poll/sync  — dashboard sends its full tile config on load so the
  // server stays in sync even after a server restart without a settings file.
  if (pathname === '/api/poll/sync' && method === 'POST') {
    const body = await readBody(req);
    const { settings } = JSON.parse(body) as { settings: Array<{ channel: string; ms: number }> };
    console.log(`  [poll] SYNC        from dashboard  (${settings.length} entries)`);
    // Reset all managed state then apply what the client sent.
    pausedPollers.clear();
    pollerCustomIntervals.clear();
    for (const { channel, ms } of settings) {
      if (ms === 0) {
        pausedPollers.add(channel);
        console.log(`  [poll]   pause:    ${channel}`);
      } else {
        pollerCustomIntervals.set(channel, ms);
        console.log(`  [poll]   interval: ${channel.padEnd(32)}  ${fmtMs(ms)}`);
        // Re-schedule the interval if it differs from what's running.
        const old = pollerIntervals.get(channel);
        if (old !== undefined) clearInterval(old);
        const run = pollerRunFns.get(channel);
        if (run) pollerIntervals.set(channel, setInterval(() => { if (!pausedPollers.has(channel)) void run(); }, ms));
      }
    }
    // Webhook-mode channels must always stay paused regardless of sync payload.
    for (const ch of webhookMode) pausedPollers.add(ch);
    savePollSettings();
    json(res, 200, { ok: true, synced: settings.length });
    return;
  }
  // POST /api/poll/pause/:event  — stops periodic fetches for a channel.
  // POST /api/poll/resume/:event — resumes and immediately re-fetches.
  if (pathname.startsWith('/api/poll/pause/') && method === 'POST') {
    const channel = pathname.slice('/api/poll/pause/'.length);
    console.log(`  [poll] PAUSE       ${channel}  (dashboard request)`);
    pausedPollers.add(channel);
    savePollSettings();
    json(res, 200, { ok: true, channel, paused: true });
    return;
  }
  if (pathname.startsWith('/api/poll/resume/') && method === 'POST') {
    const channel = pathname.slice('/api/poll/resume/'.length);
    if (webhookMode.has(channel)) {
      // Webhook channels stay paused — they are refreshed by incoming webhooks.
      json(res, 200, { ok: true, channel, paused: true, webhookMode: true });
      return;
    }
    const customMs = pollerCustomIntervals.get(channel);
    console.log(`  [poll] RESUME      ${channel}  (dashboard request)${customMs ? `  interval=${fmtMs(customMs)}` : ''}`);
    pausedPollers.delete(channel);
    savePollSettings();
    const fn = refreshRegistry.get(channel);
    if (fn) void fn(); // immediate fetch on resume
    json(res, 200, { ok: true, channel, paused: false });
    return;
  }
  if (pathname.startsWith('/api/poll/set-interval/') && method === 'POST') {
    const channel = pathname.slice('/api/poll/set-interval/'.length);
    const body = await readBody(req);
    const { ms: newMs } = JSON.parse(body) as { ms: number };
    if (!Number.isFinite(newMs) || newMs < 1000) { json(res, 400, { error: 'ms must be >= 1000' }); return; }
    const oldMs = pollerCustomIntervals.get(channel);
    console.log(`  [poll] SET-INTERVAL ${channel.padEnd(31)}  ${oldMs ? fmtMs(oldMs) + ' → ' : ''}${fmtMs(newMs)}  (dashboard request)`);
    pollerCustomIntervals.set(channel, newMs);
    savePollSettings();
    // Cancel old interval and start new one at the custom rate.
    const old = pollerIntervals.get(channel);
    if (old !== undefined) clearInterval(old);
    const run = pollerRunFns.get(channel);
    if (run) {
      pollerIntervals.set(channel, setInterval(() => { if (!pausedPollers.has(channel)) void run(); }, newMs));
    }
    json(res, 200, { ok: true, channel, ms: newMs });
    return;
  }

  // POST /api/poll/set-delivery/:channel  — switch a channel between 'poll'
  // and 'webhook' delivery modes.  In webhook mode the regular poller is
  // suspended; the server waits for a push from POST /api/webhooks/<provider>.
  if (pathname.startsWith('/api/poll/set-delivery/') && method === 'POST') {
    const channel = pathname.slice('/api/poll/set-delivery/'.length);
    const body = await readBody(req);
    const { mode } = JSON.parse(body) as { mode: 'poll' | 'webhook' };
    if (mode !== 'poll' && mode !== 'webhook') { json(res, 400, { error: "mode must be 'poll' or 'webhook'" }); return; }
    if (mode === 'webhook') {
      webhookMode.add(channel);
      pausedPollers.add(channel);
      console.log(`  [poll] WEBHOOK     ${channel}  (polling suspended — awaiting push)`);
    } else {
      webhookMode.delete(channel);
      pausedPollers.delete(channel);
      console.log(`  [poll] POLL        ${channel}  (polling resumed)`);
      const fn = refreshRegistry.get(channel);
      if (fn) void fn(); // immediate fetch on switch back to poll
    }
    savePollSettings();
    json(res, 200, { ok: true, channel, mode });
    return;
  }

  // GET /api/poll/status  — return current pause and webhook state for all
  // known channels so the dashboard can reflect server-side state on load.
  if (pathname === '/api/poll/status' && method === 'GET') {
    json(res, 200, {
      paused: [...pausedPollers],
      webhookChannels: [...webhookMode],
      intervals: Object.fromEntries(pollerCustomIntervals),
    });
    return;
  }

  // ── On-demand refresh ─────────────────────────────────────────────────────
  // POST /api/refresh/:event  — immediately re-fetches and broadcasts the
  // named SSE event to all connected clients.
  if (pathname.startsWith('/api/refresh/') && method === 'POST') {
    const event = pathname.slice('/api/refresh/'.length);
    const fn = refreshRegistry.get(event);
    if (!fn) { json(res, 404, { error: `No registered poller for event: ${event}` }); return; }
    await fn();
    json(res, 200, { ok: true, event });
    return;
  }

  // ── Provider routes (delegated to provider modules) ───────────────────────
  const providerBody = await readBody(req);
  for (const handler of providerHandlers) {
    const handled = await handler(req, res, url, pathname, method, providerBody);
    if (handled) return;
  }

  // ── Webhook receive (provider → dashboard) ─────────────────────────────────
  // Each route verifies the provider signature then triggers a refresh of the
  // relevant SSE channel so connected tiles get an immediate data update.
  if (pathname.startsWith('/api/webhooks/') && method === 'POST') {
    const body = providerBody;

    // Helper: trigger an immediate refresh for a channel if a poller is registered.
    const triggerRefresh = (channel: string) => {
      const fn = refreshRegistry.get(channel);
      if (fn) {
        console.log(`  [webhook] trigger refresh  ${channel}`);
        void fn();
      } else {
        console.log(`  [webhook] no poller for    ${channel}  (channel refreshed inline)`);
      }
    };

    // POST /api/webhooks/stripe
    if (pathname === '/api/webhooks/stripe') {
      const secret = process.env['STRIPE_WEBHOOK_SECRET'];
      const sig    = req.headers['stripe-signature'] as string | undefined;
      let eventType = 'unknown';
      try {
        const stripe = getStripe();
        if (stripe && secret && sig) {
          const evt = stripe.webhooks.constructEvent(body, sig, secret);
          eventType = evt.type;
        } else if (secret && sig) {
          // Manual HMAC-SHA256 verification if Stripe SDK unavailable
          const { createHmac } = await import('crypto');
          const ts = sig.split(',').find(p => p.startsWith('t='))?.slice(2) ?? '';
          const v1 = sig.split(',').find(p => p.startsWith('v1='))?.slice(3) ?? '';
          const expected = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
          if (expected !== v1) { json(res, 400, { error: 'Invalid Stripe signature' }); return; }
          eventType = (JSON.parse(body) as { type?: string }).type ?? 'unknown';
        } else {
          eventType = (JSON.parse(body) as { type?: string }).type ?? 'unknown';
        }
      } catch {
        json(res, 400, { error: 'Invalid Stripe webhook payload' });
        return;
      }
      console.log(`  [webhook] stripe  event=${eventType}`);
      // Route to appropriate SSE channel(s) based on event prefix.
      if (eventType.startsWith('customer.subscription')) {
        triggerRefresh('stripe-subscriptions');
      } else if (
        eventType.startsWith('payment_intent') ||
        eventType.startsWith('charge') ||
        eventType.startsWith('checkout.session')
      ) {
        triggerRefresh('stripe-payments');
      } else {
        // Fallback: refresh all commonly polled stripe channels.
        triggerRefresh('stripe-payments');
        triggerRefresh('stripe-subscriptions');
      }
      triggerRefresh('stripe-webhooks');
      json(res, 200, { received: true });
      return;
    }

    // POST /api/webhooks/github
    if (pathname === '/api/webhooks/github') {
      const secret = process.env['GITHUB_WEBHOOK_SECRET'];
      const sig    = req.headers['x-hub-signature-256'] as string | undefined;
      if (secret && sig) {
        const { createHmac } = await import('crypto');
        const expected = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
        if (expected !== sig) { json(res, 400, { error: 'Invalid GitHub signature' }); return; }
      }
      const event = req.headers['x-github-event'] as string | undefined;
      console.log(`  [webhook] github  event=${event ?? 'unknown'}`);
      triggerRefresh('github-runs');
      json(res, 200, { received: true });
      return;
    }

    // POST /api/webhooks/paypal
    if (pathname === '/api/webhooks/paypal') {
      const secret = process.env['PAYPAL_WEBHOOK_SECRET'];
      const sig    = req.headers['paypal-transmission-sig'] as string | undefined;
      if (secret && sig) {
        // Simplified HMAC-SHA256 verification using shared secret.
        // For full certificate-based verification use the PayPal SDK.
        const { createHmac } = await import('crypto');
        const expected = createHmac('sha256', secret).update(body).digest('base64');
        if (expected !== sig) { json(res, 400, { error: 'Invalid PayPal signature' }); return; }
      }
      const eventType = (JSON.parse(body) as { event_type?: string }).event_type ?? 'unknown';
      console.log(`  [webhook] paypal  event=${eventType}`);
      triggerRefresh('paypal-data');
      json(res, 200, { received: true });
      return;
    }

    // POST /api/webhooks/vercel
    if (pathname === '/api/webhooks/vercel') {
      const secret = process.env['VERCEL_WEBHOOK_SECRET'];
      const sig    = req.headers['x-vercel-signature'] as string | undefined;
      if (secret && sig) {
        const { createHmac } = await import('crypto');
        const expected = createHmac('sha1', secret).update(body).digest('hex');
        if (expected !== sig) { json(res, 400, { error: 'Invalid Vercel signature' }); return; }
      }
      const eventType = (JSON.parse(body) as { type?: string }).type ?? 'unknown';
      console.log(`  [webhook] vercel  event=${eventType}`);
      triggerRefresh('vercel-deployments');
      json(res, 200, { received: true });
      return;
    }

    // POST /api/webhooks/netlify
    if (pathname === '/api/webhooks/netlify') {
      const secret = process.env['NETLIFY_WEBHOOK_SECRET'];
      const sig    = req.headers['x-webhook-signature'] as string | undefined;
      if (secret && sig) {
        const { createHmac } = await import('crypto');
        const expected = createHmac('sha256', secret).update(body).digest('hex');
        if (expected !== sig) { json(res, 400, { error: 'Invalid Netlify signature' }); return; }
      }
      const eventType = (JSON.parse(body) as { event?: string }).event ?? 'unknown';
      console.log(`  [webhook] netlify event=${eventType}`);
      triggerRefresh('netlify-deployments');
      json(res, 200, { received: true });
      return;
    }

    json(res, 404, { error: `Unknown webhook route: ${pathname}` });
    return;
  }

  // ── Tile data report (client-side tiles → MCP cache) ─────────────────────
  // POST /api/tiles/:id/data  { data: unknown }
  // Fire-and-forget from client tiles; stores value in resourceCache so MCP
  // get_tile_data can serve it. Rate-limited to 1 write/tile/second.
  if (pathname.startsWith('/api/tiles/') && pathname.endsWith('/data') && method === 'POST') {
    const tileId = pathname.slice('/api/tiles/'.length, -'/data'.length);
    if (tileId) {
      const now = Date.now();
      const lastKey = `tile-data-ts:${tileId}`;
      const last = (resourceCache.get(lastKey) as number | undefined) ?? 0;
      if (now - last >= 1000) {
        resourceCache.set(lastKey, now);
        const body = await readBody(req);
        try {
          const payload = JSON.parse(body) as { data: unknown };
          resourceCache.set(tileId, payload.data);
        } catch { /* malformed body — ignore */ }
      }
    }
    json(res, 200, { ok: true });
    return;
  }

  json(res, 404, { error: 'Not found' });
}

// ── Entrypoint ────────────────────────────────────────────────────────────────
if ((import.meta as { main?: boolean }).main) {
  const PORT     = parseInt(process.env['API_PORT'] ?? '3001', 10);
  const API_HOST = process.env['API_HOST'] ?? '0.0.0.0';

  // ── WebSocket server (FLINT real-time) ────────────────────────────────────
  createWsServer();
  setTokenVerifier(verifyJwt);
  recoverStuckCommands();

  // Wire command executor: calls LOPC via flintFetch and returns parsed JSON
  setCommandExecutor(async (method, path, payload) => {
    const options: RequestInit = { method };
    if (payload != null) {
      options.body = JSON.stringify(payload);
      options.headers = { 'Content-Type': 'application/json' };
    }
    const r = await flintFetch(path, options);
    if (!r.ok) throw new Error(`FLINT ${r.status}: ${await r.text()}`);
    return r.json();
  });

  startProcessingLoop();
  onCommandLifecycle({
    onStart: (row) => broadcastCommandProgress(row.id),
    onComplete: (row) => {
      broadcastCommandResult(row.id, 'completed', row.result ? JSON.parse(row.result) : undefined);
      // Re-poll the affected resource so SSE + WS subscribers get fresh data
      void refreshRegistry.get(row.resource)?.();
    },
    onFailed: (row) => broadcastCommandResult(row.id, 'failed', undefined, row.error ?? 'Unknown error'),
  });

  // Purge expired cache rows every 10 minutes
  setInterval(purgeExpired, 10 * 60 * 1000);

  const server = httpCreateServer((req, res) => {
    handleRequest(req, res).catch((err: unknown) => {
      console.error('API error:', err);
      json(res, 500, { error: 'Internal server error' });
    });
  });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/ws/flint') {
      handleWsUpgrade(req, socket, head);
    } else {
      socket.destroy();
    }
  });

  server.listen(PORT, API_HOST, () => {
    startPollers();

    const e = process.env;
    const ok  = (v: boolean, hint: string) => v ? '✓' : `✗  (${hint})`;

    // ── provider flags ────────────────────────────────────────────────────────
    const cfgs: [string, boolean, string][] = [
      // [label, configured, missing-hint]
      ['Stripe',       getStripe() !== null,                                   'STRIPE_SECRET_KEY'],
      ['GitHub',       !!(e['GITHUB_TOKEN'] && e['GITHUB_ORG']),              'GITHUB_TOKEN + GITHUB_ORG'],
      ['Cloudflare',   !!(e['CF_API_TOKEN'] && e['CF_ACCOUNT_ID']),           'CF_API_TOKEN + CF_ACCOUNT_ID'],
      ['PayPal',       !!(e['PAYPAL_CLIENT_ID'] && e['PAYPAL_CLIENT_SECRET']),'PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET'],
      // ── CI / DevOps ──────────────────────────────────────────────────────────
      ['Vercel',       !!(e['VERCEL_TOKEN']),                                  'VERCEL_TOKEN'],
      ['Netlify',      !!(e['NETLIFY_TOKEN']),                                 'NETLIFY_TOKEN'],
      ['CircleCI',     !!(e['CIRCLECI_TOKEN'] && e['CIRCLECI_ORG_SLUG']),     'CIRCLECI_TOKEN + CIRCLECI_ORG_SLUG'],
      ['Travis CI',    !!(e['TRAVIS_TOKEN'] && e['TRAVIS_ORG']),              'TRAVIS_TOKEN + TRAVIS_ORG'],
      ['Bitrise',      !!(e['BITRISE_TOKEN']),                                 'BITRISE_TOKEN'],
      ['Docker Hub',   !!(e['DOCKERHUB_USERNAME']),                            'DOCKERHUB_USERNAME'],
      ['SonarQube',    !!(e['SONARQUBE_URL'] && e['SONARQUBE_TOKEN']),        'SONARQUBE_URL + SONARQUBE_TOKEN'],
      ['Azure DevOps', !!(e['AZURE_DEVOPS_ORG'] && e['AZURE_DEVOPS_TOKEN']), 'AZURE_DEVOPS_ORG + AZURE_DEVOPS_TOKEN'],
      // ── Package / CDN ───────────────────────────────────────────────────────
      ['npm Registry', !!(e['NPM_PACKAGES']),                                  'NPM_PACKAGES'],
      ['jsDelivr',     !!(e['JSDELIVR_PACKAGES']),                             'JSDELIVR_PACKAGES'],
      // ── Productivity ────────────────────────────────────────────────────────
      ['WakaTime',     !!(e['WAKATIME_API_KEY']),                              'WAKATIME_API_KEY'],
      ['Clockify',     !!(e['CLOCKIFY_API_KEY'] && e['CLOCKIFY_WORKSPACE_ID']),'CLOCKIFY_API_KEY + CLOCKIFY_WORKSPACE_ID'],
      ['Linear',       !!(e['LINEAR_API_KEY']),                                'LINEAR_API_KEY'],
      ['Jira',         !!(e['JIRA_HOST'] && e['JIRA_EMAIL'] && e['JIRA_API_TOKEN']), 'JIRA_HOST + JIRA_EMAIL + JIRA_API_TOKEN'],
      // ── Comms ────────────────────────────────────────────────────────────────
      ['Slack',        !!(e['SLACK_BOT_TOKEN']),                               'SLACK_BOT_TOKEN'],
      ['Discord',      !!(e['DISCORD_BOT_TOKEN']),                             'DISCORD_BOT_TOKEN'],
      ['Mailchimp',    !!(e['MAILCHIMP_API_KEY']),                             'MAILCHIMP_API_KEY'],
      // ── Analytics ────────────────────────────────────────────────────────────
      ['GA4',          !!(e['GA4_PROPERTY_ID'] && e['GA4_SERVICE_ACCOUNT_JSON']), 'GA4_PROPERTY_ID + GA4_SERVICE_ACCOUNT_JSON'],
      ['Instatus',     !!(e['INSTATUS_PAGE_ID']),                              'INSTATUS_PAGE_ID'],
      ['Hacker News',  true,                                                   ''],   // always on — public API
      // ── Finance ──────────────────────────────────────────────────────────────
      ['Alpha Vantage', !!(e['ALPHA_VANTAGE_KEY'] && e['AV_SYMBOLS']),        'ALPHA_VANTAGE_KEY + AV_SYMBOLS'],
      ['CoinGecko',    !!(e['COINGECKO_COINS']),                               'COINGECKO_COINS'],
      ['Finnhub',      !!(e['FINNHUB_TOKEN'] && e['FH_SYMBOLS']),             'FINNHUB_TOKEN + FH_SYMBOLS'],
      ['Plaid',        !!(e['PLAID_ACCESS_TOKEN'] && e['PLAID_CLIENT_ID'] && e['PLAID_SECRET']), 'PLAID_ACCESS_TOKEN + PLAID_CLIENT_ID + PLAID_SECRET'],
      // ── Security ─────────────────────────────────────────────────────────────
      ['HIBP',         !!(e['HIBP_API_KEY'] && e['HIBP_EMAILS']),             'HIBP_API_KEY + HIBP_EMAILS'],
      ['VirusTotal',   !!(e['VIRUSTOTAL_API_KEY'] && e['VT_DOMAINS']),        'VIRUSTOTAL_API_KEY + VT_DOMAINS'],
      ['Shodan',       !!(e['SHODAN_API_KEY']),                                'SHODAN_API_KEY'],
      // ── E-commerce ───────────────────────────────────────────────────────────
      ['WooCommerce',  !!(e['WC_BASE_URL'] && e['WC_CONSUMER_KEY'] && e['WC_CONSUMER_SECRET']), 'WC_BASE_URL + WC_CONSUMER_KEY + WC_CONSUMER_SECRET'],
      ['Shopify',      !!(e['SHOPIFY_SHOP'] && e['SHOPIFY_ACCESS_TOKEN']),    'SHOPIFY_SHOP + SHOPIFY_ACCESS_TOKEN'],
      // ── Social ────────────────────────────────────────────────────────────────
      ['Reddit',       true /* subreddits configurable per-tile; REDDIT_SUBREDDITS is optional fallback */,    'REDDIT_SUBREDDITS (optional)'],
      ['Product Hunt', !!(e['PRODUCTHUNT_API_TOKEN']),                         'PRODUCTHUNT_API_TOKEN'],
    ];

    const maxLabel = Math.max(...cfgs.map(([l]) => l.length));
    const configuredCount = cfgs.filter(([, v]) => v).length;

    console.log(`\nTWM API server → http://${API_HOST === '0.0.0.0' ? 'localhost' : API_HOST}:${PORT}`);
    console.log(`  ${configuredCount}/${cfgs.length} integrations configured\n`);

    // Group output by category
    const groups: [string, string[]][] = [
      ['Payments & Billing',   ['Stripe','PayPal','WooCommerce','Shopify']],
      ['Deployments',          ['Vercel','Netlify']],
      ['CI / Build',           ['GitHub','CircleCI','Travis CI','Bitrise','SonarQube','Azure DevOps','Docker Hub']],
      ['Package / CDN',        ['npm Registry','jsDelivr']],
      ['Productivity',         ['WakaTime','Clockify','Linear','Jira']],
      ['Comms',                ['Slack','Discord','Mailchimp']],
      ['Analytics',            ['GA4','Instatus','Hacker News']],
      ['Finance',              ['Alpha Vantage','CoinGecko','Finnhub','Plaid']],
      ['Security',             ['HIBP','VirusTotal','Shodan']],
      ['Social',               ['Reddit','Product Hunt']],
      ['Infrastructure',       ['Cloudflare']],
    ];

    for (const [groupName, labels] of groups) {
      console.log(`  ── ${groupName}`);
      for (const label of labels) {
        const cfg = cfgs.find(([l]) => l === label);
        if (!cfg) continue;
        const [, v, hint] = cfg;
        const pad = label.padEnd(maxLabel);
        console.log(`    ${pad}  ${ok(v, hint)}`);
      }
    }
    console.log('');
  });
}
