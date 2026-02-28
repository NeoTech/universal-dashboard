import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import { BaseTile } from '../BaseTile';
import type { ShodanSearchResult } from '../../data/shodan';

interface Props { refreshInterval?: number; }

export function SearchTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ results: ShodanSearchResult }>('shodan-search', { results: { matches: [], total: 0 } });

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile shodan-search-tile">
      <>
          {store().results.total > 0 && (
            <p class="tile-summary">{store().results.total.toLocaleString()} total results</p>
          )}
          <table class="tile-table">
            <thead>
              <tr>
                <th>IP</th>
                <th>Org</th>
                <th>Country</th>
                <th>Ports</th>
                <th>Vulns</th>
              </tr>
            </thead>
            <tbody>
              <Show when={store().results.matches.length === 0}>
                <tr><td colspan="5" class="cell-empty">No results</td></tr>
              </Show>
              <For each={store().results.matches.slice(0, 20)}>
                {(host) => (
                  <tr
                    style={{ cursor: 'pointer' }}
                    onClick={() => window.open(`https://www.shodan.io/host/${host.ip_str}`, '_blank')}
                  >
                    <td>{host.ip_str}</td>
                    <td title={host.org}>{host.org ? (host.org.length > 25 ? host.org.slice(0, 25) + '…' : host.org) : '—'}</td>
                    <td>{host.country_name ?? '—'}</td>
                    <td>{host.ports.slice(0, 5).join(', ')}{host.ports.length > 5 ? '…' : ''}</td>
                    <td>
                      {host.vulns && host.vulns.length > 0
                        ? <Badge variant="danger">{host.vulns.length} CVE{host.vulns.length !== 1 ? 's' : ''}</Badge>
                        : <Badge variant="success">None</Badge>}
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </>
    </BaseTile>
  );
}
