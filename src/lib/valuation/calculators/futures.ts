// =============================================================================
// TradeRisk Manager — Traditional Futures Valuation Calculator (Paso 8.2)
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

export interface FuturesValuationInput {
  tradeId: string;
  accountId: string;
  asset: string;
  direction: Direction;
  /** Number of contracts */
  size: number;
  entryPrice: number;
  quote?: MarketPriceQuote;
  /** Index / Commodity contract point multiplier (e.g. 50 for ES, 20 for NQ, 1000 for CL) */
  multiplier: number;
  commissionPerContract?: number;
}

/**
 * Values a standard traditional futures contract.
 */
export function valueFuturesPosition(input: FuturesValuationInput): FloatingPositionValuation {
  const {
    tradeId,
    accountId,
    asset,
    direction,
    size: contracts,
    entryPrice,
    quote,
    multiplier,
    commissionPerContract = 2.05, // standard CME clearing fee per side
  } = input;

  const baseResult: FloatingPositionValuation = {
    tradeId,
    accountId,
    asset,
    direction,
    size: contracts,
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
  const tradeVal = validateTradeCoreParams(entryPrice, contracts);
  if (!tradeVal.isValid) {
    return {
      ...baseResult,
      status: 'unvaluable',
      errorCode: tradeVal.errorCode,
      reason: tradeVal.reason,
    };
  }

  // 3. Validation of futures multiplier
  const multVal = validateFuturesMultiplier(multiplier);
  if (!multVal.isValid) {
    return {
      ...baseResult,
      status: 'unvaluable',
      errorCode: multVal.errorCode,
      reason: multVal.reason,
    };
  }

  if (commissionPerContract !== undefined && !isNonNegativeFinite(commissionPerContract)) {
    return {
      ...baseResult,
      status: 'unvaluable',
      errorCode: 'INVALID_NUMERIC',
      reason: `Invalid commissionPerContract: expected non-negative finite number, received ${String(commissionPerContract)}`,
    };
  }

  const isSpike = quote.isSpike === true;
  const isStale = quote.status === 'stale';
  const isOffline = quote.status === 'offline';

  // Long exits at Bid, Short exits at Ask
  const exitPrice = direction === 'long' ? quote.bid : quote.ask;
  const grossPnL =
    direction === 'long'
      ? roundDecimal((exitPrice - entryPrice) * multiplier * contracts, 2)
      : roundDecimal((entryPrice - exitPrice) * multiplier * contracts, 2);

  const estimatedExitCosts = roundDecimal(commissionPerContract * contracts, 2);
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
    estimatedClosingFee: estimatedExitCosts,
    estimatedExitCosts,
    netFloatingPnL,
    pnlAccountCurrency: netFloatingPnL,
  };
}
