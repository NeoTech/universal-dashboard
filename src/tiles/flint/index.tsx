import type { JSX } from 'solid-js';
import type { TileConfig, TileType } from '../TileConfig';
import { FlintAuthTile }            from './FlintAuthTile';
import { FlintOverviewTile }        from './FlintOverviewTile';
import { FlintOrdersTile }          from './FlintOrdersTile';
import { FlintProductsTile }        from './FlintProductsTile';
import { FlintCategoriesTile }      from './FlintCategoriesTile';
import { FlintInventoryTile }       from './FlintInventoryTile';
import { FlintCustomersTile }       from './FlintCustomersTile';
import { FlintCustomerReportsTile } from './FlintCustomerReportsTile';
import { FlintShipmentsTile }       from './FlintShipmentsTile';
import { FlintSalesChartTile }      from './FlintSalesChartTile';
import { FlintDataHealthTile }      from './FlintDataHealthTile';
import { FlintStripeSyncTile }      from './FlintStripeSyncTile';
import { FlintWebhookMonitorTile }  from './FlintWebhookMonitorTile';
import { FlintOrderSearchTile }     from './FlintOrderSearchTile';
import { FlintOrderReceiptTile }    from './FlintOrderReceiptTile';

export type TileFactory = (tile: TileConfig) => JSX.Element;

export const FLINT_TILE_FACTORIES: Partial<Record<TileType, TileFactory>> = {
  'flint-auth':             (_t) => <FlintAuthTile />,
  'flint-overview':         (_t) => <FlintOverviewTile />,
  'flint-orders':           (t)  => <FlintOrdersTile compact={t.displayMode === 'compact'} />,
  'flint-products':         (_t) => <FlintProductsTile />,
  'flint-categories':       (_t) => <FlintCategoriesTile />,
  'flint-inventory':        (_t) => <FlintInventoryTile />,
  'flint-customers':        (_t) => <FlintCustomersTile />,
  'flint-customer-reports': (_t) => <FlintCustomerReportsTile />,
  'flint-shipments':        (_t) => <FlintShipmentsTile />,
  'flint-sales-chart':      (t)  => <FlintSalesChartTile compact={t.displayMode === 'compact'} />,
  'flint-data-health':      (_t) => <FlintDataHealthTile />,
  'flint-stripe-sync':      (_t) => <FlintStripeSyncTile />,
  'flint-webhook-monitor':  (t)  => <FlintWebhookMonitorTile maxEvents={t.displayMode === 'compact' ? 20 : 50} />,
  'flint-order-search':     (_t) => <FlintOrderSearchTile />,
  'flint-order-receipt':    (_t) => <FlintOrderReceiptTile />,
};

export {
  FlintAuthTile, FlintOverviewTile, FlintOrdersTile,
  FlintProductsTile, FlintCategoriesTile, FlintInventoryTile,
  FlintCustomersTile, FlintCustomerReportsTile,
  FlintShipmentsTile, FlintSalesChartTile, FlintDataHealthTile,
  FlintStripeSyncTile, FlintWebhookMonitorTile, FlintOrderSearchTile,
  FlintOrderReceiptTile,
};
