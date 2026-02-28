import type { JSX } from 'solid-js';
import { formatAmount } from '../../data/stripe';
import type { StripeRevenuePoint } from '../../data/stripe';
import { useSseChannel } from '../../ui/useSseChannel';
import { Sparkline } from '../../ui/Sparkline';
import { BaseTile } from '../BaseTile';

interface Props {
  refreshInterval?: number;
}

export function RevenueTile(_props: Props): JSX.Element {
  const { data: points, loading, error } = useSseChannel<StripeRevenuePoint[]>('stripe-revenue', []);

  const total = () => points().reduce((sum, p) => sum + p.amount, 0);
  const values = () => points().map((p) => p.amount);

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile revenue-tile" skeletonLines={2}>
      <div class="revenue-body">
        <div class="revenue-total">
          <span class="revenue-total__label">30-day revenue</span>
          <span class="revenue-total__value">{formatAmount(total())}</span>
        </div>
        {values().length > 1 && (
          <Sparkline data={values()} w={300} h={48} />
        )}
        {points().length > 0 && (
          <div class="revenue-range">
            <span>{points()[0].date}</span>
            <span>→</span>
            <span>{points()[points().length - 1].date}</span>
          </div>
        )}
      </div>
    </BaseTile>
  );
}
