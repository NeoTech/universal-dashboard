import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import type { CFWorkerScript } from '../../data/cloudflare';
import { Badge } from '../../ui/Badge';
import { useSseChannel } from '../../ui/useSseChannel';
import { BaseTile } from '../BaseTile';

interface Props { refreshInterval?: number; }

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function FunctionsTile(_props: Props): JSX.Element {
  const { data: workers, loading, error } = useSseChannel<CFWorkerScript[]>('cf-workers', []);

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile cloudflare-tile" skeletonLines={4}>
      <table class="tile-table">
          <thead>
            <tr><th>Worker</th><th>Model</th><th>Handlers</th><th>Modified</th></tr>
          </thead>
          <tbody>
            <Show when={workers().length === 0}>
              <tr><td colspan="4" class="cell-empty">No Workers scripts found</td></tr>
            </Show>
            <For each={workers()}>
              {(w) => (
                <tr
                  class="tr--link"
                  title="Open in Cloudflare dashboard"
                  onClick={() => window.open(
                    `https://dash.cloudflare.com/?to=/:account/workers/services/view/${w.id}/production`,
                    '_blank', 'noopener',
                  )}
                >
                  <td class="cell-truncate">{w.id}</td>
                  <td>
                    <Badge variant={w.usage_model === 'unbound' ? 'warning' : 'neutral'}>
                      {w.usage_model}
                    </Badge>
                  </td>
                  <td>{(w.handlers ?? []).join(', ') || '—'}</td>
                  <td>{fmtDate(w.modified_on)}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
    </BaseTile>
  );
}
