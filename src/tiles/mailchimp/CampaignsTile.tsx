import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import { BaseTile } from '../BaseTile';
import type { MailchimpCampaign, MailchimpCampaignStatus } from '../../data/mailchimp';
import { usePagination, PaginationBar } from '../usePagination';

interface Props { refreshInterval?: number; }

function statusBadge(status: MailchimpCampaignStatus): BadgeVariant {
  if (status === 'sent') return 'success';
  if (status === 'sending') return 'warning';
  if (status === 'paused') return 'neutral';
  if (status === 'schedule') return 'warning';
  return 'neutral';
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function timeAgo(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function CampaignsTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ campaigns: MailchimpCampaign[] }>('mailchimp-campaigns', { campaigns: [] });
  const { page, setPage, totalPages, pageItems } = usePagination(() => store().campaigns, 10);

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile mailchimp-campaigns-tile">
      <>
        <table class="tile-table">
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Status</th>
              <th>Emails</th>
              <th>Open Rate</th>
              <th>Click Rate</th>
              <th>Sent</th>
            </tr>
          </thead>
          <tbody>
            <Show when={store().campaigns.length === 0}>
              <tr><td colspan="6" class="cell-empty">No campaigns</td></tr>
            </Show>
            <For each={pageItems()}>
              {(campaign) => (
                <tr>
                  <td title={campaign.settings.subject_line}>{campaign.settings.title || campaign.settings.subject_line}</td>
                  <td><Badge variant={statusBadge(campaign.status)}>{campaign.status}</Badge></td>
                  <td>{campaign.emails_sent.toLocaleString()}</td>
                  <td>{campaign.report_summary ? pct(campaign.report_summary.open_rate) : '—'}</td>
                  <td>{campaign.report_summary ? pct(campaign.report_summary.click_rate) : '—'}</td>
                  <td>{campaign.send_time ? timeAgo(campaign.send_time) : '—'}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
        <PaginationBar page={page} setPage={setPage} totalPages={totalPages} />
      </>
    </BaseTile>
  );
}
