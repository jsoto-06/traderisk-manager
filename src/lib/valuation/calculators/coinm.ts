// =============================================================================
// TradeRisk Manager — Coin-M Inverse Perpetuals/Futures Calculator (Paso 8.2)
// =============================================================================

import type { Direction } from '../../types';
import type { MarketPriceQuote } from '../../market-data/types';
import type { FloatingPositionValuation } from '../types';
import { roundDecimal } from '../../risk-engine/precision';

export interface CoinMValuationInput {
  tradeId: string;
  accountId: string;
  asset: string;
  direction: Direction;
  /** Number of contracts N */
  size: number;
  entryPrice: number;
  quote?: MarketPriceQuote;
  /** Nominal USD value per contract D (e.g. $100 for BTCUSD, $10 for ETHUSD) */
  contractSizeUSD?: number;
  accruedFundingBase?: number;
  closingFeeRate?: number; // e.g. 0.0005 (0.05%)
  accountCurrency?: string; // 'USD', 'EUR', etc.
  /** Exchange rate from USD to account currency (e.g. 0.92 for EUR if EUR/USD is 1.087) */
  usdToAccountFxRate?: number;
}

/**
 * Values an inverse Coin-M contract settled in underlying cryptocurrency (e.g. BTC, ETH).
 * Computes the non-linear asymmetric PnL curve in base currency and converts to account currency.
 */
export function valueCoinMPosition(input: CoinMValuationInput): FloatingPositionValuation {
  const {
    tradeId,
    accountId,
    asset,
    direction,
    size: contracts,
    entryPrice,
    quote,
    contractSizeUSD = 100, // default $100 for BTCUSD
    accruedFundingBase = 0,
    closingFeeRate = 0.0005,
    accountCurrency = 'USD',
    usdToAccountFxRate = 1.0,
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
      reason: 'No valid market quote available for Coin-M valuation',
    };
  }

  if (!Number.isFinite(entryPrice) || entryPrice <= 0 || !Number.isFinite(contracts) || contracts <= 0) {
    return {
      ...baseResult,
      status: 'unvaluable',
      errorCode: 'INVALID_NUMERIC',
      reason: 'Invalid entryPrice or contract count',
    };
  }

  const isSpike = quote.isSpike === true;
  const isStale = quote.status === 'stale';
  const isOffline = quote.status === 'offline';

  // Long exits at Bid, Short exits at Ask
  const exitPrice = direction === 'long' ? quote.bid : quote.ask;
  const totalNominalUSD = contracts * contractSizeUSD;

  // Asymmetric inverse formula in base cryptocurrency (e.g. BTC)
  let grossPnLBase = 0;
  if (direction === 'long') {
    grossPnLBase = (1 / entryPrice - 1 / exitPrice) * totalNominalUSD;
  } else {
    grossPnLBase = (1 / exitPrice - 1 / entryPrice) * totalNominalUSD;
  }
  grossPnLBase = roundDecimal(grossPnLBase, 8);

  // Closing commission in base currency: notional in base = totalNominalUSD / exitPrice
  const closingCommissionBase = roundDecimal((totalNominalUSD / exitPrice) * closingFeeRate, 8);
  const exitCostsBase = roundDecimal(closingCommissionBase + accruedFundingBase, 8);
  const netPnLBase = roundDecimal(grossPnLBase - exitCostsBase, 8);

  // Convert to USD and Account Currency
  const grossPnLUSD = roundDecimal(grossPnLBase * exitPrice, 2);
  const exitCostsUSD = roundDecimal(exitCostsBase * exitPrice, 2);
  const netPnLUSD = roundDecimal(netPnLBase * exitPrice, 2);

  const fxRate = accountCurrency === 'USD' ? 1.0 : usdToAccountFxRate;
  const netPnLAccount = roundDecimal(netPnLUSD * fxRate, 2);
  const exitCostsAccount = roundDecimal(exitCostsUSD * fxRate, 2);

  return {
    ...baseResult,
    exitPrice,
    status: isOffline ? 'offline' : isStale ? 'stale' : 'active',
    isValuationAvailable: true,
    isSpike,
    isStale,
    isOffline,
    grossPnL: accountCurrency === 'USD' ? grossPnLUSD : roundDecimal(grossPnLUSD * fxRate, 2),
    estimatedClosingFee: accountCurrency === 'USD' ? roundDecimal(closingCommissionBase * exitPrice, 2) : roundDecimal(closingCommissionBase * exitPrice * fxRate, 2),
    estimatedExitCosts: exitCostsAccount,
    netFloatingPnL: netPnLAccount,
    pnlBaseCurrency: netPnLBase,
    pnlAccountCurrency: netPnLAccount,
  };
}
