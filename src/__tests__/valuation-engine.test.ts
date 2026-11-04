// =============================================================================
// TradeRisk Manager — Quantitative Valuation Engine Test Suite (Paso 8.2)
// =============================================================================

import { describe, it, expect } from 'vitest';
import type { Trade, Account } from '../lib/types';
import type { MarketPriceQuote } from '../lib/market-data/types';
import {
  MultiAssetValuationEngine,
  valueSpotPosition,
  valueUsdmPosition,
  valueCoinMPosition,
  valueForexPosition,
  valueFuturesPosition,
  valueStocksPosition,
  calculatePositionDynamicRisk,
  aggregateAccountRisk,
  calculateDailyLoss,
  verifyDailyLossConsistency,
  getNewYorkSessionStart,
  isSameNewYorkTradingSession,
} from '../lib/valuation';

// -----------------------------------------------------------------------------
// Test Helpers & Mock Fixtures
// -----------------------------------------------------------------------------

function createMockQuote(overrides: Partial<MarketPriceQuote> = {}): MarketPriceQuote {
  const bid = overrides.bid ?? 50000;
  const ask = overrides.ask ?? 50010;
  return {
    asset: 'BTC/USDT',
    rawSymbol: 'BTCUSDT',
    provider: 'binance_spot',
    contractType: 'spot',
    bid,
    ask,
    mid: (bid + ask) / 2,
    spread: ask - bid,
    updateId: 1000,
    localReceivedAt: Date.now(),
    monotonicReceivedAt: 1000,
    status: 'live',
    ...overrides,
  };
}

function createMockAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc_test_1',
    name: 'PropFirm Evaluation Account',
    type: 'PropFirm',
    initialCapital: 100000,
    balance: 100000,
    equity: 100000,
    currency: 'USD',
    profitTarget: 10,
    dailyLossLimit: 5,
    maxDrawdown: 10,
    drawdownType: 'trailing',
    timezone: 'America/New_York',
    dailyResetHour: 17,
    riskPerTrade: 1,
    leverage: 10,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function createMockTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: 'tr_test_1',
    accountId: 'acc_test_1',
    asset: 'BTC/USDT',
    direction: 'long',
    entryPrice: 50000,
    stopLoss: 49000,
    takeProfit: 53000,
    size: 1.0,
    openDate: '2026-11-01T10:00:00Z',
    status: 'open',
    commissions: 10,
    strategy: 'TrendBreakout',
    timeframe: '15m',
    notes: '',
    ...overrides,
  };
}

