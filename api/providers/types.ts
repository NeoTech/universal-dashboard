/**
 * Shared types for provider modules extracted from api/server.ts.
 * Each provider receives a ServerContext via its register() function.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

// ── Shared response helpers ────────────────────────────────────────────────

/** Send a JSON response with CORS headers. */
export type JsonFn = (res: ServerResponse, status: number, data: unknown) => void;

/** Read the full HTTP request body as a string. */
export type ReadBodyFn = (req: IncomingMessage) => Promise<string>;

/** Wrap an async handler: 200 JSON on success, 502 JSON on error. */
export type RouteFn = <T>(res: ServerResponse, fn: () => Promise<T>) => Promise<void>;

// ── Context passed to every provider ──────────────────────────────────────

export interface ServerContext {
  // Response helpers
  json: JsonFn;
  readBody: ReadBodyFn;
  route: RouteFn;

  // SSE / polling engine
  /** Register a server-side poller for an SSE channel. */
  poll(event: string, ms: number, fn: () => Promise<unknown>): void;
  /** Broadcast SSE event, cached for new SSE clients. */
  broadcastSse(event: string, data: unknown): void;
  /** Broadcast SSE event WITHOUT caching (ephemeral mutations). */
  broadcastSseEphemeral(event: string, data: unknown): void;
  /** SSE resource cache keyed by event name. */
  resourceCache: Map<string, unknown>;
  /** On-demand refresh registry keyed by channel name. */
  refreshRegistry: Map<string, () => Promise<void>>;

  // Provider API URL overrides (set from env at startup for test mocking)
  STRIPE_API_URL: string;
  GITHUB_API_URL: string;
  CLOUDFLARE_API_URL: string;
  PAYPAL_API_URL: string;
  BACKEND_BASE_URL: string;
}

// ── Route handler contract ─────────────────────────────────────────────────

/**
 * A provider route handler.
 * Return true  → request was handled (response already written).
 * Return false → pass to the next handler.
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
 * Every provider module exports a register() function.
 * It sets up pollers via ctx.poll() and returns a ProviderRouteHandler.
 */
export type RegisterFn = (ctx: ServerContext) => ProviderRouteHandler;
