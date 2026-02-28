import { fetchResource } from './api';

export interface SlackMessage {
  type: string;
  text: string;
  user?: string;
  username?: string;
  ts: string;
  channel: string;
  channelName?: string;
}

export interface SlackChannel {
  id: string;
  name: string;
  is_channel: boolean;
  num_members: number;
  topic?: { value: string };
  purpose?: { value: string };
}

export function fetchSlackMessages(): Promise<{ messages: SlackMessage[] }> {
  return fetchResource<{ messages: SlackMessage[] }>('/api/slack/messages');
}

export function fetchSlackChannels(): Promise<{ channels: SlackChannel[] }> {
  return fetchResource<{ channels: SlackChannel[] }>('/api/slack/channels');
}
