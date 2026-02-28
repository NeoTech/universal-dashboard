import { fetchResource } from './api';

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  approximate_member_count?: number;
  approximate_presence_count?: number;
  description?: string | null;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  guild_id?: string;
  position?: number;
  topic?: string | null;
  member_count?: number;
}

export function fetchDiscordServerStats(): Promise<{ guilds: DiscordGuild[] }> {
  return fetchResource<{ guilds: DiscordGuild[] }>('/api/discord/server-stats');
}
