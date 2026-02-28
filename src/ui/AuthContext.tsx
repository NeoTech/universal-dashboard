/**
 * AuthContext — JWT-based authentication context.
 *
 * When AUTH_ENABLED=true on the server:
 *   - User must log in before accessing the dashboard.
 *   - JWT is stored in localStorage under 'twm-jwt'.
 *   - window.fetch is patched to include `Authorization: Bearer <token>`
 *     on all /api/ requests so existing tile fetches need no changes.
 *
 * When AUTH_ENABLED=false (default): operates in pass-through mode;
 * context is available but auth gates are skipped.
 */
import { createContext, useContext, createSignal, onMount } from 'solid-js';
import type { JSX } from 'solid-js';
import { API_BASE_URL } from '../data/api';

export interface AuthUser {
  id: number;
  username: string;
}

interface AuthCtxValue {
  token:           () => string | null;
  user:            () => AuthUser | null;
  authEnabled:     () => boolean;
  /** True once /api/auth/config has resolved (or failed). Gate tiles behind this. */
  authReady:       () => boolean;
  provider:        () => 'local' | 'saml';
  samlLoginUrl:    () => string | null;
  isAuthenticated: () => boolean;
  login:           (token: string, user: AuthUser) => void;
  logout:          () => void;
}

const AuthContext = createContext<AuthCtxValue>();

const TOKEN_KEY = 'twm-jwt';
const USER_KEY  = 'twm-user';

function readLocal<T>(key: string): T | null {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : null; } catch { return null; }
}

export function AuthProvider(props: { children: JSX.Element }): JSX.Element {
  const [token, setToken]           = createSignal<string | null>(localStorage.getItem(TOKEN_KEY));
  const [user,  setUser]            = createSignal<AuthUser | null>(readLocal<AuthUser>(USER_KEY));
  const [authEnabled, setAuthEnabled] = createSignal(false);
  // authReady: false until /api/auth/config has resolved — prevents tiles from
  // mounting and firing requests before we know whether auth is required.
  // Starts true in test environments (import.meta.env.VITEST) where there is no server.
  const [authReady, setAuthReady]   = createSignal(!!import.meta.env['VITEST']);
  const [provider, setProvider]     = createSignal<'local' | 'saml'>('local');
  const [samlLoginUrl, setSamlLoginUrl] = createSignal<string | null>(null);

  onMount(() => {
    // Patch window.fetch once to auto-inject the Bearer token on /api/ calls.
    // This means all existing fetch() calls throughout the codebase get auth
    // for free without needing per-call changes.
    const orig = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const t = token();
      if (!t) return orig(input, init);
      const url = (typeof input === 'string') ? input
                : (input instanceof URL) ? input.href
                : (input as Request).url;
      if (url.includes('/api/')) {
        const headers = new Headers((init as RequestInit | undefined)?.headers);
        if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${t}`);
        return orig(input, { ...(init as RequestInit | undefined), headers });
      }
      return orig(input, init);
    };

    // Discover server auth mode.
    void fetch(`${API_BASE_URL}/api/auth/config`)
      .then((r) => r.json())
      .then((cfg: unknown) => {
        if (cfg && typeof cfg === 'object') {
          const c = cfg as { enabled?: boolean; provider?: string; samlLoginUrl?: string | null };
          if (typeof c.enabled === 'boolean') setAuthEnabled(c.enabled);
          if (c.provider === 'saml') setProvider('saml');
          if (c.samlLoginUrl) setSamlLoginUrl(c.samlLoginUrl);
        }
      })
      .catch(() => { /* server not reachable yet — proceed unauthenticated */ })
      .finally(() => { setAuthReady(true); });

    // Consume ?token= from the URL (issued after SAML callback redirect).
    const qs = new URLSearchParams(window.location.search);
    const urlToken = qs.get('token');
    if (urlToken) {
      // Strip the token param from the URL without triggering a reload.
      qs.delete('token');
      const newSearch = qs.toString();
      history.replaceState(null, '', window.location.pathname + (newSearch ? '?' + newSearch : ''));
      // Fetch the user info to populate the context.
      void fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${urlToken}` },
      })
        .then((r) => r.ok ? r.json() : Promise.reject(new Error('me failed')))
        .then((u: unknown) => {
          const authUser = u as AuthUser;
          if (authUser.id && authUser.username) login(urlToken, authUser);
        })
        .catch(() => { /* token invalid — ignore, stay logged out */ });
    }
  });

  function login(t: string, u: AuthUser): void {
    setToken(t);
    setUser(u);
    try { localStorage.setItem(TOKEN_KEY, t); localStorage.setItem(USER_KEY, JSON.stringify(u)); } catch { /* noop */ }
  }

  function logout(): void {
    setToken(null);
    setUser(null);
    try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); } catch { /* noop */ }
  }

  const ctx: AuthCtxValue = {
    token,
    user,
    authEnabled,
    authReady,
    provider,
    samlLoginUrl,
    isAuthenticated: () => !!token(),
    login,
    logout,
  };

  return <AuthContext.Provider value={ctx}>{props.children}</AuthContext.Provider>;
}

export function useAuth(): AuthCtxValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
