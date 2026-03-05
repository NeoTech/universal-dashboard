import { createSignal, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import type { FlintSessionStatus } from '../../data/flint';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { useFlintResource } from './flintRealtimeStore';
import { BaseWsTile as BaseTile } from '../BaseWsTile';
import { API_BASE_URL } from '../../data/api';

export function FlintAuthTile(_props: Record<string, never>): JSX.Element {
  const { data: session, loading, error } = useFlintResource<FlintSessionStatus>(
    'flint-session',
    { authenticated: false },
  );

  const [email, setEmail]       = createSignal('');
  const [password, setPassword] = createSignal('');
  const [busy, setBusy]         = createSignal(false);
  const [loginErr, setLoginErr] = createSignal<string | null>(null);
  const [confirmLogout, setConfirmLogout] = createSignal(false);

  async function handleLogin(e: Event): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setLoginErr(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/flint/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email(), password: password() }),
      });
      if (!res.ok) {
        const txt = await res.text();
        setLoginErr(`Login failed (${res.status}): ${txt.slice(0, 120)}`);
      }
    } catch (err) {
      setLoginErr(err instanceof Error ? err.message : 'Network error');
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout(): Promise<void> {
    setConfirmLogout(false);
    try {
      await fetch(`${API_BASE_URL}/api/flint/auth/logout`, { method: 'POST' });
    } catch { /* ignore */ }
  }

  function expiryLabel(): string {
    const exp = session().expiresAt;
    if (!exp) return '';
    const diff = Math.max(0, exp - Date.now());
    const mins = Math.floor(diff / 60_000);
    if (mins > 0) return `Expires in ${mins}m`;
    const secs = Math.floor(diff / 1_000);
    return `Expires in ${secs}s`;
  }

  return (
    <div class="stripe-tile flint-auth-tile">
      <BaseTile loading={loading()} error={error()}>
        <Show
          when={session().authenticated}
          fallback={
            <form class="flint-auth-form" onSubmit={(e) => void handleLogin(e)}>
              <h3 class="flint-auth-form__title">FLINT / LOPC Sign In</h3>
              <label class="flint-auth-form__label">
                Email
                <input
                  class="flint-auth-form__input"
                  type="email"
                  autocomplete="email"
                  value={email()}
                  onInput={(e) => setEmail(e.currentTarget.value)}
                  disabled={busy()}
                  required
                />
              </label>
              <label class="flint-auth-form__label">
                Password
                <input
                  class="flint-auth-form__input"
                  type="password"
                  autocomplete="current-password"
                  value={password()}
                  onInput={(e) => setPassword(e.currentTarget.value)}
                  disabled={busy()}
                  required
                />
              </label>
              <Show when={loginErr()}>
                <p class="flint-auth-form__error">{loginErr()}</p>
              </Show>
              <button
                class="btn btn--primary"
                type="submit"
                disabled={busy()}
              >
                {busy() ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          }
        >
          <div class="flint-auth-session">
            <div class="flint-auth-session__icon">&#10003;</div>
            <div class="flint-auth-session__info">
              <strong>Connected</strong>
              <span class="flint-auth-session__email">{session().email}</span>
              <span class="flint-auth-session__expiry">{expiryLabel()}</span>
            </div>
            <button
              class="btn btn--danger"
              onClick={() => setConfirmLogout(true)}
            >
              Sign Out
            </button>
          </div>
        </Show>
      </BaseTile>

      <ConfirmDialog
        isOpen={confirmLogout()}
        message={`Sign out ${session().email ?? 'user'} from FLINT?`}
        confirmLabel="Sign Out"
        danger
        onConfirm={() => void handleLogout()}
        onCancel={() => setConfirmLogout(false)}
      />
    </div>
  );
}
