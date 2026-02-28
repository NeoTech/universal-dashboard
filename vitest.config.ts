import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    resolve: {
      // Force solid-js to use the browser (client) build, not the SSR build.
      conditions: ['browser', 'development', 'module', 'import', 'require', 'default'],
    },
    test: {
      environment: 'jsdom',
      globals: false,
      pool: 'forks',
      setupFiles: ['src/__tests__/setup.ts'],
      server: {
        deps: {
          // Force Solid.js and testing-library through Vite's pipeline so
          // resolve.conditions ('browser') picks the client build, not server.
          inline: [/solid-js/, /@solidjs\//],
        },
      },
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'lcov'],
        exclude: [
          'node_modules/**',
          'fixtures/**',
          'e2e/**',
          '**/*.config.*',
          '**/__tests__/**',
          '**/index.ts',
        ],
      },
      include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    },
  }),
);
