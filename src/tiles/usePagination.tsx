import { createSignal } from 'solid-js';
import type { JSX } from 'solid-js';
import { useTileConfig } from './TileConfigContext';

/** Default rows per page used by all list tiles. */
export const PAGE_SIZE = 10;

/**
 * Lightweight client-side pagination hook.
 *
 * Automatically reads `pageSize` and `fetchLimit` from TileConfigContext so
 * the user's per-tile settings take effect without any prop drilling.
 *
 * @param items     Reactive accessor returning the full server-fetched array.
 * @param pageSize  Fallback rows-per-page when TileConfig.pageSize is not set
 *                  (default: PAGE_SIZE = 10).
 */
export function usePagination<T>(items: () => T[], pageSize = PAGE_SIZE) {
  const tileConfig = useTileConfig();

  /** Active rows-per-page: tile config wins, then explicit arg, then default. */
  const effectivePageSize = () => tileConfig?.pageSize ?? pageSize;

  /**
   * If the user set a fetchLimit, cap the total available items to that number
   * before paginating. Otherwise use all items the server returned.
   */
  const visibleItems = () => {
    const all = items();
    const limit = tileConfig?.fetchLimit;
    return (limit != null && limit > 0) ? all.slice(0, limit) : all;
  };

  const [page, setPage] = createSignal(0);

  const totalPages = () => Math.max(1, Math.ceil(visibleItems().length / effectivePageSize()));
  const safePage   = () => Math.min(page(), totalPages() - 1);

  const pageItems = () => {
    const p   = safePage();
    const ps  = effectivePageSize();
    return visibleItems().slice(p * ps, (p + 1) * ps);
  };

  return {
    page: safePage,
    setPage,
    totalPages,
    pageItems,
  };
}

interface PaginationBarProps {
  page: () => number;
  setPage: (p: number) => void;
  totalPages: () => number;
}

/** Compact prev / page-count / next bar. Renders nothing when total pages ≤ 1. */
export function PaginationBar(props: PaginationBarProps): JSX.Element {
  return (
    <div class="tile-pagination" aria-label="Pagination">
      <button
        class="tile-pagination__btn"
        disabled={props.page() === 0}
        onClick={() => props.setPage(Math.max(0, props.page() - 1))}
        aria-label="Previous page"
      >
        ‹
      </button>
      <span class="tile-pagination__info">
        {props.page() + 1} / {props.totalPages()}
      </span>
      <button
        class="tile-pagination__btn"
        disabled={props.page() >= props.totalPages() - 1}
        onClick={() => props.setPage(Math.min(props.totalPages() - 1, props.page() + 1))}
        aria-label="Next page"
      >
        ›
      </button>
    </div>
  );
}
