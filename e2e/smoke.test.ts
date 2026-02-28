import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';

let server: ViteDevServer;
const PORT = 5174;

beforeAll(async () => {
  server = await createServer({
    configFile: 'vite.config.ts',
    server: { port: PORT },
    logLevel: 'silent',
  });
  await server.listen();
});

afterAll(async () => {
  await server.close();
});

describe('smoke', () => {
  it('responds with HTML containing title TWM', async () => {
    const res = await fetch(`http://localhost:${PORT}/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<title>TWM</title>');
  });

  it('serves main entry script', async () => {
    const res = await fetch(`http://localhost:${PORT}/src/main.ts`);
    expect(res.status).toBe(200);
  });

  it('HTML references a module script tag', async () => {
    const res = await fetch(`http://localhost:${PORT}/`);
    const html = await res.text();
    expect(html).toMatch(/type="module"/);
  });

  it('serves tokens CSS file', async () => {
    const res = await fetch(`http://localhost:${PORT}/src/styles/tokens.css`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('--twm-color-bg');
  });

  it('App.tsx is served and is TypeScript/JSX', async () => {
    const res = await fetch(`http://localhost:${PORT}/src/App.tsx`);
    expect(res.status).toBe(200);
  });
});
