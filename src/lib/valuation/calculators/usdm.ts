// =============================================================================
// TradeRisk Manager — USD-M Linear Perpetuals Valuation Calculator (Paso 8.2)
// =============================================================================

import type { Direction } from '../../types';
import type { MarketPriceQuote } from '../../market-data/types';
import type { FloatingPositionValuation } from '../types';
import { roundDecimal } from '../../risk-engine/precision';
import {
  validateTradeCoreParams,
  validateQuotePrices,
  validateFuturesMultiplier,
  isNonNegativeFinite,
} from '../validation';

export interface UsdmValuationInput {
  tradeId: string;
  accountId: string;
  asset: string;
  direction: Direction;
  size: number;
  entryPrice: number;
  quote?: MarketPriceQuote;
  multiplier?: number;
  accruedFunding?: number;
  closingFeeRate?: number; // default 0.05% (0.0005) taker
}

/**
 * Values a USD-M linear contract (USDT or USDC settled).
 */
export function valueUsdmPosition(input: UsdmValuationInput): FloatingPositionValuation {
  const {
    tradeId,
    accountId,
    asset,
    direction,
    size,
    entryPrice,
    quote,
    multiplier = 1,
    accruedFunding = 0,
    closingFeeRate = 0.0005,
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
  const tradeVal = validateTradeCoreParams(entryPrice, size);
  if (!tradeVal.isValid) {
    return {
      ...baseResult,
      status: 'unvaluable',
      errorCode: tradeVal.errorCode,
      reason: tradeVal.reason,
    };
  }

  // 3. Validation of multiplier and financial rates
  const multVal = validateFuturesMultiplier(multiplier);
  if (!multVal.isValid) {
    return {
      ...baseResult,
      status: 'unvaluable',
      errorCode: multVal.errorCode,
      reason: multVal.reason,
    };
  }

  if (accruedFunding !== undefined && (typeof accruedFunding !== 'number' || !Number.isFinite(accruedFunding))) {
    return {
      ...baseResult,
      status: 'unvaluable',
      errorCode: 'INVALID_NUMERIC',
      reason: `Invalid accruedFunding: expected finite number, received ${String(accruedFunding)}`,
    };
  }

  if (closingFeeRate !== undefined && !isNonNegativeFinite(closingFeeRate)) {
    return {
      ...baseResult,
      status: 'unvaluable',
      errorCode: 'INVALID_NUMERIC',
      reason: `Invalid closingFeeRate: expected non-negative finite number, received ${String(closingFeeRate)}`,
    };
  }

  const isSpike = quote.isSpike === true;
  const isStale = quote.status === 'stale';
  const isOffline = quote.status === 'offline';

  // Long exits at Bid, Short exits at Ask
  const exitPrice = direction === 'long' ? quote.bid : quote.ask;
  const grossPnL =
    direction === 'long'
      ? roundDecimal((exitPrice - entryPrice) * size * multiplier, 2)
      : roundDecimal((entryPrice - exitPrice) * size * multiplier, 2);

  const estimatedClosingFee = roundDecimal(closingFeeRate * exitPrice * size * multiplier, 2);
  const estimatedExitCosts = roundDecimal(estimatedClosingFee + accruedFunding, 2);
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
    accruedFunding,
    estimatedClosingFee,
    estimatedExitCosts,
    netFloatingPnL,
    pnlAccountCurrency: netFloatingPnL,
  };
}
