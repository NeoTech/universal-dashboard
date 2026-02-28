import { createSignal } from 'solid-js';
import { StripeApiError } from '../data/stripe';

interface UseStripeActionOptions {
  onSuccess?: () => void;
}

export interface StripeActionHandle<TArgs extends unknown[]> {
  execute: (...args: TArgs) => Promise<void>;
  loading: () => boolean;
  error: () => string | null;
  reset: () => void;
}

export function useStripeAction<TArgs extends unknown[]>(
  fn: (...args: TArgs) => Promise<unknown>,
  options?: UseStripeActionOptions,
): StripeActionHandle<TArgs> {
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  async function execute(...args: TArgs): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      await fn(...args);
      options?.onSuccess?.();
    } catch (e) {
      if (e instanceof StripeApiError) {
        setError(`${e.message} (${e.status})`);
      } else {
        setError(e instanceof Error ? e.message : 'Unknown error');
      }
    } finally {
      setLoading(false);
    }
  }

  return { execute, loading, error, reset: () => { setError(null); } };
}
