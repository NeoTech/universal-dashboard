import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { BaseTile } from '../BaseTile';
import type { NpmPackageDownloads } from '../../data/npm';

interface Props { refreshInterval?: number; }

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function DownloadsTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ packages: NpmPackageDownloads[] }>('npm-downloads', { packages: [] });

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile npm-downloads-tile">
      <table class="tile-table">
          <thead>
            <tr>
              <th>Package</th>
              <th>Downloads</th>
              <th>Period</th>
            </tr>
          </thead>
          <tbody>
            <Show when={store().packages.length === 0}>
              <tr><td colspan="3" class="cell-empty">No packages configured</td></tr>
            </Show>
            <For each={store().packages}>
              {(pkg) => (
                <tr
                  style={{ cursor: 'pointer' }}
                  onClick={() => window.open(`https://www.npmjs.com/package/${pkg.package}`, '_blank')}
                >
                  <td>{pkg.package}</td>
                  <td>{formatNumber(pkg.downloads)}</td>
                  <td>{pkg.period}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
    </BaseTile>
  );
}
