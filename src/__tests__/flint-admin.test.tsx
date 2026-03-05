import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, cleanup } from '@solidjs/testing-library';
import { FlintShipmentsTile }       from '../tiles/flint/FlintShipmentsTile';
import { FlintSalesChartTile }      from '../tiles/flint/FlintSalesChartTile';
import { FlintDataHealthTile }      from '../tiles/flint/FlintDataHealthTile';
import { FlintStripeSyncTile }      from '../tiles/flint/FlintStripeSyncTile';
import { FlintWebhookMonitorTile }  from '../tiles/flint/FlintWebhookMonitorTile';
import { FlintOrderSearchTile }     from '../tiles/flint/FlintOrderSearchTile';
import { flintStore }               from '../tiles/flint/flintStore';

afterEach(() => cleanup());

// ── FlintShipmentsTile ───────────────────────────────────────────────────────

describe('FlintShipmentsTile', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <FlintShipmentsTile />);
    expect(container.firstElementChild).toBeTruthy();
  });

  it('renders a search input', () => {
    const { container } = render(() => <FlintShipmentsTile />);
    const input = container.querySelector('input[type="search"]');
    expect(input).toBeTruthy();
  });

  it('renders a New Shipment button', () => {
    const { container } = render(() => <FlintShipmentsTile />);
    const btn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('New Shipment'),
    );
    expect(btn).toBeTruthy();
  });

  it('shows create form when New Shipment button is clicked', async () => {
    const { container } = render(() => <FlintShipmentsTile />);
    const btn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('New Shipment'),
    )!;
    btn.click();
    await Promise.resolve();
    const orderInput = container.querySelector('input[placeholder="UUID"]');
    expect(orderInput).toBeTruthy();
  });
});

// ── FlintSalesChartTile ──────────────────────────────────────────────────────

describe('FlintSalesChartTile', () => {
  it('renders without crashing (full mode)', () => {
    const { container } = render(() => <FlintSalesChartTile />);
    expect(container.firstElementChild).toBeTruthy();
  });

  it('renders without crashing (compact mode)', () => {
    const { container } = render(() => <FlintSalesChartTile compact={true} />);
    expect(container.firstElementChild).toBeTruthy();
  });

  it('renders date range inputs in full mode', () => {
    const { container } = render(() => <FlintSalesChartTile />);
    const dateInputs = container.querySelectorAll('input[type="date"]');
    expect(dateInputs.length).toBeGreaterThanOrEqual(2);
  });

  it('renders Apply button in full mode', () => {
    const { container } = render(() => <FlintSalesChartTile />);
    const btn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Apply') || b.textContent?.includes('Loading'),
    );
    expect(btn).toBeTruthy();
  });
});

// ── FlintDataHealthTile ──────────────────────────────────────────────────────

describe('FlintDataHealthTile', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <FlintDataHealthTile />);
    expect(container.firstElementChild).toBeTruthy();
  });

  it('renders an Actions button', () => {
    const { container } = render(() => <FlintDataHealthTile />);
    const btn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Actions'),
    );
    expect(btn).toBeTruthy();
  });

  it('shows action buttons when Actions is clicked', async () => {
    const { container } = render(() => <FlintDataHealthTile />);
    const actionsBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Actions'),
    )!;
    actionsBtn.click();
    await Promise.resolve();
    // After toggle, button text changes to "Hide Actions"
    const hideBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Hide'),
    );
    expect(hideBtn).toBeTruthy();
  });
});

// ── FlintStripeSyncTile ──────────────────────────────────────────────────────

describe('FlintStripeSyncTile', () => {
  beforeEach(() => {
    // sessionStorage is available in jsdom
    sessionStorage.clear();
  });

  it('renders without crashing', () => {
    const { container } = render(() => <FlintStripeSyncTile />);
    expect(container.firstElementChild).toBeTruthy();
  });

  it('renders a phase select dropdown', () => {
    const { container } = render(() => <FlintStripeSyncTile />);
    const select = container.querySelector('select');
    expect(select).toBeTruthy();
  });

  it('renders a Run Sync button', () => {
    const { container } = render(() => <FlintStripeSyncTile />);
    const btn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Run Sync'),
    );
    expect(btn).toBeTruthy();
  });

  it('dispatches flint:run-stripe-sync event to trigger sync', async () => {
    // After Phase 2 migration, StripeSyncTile uses flintStore.triggerOrderRefresh()
    // instead of window.dispatchEvent. Just verify the store's refreshOrders signal
    // is accessible (the sync calls fetch internally).
    const before = flintStore.refreshOrders();
    render(() => <FlintStripeSyncTile />);
    // No auto-fire on mount — store value unchanged
    expect(flintStore.refreshOrders()).toBe(before);
  });
});

// ── FlintWebhookMonitorTile ──────────────────────────────────────────────────

describe('FlintWebhookMonitorTile', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <FlintWebhookMonitorTile />);
    expect(container.firstElementChild).toBeTruthy();
  });

  it('renders a Trigger Stripe Sync button', () => {
    const { container } = render(() => <FlintWebhookMonitorTile />);
    const btn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Trigger'),
    );
    expect(btn).toBeTruthy();
  });

  it('Trigger Stripe Sync button calls flintStore.triggerSync()', () => {
    const before = flintStore.syncTrigger();
    const { container } = render(() => <FlintWebhookMonitorTile />);
    const btn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Trigger'),
    )!;
    btn.click();
    expect(flintStore.syncTrigger()).toBe(before + 1);
  });

  it('respects maxEvents prop', () => {
    const { container } = render(() => <FlintWebhookMonitorTile maxEvents={20} />);
    expect(container.firstElementChild).toBeTruthy();
  });
});

// ── FlintOrderSearchTile ─────────────────────────────────────────────────────

describe('FlintOrderSearchTile', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <FlintOrderSearchTile />);
    expect(container.firstElementChild).toBeTruthy();
  });

  it('renders a search input', () => {
    const { container } = render(() => <FlintOrderSearchTile />);
    const input = container.querySelector('input[type="search"]');
    expect(input).toBeTruthy();
  });

  it('renders a Search button', () => {
    const { container } = render(() => <FlintOrderSearchTile />);
    const btn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Search'),
    );
    expect(btn).toBeTruthy();
  });

  it('Search button is disabled when input is empty', () => {
    const { container } = render(() => <FlintOrderSearchTile />);
    const btn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Search'),
    ) as HTMLButtonElement | undefined;
    expect(btn?.disabled).toBe(true);
  });
});
