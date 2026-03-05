/**
 * Shared SQLite database instance for auth.db.
 *
 * Both server.ts and mcp-layout.ts need access to the same database.
 * This module provides a single connection with WAL mode to prevent
 * lock contention while eliminating duplicate connections.
 */

import { Database } from 'bun:sqlite';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUTH_DB_PATH = join(__dirname, '..', 'auth.db');

/**
 * Shared SQLite database connection for `auth.db`.
 *
 * Uses WAL journal mode to allow concurrent reads from `server.ts` and
 * `mcp-layout.ts` without lock contention. The database file is created
 * automatically next to the workspace root if it does not exist.
 *
 * Schema managed by inline `CREATE TABLE IF NOT EXISTS` migrations below.
 */
export const authDb = new Database(AUTH_DB_PATH, { create: true });
authDb.run('PRAGMA journal_mode=WAL');

// ── Schema migrations ────────────────────────────────────────────────────────
authDb.run(`CREATE TABLE IF NOT EXISTS users (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT    UNIQUE NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
)`);
authDb.run(`CREATE TABLE IF NOT EXISTS tile_layouts (
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace    TEXT    NOT NULL,
  tiles_json   TEXT    NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (user_id, workspace)
)`);
