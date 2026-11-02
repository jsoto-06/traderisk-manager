// =============================================================================
// TradeRisk Manager — Multi-Asset Quantitative Valuation Engine (Paso 8.2)
// =============================================================================

import type { Trade, Account, InstrumentType } from '../types';
import type { MarketPriceQuote } from '../market-data/types';
import type {
  FloatingPositionValuation,
  AccountValuationSnapshot,
  ExecutionReconciliation,
  MarginMetricsSnapshot,
} from './types';
import { roundDecimal } from '../risk-engine/precision';
import { classifyInstrument, inferFuturesMultiplier } from './catalog';
import { valueSpotPosition, type SpotValuationInput } from './calculators/spot';
import { valueUsdmPosition, type UsdmValuationInput } from './calculators/usdm';
import { valueCoinMPosition, type CoinMValuationInput } from './calculators/coinm';
import { valueForexPosition, type ForexValuationInput } from './calculators/forex';
import { valueFuturesPosition, type FuturesValuationInput } from './calculators/futures';
import { valueStocksPosition, type StocksValuationInput } from './calculators/stocks';
import { calculatePositionDynamicRisk, aggregateAccountRisk } from './risk';
import { calculateDailyLoss, type DailyLossInput } from './daily-loss';

export interface ValuationTradeOptions {
  instrumentType?: InstrumentType | string;
  marginMode?: 'cash' | 'isolated' | 'cross' | string;
  borrowCapacityAvailable?: number;
  isMarginShortable?: boolean;
  dailyBorrowRate?: number;
  daysHeld?: number;
  closingFeeRate?: number;
  multiplier?: number;
  accruedFunding?: number;
  accruedFundingBase?: number;
  contractSizeUSD?: number;
  accountCurrency?: string;
  usdToAccountFxRate?: number;
  pipSize?: number;
  pipValueInQuote?: number;
  quoteToAccountFxRate?: number;
  swap?: number;
  commissionPerShare?: number;
  commissionPerContract?: number;
  borrowRate?: number;
  originalSL?: number;
  currentSL?: number;
}

export interface ValuationAccountOptions {
  /** Map of asset symbol -> MarketPriceQuote */
  quotes?: Map<string, MarketPriceQuote> | Record<string, MarketPriceQuote>;
  /** Historical baseline values at start of current trading day */
  startOfDayBalance?: number;
  startOfDayEquity?: number;
  startOfDayOpenFloating?: number;
  /** Closed trades executed during today's session */
  closedTradesToday?: Trade[];
  /** Or directly supplied net closed PnL today */
  closedPnLToday?: number;
  /** Cash flows today */
  depositsToday?: number;
  withdrawalsToday?: number;
  /** Optional trade-specific options by tradeId */
  tradeOptions?: Record<string, ValuationTradeOptions>;
  /** Session reference date for Prop Firm timezone reset */
  referenceDate?: Date;
  /** Prop Firm daily reset hour in America/New_York (default 17) */
  resetHour?: number;
  /** Explicit account leverage for margin calculations */
  leverage?: number;
}

