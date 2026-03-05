import type { JSX } from 'solid-js';
import { onMount } from 'solid-js';
import { Skeleton } from '../ui/Skeleton';
import { useTileConfig } from './TileConfigContext';
import { TILE_SSE_CHANNEL } from './TileConfig';
import { API_BASE_URL } from '../data/api';

const MOUNT_REFRESH_DEDUPE_MS = 2500;
const lastRefreshByChannel = new Map<string, number>();

interface BaseWsTileProps {
  loading?: boolean;
  error?: string | null;
  skeletonLines?: number;
  class?: string;
  style?: JSX.CSSProperties;
  autoRefreshOnMount?: boolean;
  children: JSX.Element;
}

export function BaseWsTile(props: BaseWsTileProps): JSX.Element {
  const tileConfig = useTileConfig();

  onMount(() => {
    if (props.autoRefreshOnMount === false) return;
    if (!tileConfig) return;
    if (tileConfig.type === 'websocket') return;

    const channel = TILE_SSE_CHANNEL[tileConfig.type] ?? tileConfig.type;
    if (channel.startsWith('flint-')) return;
    const now = Date.now();
    const last = lastRefreshByChannel.get(channel) ?? 0;
    if (now - last < MOUNT_REFRESH_DEDUPE_MS) return;
    lastRefreshByChannel.set(channel, now);

    void fetch(`${API_BASE_URL}/api/refresh/${channel}`, { method: 'POST' });
  });

  return (
    <div class={props.class ?? 'stripe-tile'} style={props.style}>
      {props.loading ? (
        <Skeleton lines={props.skeletonLines ?? 5} />
      ) : props.error ? (
        <p class="tile-error">{props.error}</p>
      ) : (
        props.children
      )}
    </div>
  );
}
