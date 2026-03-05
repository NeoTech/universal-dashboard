import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Manually parse .env at config time so VITE_API_URL / VITE_PROXY_TARGET are
// available for the proxy target before Vite's own env loading runs. Falls back to process.env (useful
// when the variable is exported in the shell before running `bun run dev`).
function readDotEnvKey(key: string): string | undefined {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) return undefined;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    if (t.slice(0, eq).trim() === key) return t.slice(eq + 1);
  }
  return undefined;
}

function readConfigValue(key: string): string | undefined {
  const value = (process.env[key] ?? readDotEnvKey(key))?.trim();
  return value ? value : undefined;
}

const browserApiUrl = readConfigValue('VITE_API_URL');
const apiTarget = readConfigValue('VITE_PROXY_TARGET')
  ?? ((browserApiUrl?.startsWith('http://') || browserApiUrl?.startsWith('https://')) ? browserApiUrl : undefined)
  ?? 'http://localhost:3001';
const wsTarget = readConfigValue('VITE_WS_PROXY_TARGET')
  ?? (apiTarget.startsWith('https://') ? `wss://${apiTarget.slice('https://'.length)}`
    : apiTarget.startsWith('http://') ? `ws://${apiTarget.slice('http://'.length)}`
    : apiTarget.startsWith('wss://') || apiTarget.startsWith('ws://') ? apiTarget
    : 'ws://localhost:3001');

export default defineConfig({
  plugins: [solidPlugin()],
  build: {
    target: 'es2022',
  },
  worker: {
    format: 'es',
  },
  server: {
    port: 5187,
    allowedHosts: true,
    proxy: {
      '/api':    { target: apiTarget, changeOrigin: true },
      '/health': { target: apiTarget, changeOrigin: true },
      '/ws':     { target: wsTarget, changeOrigin: true, ws: true },
    },
    // Don't restart the Vite dev server when .env changes.
    // The API server reads .env directly from disk; only VITE_* vars affect
    // the frontend bundle, and those require a manual restart anyway.
    // Note: negation patterns (!) crash Bun v1.3.9's watcher — keep simple.
    watch: {
      ignored: (path: string) => path.endsWith('.env') || /[/\\]\.env\.[^/\\]+$/.test(path),
    },
  },
});
