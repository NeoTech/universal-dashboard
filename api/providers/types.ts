/**
 * Shared types for provider modules extracted from api/server.ts.
 * Each provider receives a ServerContext via its register() function.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

// ── Shared response helpers ────────────────────────────────────────────────

/**
 * Writes a JSON-serialised `data` value to `res` with CORS headers.
 *
 * @param res    - The active HTTP response object.
 * @param status - HTTP status code, e.g. `200`, `404`, `502`.
 * @param data   - Any JSON-serialisable value; written as the response body.
 */
export type JsonFn = (res: ServerResponse, status: number, data: unknown) => void;

/**
 * Reads the complete HTTP request body and returns it as a UTF-8 string.
 *
 * @param req - The incoming HTTP request whose body stream will be consumed.
 * @returns A promise that resolves to the full body text once the stream ends.
 */
export type ReadBodyFn = (req: IncomingMessage) => Promise<string>;

/**
 * Executes an async handler and serialises the result as a `200 OK` JSON response.
 * If `fn` throws, the error message is caught and sent as a `502 Bad Gateway`
 * JSON response so individual route handlers do not need their own try/catch.
 *
 * @param res - The active HTTP response object.
 * @param fn  - Async factory that produces the response payload.
 */
export type RouteFn = <T>(res: ServerResponse, fn: () => Promise<T>) => Promise<void>;

// ── Context passed to every provider ──────────────────────────────────────

/**
 * Dependency-injection object passed to every provider's `register()` function.
 *
 * It exposes the server's shared infrastructure (response helpers, SSE engine,
 * pollers, caches) so providers can register routes and pollers without
 * importing anything from `server.ts` directly — avoiding circular dependencies
 * and making individual providers independently testable.
 */
export interface ServerContext {
  // ── Response helpers ───────────────────────────────────────────────────────

  /** Write a JSON body with CORS headers. Delegates to the server-level `json()` helper. */
  json: JsonFn;

  /** Read the full HTTP request body as a UTF-8 string. */
  readBody: ReadBodyFn;

  /**
   * Execute an async handler, writing a `200` response on success or a `502`
   * response on error. Providers use this to avoid boilerplate try/catch blocks.
   */
  route: RouteFn;

  // ── SSE / polling engine ───────────────────────────────────────────────────

  /**
   * Register a recurring server-side poller for an SSE channel.
   *
   * Runs `fn` once immediately (to pre-populate the cache), then on a timer.
   * The effective interval may be overridden by `pollerCustomIntervals` or the
   * per-provider `POLL_INTERVAL_*` env var. If the channel is paused or in
   * webhook mode the timer is suspended, but the initial fetch still runs.
   *
   * @param event - SSE event name / channel identifier (e.g. `"stripe-payments"`).
   * @param ms    - Default poll interval in milliseconds.
   * @param fn    - Async data-fetch function; its return value is broadcast via SSE.
   * @param initialDelayMs - Optional delay (ms) before the first run. Use to
   *   stagger aggregation pollers so primary pollers can warm up their caches
   *   before aggregation functions execute.
   */
  poll(event: string, ms: number, fn: () => Promise<unknown>, initialDelayMs?: number): void;

  /**
   * Broadcast an SSE event to all connected clients **and** store the data in
   * `resourceCache` so new clients receive it immediately on connect.
   *
   * @param event - SSE event name.
   * @param data  - JSON-serialisable payload.
   */
  broadcastSse(event: string, data: unknown): void;

  /**
   * Broadcast an SSE event to all connected clients **without** caching it.
   * Use this for ephemeral commands (e.g. `tile-op`) that must not be replayed
   * to clients that connect after the event has already been applied.
   *
   * @param event - SSE event name.
   * @param data  - JSON-serialisable payload.
   */
  broadcastSseEphemeral(event: string, data: unknown): void;

  /**
   * Shared SSE resource cache: maps each SSE event name to the most-recently
   * broadcast payload. Entries are set by `broadcastSse()` and replayed to new
   * SSE clients on connect so tiles render immediately without waiting for the
   * next poll cycle.
   */
  resourceCache: Map<string, unknown>;

  /**
   * On-demand refresh registry: maps each SSE channel name to the zero-arg
   * async function that re-fetches and broadcasts data for that channel.
   * Populated by `poll()` and consumed by:
   * - `POST /api/refresh/:event` (user-triggered refresh)
   * - Webhook handlers (provider pushes → immediate re-fetch)
   */
  refreshRegistry: Map<string, () => Promise<void>>;

  // ── Provider API URL overrides ─────────────────────────────────────────────
  // Set from environment variables at startup; can be overridden in tests
  // to point at local mock servers instead of the real external APIs.

  /** Stripe REST API base URL. Defaults to `https://api.stripe.com`. */
  STRIPE_API_URL: string;
  /** GitHub REST API base URL. Defaults to `https://api.github.com`. */
  GITHUB_API_URL: string;
  /** Cloudflare API base URL. Defaults to `https://api.cloudflare.com/client/v4`. */
  CLOUDFLARE_API_URL: string;
  /** PayPal API base URL. Empty string defers to `PAYPAL_ENV` logic in the PayPal provider. */
  PAYPAL_API_URL: string;
  /** Optional prefix prepended to relative proxy URLs (Custom API tiles). */
  BACKEND_BASE_URL: string;
}

// ── Route handler contract ─────────────────────────────────────────────────

/**
 * A provider route handler registered by a provider's `register()` function.
 *
 * The server calls every registered handler in order for each incoming request.
 * The handler must write a response and return `true` to claim the request, or
 * return `false` (without touching `res`) to pass it to the next handler.
 *
 * @param req    - The raw Node.js `IncomingMessage`.
 * @param res    - The raw Node.js `ServerResponse`; write to it before returning `true`.
 * @param url    - Pre-parsed `URL` object (base is `http://localhost`).
 * @param path   - The URL pathname, e.g. `"/api/stripe/payments"`.
 * @param method - Upper-cased HTTP method, e.g. `"GET"`, `"POST"`.
 * @param body   - The complete request body as a UTF-8 string (may be empty).
 * @returns `true` if the request was handled, `false` to pass to the next handler.
 */
export type ProviderRouteHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  path: string,
  method: string,
  body: string,
) => boolean | Promise<boolean>;

/**
 * The shape of the `register` export that every provider module must expose.
 *
 * Calling `register(ctx)` should:
 * 1. Use `ctx.poll()` to set up any recurring data pollers.
 * 2. Return a `ProviderRouteHandler` that handles HTTP requests for the provider.
 *
 * @param ctx - The shared {@link ServerContext} injected by `server.ts`.
 * @returns A route handler that claims provider-specific requests.
 */
export type RegisterFn = (ctx: ServerContext) => ProviderRouteHandler;
