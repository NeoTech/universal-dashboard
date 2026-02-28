import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createFixtureServer } from '../../fixtures/server';
import type { Server } from 'node:http';

const PORT = 5175; // separate port so it doesn't clash with e2e server on 5174
let server: Server;

beforeAll(
  () =>
    new Promise<void>((resolve) => {
      server = createFixtureServer();
      server.listen(PORT, resolve);
    }),
);

afterAll(
  () =>
    new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    }),
);

describe('fixture server', () => {
  it('GET / returns service manifest', async () => {
    const res = await fetch(`http://localhost:${PORT}/`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { service: string; fragments: string[] };
    expect(json.service).toBe('twm-fixtures');
    expect(json.fragments).toContain('terminal');
    expect(json.fragments).toContain('editor');
  });

  it('GET /fragment/terminal returns HTML', async () => {
    const res = await fetch(`http://localhost:${PORT}/fragment/terminal`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('panel-content');
  });

  it('GET /fragment/editor returns HTML', async () => {
    const res = await fetch(`http://localhost:${PORT}/fragment/editor`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('panel-content');
  });

  it('GET /fragment/missing returns 404', async () => {
    const res = await fetch(`http://localhost:${PORT}/fragment/missing`);
    expect(res.status).toBe(404);
  });

  it('GET /events sends SSE content-type', async () => {
    const ac = new AbortController();
    // Immediately abort after receiving the first bytes so we just check headers
    const res = await fetch(`http://localhost:${PORT}/events`, {
      signal: ac.signal,
    }).catch((e: Error) => {
      if (e.name === 'AbortError') return null;
      throw e;
    });
    ac.abort();
    // If we got a response before aborting, check the header
    if (res) {
      expect(res.headers.get('content-type')).toContain('text/event-stream');
    }
  });
});