export class MultiAssetValuationEngine {
  /**
   * Values an individual open trade using its appropriate asset calculator
   * and enriches it with Dynamic Open Risk metrics.
   */
  public valueTrade(
    trade: Trade,
    quote?: MarketPriceQuote,
    account?: Account,
    options: ValuationTradeOptions = {}
  ): FloatingPositionValuation {
    const asset = trade.asset;
    const direction = trade.direction;
    const size = trade.size;
    const entryPrice = trade.entryPrice;
    const tradeId = trade.id;
    const accountId = trade.accountId;

    // Detect asset class / instrument model using centralized catalog
    const instrumentType = classifyInstrument(asset, quote, options.instrumentType);

    let valuation: FloatingPositionValuation;

    switch (instrumentType) {
      case 'coinm': {
        const input: CoinMValuationInput = {
          tradeId,
          accountId,
          asset,
          direction,
          size,
          entryPrice,
          quote,
          contractSizeUSD: options.contractSizeUSD ?? (asset.toUpperCase().includes('ETH') ? 10 : 100),
          accruedFundingBase: options.accruedFundingBase ?? 0,
          closingFeeRate: options.closingFeeRate ?? 0.0005,
          accountCurrency: options.accountCurrency ?? account?.currency ?? 'USD',
          usdToAccountFxRate: options.usdToAccountFxRate ?? 1.0,
        };
        valuation = valueCoinMPosition(input);
        break;
      }

      case 'usdm': {
        const input: UsdmValuationInput = {
          tradeId,
          accountId,
          asset,
          direction,
          size,
          entryPrice,
          quote,
          multiplier: options.multiplier ?? 1,
          accruedFunding: options.accruedFunding ?? 0,
          closingFeeRate: options.closingFeeRate ?? 0.0005,
        };
        valuation = valueUsdmPosition(input);
        break;
      }

      case 'forex': {
        const isJpy = asset.toUpperCase().includes('JPY');
        const input: ForexValuationInput = {
          tradeId,
          accountId,
          asset,
          direction,
          size,
          entryPrice,
          quote,
          pipSize: options.pipSize ?? (isJpy ? 0.01 : 0.0001),
          pipValueInQuote: options.pipValueInQuote ?? 10,
          quoteToAccountFxRate: options.quoteToAccountFxRate ?? 1.0,
          closingCommission: options.closingFeeRate != null ? options.closingFeeRate * size : 0,
          swap: options.swap ?? 0,
        };
        valuation = valueForexPosition(input);
        break;
      }

      case 'futures': {
        const input: FuturesValuationInput = {
          tradeId,
          accountId,
          asset,
          direction,
          size,
          entryPrice,
          quote,
          multiplier: options.multiplier ?? inferFuturesMultiplier(asset),
          commissionPerContract: options.commissionPerContract ?? 2.05,
        };
        valuation = valueFuturesPosition(input);
        break;
      }

      case 'stocks': {
        const input: StocksValuationInput = {
          tradeId,
          accountId,
          asset,
          direction,
          size,
          entryPrice,
          quote,
          commissionPerShare: options.commissionPerShare ?? 0.005,
          borrowRate: options.borrowRate ?? 0,
          daysHeld: options.daysHeld ?? 1,
        };
        valuation = valueStocksPosition(input);
        break;
      }

      case 'spot': {
        const input: SpotValuationInput = {
          tradeId,
          accountId,
          asset,
          direction,
          size,
          entryPrice,
          quote,
          marginMode: options.marginMode ?? (account?.type === 'Exchange' ? 'cash' : undefined),
          borrowCapacityAvailable: options.borrowCapacityAvailable,
          isMarginShortable: options.isMarginShortable,
          dailyBorrowRate: options.dailyBorrowRate,
          daysHeld: options.daysHeld,
          closingFeeRate: options.closingFeeRate,
        };
        valuation = valueSpotPosition(input);
        break;
      }

      case 'unknown':
      default: {
        return {
          tradeId,
          accountId,
          asset,
          direction,
          size,
          entryPrice,
          exitPrice: 0,
          status: 'unvaluable',
          isValuationAvailable: false,
          errorCode: 'UNSUPPORTED_ASSET_CLASS',
          reason: `Instrument ${asset} cannot be reliably classified into a supported financial model`,
          isStopLossConfigured: false,
          isStopCrossed: false,
          marketQuote: quote,
        };
      }
    }

    // Enrich position with Dynamic Open Risk metrics
    const effectiveSL = options.currentSL ?? trade.stopLoss;
    const originalSL = options.originalSL ?? (trade as unknown as { initialStopLoss?: number }).initialStopLoss ?? trade.stopLoss;

    // Use executable exit price (or entryPrice fallback if unvaluable)
    const exitPriceForRisk = valuation.exitPrice > 0 ? valuation.exitPrice : entryPrice;

    const riskResult = calculatePositionDynamicRisk({
      direction,
      entryPrice,
      exitPrice: exitPriceForRisk,
      size,
      multiplier: options.multiplier ?? 1,
      fxRate: options.quoteToAccountFxRate ?? options.usdToAccountFxRate ?? 1,
      originalSL: originalSL > 0 ? originalSL : undefined,
      currentSL: effectiveSL > 0 ? effectiveSL : undefined,
    });

    return {
      ...valuation,
      ...riskResult,
    };
  }

