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

export async function loadLayoutFromServer(workspaceName: string, apiBase: string, signal?: AbortSignal): Promise<TileConfig[] | null> {
  try {
    const res = await fetch(`${apiBase}/api/layout/${encodeURIComponent(workspaceName)}`, {
      headers: getAuthHeaders(),
      signal,
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
export async function saveLayoutToServer(workspaceName: string, tiles: TileConfig[], apiBase: string, signal?: AbortSignal): Promise<void> {
  try {
    const res = await fetch(`${apiBase}/api/layout/${encodeURIComponent(workspaceName)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ tiles }),
      signal,
    });
    if (!res.ok) console.warn(`[saveLayout] server returned ${res.status} for ${workspaceName}`);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return;
    console.warn('[saveLayout] failed:', e);
  }
}

/**
 * Delete a tile layout from the server (called when a dashboard is closed).
 * localStorage must be cleared by the caller before this. Fire-and-forget.
 */
export async function deleteLayoutFromServer(workspaceName: string, apiBase: string): Promise<boolean> {
  try {
    const res = await fetch(`${apiBase}/api/layout/${encodeURIComponent(workspaceName)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      console.warn(`[deleteLayout] server returned ${res.status} for ${workspaceName}`);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[deleteLayout] failed:', e);
    return false;
  }
}

/**
 * Fetch the list of workspace names known to the server for the current user.
 * Returns an empty array on error or when unauthenticated.
 */
export async function loadWorkspacesFromServer(apiBase: string): Promise<string[]> {
  try {
    const res = await fetch(`${apiBase}/api/workspaces`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json() as { workspaces: string[] };
    return data.workspaces ?? [];
  } catch {
    return [];
  }
}
