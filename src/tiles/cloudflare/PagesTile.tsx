import { createSignal, For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import type { CFPagesProject, CFPagesDeployment } from '../../data/cloudflare';
import { fetchCFPageDeployments } from '../../data/cloudflare';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import { Skeleton } from '../../ui/Skeleton';
import { StripeDrawer } from '../../ui/StripeDrawer';
import { useSseChannel } from '../../ui/useSseChannel';
import { BaseTile } from '../BaseTile';

interface Props { refreshInterval?: number; }

function deploymentBadge(d: CFPagesDeployment | null): { label: string; variant: BadgeVariant } {
  if (!d) return { label: 'None', variant: 'neutral' };
  const s = d.latest_stage?.status;
  if (s === 'success') return { label: 'Deployed',  variant: 'success' };
  if (s === 'failure') return { label: 'Failed',    variant: 'danger'  };
  if (s === 'active')  return { label: 'Building',  variant: 'warning' };
  if (s === 'canceled') return { label: 'Cancelled', variant: 'neutral' };
  return { label: s ?? 'Unknown', variant: 'neutral' };
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function shortMsg(msg: string | null | undefined): string {
  if (!msg) return '—';
  return msg.length > 48 ? msg.slice(0, 45) + '…' : msg;
}

export function PagesTile(_props: Props): JSX.Element {
  const { data: projects, loading, error } = useSseChannel<CFPagesProject[]>('cf-pages', []);
  const [selected, setSelected] = createSignal<CFPagesProject | null>(null);
  const [deployments, setDeployments] = createSignal<CFPagesDeployment[]>([]);
  const [drawerLoading, setDrawerLoading] = createSignal(false);

  async function openProject(p: CFPagesProject) {
    setSelected(p); setDeployments([]); setDrawerLoading(true);
    try { setDeployments(await fetchCFPageDeployments(p.name)); }
    finally { setDrawerLoading(false); }
  }

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile cloudflare-tile" skeletonLines={4}>
      <>
        <table class="tile-table tile-table--clickable">
          <thead><tr><th>Project</th><th>Env</th><th>Status</th><th>Deployed</th></tr></thead>
          <tbody>
            <Show when={projects().length === 0}>
              <tr><td colspan="4" class="cell-empty">No Pages projects found</td></tr>
            </Show>
            <For each={projects()}>
              {(p) => {
                const badge = deploymentBadge(p.latest_deployment);
                const d = p.latest_deployment;
                return (
                  <tr onClick={() => void openProject(p)}>
                    <td class="cell-truncate">{p.name}</td>
                    <td>{d?.environment ?? '—'}</td>
                    <td><Badge variant={badge.variant}>{badge.label}</Badge></td>
                    <td>{d ? fmtDate(d.created_on) : '—'}</td>
                  </tr>
                );
              }}
            </For>
          </tbody>
        </table>
        <StripeDrawer
        isOpen={selected() !== null || drawerLoading()}
        title={selected()?.name ?? 'Loading…'}
        onClose={() => { setSelected(null); setDeployments([]); }}
      >
        <Show when={drawerLoading()}><Skeleton lines={5} /></Show>
        <Show when={selected() && !drawerLoading()}>
          <div class="drawer-section">
            <h3 class="drawer-section__title">Recent Deployments</h3>
            <Show when={deployments().length === 0}>
              <p class="tile-muted">No deployments found.</p>
            </Show>
            <For each={deployments().slice(0, 8)}>
              {(dep) => {
                const badge = deploymentBadge(dep);
                const meta = dep.deployment_trigger?.metadata;
                return (
                  <div class="drawer-row">
                    <div class="drawer-row__main">
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                      <span class="drawer-row__label">{dep.environment}</span>
                      <span class="cell-truncate">{shortMsg(meta?.commit_message)}</span>
                    </div>
                    <div class="drawer-row__meta">
                      <span>{meta?.branch ?? '—'}</span>
                      <span>{fmtDate(dep.created_on)}</span>
                      <a href={dep.url} target="_blank" rel="noopener" class="drawer-link">Open ↗</a>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>
      </StripeDrawer>
      </>
    </BaseTile>
  );
}
