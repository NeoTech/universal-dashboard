import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { BaseTile } from '../BaseTile';
import type { JsDelivrPackageStats } from '../../data/jsdelivr';

interface Props { refreshInterval?: number; }

function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function StatsTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ packages: JsDelivrPackageStats[] }>('jsdelivr-hits', { packages: [] });

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile jsdelivr-stats-tile">
      <table class="tile-table">
          <thead>
            <tr>
              <th>Package</th>
              <th>Type</th>
              <th>Total Hits</th>
              <th>Bandwidth</th>
            </tr>
          </thead>
          <tbody>
            <Show when={store().packages.length === 0}>
              <tr><td colspan="4" class="cell-empty">No packages configured</td></tr>
            </Show>
            <For each={store().packages}>
              {(pkg) => (
                <tr
                  style={{ cursor: 'pointer' }}
                  onClick={() => window.open(`https://www.jsdelivr.com/package/${pkg.type}/${pkg.name}`, '_blank')}
                >
                  <td>{pkg.name}</td>
                  <td>{pkg.type.toUpperCase()}</td>
                  <td>{formatNumber(pkg.hits.total)}</td>
                  <td>{formatBytes(pkg.bandwidth.total)}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
    </BaseTile>
  );
}
