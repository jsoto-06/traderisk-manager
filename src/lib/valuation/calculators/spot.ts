// =============================================================================
// TradeRisk Manager — Spot Quantitative Valuation Calculator (Paso 8.2)
// =============================================================================

import type { Direction } from '../../types';
import type { MarketPriceQuote } from '../../market-data/types';
import type { FloatingPositionValuation } from '../types';
import { roundDecimal } from '../../risk-engine/precision';

export interface SpotValuationInput {
  tradeId: string;
  accountId: string;
  asset: string;
  direction: Direction;
  size: number;
  entryPrice: number;
  quote?: MarketPriceQuote;
  marginMode?: 'cash' | 'isolated' | 'cross' | string;
  borrowCapacityAvailable?: number;
  isMarginShortable?: boolean;
  dailyBorrowRate?: number;
  daysHeld?: number;
  closingFeeRate?: number;
}

/**
 * Values a Spot crypto or cash equity position.
 * Strictly enforces that short spot positions must verify margin borrowing;
 * never returns fictitious PnL if borrowing cannot be verified.
 */
export function valueSpotPosition(input: SpotValuationInput): FloatingPositionValuation {
  const {
    tradeId,
    accountId,
    asset,
    direction,
    size,
    entryPrice,
    quote,
    marginMode,
    borrowCapacityAvailable,
    isMarginShortable,
    dailyBorrowRate,
    daysHeld = 1,
    closingFeeRate = 0.001, // default 0.1% spot fee
  } = input;

  const baseResult: FloatingPositionValuation = {
    tradeId,
    accountId,
    asset,
    direction,
    size,
    entryPrice,
    exitPrice: 0,
    status: 'unvaluable',
    isValuationAvailable: false,
    isStopLossConfigured: false,
    isStopCrossed: false,
    marketQuote: quote,
  };

  // 1. Validation of market quote
  if (!quote || !Number.isFinite(quote.bid) || !Number.isFinite(quote.ask) || quote.bid <= 0 || quote.ask <= 0) {
    return {
      ...baseResult,
      status: 'unvaluable',
      errorCode: 'NO_MARKET_QUOTE',
      reason: 'No valid market quote available for spot valuation',
    };
  }

  // 2. Validation of numeric trade parameters
  if (!Number.isFinite(entryPrice) || entryPrice <= 0 || !Number.isFinite(size) || size <= 0) {
    return {
      ...baseResult,
      status: 'unvaluable',
      errorCode: 'INVALID_NUMERIC',
      reason: 'Invalid entryPrice or position size',
    };
  }

  const isSpike = quote.isSpike === true;
  const isStale = quote.status === 'stale';
  const isOffline = quote.status === 'offline';

  // 3. Long Spot: valuation against Bid
  if (direction === 'long') {
    const exitPrice = quote.bid;
    const grossPnL = roundDecimal((exitPrice - entryPrice) * size, 2);
    const estimatedClosingFee = roundDecimal(closingFeeRate * exitPrice * size, 2);
    const estimatedExitCosts = estimatedClosingFee;
    const netFloatingPnL = roundDecimal(grossPnL - estimatedExitCosts, 2);

    return {
      ...baseResult,
      exitPrice,
      status: isOffline ? 'offline' : isStale ? 'stale' : 'active',
      isValuationAvailable: true,
      isSpike,
      isStale,
      isOffline,
      grossPnL,
      estimatedClosingFee,
      estimatedExitCosts,
      netFloatingPnL,
      pnlAccountCurrency: netFloatingPnL,
    };
  }

  // 4. Short Spot: Rigorous Margin Borrowing Validation
  // Short spot in a pure cash account is inoperable
  if (!marginMode || marginMode === 'cash') {
    return {
      ...baseResult,
      exitPrice: quote.ask,
      status: 'inoperable',
      isValuationAvailable: false,
      errorCode: 'INOPERABLE_SPOT_SHORT_CASH_ACCOUNT',
      reason: 'Short selling is strictly prohibited in cash spot accounts without margin borrowing facilities',
      isSpike,
      isStale,
      isOffline,
    };
  }

  // Must verify instrument shortability
  if (isMarginShortable !== true) {
    return {
      ...baseResult,
      exitPrice: quote.ask,
      status: 'inoperable',
      isValuationAvailable: false,
      errorCode: 'INOPERABLE_SPOT_SHORT_INSTRUMENT_NOT_SHORTABLE',
      reason: `Instrument ${asset} is not approved or enabled for margin shorting by the broker`,
      isSpike,
      isStale,
      isOffline,
    };
  }

  // Must verify borrow capacity >= size
  if (borrowCapacityAvailable == null || borrowCapacityAvailable < size) {
    return {
      ...baseResult,
      exitPrice: quote.ask,
      status: 'inoperable',
      isValuationAvailable: false,
      errorCode: 'INOPERABLE_SPOT_SHORT_BORROW_CAPACITY_EXCEEDED',
      reason: `Required borrow amount (${size}) exceeds verified borrow capacity (${borrowCapacityAvailable ?? 0})`,
      isSpike,
      isStale,
      isOffline,
    };
  }

  // Must verify borrow rate is present and finite
  if (dailyBorrowRate == null || !Number.isFinite(dailyBorrowRate) || dailyBorrowRate < 0) {
    return {
      ...baseResult,
      exitPrice: quote.ask,
      status: 'inoperable',
      isValuationAvailable: false,
      errorCode: 'INOPERABLE_SPOT_SHORT_BORROW_RATE_UNAVAILABLE',
      reason: 'Verified daily borrow rate is unavailable or invalid',
      isSpike,
      isStale,
      isOffline,
    };
  }

  // All 3 conditions satisfied: Value short position against Ask
  const exitPrice = quote.ask;
  const grossPnL = roundDecimal((entryPrice - exitPrice) * size, 2);
  const notionalBorrowed = entryPrice * size;
  const borrowingCosts = roundDecimal(dailyBorrowRate * Math.max(1, daysHeld) * notionalBorrowed, 2);
  const estimatedClosingFee = roundDecimal(closingFeeRate * exitPrice * size, 2);
  const estimatedExitCosts = roundDecimal(estimatedClosingFee + borrowingCosts, 2);
  const netFloatingPnL = roundDecimal(grossPnL - estimatedExitCosts, 2);

  return {
    ...baseResult,
    exitPrice,
    status: isOffline ? 'offline' : isStale ? 'stale' : 'active',
    isValuationAvailable: true,
    isSpike,
    isStale,
    isOffline,
    grossPnL,
    borrowingCosts,
    estimatedClosingFee,
    estimatedExitCosts,
    netFloatingPnL,
    pnlAccountCurrency: netFloatingPnL,
  };
}
