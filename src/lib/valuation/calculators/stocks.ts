// =============================================================================
// TradeRisk Manager — Stocks & CFDs Valuation Calculator (Paso 8.2)
// =============================================================================

import type { Direction } from '../../types';
import type { MarketPriceQuote } from '../../market-data/types';
import type { FloatingPositionValuation } from '../types';
import { roundDecimal } from '../../risk-engine/precision';

export interface StocksValuationInput {
  tradeId: string;
  accountId: string;
  asset: string;
  direction: Direction;
  /** Number of shares (integer or fractional) */
  size: number;
  entryPrice: number;
  quote?: MarketPriceQuote;
  commissionPerShare?: number;
  borrowRate?: number;
  daysHeld?: number;
}

/**
 * Values a stock or equity CFD position.
 */
export function valueStocksPosition(input: StocksValuationInput): FloatingPositionValuation {
  const {
    tradeId,
    accountId,
    asset,
    direction,
    size: shares,
    entryPrice,
    quote,
    commissionPerShare = 0.005,
    borrowRate = 0,
    daysHeld = 1,
  } = input;

  const baseResult: FloatingPositionValuation = {
    tradeId,
    accountId,
    asset,
    direction,
    size: shares,
    entryPrice,
    exitPrice: 0,
    status: 'unvaluable',
    isValuationAvailable: false,
    isStopLossConfigured: false,
    isStopCrossed: false,
    marketQuote: quote,
  };

  if (!quote || !Number.isFinite(quote.bid) || !Number.isFinite(quote.ask) || quote.bid <= 0 || quote.ask <= 0) {
    return {
      ...baseResult,
      status: 'unvaluable',
      errorCode: 'NO_MARKET_QUOTE',
      reason: 'No valid market quote available for Stocks valuation',
    };
  }

  if (!Number.isFinite(entryPrice) || entryPrice <= 0 || !Number.isFinite(shares) || shares <= 0) {
    return {
      ...baseResult,
      status: 'unvaluable',
      errorCode: 'INVALID_NUMERIC',
      reason: 'Invalid entryPrice or share count',
    };
  }

  const isSpike = quote.isSpike === true;
  const isStale = quote.status === 'stale';
  const isOffline = quote.status === 'offline';

  // Long exits at Bid, Short exits at Ask
  const exitPrice = direction === 'long' ? quote.bid : quote.ask;
  const grossPnL =
    direction === 'long'
      ? roundDecimal((exitPrice - entryPrice) * shares, 2)
      : roundDecimal((entryPrice - exitPrice) * shares, 2);

  const estimatedClosingFee = roundDecimal(commissionPerShare * shares, 2);
  const borrowingCosts = direction === 'short' ? roundDecimal(borrowRate * daysHeld * (entryPrice * shares), 2) : 0;
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
    borrowingCosts: borrowingCosts > 0 ? borrowingCosts : undefined,
    estimatedClosingFee,
    estimatedExitCosts,
    netFloatingPnL,
    pnlAccountCurrency: netFloatingPnL,
  };
}
