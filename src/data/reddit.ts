import { fetchResource } from './api';

export interface RedditPost {
  id: string;
  title: string;
  author: string;
  subreddit: string;
  score: number;
  upvote_ratio: number;
  num_comments: number;
  created_utc: number;
  url: string;
  permalink: string;
  is_self: boolean;
  thumbnail: string | null;
  selftext?: string;
  flair_text?: string | null;
}

export function fetchRedditPosts(): Promise<{ posts: RedditPost[] }> {
  return fetchResource<{ posts: RedditPost[] }>('/api/reddit/posts');
}
