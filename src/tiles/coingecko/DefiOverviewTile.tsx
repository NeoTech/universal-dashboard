import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { BaseTile } from '../BaseTile';

interface DefiData {
  defi_market_cap?: string;
  eth_market_cap?: string;
  defi_to_eth_ratio?: string;
  trading_volume_24h?: string;
  defi_dominance?: string;
  top_coin_name?: string;
  top_coin_defi_dominance?: string;
}

interface Props {
  refreshInterval?: number;
}

function fmtUsd(raw?: string): string {
  if (!raw) return '—';
  const n = parseFloat(raw);
  if (isNaN(n)) return raw;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

function fmtPct(raw?: string): string {
  if (!raw) return '—';
  const n = parseFloat(raw);
  if (isNaN(n)) return raw;
  return `${n.toFixed(2)}%`;
}

interface KpiProps {
  label: string;
  value: string;
}

function Kpi(props: KpiProps): JSX.Element {
  return (
    <div style={{
      background: 'var(--tile-bg-secondary, rgba(255,255,255,0.05))',
      'border-radius': '6px',
      padding: '8px 10px',
    }}>
      <div style={{ 'font-size': '0.7em', opacity: 0.65, 'margin-bottom': '2px' }}>{props.label}</div>
      <div style={{ 'font-weight': 600 }}>{props.value}</div>
    </div>
  );
}

export function DefiOverviewTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ defi: DefiData }>(
    'coingecko-defi-overview',
    { defi: {} },
  );

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile defi-overview-tile" skeletonLines={4}>
      <div style={{ display: 'grid', 'grid-template-columns': '1fr 1fr', gap: '8px' }}>
          <Kpi label="DeFi Market Cap" value={fmtUsd(store().defi.defi_market_cap)} />
          <Kpi label="ETH Market Cap" value={fmtUsd(store().defi.eth_market_cap)} />
          <Kpi label="DeFi Dominance" value={fmtPct(store().defi.defi_dominance)} />
          <Kpi label="Trading Vol 24h" value={fmtUsd(store().defi.trading_volume_24h)} />
          <Kpi label="Top Coin" value={store().defi.top_coin_name ?? '—'} />
          <Kpi label="DeFi/ETH Ratio" value={fmtPct(store().defi.defi_to_eth_ratio)} />
        </div>
    </BaseTile>
  );
}
