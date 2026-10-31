// =============================================================================
// TradeRisk Manager — Multi-Asset Risk Engine Tests (Fase 3)
// =============================================================================

import { describe, it, expect } from 'vitest';
import { calculateRisk } from '@/lib/risk-engine';
import { InstrumentType } from '@/lib/types';

describe('Multi-Asset Risk Engine (Fase 3)', () => {
  // ---------------------------------------------------------------------------
  // 1. Criptomonedas: Spot vs Perpetual con Funding
  // ---------------------------------------------------------------------------
  describe('Crypto: Spot & Perpetual con Funding Rate', () => {
    it('calcula correctamente BTC Spot Long con dimensionamiento fraccionario', () => {
      // Balance: $10,000 | Riesgo: 1% ($100.00)
      // Entry: $60,000 | SL: $58,500 ($1,500 dist) | TP: $64,500 ($4,500 dist)
      // Tamaño = 100 / 1500 = 0.06666667 BTC
      const result = calculateRisk({
        accountBalance: 10000,
        riskAmount: 100,
        entryPrice: 60000,
        stopLoss: 58500,
        takeProfit: 64500,
        direction: 'long',
        instrumentType: InstrumentType.Spot,
        leverage: 1,
        commission: 0.05,
      });

      expect(result.positionSize).toBeCloseTo(0.066667, 5);
      expect(result.notionalValue).toBeCloseTo(4000, 1);
      expect(result.estimatedMargin).toBeCloseTo(4000, 1);
      expect(result.potentialProfit).toBeCloseTo(300, 1);
      expect(result.potentialLoss).toBeCloseTo(100, 1);
      expect(result.positionSizeUnit).toBe('coins');
    });

    it('calcula correctamente BTC Perpetual con Apalancamiento y Tasa de Financiación (Funding)', () => {
      // Balance: $20,000 | Riesgo: 1% ($200.00)
      // Entry: $80,000 | SL: $78,000 ($2,000 dist) | TP: $86,000 ($6,000 dist)
      // Tamaño = 200 / 2000 = 0.10 BTC
      // Nocional = 0.10 * 80,000 = $8,000
      // Apalancamiento = 20x -> Margen = $8,000 / 20 = $400.00
      // Funding: 0.01% por periodo, 3 periodos (24h)
      // Coste Funding = 8,000 * (0.01 / 100) * 3 = $2.40 USD
      const result = calculateRisk({
        accountBalance: 20000,
        riskAmount: 200,
        entryPrice: 80000,
        stopLoss: 78000,
        takeProfit: 86000,
        direction: 'long',
        instrumentType: InstrumentType.Perpetual,
        leverage: 20,
        commission: 0.04,
        fundingRate: 0.01,
        fundingPeriods: 3,
      });

      expect(result.positionSize).toBe(0.1);
      expect(result.notionalValue).toBe(8000);
      expect(result.estimatedMargin).toBe(400);
      expect(result.fundingCost).toBe(2.4);
      // Ganancia bruta = 0.10 * 6000 = $600
      // Comisiones = 0.04% * 8000 ($3.20) + 0.04% * 8600 ($3.44) = $6.64
      // Net Profit = 600 - 6.64 - 2.40 = $590.96
      expect(result.netProfit).toBeCloseTo(590.96, 2);
    });

    it('calcula correctamente ETH Perpetual Short', () => {
      // Entry: 3,000 | SL: 3,150 (dist: 150) | TP: 2,700 (dist: 300)
      // Riesgo: $150 -> Tamaño = 150 / 150 = 1.0 ETH
      // Short con funding positivo (+0.01%) -> El trader en corto recibe funding (rebate)
      const result = calculateRisk({
        accountBalance: 5000,
        riskAmount: 150,
        entryPrice: 3000,
        stopLoss: 3150,
        takeProfit: 2700,
        direction: 'short',
        instrumentType: InstrumentType.Perpetual,
        leverage: 10,
        commission: 0.05,
        fundingRate: 0.01,
        fundingPeriods: 1,
      });

      expect(result.positionSize).toBe(1.0);
      expect(result.notionalValue).toBe(3000);
      expect(result.estimatedMargin).toBe(300);
      expect(result.fundingCost).toBe(-0.3); // rebate
      expect(result.riskRewardRatio).toBe(2.0);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Forex: Lotes, Pips y Conversión de Divisas
  // ---------------------------------------------------------------------------
  describe('Forex: Lotes Estándar, Pips y Conversión', () => {
    it('calcula EUR/USD en cuenta USD (divisa cotizada = divisa de cuenta)', () => {
      // Lote estándar = 100,000 unidades
      // Pip size = 0.0001 -> Valor del pip = 100,000 * 0.0001 * 1.0 = $10.00 USD / lote
      // Entry: 1.0850 | SL: 1.0820 (30 pips) | TP: 1.0940 (90 pips)
      // Cuenta: $10,000 | Riesgo: 1% = $100.00
      // Lotes = 100 / (30 * 10) = 0.3333 -> 0.33 lotes
      // Riesgo efectivo = 0.33 * 30 * 10 = $99.00 USD
      const result = calculateRisk({
        accountBalance: 10000,
        riskPercent: 1.0,
        entryPrice: 1.085,
        stopLoss: 1.082,
        takeProfit: 1.094,
        direction: 'long',
        instrumentType: InstrumentType.ForexLot,
        leverage: 30,
        spreadPips: 1.0,
      });

      expect(result.positionSize).toBe(0.33);
      expect(result.positionSizeUnit).toBe('lots');
      expect(result.ticksOrPips).toBe(30.0);
      expect(result.pipValue).toBeCloseTo(3.3, 2); // 0.33 lotes * $10/lote
      expect(result.effectiveRiskAmount).toBeCloseTo(99.0, 2);
      expect(result.notionalValue).toBeCloseTo(0.33 * 100000 * 1.085, 2); // $35,805
      expect(result.estimatedMargin).toBeCloseTo(35805 / 30, 1);
    });

    it('calcula USD/JPY en cuenta USD (conversión dinámica de divisa JPY -> USD)', () => {
      // Pip size = 0.01 (pares JPY)
      // Entry: 150.00 | SL: 149.50 (50 pips)
      // 1 pip en JPY = 100,000 * 0.01 = 1,000 JPY
      // Valor del pip en USD = 1,000 / 150.00 = $6.6667 USD / lote estándar
      // Riesgo: $150.00 USD
      // Lotes = 150 / (50 * 6.6667) = 150 / 333.333 = 0.45 lotes
      const result = calculateRisk({
        accountBalance: 10000,
        riskAmount: 150,
        entryPrice: 150.0,
        stopLoss: 149.5,
        direction: 'long',
        instrumentType: InstrumentType.ForexLot,
        pipSize: 0.01,
        leverage: 50,
      });

      expect(result.positionSize).toBe(0.45);
      expect(result.ticksOrPips).toBe(50.0);
      expect(result.effectiveRiskAmount).toBeCloseTo(150.0, 0);
    });

    it('soporta conversión de divisas cruzadas con quoteToAccountRate explícito', () => {
      // Par EUR/GBP en cuenta USD: quote es GBP
      // quoteToAccountRate (GBP/USD) = 1.30
      // Valor del pip = 100,000 * 0.0001 * 1.30 = $13.00 USD / lote
      // SL: 20 pips -> Riesgo por lote = 20 * 13 = $260 USD
      // Riesgo deseado: $130 USD -> Lotes = 130 / 260 = 0.50 lotes
      const result = calculateRisk({
        accountBalance: 10000,
        riskAmount: 130,
        entryPrice: 0.85,
        stopLoss: 0.848,
        direction: 'long',
        instrumentType: InstrumentType.ForexLot,
        quoteToAccountRate: 1.3,
      });

      expect(result.positionSize).toBe(0.5);
      expect(result.effectiveRiskAmount).toBeCloseTo(130.0, 1);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Futuros: Contratos, Multiplicadores, Ticks y Margen Inicial
  // ---------------------------------------------------------------------------
  describe('Futuros: E-mini S&P 500, Micro E-mini y Ticks', () => {
    it('calcula E-mini S&P 500 (ES) con multiplicador 50, tick size 0.25 y contratos enteros', () => {
      // Multiplicador: $50 / punto
      // Tick size: 0.25 -> Tick value: 0.25 * 50 = $12.50
      // Entry: 5,800.00 | SL: 5,780.00 (20.0 puntos = 80 ticks) | TP: 5,860.00 (60.0 puntos)
      // Riesgo por contrato = 20 * 50 = $1,000.00 USD
      // Cuenta: $50,000 | Riesgo: 2% ($1,000.00) -> Exactamente 1 contrato
      // Margen inicial por contrato broker: $1,250 USD
      const result = calculateRisk({
        accountBalance: 50000,
        riskAmount: 1000,
        entryPrice: 5800,
        stopLoss: 5780,
        takeProfit: 5860,
        direction: 'long',
        instrumentType: InstrumentType.Futures,
        contractMultiplier: 50,
        tickSize: 0.25,
        initialMarginPerUnit: 1250,
        commissionPerContract: 4.5,
      });

      expect(result.positionSize).toBe(1);
      expect(result.positionSizeUnit).toBe('contracts');
      expect(result.pointValue).toBe(50);
      expect(result.ticksOrPips).toBe(80.0);
      expect(result.notionalValue).toBe(1 * 5800 * 50); // $290,000
      expect(result.estimatedMargin).toBe(1250); // 1 * $1,250
      expect(result.potentialLoss).toBe(1000);
      expect(result.potentialProfit).toBe(3000); // 60 * 50 = $3,000
      expect(result.riskRewardRatio).toBe(3.0);
      expect(result.netProfit).toBe(3000 - 4.5); // $2,995.50
      expect(result.netLoss).toBe(-(1000 + 4.5)); // -$1,004.50
    });

    it('calcula Micro E-mini S&P 500 (MES) con multiplicador 5', () => {
      // Multiplicador: $5 / punto
      // Entry: 5,800.00 | SL: 5,780.00 (20 puntos)
      // Riesgo por contrato = 20 * 5 = $100.00
      // Riesgo deseado: $250.00 -> Contratos discretos = floor(250 / 100) = 2 contratos
      // Riesgo efectivo = 2 * 100 = $200.00
      const result = calculateRisk({
        accountBalance: 10000,
        riskAmount: 250,
        entryPrice: 5800,
        stopLoss: 5780,
        direction: 'long',
        instrumentType: InstrumentType.Futures,
        contractMultiplier: 5,
        tickSize: 0.25,
        initialMarginPerUnit: 125,
      });

      expect(result.positionSize).toBe(2);
      expect(result.effectiveRiskAmount).toBe(200);
      expect(result.estimatedMargin).toBe(250); // 2 * $125
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Acciones e Índices: Enteras vs Fraccionadas
  // ---------------------------------------------------------------------------
  describe('Acciones: Enteras y Fraccionadas', () => {
    it('calcula acciones fraccionadas con alta precisión', () => {
      // Entry: $220.00 | SL: $205.00 (distancia: $15.00)
      // Riesgo: $100.00 -> Acciones = 100 / 15 = 6.6667 acciones
      const result = calculateRisk({
        accountBalance: 5000,
        riskAmount: 100,
        entryPrice: 220,
        stopLoss: 205,
        direction: 'long',
        instrumentType: InstrumentType.Stocks,
        allowFractional: true,
      });

      expect(result.positionSize).toBeCloseTo(6.6667, 4);
      expect(result.positionSizeUnit).toBe('shares');
      expect(result.potentialLoss).toBeCloseTo(100.0, 1);
    });

    it('restringe a acciones enteras cuando allowFractional es false', () => {
      // 100 / 15 = 6.6667 -> floor = 6 acciones
      const result = calculateRisk({
        accountBalance: 5000,
        riskAmount: 100,
        entryPrice: 220,
        stopLoss: 205,
        direction: 'long',
        instrumentType: InstrumentType.Stocks,
        allowFractional: false,
      });

      expect(result.positionSize).toBe(6);
      expect(result.effectiveRiskAmount).toBe(6 * 15); // $90.00
    });
  });
});
