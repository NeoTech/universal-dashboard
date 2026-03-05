import { createRoot, createSignal } from 'solid-js';
import type { FlintOrder } from '../../data/flint';

// All cross-tile state lives here. Reactive signals — SolidJS components
// that read these will automatically re-render when they change.

// Use createRoot so signals persist across component mounts/unmounts.
// This is a module-level singleton — all Flint tiles share one instance.

function createFlintStore() {
  // Order filter
  const [orderFilter, setOrderFilter] = createSignal<{
    status?: string | null;
    customerId?: string | null;
    customerEmail?: string | null;
    orderId?: string | null;
  } | null>(null);

  // Selected product (opens product in ProductsTile)
  const [selectedProductId, setSelectedProductId] = createSignal<string | null>(null);

  // Selected customer (opens customer in CustomersTile)
  const [selectedCustomerId, setSelectedCustomerId] = createSignal<string | null>(null);

  // Inventory filter
  const [inventoryFilter, setInventoryFilter] = createSignal<{
    lowStockOnly?: boolean;
  } | null>(null);

  // Shipment pre-fill
  const [shipmentPrefill, setShipmentPrefill] = createSignal<{
    orderId: string;
    items?: string[];
  } | null>(null);

  // Sync trigger (increment to trigger)
  const [syncTrigger, setSyncTrigger] = createSignal(0);

  // Orders refresh trigger (increment to trigger)
  const [refreshOrders, setRefreshOrders] = createSignal(0);

  // Order receipt request (includes sequence so same order can be reopened)
  const [receiptOrderRequest, setReceiptOrderRequest] = createSignal<{
    orderId: string;
    sequence: number;
    snapshot?: FlintOrder;
  } | null>(null);
  let receiptSequence = 0;

  // Actions
  const filterOrders = (opts: {
    status?: string | null;
    customerId?: string | null;
    customerEmail?: string | null;
    orderId?: string | null;
  }) =>
    setOrderFilter(opts);
  const clearOrderFilter = () => setOrderFilter(null);

  const openProduct = (id: string) => setSelectedProductId(id);
  const clearSelectedProduct = () => setSelectedProductId(null);

  const openCustomer = (id: string) => setSelectedCustomerId(id);
  const clearSelectedCustomer = () => setSelectedCustomerId(null);

  const filterInventory = (opts: { lowStockOnly?: boolean }) => setInventoryFilter(opts);
  const clearInventoryFilter = () => setInventoryFilter(null);

  const prefillShipment = (data: { orderId: string; items?: string[] }) => setShipmentPrefill(data);
  const clearShipmentPrefill = () => setShipmentPrefill(null);

  const triggerSync = () => setSyncTrigger(v => v + 1);
  const triggerOrderRefresh = () => setRefreshOrders(v => v + 1);

  const openOrderReceipt = (orderId: string, snapshot?: FlintOrder) => {
    receiptSequence += 1;
    setReceiptOrderRequest({ orderId, sequence: receiptSequence, snapshot });
  };

  return {
    // Signals (read)
    orderFilter, selectedProductId, selectedCustomerId,
    inventoryFilter, shipmentPrefill, syncTrigger, refreshOrders,
    receiptOrderRequest,
    // Actions (write)
    filterOrders, clearOrderFilter,
    openProduct, clearSelectedProduct,
    openCustomer, clearSelectedCustomer,
    filterInventory, clearInventoryFilter,
    prefillShipment, clearShipmentPrefill,
    triggerSync, triggerOrderRefresh,
    openOrderReceipt,
  };
}

// Module-level singleton — survives component mount/unmount cycles
let _store: ReturnType<typeof createFlintStore> | undefined;
export const flintStore = (() => {
  if (!_store) {
    createRoot(() => { _store = createFlintStore(); });
  }
  return _store!;
})();
