// =============================================================================
// TradeRisk Manager — Robustness, Currency Conversions & 10 Invariants (Fase 3.2)
// =============================================================================

import { describe, expect, it } from 'vitest';
import { calculateRisk } from '@/lib/risk-engine';
import { isPriceOnGrid, sumPnL } from '@/lib/risk-engine/precision';
import { InstrumentType } from '@/lib/types';

describe('FASE 3.2: Robustez Cuantitativa, Conversión de Divisas y 10 Invariantes', () => {
  // ===========================================================================
  // 1. LIQUIDACIÓN DE CRIPTOMONEDAS: AISLADO VS CRUZADO
  // ===========================================================================
  describe('1. Liquidación de Criptomonedas: Aislado vs Cruzado y Metodología', () => {
    it('diferencia margen aislado y margen cruzado en el precio estimado de liquidación', () => {
      // BTC Long: Entrada $60,000 | SL $55,000 | Apalancamiento 10x
      // Balance $10,000 | Riesgo $200 -> Tamaño 0.04 BTC ($2,400 nocional, $240 margen inicial)
      // En aislado: Liq ≈ 60,000 * (1 - 1/10 + 0.005) = $54,300
      const resIsolated = calculateRisk({
        accountBalance: 10000,
        riskAmount: 200,
        entryPrice: 60000,
        stopLoss: 55000,
        direction: 'long',
        instrumentType: InstrumentType.Perpetual,
        leverage: 10,
        marginMode: 'isolated',
      });

      // En cruzado: Todo el margen libre ($9,760) respalda la posición de 0.04 BTC
      // Pérdida tolerable = 9,760 - 12 (MMR) = $9,748 -> Distancia liq = 9,748 / 0.04 = $243,700
      // Precio de liquidación en cruzado cae a $0 (totalmente protegida por el margen libre de la cuenta)
      const resCross = calculateRisk({
        accountBalance: 10000,
        riskAmount: 200,
        entryPrice: 60000,
        stopLoss: 55000,
        direction: 'long',
        instrumentType: InstrumentType.Perpetual,
        leverage: 10,
        marginMode: 'cross',
      });

      expect(resIsolated.isLiquidationEstimated).toBe(true);
      expect(resCross.isLiquidationEstimated).toBe(true);
      expect(resIsolated.liquidationPrice).toBeGreaterThan(0);
      expect(resCross.liquidationPrice).toBe(0); // Colchón de capital libre total
      expect(resCross.liquidationMethodology).toContain('margen cruzado');
    });

    it('alerta y bloquea operabilidad cuando la liquidación ocurre antes del Stop Loss', () => {
      // Long con 50x de apalancamiento (margen 2%) | SL al -4% (demasiado lejos para 50x)
      const result = calculateRisk({
        accountBalance: 10000,
        riskAmount: 100,
        entryPrice: 100,
        stopLoss: 96,
        direction: 'long',
        instrumentType: InstrumentType.Perpetual,
        leverage: 50,
        marginMode: 'isolated',
      });

      expect(result.isLiquidationBeforeSL).toBe(true);
      expect(result.isOperable).toBe(false);
      expect(result.inoperableReason).toContain('ALERTA CRÍTICA: El precio de liquidación estimado');
    });
  });

  // ===========================================================================
  // 2. FUNDING: INTERVALOS, ESTIMACIÓN Y NO INFLACIÓN DE TAMAÑO
  // ===========================================================================
  describe('2. Funding: Intervalos y Prudencia Cuantitativa', () => {
    it('incluye funding en el presupuesto estricto si es un coste, pero no infla el tamaño con rebates futuros', () => {
      // BTC Long con Funding POSITIVO (+0.03% coste): debe reducir el tamaño para respetar el presupuesto
      const resCost = calculateRisk({
        accountBalance: 10000,
        riskAmount: 100,
        entryPrice: 60000,
        stopLoss: 58000, // distancia $2,000
        direction: 'long',
        instrumentType: InstrumentType.Perpetual,
        fundingRate: 0.03,
        fundingPeriods: 1,
        includeFeesInRisk: true,
      });

      // BTC Long con Funding NEGATIVO (-0.03% rebate proyectado):
      // No debe inflar el tamaño de la posición por encima de 100 / 2000 = 0.05 BTC
      const resRebate = calculateRisk({
        accountBalance: 10000,
        riskAmount: 100,
        entryPrice: 60000,
        stopLoss: 58000,
        direction: 'long',
        instrumentType: InstrumentType.Perpetual,
        fundingRate: -0.03,
        fundingPeriods: 1,
        includeFeesInRisk: true,
      });

      // El tamaño con coste es inferior a 0.05 BTC para compensar el fee
      expect(resCost.positionSize).toBeLessThan(0.05);
      // El tamaño con rebate no supera el tamaño base (máx 0.05 BTC sin comisiones)
      expect(resRebate.positionSize).toBeLessThanOrEqual(0.05);
      expect(resCost.effectiveNetRisk).toBeLessThanOrEqual(100.0);
    });
  });

  // ===========================================================================
  // 3. FOREX: LAS 5 COMBINACIONES DE CONVERSIÓN MULTI-DIVISA
  // ===========================================================================
  describe('3. Forex: Conversiones Directas, Inversas y Cruzadas', () => {
    it('Caso 1: GBP/JPY con cuenta USD (requiere tasa USD/JPY explícita)', () => {
      // Entrada: 190.00 | SL: 189.50 (50 pips) | USD/JPY = 155.00
      // 1 pip en JPY = 1,000 JPY -> En USD = 1,000 / 155 = $6.4516
      const resSuccess = calculateRisk({
        accountBalance: 50000,
        riskAmount: 300,
        entryPrice: 190.0,
        stopLoss: 189.5,
        direction: 'long',
        instrumentType: InstrumentType.ForexLot,
        assetSymbol: 'GBP/JPY',
        accountCurrency: 'USD',
        quoteToAccountRate: 1 / 155,
      });

      expect(resSuccess.isOperable).toBe(true);
      expect(resSuccess.positionSize).toBe(0.93);
      expect(resSuccess.pipValue).toBeCloseTo(0.93 * (1000 / 155), 2);

      // Si falta la tasa de conversión en par cruzado, la operación DEBE ser no operable
      const resMissingRate = calculateRisk({
        accountBalance: 50000,
        riskAmount: 300,
        entryPrice: 190.0,
        stopLoss: 189.5,
        direction: 'long',
        instrumentType: InstrumentType.ForexLot,
        assetSymbol: 'GBP/JPY',
        accountCurrency: 'USD',
      });

      expect(resMissingRate.isOperable).toBe(false);
      expect(resMissingRate.positionSize).toBe(0);
      expect(resMissingRate.inoperableReason).toContain('Falta la tasa de conversión');
    });

    it('Caso 2: EUR/GBP con cuenta EUR (conversión automática inversa 1 / entryPrice)', () => {
      // Base = EUR (igual a cuenta EUR), Quote = GBP
      // Pip en GBP = £10 -> En EUR = 10 / entryPrice = 10 / 0.85 = €11.7647
      const result = calculateRisk({
        accountBalance: 20000,
        riskAmount: 235.29,
        entryPrice: 0.85,
        stopLoss: 0.846, // 40 pips
        direction: 'long',
        instrumentType: InstrumentType.ForexLot,
        assetSymbol: 'EUR/GBP',
        accountCurrency: 'EUR',
      });

      expect(result.isOperable).toBe(true);
      expect(result.positionSize).toBe(0.5);
      expect(result.effectiveRiskAmount).toBeCloseTo(235.29, 0);
    });

    it('Caso 3: EUR/USD con cuenta GBP (requiere tasa GBP/USD inversa)', () => {
      // Base = EUR, Quote = USD, Cuenta = GBP
      // Pip en USD = $10. Con GBP/USD = 1.25, USD -> GBP = 1 / 1.25 = 0.80
      // Valor del pip en GBP = £8.00 / lote estándar
      // SL: 25 pips -> Riesgo por lote = 25 * 8 = £200 GBP
      // Presupuesto: £100 GBP -> 0.50 lotes
      const result = calculateRisk({
        accountBalance: 10000,
        riskAmount: 100,
        entryPrice: 1.085,
        stopLoss: 1.0825, // 25 pips
        direction: 'long',
        instrumentType: InstrumentType.ForexLot,
        assetSymbol: 'EUR/USD',
        accountCurrency: 'GBP',
        quoteToAccountRate: 1 / 1.25, // 0.80
      });

      expect(result.isOperable).toBe(true);
      expect(result.positionSize).toBe(0.5);
      expect(result.pipValue).toBe(4.0); // 0.50 lotes * £8/lote
      expect(result.effectiveRiskAmount).toBe(100.0);
    });

    it('Caso 4: USD/JPY con cuenta EUR (requiere tasa EUR/JPY inversa)', () => {
      // Base = USD, Quote = JPY, Cuenta = EUR
      // Pip en JPY = 1,000 JPY. Con EUR/JPY = 160.0, JPY -> EUR = 1 / 160 = 0.00625
      // Pip en EUR = 1000 / 160 = €6.25 / lote
      // SL: 40 pips -> Riesgo por lote = 40 * 6.25 = €250 EUR
      // Presupuesto: €125 EUR -> 0.50 lotes
      const result = calculateRisk({
        accountBalance: 15000,
        riskAmount: 125,
        entryPrice: 150.0,
        stopLoss: 149.6, // 40 pips
        direction: 'long',
        instrumentType: InstrumentType.ForexLot,
        assetSymbol: 'USD/JPY',
        accountCurrency: 'EUR',
        quoteToAccountRate: 1 / 160,
      });

      expect(result.isOperable).toBe(true);
      expect(result.positionSize).toBe(0.5);
      expect(result.pipValue).toBeCloseTo(3.125, 2);
    });

    it('Caso 5: GBP/USD con cuenta EUR (requiere tasa EUR/USD inversa)', () => {
      // Base = GBP, Quote = USD, Cuenta = EUR
      // Pip en USD = $10. Con EUR/USD = 1.08, USD -> EUR = 1 / 1.08 = 0.925925
      // Pip en EUR = 10 / 1.08 = €9.25925 / lote
      // SL: 30 pips -> Riesgo por lote = 30 * 9.25925 = €277.78
      // Presupuesto: €138.89 EUR -> 0.50 lotes
      const result = calculateRisk({
        accountBalance: 20000,
        riskAmount: 138.89,
        entryPrice: 1.3,
        stopLoss: 1.297, // 30 pips
        direction: 'long',
        instrumentType: InstrumentType.ForexLot,
        assetSymbol: 'GBP/USD',
        accountCurrency: 'EUR',
        quoteToAccountRate: 1 / 1.08,
      });

      expect(result.isOperable).toBe(true);
      expect(result.positionSize).toBe(0.5);
      expect(result.effectiveRiskAmount).toBeCloseTo(138.89, 1);
    });

    it('rechaza tasas de conversión de divisas no positivas arrojando excepción de validación', () => {
      expect(() =>
        calculateRisk({
          accountBalance: 10000,
          riskAmount: 100,
          entryPrice: 1.085,
          stopLoss: 1.08,
          direction: 'long',
          instrumentType: InstrumentType.ForexLot,
          quoteToAccountRate: 0,
        }),
      ).toThrow('quoteToAccountRate must be positive');
    });
  });

  // ===========================================================================
  // 4. PRECISIÓN NUMÉRICA: SUMAS, PNL, COMISIONES PEQUEÑAS Y PRICE GRID
  // ===========================================================================
  describe('4. Precisión Numérica y Comportamiento Aritmético', () => {
    it('acumula PnL sucesivos con sumPnL sin pérdida de significación', () => {
      // En JS float nativo: 0.1 + 0.2 + 0.3 - 0.6 = 5.551115123125783e-17 (no es 0)
      const dirtySum = 0.1 + 0.2 + 0.3 - 0.6;
      expect(dirtySum).not.toBe(0);

      // Con sumPnL:
      const cleanSum = sumPnL(0.1, 0.2, 0.3, -0.6);
      expect(cleanSum).toBe(0.0);
    });

    it('detecta precios off-grid que no son múltiplos válidos de tickSize', () => {
      expect(isPriceOnGrid(5000.25, 0.25)).toBe(true);
      expect(isPriceOnGrid(5000.5, 0.25)).toBe(true);
      expect(isPriceOnGrid(5000.13, 0.25)).toBe(false); // Off grid!

      // Con enforceTickGrid: true, debe lanzar excepción
      expect(() =>
        calculateRisk({
          accountBalance: 50000,
          riskAmount: 1000,
          entryPrice: 5000.13, // Precio inválido para ES
          stopLoss: 4980,
          direction: 'long',
          instrumentType: InstrumentType.Futures,
          contractMultiplier: 50,
          tickSize: 0.25,
          enforceTickGrid: true,
        }),
      ).toThrow('entryPrice (5000.13) does not align with tickSize (0.25)');
    });

    it('maneja comisiones pequeñas sin provocar NaN ni truncamiento erróneo', () => {
      const result = calculateRisk({
        accountBalance: 1000,
        riskAmount: 10,
        entryPrice: 0.00005,
        stopLoss: 0.00004,
        direction: 'long',
        instrumentType: InstrumentType.Spot,
        commission: 0.001, // 0.001%
      });

      expect(Number.isFinite(result.positionSize)).toBe(true);
      expect(result.positionSize).toBeCloseTo(1000000, 2);
      expect(Number.isFinite(result.estimatedCommissions)).toBe(true);
    });
  });

  // ===========================================================================
  // 5. MARGEN DISPONIBLE: FREE MARGIN VS BALANCE
  // ===========================================================================
  describe('5. Margen Disponible: Verificación Real de Free Margin', () => {
    it('bloquea la operación si el margen requerido supera el Free Margin, aunque el Balance sea alto', () => {
      // Balance: $10,000 | Equity: $8,000 | Margen utilizado por trades abiertos: $7,500
      // Margen libre real: $8,000 - $7,500 = $500 USD
      // Nueva posición de Futuros requiere $1,250 de margen inicial broker
      // Antiguo bug: comparaba contra $10,000 y aprobaba.
      // Corrección: compara contra $500 y rechaza como inoperable.
      const result = calculateRisk({
        accountBalance: 10000,
        accountEquity: 8000,
        usedMargin: 7500,
        riskAmount: 200,
        entryPrice: 5000,
        stopLoss: 4996, // 4 pts = $200 riesgo (presupuesto cubierto)
        direction: 'long',
        instrumentType: InstrumentType.Futures,
        contractMultiplier: 50,
        initialMarginPerUnit: 1250,
      });

      expect(result.freeMargin).toBe(500);
      expect(result.isOperable).toBe(false);
      expect(result.inoperableReason).toContain('supera el margen libre disponible ($500)');
    });
  });

  // ===========================================================================
  // 6. PRUEBAS DE LAS 10 INVARIANTES MATEMÁTICAS FUNDAMENTALES
  // ===========================================================================
  describe('6. Verificación de las 10 Invariantes Matemáticas del Motor de Riesgo', () => {
    // Invariante 1: Una operación no operable nunca debe recomendar una posición positiva
    it('Invariante 1: Si isOperable es false, positionSize debe ser exactamente 0', () => {
      const resInoperable = calculateRisk({
        accountBalance: 10000,
        riskAmount: 100, // no alcanza para 1 contrato de ES ($1,000 riesgo)
        entryPrice: 5000,
        stopLoss: 4980,
        direction: 'long',
        instrumentType: InstrumentType.Futures,
        contractMultiplier: 50,
      });

      expect(resInoperable.isOperable).toBe(false);
      expect(resInoperable.positionSize).toBe(0);
    });

    // Invariante 2: El tamaño calculado nunca debe superar el presupuesto neto en modo estricto
    it('Invariante 2: Con includeFeesInRisk: true, effectiveNetRisk <= riskAmount', () => {
      const resStrict = calculateRisk({
        accountBalance: 10000,
        riskAmount: 100,
        entryPrice: 1.085,
        stopLoss: 1.083,
        direction: 'long',
        instrumentType: InstrumentType.ForexLot,
        spreadPips: 2.0,
        commission: 0,
        includeFeesInRisk: true,
      });

      expect(resStrict.effectiveNetRisk).toBeLessThanOrEqual(100.0);
    });

    // Invariante 3: Los futuros nunca deben forzar un contrato
    it('Invariante 3: Futuros con presupuesto inferior a 1 contrato devuelve 0', () => {
      const resFutures = calculateRisk({
        accountBalance: 5000,
        riskAmount: 50,
        entryPrice: 5000,
        stopLoss: 4990, // 10 pts = $500 riesgo
        direction: 'long',
        instrumentType: InstrumentType.Futures,
        contractMultiplier: 50,
      });

      expect(resFutures.positionSize).toBe(0);
    });

    // Invariante 4: El tamaño de una posición discreta nunca debe superar el presupuesto
    it('Invariante 4: Posiciones discretas truncan siempre hacia abajo (floor)', () => {
      // 250 / 100 = 2.5 contratos -> debe ser 2, jamás 3
      const resDiscrete = calculateRisk({
        accountBalance: 10000,
        riskAmount: 250,
        entryPrice: 5000,
        stopLoss: 4980, // 20 pts = $100 riesgo MES
        direction: 'long',
        instrumentType: InstrumentType.Futures,
        contractMultiplier: 5,
      });

      expect(resDiscrete.positionSize).toBe(2);
      expect(resDiscrete.effectiveRiskAmount).toBe(200); // 2 * 100 <= 250
    });

    // Invariante 5: Precio incompatible con tick size genera advertencia o error
    it('Invariante 5: Advertencia o error ante precios fuera del tick grid', () => {
      const resWarning = calculateRisk({
        accountBalance: 50000,
        riskAmount: 1000,
        entryPrice: 5000.12, // off grid para 0.25
        stopLoss: 4980,
        direction: 'long',
        instrumentType: InstrumentType.Futures,
        contractMultiplier: 50,
        tickSize: 0.25,
      });

      expect(resWarning.priceGridWarning).toBeDefined();
      expect(resWarning.priceGridWarning).toContain('no coincide con el incremento mínimo');
    });

    // Invariante 6: Conversión de divisas inválida nunca produce resultado aparentemente válido
    it('Invariante 6: Falta de tasa cruzada marca posición como inoperable con 0 lotes', () => {
      const resInvalidCross = calculateRisk({
        accountBalance: 10000,
        riskAmount: 100,
        entryPrice: 190.0,
        stopLoss: 189.5,
        direction: 'long',
        instrumentType: InstrumentType.ForexLot,
        assetSymbol: 'GBP/JPY',
        accountCurrency: 'USD',
      });

      expect(resInvalidCross.isOperable).toBe(false);
      expect(resInvalidCross.positionSize).toBe(0);
    });

    // Invariante 7: Los costes no se contabilizan dos veces
    it('Invariante 7: Precios con spread no duplican fricción en comisiones', () => {
      const resMid = calculateRisk({
        accountBalance: 10000,
        riskAmount: 100,
        entryPrice: 1.085,
        stopLoss: 1.082,
        direction: 'long',
        instrumentType: InstrumentType.ForexLot,
        spreadPips: 2.0,
        pricesIncludeSpread: false,
        commission: 0,
      });

      const resExec = calculateRisk({
        accountBalance: 10000,
        riskAmount: 100,
        entryPrice: 1.0852,
        stopLoss: 1.082,
        direction: 'long',
        instrumentType: InstrumentType.ForexLot,
        spreadPips: 2.0,
        pricesIncludeSpread: true,
        commission: 0,
      });

      expect(resExec.lossCommissions).toBeLessThan(resMid.lossCommissions);
    });

    // Invariante 8: El margen retenido nunca debe confundirse con una pérdida
    it('Invariante 8: estimatedMargin es garantía retenida, no pérdida', () => {
      const res = calculateRisk({
        accountBalance: 10000,
        riskAmount: 100,
        entryPrice: 5000,
        stopLoss: 4998,
        direction: 'long',
        instrumentType: InstrumentType.Futures,
        contractMultiplier: 50,
        initialMarginPerUnit: 1250,
      });

      expect(res.estimatedMargin).toBe(1250); // Garantía temporal
      expect(res.potentialLoss).toBe(100); // Pérdida real en SL
      expect(res.potentialLoss).not.toBe(res.estimatedMargin);
    });

    // Invariante 9: Stop Loss situado después de la liquidación genera alerta crítica
    it('Invariante 9: SL más allá de precio de liquidación activa isLiquidationBeforeSL', () => {
      const res = calculateRisk({
        accountBalance: 10000,
        riskAmount: 100,
        entryPrice: 60000,
        stopLoss: 56000, // -6.6% con 20x (margen 5%, liq ~ $57,300)
        direction: 'long',
        instrumentType: InstrumentType.Perpetual,
        leverage: 20,
        marginMode: 'isolated',
      });

      expect(res.isLiquidationBeforeSL).toBe(true);
      expect(res.isOperable).toBe(false);
    });

    // Invariante 10: Idempotencia y estabilidad numérica ante cálculos repetidos
    it('Invariante 10: Múltiples ejecuciones con idénticos inputs producen outputs estrictamente iguales', () => {
      const input = {
        accountBalance: 25000,
        riskPercent: 1.5,
        entryPrice: 5800.25,
        stopLoss: 5780.0,
        takeProfit: 5850.5,
        direction: 'long' as const,
        instrumentType: InstrumentType.Futures,
        contractMultiplier: 50,
        tickSize: 0.25,
      };

      const res1 = calculateRisk(input);
      const res2 = calculateRisk(input);

      expect(res1.positionSize).toBe(res2.positionSize);
      expect(res1.netProfit).toBe(res2.netProfit);
      expect(res1.netLoss).toBe(res2.netLoss);
      expect(res1.estimatedMargin).toBe(res2.estimatedMargin);
    });
  });
});
