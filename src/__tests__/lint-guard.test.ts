import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../..');

describe('lint-guard', () => {
  it('eslint.config.mjs exists', () => {
    expect(existsSync(resolve(root, 'eslint.config.mjs'))).toBe(true);
  });

  it('.prettierrc exists', () => {
    expect(existsSync(resolve(root, '.prettierrc'))).toBe(true);
  });

  it('src passes ESLint with no errors', () => {
    let output = '';
    try {
      output = execSync('bun run lint --max-warnings 0', {
        cwd: root,
        encoding: 'utf-8',
        timeout: 30_000,
      });
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; status?: number };
      throw new Error(
        `ESLint failed (exit ${e.status}):\n${e.stdout ?? ''}\n${e.stderr ?? ''}`,
      );
    }
    // eslint exits 0 → output is empty or just whitespace
    expect(output.trim()).not.toMatch(/error/i);
  });
});