  /**
   * Values an entire trading account, aggregating floating PnL, Dynamic Open Risk,
   * Daily Loss intraday limits, and enforcing the Equity Integrity invariant.
   */
  public valueAccount(
    account: Account,
    openTrades: Trade[],
    options: ValuationAccountOptions = {}
  ): AccountValuationSnapshot {
    const quotes = options.quotes;
    const unvaluablePositions: string[] = [];
    const positions: FloatingPositionValuation[] = [];

    let totalFloatingPnL = 0;
    let hasSpikeQuote = false;
    let hasStaleQuote = false;
    let hasOfflineQuote = false;

    // 1. Value all open trades
    for (const trade of openTrades) {
      if (trade.status !== 'open') continue;

      const quote = this.resolveQuote(trade.asset, quotes);
      const tradeOpt = options.tradeOptions?.[trade.id] ?? {};

      const posValuation = this.valueTrade(trade, quote, account, tradeOpt);
      positions.push(posValuation);

      if (!posValuation.isValuationAvailable || posValuation.netFloatingPnL == null) {
        unvaluablePositions.push(trade.id);
      } else {
        totalFloatingPnL += posValuation.netFloatingPnL;
      }

      if (posValuation.isSpike) hasSpikeQuote = true;
      if (posValuation.isStale) hasStaleQuote = true;
      if (posValuation.isOffline) hasOfflineQuote = true;
    }

    // 2. Enforce Equity Integrity (Requisito 3.A)
    // An account's valuation is complete ONLY if 100% of open positions could be valued
    const isValuationComplete = unvaluablePositions.length === 0;

    // Reliable only if all quotes are fresh, non-stale, non-offline, and non-spike
    const isReliable =
      isValuationComplete && !hasSpikeQuote && !hasStaleQuote && !hasOfflineQuote;

    // Canonical equity: ledger balance + floating PnL of valuable positions
    const ledgerBalance = roundDecimal(account.balance, 2);
    const unrealizedPnL = roundDecimal(totalFloatingPnL, 2);
    const equity = roundDecimal(ledgerBalance + unrealizedPnL, 2);

    // Peak equity invariant: can only update if valuation is complete, reliable, and live
    const canUpdatePeakEquity = isValuationComplete && isReliable;
    const peakEquityCandidate = canUpdatePeakEquity ? Math.max(account.equity, equity) : undefined;

    // 3. Dynamic Open Risk Aggregation
    const dynamicOpenRisk = aggregateAccountRisk(positions);

    // 4. Closed PnL Today for Prop Firm Daily Loss
    let closedPnLToday = options.closedPnLToday ?? 0;
    if (options.closedTradesToday && options.closedTradesToday.length > 0) {
      closedPnLToday = roundDecimal(
        options.closedTradesToday.reduce((acc, t) => acc + (t.result ?? 0) - (t.commissions ?? 0), 0),
        2
      );
    }

    // 5. Daily Loss Snapshot
    const startOfDayBalance = options.startOfDayBalance ?? ledgerBalance;
    const startOfDayEquity = options.startOfDayEquity ?? ledgerBalance;
    const startOfDayOpenFloating = options.startOfDayOpenFloating ?? 0;

    // Daily loss limit in currency: from percentage of balance/equity or initialCapital
    const dailyLossLimitPercent = account.dailyLossLimit ?? 5;
    const dailyLossLimitAmount = roundDecimal((startOfDayBalance * dailyLossLimitPercent) / 100, 2);

    const dailyLossInput: DailyLossInput = {
      accountId: account.id,
      startOfDayBalance,
      startOfDayEquity,
      startOfDayOpenFloating,
      closedPnLToday,
      currentOpenFloating: unrealizedPnL,
      depositsToday: options.depositsToday ?? 0,
      withdrawalsToday: options.withdrawalsToday ?? 0,
      dailyLossLimitAmount,
      referenceDate: options.referenceDate,
      resetHour: options.resetHour ?? account.dailyResetHour ?? 17,
    };
    const dailyLoss = calculateDailyLoss(dailyLossInput);

    // 6. Margin Metrics (when verifiable data exists)
    const marginMetrics = this.computeMarginMetrics(account, positions, options.leverage);

    return {
      accountId: account.id,
      ledgerBalance,
      equity,
      unrealizedPnL,
      mode: openTrades.length > 0 && isValuationComplete ? 'realtime_feed' : 'manual_closed',
      isValuationComplete,
      unvaluablePositions,
      isReliable,
      canUpdatePeakEquity,
      peakEquityCandidate,
      dynamicOpenRisk,
      dailyLoss,
      marginMetrics,
      positions,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Reconciles estimated pre-close floating PnL against actual executed post-close trade.
   */
  public reconcileExecution(
    preCloseValuation: FloatingPositionValuation,
    executedTrade: Trade,
    actualFunding = 0
  ): ExecutionReconciliation {
    const tradeId = executedTrade.id;
    const direction = executedTrade.direction;
    const size = executedTrade.size;

    const actualExitPrice = executedTrade.exitPrice ?? preCloseValuation.exitPrice;
    const actualCommissions = executedTrade.commissions ?? 0;
    const actualRealizedNetPnL = roundDecimal((executedTrade.result ?? 0) - actualCommissions, 2);

    const estimatedNetFloatingPnL = preCloseValuation.netFloatingPnL ?? 0;
    const executionVariance = roundDecimal(actualRealizedNetPnL - estimatedNetFloatingPnL, 2);

    // Slippage variance: difference between expected exit price and actual execution price
    const estimatedExitPrice = preCloseValuation.exitPrice;
    const priceDiff = direction === 'long' ? actualExitPrice - estimatedExitPrice : estimatedExitPrice - actualExitPrice;
    const slippageVariance = roundDecimal(priceDiff * size, 2);

    // Commission variance: estimated vs actual
    const estimatedClosingFee = preCloseValuation.estimatedClosingFee ?? 0;
    const commissionVariance = roundDecimal(estimatedClosingFee - actualCommissions, 2);

    // Funding variance: estimated vs actual
    const estimatedFunding = preCloseValuation.accruedFunding ?? 0;
    const fundingVariance = roundDecimal(estimatedFunding - actualFunding, 2);

    return {
      tradeId,
      estimatedNetFloatingPnL,
      actualRealizedNetPnL,
      executionVariance,
      slippageVariance,
      commissionVariance,
      fundingVariance,
    };
  }

  // ---------------------------------------------------------------------------
  // Internal Helpers
  // ---------------------------------------------------------------------------

  private resolveQuote(
    asset: string,
    quotes?: Map<string, MarketPriceQuote> | Record<string, MarketPriceQuote>
  ): MarketPriceQuote | undefined {
    if (!quotes) return undefined;
    if (quotes instanceof Map) {
      return (
        quotes.get(asset) ??
        quotes.get(asset.replace('/', '')) ??
        quotes.get(asset.toUpperCase())
      );
    }
    return quotes[asset] ?? quotes[asset.replace('/', '')] ?? quotes[asset.toUpperCase()];
  }

  private inferInstrumentType(asset: string, quote?: MarketPriceQuote): string {
    return classifyInstrument(asset, quote);
  }

  private inferFuturesMultiplier(asset: string): number {
    return inferFuturesMultiplier(asset);
  }

  private computeMarginMetrics(
    account: Account,
    positions: FloatingPositionValuation[],
    explicitLeverage?: number
  ): MarginMetricsSnapshot | undefined {
    const leverage = explicitLeverage ?? account.leverage;
    if (!leverage || leverage <= 0) {
      return {
        isMarginEstimated: false,
        methodology: 'No leverage or margin requirements specified',
      };
    }

    let totalNotional = 0;
    for (const pos of positions) {
      if (pos.isValuationAvailable && pos.exitPrice > 0 && pos.size > 0) {
        totalNotional += pos.entryPrice * pos.size;
      }
    }

    const usedMargin = roundDecimal(totalNotional / leverage, 2);
    const freeMargin = roundDecimal(account.equity - usedMargin, 2);
    const marginLevelPercent = usedMargin > 0 ? roundDecimal((account.equity / usedMargin) * 100, 2) : undefined;

    return {
      usedMargin,
      freeMargin,
      marginLevelPercent,
      isMarginEstimated: true,
      methodology: `Linear initial margin approximation at 1:${leverage}`,
    };
  }
}
