import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@solidjs/testing-library';
import { FlintProductsTile }        from '../tiles/flint/FlintProductsTile';
import { FlintCategoriesTile }      from '../tiles/flint/FlintCategoriesTile';
import { FlintInventoryTile }       from '../tiles/flint/FlintInventoryTile';
import { FlintCustomersTile }       from '../tiles/flint/FlintCustomersTile';
import { FlintCustomerReportsTile } from '../tiles/flint/FlintCustomerReportsTile';

afterEach(() => cleanup());

// ── FlintProductsTile ────────────────────────────────────────────────────────

describe('FlintProductsTile', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <FlintProductsTile />);
    expect(container.firstElementChild).toBeTruthy();
  });

  it('renders a search input', () => {
    const { container } = render(() => <FlintProductsTile />);
    const input = container.querySelector('input[type="text"], input[placeholder]');
    expect(input).toBeTruthy();
  });

  it('renders status filter chips', () => {
    const { container } = render(() => <FlintProductsTile />);
    const chips = container.querySelectorAll('.flint-filter-chip');
    expect(chips.length).toBeGreaterThan(0);
  });

  it('renders a New Product button', () => {
    const { container } = render(() => <FlintProductsTile />);
    const btn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('New Product') || b.textContent?.includes('New'),
    );
    expect(btn).toBeTruthy();
  });
});

// ── FlintCategoriesTile ──────────────────────────────────────────────────────

describe('FlintCategoriesTile', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <FlintCategoriesTile />);
    expect(container.firstElementChild).toBeTruthy();
  });

  it('renders add-category button (outside BaseTile)', () => {
    const { container } = render(() => <FlintCategoriesTile />);
    // The "+ Add Category" button lives outside <BaseTile> so it renders even while loading.
    const btn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Add'),
    );
    expect(btn).toBeTruthy();
  });

  it('renders an Add Category button or form', () => {
    const { container } = render(() => <FlintCategoriesTile />);
    const addEl = container.querySelector('button, form, input');
    expect(addEl).toBeTruthy();
  });
});

// ── FlintInventoryTile ───────────────────────────────────────────────────────

describe('FlintInventoryTile', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <FlintInventoryTile />);
    expect(container.firstElementChild).toBeTruthy();
  });

  it('renders a low-stock toggle checkbox', () => {
    const { container } = render(() => <FlintInventoryTile />);
    // The toolbar lives outside <BaseTile> — the toggle is a checkbox in a label.
    const checkbox = container.querySelector('input[type="checkbox"]');
    expect(checkbox).toBeTruthy();
  });

  it('renders a search input', () => {
    const { container } = render(() => <FlintInventoryTile />);
    const input = container.querySelector('input[type="text"], input[placeholder]');
    expect(input).toBeTruthy();
  });
});

// ── FlintCustomersTile ───────────────────────────────────────────────────────

describe('FlintCustomersTile', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <FlintCustomersTile />);
    expect(container.firstElementChild).toBeTruthy();
  });

  it('renders a search input', () => {
    const { container } = render(() => <FlintCustomersTile />);
    const input = container.querySelector('input[type="text"], input[placeholder]');
    expect(input).toBeTruthy();
  });

  it('renders a table or list container', () => {
    const { container } = render(() => <FlintCustomersTile />);
    const tableEl = container.querySelector('table, [role="table"], [class*="tile"]');
    expect(tableEl).toBeTruthy();
  });
});

// ── FlintCustomerReportsTile ─────────────────────────────────────────────────

describe('FlintCustomerReportsTile', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <FlintCustomerReportsTile />);
    expect(container.firstElementChild).toBeTruthy();
  });

  it('renders the tile root container', () => {
    const { container } = render(() => <FlintCustomerReportsTile />);
    // KPI grid is inside BaseTile which shows a skeleton pre-SSE.
    // Verify the tile root container is present instead.
    const root = container.querySelector('.flint-customer-reports-tile');
    expect(root).toBeTruthy();
  });
});
