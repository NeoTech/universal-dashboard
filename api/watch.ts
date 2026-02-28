/**
 * Simple supervisor: runs api/server.ts as a child process and restarts it
 * whenever it exits with code 0 (e.g. triggered by POST /api/server/restart).
 * Exits itself if the child crashes (non-zero exit code) to avoid restart loops.
 *
 * Usage: bun run watch-api   →   bun api/watch.ts
 */
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverScript = join(__dirname, 'server.ts');

function start(): void {
  console.log('[watch] starting api/server.ts …');
  const child = spawn(process.execPath, [serverScript], {
    stdio: 'inherit',
    env: process.env as Record<string, string>,
    cwd: process.cwd(),
  });

  child.on('exit', (code) => {
    if (code === 0) {
      console.log('[watch] server exited cleanly — restarting in 500ms …');
      setTimeout(start, 500);
    } else {
      console.log(`[watch] server exited with code ${code ?? 'null'} — not restarting`);
      process.exit(code ?? 1);
    }
  });
}

start();
