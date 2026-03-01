/**
 * useRedditFeed — unified data hook for all reddit tile types.
 *
 * - When `subreddits` is provided, polls `/api/reddit/posts?subreddits=...`
 *   directly via REST on a configurable interval. This allows per-tile
 *   subreddit config independent of the global REDDIT_SUBREDDITS env var.
 * - When `subreddits` is absent, falls back to the shared SSE `reddit-posts`
 *   channel (driven by the server's global poller).
 */
import { createSignal, onMount, onCleanup } from 'solid-js';
import type { Accessor } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { API_BASE_URL } from '../../data/api';
import type { RedditPost } from '../../data/reddit';

const DEFAULT_INTERVAL_MS = 300_000; // 5 minutes

interface RedditFeedResult {
  data: Accessor<{ posts: RedditPost[] }>;
  loading: Accessor<boolean>;
  error: Accessor<string | null>;
}

/** REST-based polling path used when tile has its own subreddits. */
function useRedditRestFeed(subreddits: string, refreshInterval: number): RedditFeedResult {
  const [data, setData] = createSignal<{ posts: RedditPost[] }>({ posts: [] });
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  async function load(): Promise<void> {
    try {
      setError(null);
      const params = new URLSearchParams({ subreddits });
      const jwt = typeof localStorage !== 'undefined' ? localStorage.getItem('twm-jwt') : null;
      const res = await fetch(`${API_BASE_URL}/api/reddit/posts?${params.toString()}`, {
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { posts: RedditPost[] };
      setData(() => json);
      setLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
    }
  }

  onMount(() => {
    void load();
    const id = setInterval(() => void load(), refreshInterval);
    onCleanup(() => clearInterval(id));
  });

  return { data, loading, error };
}

/** Shared hook — auto-selects RSS vs SSE based on whether subreddits configured. */
export function useRedditFeed(subreddits: string | undefined, refreshInterval?: number): RedditFeedResult {
  const interval = refreshInterval ?? DEFAULT_INTERVAL_MS;

  if (subreddits && subreddits.trim().length > 0) {
    // Per-tile REST path
    return useRedditRestFeed(subreddits.trim(), interval);
  }

  // Global SSE fallback
  return useSseChannel<{ posts: RedditPost[] }>('reddit-posts', { posts: [] });
}
