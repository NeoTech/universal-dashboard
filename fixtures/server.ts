import { createServer as httpCreateServer } from 'node:http';
import type { Server, IncomingMessage, ServerResponse } from 'node:http';

// ── HTML Fragments ────────────────────────────────────────────────────────────
const fragments: Record<string, string> = {
  terminal: `<div class="panel-content terminal" data-panel-type="terminal">
  <pre class="terminal-output"><span class="prompt">$ </span></pre>
</div>`,

  editor: `<div class="panel-content editor" data-panel-type="editor">
  <p class="placeholder">Editor panel</p>
</div>`,

  browser: `<div class="panel-content browser" data-panel-type="browser">
  <p class="placeholder">Browser panel</p>
</div>`,

  filetree: `<div class="panel-content filetree" data-panel-type="filetree">
  <ul class="tree"><li class="tree-item">src/</li></ul>
</div>`,

  empty: `<div class="panel-content empty" data-panel-type="empty"></div>`,
};

// ── CORS headers ──────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? '/', `http://localhost`);
  const { pathname } = url;

  // Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  // ── GET / — service manifest
  if (pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
    res.end(JSON.stringify({ service: 'twm-fixtures', fragments: Object.keys(fragments) }));
    return;
  }

  // ── GET /fragment/:name — HTML fragment
  if (pathname.startsWith('/fragment/')) {
    const name = pathname.slice('/fragment/'.length);
    const html = fragments[name];
    if (html) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...CORS });
      res.end(html);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain', ...CORS });
      res.end(`Fragment "${name}" not found. Available: ${Object.keys(fragments).join(', ')}`);
    }
    return;
  }

  // ── GET /events — SSE stream
  if (pathname === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      ...CORS,
    });
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
    const timer = setInterval(() => {
      res.write(`data: ${JSON.stringify({ type: 'ping', ts: Date.now() })}\n\n`);
    }, 5_000);
    req.on('close', () => clearInterval(timer));
    return;
  }

  // ── 404 fallback
  res.writeHead(404, { 'Content-Type': 'text/plain', ...CORS });
  res.end('Not found');
}

export function createFixtureServer(): Server {
  return httpCreateServer(handleRequest);
}

// ── Entrypoint (bun run fixtures) ────────────────────────────────────────────
// Only start when run directly (Bun: import.meta.main), not when imported by tests
if ((import.meta as { main?: boolean }).main) {
  const PORT = parseInt(process.env['FIXTURES_PORT'] ?? '5174', 10);
  const server = createFixtureServer();
  server.listen(PORT, () => {
    console.warn(`TWM fixture server → http://localhost:${PORT}`);
    console.warn(`  Fragments: ${Object.keys(fragments).join(', ')}`);
    console.warn(`  SSE:       http://localhost:${PORT}/events`);
  });
}
