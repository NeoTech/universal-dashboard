import type { JSX } from 'solid-js';
import type { TileConfig, TileType } from '../TileConfig';
import { AccountsTile } from './AccountsTile';
import { BalancesTile } from './BalancesTile';
import { TransactionsTile } from './TransactionsTile';
import { InvestmentPortfolioTile } from './InvestmentPortfolioTile';
import { InvestmentTransactionsTile } from './InvestmentTransactionsTile';
import { LiabilitiesOverviewTile } from './LiabilitiesOverviewTile';
import { CreditCardDetailsTile } from './CreditCardDetailsTile';
import { MortgageTrackerTile } from './MortgageTrackerTile';
import { PlaidStatementsTile } from './PlaidStatementsTile';

export type TileFactory = (tile: TileConfig) => JSX.Element;

export const PLAID_TILE_FACTORIES: Partial<Record<TileType, TileFactory>> = {
  'plaid-accounts': (t) => <AccountsTile refreshInterval={t.refreshInterval} />,
  'plaid-balances': (t) => <BalancesTile refreshInterval={t.refreshInterval} />,
  'plaid-transactions': (t) => <TransactionsTile refreshInterval={t.refreshInterval} />,
  'plaid-investment-portfolio': (t) => <InvestmentPortfolioTile refreshInterval={t.refreshInterval} />,
  'plaid-investment-transactions': (t) => <InvestmentTransactionsTile refreshInterval={t.refreshInterval} />,
  'plaid-liabilities-overview': (t) => <LiabilitiesOverviewTile refreshInterval={t.refreshInterval} />,
  'plaid-credit-card-details': (t) => <CreditCardDetailsTile refreshInterval={t.refreshInterval} />,
  'plaid-mortgage-tracker': (t) => <MortgageTrackerTile refreshInterval={t.refreshInterval} />,
  'plaid-statements': (t) => <PlaidStatementsTile refreshInterval={t.refreshInterval} />,
};

export { AccountsTile, BalancesTile, TransactionsTile, InvestmentPortfolioTile, InvestmentTransactionsTile, LiabilitiesOverviewTile, CreditCardDetailsTile, MortgageTrackerTile, PlaidStatementsTile };
