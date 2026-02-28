import type { JSX } from 'solid-js';
import type { TileConfig, TileType } from '../TileConfig';
import { CampaignsTile } from './CampaignsTile';

export type TileFactory = (tile: TileConfig) => JSX.Element;

export const MAILCHIMP_TILE_FACTORIES: Partial<Record<TileType, TileFactory>> = {
  'mailchimp-campaigns': (t) => <CampaignsTile refreshInterval={t.refreshInterval} />,
};

export { CampaignsTile };
