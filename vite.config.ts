import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

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
      '/api':    { target: 'http://localhost:3001', changeOrigin: true },
      '/health': { target: 'http://localhost:3001', changeOrigin: true },
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
