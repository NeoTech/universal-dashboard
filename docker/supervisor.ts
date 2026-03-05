type ManagedProcess = {
  name: string;
  cmd: string[];
  env?: Record<string, string>;
};

function mergedEnv(extra?: Record<string, string>): Record<string, string> {
  return { ...(process.env as Record<string, string>), ...(extra ?? {}) };
}

const frontendPort = process.env['FRONTEND_PORT'] ?? '5187';
const traefikWebPort = process.env['TRAEFIK_WEB_PORT'] ?? '8080';

const processes: ManagedProcess[] = [
  {
    name: 'api',
    cmd: ['/app/bin/server'],
    env: { API_HOST: process.env['API_HOST'] ?? '0.0.0.0', API_PORT: process.env['API_PORT'] ?? '3001' },
  },
  {
    name: 'frontend',
    cmd: ['/app/bin/frontend'],
    env: { PORT: frontendPort },
  },
  {
    name: 'traefik',
    cmd: ['/app/bin/traefik', '--configFile=/app/traefik.local.yml'],
  },
];

const ngrokToken = process.env['NGROK_AUTHTOKEN']?.trim();
if (ngrokToken) {
  const ngrokDomain = process.env['NGROK_DOMAIN']?.trim();
  const cmd = ngrokDomain
    ? ['/app/bin/ngrok', 'http', `--authtoken=${ngrokToken}`, `--url=${ngrokDomain}`, `http://127.0.0.1:${traefikWebPort}`]
    : ['/app/bin/ngrok', 'http', `--authtoken=${ngrokToken}`, `http://127.0.0.1:${traefikWebPort}`];
  processes.push({ name: 'ngrok', cmd });
}

const children = new Map<string, ReturnType<typeof Bun.spawn>>();

function log(message: string): void {
  // eslint-disable-next-line no-console
  console.log(`[supervisor] ${message}`);
}

function startProcess(proc: ManagedProcess): void {
  log(`starting ${proc.name}: ${proc.cmd.join(' ')}`);
  const child = Bun.spawn({
    cmd: proc.cmd,
    stdout: 'inherit',
    stderr: 'inherit',
    env: mergedEnv(proc.env),
  });
  children.set(proc.name, child);
}

function stopAll(signal: NodeJS.Signals = 'SIGTERM'): void {
  for (const child of children.values()) {
    try {
      child.kill(signal);
    } catch {
      // ignore
    }
  }
}

let shuttingDown = false;
function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`received ${signal}, stopping children`);
  stopAll(signal);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

for (const proc of processes) startProcess(proc);

const exitRace = [...children.entries()].map(async ([name, child]) => {
  const code = await child.exited;
  return { name, code };
});

const first = await Promise.race(exitRace);
log(`${first.name} exited with code ${String(first.code)}`);
shutdown('SIGTERM');
process.exit(typeof first.code === 'number' ? first.code : 1);
