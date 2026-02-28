import { createSignal, onMount, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { TileGrid } from '../tiles/TileGrid';
import { AddTileModal } from '../tiles/AddTileModal';
import { TileConfigModal } from '../tiles/TileConfigModal';
import { EnvConfigModal } from '../tiles/EnvConfigModal';
import { renderTile } from '../tiles/renderTile';
import { makeTile } from '../tiles/TileConfig';
import type { TileConfig, TileType } from '../tiles/TileConfig';
import { TILE_SSE_CHANNEL } from '../tiles/TileConfig';
import { saveTileLayout, loadTileLayout, loadLayoutFromServer, saveLayoutToServer } from '../tiles/tilePersistence';
import { API_BASE_URL } from '../data/api';
import { useAuth } from '../ui/AuthContext';


/** Tile types that self-poll and don't have a server-side SSE channel. */
const SELF_POLLING_TYPES = new Set<TileType>(['rss-feed', 'rest', 'websocket']);

/**
 * Merge all tiles that share the same SSE channel into one effective setting.
 * Rule: if ANY tile on a channel wants polling active (ms > 0), the channel
 * stays active at the minimum non-zero interval across those tiles. A channel
 * is only paused when EVERY tile sharing it has refreshInterval === 0.
 */
function resolveChannelSettings(tileset: TileConfig[]): Map<string, number> {
  const resolved = new Map<string, number>();
  for (const t of tileset) {
    if (SELF_POLLING_TYPES.has(t.type) || t.refreshInterval === undefined) continue;
    const ch = TILE_SSE_CHANNEL[t.type] ?? t.type;
    const ms = t.refreshInterval;
    const current = resolved.get(ch);
    if (current === undefined) {
      resolved.set(ch, ms);
    } else if (ms === 0) {
      // This tile wants paused — only wins if everything else also wants paused.
      // Leave current as-is (keep the active setting if there is one).
    } else {
      // Active tile: use minimum non-zero interval; also overrides any prior pause.
      resolved.set(ch, current === 0 ? ms : Math.min(current, ms));
    }
  }
  return resolved;
}

function syncChannelToServer(channel: string, ms: number): void {
  if (ms === 0) {
    void fetch(`${API_BASE_URL}/api/poll/pause/${channel}`, { method: 'POST' });
  } else {
    void fetch(`${API_BASE_URL}/api/poll/resume/${channel}`, { method: 'POST' });
    void fetch(`${API_BASE_URL}/api/poll/set-interval/${channel}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ms }),
    });
  }
}

interface Props {
  panelId: string;
  workspaceName?: string;
}

const TOOLBAR_H = 37; // dashboard toolbar height + border
const STATUS_H = 25;  // status bar height + border

function defaultTiles(): TileConfig[] {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight - STATUS_H - TOOLBAR_H : 658;
  // Split canvas into 4 equal quadrants with 8px gutters
  const gap = 8;
  const hw = Math.floor((vw / 2 - gap * 1.5) / 16) * 16; // half-width snapped
  const hh = Math.floor((vh / 2 - gap * 1.5) / 16) * 16;  // half-height snapped
  return [
    makeTile('stripe-payments',  { x: gap, y: gap, w: hw, h: hh }),
    makeTile('stripe-orders',    { x: gap * 2 + hw, y: gap, w: hw, h: hh }),
    makeTile('stripe-revenue',   { x: gap, y: gap * 2 + hh, w: hw, h: hh }),
    makeTile('stripe-customers', { x: gap * 2 + hw, y: gap * 2 + hh, w: hw, h: hh }),
  ];
}

export function DashboardPanel(props: Props): JSX.Element {
  const workspaceName = () => props.workspaceName ?? 'default';
  const auth = useAuth();
  const [tiles, setTiles] = createSignal<TileConfig[]>([]);
  const [modalOpen, setModalOpen] = createSignal(false);
  const [configuringTileId, setConfiguringTileId] = createSignal<string | null>(null);
  const [refreshingIds, setRefreshingIds] = createSignal<Set<string>>(new Set());
  const [envModalOpen, setEnvModalOpen] = createSignal(false);

  const configuringTile = () => {
    const id = configuringTileId();
    return id ? tiles().find((t) => t.id === id) ?? null : null;
  };

  /** Save to localStorage + server, deduplicated by channel for poll sync. */
  function persistLayout(updated: TileConfig[]): void {
    saveTileLayout(workspaceName(), updated);
    if (auth.isAuthenticated()) {
      void saveLayoutToServer(workspaceName(), updated, API_BASE_URL);
    }
  }

  onMount(() => {
    // Start with localStorage for instant render.
    const local = loadTileLayout(workspaceName());
    const initial = local ?? defaultTiles();
    setTiles(initial);

    // If authenticated, try to hydrate from the server (may be more up-to-date
    // if another device saved a layout). Server wins if it has a layout.
    if (auth.isAuthenticated()) {
      void loadLayoutFromServer(workspaceName(), API_BASE_URL).then((serverTiles) => {
        if (serverTiles) {
          setTiles(serverTiles);
          saveTileLayout(workspaceName(), serverTiles); // keep localStorage in sync
        }
      });
    }

    // Sync tile poll settings to the API server.
    const loaded = tiles();
    const resolved = resolveChannelSettings(loaded);
    const settings = [...resolved.entries()].map(([channel, ms]) => ({ channel, ms }));
    if (settings.length > 0) {
      void fetch(`${API_BASE_URL}/api/poll/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
    }
  });

  function handleLayoutChange(updated: TileConfig[]): void {
    setTiles(updated);
    persistLayout(updated);
  }

  function handleAddTile(tile: TileConfig): void {
    const updated = [...tiles(), tile];
    setTiles(updated);
    persistLayout(updated);
  }

  function handleRemoveTile(id: string): void {
    const updated = tiles().filter((t) => t.id !== id);
    setTiles(updated);
    persistLayout(updated);
  }

  function handleSaveTileConfig(updated: TileConfig): void {
    // Capture previous state before update for pause/resume comparison.
    const prev = tiles().find((t) => t.id === updated.id);

    const newTiles = tiles().map((t) => t.id === updated.id ? updated : t);
    setTiles(newTiles);
    persistLayout(newTiles);
    setConfiguringTileId(null);

    // Recompute the effective channel setting across all tiles sharing this channel,
    // then sync only that channel to the server. This avoids one tile's pause
    // silencing a channel another tile still wants active.
    if (prev && !SELF_POLLING_TYPES.has(updated.type)) {
      const channel = TILE_SSE_CHANNEL[updated.type] ?? updated.type;
      const resolved = resolveChannelSettings(newTiles);
      // Only send if this channel has an explicit setting.
      const effectiveMs = resolved.get(channel);
      if (effectiveMs !== undefined) {
        syncChannelToServer(channel, effectiveMs);
      }
    }
  }

  function handleRefreshTile(tileId: string): void {
    const tile = tiles().find((t) => t.id === tileId);
    if (!tile) return;
    // Self-polling tiles refresh via TileRefreshContext — no server POST needed
    if (SELF_POLLING_TYPES.has(tile.type)) return;
    const channel = TILE_SSE_CHANNEL[tile.type] ?? tile.type;
    setRefreshingIds((prev) => new Set([...prev, tileId]));
    void fetch(`${API_BASE_URL}/api/refresh/${channel}`, { method: 'POST' })
      .finally(() => {
        setRefreshingIds((prev) => {
          const next = new Set(prev);
          next.delete(tileId);
          return next;
        });
      });
  }

  function handleCopyTile(sourceId: string, x: number, y: number): void {
    const source = tiles().find((t) => t.id === sourceId);
    if (!source) return;
    // structuredClone ensures nested config objects (ws, rest, etc.) are not
    // shared by reference with the original tile — a shallow spread would cause
    // both tiles to mutate the same nested object when either is configured.
    const copy: TileConfig = { ...structuredClone(source), id: crypto.randomUUID(), x, y };
    const updated = [...tiles(), copy];
    setTiles(updated);
    persistLayout(updated);
  }

  return (
    <div class="dashboard-panel" data-panel-id={props.panelId} style={{ height: '100%', display: 'flex', 'flex-direction': 'column' }}>
      {/* Dashboard toolbar */}
      <div class="dashboard-toolbar">
        <span class="dashboard-toolbar__title">Dashboard</span>
        <div class="dashboard-toolbar__actions">
          <Show when={auth.isAuthenticated()}>
            <span class="dashboard-toolbar__user" title={`Signed in as ${auth.user()?.username ?? ''}`}>
              ⊞ {auth.user()?.username}
            </span>
            <button
              class="btn btn--neutral btn--sm"
              title="Sign out"
              onClick={() => auth.logout()}
            >
              Sign Out
            </button>
          </Show>
          <button
            class="btn btn--neutral btn--sm"
            aria-label="Edit environment variables"
            title="Edit .env variables"
            onClick={() => setEnvModalOpen(true)}
          >
            ⚙ .env
          </button>
          <button
            class="dashboard-toolbar__add-btn btn btn--primary"
            aria-label="Add tile"
            onClick={() => setModalOpen(true)}
          >
            + Add Tile
          </button>
        </div>
      </div>

      {/* Tile canvas */}
      <div style={{ flex: '1', overflow: 'hidden', position: 'relative' }}>
        <TileGrid
          tiles={tiles()}
          onLayoutChange={handleLayoutChange}
          renderTile={renderTile}
          onRemoveTile={handleRemoveTile}
          onConfigureTile={setConfiguringTileId}
          onRefreshTile={handleRefreshTile}
          isRefreshingTile={(id) => refreshingIds().has(id)}
          onTileCopy={handleCopyTile}
        />
      </div>

      {/* Add tile modal */}
      <AddTileModal
        isOpen={modalOpen()}
        onAdd={handleAddTile}
        onClose={() => setModalOpen(false)}
      />

      {/* Tile config modal */}
      <Show when={configuringTile()}>
        {(tile) => (
          <TileConfigModal
            tile={tile()}
            onSave={handleSaveTileConfig}
            onClose={() => setConfiguringTileId(null)}
          />
        )}
      </Show>

      {/* Env config modal */}
      <Show when={envModalOpen()}>
        <EnvConfigModal onClose={() => setEnvModalOpen(false)} />
      </Show>
    </div>
  );
}
