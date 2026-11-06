// =============================================================================
// TradeRisk Manager — Test Suite: Equity & High-Water Mark Integrity (Bloque B1)
// =============================================================================

import { describe, it, expect } from 'vitest';
import type { Trade, Account } from '../lib/types';
import type { MarketPriceQuote, FeedStatus } from '../lib/market-data/types';
import {
  MultiAssetValuationEngine,
  valueSpotPosition,
  valueUsdmPosition,
  valueCoinMPosition,
  valueForexPosition,
  valueFuturesPosition,
  valueStocksPosition,
} from '../lib/valuation';

function createMockAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc_test_b1',
    name: 'Account B1 Integrity',
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
    leverage: 100,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function createMockTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: 'trade_b1_1',
    accountId: 'acc_test_b1',
    asset: 'BTC/USDT',
    direction: 'long',
    entryPrice: 50000,
    stopLoss: 48000,
    takeProfit: 55000,
    size: 1,
    commissions: 0,
    openDate: '2026-11-04T00:00:00Z',
    status: 'open',
    strategy: 'Trend',
    timeframe: '4h',
    notes: 'B1 Test',
    ...overrides,
  };
}

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

describe('Fase 8.2.1 — Bloque B1: Integridad de Equity y High-Water Mark (H1)', () => {
  const engine = new MultiAssetValuationEngine();

  // ===========================================================================
  // 1. Procedencia Histórica de HWM vs Validez Numérica (8 pruebas)
  // ===========================================================================

  describe('1. Procedencia Histórica de HWM vs Validez Numérica', () => {
    it('1.1 autoriza HWM cuando la procedencia está verificada (audit_ledger_reconstruction) y equity > HWM', () => {
      const account = createMockAccount({ balance: 100000, equity: 100000, initialCapital: 100000 });
      const trade = createMockTrade({ size: 1.0, entryPrice: 50000 });
      const quotes = new Map([
        ['BTC/USDT', createMockQuote({ bid: 55000, ask: 55010, status: 'live' })],
      ]);

      const snapshot = engine.valueAccount(account, [trade], {
        quotes,
        historicalHwm: {
          value: 100000,
          isProvenanceVerified: true,
          source: 'audit_ledger_reconstruction',
        },
      });

      expect(snapshot.hwmIntegrityStatus).toBe('VERIFIED');
      expect(snapshot.canUpdatePeakEquity).toBe(true);
      // Equity = 100000 + (55000 - 50000 - 55 fee) = 104945 > 100000
      expect(snapshot.peakEquityCandidate).toBe(104945);
    });

    it('1.2 conserva el pico histórico cuando equity < HWM con procedencia verificada (daily_snapshot)', () => {
      const account = createMockAccount({ balance: 100000, equity: 100000, initialCapital: 100000 });
      const trade = createMockTrade({ size: 1.0, entryPrice: 50000 });
      const quotes = new Map([
        ['BTC/USDT', createMockQuote({ bid: 49000, ask: 49010, status: 'live' })],
      ]);

      const snapshot = engine.valueAccount(account, [trade], {
        quotes,
        historicalHwm: {
          value: 110000,
          isProvenanceVerified: true,
          source: 'daily_snapshot',
        },
      });

      expect(snapshot.hwmIntegrityStatus).toBe('VERIFIED');
      expect(snapshot.canUpdatePeakEquity).toBe(true);
      // Equity = 100000 + (49000 - 50000 - 49 fee) = 98951 < 110000
      expect(snapshot.peakEquityCandidate).toBe(110000);
    });

    it('1.3 autoriza HWM verificado desde prop_firm_api cuando equity == HWM', () => {
      const account = createMockAccount({ balance: 100000, equity: 100000, initialCapital: 100000 });
      const snapshot = engine.valueAccount(account, [], {
        historicalHwm: {
          value: 100000,
          isProvenanceVerified: true,
          source: 'prop_firm_api',
        },
      });

      expect(snapshot.hwmIntegrityStatus).toBe('VERIFIED');
      expect(snapshot.canUpdatePeakEquity).toBe(true);
      expect(snapshot.peakEquityCandidate).toBe(100000);
    });

    it('1.4 bloquea HWM si la procedencia no está acreditada (isProvenanceVerified = false)', () => {
      const account = createMockAccount({ balance: 100000, equity: 100000, initialCapital: 100000 });
      const trade = createMockTrade({ size: 1.0, entryPrice: 50000 });
      const quotes = new Map([
        ['BTC/USDT', createMockQuote({ bid: 55000, ask: 55010, status: 'live' })],
      ]);

      const snapshot = engine.valueAccount(account, [trade], {
        quotes,
        historicalHwm: {
          value: 100000,
          isProvenanceVerified: false, // NOT verified!
          source: 'audit_ledger_reconstruction',
        },
      });

      expect(snapshot.hwmIntegrityStatus).toBe('UNVERIFIED_HISTORICAL_HWM');
      expect(snapshot.canUpdatePeakEquity).toBe(false);
      expect(snapshot.peakEquityCandidate).toBeUndefined();
    });

    it('1.5 bloquea HWM si la fuente es user_attested (auto-declaración sin auditoría)', () => {
      const account = createMockAccount({ balance: 100000, equity: 100000, initialCapital: 100000 });
      const trade = createMockTrade({ size: 1.0, entryPrice: 50000 });
      const quotes = new Map([
        ['BTC/USDT', createMockQuote({ bid: 55000, ask: 55010, status: 'live' })],
      ]);

      const snapshot = engine.valueAccount(account, [trade], {
        quotes,
        historicalHwm: {
          value: 120000,
          isProvenanceVerified: true,
          source: 'user_attested', // User manual attestation rejected!
        },
      });

      expect(snapshot.hwmIntegrityStatus).toBe('UNVERIFIED_HISTORICAL_HWM');
      expect(snapshot.canUpdatePeakEquity).toBe(false);
      expect(snapshot.peakEquityCandidate).toBeUndefined();
    });

    it('1.6 bloquea HWM si historicalHwm es omitido por el llamador', () => {
      const account = createMockAccount({ balance: 100000, equity: 100000, initialCapital: 100000 });
      const trade = createMockTrade({ size: 1.0, entryPrice: 50000 });
      const quotes = new Map([
        ['BTC/USDT', createMockQuote({ bid: 55000, ask: 55010, status: 'live' })],
      ]);

      const snapshot = engine.valueAccount(account, [trade], { quotes });

      expect(snapshot.hwmIntegrityStatus).toBe('UNVERIFIED_HISTORICAL_HWM');
      expect(snapshot.canUpdatePeakEquity).toBe(false);
      expect(snapshot.peakEquityCandidate).toBeUndefined();
    });

    it('1.7 bloquea HWM si el valor es inferior a initialCapital', () => {
      const account = createMockAccount({ balance: 100000, equity: 100000, initialCapital: 100000 });
      const trade = createMockTrade({ size: 1.0, entryPrice: 50000 });
      const quotes = new Map([
        ['BTC/USDT', createMockQuote({ bid: 55000, ask: 55010, status: 'live' })],
      ]);

      const snapshot = engine.valueAccount(account, [trade], {
        quotes,
        historicalHwm: {
          value: 90000, // Less than initialCapital (100,000)!
          isProvenanceVerified: true,
          source: 'audit_ledger_reconstruction',
        },
      });

      expect(snapshot.hwmIntegrityStatus).toBe('UNVERIFIED_HISTORICAL_HWM');
      expect(snapshot.canUpdatePeakEquity).toBe(false);
      expect(snapshot.peakEquityCandidate).toBeUndefined();
    });

    it('1.8 bloquea HWM si el valor numérico es NaN, Infinity o negativo', () => {
      const account = createMockAccount({ balance: 100000, equity: 100000, initialCapital: 100000 });
      const quotes = new Map([['BTC/USDT', createMockQuote()]] );

      const snapNaN = engine.valueAccount(account, [createMockTrade()], {
        quotes,
        historicalHwm: { value: NaN, isProvenanceVerified: true, source: 'audit_ledger_reconstruction' },
      });
      expect(snapNaN.canUpdatePeakEquity).toBe(false);
      expect(snapNaN.peakEquityCandidate).toBeUndefined();

      const snapInf = engine.valueAccount(account, [createMockTrade()], {
        quotes,
        historicalHwm: { value: Infinity, isProvenanceVerified: true, source: 'audit_ledger_reconstruction' },
      });
      expect(snapInf.canUpdatePeakEquity).toBe(false);
      expect(snapInf.peakEquityCandidate).toBeUndefined();

      const snapNeg = engine.valueAccount(account, [createMockTrade()], {
        quotes,
        historicalHwm: { value: -500, isProvenanceVerified: true, source: 'audit_ledger_reconstruction' },
      });
      expect(snapNeg.canUpdatePeakEquity).toBe(false);
      expect(snapNeg.peakEquityCandidate).toBeUndefined();
    });
  });

  // ===========================================================================
  // 2. Validación de initialCapital (3 pruebas)
  // ===========================================================================

  describe('2. Validación Previa de initialCapital', () => {
    it('2.1 bloquea HWM si account.initialCapital es NaN', () => {
      const account = createMockAccount({ initialCapital: NaN });
      const snapshot = engine.valueAccount(account, [], {
        historicalHwm: { value: 100000, isProvenanceVerified: true, source: 'audit_ledger_reconstruction' },
      });

      expect(snapshot.hwmIntegrityStatus).toBe('UNVERIFIED_HISTORICAL_HWM');
      expect(snapshot.canUpdatePeakEquity).toBe(false);
      expect(snapshot.peakEquityCandidate).toBeUndefined();
    });

    it('2.2 bloquea HWM si account.initialCapital es <= 0', () => {
      const accountZero = createMockAccount({ initialCapital: 0 });
      const snapZero = engine.valueAccount(accountZero, [], {
        historicalHwm: { value: 100000, isProvenanceVerified: true, source: 'audit_ledger_reconstruction' },
      });
      expect(snapZero.hwmIntegrityStatus).toBe('UNVERIFIED_HISTORICAL_HWM');
      expect(snapZero.canUpdatePeakEquity).toBe(false);

      const accountNeg = createMockAccount({ initialCapital: -5000 });
      const snapNeg = engine.valueAccount(accountNeg, [], {
        historicalHwm: { value: 100000, isProvenanceVerified: true, source: 'audit_ledger_reconstruction' },
      });
      expect(snapNeg.hwmIntegrityStatus).toBe('UNVERIFIED_HISTORICAL_HWM');
      expect(snapNeg.canUpdatePeakEquity).toBe(false);
    });

    it('2.3 bloquea HWM si account.initialCapital es Infinity', () => {
      const account = createMockAccount({ initialCapital: Infinity });
      const snapshot = engine.valueAccount(account, [], {
        historicalHwm: { value: 100000, isProvenanceVerified: true, source: 'audit_ledger_reconstruction' },
      });

      expect(snapshot.hwmIntegrityStatus).toBe('UNVERIFIED_HISTORICAL_HWM');
      expect(snapshot.canUpdatePeakEquity).toBe(false);
      expect(snapshot.peakEquityCandidate).toBeUndefined();
    });
  });

  // ===========================================================================
  // 3. Integridad de Equity con Posiciones Abiertas (4 pruebas)
  // ===========================================================================

  describe('3. Integridad de Equity con Posiciones Abiertas', () => {
    it('3.1 bloquea HWM si equity es NaN', () => {
      const account = createMockAccount({ balance: NaN });
      const trade = createMockTrade();
      const quotes = new Map([['BTC/USDT', createMockQuote()]]);

      const snapshot = engine.valueAccount(account, [trade], {
        quotes,
        historicalHwm: { value: 100000, isProvenanceVerified: true, source: 'audit_ledger_reconstruction' },
      });

      expect(snapshot.canUpdatePeakEquity).toBe(false);
      expect(snapshot.peakEquityCandidate).toBeUndefined();
    });

    it('3.2 bloquea HWM si equity es Infinity', () => {
      const account = createMockAccount({ balance: Infinity });
      const trade = createMockTrade();
      const quotes = new Map([['BTC/USDT', createMockQuote()]]);

      const snapshot = engine.valueAccount(account, [trade], {
        quotes,
        historicalHwm: { value: 100000, isProvenanceVerified: true, source: 'audit_ledger_reconstruction' },
      });

      expect(snapshot.canUpdatePeakEquity).toBe(false);
      expect(snapshot.peakEquityCandidate).toBeUndefined();
    });

    it('3.3 bloquea HWM si equity resultante es cero', () => {
      const account = createMockAccount({ balance: 50000 });
      // Huge loss that brings equity to exactly 0
      const trade = createMockTrade({ size: 1.0, entryPrice: 50000 });
      const quotes = new Map([['BTC/USDT', createMockQuote({ bid: 0.0001, ask: 0.0002 })]]);

      const snapshot = engine.valueAccount(account, [trade], {
        quotes,
        historicalHwm: { value: 100000, isProvenanceVerified: true, source: 'audit_ledger_reconstruction' },
      });

      expect(snapshot.canUpdatePeakEquity).toBe(false);
      expect(snapshot.peakEquityCandidate).toBeUndefined();
    });

    it('3.4 bloquea HWM si equity resultante es negativa (cuenta liquidada)', () => {
      const account = createMockAccount({ balance: 10000 });
      const trade = createMockTrade({ size: 1.0, entryPrice: 50000 });
      const quotes = new Map([['BTC/USDT', createMockQuote({ bid: 30000, ask: 30010 })]]);

      const snapshot = engine.valueAccount(account, [trade], {
        quotes,
        historicalHwm: { value: 100000, isProvenanceVerified: true, source: 'audit_ledger_reconstruction' },
      });

      // Equity is 10000 - 20000 = -10000
      expect(snapshot.equity).toBeLessThan(0);
      expect(snapshot.canUpdatePeakEquity).toBe(false);
      expect(snapshot.peakEquityCandidate).toBeUndefined();
    });
  });

  // ===========================================================================
  // 4. Integridad de Ledger Balance sin Posiciones Abiertas (5 pruebas)
  // ===========================================================================

  describe('4. Integridad de Ledger Balance sin Posiciones Abiertas', () => {
    it('4.1 bloquea HWM si ledgerBalance es NaN', () => {
      const account = createMockAccount({ balance: NaN });
      const snapshot = engine.valueAccount(account, [], {
        historicalHwm: { value: 100000, isProvenanceVerified: true, source: 'audit_ledger_reconstruction' },
      });

      expect(snapshot.isReliable).toBe(false);
      expect(snapshot.canUpdatePeakEquity).toBe(false);
      expect(snapshot.peakEquityCandidate).toBeUndefined();
    });

    it('4.2 bloquea HWM si ledgerBalance es Infinity', () => {
      const account = createMockAccount({ balance: Infinity });
      const snapshot = engine.valueAccount(account, [], {
        historicalHwm: { value: 100000, isProvenanceVerified: true, source: 'audit_ledger_reconstruction' },
      });

      expect(snapshot.isReliable).toBe(false);
      expect(snapshot.canUpdatePeakEquity).toBe(false);
      expect(snapshot.peakEquityCandidate).toBeUndefined();
    });

    it('4.3 bloquea HWM si ledgerBalance es cero', () => {
      const account = createMockAccount({ balance: 0 });
      const snapshot = engine.valueAccount(account, [], {
        historicalHwm: { value: 100000, isProvenanceVerified: true, source: 'audit_ledger_reconstruction' },
      });

      expect(snapshot.isReliable).toBe(false);
      expect(snapshot.canUpdatePeakEquity).toBe(false);
      expect(snapshot.peakEquityCandidate).toBeUndefined();
    });

    it('4.4 bloquea HWM si ledgerBalance es negativo', () => {
      const account = createMockAccount({ balance: -500 });
      const snapshot = engine.valueAccount(account, [], {
        historicalHwm: { value: 100000, isProvenanceVerified: true, source: 'audit_ledger_reconstruction' },
      });

      expect(snapshot.isReliable).toBe(false);
      expect(snapshot.canUpdatePeakEquity).toBe(false);
      expect(snapshot.peakEquityCandidate).toBeUndefined();
    });

    it('4.5 autoriza HWM si ledgerBalance es positivo y finito con HWM verificado', () => {
      const account = createMockAccount({ balance: 100000, initialCapital: 100000 });
      const snapshot = engine.valueAccount(account, [], {
        historicalHwm: { value: 100000, isProvenanceVerified: true, source: 'audit_ledger_reconstruction' },
      });

      expect(snapshot.isReliable).toBe(true);
      expect(snapshot.canUpdatePeakEquity).toBe(true);
      expect(snapshot.peakEquityCandidate).toBe(100000);
      expect(snapshot.mode).toBe('manual_closed');
    });
  });

  // ===========================================================================
  // 5. Cartera Multiactivo: Bloqueo de HWM ante Una Sola Posición Degradada (5 pruebas)
  // ===========================================================================

  describe('5. Cartera Multiactivo: Bloqueo de HWM ante Una Sola Posición Degradada', () => {
    const account = createMockAccount({ balance: 100000, initialCapital: 100000 });
    const verifiedHwm = { value: 100000, isProvenanceVerified: true, source: 'audit_ledger_reconstruction' as const };

    const trade1 = createMockTrade({ id: 't1', asset: 'BTC/USDT' });
    const trade2 = createMockTrade({ id: 't2', asset: 'ETH/USDT' });
    const trade3 = createMockTrade({ id: 't3', asset: 'SOL/USDT' });
    const trade4 = createMockTrade({ id: 't4', asset: 'ADA/USDT' });

    it('5.1 tres LIVE y una STALE bloquea el HWM de toda la cuenta y conmuta a manual_closed', () => {
      const quotes = new Map([
        ['BTC/USDT', createMockQuote({ asset: 'BTC/USDT', status: 'live' })],
        ['ETH/USDT', createMockQuote({ asset: 'ETH/USDT', status: 'live' })],
        ['SOL/USDT', createMockQuote({ asset: 'SOL/USDT', status: 'live' })],
        ['ADA/USDT', createMockQuote({ asset: 'ADA/USDT', status: 'stale' })], // DEGRADED!
      ]);

      const snapshot = engine.valueAccount(account, [trade1, trade2, trade3, trade4], { quotes, historicalHwm: verifiedHwm });

      expect(snapshot.hasStaleQuote).toBe(true);
      expect(snapshot.isReliable).toBe(false);
      expect(snapshot.canUpdatePeakEquity).toBe(false);
      expect(snapshot.peakEquityCandidate).toBeUndefined();
      expect(snapshot.mode).toBe('manual_closed');
    });

    it('5.2 tres LIVE y una MANUAL bloquea el HWM de toda la cuenta', () => {
      const quotes = new Map([
        ['BTC/USDT', createMockQuote({ asset: 'BTC/USDT', status: 'live' })],
        ['ETH/USDT', createMockQuote({ asset: 'ETH/USDT', status: 'live' })],
        ['SOL/USDT', createMockQuote({ asset: 'SOL/USDT', status: 'live' })],
        ['ADA/USDT', createMockQuote({ asset: 'ADA/USDT', status: 'manual' })], // MANUAL!
      ]);

      const snapshot = engine.valueAccount(account, [trade1, trade2, trade3, trade4], { quotes, historicalHwm: verifiedHwm });

      expect(snapshot.hasManualQuote).toBe(true);
      expect(snapshot.isReliable).toBe(false);
      expect(snapshot.canUpdatePeakEquity).toBe(false);
      expect(snapshot.peakEquityCandidate).toBeUndefined();
      expect(snapshot.mode).toBe('manual_closed');
    });

    it('5.3 tres LIVE y una OFFLINE bloquea el HWM de toda la cuenta', () => {
      const quotes = new Map([
        ['BTC/USDT', createMockQuote({ asset: 'BTC/USDT', status: 'live' })],
        ['ETH/USDT', createMockQuote({ asset: 'ETH/USDT', status: 'live' })],
        ['SOL/USDT', createMockQuote({ asset: 'SOL/USDT', status: 'live' })],
        ['ADA/USDT', createMockQuote({ asset: 'ADA/USDT', status: 'offline' })], // OFFLINE!
      ]);

      const snapshot = engine.valueAccount(account, [trade1, trade2, trade3, trade4], { quotes, historicalHwm: verifiedHwm });

      expect(snapshot.hasOfflineQuote).toBe(true);
      expect(snapshot.isReliable).toBe(false);
      expect(snapshot.canUpdatePeakEquity).toBe(false);
      expect(snapshot.peakEquityCandidate).toBeUndefined();
      expect(snapshot.mode).toBe('manual_closed');
    });

    it('5.4 tres LIVE y una SPIKE bloquea el HWM de toda la cuenta', () => {
      const quotes = new Map([
        ['BTC/USDT', createMockQuote({ asset: 'BTC/USDT', status: 'live' })],
        ['ETH/USDT', createMockQuote({ asset: 'ETH/USDT', status: 'live' })],
        ['SOL/USDT', createMockQuote({ asset: 'SOL/USDT', status: 'live' })],
        ['ADA/USDT', createMockQuote({ asset: 'ADA/USDT', status: 'live', isSpike: true })], // SPIKE!
      ]);

      const snapshot = engine.valueAccount(account, [trade1, trade2, trade3, trade4], { quotes, historicalHwm: verifiedHwm });

      expect(snapshot.hasSpikeQuote).toBe(true);
      expect(snapshot.isReliable).toBe(false);
      expect(snapshot.canUpdatePeakEquity).toBe(false);
      expect(snapshot.peakEquityCandidate).toBeUndefined();
      expect(snapshot.mode).toBe('manual_closed');
    });

    it('5.5 tres LIVE y una Sin Cotización (incompleta) bloquea el HWM de toda la cuenta', () => {
      const quotes = new Map([
        ['BTC/USDT', createMockQuote({ asset: 'BTC/USDT', status: 'live' })],
        ['ETH/USDT', createMockQuote({ asset: 'ETH/USDT', status: 'live' })],
        ['SOL/USDT', createMockQuote({ asset: 'SOL/USDT', status: 'live' })],
        // ADA/USDT is missing from quotes map!
      ]);

      const snapshot = engine.valueAccount(account, [trade1, trade2, trade3, trade4], { quotes, historicalHwm: verifiedHwm });

      expect(snapshot.isValuationComplete).toBe(false);
      expect(snapshot.unvaluablePositions).toContain('t4');
      expect(snapshot.isReliable).toBe(false);
      expect(snapshot.canUpdatePeakEquity).toBe(false);
      expect(snapshot.peakEquityCandidate).toBeUndefined();
      expect(snapshot.mode).toBe('manual_closed');
    });
  });

  // ===========================================================================
  // 6. Posición SPIKE en los Seis Calculadores (6 pruebas parametrizadas)
  // ===========================================================================

  describe('6. Posición SPIKE en los Seis Calculadores', () => {
    const spikeQuote = createMockQuote({ isSpike: true, status: 'live' });

    it.each([
      ['spot', () => valueSpotPosition({ tradeId: '1', accountId: 'a', asset: 'BTC/USDT', direction: 'long', size: 1, entryPrice: 50000, quote: spikeQuote })],
      ['usdm', () => valueUsdmPosition({ tradeId: '1', accountId: 'a', asset: 'BTCUSDT', direction: 'long', size: 1, entryPrice: 50000, quote: spikeQuote, multiplier: 1 })],
      ['coinm', () => valueCoinMPosition({ tradeId: '1', accountId: 'a', asset: 'BTCUSD_PERP', direction: 'long', size: 10, entryPrice: 50000, quote: spikeQuote })],
      ['forex', () => valueForexPosition({ tradeId: '1', accountId: 'a', asset: 'EUR/USD', direction: 'long', size: 1, entryPrice: 1.08, quote: spikeQuote })],
      ['futures', () => valueFuturesPosition({ tradeId: '1', accountId: 'a', asset: 'ES', direction: 'long', size: 1, entryPrice: 5000, quote: spikeQuote, multiplier: 50 })],
      ['stocks', () => valueStocksPosition({ tradeId: '1', accountId: 'a', asset: 'AAPL', direction: 'long', size: 10, entryPrice: 200, quote: spikeQuote })],
    ])('asigna status: spike y nunca active en calculador %s', (_name, runCalc) => {
      const result = runCalc();
      expect(result.status).toBe('spike');
      expect(result.status).not.toBe('active');
      expect(result.isSpike).toBe(true);
      expect(result.isValuationAvailable).toBe(true);
    });
  });

  // ===========================================================================
  // 7. Estados Desconocidos en Runtime en los Seis Calculadores (6 pruebas parametrizadas)
  // ===========================================================================

  describe('7. Estados Desconocidos en Runtime en los Seis Calculadores', () => {
    const corruptedQuote = createMockQuote({ status: 'CORRUPTED_FEED_STATE' as unknown as FeedStatus });

    it.each([
      ['spot', () => valueSpotPosition({ tradeId: '1', accountId: 'a', asset: 'BTC/USDT', direction: 'long', size: 1, entryPrice: 50000, quote: corruptedQuote })],
      ['usdm', () => valueUsdmPosition({ tradeId: '1', accountId: 'a', asset: 'BTCUSDT', direction: 'long', size: 1, entryPrice: 50000, quote: corruptedQuote, multiplier: 1 })],
      ['coinm', () => valueCoinMPosition({ tradeId: '1', accountId: 'a', asset: 'BTCUSD_PERP', direction: 'long', size: 10, entryPrice: 50000, quote: corruptedQuote })],
      ['forex', () => valueForexPosition({ tradeId: '1', accountId: 'a', asset: 'EUR/USD', direction: 'long', size: 1, entryPrice: 1.08, quote: corruptedQuote })],
      ['futures', () => valueFuturesPosition({ tradeId: '1', accountId: 'a', asset: 'ES', direction: 'long', size: 1, entryPrice: 5000, quote: corruptedQuote, multiplier: 50 })],
      ['stocks', () => valueStocksPosition({ tradeId: '1', accountId: 'a', asset: 'AAPL', direction: 'long', size: 10, entryPrice: 200, quote: corruptedQuote })],
    ])('rechaza estado desconocido devolviendo INVALID_MARKET_QUOTE en %s', (_name, runCalc) => {
      const result = runCalc();
      expect(result.status).toBe('unvaluable');
      expect(result.isValuationAvailable).toBe(false);
      expect(result.errorCode).toBe('INVALID_MARKET_QUOTE');
    });
  });

  // ===========================================================================
  // 8. Comprobación de Precios en Stale, Manual y Offline (4 pruebas)
  // ===========================================================================

  describe('8. Comprobación de Precios en Stale, Manual y Offline', () => {
    it('8.1 cotización STALE con precios válidos calcula PnL pero recibe status stale', () => {
      const staleQuote = createMockQuote({ status: 'stale', bid: 50000, ask: 50010 });
      const res = valueSpotPosition({ tradeId: '1', accountId: 'a', asset: 'BTC/USDT', direction: 'long', size: 1, entryPrice: 48000, quote: staleQuote });

      expect(res.status).toBe('stale');
      expect(res.isStale).toBe(true);
      expect(res.isValuationAvailable).toBe(true);
      expect(res.netFloatingPnL).toBeDefined();
    });

    it('8.2 cotización MANUAL con precios válidos calcula PnL pero recibe status manual', () => {
      const manualQuote = createMockQuote({ status: 'manual', bid: 50000, ask: 50010 });
      const res = valueSpotPosition({ tradeId: '1', accountId: 'a', asset: 'BTC/USDT', direction: 'long', size: 1, entryPrice: 48000, quote: manualQuote });

      expect(res.status).toBe('manual');
      expect(res.isManual).toBe(true);
      expect(res.isValuationAvailable).toBe(true);
      expect(res.netFloatingPnL).toBeDefined();
    });

    it('8.3 cotización OFFLINE con precios previos válidos conserva valoración bajo status offline', () => {
      const offlineQuote = createMockQuote({ status: 'offline', bid: 50000, ask: 50010 });
      const res = valueSpotPosition({ tradeId: '1', accountId: 'a', asset: 'BTC/USDT', direction: 'long', size: 1, entryPrice: 48000, quote: offlineQuote });

      expect(res.status).toBe('offline');
      expect(res.isOffline).toBe(true);
      expect(res.isValuationAvailable).toBe(true);
    });

    it('8.4 cotización OFFLINE sin precios válidos (bid <= 0) resulta en unvaluable sin inventar precios', () => {
      const offlineQuote = createMockQuote({ status: 'offline', bid: 0, ask: 0 });
      const res = valueSpotPosition({ tradeId: '1', accountId: 'a', asset: 'BTC/USDT', direction: 'long', size: 1, entryPrice: 48000, quote: offlineQuote });

      expect(res.status).toBe('unvaluable');
      expect(res.isValuationAvailable).toBe(false);
      expect(res.errorCode).toBe('INVALID_NUMERIC');
    });
  });

  // ===========================================================================
  // 9. Semántica Canónica de ValuationMode (2 pruebas)
  // ===========================================================================

  describe('9. Semántica Canónica de ValuationMode', () => {
    it('9.1 asigna realtime_feed estrictamente cuando openTrades > 0 y 100% de cotizaciones son LIVE fiables', () => {
      const account = createMockAccount({ balance: 100000, initialCapital: 100000 });
      const trade = createMockTrade();
      const quotes = new Map([['BTC/USDT', createMockQuote({ status: 'live' })]]);

      const snapshot = engine.valueAccount(account, [trade], { quotes });

      expect(snapshot.mode).toBe('realtime_feed');
      expect(snapshot.isReliable).toBe(true);
      expect(snapshot.isValuationComplete).toBe(true);
    });

    it('9.2 asigna manual_closed ante trades abiertos con cualquier cotización degradada', () => {
      const account = createMockAccount({ balance: 100000, initialCapital: 100000 });
      const trade = createMockTrade();
      const quotes = new Map([['BTC/USDT', createMockQuote({ status: 'stale' })]]);

      const snapshot = engine.valueAccount(account, [trade], { quotes });

      expect(snapshot.mode).toBe('manual_closed');
      expect(snapshot.isReliable).toBe(false);
    });
  });

  // ===========================================================================
  // 10. Regresión: Alineación de isReliable con valuationBase (5 escenarios)
  // ===========================================================================

  describe('10. Regresión: Alineación de isReliable con valuationBase', () => {
    const verifiedHwm = {
      value: 100000,
      isProvenanceVerified: true,
      source: 'audit_ledger_reconstruction' as const,
    };

    it('10.1 posiciones abiertas, equity 105000, ledgerBalance 0: isReliable = true, canUpdatePeakEquity = true, peakEquityCandidate = 105000, mode = realtime_feed', () => {
      const account = createMockAccount({ balance: 0, initialCapital: 100000 });
      const trade = createMockTrade({ size: 1.0, entryPrice: 50000 });
      const quotes = new Map([
        ['BTC/USDT', createMockQuote({ bid: 155000, ask: 155010, status: 'live' })],
      ]);

      const snapshot = engine.valueAccount(account, [trade], {
        quotes,
        tradeOptions: {
          [trade.id]: { closingFeeRate: 0 },
        },
        historicalHwm: verifiedHwm,
      });

      expect(snapshot.ledgerBalance).toBe(0);
      expect(snapshot.equity).toBe(105000);
      expect(snapshot.isReliable).toBe(true);
      expect(snapshot.canUpdatePeakEquity).toBe(true);
      expect(snapshot.peakEquityCandidate).toBe(105000);
      expect(snapshot.mode).toBe('realtime_feed');
    });

    it('10.2 posiciones abiertas, equity 105000, ledgerBalance -5000: isReliable = true, canUpdatePeakEquity = true, peakEquityCandidate = 105000, mode = realtime_feed', () => {
      const account = createMockAccount({ balance: -5000, initialCapital: 100000 });
      const trade = createMockTrade({ size: 1.0, entryPrice: 50000 });
      const quotes = new Map([
        ['BTC/USDT', createMockQuote({ bid: 160000, ask: 160010, status: 'live' })],
      ]);

      const snapshot = engine.valueAccount(account, [trade], {
        quotes,
        tradeOptions: {
          [trade.id]: { closingFeeRate: 0 },
        },
        historicalHwm: verifiedHwm,
      });

      expect(snapshot.ledgerBalance).toBe(-5000);
      expect(snapshot.equity).toBe(105000);
      expect(snapshot.isReliable).toBe(true);
      expect(snapshot.canUpdatePeakEquity).toBe(true);
      expect(snapshot.peakEquityCandidate).toBe(105000);
      expect(snapshot.mode).toBe('realtime_feed');
    });

    it('10.3 posiciones abiertas, equity 0, ledgerBalance 50000: isReliable = false, canUpdatePeakEquity = false, peakEquityCandidate = undefined, mode = manual_closed', () => {
      const account = createMockAccount({ balance: 50000, initialCapital: 100000 });
      const trade = createMockTrade({ size: 1.0, entryPrice: 60000 });
      const quotes = new Map([
        ['BTC/USDT', createMockQuote({ bid: 10000, ask: 10010, status: 'live' })],
      ]);

      const snapshot = engine.valueAccount(account, [trade], {
        quotes,
        tradeOptions: {
          [trade.id]: { closingFeeRate: 0 },
        },
        historicalHwm: verifiedHwm,
      });

      expect(snapshot.ledgerBalance).toBe(50000);
      expect(snapshot.equity).toBe(0);
      expect(snapshot.isReliable).toBe(false);
      expect(snapshot.canUpdatePeakEquity).toBe(false);
      expect(snapshot.peakEquityCandidate).toBeUndefined();
      expect(snapshot.mode).toBe('manual_closed');
    });

    it('10.4 sin posiciones abiertas, ledgerBalance 0: isReliable = false, HWM bloqueado, mode = manual_closed', () => {
      const account = createMockAccount({ balance: 0, initialCapital: 100000 });

      const snapshot = engine.valueAccount(account, [], {
        historicalHwm: verifiedHwm,
      });

      expect(snapshot.ledgerBalance).toBe(0);
      expect(snapshot.equity).toBe(0);
      expect(snapshot.isReliable).toBe(false);
      expect(snapshot.canUpdatePeakEquity).toBe(false);
      expect(snapshot.peakEquityCandidate).toBeUndefined();
      expect(snapshot.mode).toBe('manual_closed');
    });

    it('10.5 sin posiciones abiertas, ledgerBalance 105000: isReliable = true, canUpdatePeakEquity = true, peakEquityCandidate = 105000, mode = manual_closed', () => {
      const account = createMockAccount({ balance: 105000, initialCapital: 100000 });

      const snapshot = engine.valueAccount(account, [], {
        historicalHwm: verifiedHwm,
      });

      expect(snapshot.ledgerBalance).toBe(105000);
      expect(snapshot.equity).toBe(105000);
      expect(snapshot.isReliable).toBe(true);
      expect(snapshot.canUpdatePeakEquity).toBe(true);
      expect(snapshot.peakEquityCandidate).toBe(105000);
      expect(snapshot.mode).toBe('manual_closed');
    });
  });
});
