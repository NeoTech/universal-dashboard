import { createSignal, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { API_BASE_URL } from '../data/api';
import { useAuth } from './AuthContext';

type Mode = 'login' | 'register';

interface LoginResponse {
  token?: string;
  user?: { id: number; username: string };
  error?: string;
}

/**
 * Modal login UI that gates access to the dashboard when `AUTH_ENABLED=true`.
 *
 * Renders one of two modes depending on the server's active auth provider:
 *
 * - **Local** (`AUTH_PROVIDER=local`): username/password form that supports
 *   both `login` and `register` modes. On success, calls `auth.login()` to
 *   store the JWT and user in context + `localStorage`.
 *
 * - **SAML SSO** (`AUTH_PROVIDER=saml`): a single "Sign in with SSO" button
 *   that redirects the browser to the IdP via `/api/auth/saml/login`. After
 *   the IdP posts the assertion back to the ACS endpoint the server redirects
 *   to the frontend with `?token=<jwt>`, which {@link AuthProvider} consumes.
 *
 * This component reads auth state via {@link useAuth} and must be rendered
 * inside an `<AuthProvider>`.
 *
 * @returns The full-screen login overlay JSX element.
 */
export function LoginModal(): JSX.Element {
  const auth = useAuth();

  // All signals declared unconditionally — SolidJS requires signal creation
  // to happen during the synchronous component setup, not inside a branch.
  const [mode, setMode]                       = createSignal<Mode>('login');
  const [username, setUsername]               = createSignal('');
  const [password, setPassword]               = createSignal('');
  const [confirmPassword, setConfirmPassword] = createSignal('');
  const [error, setError]                     = createSignal<string | null>(null);
  const [loading, setLoading]                 = createSignal(false);

  async function handleSubmit(e: Event): Promise<void> {
    e.preventDefault();
    setError(null);

    if (mode() === 'register' && password() !== confirmPassword()) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const endpoint = mode() === 'login' ? '/api/auth/login' : '/api/auth/register';
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username().trim(), password: password() }),
      });
      const data = await res.json() as LoginResponse;
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong');
        return;
      }
      if (data.token && data.user) {
        auth.login(data.token, data.user);
      }
    } catch {
      setError('Could not connect to the API server');
    } finally {
      setLoading(false);
    }
  }

  function switchMode(): void {
    setMode((m) => (m === 'login' ? 'register' : 'login'));
    setError(null);
  }

  return (
    <div class="login-overlay">
      <div class="login-modal">
        <div class="login-modal__logo">⊞</div>
        <h1 class="login-modal__title">Tiling Dashboard</h1>

        {/* ── SAML SSO path — rendered reactively once /api/auth/config resolves ── */}
        <Show
          when={auth.provider() === 'saml'}
          fallback={
            <>
              <p class="login-modal__subtitle">
                {mode() === 'login' ? 'Sign in to your dashboard' : 'Create a new account'}
              </p>

              <form class="login-modal__form" onSubmit={handleSubmit}>
                <label class="field">
                  <span class="field__label">Username</span>
                  <input
                    class="field__input"
                    type="text"
                    value={username()}
                    onInput={(e) => setUsername(e.currentTarget.value)}
                    required
                    minLength={2}
                    autocomplete="username"
                    autofocus
                  />
                </label>

                <label class="field">
                  <span class="field__label">Password</span>
                  <input
                    class="field__input"
                    type="password"
                    value={password()}
                    onInput={(e) => setPassword(e.currentTarget.value)}
                    required
                    minLength={6}
                    autocomplete={mode() === 'login' ? 'current-password' : 'new-password'}
                  />
                </label>

                <Show when={mode() === 'register'}>
                  <label class="field">
                    <span class="field__label">Confirm Password</span>
                    <input
                      class="field__input"
                      type="password"
                      value={confirmPassword()}
                      onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                      required
                      autocomplete="new-password"
                    />
                  </label>
                </Show>

                <Show when={error()}>
                  <p class="login-modal__error">{error()}</p>
                </Show>

                <button
                  class="btn btn--primary login-modal__submit"
                  type="submit"
                  disabled={loading()}
                >
                  {loading() ? '…' : mode() === 'login' ? 'Sign In' : 'Create Account'}
                </button>
              </form>

              <button class="login-modal__toggle" type="button" onClick={switchMode}>
                {mode() === 'login'
                  ? "Don't have an account? Register"
                  : 'Already have an account? Sign In'}
              </button>
            </>
          }
        >
          <p class="login-modal__subtitle">Sign in via your organisation's identity provider</p>
          <button
            class="btn btn--primary login-modal__submit"
            type="button"
            onClick={() => {
              window.location.href = auth.samlLoginUrl() ?? `${API_BASE_URL}/api/auth/saml/login`;
            }}
          >
            Sign in with SSO
          </button>
        </Show>
      </div>
    </div>
  );
}

