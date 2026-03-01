// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { normalizeGHRun, batchConcurrent } from '../github.ts';
import type { GHApiRun } from '../github.ts';

// ── normalizeGHRun ────────────────────────────────────────────────────────────

const baseRun: GHApiRun = {
  id: 12345,
  name: 'CI Workflow',
  head_branch: 'main',
  head_sha: 'abc123def456',
  run_number: 42,
  event: 'push',
  status: 'completed',
  conclusion: 'success',
  html_url: 'https://github.com/owner/repo/actions/runs/12345',
  created_at: '2024-01-01T10:00:00Z',
  updated_at: '2024-01-01T10:05:00Z',
  repository: { full_name: 'owner/repo' },
};

describe('normalizeGHRun', () => {
  it('maps all fields from a basic run', () => {
    const result = normalizeGHRun(baseRun);

    expect(result.id).toBe(12345);
    expect(result.workflow_name).toBe('CI Workflow');
    expect(result.head_branch).toBe('main');
    expect(result.head_sha).toBe('abc123def456');
    expect(result.run_number).toBe(42);
    expect(result.event).toBe('push');
    expect(result.status).toBe('completed');
    expect(result.conclusion).toBe('success');
    expect(result.repository).toBe('owner/repo');
    expect(result.html_url).toBe('https://github.com/owner/repo/actions/runs/12345');
    expect(result.created_at).toBe('2024-01-01T10:00:00Z');
    expect(result.updated_at).toBe('2024-01-01T10:05:00Z');
  });

  it('uses display_title as name when present', () => {
    const run = { ...baseRun, display_title: 'feat: my feature branch', name: 'CI Workflow' };
    const result = normalizeGHRun(run);
    expect(result.name).toBe('feat: my feature branch');
    expect(result.workflow_name).toBe('CI Workflow');
  });

  it('falls back to name when display_title is absent', () => {
    const result = normalizeGHRun(baseRun);
    expect(result.name).toBe('CI Workflow');
    expect(result.workflow_name).toBe('CI Workflow');
  });

  it('preserves null conclusion', () => {
    const run: GHApiRun = { ...baseRun, conclusion: null };
    const result = normalizeGHRun(run);
    expect(result.conclusion).toBeNull();
  });

  it('flattens repository to full_name string', () => {
    const run: GHApiRun = { ...baseRun, repository: { full_name: 'myorg/myrepo' } };
    const result = normalizeGHRun(run);
    expect(result.repository).toBe('myorg/myrepo');
  });
});

// ── batchConcurrent ───────────────────────────────────────────────────────────

describe('batchConcurrent', () => {
  it('returns all results in order', async () => {
    const tasks = [1, 2, 3, 4, 5].map((n) => () => Promise.resolve(n * 10));
    const result = await batchConcurrent(tasks, 2);
    expect(result).toEqual([10, 20, 30, 40, 50]);
  });

  it('handles a single-item task list', async () => {
    const result = await batchConcurrent([() => Promise.resolve('only')], 3);
    expect(result).toEqual(['only']);
  });

  it('handles empty task list', async () => {
    const result = await batchConcurrent([], 5);
    expect(result).toEqual([]);
  });

  it('runs at most concurrency tasks at a time', async () => {
    let active = 0;
    let maxActive = 0;

    const task = () =>
      new Promise<number>((resolve) => {
        active++;
        maxActive = Math.max(maxActive, active);
        // Yield to let other microtasks run, then resolve
        setTimeout(() => { active--; resolve(active); }, 0);
      });

    const tasks = Array.from({ length: 6 }, () => task);
    await batchConcurrent(tasks, 3);
    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it('works with concurrency larger than task count', async () => {
    const tasks = [1, 2].map((n) => () => Promise.resolve(n));
    const result = await batchConcurrent(tasks, 100);
    expect(result).toEqual([1, 2]);
  });
});
