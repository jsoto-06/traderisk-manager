// =============================================================================
// TradeRisk Manager — Quant Audit & Advanced Multiasset Benchmarks (Fase 3.1)
// =============================================================================

import { describe, expect, it } from 'vitest';
import { calculateRisk } from '@/lib/risk-engine';
import { calcPips, calcTicks, floorToStep, roundDecimal, roundToStep, safeDivide } from '@/lib/risk-engine/precision';
import { InstrumentType } from '@/lib/types';

describe('Auditoría Cuantitativa Avanzada del Motor Multiasset (Fase 3.1)', () => {
  // ===========================================================================
  // 1. FUTUROS: PROTECCIÓN DEL RIESGO Y CONTRATOS ENTEROS
  // ===========================================================================
  describe('1. Futuros: Protección del Riesgo y Contratos Discretos', () => {
    it('devuelve posición NO operable y 0 contratos cuando 1 contrato supera el presupuesto de riesgo', () => {
      // ES: Multiplicador 50 | Entrada: 5,000 | SL: 4,980 (20 pts = 80 ticks)
      // Pérdida por contrato = 20 * 50 = $1,000 USD
      // Presupuesto de riesgo disponible: $400 USD
      // floor(400 / 1000) = 0 contratos
      // NUNCA debe forzar 1 contrato porque arriesgaría $1,000 (250% del presupuesto)
      const result = calculateRisk({
        accountBalance: 20000,
        riskAmount: 400,
        entryPrice: 5000,
        stopLoss: 4980,
        direction: 'long',
        instrumentType: InstrumentType.Futures,
        contractMultiplier: 50,
        tickSize: 0.25,
      });

      expect(result.positionSize).toBe(0);
      expect(result.isOperable).toBe(false);
      expect(result.inoperableReason).toContain('Presupuesto de riesgo insuficiente');
      expect(result.effectiveRiskAmount).toBe(0);
      expect(result.notionalValue).toBe(0);
      expect(result.estimatedMargin).toBe(0);
      expect(result.potentialLoss).toBe(0);
      expect(result.netLoss).toBe(0);
    });

    it('devuelve 0 contratos con includeFeesInRisk cuando las comisiones hacen que 1 contrato supere el presupuesto', () => {
      // ES: 20 puntos = $1,000 USD de pérdida por precio
      // Comisión flat round-turn: $5.00 USD
      // Pérdida total por contrato = $1,005.00 USD
      // Presupuesto de riesgo: $1,000 USD exactos
      // Sin includeFeesInRisk: 1 contrato (riesgo bruto $1,000, pero neto $1,005)
      // Con includeFeesInRisk: floor(1000 / 1005) = 0 contratos (protección estricta)
      const resultStrict = calculateRisk({
        accountBalance: 50000,
        riskAmount: 1000,
        entryPrice: 5000,
        stopLoss: 4980,
        direction: 'long',
        instrumentType: InstrumentType.Futures,
        contractMultiplier: 50,
        tickSize: 0.25,
        commissionPerContract: 5.0,
        includeFeesInRisk: true,
      });

      expect(resultStrict.positionSize).toBe(0);
      expect(resultStrict.isOperable).toBe(false);

      const resultGross = calculateRisk({
        accountBalance: 50000,
        riskAmount: 1000,
        entryPrice: 5000,
        stopLoss: 4980,
        direction: 'long',
        instrumentType: InstrumentType.Futures,
        contractMultiplier: 50,
        tickSize: 0.25,
        commissionPerContract: 5.0,
        includeFeesInRisk: false,
      });

      expect(resultGross.positionSize).toBe(1);
      expect(resultGross.netLoss).toBe(-1005); // Supera los $1,000 brutos
    });

    it('valida la coherencia de tick size y tick value ($12.50 para ES, $1.25 para MES, $5.00 para NQ)', () => {
      const resES = calculateRisk({
        accountBalance: 100000,
        riskAmount: 2000,
        entryPrice: 5800,
        stopLoss: 5790,
        direction: 'long',
        instrumentType: InstrumentType.Futures,
        contractMultiplier: 50,
        tickSize: 0.25,
      });

      expect(resES.tickValue).toBe(12.5); // 0.25 * 50
      expect(resES.ticksOrPips).toBe(40); // 10 puntos / 0.25

      const resMES = calculateRisk({
        accountBalance: 10000,
        riskAmount: 200,
        entryPrice: 5800,
        stopLoss: 5790,
        direction: 'long',
        instrumentType: InstrumentType.Futures,
        contractMultiplier: 5,
        tickSize: 0.25,
      });

      expect(resMES.tickValue).toBe(1.25); // 0.25 * 5

      const resNQ = calculateRisk({
        accountBalance: 100000,
        riskAmount: 2000,
        entryPrice: 20000,
        stopLoss: 19950,
        direction: 'long',
        instrumentType: InstrumentType.Futures,
        contractMultiplier: 20,
        tickSize: 0.25,
      });

      expect(resNQ.tickValue).toBe(5.0); // 0.25 * 20
    });

    it('detecta insuficiencia de margen cuando el capital no cubre el margen inicial del broker', () => {
      // Cuenta pequeña de $800
      // Margen inicial del broker para ES: $1,250
      // Riesgo monetario permitido cubre 1 contrato ($100 de riesgo), pero el saldo no cubre el margen
      const result = calculateRisk({
        accountBalance: 800,
        riskAmount: 100,
        entryPrice: 5000,
        stopLoss: 4998, // 2 puntos = $100 riesgo
        direction: 'long',
        instrumentType: InstrumentType.Futures,
        contractMultiplier: 50,
        tickSize: 0.25,
        initialMarginPerUnit: 1250,
      });

      expect(result.positionSize).toBe(1);
      expect(result.isOperable).toBe(false);
      expect(result.inoperableReason).toContain('Margen requerido ($1250) supera el');
    });

    it('rechaza multiplicador o tickSize no positivos', () => {
      expect(() =>
        calculateRisk({
          accountBalance: 10000,
          riskAmount: 100,
          entryPrice: 5000,
          stopLoss: 4990,
          direction: 'long',
          instrumentType: InstrumentType.Futures,
          contractMultiplier: 0,
        }),
      ).toThrow('contractMultiplier must be positive');

      expect(() =>
        calculateRisk({
          accountBalance: 10000,
          riskAmount: 100,
          entryPrice: 5000,
          stopLoss: 4990,
          direction: 'long',
          instrumentType: InstrumentType.Futures,
          tickSize: -0.25,
        }),
      ).toThrow('tickSize must be positive');
    });
  });

  // ===========================================================================
  // 2. FOREX: SPREAD, PIP VALUE Y CONVERSIÓN DE DIVISAS
  // ===========================================================================
  describe('2. Forex: Conversión de Divisas, Spread y Respeto de Riesgo', () => {
    it('calcula GBP/JPY en cuenta USD con conversión dinámica inversa', () => {
      // Par GBP/JPY | Cuenta en USD
      // Entrada: 190.00 | SL: 189.50 (50 pips)
      // Pip size = 0.01
      // 1 pip en JPY = 100,000 * 0.01 = 1,000 JPY
      // Tipo de cambio USD/JPY = 155.00 -> quoteToAccountRate = 1 / 155 = 0.0064516
      // Valor del pip en USD = 1,000 / 155 = $6.4516 USD por lote estándar
      // Riesgo deseado: $300 USD
      // Lotes brutos = 300 / (50 * 6.4516) = 300 / 322.58 = 0.93 lotes
      const result = calculateRisk({
        accountBalance: 50000,
        riskAmount: 300,
        entryPrice: 190.0,
        stopLoss: 189.5,
        direction: 'long',
        instrumentType: InstrumentType.ForexLot,
        pipSize: 0.01,
        quoteToAccountRate: 1 / 155, // USD/JPY
      });

      expect(result.positionSize).toBe(0.93);
      expect(result.ticksOrPips).toBe(50.0);
      expect(result.pipValue).toBeCloseTo(0.93 * (1000 / 155), 2); // ~ $6.00 USD
      expect(result.effectiveRiskAmount).toBeCloseTo(0.93 * 50 * (1000 / 155), 1); // ~ $300 USD
    });

    it('calcula EUR/GBP en cuenta EUR (quote GBP convertida a base EUR)', () => {
      // Par EUR/GBP | Cuenta en EUR
      // Entrada: 0.8500 | SL: 0.8460 (40 pips)
      // 1 pip en GBP = 100,000 * 0.0001 = £10.00 GBP
      // Para convertir GBP a EUR: 1 / EUR_GBP = 1 / 0.85 = 1.17647 EUR
      // Valor del pip en EUR = 10 * (1 / 0.85) = €11.7647 EUR por lote estándar
      // Riesgo: €235.29 EUR -> Lotes = 235.29 / (40 * 11.7647) = 235.29 / 470.588 = 0.50 lotes
      const result = calculateRisk({
        accountBalance: 20000,
        riskAmount: 235.29,
        entryPrice: 0.85,
        stopLoss: 0.846,
        direction: 'long',
        instrumentType: InstrumentType.ForexLot,
        quoteToAccountRate: 1 / 0.85,
      });

      expect(result.positionSize).toBe(0.5);
      expect(result.ticksOrPips).toBe(40.0);
      expect(result.effectiveRiskAmount).toBeCloseTo(235.29, 0);
    });

    it('evita doble contabilización del spread cuando los precios ya incluyen Bid/Ask', () => {
      // Cuando pricesIncludeSpread: true, los precios son de ejecución real y no se añade spreadCost adicional
      const resultWithoutDoubleCount = calculateRisk({
        accountBalance: 10000,
        riskAmount: 100,
        entryPrice: 1.0852, // Ask real
        stopLoss: 1.082, // Bid real
        direction: 'long',
        instrumentType: InstrumentType.ForexLot,
        spreadPips: 1.5,
        pricesIncludeSpread: true,
        commission: 0,
      });

      // En resultWithoutDoubleCount solo se cobra la comisión ECN de $7/lote ($2.17 para 0.31 lotes), sin spread duplicado
      expect(resultWithoutDoubleCount.estimatedCommissions).toBeCloseTo(resultWithoutDoubleCount.positionSize * 7.0, 2);

      const resultWithSpread = calculateRisk({
        accountBalance: 10000,
        riskAmount: 100,
        entryPrice: 1.085, // Mid price
        stopLoss: 1.082, // Mid price
        direction: 'long',
        instrumentType: InstrumentType.ForexLot,
        spreadPips: 1.5,
        pricesIncludeSpread: false,
        commission: 0,
      });

      // Con precios Mid, se añade la fricción de 1.5 pips además de la comisión
      expect(resultWithSpread.estimatedCommissions).toBeGreaterThan(resultWithoutDoubleCount.estimatedCommissions);
    });

    it('garantiza que la pérdida neta al SL NO supere el presupuesto de riesgo con includeFeesInRisk', () => {
      // Cuenta $10,000 | Riesgo: $100.00
      // EUR/USD: SL 20 pips ($200/lote) + Spread 1.5 pips ($15/lote) + Comisión ($7/lote) = $222/lote
      // Con includeFeesInRisk: Lotes = floorToStep(100 / 222, 0.01) = 0.45 lotes
      // Pérdida total neta = 0.45 * 222 = $99.90 <= $100.00 (PRESUPUESTO RESPETADO)
      const result = calculateRisk({
        accountBalance: 10000,
        riskAmount: 100,
        entryPrice: 1.085,
        stopLoss: 1.083,
        direction: 'long',
        instrumentType: InstrumentType.ForexLot,
        spreadPips: 1.5,
        commission: 0, // usa default ECN $7/lote
        includeFeesInRisk: true,
      });

      expect(result.positionSize).toBe(0.45);
      expect(Math.abs(result.netLoss)).toBeLessThanOrEqual(100.0);
    });

    it('devuelve 0 lotes y posición inoperable si el presupuesto no cubre el lote mínimo de 0.01', () => {
      // Riesgo microscópico de $1.00 USD con SL de 50 pips ($5.00 por 0.01 lote)
      const result = calculateRisk({
        accountBalance: 1000,
        riskAmount: 1.0,
        entryPrice: 1.085,
        stopLoss: 1.08,
        direction: 'long',
        instrumentType: InstrumentType.ForexLot,
        includeFeesInRisk: true,
      });

      expect(result.positionSize).toBe(0);
      expect(result.isOperable).toBe(false);
      expect(result.inoperableReason).toContain('lote mínimo (0.01)');
    });
  });

  // ===========================================================================
  // 3. CRIPTOMONEDAS PERPETUAS: FUNDING RATES Y LIQUIDACIÓN
  // ===========================================================================
  describe('3. Criptomonedas Perpetuas: Convención de Signos y Liquidación', () => {
    it('aplica correctamente convención de signos: Long paga funding positivo (coste) y recibe funding negativo (rebate)', () => {
      // BTC Long: Entrada $60,000 | SL $58,000 ($2,000 distancia) | Riesgo $100 -> 0.05 BTC ($3,000 nocional)
      // Caso 1: Funding positivo +0.02% en 1 período -> Coste = 3000 * 0.0002 = $0.60
      const resLongPos = calculateRisk({
        accountBalance: 10000,
        riskAmount: 100,
        entryPrice: 60000,
        stopLoss: 58000,
        direction: 'long',
        instrumentType: InstrumentType.Perpetual,
        fundingRate: 0.02,
        fundingPeriods: 1,
      });

      expect(resLongPos.fundingCost).toBe(0.6); // Positivo = coste a pagar
      expect(resLongPos.netLoss).toBe(-(100 + 0.6)); // Pérdida incrementada

      // Caso 2: Funding negativo -0.02% en 1 período -> Rebate = -$0.60
      const resLongNeg = calculateRisk({
        accountBalance: 10000,
        riskAmount: 100,
        entryPrice: 60000,
        stopLoss: 58000,
        direction: 'long',
        instrumentType: InstrumentType.Perpetual,
        fundingRate: -0.02,
        fundingPeriods: 1,
      });

      expect(resLongNeg.fundingCost).toBe(-0.6); // Negativo = rebate recibido
      expect(resLongNeg.netLoss).toBe(-(100 - 0.6)); // Pérdida reducida
    });

    it('aplica correctamente convención de signos para Shorts: Short recibe con funding positivo y paga con funding negativo', () => {
      // BTC Short: Entrada $60,000 | SL $62,000 | Nocional $3,000
      // Caso 1: Funding positivo +0.02% -> Short recibe rebate -$0.60
      const resShortPos = calculateRisk({
        accountBalance: 10000,
        riskAmount: 100,
        entryPrice: 60000,
        stopLoss: 62000,
        direction: 'short',
        instrumentType: InstrumentType.Perpetual,
        fundingRate: 0.02,
        fundingPeriods: 1,
      });

      expect(resShortPos.fundingCost).toBe(-0.6); // Rebate

      // Caso 2: Funding negativo -0.02% -> Short paga coste +$0.60
      const resShortNeg = calculateRisk({
        accountBalance: 10000,
        riskAmount: 100,
        entryPrice: 60000,
        stopLoss: 62000,
        direction: 'short',
        instrumentType: InstrumentType.Perpetual,
        fundingRate: -0.02,
        fundingPeriods: 1,
      });

      expect(resShortNeg.fundingCost).toBe(0.6); // Coste
    });

    it('calcula períodos de financiación dinámicos según el intervalo de la plataforma (1h vs 8h)', () => {
      // Posición mantenida 24 horas:
      // En plataforma de 8h (Binance/Bybit): 24 / 8 = 3 ciclos
      const res8h = calculateRisk({
        accountBalance: 10000,
        riskAmount: 100,
        entryPrice: 60000,
        stopLoss: 58000,
        direction: 'long',
        instrumentType: InstrumentType.Perpetual,
        fundingRate: 0.01,
        holdingPeriodHours: 24,
        fundingIntervalHours: 8,
      });

      // En plataforma de 1h (dYdX/Hyperliquid): 24 / 1 = 24 ciclos con tasa horaria de 0.001%
      const res1h = calculateRisk({
        accountBalance: 10000,
        riskAmount: 100,
        entryPrice: 60000,
        stopLoss: 58000,
        direction: 'long',
        instrumentType: InstrumentType.Perpetual,
        fundingRate: 0.001,
        holdingPeriodHours: 24,
        fundingIntervalHours: 1,
      });

      expect(res8h.fundingCost).toBeCloseTo(3000 * 0.0001 * 3, 3); // 3 ciclos
      expect(res1h.fundingCost).toBeCloseTo(3000 * 0.00001 * 24, 3); // 24 ciclos
    });

    it('detecta liquidación previa al Stop Loss y marca la posición como inoperable', () => {
      // Long en BTC con 50x de apalancamiento
      // Entrada: $60,000 | SL: $57,000 (-5.0% de distancia)
      // Con 50x y MMR = 0.5%, precio de liquidación: 60,000 * (1 - 1/50 + 0.005) = 60,000 * 0.985 = $59,100
      // Como el SL ($57,000) está por debajo de $59,100, la posición se liquida ANTES del SL
      const result = calculateRisk({
        accountBalance: 10000,
        riskAmount: 100,
        entryPrice: 60000,
        stopLoss: 57000,
        direction: 'long',
        instrumentType: InstrumentType.Perpetual,
        leverage: 50,
      });

      expect(result.liquidationPrice).toBe(59100);
      expect(result.isLiquidationBeforeSL).toBe(true);
      expect(result.isOperable).toBe(false);
      expect(result.inoperableReason).toContain('ALERTA CRÍTICA: El precio de liquidación estimado');
    });
  });

  // ===========================================================================
  // 4. PRECISIÓN NUMÉRICA Y ARITMÉTICA
  // ===========================================================================
  describe('4. Precisión Numérica, Ticks y Pips', () => {
    it('elimina micro-errores binarios de IEEE-754 en cálculos de pips y ticks', () => {
      // En JS float puro: (1.0855 - 1.0830) / 0.0001 da 24.999999999999957
      const rawDistance = 1.0855 - 1.083;
      const cleanPips = calcPips(rawDistance, 0.0001);
      expect(cleanPips).toBe(25.0);

      // En ticks de futuros: 5,000.75 - 5,000.00 = 0.75 / 0.25 = 3 ticks exactos
      const tickDistance = 5000.75 - 5000.0;
      const cleanTicks = calcTicks(tickDistance, 0.25);
      expect(cleanTicks).toBe(3);
    });

    it('roundToStep y floorToStep redondean y truncan exactamente al múltiplo deseado', () => {
      expect(roundToStep(5000.12, 0.25)).toBe(5000.0);
      expect(roundToStep(5000.13, 0.25)).toBe(5000.25);

      expect(floorToStep(0.339, 0.01)).toBe(0.33);
      expect(floorToStep(2.999, 1)).toBe(2);

      expect(roundDecimal(1.005, 2)).toBe(1.01);
      expect(roundDecimal(10.123456, 4)).toBe(10.1235);
    });

    it('safeDivide previene divisiones por cero, NaN e Infinity sin lanzar excepciones no capturadas', () => {
      expect(safeDivide(100, 0, 0)).toBe(0);
      expect(safeDivide(100, NaN, 0)).toBe(0);
      expect(safeDivide(100, Infinity, 0)).toBe(0);
      expect(safeDivide(100, 5, 0)).toBe(20);
    });

    it('acciones enteras cuando el presupuesto no alcanza para 1 acción completa devuelve 0', () => {
      // Acción de $500 | SL: $450 ($50 riesgo por acción)
      // Presupuesto de riesgo: $25 USD
      // floor(25 / 50) = 0 acciones
      const result = calculateRisk({
        accountBalance: 1000,
        riskAmount: 25,
        entryPrice: 500,
        stopLoss: 450,
        direction: 'long',
        instrumentType: InstrumentType.Stocks,
        allowFractional: false,
      });

      expect(result.positionSize).toBe(0);
      expect(result.isOperable).toBe(false);
      expect(result.inoperableReason).toContain('Presupuesto de riesgo insuficiente para comprar 1 acción');
    });
  });
});
