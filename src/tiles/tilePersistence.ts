import type { TileConfig } from './TileConfig';

const STORAGE_PREFIX = 'twm-tiles-';

export function saveTileLayout(workspaceName: string, tiles: TileConfig[]): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${workspaceName}`, JSON.stringify(tiles));
  } catch {
    // localStorage unavailable (SSR, private mode, etc.)
  }
}

export function loadTileLayout(workspaceName: string): TileConfig[] | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${workspaceName}`);
    if (!raw) return null;
    return JSON.parse(raw) as TileConfig[];
  } catch {
    return null;
  }
}

export function clearTileLayout(workspaceName: string): void {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${workspaceName}`);
  } catch {
    // noop
  }
}

// ── Server-backed layout persistence (used when auth is enabled) ──────────────

/**
 * Load a tile layout from the server for the current authenticated user.
 * Returns null if not found or on error (caller should fall back to localStorage).
 */
function getAuthHeaders(): Record<string, string> {
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('twm-jwt') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch { return {}; }
}

export async function loadLayoutFromServer(workspaceName: string, apiBase: string): Promise<TileConfig[] | null> {
  try {
    const res = await fetch(`${apiBase}/api/layout/${encodeURIComponent(workspaceName)}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return null;
    const data = await res.json() as { tiles: TileConfig[] | null };
    return data.tiles;
  } catch {
    return null;
  }
}

/**
 * Save a tile layout to the server for the current authenticated user.
 * Runs fire-and-forget — layout is always saved to localStorage first.
 */
export async function saveLayoutToServer(workspaceName: string, tiles: TileConfig[], apiBase: string): Promise<void> {
  try {
    await fetch(`${apiBase}/api/layout/${encodeURIComponent(workspaceName)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ tiles }),
    });
  } catch {
    // noop — localStorage is the ground truth fallback
  }
}
