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
      .then((cfg: unknown) => { if (cfg && typeof cfg === 'object' && 'enabled' in cfg) setAuthEnabled((cfg as { enabled: boolean }).enabled); })
      .catch(() => { /* server not reachable yet */ });
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
