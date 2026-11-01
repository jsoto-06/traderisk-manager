// =============================================================================
// TradeRisk Manager — Traditional Futures Valuation Calculator (Paso 8.2)
// =============================================================================

import type { Direction } from '../../types';
import type { MarketPriceQuote } from '../../market-data/types';
import type { FloatingPositionValuation } from '../types';
import { roundDecimal } from '../../risk-engine/precision';

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

  if (!quote || !Number.isFinite(quote.bid) || !Number.isFinite(quote.ask) || quote.bid <= 0 || quote.ask <= 0) {
    return {
      ...baseResult,
      status: 'unvaluable',
      errorCode: 'NO_MARKET_QUOTE',
      reason: 'No valid market quote available for Futures valuation',
    };
  }

  if (!Number.isFinite(entryPrice) || entryPrice <= 0 || !Number.isFinite(contracts) || contracts <= 0 || !Number.isFinite(multiplier) || multiplier <= 0) {
    return {
      ...baseResult,
      status: 'unvaluable',
      errorCode: 'INVALID_NUMERIC',
      reason: 'Invalid entryPrice, contract count, or multiplier',
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
