import { For, Show, createSignal } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import { BaseTile } from '../BaseTile';

interface CompanyProfile {
  country: string;
  currency: string;
  exchange: string;
  finnhubIndustry: string;
  ipo: string;
  logo: string;
  marketCapitalization: number;
  name: string;
  shareOutstanding: number;
  ticker: string;
  weburl: string;
}

interface Props { refreshInterval?: number; }

function fmtMarketCap(v: number): string {
  if (v > 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
  if (v > 1e6) return '$' + (v / 1e6).toFixed(2) + 'M';
  return '$' + v.toFixed(2);
}

interface DetailProps { profile: CompanyProfile; }

function ProfileDetail(props: DetailProps): JSX.Element {
  const p = props.profile;
  const kvRows: [string, JSX.Element][] = [
    ['Country',    <span>{p.country ?? '—'}</span>],
    ['Exchange',   <span>{p.exchange ?? '—'}</span>],
    ['Industry',   <span>{p.finnhubIndustry ?? '—'}</span>],
    ['IPO Date',   <span>{p.ipo ?? '—'}</span>],
    ['Market Cap', <span>{p.marketCapitalization ? fmtMarketCap(p.marketCapitalization) : '—'}</span>],
    ['Currency',   <span>{p.currency ?? '—'}</span>],
    ['Website',    p.weburl
      ? <a href={p.weburl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent, #3b82f6)', 'text-decoration': 'none', 'font-size': '0.82rem' }}>{p.weburl.replace(/^https?:\/\//, '')}</a>
      : <span>—</span>],
  ];
  return (
    <div style={{ display: 'flex', 'flex-direction': 'column', gap: '10px', flex: 1 }}>
      <div style={{ display: 'flex', 'align-items': 'center', gap: '10px' }}>
        <Show when={!!p.logo}>
          <img
            src={p.logo}
            width="32"
            height="32"
            style={{ 'object-fit': 'contain', 'border-radius': '4px', background: 'var(--color-surface)' }}
            alt={p.ticker}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        </Show>
        <span style={{ 'font-weight': '700', 'font-size': '1rem' }}>{p.name}</span>
        <Badge variant="neutral">{p.ticker}</Badge>
      </div>
      <div style={{ display: 'grid', 'grid-template-columns': '120px 1fr', gap: '6px 12px', 'font-size': '0.83rem' }}>
        <For each={kvRows}>
          {([label, value]) => (
            <>
              <span style={{ color: 'var(--color-text-muted)', 'font-weight': '500' }}>{label}</span>
              <span>{value}</span>
            </>
          )}
        </For>
      </div>
    </div>
  );
}

export function CompanyProfileTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ profiles: CompanyProfile[] }>('finnhub-company-profile', { profiles: [] });
  const [selectedIdx, setSelectedIdx] = createSignal(0);

  const selected = () => store().profiles[selectedIdx()] ?? null;

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile company-profile-tile" skeletonLines={6}>
      <div style={{ display: 'flex', 'flex-direction': 'column', height: '100%' }}>
        <Show when={store().profiles.length > 1}>
            <select
              value={selectedIdx()}
              onChange={(e) => setSelectedIdx(parseInt(e.currentTarget.value, 10))}
              style={{ 'margin-bottom': '8px', padding: '4px 8px', 'font-size': '0.85rem', background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', 'border-radius': '4px' }}
            >
              <For each={store().profiles}>
                {(p, i) => <option value={i()}>{p.ticker}</option>}
              </For>
            </select>
          </Show>
          <Show when={selected() !== null} fallback={<div class="cell-empty">No company profile data</div>}>
            <ProfileDetail profile={selected()!} />
          </Show>
        </div>
    </BaseTile>
  );
}
