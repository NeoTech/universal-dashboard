import { describe, it, expect, beforeEach } from 'vitest';
import { flintStore } from '../tiles/flint/flintStore';
import { formatCurrency, fmtDate, timeAgo, nextActions, stockClass } from '../tiles/flint/utils';

// ── Scenario 1: Morning order triage (TWM-155-1) ─────────────────────────────

describe('Scenario: Morning order triage', () => {
  beforeEach(() => {
    flintStore.clearOrderFilter();
    flintStore.clearSelectedProduct();
    flintStore.clearSelectedCustomer();
  });

  it('filterOrders sets order filter that consuming tiles can read', () => {
    expect(flintStore.orderFilter()).toBe(null);
    flintStore.filterOrders({ customerId: 'cust-123' });
    const filter = flintStore.orderFilter();
    expect(filter).toEqual({ customerId: 'cust-123' });
  });

  it('clearOrderFilter resets the filter', () => {
    flintStore.filterOrders({ orderId: 'ord-1' });
    expect(flintStore.orderFilter()).toBeTruthy();
    flintStore.clearOrderFilter();
    expect(flintStore.orderFilter()).toBe(null);
  });

  it('triggerSync increments sync counter', () => {
    const before = flintStore.syncTrigger();
    flintStore.triggerSync();
    expect(flintStore.syncTrigger()).toBe(before + 1);
  });

  it('triggerOrderRefresh increments refresh counter', () => {
    const before = flintStore.refreshOrders();
    flintStore.triggerOrderRefresh();
    expect(flintStore.refreshOrders()).toBe(before + 1);
  });
});

// ── Scenario 2: Catalog cleanup (TWM-155-2) ──────────────────────────────────

describe('Scenario: Catalog cleanup', () => {
  beforeEach(() => {
    flintStore.clearSelectedProduct();
  });

  it('openProduct sets selectedProductId for ProductsTile consumption', () => {
    expect(flintStore.selectedProductId()).toBe(null);
    flintStore.openProduct('prod-42');
    expect(flintStore.selectedProductId()).toBe('prod-42');
  });

  it('clearSelectedProduct resets the product selection', () => {
    flintStore.openProduct('prod-42');
    flintStore.clearSelectedProduct();
    expect(flintStore.selectedProductId()).toBe(null);
  });

  it('filterInventory sets inventory filter for InventoryTile', () => {
    flintStore.filterInventory({ lowStockOnly: true });
    const filter = flintStore.inventoryFilter();
    expect(filter).toEqual({ lowStockOnly: true });
  });
});

// ── Scenario 3: Customer lookup (TWM-155-3) ──────────────────────────────────

describe('Scenario: Customer lookup', () => {
  beforeEach(() => {
    flintStore.clearSelectedCustomer();
    flintStore.clearOrderFilter();
  });

  it('openCustomer sets selectedCustomerId for CustomersTile', () => {
    flintStore.openCustomer('cust-99');
    expect(flintStore.selectedCustomerId()).toBe('cust-99');
  });

  it('customer -> orders flow: openCustomer then filterOrders', () => {
    flintStore.openCustomer('cust-99');
    expect(flintStore.selectedCustomerId()).toBe('cust-99');
    flintStore.clearSelectedCustomer();

    // Then filter orders by that customer
    flintStore.filterOrders({ customerId: 'cust-99' });
    expect(flintStore.orderFilter()).toEqual({ customerId: 'cust-99' });
  });

  it('clearSelectedCustomer resets the selection', () => {
    flintStore.openCustomer('cust-99');
    flintStore.clearSelectedCustomer();
    expect(flintStore.selectedCustomerId()).toBe(null);
  });
});

// ── Scenario 4: Fulfillment flow (TWM-155-4) ─────────────────────────────────

describe('Scenario: Fulfillment flow', () => {
  beforeEach(() => {
    flintStore.clearShipmentPrefill();
    flintStore.clearOrderFilter();
  });

  it('prefillShipment sets shipment prefill data for ShipmentsTile', () => {
    flintStore.prefillShipment({ orderId: 'ord-123' });
    expect(flintStore.shipmentPrefill()).toEqual({ orderId: 'ord-123' });
  });

  it('clearShipmentPrefill resets the prefill', () => {
    flintStore.prefillShipment({ orderId: 'ord-123' });
    flintStore.clearShipmentPrefill();
    expect(flintStore.shipmentPrefill()).toBe(null);
  });

  it('full fulfillment flow: filter order -> prefill shipment -> trigger refresh', () => {
    // Operator opens order
    flintStore.filterOrders({ orderId: 'ord-200' });
    expect(flintStore.orderFilter()).toEqual({ orderId: 'ord-200' });
    flintStore.clearOrderFilter();

    // Operator creates shipment from order
    flintStore.prefillShipment({ orderId: 'ord-200' });
    expect(flintStore.shipmentPrefill()).toEqual({ orderId: 'ord-200' });
    flintStore.clearShipmentPrefill();

    // After shipment created, refresh orders
    const before = flintStore.refreshOrders();
    flintStore.triggerOrderRefresh();
    expect(flintStore.refreshOrders()).toBe(before + 1);
  });
});

// ── Scenario 5: Layout migration safety (TWM-155-5) ──────────────────────────

describe('Scenario: Layout migration safety — utility edge cases', () => {
  it('formatCurrency handles NaN gracefully', () => {
    expect(formatCurrency(NaN)).toBe('—');
  });

  it('formatCurrency handles undefined amount', () => {
    expect(formatCurrency(undefined as unknown as number)).toBe('—');
  });

  it('formatCurrency handles null amount', () => {
    expect(formatCurrency(null as unknown as number)).toBe('—');
  });

  it('formatCurrency handles zero correctly', () => {
    const result = formatCurrency(0, 'USD');
    expect(result).toContain('0.00');
  });

  it('formatCurrency defaults to USD when empty string passed', () => {
    const result = formatCurrency(10.5, '');
    expect(result).toContain('10.50');
  });

  it('nextActions returns terminal behavior expected by backend rules', () => {
    expect(nextActions('delivered').length).toBe(1);
    expect(nextActions('cancelled').length).toBe(0);
    expect(nextActions('refunded').length).toBe(0);
    expect(nextActions('hidden').length).toBe(0);
  });

  it('nextActions returns forward transitions for active statuses', () => {
    const pending = nextActions('pending');
    expect(pending.length).toBe(2);
    expect(pending.map(a => a.targetStatus)).toContain('confirmed');
    expect(pending.map(a => a.targetStatus)).toContain('cancelled');
  });

  it('stockClass returns correct categories', () => {
    expect(stockClass(0)).toBe('zero');
    expect(stockClass(3)).toBe('low');
    expect(stockClass(100)).toBe('ok');
  });

  it('fmtDate formats a valid ISO date', () => {
    const result = fmtDate('2025-01-15T12:00:00Z');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  it('timeAgo returns a string ending in "ago"', () => {
    const result = timeAgo(new Date().toISOString());
    expect(result).toMatch(/ago$/);
  });
});
