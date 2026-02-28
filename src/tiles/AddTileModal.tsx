import { createSignal, createMemo, Show, For } from 'solid-js';
import type { JSX } from 'solid-js';
import type { TileConfig } from './TileConfig';
import { makeTile } from './TileConfig';
import { TILE_REGISTRY, CATEGORIES, type TileDefinition, type Category } from './tileRegistry';

interface Props {
  isOpen: boolean;
  onAdd: (tile: TileConfig) => void;
  onClose: () => void;
}

export function AddTileModal(props: Props): JSX.Element {
  const [query, setQuery] = createSignal('');
  const [activeCategory, setActiveCategory] = createSignal<Category>('all');
  const [configuring, setConfiguring] = createSignal<TileDefinition | null>(null);
  const [restUrl, setRestUrl] = createSignal('');
  const [restHeaders, setRestHeaders] = createSignal('');
  const [wsUrl, setWsUrl] = createSignal('');
  const [maxMessages, setMaxMessages] = createSignal('50');
  const [rssUrl, setRssUrl] = createSignal('');
  const [rssMaxItems, setRssMaxItems] = createSignal('20');
  const rssUrlValid = () => { try { const u = new URL(rssUrl()); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; } };

  function reset(): void {
    setQuery('');
    setActiveCategory('all');
    setConfiguring(null);
    setRestUrl('');
    setRestHeaders('');
    setWsUrl('');
    setMaxMessages('50');
    setRssUrl('');
    setRssMaxItems('20');
  }

  function handleClose(): void {
    reset();
    props.onClose();
  }

  const filteredTiles = createMemo(() => {
    const q = query().toLowerCase().trim();
    const cat = activeCategory();
    return TILE_REGISTRY.filter((t) => {
      if (q) {
        return (
          t.label.toLowerCase().includes(q) ||
          t.provider.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.includes(q))
        );
      }
      return cat === 'all' || t.category === cat;
    });
  });

  /** Tiles grouped by provider: [[providerName, TileDefinition[]], ...] */
  const groupedTiles = createMemo(() => {
    const groups = new Map<string, TileDefinition[]>();
    for (const tile of filteredTiles()) {
      if (!groups.has(tile.provider)) groups.set(tile.provider, []);
      groups.get(tile.provider)!.push(tile);
    }
    return [...groups.entries()];
  });

  function selectTile(def: TileDefinition): void {
    if (def.status === 'coming-soon') return;
    if (def.type === 'rest' || def.type === 'websocket' || def.type === 'rss-feed') {
      setConfiguring(def);
      return;
    }
    props.onAdd(makeTile(def.type, { x: 32, y: 32 }));
    reset();
    props.onClose();
  }

  function handleAdd(): void {
    const cfg = configuring();
    if (!cfg) return;
    let headers: Record<string, string> = {};
    try { headers = JSON.parse(restHeaders() || '{}') as Record<string, string>; } catch { /* ignore */ }
    let tile: TileConfig;
    if (cfg.type === 'rss-feed') {
      tile = makeTile('rss-feed', { x: 32, y: 32, rss: { url: rssUrl().trim(), maxItems: parseInt(rssMaxItems(), 10) || 20 } });
    } else if (cfg.type === 'rest') {
      tile = makeTile('rest', { x: 32, y: 32, title: restUrl(), rest: { url: restUrl(), headers, refreshInterval: 30 } });
    } else {
      tile = makeTile('websocket', { x: 32, y: 32, title: wsUrl(), ws: { url: wsUrl(), maxMessages: parseInt(maxMessages(), 10) || 50 } });
    }
    props.onAdd(tile);
    reset();
    props.onClose();
  }

  return (
    <Show when={props.isOpen}>
      <div class="modal-overlay" onClick={handleClose}>
        <div class="modal add-tile-modal" role="dialog" aria-label="Add Tile" onClick={(e) => e.stopPropagation()}>
          <div class="modal__header">
            <h2 class="modal__title">Add Tile</h2>
            <button class="modal__close" aria-label="Close" onClick={handleClose}>×</button>
          </div>

          {/* ── Config form for REST / WebSocket / RSS ── */}
          <Show when={configuring() !== null}>
            <div class="modal__body">
              <Show when={configuring()?.type === 'rss-feed'}>
                <label class="field">
                  <span class="field__label">Feed URL</span>
                  <input class="field__input" type="url" placeholder="https://feeds.example.com/rss"
                    value={rssUrl()} onInput={(e) => setRssUrl(e.currentTarget.value)} />
                  <Show when={rssUrl().length > 0 && !rssUrlValid()}>
                    <span class="field__error">Must be a valid http/https URL</span>
                  </Show>
                </label>
                <label class="field">
                  <span class="field__label">Max items (1–50)</span>
                  <input class="field__input" type="number" min="1" max="50"
                    value={rssMaxItems()} onInput={(e) => setRssMaxItems(e.currentTarget.value)} />
                </label>
              </Show>
              <Show when={configuring()?.type === 'rest'}>
                <label class="field">
                  <span class="field__label">URL</span>
                  <input class="field__input" type="url" placeholder="https://api.example.com/data"
                    value={restUrl()} onInput={(e) => setRestUrl(e.currentTarget.value)} />
                </label>
                <label class="field">
                  <span class="field__label">Headers (JSON)</span>
                  <textarea class="field__input field__textarea" placeholder='{"Authorization": "Bearer token"}'
                    value={restHeaders()} onInput={(e) => setRestHeaders(e.currentTarget.value)} />
                </label>
              </Show>
              <Show when={configuring()?.type === 'websocket'}>
                <label class="field">
                  <span class="field__label">WebSocket URL</span>
                  <input class="field__input" type="url" placeholder="wss://example.com/stream"
                    value={wsUrl()} onInput={(e) => setWsUrl(e.currentTarget.value)} />
                </label>
                <label class="field">
                  <span class="field__label">Max messages</span>
                  <input class="field__input" type="number" min="10" max="500"
                    value={maxMessages()} onInput={(e) => setMaxMessages(e.currentTarget.value)} />
                </label>
              </Show>
              <div class="modal__actions">
                <button class="btn" onClick={() => setConfiguring(null)}>← Back</button>
                <button class="btn btn--primary" onClick={handleAdd}
                  disabled={
                    configuring()?.type === 'rss-feed' ? !rssUrlValid() :
                    configuring()?.type === 'rest' ? !restUrl() : !wsUrl()
                  }>
                  Add tile
                </button>
              </div>
            </div>
          </Show>

          {/* ── Single-screen tile picker ── */}
          <Show when={configuring() === null}>
            <div class="tile-picker__search-wrap">
              <input
                class="tile-picker__search"
                type="text"
                placeholder="Search tiles…"
                value={query()}
                onInput={(e) => setQuery(e.currentTarget.value)}
                autofocus
              />
            </div>
            <div class="tile-picker">
              {/* Sidebar */}
              <ul class="tile-picker__sidebar" role="listbox" aria-label="Category">
                <For each={CATEGORIES}>
                  {(cat) => (
                    <li
                      class={`tile-picker__sidebar-item${activeCategory() === cat.id ? ' tile-picker__sidebar-item--active' : ''}${query() ? ' tile-picker__sidebar-item--dim' : ''}`}
                      onClick={() => { setActiveCategory(cat.id); setQuery(''); }}
                      role="option"
                      aria-selected={activeCategory() === cat.id}
                    >
                      <span class="tile-picker__sidebar-icon">{cat.icon}</span>
                      {cat.label}
                    </li>
                  )}
                </For>
              </ul>

              {/* Tile grid */}
              <div class="tile-picker__grid">
                <Show when={groupedTiles().length === 0}>
                  <p class="tile-picker__empty">No tiles match "{query()}"</p>
                </Show>
                <For each={groupedTiles()}>
                  {([provider, tiles]) => (
                    <>
                      <p class="tile-picker__section-header">{provider}</p>
                      <div class="tile-picker__row">
                        <For each={tiles}>
                          {(def) => (
                            <button
                              class={`tile-card${def.status === 'coming-soon' ? ' tile-card--coming-soon' : ''}`}
                              data-tile-type={def.type}
                              onClick={() => selectTile(def)}
                              disabled={def.status === 'coming-soon'}
                              title={def.description ?? def.label}
                            >
                              <span class="tile-card__icon">{def.icon}</span>
                              <span class="tile-card__label">{def.label}</span>
                              <Show when={def.status === 'coming-soon'}>
                                <span class="tile-card__soon">SOON</span>
                              </Show>
                            </button>
                          )}
                        </For>
                      </div>
                    </>
                  )}
                </For>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
}
