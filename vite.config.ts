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
  },
});
