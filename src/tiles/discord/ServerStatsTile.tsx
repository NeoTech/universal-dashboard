import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { BaseTile } from '../BaseTile';
import type { DiscordGuild } from '../../data/discord';

interface Props { refreshInterval?: number; }

function formatNumber(n?: number): string {
  if (n === undefined) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function ServerStatsTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ guilds: DiscordGuild[] }>('discord-server-stats', { guilds: [] });

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile discord-stats-tile">
      <table class="tile-table">
          <thead>
            <tr>
              <th>Server</th>
              <th>Members</th>
              <th>Online</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <Show when={store().guilds.length === 0}>
              <tr><td colspan="4" class="cell-empty">No servers</td></tr>
            </Show>
            <For each={store().guilds.slice(0, 10)}>
              {(guild) => (
                <tr>
                  <td>{guild.name}</td>
                  <td>{formatNumber(guild.approximate_member_count)}</td>
                  <td>{formatNumber(guild.approximate_presence_count)}</td>
                  <td title={guild.description ?? undefined}>{guild.description ? (guild.description.length > 40 ? guild.description.slice(0, 40) + '…' : guild.description) : '—'}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
    </BaseTile>
  );
}
