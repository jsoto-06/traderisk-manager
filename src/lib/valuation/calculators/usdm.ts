// =============================================================================
// TradeRisk Manager — USD-M Linear Perpetuals Valuation Calculator (Paso 8.2)
// =============================================================================

import type { Direction } from '../../types';
import type { MarketPriceQuote } from '../../market-data/types';
import type { FloatingPositionValuation } from '../types';
import { roundDecimal } from '../../risk-engine/precision';

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

  if (!quote || !Number.isFinite(quote.bid) || !Number.isFinite(quote.ask) || quote.bid <= 0 || quote.ask <= 0) {
    return {
      ...baseResult,
      status: 'unvaluable',
      errorCode: 'NO_MARKET_QUOTE',
      reason: 'No valid market quote available for USD-M valuation',
    };
  }

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
