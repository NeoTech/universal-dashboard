import { For } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { BaseTile } from '../BaseTile';

interface Exchange {
  id: string;
  name: string;
  trust_score: number;
  trust_score_rank: number;
  trade_volume_24h_btc: number;
  country: string;
  year_established: number;
}

interface Props {
  refreshInterval?: number;
}

export function CryptoExchangesTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ exchanges: Exchange[] }>(
    'coingecko-exchanges',
    { exchanges: [] },
  );

  const sorted = () =>
    [...store().exchanges].sort((a, b) => (a.trust_score_rank ?? 999) - (b.trust_score_rank ?? 999));

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile crypto-exchanges-tile" skeletonLines={8}>
      <table class="tile-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Exchange</th>
              <th>Country</th>
              <th>Trust</th>
              <th>Vol 24h (BTC)</th>
            </tr>
          </thead>
          <tbody>
            <For each={sorted()}>
              {(ex) => (
                <tr>
                  <td>{ex.trust_score_rank}</td>
                  <td>{ex.name}</td>
                  <td>{ex.country ?? '—'}</td>
                  <td>{ex.trust_score ?? '—'}</td>
                  <td>{(ex.trade_volume_24h_btc ?? 0).toFixed(2)} BTC</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
    </BaseTile>
  );
}
