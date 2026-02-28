import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '../../..');
const DIST = join(ROOT, 'dist');
const ASSETS = join(DIST, 'assets');

describe('bundle size audit', () => {
  beforeAll(() => {
    execSync('bun run build', { cwd: ROOT, stdio: 'pipe' });
  }, 60_000);

  function assetsByExt(ext: string): string[] {
    return readdirSync(ASSETS).filter((f) => f.endsWith(ext));
  }

  function totalKb(files: string[], dir: string): number {
    return files.reduce((sum, f) => sum + statSync(join(dir, f)).size, 0) / 1024;
  }

  it('build produces at least one JS chunk', () => {
    expect(assetsByExt('.js').length).toBeGreaterThan(0);
  });

  it('build produces at least one CSS file', () => {
    expect(assetsByExt('.css').length).toBeGreaterThan(0);
  });

  it('total JS bundle is under 500 KB', () => {
    const kb = totalKb(assetsByExt('.js'), ASSETS);
    expect(kb).toBeLessThan(500);
  });

  it('total CSS bundle is under 100 KB', () => {
    const kb = totalKb(assetsByExt('.css'), ASSETS);
    expect(kb).toBeLessThan(100);
  });

  it('dist/index.html exists and references assets', () => {
    const html = readFileSync(join(DIST, 'index.html'), 'utf-8');
    expect(html).toMatch(/assets\//);
  });
});
