import type { JSX } from 'solid-js';
import type { TileConfig, TileType } from '../TileConfig';
import { PaymentsTile } from './PaymentsTile';
import { OrdersTile } from './OrdersTile';
import { ProductsTile } from './ProductsTile';
import { SubscriptionsTile } from './SubscriptionsTile';
import { CustomersTile } from './CustomersTile';
import { WebhooksTile } from './WebhooksTile';
import { RevenueTile } from './RevenueTile';
import { InvoicesTile } from './InvoicesTile';
import { RefundsTile } from './RefundsTile';

export type TileFactory = (tile: TileConfig) => JSX.Element;

export const STRIPE_TILE_FACTORIES: Partial<Record<TileType, TileFactory>> = {
  'stripe-payments':      (t) => <PaymentsTile refreshInterval={t.refreshInterval} />,
  'stripe-orders':        (t) => <OrdersTile refreshInterval={t.refreshInterval} />,
  'stripe-products':      (t) => <ProductsTile refreshInterval={t.refreshInterval} />,
  'stripe-subscriptions': (t) => <SubscriptionsTile refreshInterval={t.refreshInterval} />,
  'stripe-customers':     (t) => <CustomersTile refreshInterval={t.refreshInterval} />,
  'stripe-webhooks':      (t) => <WebhooksTile refreshInterval={t.refreshInterval} />,
  'stripe-revenue':       (t) => <RevenueTile refreshInterval={t.refreshInterval} />,
  'stripe-invoices':      (t) => <InvoicesTile refreshInterval={t.refreshInterval} />,
  'stripe-refunds':       (t) => <RefundsTile refreshInterval={t.refreshInterval} />,
};

export {
  PaymentsTile,
  OrdersTile,
  ProductsTile,
  SubscriptionsTile,
  CustomersTile,
  WebhooksTile,
  RevenueTile,
  InvoicesTile,
  RefundsTile,
};
