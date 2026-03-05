/**
 * docker/static-server.ts
 *
 * Minimal Bun static file server for the production Vite build.
 * Supports SPA-style routing — unknown paths fall back to index.html.
 * No npm packages required; uses Bun's built-in HTTP and file APIs.
 */

const DIST = './dist';
const PORT = parseInt(process.env['PORT'] ?? '8080', 10);

const MIME: Record<string, string> = {
  '.html':  'text/html; charset=utf-8',
  '.js':    'application/javascript',
  '.mjs':   'application/javascript',
  '.css':   'text/css',
  '.svg':   'image/svg+xml',
  '.png':   'image/png',
  '.jpg':   'image/jpeg',
  '.jpeg':  'image/jpeg',
  '.ico':   'image/x-icon',
  '.json':  'application/json',
  '.woff':  'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':   'font/ttf',
  '.map':   'application/json',
};

function extOf(path: string): string {
  const dot = path.lastIndexOf('.');
  return dot >= 0 ? path.slice(dot) : '';
}

function contentType(pathname: string): string {
  return MIME[extOf(pathname)] ?? 'application/octet-stream';
}

Bun.serve({
  port: PORT,
  hostname: '0.0.0.0',

  async fetch(req) {
    const url = new URL(req.url);
    const pathname = url.pathname === '/' ? '/index.html' : url.pathname;

    // Try the exact file first
    const file = Bun.file(`${DIST}${pathname}`);
    if (await file.exists()) {
      return new Response(file, {
        headers: { 'Content-Type': contentType(pathname) },
      });
    }

    // SPA fallback — let the SolidJS router handle the path
    return new Response(Bun.file(`${DIST}/index.html`), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  },
});

console.log(`TWM dashboard  →  http://0.0.0.0:${PORT}`);