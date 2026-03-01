/**
 * MCP layout helpers — read/write per-user tile layouts from auth.db.
 *
 * Intentionally kept as a standalone module (no imports from server.ts)
 * to avoid circular dependencies. Broadcasting (broadcastSse) is handled
 * by the caller in server.ts.
 */

import { Database } from 'bun:sqlite';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUTH_DB_PATH = join(__dirname, '..', 'auth.db');

// Open a separate, read/write connection to auth.db.
// bun:sqlite allows multiple connections; WAL mode prevents lock contention.
const layoutDb = new Database(AUTH_DB_PATH, { create: true });
layoutDb.run('PRAGMA journal_mode=WAL');
layoutDb.run(`CREATE TABLE IF NOT EXISTS tile_layouts (
  user_id    INTEGER NOT NULL,
  workspace  TEXT    NOT NULL,
  tiles_json TEXT    NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, workspace)
)`);

const stmtGetLayout = layoutDb.prepare<{ tiles_json: string }, [number, string]>(
  'SELECT tiles_json FROM tile_layouts WHERE user_id = ? AND workspace = ?',
);
const stmtUpsertLayout = layoutDb.prepare<void, [number, string, string, number]>(
  'INSERT INTO tile_layouts (user_id, workspace, tiles_json, updated_at) VALUES (?, ?, ?, ?) ' +
  'ON CONFLICT(user_id, workspace) DO UPDATE SET tiles_json=excluded.tiles_json, updated_at=excluded.updated_at',
);

/**
 * Return the tile layout for a given user + workspace.
 * Falls back to an empty array if no layout has been saved yet.
 */
export function readLayout(userId: number, workspace: string): unknown[] {
  const row = stmtGetLayout.get(userId, workspace);
  if (!row) return [];
  try { return JSON.parse(row.tiles_json) as unknown[]; } catch { return []; }
}

export function listWorkspaces(userId: number): string[] {
  const rows = layoutDb.prepare<{ workspace: string }, [number]>(
    'SELECT workspace FROM tile_layouts WHERE user_id = ? ORDER BY updated_at DESC',
  ).all(userId);
  return rows.map((r) => r.workspace);
}

/**
 * Persist a tile layout for a given user + workspace.
 */
export function writeLayout(userId: number, workspace: string, tiles: unknown[]): void {
  stmtUpsertLayout.run(userId, workspace, JSON.stringify(tiles), Math.floor(Date.now() / 1000));
}