describe('Quantitative Valuation Engine — Paso 8.2', () => {
  const engine = new MultiAssetValuationEngine();

  // ===========================================================================
  // 1. Asset Classes & Calculators
  // ===========================================================================

  describe('1. Asset Class Calculators', () => {
    describe('A. Spot Calculator', () => {
      it('values Long Spot against Bid deducting closing fees', () => {
        const quote = createMockQuote({ bid: 52000, ask: 52020 });
        const res = valueSpotPosition({
          tradeId: 't1',
          accountId: 'a1',
          asset: 'BTC/USDT',
          direction: 'long',
          size: 2.0,
          entryPrice: 50000,
          quote,
          closingFeeRate: 0.001, // 0.1%
        });

        expect(res.isValuationAvailable).toBe(true);
        expect(res.exitPrice).toBe(52000); // Evaluated against Bid
        // Gross: (52000 - 50000) * 2 = 4000
        expect(res.grossPnL).toBe(4000);
        // Closing fee: 0.001 * 52000 * 2 = 104
        expect(res.estimatedClosingFee).toBe(104);
        expect(res.netFloatingPnL).toBe(3896);
        expect(res.status).toBe('active');
      });

      it('blocks Short Spot in cash account with INOPERABLE_SPOT_SHORT_CASH_ACCOUNT', () => {
        const quote = createMockQuote({ bid: 48000, ask: 48010 });
        const res = valueSpotPosition({
          tradeId: 't2',
          accountId: 'a1',
          asset: 'BTC/USDT',
          direction: 'short',
          size: 1.0,
          entryPrice: 50000,
          quote,
          marginMode: 'cash',
        });

        expect(res.isValuationAvailable).toBe(false);
        expect(res.status).toBe('inoperable');
        expect(res.errorCode).toBe('INOPERABLE_SPOT_SHORT_CASH_ACCOUNT');
        expect(res.netFloatingPnL).toBeUndefined(); // Zero fictitious PnL
      });

      it('blocks Short Spot when instrument is not approved for margin shorting', () => {
        const quote = createMockQuote({ bid: 48000, ask: 48010 });
        const res = valueSpotPosition({
          tradeId: 't3',
          accountId: 'a1',
          asset: 'SHIB/USDT',
          direction: 'short',
          size: 1000,
          entryPrice: 0.00002,
          quote,
          marginMode: 'cross',
          isMarginShortable: false,
        });

        expect(res.isValuationAvailable).toBe(false);
        expect(res.status).toBe('inoperable');
        expect(res.errorCode).toBe('INOPERABLE_SPOT_SHORT_INSTRUMENT_NOT_SHORTABLE');
      });

      it('blocks Short Spot when borrow capacity is insufficient', () => {
        const quote = createMockQuote({ bid: 48000, ask: 48010 });
        const res = valueSpotPosition({
          tradeId: 't4',
          accountId: 'a1',
          asset: 'BTC/USDT',
          direction: 'short',
          size: 5.0,
          entryPrice: 50000,
          quote,
          marginMode: 'isolated',
          isMarginShortable: true,
          borrowCapacityAvailable: 2.0, // only 2 BTC available, need 5
        });

        expect(res.isValuationAvailable).toBe(false);
        expect(res.status).toBe('inoperable');
        expect(res.errorCode).toBe('INOPERABLE_SPOT_SHORT_BORROW_CAPACITY_EXCEEDED');
      });

      it('blocks Short Spot when borrow rate is unavailable or invalid', () => {
        const quote = createMockQuote({ bid: 48000, ask: 48010 });
        const res = valueSpotPosition({
          tradeId: 't5',
          accountId: 'a1',
          asset: 'BTC/USDT',
          direction: 'short',
          size: 1.0,
          entryPrice: 50000,
          quote,
          marginMode: 'isolated',
          isMarginShortable: true,
          borrowCapacityAvailable: 10.0,
          dailyBorrowRate: undefined, // missing rate
        });

        expect(res.isValuationAvailable).toBe(false);
        expect(res.status).toBe('inoperable');
        expect(res.errorCode).toBe('INOPERABLE_SPOT_SHORT_BORROW_RATE_UNAVAILABLE');
      });

      it('values Short Spot correctly against Ask when all 3 borrow conditions are verified', () => {
        const quote = createMockQuote({ bid: 48000, ask: 48050 });
        const res = valueSpotPosition({
          tradeId: 't6',
          accountId: 'a1',
          asset: 'BTC/USDT',
          direction: 'short',
          size: 2.0,
          entryPrice: 50000,
          quote,
          marginMode: 'cross',
          isMarginShortable: true,
          borrowCapacityAvailable: 5.0,
          dailyBorrowRate: 0.0002, // 0.02% daily
          daysHeld: 3,
          closingFeeRate: 0.001,
        });

        expect(res.isValuationAvailable).toBe(true);
        expect(res.exitPrice).toBe(48050); // Evaluated against Ask
        // Gross: (50000 - 48050) * 2 = 3900
        expect(res.grossPnL).toBe(3900);
        // Borrowing costs: 0.0002 * 3 days * (50000 * 2) = 60
        expect(res.borrowingCosts).toBe(60);
        // Closing fee: 0.001 * 48050 * 2 = 96.10
        expect(res.estimatedClosingFee).toBe(96.1);
        // Total exit costs: 96.10 + 60 = 156.10
        expect(res.estimatedExitCosts).toBe(156.1);
        // Net: 3900 - 156.10 = 3743.90
        expect(res.netFloatingPnL).toBe(3743.9);
      });
    });

    describe('B. USD-M Linear Perpetuals', () => {
      it('values Long and Short USD-M perpetuals with funding and taker fees', () => {
        const quote = createMockQuote({ bid: 60000, ask: 60010 });

        // Long
        const longRes = valueUsdmPosition({
          tradeId: 'u1',
          accountId: 'a1',
          asset: 'BTC/USDT:PERP',
          direction: 'long',
          size: 1.5,
          entryPrice: 58000,
          quote,
          accruedFunding: 15,
          closingFeeRate: 0.0005, // 0.05%
        });

        expect(longRes.exitPrice).toBe(60000);
        // Gross: (60000 - 58000) * 1.5 = 3000
        expect(longRes.grossPnL).toBe(3000);
        // Fee: 0.0005 * 60000 * 1.5 = 45
        expect(longRes.estimatedClosingFee).toBe(45);
        // Exit costs: 45 + 15 = 60
        expect(longRes.estimatedExitCosts).toBe(60);
        // Net: 3000 - 60 = 2940
        expect(longRes.netFloatingPnL).toBe(2940);

        // Short
        const shortRes = valueUsdmPosition({
          tradeId: 'u2',
          accountId: 'a1',
          asset: 'BTC/USDT:PERP',
          direction: 'short',
          size: 1.5,
          entryPrice: 62000,
          quote,
          accruedFunding: 10,
          closingFeeRate: 0.0005,
        });

        expect(shortRes.exitPrice).toBe(60010);
        // Gross: (62000 - 60010) * 1.5 = 2985
        expect(shortRes.grossPnL).toBe(2985);
        // Fee: 0.0005 * 60010 * 1.5 = 45.01
        expect(shortRes.estimatedClosingFee).toBe(45.01);
        // Net: 2985 - 55.01 = 2929.99
        expect(shortRes.netFloatingPnL).toBe(2929.99);
      });
    });

    describe('C. Coin-M Inverse Perpetuals/Futures', () => {
      it('calculates asymmetric inverse PnL in BTC base and converts to USD and EUR', () => {
        // BTCUSD_PERP: 100 contracts of nominal $100 = $10,000 nominal
        const quote = createMockQuote({ bid: 40000, ask: 40010 });

        // Long entered at $20,000, currently Bid $40,000 (+100% in price)
        const longRes = valueCoinMPosition({
          tradeId: 'c1',
          accountId: 'a1',
          asset: 'BTCUSD_PERP',
          direction: 'long',
          size: 100, // 100 contracts
          contractSizeUSD: 100, // $100 per contract
          entryPrice: 20000,
          quote,
          closingFeeRate: 0.0005,
          accountCurrency: 'USD',
        });

        expect(longRes.exitPrice).toBe(40000);
        // GrossBase = (1/20000 - 1/40000) * 10000 = 0.25 BTC
        // NetBase after 0.05% closing fee (0.000125 BTC) = 0.249875 BTC
        expect(longRes.pnlBaseCurrency).toBe(0.249875);
        // In USD: 0.25 BTC * 40000 = $10,000 (gain of 100% on $10,000 nominal)
        expect(longRes.grossPnL).toBe(10000);

        // If converted to EUR (assume EUR/USD = 1.087 => usdToAccountFxRate = 0.92)
        const eurRes = valueCoinMPosition({
          tradeId: 'c2',
          accountId: 'a1',
          asset: 'BTCUSD_PERP',
          direction: 'long',
          size: 100,
          contractSizeUSD: 100,
          entryPrice: 20000,
          quote,
          closingFeeRate: 0.0005,
          accountCurrency: 'EUR',
          usdToAccountFxRate: 0.92,
        });

        expect(eurRes.pnlBaseCurrency).toBe(0.249875);
        expect(eurRes.pnlAccountCurrency).toBe(9195.4); // 9995 * 0.92 after fees
      });

      it('models the non-linear curvature for Short Coin-M', () => {
        // Short entered at $40,000, currently Ask $20,000 (price halved)
        const quote = createMockQuote({ bid: 19990, ask: 20000 });
        const shortRes = valueCoinMPosition({
          tradeId: 'c3',
          accountId: 'a1',
          asset: 'BTCUSD_PERP',
          direction: 'short',
          size: 100, // $10,000 nominal
          contractSizeUSD: 100,
          entryPrice: 40000,
          quote,
          closingFeeRate: 0,
        });

        // GrossBase = (1/20000 - 1/40000) * 10000 = 0.25 BTC
        expect(shortRes.pnlBaseCurrency).toBe(0.25);
        // In USD: 0.25 BTC * 20000 = $5,000 (reflects inverse non-linear asymmetry!)
        expect(shortRes.grossPnL).toBe(5000);
      });
    });

    describe('D. Forex Calculator', () => {
      it('values standard Forex pairs with pip values and conversions', () => {
        const quote = createMockQuote({ bid: 1.085, ask: 1.0852 });
        const res = valueForexPosition({
          tradeId: 'f1',
          accountId: 'a1',
          asset: 'EUR/USD',
          direction: 'long',
          size: 2.0, // 2 standard lots
          entryPrice: 1.08,
          quote,
          pipSize: 0.0001,
          pipValueInQuote: 10,
          quoteToAccountFxRate: 1.0, // USD account
          closingCommission: 14,
        });

        // Pips: (1.0850 - 1.0800) / 0.0001 = 50 pips
        // Gross: 50 * $10 * 2 = $1,000
        expect(res.grossPnL).toBe(1000);
        expect(res.netFloatingPnL).toBe(986); // 1000 - 14 commission
      });
    });

    describe('E. Traditional Futures Calculator', () => {
      it('values CME E-mini S&P 500 (ES) with multiplier 50 and clearing commissions', () => {
        const quote = createMockQuote({ bid: 5020.25, ask: 5020.5 });
        const res = valueFuturesPosition({
          tradeId: 'fut1',
          accountId: 'a1',
          asset: 'ES',
          direction: 'long',
          size: 3, // 3 contracts
          entryPrice: 5000.0,
          quote,
          multiplier: 50,
          commissionPerContract: 2.05,
        });

        // Points: 5020.25 - 5000.00 = 20.25 points
        // Gross: 20.25 * 50 * 3 = $3,037.50
        expect(res.grossPnL).toBe(3037.5);
        // Commission: 2.05 * 3 = $6.15
        expect(res.estimatedExitCosts).toBe(6.15);
        expect(res.netFloatingPnL).toBe(3031.35);
      });
    });

    describe('F. Stocks & CFDs Calculator', () => {
      it('values equity shares with per-share commission and borrow costs', () => {
        const quote = createMockQuote({ bid: 150.0, ask: 150.1 });
        const res = valueStocksPosition({
          tradeId: 'stk1',
          accountId: 'a1',
          asset: 'AAPL',
          direction: 'short',
          size: 100, // 100 shares
          entryPrice: 160.0,
          quote,
          commissionPerShare: 0.005,
          borrowRate: 0.0001,
          daysHeld: 5,
        });

        // Gross: (160 - 150.10) * 100 = 990
        expect(res.grossPnL).toBe(990);
        // Comm: 0.005 * 100 = 0.50
        // Borrow: 0.0001 * 5 * (160 * 100) = 8.00
        expect(res.estimatedExitCosts).toBe(8.5);
        expect(res.netFloatingPnL).toBe(981.5);
      });
    });
  });

  // ===========================================================================
  // 2. Dynamic Open Risk
  // ===========================================================================

  describe('2. Dynamic Open Risk (SL Original vs Vigente, BE y Stop Cruzado)', () => {
    it('computes InitialCapitalRisk at original SL and CapitalRiskAtSL at current SL', () => {
      // Long entry 50,000, original SL 48,000, trailed SL to 49,000, current Bid 51,000
      const res = calculatePositionDynamicRisk({
        direction: 'long',
        entryPrice: 50000,
        exitPrice: 51000, // Bid
        size: 2.0,
        originalSL: 48000,
        currentSL: 49000,
      });

      // Initial risk: (50000 - 48000) * 2 = 4000
      expect(res.initialCapitalRisk).toBe(4000);
      // Current risk: (50000 - 49000) * 2 = 2000
      expect(res.capitalRiskAtSL).toBe(2000);
      // Mark to stop: (51000 - 49000) * 2 = 4000
      expect(res.markToStopDistance).toBe(4000);
      expect(res.isStopCrossed).toBe(false);
      expect(res.isStopLossConfigured).toBe(true);
    });

    it('sets CapitalRiskAtSL to EXACTLY 0.00 when SL protects capital (Break-Even or Profit)', () => {
      // Long with SL trailed into profit at 50,500 (above entry 50,000)
      const longInProfit = calculatePositionDynamicRisk({
        direction: 'long',
        entryPrice: 50000,
        exitPrice: 52000,
        size: 1.0,
        originalSL: 49000,
        currentSL: 50500, // in profit
      });

      expect(longInProfit.capitalRiskAtSL).toBe(0.0);
      // Mark to stop measures give-back of profit: (52000 - 50500) * 1 = 1500
      expect(longInProfit.markToStopDistance).toBe(1500);

      // Short with SL trailed into profit at 49,500 (below entry 50,000)
      const shortInProfit = calculatePositionDynamicRisk({
        direction: 'short',
        entryPrice: 50000,
        exitPrice: 48000, // Ask
        size: 1.0,
        originalSL: 51000,
        currentSL: 49500, // in profit
      });

      expect(shortInProfit.capitalRiskAtSL).toBe(0.0);
      expect(shortInProfit.markToStopDistance).toBe(1500);
    });

    it('sets both CapitalRiskAtSL and MarkToStopDistance to 0.00 when market price crosses SL', () => {
      // Long entry 50,000, SL 49,000, market Bid crashed to 48,500
      const longCrossed = calculatePositionDynamicRisk({
        direction: 'long',
        entryPrice: 50000,
        exitPrice: 48500, // below SL!
        size: 1.0,
        currentSL: 49000,
      });

      expect(longCrossed.isStopCrossed).toBe(true);
      expect(longCrossed.capitalRiskAtSL).toBe(0.0);
      expect(longCrossed.markToStopDistance).toBe(0.0);

      // Short entry 50,000, SL 51,000, market Ask spiked to 51,200
      const shortCrossed = calculatePositionDynamicRisk({
        direction: 'short',
        entryPrice: 50000,
        exitPrice: 51200, // above SL!
        size: 1.0,
        currentSL: 51000,
      });

      expect(shortCrossed.isStopCrossed).toBe(true);
      expect(shortCrossed.capitalRiskAtSL).toBe(0.0);
      expect(shortCrossed.markToStopDistance).toBe(0.0);
    });

    it('flags unmitigated risk when position has no Stop Loss configured', () => {
      const noSL = calculatePositionDynamicRisk({
        direction: 'long',
        entryPrice: 50000,
        exitPrice: 51000,
        size: 1.0,
        currentSL: undefined,
      });

      expect(noSL.isStopLossConfigured).toBe(false);
      expect(noSL.capitalRiskAtSL).toBeUndefined();
      expect(noSL.markToStopDistance).toBeUndefined();

      const agg = aggregateAccountRisk([
        {
          tradeId: 't1',
          accountId: 'a1',
          asset: 'BTC/USDT',
          direction: 'long',
          size: 1,
          entryPrice: 50000,
          exitPrice: 51000,
          status: 'active',
          isValuationAvailable: true,
          isStopLossConfigured: false,
          isStopCrossed: false,
        },
      ]);
      expect(agg.unboundedRiskCount).toBe(1);
    });
  });

  // ===========================================================================
  // 3. Prop Firm Daily Loss & America/New_York Reset
  // ===========================================================================

  describe('3. Prop Firm Daily Loss & America/New_York Timezone', () => {
    it('correctly identifies the 17:00 America/New_York session start in summer and winter', () => {
      // Summer (EDT UTC-4): 17:00 EDT = 21:00 UTC
      const summerNow = new Date('2026-07-15T14:00:00Z'); // 10:00 EDT (session started yesterday at 17:00 EDT = 21:00 UTC)
      const summerReset = getNewYorkSessionStart(summerNow, 17);
      expect(summerReset.toISOString()).toBe('2026-07-14T21:00:00.000Z');

      // Winter (EST UTC-5): 17:00 EST = 22:00 UTC
      const winterNow = new Date('2026-01-15T14:00:00Z'); // 09:00 EST (session started yesterday at 17:00 EST = 22:00 UTC)
      const winterReset = getNewYorkSessionStart(winterNow, 17);
      expect(winterReset.toISOString()).toBe('2026-01-14T22:00:00.000Z');

      // Detects same trading session
      expect(isSameNewYorkTradingSession('2026-07-15T10:00:00Z', '2026-07-15T14:00:00Z')).toBe(true);
    });

    it('Scenario 4.a: Isolates prior-day floating losses from today Daily Loss quota', () => {
      // Position had -$500 floating loss at 17:00 reset
      // Current floating drops to -$700 (deteriorates by -$200 today)
      const snapshot = calculateDailyLoss({
        accountId: 'acc1',
        startOfDayBalance: 100000,
        startOfDayEquity: 99500,
        startOfDayOpenFloating: -500,
        closedPnLToday: 0,
        currentOpenFloating: -700,
        dailyLossLimitAmount: 5000,
      });

      expect(snapshot.deltaOpenFloatingToday).toBe(-200);
      expect(snapshot.dailyNetPerformance).toBe(-200);
      expect(snapshot.dailyLossTotal).toBe(200); // Strictly $200 today, NOT $700!
      expect(snapshot.remainingDailyLoss).toBe(4800);
      expect(snapshot.isBreached).toBe(false);

      const check = verifyDailyLossConsistency(99300, snapshot);
      expect(check.isConsistent).toBe(true);
    });

    it('Scenario 4.b: Handles intraday recovery of prior losses without false penalties', () => {
      // Position had -$500 floating at reset, improves to -$100 today
      const snapshot = calculateDailyLoss({
        accountId: 'acc1',
        startOfDayBalance: 100000,
        startOfDayEquity: 99500,
        startOfDayOpenFloating: -500,
        closedPnLToday: 0,
        currentOpenFloating: -100,
        dailyLossLimitAmount: 5000,
      });

      expect(snapshot.deltaOpenFloatingToday).toBe(400); // Gained +$400 today
      expect(snapshot.dailyNetPerformance).toBe(400);
      expect(snapshot.dailyLossTotal).toBe(0); // $0 daily loss!
      expect(snapshot.remainingDailyLoss).toBe(5000); // 100% budget available
      expect(snapshot.isBreached).toBe(false);

      const check = verifyDailyLossConsistency(99900, snapshot);
      expect(check.isConsistent).toBe(true);
    });

    it('Scenario 4.c: Zero double-counting when closing a position that carried prior floating loss', () => {
      // Position with -$500 floating at reset is closed at 11:00 AM with -$600 realized loss
      // At closure: closedPnLToday = -600, currentOpenFloating drops to 0
      const snapshot = calculateDailyLoss({
        accountId: 'acc1',
        startOfDayBalance: 100000,
        startOfDayEquity: 99500,
        startOfDayOpenFloating: -500,
        closedPnLToday: -600,
        currentOpenFloating: 0, // closed!
        dailyLossLimitAmount: 5000,
      });

      // deltaOpenFloating = 0 - (-500) = +500 (released from open floating)
      expect(snapshot.deltaOpenFloatingToday).toBe(500);
      // dailyNetPerformance = -600 (closed) + 500 (released floating) = -100
      expect(snapshot.dailyNetPerformance).toBe(-100);
      // Daily loss charged to today is strictly the $100 extra deterioration!
      expect(snapshot.dailyLossTotal).toBe(100);
      expect(snapshot.remainingDailyLoss).toBe(4900);

      // Verifies equity: 100,000 - 600 = 99,400. Start was 99,500. Difference = -100!
      const check = verifyDailyLossConsistency(99400, snapshot);
      expect(check.isConsistent).toBe(true);
    });

    it('Scenario 4.d: Neutralizes cash deposits and withdrawals from operational performance', () => {
      // User deposits $5,000 intraday
      const depositSnapshot = calculateDailyLoss({
        accountId: 'acc1',
        startOfDayBalance: 100000,
        startOfDayEquity: 100000,
        startOfDayOpenFloating: 0,
        closedPnLToday: -1000, // Realized $1,000 loss
        currentOpenFloating: 0,
        depositsToday: 5000,
        withdrawalsToday: 0,
        dailyLossLimitAmount: 5000,
      });

      expect(depositSnapshot.dailyNetPerformance).toBe(-1000);
      expect(depositSnapshot.dailyLossTotal).toBe(1000); // Still records $1,000 trading loss!
      expect(depositSnapshot.netCashFlowsToday).toBe(5000);

      // Equity is 100,000 - 1,000 + 5,000 = 104,000
      // Equity delta = 104,000 - 100,000 = +4,000. Expected = 4,000 - 5,000 (deposit) = -1,000
      const checkDeposit = verifyDailyLossConsistency(104000, depositSnapshot);
      expect(checkDeposit.isConsistent).toBe(true);

      // User withdraws $2,000 intraday
      const withdrawSnapshot = calculateDailyLoss({
        accountId: 'acc1',
        startOfDayBalance: 100000,
        startOfDayEquity: 100000,
        startOfDayOpenFloating: 0,
        closedPnLToday: 0,
        currentOpenFloating: 0,
        depositsToday: 0,
        withdrawalsToday: 2000,
        dailyLossLimitAmount: 5000,
      });

      expect(withdrawSnapshot.dailyNetPerformance).toBe(0);
      expect(withdrawSnapshot.dailyLossTotal).toBe(0); // Withdrawal is NOT a trading loss!
      // Equity is 98,000. Delta = -2,000. Expected = -2,000 - (-2,000) = 0
      const checkWithdraw = verifyDailyLossConsistency(98000, withdrawSnapshot);
      expect(checkWithdraw.isConsistent).toBe(true);
    });
  });

  // ===========================================================================
  // 4. Equity Integrity Invariant (Requisito 3.A)
  // ===========================================================================

  describe('4. Equity Integrity Invariant (Requisito 3.A)', () => {
    it('marks snapshot incomplete and blocks Peak Equity update if any open position cannot be valued', () => {
      const account = createMockAccount({ balance: 100000, equity: 100000 });
      const trade1 = createMockTrade({ id: 't1', asset: 'BTC/USDT' });
      const trade2 = createMockTrade({ id: 't2', asset: 'UNKNOWN/COIN' }); // Missing quote!

      const quotes = new Map<string, MarketPriceQuote>([
        ['BTC/USDT', createMockQuote({ bid: 51000, ask: 51010 })],
      ]);

      const snapshot = engine.valueAccount(account, [trade1, trade2], { quotes });

      // Equity Integrity invariant triggered
      expect(snapshot.isValuationComplete).toBe(false);
      expect(snapshot.unvaluablePositions).toContain('t2');
      expect(snapshot.isReliable).toBe(false);
      expect(snapshot.canUpdatePeakEquity).toBe(false);
      expect(snapshot.peakEquityCandidate).toBeUndefined(); // NEVER update peak equity on incomplete valuation!
    });

    it('freezes Peak Equity update when a feed quote is flagged as spike, stale, or offline', () => {
      const account = createMockAccount({ balance: 100000, equity: 100000 });
      const trade = createMockTrade({ id: 't1', asset: 'BTC/USDT' });

      // Spike quote
      const spikeQuotes = new Map([
        ['BTC/USDT', createMockQuote({ bid: 75000, ask: 75010, isSpike: true })],
      ]);
      const spikeSnap = engine.valueAccount(account, [trade], { quotes: spikeQuotes });
      expect(spikeSnap.isReliable).toBe(false);
      expect(spikeSnap.canUpdatePeakEquity).toBe(false);

      // Stale quote
      const staleQuotes = new Map([
        ['BTC/USDT', createMockQuote({ bid: 51000, ask: 51010, status: 'stale' })],
      ]);
      const staleSnap = engine.valueAccount(account, [trade], { quotes: staleQuotes });
      expect(staleSnap.isReliable).toBe(false);
      expect(staleSnap.canUpdatePeakEquity).toBe(false);

      // Offline quote
      const offlineQuotes = new Map([
        ['BTC/USDT', createMockQuote({ bid: 51000, ask: 51010, status: 'offline' })],
      ]);
      const offlineSnap = engine.valueAccount(account, [trade], { quotes: offlineQuotes });
      expect(offlineSnap.isReliable).toBe(false);
      expect(offlineSnap.canUpdatePeakEquity).toBe(false);
    });

    it('authorizes Peak Equity candidate when 100% of open positions have fresh, reliable quotes and verified HWM', () => {
      const account = createMockAccount({ balance: 100000, equity: 100000, initialCapital: 100000 });
      const trade = createMockTrade({ id: 't1', asset: 'BTC/USDT', size: 1.0, entryPrice: 50000 });

      const liveQuotes = new Map([
        ['BTC/USDT', createMockQuote({ bid: 55000, ask: 55010, status: 'live' })],
      ]);

      const snapshot = engine.valueAccount(account, [trade], {
        quotes: liveQuotes,
        historicalHwm: {
          value: 100000,
          isProvenanceVerified: true,
          source: 'audit_ledger_reconstruction',
        },
      });

      expect(snapshot.isValuationComplete).toBe(true);
      expect(snapshot.isReliable).toBe(true);
      expect(snapshot.hwmIntegrityStatus).toBe('VERIFIED');
      expect(snapshot.canUpdatePeakEquity).toBe(true);
      // Balance 100,000 + Floating (55000 - 50000 - 55 fee) = 104,945
      expect(snapshot.equity).toBe(104945);
      expect(snapshot.peakEquityCandidate).toBe(104945);
    });
  });

  // ===========================================================================
  // 5. Accounting Reconciliation & Execution Variance
  // ===========================================================================

  describe('5. Accounting Reconciliation & Execution Variance', () => {
    it('verifies Equity_pre == Balance_post under perfect execution', () => {
      const preCloseVal: import('../lib/valuation').FloatingPositionValuation = {
        tradeId: 't1',
        accountId: 'a1',
        asset: 'BTC/USDT',
        direction: 'long',
        size: 1.0,
        entryPrice: 50000,
        exitPrice: 52000,
        status: 'active',
        isValuationAvailable: true,
        isStopLossConfigured: true,
        isStopCrossed: false,
        grossPnL: 2000,
        estimatedClosingFee: 52,
        estimatedExitCosts: 52,
        netFloatingPnL: 1948,
      };

      const executedTrade: Trade = {
        ...createMockTrade({ id: 't1', entryPrice: 50000, size: 1.0 }),
        exitPrice: 52000, // Identical exit
        result: 2000, // Identical gross
        commissions: 52, // Identical fee
        status: 'closed',
      };

      const reconciliation = engine.reconcileExecution(preCloseVal, executedTrade);

      expect(reconciliation.executionVariance).toBe(0.0);
      expect(reconciliation.slippageVariance).toBe(0.0);
      expect(reconciliation.commissionVariance).toBe(0.0);
    });

    it('accurately decomposes slippage and commission variance when execution diverges', () => {
      const preCloseVal: import('../lib/valuation').FloatingPositionValuation = {
        tradeId: 't1',
        accountId: 'a1',
        asset: 'BTC/USDT',
        direction: 'long',
        size: 2.0,
        entryPrice: 50000,
        exitPrice: 52000,
        status: 'active',
        isValuationAvailable: true,
        isStopLossConfigured: true,
        isStopCrossed: false,
        netFloatingPnL: 3896,
        estimatedClosingFee: 104,
      };

      const executedTrade: Trade = {
        ...createMockTrade({ id: 't1', entryPrice: 50000, size: 2.0 }),
        exitPrice: 51900, // Slipped by $100 against trader
        result: 3800, // (51900 - 50000) * 2 = 3800
        commissions: 120, // Broker charged $120 instead of $104
        status: 'closed',
      };

      const rec = engine.reconcileExecution(preCloseVal, executedTrade);

      // Actual realized net = 3800 - 120 = 3680
      // Estimated net = 3896
      // Total variance = 3680 - 3896 = -216
      expect(rec.actualRealizedNetPnL).toBe(3680);
      expect(rec.executionVariance).toBe(-216);
      // Slippage variance: (51900 - 52000) * 2 = -200
      expect(rec.slippageVariance).toBe(-200);
      // Commission variance: 104 - 120 = -16
      expect(rec.commissionVariance).toBe(-16);
      // Total: -200 + -16 = -216
      expect(rec.slippageVariance + rec.commissionVariance).toBe(rec.executionVariance);
    });
  });

  // ===========================================================================
  // 6. Backward Compatibility & Offline Fallback
  // ===========================================================================

  describe('6. Backward Compatibility & Offline-First Invariants', () => {
    it('defaults to manual_closed mode with Equity == Balance when no positions are open', () => {
      const account = createMockAccount({ balance: 50000, equity: 50000 });
      const snapshot = engine.valueAccount(account, []);

      expect(snapshot.mode).toBe('manual_closed');
      expect(snapshot.equity).toBe(50000);
      expect(snapshot.unrealizedPnL).toBe(0);
      expect(snapshot.isValuationComplete).toBe(true);
      expect(snapshot.isReliable).toBe(true);
    });

    it('preserves existing trade interfaces without requiring new mandatory fields', () => {
      // Trade object created with only Phase 1 fields
      const legacyTrade: Trade = {
        id: 'legacy_1',
        accountId: 'acc_1',
        asset: 'BTC/USDT',
        direction: 'long',
        entryPrice: 40000,
        stopLoss: 38000,
        takeProfit: 45000,
        size: 0.5,
        openDate: '2025-06-01T00:00:00Z',
        status: 'open',
        commissions: 5,
        strategy: 'Legacy',
        timeframe: '1d',
        notes: '',
      };

      const quote = createMockQuote({ bid: 42000, ask: 42010 });
      const posVal = engine.valueTrade(legacyTrade, quote);

      expect(posVal.isValuationAvailable).toBe(true);
      expect(posVal.initialCapitalRisk).toBe(1000); // (40000 - 38000) * 0.5
      expect(posVal.capitalRiskAtSL).toBe(1000);
    });
  });
});
