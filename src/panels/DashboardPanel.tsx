import { createSignal, onMount, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { TileGrid } from '../tiles/TileGrid';
import { AddTileModal } from '../tiles/AddTileModal';
import { TileConfigModal } from '../tiles/TileConfigModal';
import { EnvConfigModal } from '../tiles/EnvConfigModal';
import { renderTile } from '../tiles/renderTile';
import { makeTile } from '../tiles/TileConfig';
import type { TileConfig, TileType } from '../tiles/TileConfig';
import { TILE_SSE_CHANNEL, WEBHOOK_CAPABLE } from '../tiles/TileConfig';
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
  const [importPending, setImportPending] = createSignal<TileConfig[] | null>(null);
  const [importError, setImportError] = createSignal('');
  const [clearPending, setClearPending] = createSignal(false);
  /** Position pre-seeded from a double-click on empty canvas. Cleared after use. */
  const [addAtPosition, setAddAtPosition] = createSignal<{ x: number; y: number } | null>(null);

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

    // Sync webhook delivery modes — covers first load on a fresh server (no
    // poll-settings.json) where the server doesn't yet know which channels the
    // user configured as webhook-delivered.
    const webhookChannels = new Set<string>();
    for (const t of loaded) {
      if (t.deliveryMode === 'webhook' && WEBHOOK_CAPABLE.has(t.type)) {
        webhookChannels.add(TILE_SSE_CHANNEL[t.type] ?? t.type);
      }
    }
    for (const channel of webhookChannels) {
      void fetch(`${API_BASE_URL}/api/poll/set-delivery/${channel}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'webhook' }),
      });
    }
  });

  function handleLayoutChange(updated: TileConfig[]): void {
    setTiles(updated);
    persistLayout(updated);
  }

  function handleAddTile(tile: TileConfig): void {
    const pos = addAtPosition();
    const placed = pos ? { ...tile, x: pos.x, y: pos.y } : tile;
    setAddAtPosition(null);
    const updated = [...tiles(), placed];
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

  function handleExport(): void {
    const json = JSON.stringify(tiles(), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-${props.panelId ?? 'default'}-${date}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  let importInputRef: HTMLInputElement | undefined;

  function handleImportFile(e: Event): void {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!importInputRef) return;
    importInputRef.value = ''; // reset so the same file can be re-selected
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as unknown;
        if (!Array.isArray(parsed)) throw new Error('Expected a JSON array at the root.');
        for (const item of parsed as unknown[]) {
          if (typeof item !== 'object' || item === null) throw new Error('Each tile must be an object.');
          const t = item as Record<string, unknown>;
          for (const field of ['id', 'type', 'x', 'y', 'w', 'h'] as const) {
            if (!(field in t)) throw new Error(`Tile is missing required field "${field}".`);
          }
        }
        setImportError('');
        setImportPending(parsed as TileConfig[]);
      } catch (err: unknown) {
        setImportError(err instanceof Error ? err.message : 'Invalid JSON file.');
        setImportPending(null);
      }
    };
    reader.readAsText(file);
  }

  function confirmImport(): void {
    const pending = importPending();
    if (!pending) return;
    setTiles(pending);
    persistLayout(pending);
    setImportPending(null);
  }

  function confirmClear(): void {
    setTiles([]);
    persistLayout([]);
    setClearPending(false);
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
          <button class="btn btn--neutral btn--sm" title="Export dashboard as JSON" onClick={handleExport}>
            Export
          </button>
          <button
            class="btn btn--neutral btn--sm"
            title="Import dashboard from JSON file"
            onClick={() => importInputRef?.click()}
          >
            Import
          </button>
          <button
            class="btn btn--danger btn--sm"
            title="Clear all tiles from this dashboard"
            onClick={() => setClearPending(true)}
          >
            Clear
          </button>
          {/* Hidden file picker for import */}
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
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
          onAddAtPosition={(x, y) => { setAddAtPosition({ x, y }); setModalOpen(true); }}
        />
      </div>

      {/* Add tile modal */}
      <AddTileModal
        isOpen={modalOpen()}
        onAdd={handleAddTile}
        onClose={() => { setModalOpen(false); setAddAtPosition(null); }}
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

      {/* Clear confirm banner */}
      <Show when={clearPending()}>
        <div class="dashboard-import-confirm">
          <span>This will remove all {tiles().length} tile{tiles().length !== 1 ? 's' : ''} from the dashboard. Continue?</span>
          <div class="dashboard-import-confirm__actions">
            <button class="btn btn--danger btn--sm" onClick={confirmClear}>Clear dashboard</button>
            <button class="btn btn--neutral btn--sm" onClick={() => setClearPending(false)}>Cancel</button>
          </div>
        </div>
      </Show>

      {/* Import confirm banner */}
      <Show when={importPending() !== null}>
        <div class="dashboard-import-confirm">
          <span>This will replace your current dashboard ({importPending()?.length ?? 0} tiles). Continue?</span>
          <div class="dashboard-import-confirm__actions">
            <button class="btn btn--danger btn--sm" onClick={confirmImport}>Replace dashboard</button>
            <button class="btn btn--neutral btn--sm" onClick={() => setImportPending(null)}>Cancel</button>
          </div>
        </div>
      </Show>
      <Show when={importError().length > 0}>
        <div class="dashboard-import-error">
          Import failed: {importError()}
          <button class="btn btn--neutral btn--sm" onClick={() => setImportError('')}>Dismiss</button>
        </div>
      </Show>
    </div>
  );
}
