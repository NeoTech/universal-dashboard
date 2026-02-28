import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Manually parse .env at config time so VITE_API_URL is available for the proxy
// target before Vite's own env loading runs.  Falls back to process.env (useful
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

const apiTarget = process.env['VITE_API_URL'] ?? readDotEnvKey('VITE_API_URL') ?? 'http://localhost:3001';

export default defineConfig({
  plugins: [solidPlugin()],
  build: {
    target: 'es2022',
  },
  worker: {
    format: 'es',
  },
  server: {
    port: 8080,
    allowedHosts: true,
    proxy: {
      '/api':    { target: apiTarget, changeOrigin: true },
      '/health': { target: apiTarget, changeOrigin: true },
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
