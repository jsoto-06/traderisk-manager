// =============================================================================
// TradeRisk Manager — Test Suite: Instrument Classification & Strict Numeric Validation (Bloque A)
// =============================================================================

import { describe, it, expect } from 'vitest';
import type { Trade } from '../lib/types';
import type { MarketPriceQuote } from '../lib/market-data/types';
import {
  classifyInstrument,
  inferFuturesMultiplier,
  validateTradeCoreParams,
  validateQuotePrices,
  validateForexParams,
  validateFuturesMultiplier,
  validateCoinMParams,
  validateSpotBorrowParams,
  valueSpotPosition,
  valueUsdmPosition,
  valueCoinMPosition,
  valueForexPosition,
  valueFuturesPosition,
  valueStocksPosition,
  MultiAssetValuationEngine,
} from '../lib/valuation';

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

describe('Fase 8.2.1 — Bloque A: Clasificación de Instrumentos y Validación Numérica', () => {
  const engine = new MultiAssetValuationEngine();

  // ===========================================================================
  // H6: CLASIFICACIÓN DE INSTRUMENTOS FINANCIEROS Y CATÁLOGO
  // ===========================================================================

  describe('H6: Clasificación de Instrumentos Financieros', () => {
    it('clasifica correctamente pares mayores y cruces de Forex sin degradarlos a Spot', () => {
      // Majors & standard
      expect(classifyInstrument('EUR/USD')).toBe('forex');
      expect(classifyInstrument('GBP/USD')).toBe('forex');
      expect(classifyInstrument('USD/JPY')).toBe('forex');
      expect(classifyInstrument('GBP/CHF')).toBe('forex');

      // Crosses without USD/EUR/GBP/JPY
      expect(classifyInstrument('AUD/CAD')).toBe('forex');
      expect(classifyInstrument('NZD/CHF')).toBe('forex');
      expect(classifyInstrument('CAD/CHF')).toBe('forex');
      expect(classifyInstrument('AUD/NZD')).toBe('forex');

      // Unslashed standard 6-character forex pairs
      expect(classifyInstrument('EURUSD')).toBe('forex');
      expect(classifyInstrument('USDJPY')).toBe('forex');
      expect(classifyInstrument('AUDCAD')).toBe('forex');
    });

    it('clasifica criptoactivos en Spot y NUNCA como Forex aunque contengan USD en stablecoins', () => {
      // Must NOT be classified as Forex just because USDT contains 'USD'
      expect(classifyInstrument('BTC/USDT')).toBe('spot');
      expect(classifyInstrument('ETH/USDT')).toBe('spot');
      expect(classifyInstrument('ADA/USDT')).toBe('spot');
      expect(classifyInstrument('XRP/USDT')).toBe('spot');
      expect(classifyInstrument('BNB/USDT')).toBe('spot');
      expect(classifyInstrument('DOGE/USDT')).toBe('spot');
      expect(classifyInstrument('LINK/USDT')).toBe('spot');
      expect(classifyInstrument('SOL/USDC')).toBe('spot');
      expect(classifyInstrument('ADAUSDT')).toBe('spot');
    });

    it('distingue con precisión derivados USD-M y Coin-M inversos según mercado y contrato', () => {
      // Coin-M inverse
      expect(classifyInstrument('BTCUSD_PERP')).toBe('coinm');
      expect(classifyInstrument('ETHUSD_PERP')).toBe('coinm');
      expect(classifyInstrument('BTC/USD:PERP')).toBe('coinm');

      const coinMQuote = createMockQuote({ provider: 'binance_coinm', st: 2, contractType: 'perpetual' });
      expect(classifyInstrument('BTCUSD', coinMQuote)).toBe('coinm');

      // USD-M linear
      expect(classifyInstrument('BTC/USDT:PERP')).toBe('usdm');
      const usdmQuote = createMockQuote({ provider: 'binance_usdm', st: 1, contractType: 'perpetual' });
      expect(classifyInstrument('BTCUSDT', usdmQuote)).toBe('usdm');
    });

    it('clasifica futuros tradicionales CME y deduce sus multiplicadores exactos', () => {
      expect(classifyInstrument('ES')).toBe('futures');
      expect(classifyInstrument('MES')).toBe('futures');
      expect(classifyInstrument('NQ')).toBe('futures');
      expect(classifyInstrument('MNQ')).toBe('futures');
      expect(classifyInstrument('CL')).toBe('futures');
      expect(classifyInstrument('GC')).toBe('futures');
      expect(classifyInstrument('SI')).toBe('futures');

      // Multipliers
      expect(inferFuturesMultiplier('ES')).toBe(50);
      expect(inferFuturesMultiplier('MES')).toBe(5);
      expect(inferFuturesMultiplier('NQ')).toBe(20);
      expect(inferFuturesMultiplier('MNQ')).toBe(2);
      expect(inferFuturesMultiplier('CL')).toBe(1000);
      expect(inferFuturesMultiplier('GC')).toBe(100);
      expect(inferFuturesMultiplier('SI')).toBe(5000);
    });

    it('clasifica acciones ordinarias y CFDs de acciones', () => {
      expect(classifyInstrument('AAPL')).toBe('stocks');
      expect(classifyInstrument('MSFT')).toBe('stocks');
      expect(classifyInstrument('TSLA')).toBe('stocks');
    });

    it('devuelve UNKNOWN y bloquea cálculos con UNSUPPORTED_ASSET_CLASS ante instrumentos no identificables', () => {
      expect(classifyInstrument('UNKNOWN_ASSET_XYZ')).toBe('unknown');
      expect(classifyInstrument('RANDOM_123456_INVALID')).toBe('unknown');

      const mockTrade: Trade = {
        id: 't_unknown',
        accountId: 'acc1',
        asset: 'UNKNOWN_ASSET_XYZ',
        direction: 'long',
        entryPrice: 100,
        stopLoss: 90,
        takeProfit: 120,
        size: 1,
        openDate: '2026-11-01T00:00:00Z',
        status: 'open',
        commissions: 1,
        strategy: 'Test',
        timeframe: '1h',
        notes: '',
      };

      const quote = createMockQuote({ asset: 'UNKNOWN_ASSET_XYZ' });
      const valuation = engine.valueTrade(mockTrade, quote);

      expect(valuation.status).toBe('unvaluable');
      expect(valuation.isValuationAvailable).toBe(false);
      expect(valuation.errorCode).toBe('UNSUPPORTED_ASSET_CLASS');
      expect(valuation.reason).toContain('cannot be reliably classified');
    });

    it('respeta la prioridad estricta de instrumentType explícito sobre cualquier inferencia', () => {
      // Force an ambiguous symbol to be treated strictly as Forex
      expect(classifyInstrument('CUSTOM_PAIR', undefined, 'forex')).toBe('forex');
      // Force to be treated strictly as Futures
      expect(classifyInstrument('CUSTOM_PAIR', undefined, 'futures')).toBe('futures');
    });
  });

  // ===========================================================================
  // H7: VALIDACIÓN NUMÉRICA ESTRICTA Y PREVENCIÓN DE NaN / INFINITY
  // ===========================================================================

  describe('H7: Validación Numérica Estricta', () => {
    describe('Validaciones Centralizadas', () => {
      it('rechaza entryPrice o size no finitos, negativos o cero', () => {
        expect(validateTradeCoreParams(0, 1).isValid).toBe(false);
        expect(validateTradeCoreParams(-50, 1).isValid).toBe(false);
        expect(validateTradeCoreParams(NaN, 1).isValid).toBe(false);
        expect(validateTradeCoreParams(Infinity, 1).isValid).toBe(false);
        expect(validateTradeCoreParams('50000', 1).isValid).toBe(false); // No silent conversion

        expect(validateTradeCoreParams(50000, 0).isValid).toBe(false);
        expect(validateTradeCoreParams(50000, -1).isValid).toBe(false);
        expect(validateTradeCoreParams(50000, NaN).isValid).toBe(false);
      });

      it('rechaza cotizaciones con precios bid/ask no finitos o libro cruzado', () => {
        expect(validateQuotePrices(undefined).isValid).toBe(false);
        expect(validateQuotePrices(createMockQuote({ bid: 0 })).isValid).toBe(false);
        expect(validateQuotePrices(createMockQuote({ bid: -100 })).isValid).toBe(false);
        expect(validateQuotePrices(createMockQuote({ bid: NaN })).isValid).toBe(false);
        expect(validateQuotePrices(createMockQuote({ ask: 0 })).isValid).toBe(false);
        expect(validateQuotePrices(createMockQuote({ ask: Infinity })).isValid).toBe(false);

        // Crossed book: bid > ask
        expect(validateQuotePrices(createMockQuote({ bid: 50020, ask: 50010 })).isValid).toBe(false);
      });

      it('rechaza multiplicadores de futuros <= 0 o no finitos', () => {
        expect(validateFuturesMultiplier(0).isValid).toBe(false);
        expect(validateFuturesMultiplier(-50).isValid).toBe(false);
        expect(validateFuturesMultiplier(NaN).isValid).toBe(false);
        expect(validateFuturesMultiplier(Infinity).isValid).toBe(false);
        expect(validateFuturesMultiplier(50).isValid).toBe(true);
      });

      it('rechaza parámetros de Forex no positivos o no finitos', () => {
        expect(validateForexParams(0, 10, 1).isValid).toBe(false); // pipSize = 0
        expect(validateForexParams(-0.0001, 10, 1).isValid).toBe(false);
        expect(validateForexParams(NaN, 10, 1).isValid).toBe(false);

        expect(validateForexParams(0.0001, 0, 1).isValid).toBe(false); // pipValue = 0
        expect(validateForexParams(0.0001, NaN, 1).isValid).toBe(false);

        expect(validateForexParams(0.0001, 10, 0).isValid).toBe(false); // fxRate = 0
        expect(validateForexParams(0.0001, 10, -1).isValid).toBe(false);
        expect(validateForexParams(0.0001, 10, NaN).isValid).toBe(false);
      });

      it('rechaza parámetros Coin-M inválidos', () => {
        expect(validateCoinMParams(0, 1).isValid).toBe(false); // contractSizeUSD = 0
        expect(validateCoinMParams(-100, 1).isValid).toBe(false);
        expect(validateCoinMParams(100, 0).isValid).toBe(false); // fxRate = 0
        expect(validateCoinMParams(100, NaN).isValid).toBe(false);
      });

      it('rechaza parámetros de préstamo de Spot Short negativos o no finitos', () => {
        expect(validateSpotBorrowParams(-1, 0.0002, 10).isValid).toBe(false); // daysHeld < 0
        expect(validateSpotBorrowParams(NaN, 0.0002, 10).isValid).toBe(false);
        expect(validateSpotBorrowParams(1, -0.0002, 10).isValid).toBe(false); // dailyBorrowRate < 0
        expect(validateSpotBorrowParams(1, 0.0002, -5).isValid).toBe(false); // capacity < 0
      });
    });

    describe('Blindaje Numérico en Calculadores de Instrumentos', () => {
      it('Spot: devuelve INVALID_NUMERIC ante daysHeld = NaN o closingFeeRate negativo', () => {
        const quote = createMockQuote();
        const resNaN = valueSpotPosition({
          tradeId: 't_spot_nan',
          accountId: 'a1',
          asset: 'BTC/USDT',
          direction: 'long',
          size: 1,
          entryPrice: 50000,
          quote,
          daysHeld: NaN,
        });
        expect(resNaN.status).toBe('unvaluable');
        expect(resNaN.isValuationAvailable).toBe(false);
        expect(resNaN.errorCode).toBe('INVALID_NUMERIC');

        const resNegFee = valueSpotPosition({
          tradeId: 't_spot_neg',
          accountId: 'a1',
          asset: 'BTC/USDT',
          direction: 'long',
          size: 1,
          entryPrice: 50000,
          quote,
          closingFeeRate: -0.05,
        });
        expect(resNegFee.errorCode).toBe('INVALID_NUMERIC');
      });

      it('USD-M: devuelve INVALID_NUMERIC ante multiplier <= 0 o accruedFunding = NaN', () => {
        const quote = createMockQuote();
        const resBadMult = valueUsdmPosition({
          tradeId: 't_usdm_mult',
          accountId: 'a1',
          asset: 'BTCUSDT',
          direction: 'long',
          size: 1,
          entryPrice: 50000,
          quote,
          multiplier: -1,
        });
        expect(resBadMult.status).toBe('unvaluable');
        expect(resBadMult.errorCode).toBe('INVALID_NUMERIC');

        const resFundingNaN = valueUsdmPosition({
          tradeId: 't_usdm_fund',
          accountId: 'a1',
          asset: 'BTCUSDT',
          direction: 'long',
          size: 1,
          entryPrice: 50000,
          quote,
          accruedFunding: NaN,
        });
        expect(resFundingNaN.errorCode).toBe('INVALID_NUMERIC');
      });

      it('Coin-M: devuelve INVALID_NUMERIC ante contractSizeUSD <= 0 o usdToAccountFxRate = NaN', () => {
        const quote = createMockQuote({ provider: 'binance_coinm', st: 2 });
        const resBadContract = valueCoinMPosition({
          tradeId: 't_coinm_bad',
          accountId: 'a1',
          asset: 'BTCUSD_PERP',
          direction: 'long',
          size: 10,
          entryPrice: 50000,
          quote,
          contractSizeUSD: 0,
        });
        expect(resBadContract.status).toBe('unvaluable');
        expect(resBadContract.errorCode).toBe('INVALID_NUMERIC');

        const resBadFx = valueCoinMPosition({
          tradeId: 't_coinm_fx',
          accountId: 'a1',
          asset: 'BTCUSD_PERP',
          direction: 'long',
          size: 10,
          entryPrice: 50000,
          quote,
          usdToAccountFxRate: NaN,
        });
        expect(resBadFx.errorCode).toBe('INVALID_NUMERIC');
      });

      it('Forex: devuelve INVALID_NUMERIC ante pipSize <= 0 o pipValueInQuote = NaN', () => {
        const quote = createMockQuote({ bid: 1.085, ask: 1.0852 });
        const resBadPip = valueForexPosition({
          tradeId: 't_fx_bad',
          accountId: 'a1',
          asset: 'EUR/USD',
          direction: 'long',
          size: 1,
          entryPrice: 1.08,
          quote,
          pipSize: 0,
        });
        expect(resBadPip.status).toBe('unvaluable');
        expect(resBadPip.errorCode).toBe('INVALID_NUMERIC');

        const resBadPipVal = valueForexPosition({
          tradeId: 't_fx_val',
          accountId: 'a1',
          asset: 'EUR/USD',
          direction: 'long',
          size: 1,
          entryPrice: 1.08,
          quote,
          pipValueInQuote: NaN,
        });
        expect(resBadPipVal.errorCode).toBe('INVALID_NUMERIC');
      });

      it('Futures: devuelve INVALID_NUMERIC ante multiplier <= 0 o commissionPerContract negativa', () => {
        const quote = createMockQuote({ bid: 5000, ask: 5000.25 });
        const resBadMult = valueFuturesPosition({
          tradeId: 't_fut_mult',
          accountId: 'a1',
          asset: 'ES',
          direction: 'long',
          size: 1,
          entryPrice: 5000,
          quote,
          multiplier: -50,
        });
        expect(resBadMult.status).toBe('unvaluable');
        expect(resBadMult.errorCode).toBe('INVALID_NUMERIC');

        const resBadComm = valueFuturesPosition({
          tradeId: 't_fut_comm',
          accountId: 'a1',
          asset: 'ES',
          direction: 'long',
          size: 1,
          entryPrice: 5000,
          quote,
          multiplier: 50,
          commissionPerContract: -2,
        });
        expect(resBadComm.errorCode).toBe('INVALID_NUMERIC');
      });

      it('Stocks: devuelve INVALID_NUMERIC ante comisiones, borrowRate o daysHeld negativos', () => {
        const quote = createMockQuote({ bid: 150, ask: 150.1 });
        const resBadFee = valueStocksPosition({
          tradeId: 't_stk_fee',
          accountId: 'a1',
          asset: 'AAPL',
          direction: 'long',
          size: 10,
          entryPrice: 150,
          quote,
          commissionPerShare: -0.05,
        });
        expect(resBadFee.status).toBe('unvaluable');
        expect(resBadFee.errorCode).toBe('INVALID_NUMERIC');
      });
    });
  });
});
