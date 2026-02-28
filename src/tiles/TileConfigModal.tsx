import { createSignal, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import type { TileConfig } from './TileConfig';
import { TILE_POLL_MS } from './TileConfig';
import { API_BASE_URL } from '../data/api';

interface Props {
  tile: TileConfig;
  onSave: (updated: TileConfig) => void;
  onClose: () => void;
}

export function TileConfigModal(props: Props): JSX.Element {
  const defaultIntervalMs = props.tile.refreshInterval ?? TILE_POLL_MS[props.tile.type] ?? 60_000;
  const defaultIntervalSec = Math.round(defaultIntervalMs / 1000);

  const [title, setTitle] = createSignal(props.tile.title ?? '');
  const [intervalSec, setIntervalSec] = createSignal(String(defaultIntervalSec));
  const [pageSize, setPageSize] = createSignal(String(props.tile.pageSize ?? 10));
  const [fetchLimit, setFetchLimit] = createSignal(String(props.tile.fetchLimit ?? ''));
  const [showLastUpdated, setShowLastUpdated] = createSignal(props.tile.showLastUpdated !== false);
  const [displayMode, setDisplayMode] = createSignal<'compact' | 'detailed'>(props.tile.displayMode ?? 'detailed');

  // RSS fields
  const [rssUrl, setRssUrl] = createSignal(props.tile.rss?.url ?? '');
  const [rssMaxItems, setRssMaxItems] = createSignal(String(props.tile.rss?.maxItems ?? 50));
  const rssUrlValid = () => {
    try { const u = new URL(rssUrl()); return u.protocol === 'http:' || u.protocol === 'https:'; }
    catch { return false; }
  };

  // REST fields
  const [restUrl, setRestUrl] = createSignal(props.tile.rest?.url ?? '');
  const [restHeaders, setRestHeaders] = createSignal(
    props.tile.rest?.headers ? JSON.stringify(props.tile.rest.headers, null, 2) : ''
  );
  const [restDisplayMode, setRestDisplayMode] = createSignal<'table' | 'json' | 'text'>(
    props.tile.rest?.displayMode ?? 'table'
  );

  // WebSocket fields
  const [wsUrl, setWsUrl] = createSignal(props.tile.ws?.url ?? '');
  const [wsMaxMessages, setWsMaxMessages] = createSignal(String(props.tile.ws?.maxMessages ?? 50));
  const [wsFields, setWsFields] = createSignal(props.tile.ws?.fields ?? '');
  const [wsFieldLabels, setWsFieldLabels] = createSignal(props.tile.ws?.fieldLabels ?? '');

  // Test-connection state (shared between REST and WS sections)
  const [testStatus, setTestStatus] = createSignal<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [testMessage, setTestMessage] = createSignal('');

  async function testConnection(type: 'rest' | 'ws'): Promise<void> {
    setTestStatus('loading');
    setTestMessage('');
    try {
      let headers: Record<string, string> = {};
      try { headers = JSON.parse(restHeaders() || '{}') as Record<string, string>; } catch { /* ignore */ }
      const body = type === 'rest'
        ? { type: 'rest', url: restUrl().trim(), headers }
        : { type: 'ws',  url: wsUrl().trim() };
      const res = await fetch(`${API_BASE_URL}/api/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { ok: boolean; status?: number; statusText?: string; preview?: string; error?: string };
      if (data.ok) {
        const msg = type === 'rest'
          ? `HTTP ${data.status ?? ''} ${data.statusText ?? ''}`.trim()
          : 'Connected successfully';
        setTestStatus('ok');
        setTestMessage(msg);
      } else {
        setTestStatus('error');
        setTestMessage(data.error ?? 'Connection failed');
      }
    } catch (e: unknown) {
      setTestStatus('error');
      setTestMessage(e instanceof Error ? e.message : 'Request failed');
    }
  }

  function handleSave(): void {
    const secs = parseInt(intervalSec(), 10);
    const ms = secs === 0 ? 0 : Math.max(5000, (secs || defaultIntervalSec) * 1000);
    const ps = parseInt(pageSize(), 10);
    const fl = parseInt(fetchLimit(), 10);
    const updated: TileConfig = {
      ...props.tile,
      title: title().trim() || undefined,
      refreshInterval: ms,
      pageSize: (ps >= 1 && ps <= 200) ? ps : undefined,
      fetchLimit: (fl >= 1) ? fl : undefined,
      showLastUpdated: showLastUpdated(),
      displayMode: displayMode(),
    };

    if (props.tile.type === 'rss-feed') {
      const mi = parseInt(rssMaxItems(), 10);
      updated.rss = {
        url: rssUrl().trim(),
        maxItems: (mi >= 1 && mi <= 200) ? mi : 50,
      };
    }

    if (props.tile.type === 'rest') {
      let headers: Record<string, string> = {};
      try { headers = JSON.parse(restHeaders() || '{}') as Record<string, string>; } catch { /* ignore */ }
      updated.rest = {
        url: restUrl().trim(),
        headers,
        refreshInterval: ms / 1000,
        displayMode: restDisplayMode(),
      };
    }

    if (props.tile.type === 'websocket') {
      updated.ws = {
        url: wsUrl().trim(),
        maxMessages: parseInt(wsMaxMessages(), 10) || 50,
        fields: wsFields().trim() || undefined,
        fieldLabels: wsFieldLabels().trim() || undefined,
      };
    }

    props.onSave(updated);
    props.onClose();
  }

  const isRss  = () => props.tile.type === 'rss-feed';
  const isRest = () => props.tile.type === 'rest';
  const isWs   = () => props.tile.type === 'websocket';

  const canSave = () => {
    if (isRss())  return rssUrlValid();
    if (isRest()) return restUrl().trim().length > 0;
    if (isWs())   return wsUrl().trim().length > 0;
    return true;
  };

  return (
    <div class="modal-overlay" onClick={props.onClose}>
      <div class="modal" role="dialog" aria-label="Configure Tile" onClick={(e) => e.stopPropagation()}>
        <div class="modal__header">
          <h2 class="modal__title">Configure Tile</h2>
          <button class="modal__close" aria-label="Close" onClick={props.onClose}>×</button>
        </div>
        <div class="modal__body">

          {/* General fields */}
          <label class="field">
            <span class="field__label">Title</span>
            <input class="field__input" type="text"
              placeholder={props.tile.type}
              value={title()}
              onInput={(e) => setTitle(e.currentTarget.value)} />
          </label>

          <label class="field">
            <span class="field__label">Refresh interval (seconds)</span>
            <input class="field__input" type="number" min="0"
              value={intervalSec()}
              onInput={(e) => setIntervalSec(e.currentTarget.value)} />
            <span class="field__hint">Set to 0 to disable automatic refresh (manual only)</span>
          </label>

          <Show when={!isWs()}>
            <label class="field">
              <span class="field__label">Items per page</span>
              <input class="field__input" type="number" min="1" max="200"
                placeholder="10"
                value={pageSize()}
                onInput={(e) => setPageSize(e.currentTarget.value)} />
            </label>
          </Show>

          <label class="field">
            <span class="field__label">Display mode</span>
            <select class="field__input"
              value={displayMode()}
              onChange={(e) => setDisplayMode(e.currentTarget.value as 'compact' | 'detailed')}>
              <option value="detailed">Detailed</option>
              <option value="compact">Compact</option>
            </select>
          </label>

          <label class="field" style={{ 'flex-direction': 'row', 'align-items': 'center', gap: '8px' }}>
            <input type="checkbox"
              id="show-last-updated"
              checked={showLastUpdated()}
              onChange={(e) => setShowLastUpdated(e.currentTarget.checked)} />
            <span class="field__label" style={{ cursor: 'pointer' }}>
              <label for="show-last-updated">Show "last updated" footer</label>
            </span>
          </label>

          <Show when={isRest()}>
            <label class="field">
              <span class="field__label">Total items to show</span>
              <input class="field__input" type="number" min="1"
                placeholder="All available"
                value={fetchLimit()}
                onInput={(e) => setFetchLimit(e.currentTarget.value)} />
            </label>
          </Show>

          {/* RSS-specific */}
          <Show when={isRss()}>
            <label class="field">
              <span class="field__label">Feed URL</span>
              <input class="field__input" type="url"
                placeholder="https://feeds.example.com/rss"
                value={rssUrl()}
                onInput={(e) => setRssUrl(e.currentTarget.value)} />
              <Show when={rssUrl().length > 0 && !rssUrlValid()}>
                <span class="field__error">Must be a valid http/https URL</span>
              </Show>
            </label>
            <label class="field">
              <span class="field__label">Items to fetch from feed (1–200)</span>
              <input class="field__input" type="number" min="1" max="200"
                value={rssMaxItems()}
                onInput={(e) => setRssMaxItems(e.currentTarget.value)} />
            </label>
          </Show>

          {/* REST-specific */}
          <Show when={isRest()}>
            <label class="field">
              <span class="field__label">Endpoint URL</span>
              <input class="field__input" type="url"
                placeholder="https://jsonplaceholder.typicode.com/posts"
                value={restUrl()}
                onInput={(e) => { setRestUrl(e.currentTarget.value); setTestStatus('idle'); }} />
            </label>
            <label class="field">
              <span class="field__label">Headers (JSON)</span>
              <textarea class="field__input field__textarea"
                placeholder='{"Authorization": "Bearer token"}'
                value={restHeaders()}
                onInput={(e) => setRestHeaders(e.currentTarget.value)} />
            </label>
            <label class="field">
              <span class="field__label">Display mode</span>
              <select class="field__input"
                value={restDisplayMode()}
                onChange={(e) => setRestDisplayMode(e.currentTarget.value as 'table' | 'json' | 'text')}>
                <option value="table">Table</option>
                <option value="json">JSON</option>
                <option value="text">Text</option>
              </select>
            </label>
            <div class="field">
              <button
                class="btn btn--neutral btn--sm"
                disabled={restUrl().trim().length === 0 || testStatus() === 'loading'}
                onClick={() => void testConnection('rest')}>
                {testStatus() === 'loading' ? 'Testing…' : 'Test connection'}
              </button>
              <Show when={testStatus() === 'ok'}>
                <span class="test-connection-result test-connection-result--ok">✔️ {testMessage()}</span>
              </Show>
              <Show when={testStatus() === 'error'}>
                <span class="test-connection-result test-connection-result--error">❌ {testMessage()}</span>
              </Show>
            </div>
          </Show>

          {/* WebSocket-specific */}
          <Show when={isWs()}>
            <label class="field">
              <span class="field__label">WebSocket URL</span>
              <input class="field__input" type="url"
                placeholder="wss://stream.binance.com:9443/ws/btcusdt@trade"
                value={wsUrl()}
                onInput={(e) => { setWsUrl(e.currentTarget.value); setTestStatus('idle'); }} />
            </label>
            <label class="field">
              <span class="field__label">Max messages</span>
              <input class="field__input" type="number" min="10" max="500"
                value={wsMaxMessages()}
                onInput={(e) => setWsMaxMessages(e.currentTarget.value)} />
            </label>
            <label class="field">
              <span class="field__label">Fields to display (comma-separated dot-paths)</span>
              <input class="field__input" type="text"
                placeholder="e.g. s,p,q  for Binance btcusdt@trade"
                value={wsFields()}
                onInput={(e) => setWsFields(e.currentTarget.value)} />
              <span class="field__hint">Leave empty to show raw JSON. Use dot-notation for nested keys, e.g. <code>data.price</code>.</span>
            </label>
            <label class="field">
              <span class="field__label">Column labels (comma-separated, matches fields order)</span>
              <input class="field__input" type="text"
                placeholder="e.g. Symbol,Price,Qty"
                value={wsFieldLabels()}
                onInput={(e) => setWsFieldLabels(e.currentTarget.value)} />
            </label>
            <div class="field">
              <button
                class="btn btn--neutral btn--sm"
                disabled={wsUrl().trim().length === 0 || testStatus() === 'loading'}
                onClick={() => void testConnection('ws')}>
                {testStatus() === 'loading' ? 'Testing…' : 'Test connection'}
              </button>
              <Show when={testStatus() === 'ok'}>
                <span class="test-connection-result test-connection-result--ok">✔️ Connected successfully</span>
              </Show>
              <Show when={testStatus() === 'error'}>
                <span class="test-connection-result test-connection-result--error">❌ {testMessage()}</span>
              </Show>
            </div>
          </Show>

          <div class="modal__actions">
            <button class="btn" onClick={props.onClose}>Cancel</button>
            <button class="btn btn--primary" onClick={handleSave} disabled={!canSave()}>
              Save
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
