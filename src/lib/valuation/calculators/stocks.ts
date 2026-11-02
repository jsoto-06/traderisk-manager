// =============================================================================
// TradeRisk Manager — Stocks & CFDs Valuation Calculator (Paso 8.2)
// =============================================================================

import type { Direction } from '../../types';
import type { MarketPriceQuote } from '../../market-data/types';
import type { FloatingPositionValuation } from '../types';
import { roundDecimal } from '../../risk-engine/precision';
import {
  validateTradeCoreParams,
  validateQuotePrices,
  isNonNegativeFinite,
} from '../validation';

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

  // 1. Validation of market quote
  if (!quote) {
    return {
      ...baseResult,
      status: 'unvaluable',
      errorCode: 'NO_MARKET_QUOTE',
      reason: 'No market quote provided',
    };
  }
  const quoteVal = validateQuotePrices(quote);
  if (!quoteVal.isValid) {
    return {
      ...baseResult,
      status: 'unvaluable',
      errorCode: quoteVal.errorCode,
      reason: quoteVal.reason,
    };
  }

  // 2. Validation of numeric trade parameters
  const tradeVal = validateTradeCoreParams(entryPrice, shares);
  if (!tradeVal.isValid) {
    return {
      ...baseResult,
      status: 'unvaluable',
      errorCode: tradeVal.errorCode,
      reason: tradeVal.reason,
    };
  }

  // 3. Validation of stock financial parameters
  if (commissionPerShare !== undefined && !isNonNegativeFinite(commissionPerShare)) {
    return {
      ...baseResult,
      status: 'unvaluable',
      errorCode: 'INVALID_NUMERIC',
      reason: `Invalid commissionPerShare: expected non-negative finite number, received ${String(commissionPerShare)}`,
    };
  }

  if (borrowRate !== undefined && !isNonNegativeFinite(borrowRate)) {
    return {
      ...baseResult,
      status: 'unvaluable',
      errorCode: 'INVALID_NUMERIC',
      reason: `Invalid borrowRate: expected non-negative finite number, received ${String(borrowRate)}`,
    };
  }

  if (daysHeld !== undefined && !isNonNegativeFinite(daysHeld)) {
    return {
      ...baseResult,
      status: 'unvaluable',
      errorCode: 'INVALID_NUMERIC',
      reason: `Invalid daysHeld: expected non-negative finite number, received ${String(daysHeld)}`,
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
