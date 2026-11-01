// =============================================================================
// TradeRisk Manager — Real-Time Quantitative Valuation Contracts (Paso 8.2)
// =============================================================================

import type { Direction } from '../types';
import type { MarketPriceQuote } from '../market-data/types';

/** Error codes for positions that cannot be valued or executed */
export type ValuationErrorCode =
  | 'INOPERABLE_SPOT_SHORT_CASH_ACCOUNT'
  | 'INOPERABLE_SPOT_SHORT_INSTRUMENT_NOT_SHORTABLE'
  | 'INOPERABLE_SPOT_SHORT_BORROW_CAPACITY_EXCEEDED'
  | 'INOPERABLE_SPOT_SHORT_BORROW_RATE_UNAVAILABLE'
  | 'NO_MARKET_QUOTE'
  | 'INVALID_NUMERIC'
  | 'CURRENCY_CONVERSION_UNAVAILABLE'
  | 'UNSUPPORTED_ASSET_CLASS';

/** Position valuation status */
export type PositionValuationStatus =
  | 'active'
  | 'inoperable'
  | 'stale'
  | 'offline'
  | 'unvaluable';

/** Detailed real-time valuation snapshot for a single open position */
export interface FloatingPositionValuation {
  tradeId: string;
  accountId: string;
  asset: string;
  direction: Direction;
  size: number;
  entryPrice: number;
  /** Executable exit price: Bid for Long, Ask for Short */
  exitPrice: number;
  /** Status of this position valuation */
  status: PositionValuationStatus;
  /** True if this position could be valued with valid market data */
  isValuationAvailable: boolean;
  /** Specific error code if valuation or borrowing failed */
  errorCode?: ValuationErrorCode;
  /** Human-readable explanation if valuation is unavailable or inoperable */
  reason?: string;

  /** Health & spike markers derived from market feed */
  isSpike?: boolean;
  isStale?: boolean;
  isOffline?: boolean;

  /** PnL metrics */
  grossPnL?: number;
  estimatedExitCosts?: number;
  netFloatingPnL?: number;

  /** Multi-asset specifics */
  pnlBaseCurrency?: number;     // e.g. BTC for Coin-M inverse contracts
  pnlAccountCurrency?: number;  // converted to account base currency
  borrowingCosts?: number;      // margin borrowing fee for spot shorts
  accruedFunding?: number;      // funding fee for perpetuals
  estimatedClosingFee?: number; // projected exit commission

  /** Dynamic Open Risk metrics */
  isStopLossConfigured: boolean;
  isStopCrossed: boolean;
  originalSL?: number;
  currentSL?: number;
  initialCapitalRisk?: number;   // at original SL (0 if protected or crossed)
  capitalRiskAtSL?: number;      // at current SL (0 if protected or crossed)
  markToStopDistance?: number;   // from current exitPrice to current SL (0 if crossed)

  /** Raw quote reference if available */
  marketQuote?: MarketPriceQuote;
}

/** Aggregated Dynamic Open Risk for an account */
export interface DynamicOpenRiskSnapshot {
  totalInitialCapitalRisk: number;
  totalCapitalRiskAtSL: number;
  totalMarkToStopDistance: number;
  totalEstimatedExitCosts: number;
  totalEstimatedOpenRisk: number;
  /** Count of open positions with no Stop Loss configured */
  unboundedRiskCount: number;
}

/** Intraday Daily Loss snapshot adhering to Prop Firm requirements */
export interface DailyLossSnapshot {
  startOfDayBalance: number;
  startOfDayEquity: number;
  startOfDayOpenFloating: number;
  closedPnLToday: number;
  deltaOpenFloatingToday: number;
  netCashFlowsToday: number;
  dailyNetPerformance: number;
  dailyLossTotal: number;
  dailyLossLimitAmount: number;
  remainingDailyLoss: number;
  isBreached: boolean;
  resetTimestamp: string;
}

/** Optional margin & leverage metrics when verifiable parameters exist */
export interface MarginMetricsSnapshot {
  usedMargin?: number;
  freeMargin?: number;
  marginLevelPercent?: number;
  isMarginEstimated: boolean;
  methodology?: string;
}

/** Complete real-time valuation snapshot for an entire trading account */
export interface AccountValuationSnapshot {
  accountId: string;
  ledgerBalance: number;
  /** Canonical real-time equity: ledgerBalance + sum(valuable netFloatingPnL) */
  equity: number;
  unrealizedPnL: number;
  mode: 'manual_closed' | 'realtime_feed';

  /**
   * Equity Integrity invariant (Requisito 3.A):
   * True ONLY if 100% of open positions have valid, available valuations.
   * If false, equity is marked incomplete and peak equity cannot be updated.
   */
  isValuationComplete: boolean;
  /** Trade IDs of open positions that could not be valued */
  unvaluablePositions: string[];
  /** True if all quotes are live, non-stale, non-offline, and non-spike */
  isReliable: boolean;
  /** True if high-water mark / peak equity can be legally updated */
  canUpdatePeakEquity: boolean;
  /** Suggested candidate value for peak equity if authorized */
  peakEquityCandidate?: number;

  dynamicOpenRisk: DynamicOpenRiskSnapshot;
  dailyLoss: DailyLossSnapshot;
  marginMetrics?: MarginMetricsSnapshot;
  positions: FloatingPositionValuation[];
  timestamp: string;
}

/** Accounting reconciliation audit comparing pre-close estimate vs post-close execution */
export interface ExecutionReconciliation {
  tradeId: string;
  estimatedNetFloatingPnL: number;
  actualRealizedNetPnL: number;
  executionVariance: number;
  slippageVariance: number;
  commissionVariance: number;
  fundingVariance: number;
}
