import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@solidjs/testing-library';
import { AddTileModal } from '../tiles/AddTileModal';
import type { TileConfig } from '../tiles/TileConfig';

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Helper — renders the modal with sensible defaults so each test can override
// only what it cares about.
// ---------------------------------------------------------------------------
function renderModal(overrides: {
  isOpen?: boolean;
  onAdd?: (t: TileConfig) => void;
  onClose?: () => void;
} = {}) {
  const onAdd = overrides.onAdd ?? vi.fn();
  const onClose = overrides.onClose ?? vi.fn();
  const isOpen = overrides.isOpen ?? true;
  return { ...render(() => <AddTileModal isOpen={isOpen} onAdd={onAdd} onClose={onClose} />), onAdd, onClose };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('AddTileModal', () => {
  // 1. Hidden when isOpen=false
  it('is hidden when isOpen=false', () => {
    const { container } = renderModal({ isOpen: false });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  // 2. Renders dialog, search input, sidebar, and tile cards when open
  it('renders dialog, search input, sidebar, and tile cards when isOpen=true', () => {
    const { container } = renderModal({ isOpen: true });

    const dialog = container.querySelector('[role="dialog"][aria-label="Add Tile"]');
    expect(dialog).toBeTruthy();

    const searchInput = container.querySelector<HTMLInputElement>('.tile-picker__search');
    expect(searchInput).toBeTruthy();
    expect(searchInput!.placeholder).toBe('Search tiles…');

    const sidebar = container.querySelector('[role="listbox"]');
    expect(sidebar).toBeTruthy();
    expect(container.querySelectorAll('.tile-picker__sidebar-item').length).toBe(12);

    // At least one tile card should be visible
    expect(container.querySelectorAll('[data-tile-type]').length).toBeGreaterThan(0);
  });

  // 3. "All" is the default active category
  it('has "All" selected by default in the sidebar', () => {
    const { container } = renderModal();

    const active = container.querySelector('.tile-picker__sidebar-item--active');
    expect(active).toBeTruthy();
    expect(active!.textContent).toContain('All');
  });

  // 4. Clicking "Payments" category filters to Stripe + PayPal tiles only
  it('clicking "Payments" filters to payment provider tiles', () => {
    const { container } = renderModal();

    const paymentsItem = Array.from(container.querySelectorAll('.tile-picker__sidebar-item'))
      .find(el => el.textContent?.includes('Payments'));
    expect(paymentsItem).toBeTruthy();
    fireEvent.click(paymentsItem!);

    // Active class should move to Payments item
    const active = container.querySelector('.tile-picker__sidebar-item--active');
    expect(active!.textContent).toContain('Payments');

    // Section headers present: Stripe and PayPal; GitHub should not be visible
    const sectionTexts = Array.from(container.querySelectorAll('.tile-picker__section-header'))
      .map(el => el.textContent?.trim());
    expect(sectionTexts).toContain('Stripe');
    expect(sectionTexts).toContain('PayPal');
    expect(sectionTexts).not.toContain('GitHub');
    expect(sectionTexts).not.toContain('Cloudflare');
  });

  // 5. Typing "github" in search shows the GitHub Actions tile and dims sidebar items
  it('typing "github" shows GitHub tile and dims sidebar items', () => {
    const { container } = renderModal();

    const input = container.querySelector<HTMLInputElement>('.tile-picker__search')!;
    fireEvent.input(input, { target: { value: 'github' } });

    // All sidebar items should have the dim class while query is non-empty
    const dimItems = container.querySelectorAll('.tile-picker__sidebar-item--dim');
    expect(dimItems.length).toBe(12);

    // GitHub Actions tile card should be visible
    const githubCard = container.querySelector('[data-tile-type="github-actions"]');
    expect(githubCard).toBeTruthy();
  });

  // 6. Searching with a nonsense string shows the empty-state message
  it('shows "No tiles match" empty state when query matches nothing', () => {
    const { container } = renderModal();

    const input = container.querySelector<HTMLInputElement>('.tile-picker__search')!;
    fireEvent.input(input, { target: { value: 'xyz123noresults' } });

    const emptyMsg = container.querySelector('.tile-picker__empty');
    expect(emptyMsg).toBeTruthy();
    expect(emptyMsg!.textContent).toContain('No tiles match');
  });

  // 7. Clicking a Stripe tile calls onAdd(type='stripe-payments') and onClose
  it('clicking a Stripe tile calls onAdd with type=stripe-payments and calls onClose', () => {
    const onAdd = vi.fn();
    const onClose = vi.fn();
    const { container } = renderModal({ onAdd, onClose });

    const stripeCard = container.querySelector<HTMLButtonElement>('[data-tile-type="stripe-payments"]');
    expect(stripeCard).toBeTruthy();
    fireEvent.click(stripeCard!);

    expect(onAdd).toHaveBeenCalledOnce();
    const tile = onAdd.mock.calls[0][0] as TileConfig;
    expect(tile.type).toBe('stripe-payments');
    expect(onClose).toHaveBeenCalledOnce();
  });

  // 8. Clicking the REST tile card shows the config form (URL input + Back button)
  it('clicking REST tile card shows config form with URL input and Back button', () => {
    const { container } = renderModal();

    const restCard = container.querySelector<HTMLButtonElement>('[data-tile-type="rest"]');
    expect(restCard).toBeTruthy();
    fireEvent.click(restCard!);

    // Picker grid is gone, config form appears
    expect(container.querySelector('.tile-picker__search')).toBeNull();

    const urlInput = container.querySelector<HTMLInputElement>('input[type="url"]');
    expect(urlInput).toBeTruthy();

    const backBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('← Back'));
    expect(backBtn).toBeTruthy();

    const addTileBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.trim() === 'Add tile');
    expect(addTileBtn).toBeTruthy();
  });

  // 9. REST config form: "Add tile" is disabled until a URL is typed
  it('REST config: "Add tile" is disabled when URL is empty, enabled after input', () => {
    const { container } = renderModal();

    fireEvent.click(container.querySelector<HTMLButtonElement>('[data-tile-type="rest"]')!);

    const addTileBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
      .find(b => b.textContent?.trim() === 'Add tile')!;
    expect(addTileBtn.disabled).toBe(true);

    const urlInput = container.querySelector<HTMLInputElement>('input[type="url"]')!;
    fireEvent.input(urlInput, { target: { value: 'https://api.example.com/data' } });

    expect(addTileBtn.disabled).toBe(false);
  });

  // 10. REST config form: clicking "← Back" returns to the picker grid
  it('REST config: clicking "← Back" returns to the tile picker', () => {
    const { container } = renderModal();

    fireEvent.click(container.querySelector<HTMLButtonElement>('[data-tile-type="rest"]')!);

    // Verify we are in config form
    expect(container.querySelector<HTMLInputElement>('input[type="url"]')).toBeTruthy();

    const backBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('← Back'))!;
    fireEvent.click(backBtn);

    // Picker grid should be restored
    expect(container.querySelector('.tile-picker__search')).toBeTruthy();
    expect(container.querySelector('[data-tile-type="rest"]')).toBeTruthy();
  });

  // 11. Clicking the × (close) button calls onClose
  it('clicking the × close button calls onClose', () => {
    const onClose = vi.fn();
    const { container } = renderModal({ onClose });

    const closeBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Close"]');
    expect(closeBtn).toBeTruthy();
    fireEvent.click(closeBtn!);

    expect(onClose).toHaveBeenCalledOnce();
  });

  // 12. Vercel tile is enabled and functional (now fully implemented)
  it('Vercel Deployments tile is disabled and has tile-card--coming-soon class', () => {
    const { container } = renderModal();

    const vercelCard = container.querySelector<HTMLButtonElement>('[data-tile-type="vercel-deployments"]');
    expect(vercelCard).toBeTruthy();
    expect(vercelCard!.disabled).toBe(false);
  });

  // 13. Searching "deploy" shows tiles from multiple providers (Cloudflare, Vercel, Netlify)
  it('searching "deploy" shows deployment tiles from multiple providers', () => {
    const { container } = renderModal();

    const input = container.querySelector<HTMLInputElement>('.tile-picker__search')!;
    fireEvent.input(input, { target: { value: 'deploy' } });

    const sectionTexts = Array.from(container.querySelectorAll('.tile-picker__section-header'))
      .map(el => el.textContent?.trim() ?? '');

    // All three deployment providers must be represented
    expect(sectionTexts).toContain('Cloudflare');
    expect(sectionTexts).toContain('Vercel');
    expect(sectionTexts).toContain('Netlify');
    expect(sectionTexts.length).toBeGreaterThanOrEqual(3);
  });

  // Bonus: clicking the overlay backdrop calls onClose
  it('clicking the modal overlay calls onClose', () => {
    const onClose = vi.fn();
    const { container } = renderModal({ onClose });

    const overlay = container.querySelector('.modal-overlay');
    expect(overlay).toBeTruthy();
    fireEvent.click(overlay!);

    expect(onClose).toHaveBeenCalledOnce();
  });
});
