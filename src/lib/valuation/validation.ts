// =============================================================================
// TradeRisk Manager — Financial Numeric Validation Engine (Paso 8.2.1)
// =============================================================================

import type { MarketPriceQuote } from '../market-data/types';
import type { ValuationErrorCode } from './types';

const VALID_FEED_STATUSES = new Set(['live', 'stale', 'offline', 'manual']);

/** Result of a numeric validation check */
export interface NumericValidationResult {
  isValid: boolean;
  errorCode?: ValuationErrorCode;
  reason?: string;
}

/** Checks whether a value is strictly a positive finite number (> 0) */
export function isPositiveFinite(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val) && val > 0;
}

/** Checks whether a value is strictly a non-negative finite number (>= 0) */
export function isNonNegativeFinite(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val) && val >= 0;
}

/**
 * Validates essential trade parameters: entryPrice and size must be positive finite numbers.
 */
export function validateTradeCoreParams(entryPrice: unknown, size: unknown): NumericValidationResult {
  if (!isPositiveFinite(entryPrice)) {
    return {
      isValid: false,
      errorCode: 'INVALID_NUMERIC',
      reason: `Invalid entryPrice: expected positive finite number, received ${String(entryPrice)}`,
    };
  }
  if (!isPositiveFinite(size)) {
    return {
      isValid: false,
      errorCode: 'INVALID_NUMERIC',
      reason: `Invalid position size: expected positive finite number, received ${String(size)}`,
    };
  }
  return { isValid: true };
}

/**
 * Validates market quote status and bid/ask prices.
 * - Runtime check: rejects unknown, missing or malformed feed status with INVALID_MARKET_QUOTE.
 * - Enforces positive finite bid and ask prices.
 * - Rejects crossed order books (bid > ask).
 */
export function validateQuotePrices(quote?: MarketPriceQuote | null): NumericValidationResult {
  if (!quote) {
    return {
      isValid: false,
      errorCode: 'NO_MARKET_QUOTE',
      reason: 'Market quote is undefined or missing',
    };
  }
  if (typeof quote.status !== 'string' || !VALID_FEED_STATUSES.has(quote.status)) {
    return {
      isValid: false,
      errorCode: 'INVALID_MARKET_QUOTE',
      reason: `Unrecognized or malformed market quote status: "${String(quote.status)}"`,
    };
  }
  if (!isPositiveFinite(quote.bid)) {
    return {
      isValid: false,
      errorCode: 'INVALID_NUMERIC',
      reason: `Invalid quote bid price: expected positive finite number, received ${String(quote.bid)}`,
    };
  }
  if (!isPositiveFinite(quote.ask)) {
    return {
      isValid: false,
      errorCode: 'INVALID_NUMERIC',
      reason: `Invalid quote ask price: expected positive finite number, received ${String(quote.ask)}`,
    };
  }
  if (quote.bid > quote.ask) {
    return {
      isValid: false,
      errorCode: 'INVALID_NUMERIC',
      reason: `Crossed order book quote: bid (${quote.bid}) > ask (${quote.ask})`,
    };
  }
  return { isValid: true };
}

/**
 * Validates Forex parameters (pipSize, pipValueInQuote, quoteToAccountFxRate).
 */
export function validateForexParams(
  pipSize: unknown,
  pipValueInQuote: unknown,
  quoteToAccountFxRate: unknown
): NumericValidationResult {
  if (pipSize !== undefined && !isPositiveFinite(pipSize)) {
    return {
      isValid: false,
      errorCode: 'INVALID_NUMERIC',
      reason: `Invalid pipSize: expected positive finite number, received ${String(pipSize)}`,
    };
  }
  if (pipValueInQuote !== undefined && !isPositiveFinite(pipValueInQuote)) {
    return {
      isValid: false,
      errorCode: 'INVALID_NUMERIC',
      reason: `Invalid pipValueInQuote: expected positive finite number, received ${String(pipValueInQuote)}`,
    };
  }
  if (quoteToAccountFxRate !== undefined && !isPositiveFinite(quoteToAccountFxRate)) {
    return {
      isValid: false,
      errorCode: 'INVALID_NUMERIC',
      reason: `Invalid quoteToAccountFxRate: expected positive finite number, received ${String(quoteToAccountFxRate)}`,
    };
  }
  return { isValid: true };
}

/**
 * Validates Futures multiplier.
 */
export function validateFuturesMultiplier(multiplier: unknown): NumericValidationResult {
  if (multiplier !== undefined && !isPositiveFinite(multiplier)) {
    return {
      isValid: false,
      errorCode: 'INVALID_NUMERIC',
      reason: `Invalid futures multiplier: expected positive finite number, received ${String(multiplier)}`,
    };
  }
  return { isValid: true };
}

/**
 * Validates Coin-M inverse contract parameters.
 */
export function validateCoinMParams(
  contractSizeUSD: unknown,
  usdToAccountFxRate: unknown
): NumericValidationResult {
  if (contractSizeUSD !== undefined && !isPositiveFinite(contractSizeUSD)) {
    return {
      isValid: false,
      errorCode: 'INVALID_NUMERIC',
      reason: `Invalid contractSizeUSD: expected positive finite number, received ${String(contractSizeUSD)}`,
    };
  }
  if (usdToAccountFxRate !== undefined && !isPositiveFinite(usdToAccountFxRate)) {
    return {
      isValid: false,
      errorCode: 'INVALID_NUMERIC',
      reason: `Invalid usdToAccountFxRate: expected positive finite number, received ${String(usdToAccountFxRate)}`,
    };
  }
  return { isValid: true };
}

/**
 * Validates Spot Short borrowing parameters.
 */
export function validateSpotBorrowParams(
  daysHeld: unknown,
  dailyBorrowRate: unknown,
  borrowCapacityAvailable: unknown
): NumericValidationResult {
  if (daysHeld !== undefined && !isNonNegativeFinite(daysHeld)) {
    return {
      isValid: false,
      errorCode: 'INVALID_NUMERIC',
      reason: `Invalid daysHeld: expected non-negative finite number, received ${String(daysHeld)}`,
    };
  }
  if (dailyBorrowRate !== undefined && !isNonNegativeFinite(dailyBorrowRate)) {
    return {
      isValid: false,
      errorCode: 'INVALID_NUMERIC',
      reason: `Invalid dailyBorrowRate: expected non-negative finite number, received ${String(dailyBorrowRate)}`,
    };
  }
  if (borrowCapacityAvailable !== undefined && !isNonNegativeFinite(borrowCapacityAvailable)) {
    return {
      isValid: false,
      errorCode: 'INVALID_NUMERIC',
      reason: `Invalid borrowCapacityAvailable: expected non-negative finite number, received ${String(borrowCapacityAvailable)}`,
    };
  }
  return { isValid: true };
}
