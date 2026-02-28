import { fetchResource } from './api';

export interface ProductHuntPost {
  id: string;
  name: string;
  tagline: string;
  description?: string;
  votesCount: number;
  commentsCount: number;
  createdAt: string;
  featuredAt?: string;
  url: string;
  website?: string;
  thumbnail?: { url: string };
  topics?: { edges: Array<{ node: { name: string } }> };
  user?: { name: string; username: string };
}

export function fetchProductHuntLaunches(): Promise<{ posts: ProductHuntPost[] }> {
  return fetchResource<{ posts: ProductHuntPost[] }>('/api/producthunt/top-launches');
}
