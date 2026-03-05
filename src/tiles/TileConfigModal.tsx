import { createSignal, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import type { TileConfig } from './TileConfig';
import { TILE_POLL_MS, TILE_SSE_CHANNEL, WEBHOOK_CAPABLE, WEBHOOK_PROVIDER, WS_MANAGED_TILES } from './TileConfig';
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
  const [deliveryMode, setDeliveryMode] = createSignal<'poll' | 'webhook'>(
    props.tile.deliveryMode ?? 'poll'
  );
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
  const [restChartField, setRestChartField] = createSignal(props.tile.rest?.chartField ?? '');
  const [restChartType, setRestChartType] = createSignal<'line' | 'bar' | 'candle'>(props.tile.rest?.chartType ?? 'line');

  // WebSocket fields
  const [wsUrl, setWsUrl] = createSignal(props.tile.ws?.url ?? '');
  const [wsMaxMessages, setWsMaxMessages] = createSignal(String(props.tile.ws?.maxMessages ?? 50));
  const [wsFields, setWsFields] = createSignal(props.tile.ws?.fields ?? '');
  const [wsFieldLabels, setWsFieldLabels] = createSignal(props.tile.ws?.fieldLabels ?? '');
  const [wsChartField, setWsChartField] = createSignal(props.tile.ws?.chartField ?? '');
  const [wsChartType, setWsChartType] = createSignal<'line' | 'bar' | 'candle'>(props.tile.ws?.chartType ?? 'line');
  const [wsChartBufferMaxPoints, setWsChartBufferMaxPoints] = createSignal(
    String(props.tile.ws?.chartBufferMaxPoints ?? 500)
  );

  // Custom API fields
  const [caUrl, setCaUrl]         = createSignal(props.tile.customApi?.url ?? '');
  const [caMethod, setCaMethod]   = createSignal<'GET'|'POST'|'PUT'|'PATCH'|'DELETE'>(props.tile.customApi?.method ?? 'GET');
  const [caHeaders, setCaHeaders] = createSignal(
    props.tile.customApi?.headers ? JSON.stringify(props.tile.customApi.headers, null, 2) : ''
  );
  const [caBody, setCaBody]             = createSignal(props.tile.customApi?.body ?? '');
  const [caDataPath, setCaDataPath]     = createSignal(props.tile.customApi?.dataPath ?? '');
  const [caDisplayMode, setCaDisplayMode] = createSignal<'table'|'json'|'text'|'key-value'>(
    props.tile.customApi?.displayMode ?? 'table'
  );

  // GraphQL fields
  const [gqlUrl, setGqlUrl]             = createSignal(props.tile.graphql?.url ?? '');
  const [gqlQuery, setGqlQuery]         = createSignal(props.tile.graphql?.query ?? '');
  const [gqlVariables, setGqlVariables] = createSignal(props.tile.graphql?.variables ?? '');
  const [gqlDataPath, setGqlDataPath]   = createSignal(props.tile.graphql?.dataPath ?? '');
  const [gqlHeaders, setGqlHeaders]     = createSignal(
    props.tile.graphql?.headers ? JSON.stringify(props.tile.graphql.headers, null, 2) : ''
  );
  const [gqlDisplayMode, setGqlDisplayMode] = createSignal<'table'|'json'|'text'>(
    props.tile.graphql?.displayMode ?? 'json'
  );

  // Reddit keyword monitor field
  const [keywords, setKeywords] = createSignal(props.tile.keywords ?? '');
  // Reddit subreddits field (all reddit tile types)
  const [subreddits, setSubreddits] = createSignal(props.tile.subreddits ?? '');

  // Test-connection state (shared between REST and WS sections)
  const [testStatus, setTestStatus] = createSignal<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [testMessage, setTestMessage] = createSignal('');
  const supportsPolling = () => !WS_MANAGED_TILES.has(props.tile.type);

  async function testConnection(type: 'rest' | 'ws' | 'graphql'): Promise<void> {
    setTestStatus('loading');
    setTestMessage('');
    try {
      let headers: Record<string, string> = {};
      try {
        const src = type === 'graphql' ? gqlHeaders() : restHeaders();
        headers = JSON.parse(src || '{}') as Record<string, string>;
      } catch { /* ignore */ }
      const body = type === 'rest'
        ? { type: 'rest', url: restUrl().trim(), headers }
        : type === 'ws'
        ? { type: 'ws',  url: wsUrl().trim() }
        : { type: 'graphql', url: gqlUrl().trim(), query: gqlQuery().trim() || '{__typename}', headers };
      const res = await fetch(`${API_BASE_URL}/api/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { ok: boolean; status?: number; statusText?: string; preview?: string; error?: string };
      if (data.ok) {
        const msg = type === 'ws'
          ? 'Connected successfully'
          : `HTTP ${data.status ?? ''} ${data.statusText ?? ''}`.trim();
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
      refreshInterval: supportsPolling() ? ms : 0,
      pageSize: (ps >= 1 && ps <= 200) ? ps : undefined,
      fetchLimit: (fl >= 1) ? fl : undefined,
      showLastUpdated: showLastUpdated(),
      displayMode: displayMode(),
      deliveryMode: WEBHOOK_CAPABLE.has(props.tile.type) ? deliveryMode() : undefined,
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
        chartField: restChartField().trim() || undefined,
        chartType: restChartField().trim() ? restChartType() : undefined,
      };
    }

    if (props.tile.type === 'websocket') {
      updated.ws = {
        url: wsUrl().trim(),
        maxMessages: parseInt(wsMaxMessages(), 10) || 50,
        fields: wsFields().trim() || undefined,
        fieldLabels: wsFieldLabels().trim() || undefined,
        chartField: wsChartField().trim() || undefined,
        chartType: wsChartField().trim() ? wsChartType() : undefined,
        chartBufferMaxPoints: wsChartField().trim() ? (parseInt(wsChartBufferMaxPoints(), 10) || 500) : undefined,
      };
    }

    if (props.tile.type === 'custom-api') {
      let headers: Record<string, string> = {};
      try { headers = JSON.parse(caHeaders() || '{}') as Record<string, string>; } catch { /* ignore */ }
      updated.customApi = {
        url: caUrl().trim(),
        method: caMethod(),
        headers,
        body: caBody().trim() || undefined,
        dataPath: caDataPath().trim() || undefined,
        displayMode: caDisplayMode(),
        refreshInterval: ms / 1000,
      };
    }

    if (props.tile.type === 'graphql') {
      let headers: Record<string, string> = {};
      try { headers = JSON.parse(gqlHeaders() || '{}') as Record<string, string>; } catch { /* ignore */ }
      updated.graphql = {
        url: gqlUrl().trim(),
        query: gqlQuery().trim(),
        variables: gqlVariables().trim() || undefined,
        dataPath: gqlDataPath().trim() || undefined,
        headers,
        refreshInterval: ms / 1000,
        displayMode: gqlDisplayMode(),
      };
    }

    if (props.tile.type === 'reddit-keyword-monitor') {
      updated.keywords = keywords().trim() || undefined;
    }

    if (isRedditTile()) {
      updated.subreddits = subreddits().trim() || undefined;
    }

    // Sync delivery mode with the server for webhook-capable tiles.
    if (WEBHOOK_CAPABLE.has(props.tile.type)) {
      const channel = TILE_SSE_CHANNEL[props.tile.type] ?? props.tile.type;
      void fetch(`${API_BASE_URL}/api/poll/set-delivery/${channel}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: deliveryMode() }),
      });
    }

    props.onSave(updated);
    props.onClose();
  }

  const isRss  = () => props.tile.type === 'rss-feed';
  const isRest = () => props.tile.type === 'rest';
  const isWs   = () => props.tile.type === 'websocket';
  const isCustomApi = () => props.tile.type === 'custom-api';
  const isGraphql = () => props.tile.type === 'graphql';
  const isKeywordMonitor = () => props.tile.type === 'reddit-keyword-monitor';
  const isRedditTile = () => props.tile.type === 'reddit-keyword-monitor' || props.tile.type === 'reddit-hot-posts' || props.tile.type === 'reddit-posts';

  const canSave = () => {
    if (isRss())       return rssUrlValid();
    if (isRest())      return restUrl().trim().length > 0;
    if (isWs())        return wsUrl().trim().length > 0;
    if (isCustomApi()) return caUrl().trim().length > 0;
    if (isGraphql())   return gqlUrl().trim().length > 0 && gqlQuery().trim().length > 0;
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

          <Show when={WEBHOOK_CAPABLE.has(props.tile.type)}>
            <fieldset class="field">
              <legend class="field__label">Delivery mode</legend>
              <label class="field__radio">
                <input type="radio" name="deliveryMode" value="poll"
                  checked={deliveryMode() === 'poll'}
                  onChange={() => setDeliveryMode('poll')} /> Poll (server fetches on a schedule)
              </label>
              <label class="field__radio">
                <input type="radio" name="deliveryMode" value="webhook"
                  checked={deliveryMode() === 'webhook'}
                  onChange={() => setDeliveryMode('webhook')} /> Webhook (provider pushes updates)
              </label>
            </fieldset>
            <Show when={deliveryMode() === 'webhook'}>
              <div class="field">
                <span class="field__label">Webhook URL</span>
                <div style={{ display: 'flex', gap: '6px', 'align-items': 'center' }}>
                  <code class="field__input" style={{ flex: 1, padding: '6px 8px', 'font-size': '0.85em', cursor: 'text', 'user-select': 'all' }}>
                    {API_BASE_URL}/api/webhooks/{WEBHOOK_PROVIDER[props.tile.type]}
                  </code>
                  <button class="btn btn--neutral btn--sm"
                    onClick={() => void navigator.clipboard.writeText(`${API_BASE_URL}/api/webhooks/${WEBHOOK_PROVIDER[props.tile.type] ?? ''}`)}>
                    Copy
                  </button>
                </div>
                <span class="field__hint">Configure your provider to POST events to this URL. Polling is suspended while webhook mode is active.</span>
              </div>
            </Show>
          </Show>

          <Show when={supportsPolling() && (deliveryMode() === 'poll' || !WEBHOOK_CAPABLE.has(props.tile.type))}>
            <label class="field">
              <span class="field__label">Refresh interval (seconds)</span>
              <input class="field__input" type="number" min="0"
                value={intervalSec()}
                onInput={(e) => setIntervalSec(e.currentTarget.value)} />
              <span class="field__hint">Set to 0 to disable automatic refresh (manual only)</span>
            </label>
          </Show>

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

          <Show when={isRest() || isRedditTile()}>
            <label class="field">
              <span class="field__label">Max fetched items</span>
              <input class="field__input" type="number" min="1"
                placeholder="All available"
                value={fetchLimit()}
                onInput={(e) => setFetchLimit(e.currentTarget.value)} />
              <span class="field__hint">Caps how many items are available for pagination. Leave blank for all.</span>
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
            <label class="field">
              <span class="field__label">Chart field (dot-path, optional)</span>
              <input class="field__input" type="text"
                placeholder="e.g. price or result.close"
                value={restChartField()}
                onInput={(e) => setRestChartField(e.currentTarget.value)} />
              <span class="field__hint">Numeric field to visualise as a chart. Leave empty to disable.</span>
            </label>
            <Show when={restChartField().trim().length > 0}>
              <fieldset class="field">
                <legend class="field__label">Chart type</legend>
                <label class="field__radio">
                  <input type="radio" name="restChartType" value="line"
                    checked={restChartType() === 'line'}
                    onChange={() => setRestChartType('line')} /> Line
                </label>
                <label class="field__radio">
                  <input type="radio" name="restChartType" value="bar"
                    checked={restChartType() === 'bar'}
                    onChange={() => setRestChartType('bar')} /> Bar
                </label>
                <label class="field__radio">
                  <input type="radio" name="restChartType" value="candle"
                    checked={restChartType() === 'candle'}
                    onChange={() => setRestChartType('candle')} /> Candle
                </label>
              </fieldset>
            </Show>
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
            <label class="field">
              <span class="field__label">Chart field (dot-path, optional)</span>
              <input class="field__input" type="text"
                placeholder="e.g. p or payload.price"
                value={wsChartField()}
                onInput={(e) => setWsChartField(e.currentTarget.value)} />
              <span class="field__hint">Numeric dot-path field to plot as a chart. Leave empty to disable.</span>
            </label>
            <Show when={wsChartField().trim().length > 0}>
              <fieldset class="field">
                <legend class="field__label">Chart type</legend>
                <label class="field__radio">
                  <input type="radio" name="wsChartType" value="line"
                    checked={wsChartType() === 'line'}
                    onChange={() => setWsChartType('line')} /> Line
                </label>
                <label class="field__radio">
                  <input type="radio" name="wsChartType" value="bar"
                    checked={wsChartType() === 'bar'}
                    onChange={() => setWsChartType('bar')} /> Bar
                </label>
                <label class="field__radio">
                  <input type="radio" name="wsChartType" value="candle"
                    checked={wsChartType() === 'candle'}
                    onChange={() => setWsChartType('candle')} /> Candle
                </label>
              </fieldset>
              <label class="field">
                <span class="field__label">Buffer size (max points)</span>
                <input class="field__input" type="number" min="10" max="10000"
                  value={wsChartBufferMaxPoints()}
                  onInput={(e) => setWsChartBufferMaxPoints(e.currentTarget.value)} />
                <span class="field__hint">Number of data points to keep and restore across page reloads (default 500).</span>
              </label>
            </Show>
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

          {/* Custom API-specific */}
          <Show when={isCustomApi()}>
            <label class="field">
              <span class="field__label">Endpoint URL</span>
              <input class="field__input" type="url"
                placeholder="https://api.example.com/data"
                value={caUrl()}
                onInput={(e) => setCaUrl(e.currentTarget.value)} />
            </label>
            <label class="field">
              <span class="field__label">HTTP method</span>
              <select class="field__input"
                value={caMethod()}
                onChange={(e) => setCaMethod(e.currentTarget.value as 'GET'|'POST'|'PUT'|'PATCH'|'DELETE')}>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
            </label>
            <label class="field">
              <span class="field__label">Headers (JSON)</span>
              <textarea class="field__input field__textarea"
                placeholder='{"Authorization": "Bearer token", "X-Api-Key": "secret"}'
                value={caHeaders()}
                onInput={(e) => setCaHeaders(e.currentTarget.value)} />
            </label>
            <Show when={caMethod() !== 'GET' && caMethod() !== 'DELETE'}>
              <label class="field">
                <span class="field__label">Request body</span>
                <textarea class="field__input field__textarea"
                  placeholder='{"key": "value"}'
                  value={caBody()}
                  onInput={(e) => setCaBody(e.currentTarget.value)} />
                <span class="field__hint">JSON body sent with POST / PUT / PATCH requests.</span>
              </label>
            </Show>
            <label class="field">
              <span class="field__label">Data path (optional)</span>
              <input class="field__input" type="text"
                placeholder="data.items"
                value={caDataPath()}
                onInput={(e) => setCaDataPath(e.currentTarget.value)} />
              <span class="field__hint">Dot-path into the response, e.g. <code>items</code>. Pick and rename columns using <code>path as Label</code>: <code>items.name as Name, items.owner.login as Owner, items.html_url as URL</code>. Leave blank to use the full response.</span>
            </label>
            <label class="field">
              <span class="field__label">Display mode</span>
              <select class="field__input"
                value={caDisplayMode()}
                onChange={(e) => setCaDisplayMode(e.currentTarget.value as 'table'|'json'|'text'|'key-value')}>
                <option value="table">Table (array of objects)</option>
                <option value="key-value">Key-value pairs (object)</option>
                <option value="json">JSON</option>
                <option value="text">Text</option>
              </select>
            </label>
          </Show>

          {/* GraphQL-specific */}
          <Show when={isGraphql()}>
            <label class="field">
              <span class="field__label">Endpoint URL</span>
              <input class="field__input" type="url"
                placeholder="https://api.example.com/graphql"
                value={gqlUrl()}
                onInput={(e) => { setGqlUrl(e.currentTarget.value); setTestStatus('idle'); }} />
            </label>
            <label class="field">
              <span class="field__label">Query</span>
              <textarea class="field__input graphql-tile__query"
                placeholder="{ users { id name email } }"
                value={gqlQuery()}
                onInput={(e) => setGqlQuery(e.currentTarget.value)} />
            </label>
            <label class="field">
              <span class="field__label">Variables (JSON, optional)</span>
              <textarea class="field__input graphql-tile__query"
                placeholder='{"limit": 10}'
                value={gqlVariables()}
                onInput={(e) => setGqlVariables(e.currentTarget.value)} />
              <span class="field__hint">JSON object of GraphQL variables. Leave empty if the query takes none.</span>
            </label>
            <label class="field">
              <span class="field__label">Data path (optional)</span>
              <input class="field__input" type="text"
                placeholder="data.users"
                value={gqlDataPath()}
                onInput={(e) => setGqlDataPath(e.currentTarget.value)} />
              <span class="field__hint">Dot-path into the response to extract, e.g. <code>data.orders</code>. Leave blank to use the full response.</span>
            </label>
            <label class="field">
              <span class="field__label">Headers (JSON, optional)</span>
              <textarea class="field__input field__textarea"
                placeholder='{"Authorization": "Bearer token"}'
                value={gqlHeaders()}
                onInput={(e) => setGqlHeaders(e.currentTarget.value)} />
            </label>
            <label class="field">
              <span class="field__label">Display mode</span>
              <select class="field__input"
                value={gqlDisplayMode()}
                onChange={(e) => setGqlDisplayMode(e.currentTarget.value as 'table'|'json'|'text')}>
                <option value="json">JSON</option>
                <option value="table">Table (array of objects)</option>
                <option value="text">Text</option>
              </select>
            </label>
            <div class="field">
              <button
                class="btn btn--neutral btn--sm"
                disabled={gqlUrl().trim().length === 0 || testStatus() === 'loading'}
                onClick={() => void testConnection('graphql')}>
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

          <Show when={isKeywordMonitor()}>
            <label class="field">
              <span class="field__label">Keywords</span>
              <input class="field__input" type="text"
                placeholder="rust, typescript, bun"
                value={keywords()}
                onInput={(e) => setKeywords(e.currentTarget.value)} />
              <span class="field__hint">Comma-separated terms to filter and highlight matching posts. Leave blank to show all posts.</span>
            </label>
          </Show>

          <Show when={isRedditTile()}>
            <label class="field">
              <span class="field__label">Subreddits</span>
              <input class="field__input" type="text"
                placeholder="MachineLearning, LocalLLaMA, programming"
                value={subreddits()}
                onInput={(e) => setSubreddits(e.currentTarget.value)} />
              <span class="field__hint">Comma-separated subreddit names (no r/ prefix). Leave blank to use the global server feed.</span>
            </label>
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
