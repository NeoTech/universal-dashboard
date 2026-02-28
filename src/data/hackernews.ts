import { fetchResource } from './api';

export interface HackerNewsStory {
  id: number;
  title: string;
  url?: string;
  score: number;
  by: string;
  time: number;
  descendants: number;
  type: 'story' | 'job' | 'ask' | 'poll';
  rank?: number;
}

export function fetchHNTopStories(): Promise<{ stories: HackerNewsStory[] }> {
  return fetchResource<{ stories: HackerNewsStory[] }>('/api/hackernews/top-stories');
}
