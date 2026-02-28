import { createSignal, createEffect, For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { API_BASE_URL } from '../data/api';

interface Props {
  onClose: () => void;
}

interface EnvEntry {
  key: string;
  value: string;
}

interface ServerInfo {
  boundAddress: string;
  stripeApiUrl: string;
  githubApiUrl: string;
  cloudflareApiUrl: string;
  paypalApiUrl: string;
  backendBaseUrl: string;
}

/** Keys that contain these substrings are treated as sensitive (masked by default). */
const SENSITIVE = ['TOKEN', 'SECRET', 'KEY', 'PASSWORD', 'PASS', 'CREDENTIALS'];
const isSensitive = (key: string) =>
  SENSITIVE.some(s => key.toUpperCase().includes(s));

export function EnvConfigModal(props: Props): JSX.Element {
  const [entries, setEntries] = createSignal<EnvEntry[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [saveStatus, setSaveStatus] = createSignal<'idle' | 'saving' | 'ok' | 'error'>('idle');
  const [saveError, setSaveError] = createSignal('');
  const [reloadStatus, setReloadStatus] = createSignal<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [reloadMsg, setReloadMsg] = createSignal('');
  const [restartStatus, setRestartStatus] = createSignal<'idle' | 'loading' | 'online'>('idle');
  // Track which sensitive fields are revealed
  const [revealed, setRevealed] = createSignal<Set<string>>(new Set());
  // New-variable inputs
  const [newKey, setNewKey] = createSignal('');
  const [newVal, setNewVal] = createSignal('');

  // Server info (read-only, from /api/server/info)
  const [serverInfo, setServerInfo] = createSignal<ServerInfo | null>(null);

  createEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/server/info`);
        if (res.ok) setServerInfo(await res.json() as ServerInfo);
      } catch { /* ignore — server info is decorative */ }
    })();
  });

  createEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/env`);
        const data = await res.json() as { vars: Record<string, string> };
        setEntries(
          Object.entries(data.vars).map(([key, value]) => ({ key, value }))
        );
      } catch {
        setEntries([]);
      } finally {
        setLoading(false);
      }
    })();
  });

  function updateValue(key: string, value: string): void {
    setEntries(prev => prev.map(e => e.key === key ? { ...e, value } : e));
  }

  function removeEntry(key: string): void {
    setEntries(prev => prev.filter(e => e.key !== key));
  }

  function addEntry(): void {
    const k = newKey().trim().toUpperCase().replace(/\s+/g, '_');
    if (!k) return;
    if (entries().some(e => e.key === k)) {
      // Move focus to the existing entry instead
      setNewKey('');
      setNewVal('');
      return;
    }
    setEntries(prev => [...prev, { key: k, value: newVal().trim() }]);
    setNewKey('');
    setNewVal('');
  }

  function toggleReveal(key: string): void {
    setRevealed(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function handleReloadEnv(): Promise<void> {
    setReloadStatus('loading');
    setReloadMsg('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/server/reload-env`, { method: 'POST' });
      const data = await res.json() as { ok: boolean; reloaded?: string[]; error?: string };
      if (data.ok) {
        const count = data.reloaded?.length ?? 0;
        setReloadStatus('ok');
        setReloadMsg(count === 0 ? 'No changes' : `${count} key${count === 1 ? '' : 's'} updated`);
      } else {
        setReloadStatus('error');
        setReloadMsg(data.error ?? 'Reload failed');
      }
    } catch (e: unknown) {
      setReloadStatus('error');
      setReloadMsg(e instanceof Error ? e.message : 'Request failed');
    }
  }

  async function handleRestartServer(): Promise<void> {
    setRestartStatus('loading');
    try {
      await fetch(`${API_BASE_URL}/api/server/restart`, { method: 'POST' });
    } catch { /* expected — server shuts down */ }
    // Poll /health until the server comes back online
    const poll = setInterval(() => {
      void fetch(`${API_BASE_URL}/health`).then(r => {
        if (r.ok) { clearInterval(poll); setRestartStatus('online'); }
      }).catch(() => { /* still restarting */ });
    }, 1000);
  }

  async function handleSave(): Promise<void> {
    setSaveStatus('saving');
    setSaveError('');
    try {
      const vars: Record<string, string> = {};
      for (const e of entries()) vars[e.key] = e.value;
      const res = await fetch(`${API_BASE_URL}/api/env`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vars }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (data.ok) {
        setSaveStatus('ok');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
        setSaveError(data.error ?? 'Save failed');
      }
    } catch (e: unknown) {
      setSaveStatus('error');
      setSaveError(e instanceof Error ? e.message : 'Request failed');
    }
  }

  return (
    <div class="modal-overlay" onClick={props.onClose}>
      <div
        class="modal env-config-modal"
        role="dialog"
        aria-label="Environment Variables"
        onClick={(e) => e.stopPropagation()}
      >
        <div class="modal__header">
          <h2 class="modal__title">Environment Variables</h2>
          <button class="modal__close" aria-label="Close" onClick={props.onClose}>×</button>
        </div>

        <div class="modal__body env-config-modal__body">
          <p class="env-config-modal__notice">
            ⚠ Changes are written to <code>.env</code> on disk.
            Restart the API server for new values to take effect.
          </p>

          <Show when={serverInfo()}>
            {(info) => (
              <section class="env-config-modal__server-info">
                <h3 class="env-config-modal__server-info-heading">Server</h3>
                <dl class="env-config-modal__info-grid">
                  <dt>Bound address</dt><dd>{info().boundAddress}</dd>
                  <dt>Stripe API</dt><dd>{info().stripeApiUrl}</dd>
                  <dt>GitHub API</dt><dd>{info().githubApiUrl}</dd>
                  <dt>Cloudflare API</dt><dd>{info().cloudflareApiUrl}</dd>
                  <dt>PayPal API</dt><dd>{info().paypalApiUrl}</dd>
                  <Show when={info().backendBaseUrl}>
                    <dt>Backend base</dt><dd>{info().backendBaseUrl}</dd>
                  </Show>
                </dl>
              </section>
            )}
          </Show>

          <Show when={loading()}>
            <p class="env-config-modal__loading">Loading…</p>
          </Show>

          <Show when={!loading()}>
            <table class="env-config-modal__table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Value</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <For each={entries()}>
                  {(entry) => {
                    const sensitive = isSensitive(entry.key);
                    const isRevealed = () => revealed().has(entry.key);
                    return (
                      <tr>
                        <td class="env-config-modal__key" title={entry.key}>{entry.key}</td>
                        <td class="env-config-modal__val-cell">
                          <div class="env-config-modal__input-row">
                            <input
                              class="field__input env-config-modal__val-input"
                              type={sensitive && !isRevealed() ? 'password' : 'text'}
                              value={entry.value}
                              onInput={(e) => updateValue(entry.key, e.currentTarget.value)}
                              placeholder="(empty)"
                              autocomplete="off"
                              spellcheck={false}
                            />
                            <Show when={sensitive}>
                              <button
                                class="btn btn--neutral btn--sm env-config-modal__eye"
                                title={isRevealed() ? 'Hide' : 'Show'}
                                onClick={() => toggleReveal(entry.key)}
                                type="button"
                              >
                                {isRevealed() ? '🙈' : '👁'}
                              </button>
                            </Show>
                          </div>
                        </td>
                        <td>
                          <button
                            class="btn btn--danger btn--sm"
                            title="Remove"
                            onClick={() => removeEntry(entry.key)}
                            type="button"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    );
                  }}
                </For>

                {/* Add new variable row */}
                <tr class="env-config-modal__add-row">
                  <td>
                    <input
                      class="field__input env-config-modal__new-key"
                      type="text"
                      placeholder="NEW_KEY"
                      value={newKey()}
                      onInput={(e) => setNewKey(e.currentTarget.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') addEntry(); }}
                      autocomplete="off"
                      spellcheck={false}
                    />
                  </td>
                  <td class="env-config-modal__val-cell">
                    <input
                      class="field__input env-config-modal__val-input"
                      type="text"
                      placeholder="value"
                      value={newVal()}
                      onInput={(e) => setNewVal(e.currentTarget.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') addEntry(); }}
                      autocomplete="off"
                      spellcheck={false}
                    />
                  </td>
                  <td>
                    <button
                      class="btn btn--neutral btn--sm"
                      disabled={newKey().trim().length === 0}
                      onClick={addEntry}
                      type="button"
                    >
                      + Add
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </Show>
        </div>

        <div class="modal__footer env-config-modal__footer">
          <Show when={saveStatus() === 'ok'}>
            <div class="env-config-modal__post-save">
              <span class="env-config-modal__status env-config-modal__status--ok">✔ Saved to .env</span>
              <button
                class="btn btn--neutral btn--sm"
                disabled={reloadStatus() === 'loading'}
                onClick={() => void handleReloadEnv()}
                type="button"
              >
                {reloadStatus() === 'loading' ? 'Reloading…' : 'Reload env'}
              </button>
              <Show when={reloadStatus() === 'ok'}>
                <span class="env-config-modal__status env-config-modal__status--ok">{reloadMsg()}</span>
              </Show>
              <Show when={reloadStatus() === 'error'}>
                <span class="env-config-modal__status env-config-modal__status--error">{reloadMsg()}</span>
              </Show>
              <button
                class="btn btn--danger btn--sm"
                disabled={restartStatus() === 'loading'}
                onClick={() => void handleRestartServer()}
                type="button"
              >
                {restartStatus() === 'loading' ? 'Restarting…' : restartStatus() === 'online' ? 'Server online' : 'Restart server'}
              </button>
            </div>
          </Show>
          <Show when={saveStatus() === 'error'}>
            <span class="env-config-modal__status env-config-modal__status--error">✕ {saveError()}</span>
          </Show>
          <button class="btn btn--neutral" onClick={props.onClose}>Cancel</button>
          <button
            class="btn btn--primary"
            disabled={saveStatus() === 'saving' || loading()}
            onClick={() => void handleSave()}
          >
            {saveStatus() === 'saving' ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
