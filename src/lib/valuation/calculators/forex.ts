// =============================================================================
// TradeRisk Manager — Forex Lot & Pip Valuation Calculator (Paso 8.2)
// =============================================================================

import type { Direction } from '../../types';
import type { MarketPriceQuote } from '../../market-data/types';
import type { FloatingPositionValuation } from '../types';
import { roundDecimal, calcPips } from '../../risk-engine/precision';
import {
  validateTradeCoreParams,
  validateQuotePrices,
  validateForexParams,
  isNonNegativeFinite,
} from '../validation';

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
  const tradeVal = validateTradeCoreParams(entryPrice, lots);
  if (!tradeVal.isValid) {
    return {
      ...baseResult,
      status: 'unvaluable',
      errorCode: tradeVal.errorCode,
      reason: tradeVal.reason,
    };
  }

  // 3. Validation of Forex parameters
  const fxVal = validateForexParams(pipSize, pipValueInQuote, quoteToAccountFxRate);
  if (!fxVal.isValid) {
    return {
      ...baseResult,
      status: 'unvaluable',
      errorCode: fxVal.errorCode,
      reason: fxVal.reason,
    };
  }

  if (closingCommission !== undefined && !isNonNegativeFinite(closingCommission)) {
    return {
      ...baseResult,
      status: 'unvaluable',
      errorCode: 'INVALID_NUMERIC',
      reason: `Invalid closingCommission: expected non-negative finite number, received ${String(closingCommission)}`,
    };
  }

  if (swap !== undefined && (typeof swap !== 'number' || !Number.isFinite(swap))) {
    return {
      ...baseResult,
      status: 'unvaluable',
      errorCode: 'INVALID_NUMERIC',
      reason: `Invalid swap: expected finite number, received ${String(swap)}`,
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
