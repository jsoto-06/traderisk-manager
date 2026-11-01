// =============================================================================
// TradeRisk Manager — Forex Lot & Pip Valuation Calculator (Paso 8.2)
// =============================================================================

import type { Direction } from '../../types';
import type { MarketPriceQuote } from '../../market-data/types';
import type { FloatingPositionValuation } from '../types';
import { roundDecimal, calcPips } from '../../risk-engine/precision';

export interface ForexValuationInput {
  tradeId: string;
  accountId: string;
  asset: string;
  direction: Direction;
  /** Size in standard lots (e.g. 1.0, 0.1, 0.01) */
  size: number;
  entryPrice: number;
  quote?: MarketPriceQuote;
  pipSize?: number;          // 0.0001 for EUR/USD, 0.01 for USD/JPY
  pipValueInQuote?: number;  // Monetary value of 1 pip for 1 standard lot in quote currency (usually 10)
  quoteToAccountFxRate?: number; // Rate to convert quote currency to account currency
  closingCommission?: number;
  swap?: number;
}

/**
 * Values a Forex currency pair position based on lot size, pips, and FX rate.
 */
export function valueForexPosition(input: ForexValuationInput): FloatingPositionValuation {
  const {
    tradeId,
    accountId,
    asset,
    direction,
    size: lots,
    entryPrice,
    quote,
    pipSize = 0.0001,
    pipValueInQuote = 10,
    quoteToAccountFxRate = 1.0,
    closingCommission = 0,
    swap = 0,
  } = input;

  const baseResult: FloatingPositionValuation = {
    tradeId,
    accountId,
    asset,
    direction,
    size: lots,
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
      reason: 'No valid market quote available for Forex valuation',
    };
  }

  if (!Number.isFinite(entryPrice) || entryPrice <= 0 || !Number.isFinite(lots) || lots <= 0) {
    return {
      ...baseResult,
      status: 'unvaluable',
      errorCode: 'INVALID_NUMERIC',
      reason: 'Invalid entryPrice or lot size',
    };
  }

  const isSpike = quote.isSpike === true;
  const isStale = quote.status === 'stale';
  const isOffline = quote.status === 'offline';

  // Long exits at Bid, Short exits at Ask
  const exitPrice = direction === 'long' ? quote.bid : quote.ask;
  const distance = direction === 'long' ? exitPrice - entryPrice : entryPrice - exitPrice;
  const pips = calcPips(distance, pipSize);

  const grossQuote = pips * pipValueInQuote * lots;
  const grossAccount = roundDecimal(grossQuote * quoteToAccountFxRate, 2);

  const estimatedExitCosts = roundDecimal(closingCommission + swap, 2);
  const netFloatingPnL = roundDecimal(grossAccount - estimatedExitCosts, 2);

  return {
    ...baseResult,
    exitPrice,
    status: isOffline ? 'offline' : isStale ? 'stale' : 'active',
    isValuationAvailable: true,
    isSpike,
    isStale,
    isOffline,
    grossPnL: grossAccount,
    estimatedClosingFee: closingCommission,
    estimatedExitCosts,
    netFloatingPnL,
    pnlAccountCurrency: netFloatingPnL,
  };
}
