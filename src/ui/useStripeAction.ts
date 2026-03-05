import { createSignal } from 'solid-js';
import { StripeApiError } from '../data/stripe';

/** Options for {@link useStripeAction}. */
interface UseStripeActionOptions {
  /** Called after a successful execution of the wrapped async function. */
  onSuccess?: () => void;
}

/**
 * Handle returned by {@link useStripeAction}, providing reactive loading/error
 * state alongside the async executor.
 *
 * @typeParam TArgs - Tuple of argument types accepted by `execute`.
 */
export interface StripeActionHandle<TArgs extends unknown[]> {
  /**
   * Invoke the wrapped async function with the given arguments.
   * Updates `loading` and `error` reactively.
   */
  execute: (...args: TArgs) => Promise<void>;
  /** Reactive accessor that is `true` while the async call is in flight. */
  loading: () => boolean;
  /** Reactive accessor returning the last error message, or `null` on success. */
  error: () => string | null;
  /** Clear the current error without re-executing the action. */
  reset: () => void;
}

/**
 * Wraps an async Stripe API function with reactive `loading` and `error` state.
 *
 * `StripeApiError` instances are formatted with their HTTP status code.
 * All other errors fall back to `error.message` or `'Unknown error'`.
 *
 * @example
 * ```ts
 * const action = useStripeAction((id: string) => refundCharge(id), {
 *   onSuccess: () => refetch(),
 * });
 * // In JSX:
 * // <button disabled={action.loading()} onClick={() => action.execute(chargeId)}>
 * //   Refund
 * // </button>
 * // <Show when={action.error()}><p class="error">{action.error()}</p></Show>
 * ```
 *
 * @typeParam TArgs - Tuple of argument types forwarded to `fn`.
 * @param fn - Async function to execute; should return a `Promise`.
 * @param options - Optional success callback.
 * @returns A {@link StripeActionHandle} with reactive state and an executor.
 */
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
