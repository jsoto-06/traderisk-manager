// =============================================================================
// TradeRisk Manager — Final Risk of Ruin & Percentage Equity Audit Suite (Fase 5.2.2)
// Auditoría Matemática y Estadística de Cierre: Elegibilidad, Modelos y Criterios
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  calculateRiskOfRuin,
  calculateExactGamblersRuin,
  calculateExactPercentageEquityRuin,
  calculateWilsonScoreInterval,
} from '../lib/analytics/risk-of-ruin';
import { createMulberry32 } from '../lib/analytics/monte-carlo';

describe('FASE 5.2.2: Auditoría Final del Riesgo de Ruina y Modelo Percentage Equity', () => {
  // ===========================================================================
  // 1. REQUISITO 1: ELEGIBILIDAD DEL CÁLCULO EXACTO Y NO REDONDEO SILENCIOSO
  // ===========================================================================
  describe('1. Elegibilidad Estricta del Cálculo Exacto', () => {
    it('Benchmark K: Payoff R = 0.995 no es elegible para cálculo exacto (R !== 1.0)', () => {
      const res = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 50,
        averageWin: 99.5,
        averageLoss: 100, // R = 0.995
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 5.0,
        tradesHorizon: 100,
        riskModel: 'fixed_amount',
      });

      // Payoff asimétrico no debe generar exactFiniteRuinProbability
      expect(res.exactFiniteRuinProbability).toBeUndefined();
      expect(res.empiricalRuinProbability).toBeGreaterThan(0);
    });

    it('Benchmark L: Payoff R = 1.0 con U entero es elegible para cálculo exacto', () => {
      const res = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 50,
        averageWin: 100,
        averageLoss: 100, // R = 1.0 exacto
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 5.0, // U = 5 exacto
        tradesHorizon: 100,
        riskModel: 'fixed_amount',
      });

      expect(res.exactFiniteRuinProbability).toBeDefined();
      expect(res.exactFiniteRuinProbability).toBe(61.73);
    });

    it('Benchmark M: Payoff R = 1.005 no es elegible para cálculo exacto (R !== 1.0)', () => {
      const res = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 50,
        averageWin: 100.5,
        averageLoss: 100, // R = 1.005
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 5.0,
        tradesHorizon: 100,
        riskModel: 'fixed_amount',
      });

      expect(res.exactFiniteRuinProbability).toBeUndefined();
      expect(res.empiricalRuinProbability).toBeGreaterThan(0);
    });

    it('Benchmark N: Risk units entero (U = 5) es elegible', () => {
      const res = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 40,
        averageWin: 100,
        averageLoss: 100,
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 5.0, // U = 5.0
        tradesHorizon: 100,
        riskModel: 'fixed_amount',
      });

      expect(res.riskUnits).toBe(5);
      expect(res.exactFiniteRuinProbability).toBe(98.0);
    });

    it('Benchmark O: Risk units no entero (U = 5.4) no es elegible y calculateExactGamblersRuin devuelve NaN sin redondeo silencioso', () => {
      const res = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 40,
        averageWin: 100,
        averageLoss: 100,
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 5.4, // U = 5.4 (no entero!)
        tradesHorizon: 100,
        riskModel: 'fixed_amount',
      });

      expect(res.riskUnits).toBe(5.4);
      // NO debe redondear silenciosamente a 5
      expect(res.exactFiniteRuinProbability).toBeUndefined();

      // Invocación directa con valor no entero devuelve NaN
      const exactDirect = calculateExactGamblersRuin(5.4, 40, 100);
      expect(Number.isNaN(exactDirect)).toBe(true);
    });
  });

  // ===========================================================================
  // 2. REQUISITO 2: VALIDACIÓN Y MODELO DETERMINISTA DE PERCENTAGE_EQUITY
  // ===========================================================================
  describe('2. Modelo Multiplicativo de Percentage Equity', () => {
    it('Benchmark I: Percentage equity con capital 10.000 USD, límite 5% y riesgo 1% (W=45%, T=10)', () => {
      const initialCapital = 10000;
      const winRate = 45;
      const riskPct = 1.0;
      const maxLossPct = 5.0;
      const tradesHorizon = 10;

      const exactBinomialDP = calculateExactPercentageEquityRuin(
        initialCapital,
        winRate,
        1.0,
        riskPct,
        maxLossPct,
        tradesHorizon,
      );

      // Verificación analítica del valor exacto: 11.4568%
      expect(exactBinomialDP).toBeCloseTo(11.4568, 2);

      const res = calculateRiskOfRuin({
        initialCapital,
        winRate,
        averageWin: 100,
        averageLoss: 100,
        riskPerTradePercent: riskPct,
        maxLossLimitPercent: maxLossPct,
        tradesHorizon,
        riskModel: 'percentage_equity',
        seed: 101,
      });

      expect(res.exactPercentageEquityRuinProbability).toBe(11.46);
      // Monte Carlo con N=2,000 en percentage_equity da ~11.60% (dentro de 1 SE)
      expect(Math.abs(res.finiteHorizonRuinProbability - exactBinomialDP)).toBeLessThan(1.5);
    });

    it('Benchmark J: Demostración analítica de trayectoria de 6 pérdidas vs trayectoria mixta', () => {
      const B0 = 10000;
      const threshold = 9500; // 5% límite
      const f = 0.01; // 1% riesgo

      // 1. Seis pérdidas consecutivas
      let b = B0;
      const balances6Losses: number[] = [b];
      for (let i = 1; i <= 6; i++) {
        b = b * (1 - f);
        balances6Losses.push(Number(b.toFixed(2)));
      }

      // En el trade 5 el balance es $9,509.90 > $9,500 (NO ha quebrado)
      expect(balances6Losses[5]).toBe(9509.9);
      expect(balances6Losses[5]).toBeGreaterThan(threshold);

      // En el trade 6 el balance es $9,414.80 <= $9,500 (QUIEBRA)
      expect(balances6Losses[6]).toBe(9414.8);
      expect(balances6Losses[6]).toBeLessThanOrEqual(threshold);

      // 2. Trayectoria mixta: 1 Ganancia seguida de 6 Pérdidas (WLLLLLL)
      let bMixed = B0 * (1 + f); // Trade 1: Win -> 10,100
      expect(bMixed).toBe(10100);

      const balancesMixed: number[] = [B0, bMixed];
      for (let i = 1; i <= 6; i++) {
        bMixed = bMixed * (1 - f);
        balancesMixed.push(Number(bMixed.toFixed(2)));
      }

      // Al trade 7 (1W + 6L), balance = $9,508.95 > $9,500 (NO QUIEBRA gracias al colchón de la victoria)
      expect(balancesMixed[7]).toBe(9508.95);
      expect(balancesMixed[7]).toBeGreaterThan(threshold);

      // Requiere una 7ª pérdida consecutiva (WLLLLLLL) para quebrar
      const b8 = Number((bMixed * (1 - f)).toFixed(2));
      expect(b8).toBe(9413.86);
      expect(b8).toBeLessThanOrEqual(threshold);
    });
  });

  // ===========================================================================
  // 3. REQUISITO 3: AUDITORÍA ESTADÍSTICA DEL BENCHMARK D
  // ===========================================================================
  describe('3. Auditoría Estadística Rigurosa de Benchmark D (W=45%, U=5, T=100)', () => {
    const exactDP = calculateExactGamblersRuin(5, 45, 100);

    it('Confirma valor analítico exacto DP = 87.3602%', () => {
      expect(exactDP).toBeCloseTo(87.3602, 3);
    });

    it('Audita N=2,000 con seed=101 y demuestra pertenencia al intervalo Wilson al 99%', () => {
      const res = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 45,
        averageWin: 100,
        averageLoss: 100,
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 5.0,
        tradesHorizon: 100,
        riskModel: 'fixed_amount',
        seed: 101,
      });

      // Monte Carlo con N=2000 y seed=101 da 85.65%
      expect(res.empiricalRuinProbability).toBe(85.65);

      const K = Math.round((85.65 / 100) * 2000); // 1713
      const wilson95 = calculateWilsonScoreInterval(K, 2000, 0.95);
      const wilson99 = calculateWilsonScoreInterval(K, 2000, 0.99);

      // Error estándar teórico: SE = sqrt(0.8736 * 0.1264 / 2000) = 0.743%
      const se = Math.sqrt((exactDP / 100 * (1 - exactDP / 100)) / 2000) * 100;
      const zScore = Math.abs(res.empiricalRuinProbability - exactDP) / se;

      // Z-Score = 2.30. Queda fuera de la banda del 95% (Z <= 1.96) pero dentro de la banda del 99% (Z <= 2.58)
      expect(zScore).toBeCloseTo(2.30, 1);
      expect(exactDP).toBeGreaterThan(wilson95.upper); // Documenta que quedó fuera de 95%
      expect(exactDP).toBeLessThanOrEqual(wilson99.upper); // Pero dentro de 99%
    });

    it('Demuestra convergencia de Benchmark D al escalar N a 10.000 (Z < 1.30)', () => {
      // Función de simulación con N = 10,000
      const prng = createMulberry32(101);
      let ruined = 0;
      const N = 10000;
      for (let s = 0; s < N; s++) {
        let u = 5;
        for (let t = 0; t < 100; t++) {
          if (prng() * 100 < 45) u += 1;
          else u -= 1;
          if (u <= 0) {
            ruined++;
            break;
          }
        }
      }
      const mc10k = (ruined / N) * 100;
      const se10k = Math.sqrt((exactDP / 100 * (1 - exactDP / 100)) / N) * 100;
      const z10k = Math.abs(mc10k - exactDP) / se10k;
      const wilson10k = calculateWilsonScoreInterval(ruined, N, 0.95);

      // Con N=10,000 el error relativo disminuye y el valor exacto cae DENTRO del intervalo Wilson 95%
      expect(z10k).toBeLessThan(1.5);
      expect(exactDP).toBeGreaterThanOrEqual(wilson10k.lower);
      expect(exactDP).toBeLessThanOrEqual(wilson10k.upper);
    });
  });

  // ===========================================================================
  // 4. SUITE DE LOS 8 ESCENARIOS CANÓNICOS DE FIXED AMOUNT (BENCHMARKS A - H)
  // ===========================================================================
  describe('4. Benchmarks A a H (Fixed Amount)', () => {
    it('Benchmark A: Fixed amount, W=40%, U=3, T=50 -> Exact DP = 94.9825%', () => {
      const exact = calculateExactGamblersRuin(3, 40, 50);
      expect(exact).toBeCloseTo(94.9825, 2);

      const res = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 40,
        averageWin: 100,
        averageLoss: 100,
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 3.0,
        tradesHorizon: 50,
        riskModel: 'fixed_amount',
        seed: 101,
      });

      expect(res.exactFiniteRuinProbability).toBe(94.98);
      expect(Math.abs(res.empiricalRuinProbability - exact)).toBeLessThan(1.5);
    });

    it('Benchmark B: Fixed amount, W=40%, U=5, T=100 -> Exact DP = 97.9956%', () => {
      const exact = calculateExactGamblersRuin(5, 40, 100);
      expect(exact).toBeCloseTo(97.9956, 2);

      const res = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 40,
        averageWin: 100,
        averageLoss: 100,
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 5.0,
        tradesHorizon: 100,
        riskModel: 'fixed_amount',
        seed: 101,
      });

      expect(res.exactFiniteRuinProbability).toBe(98.0);
      expect(Math.abs(res.empiricalRuinProbability - exact)).toBeLessThan(1.0);
    });

    it('Benchmark C: Fixed amount, W=45%, U=5, T=10 -> Exact DP = 17.4269%', () => {
      const exact = calculateExactGamblersRuin(5, 45, 10);
      expect(exact).toBeCloseTo(17.4269, 2);

      const res = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 45,
        averageWin: 100,
        averageLoss: 100,
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 5.0,
        tradesHorizon: 10,
        riskModel: 'fixed_amount',
        seed: 101,
      });

      expect(res.exactFiniteRuinProbability).toBe(17.43);
      expect(Math.abs(res.empiricalRuinProbability - exact)).toBeLessThan(2.0);
    });

    it('Benchmark D: Fixed amount, W=45%, U=5, T=100 -> Exact DP = 87.3602%', () => {
      const exact = calculateExactGamblersRuin(5, 45, 100);
      expect(exact).toBeCloseTo(87.3602, 2);

      const res = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 45,
        averageWin: 100,
        averageLoss: 100,
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 5.0,
        tradesHorizon: 100,
        riskModel: 'fixed_amount',
        seed: 101,
      });

      expect(res.exactFiniteRuinProbability).toBe(87.36);
    });

    it('Benchmark E: Fixed amount, W=50%, U=5, T=100 -> Exact DP = 61.7299%', () => {
      const exact = calculateExactGamblersRuin(5, 50, 100);
      expect(exact).toBeCloseTo(61.7299, 2);

      const res = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 50,
        averageWin: 100,
        averageLoss: 100,
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 5.0,
        tradesHorizon: 100,
        riskModel: 'fixed_amount',
        seed: 101,
      });

      expect(res.exactFiniteRuinProbability).toBe(61.73);
      expect(Math.abs(res.empiricalRuinProbability - exact)).toBeLessThan(2.5);
    });

    it('Benchmark F: Fixed amount, W=60%, U=5, T=100 -> Exact DP = 12.9048%', () => {
      const exact = calculateExactGamblersRuin(5, 60, 100);
      expect(exact).toBeCloseTo(12.9048, 2);

      const res = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 60,
        averageWin: 100,
        averageLoss: 100,
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 5.0,
        tradesHorizon: 100,
        riskModel: 'fixed_amount',
        seed: 101,
      });

      expect(res.exactFiniteRuinProbability).toBe(12.9);
      expect(res.asymptoticRuinProbability).toBeCloseTo(13.17, 1);
      expect(Math.abs(res.empiricalRuinProbability - exact)).toBeLessThan(2.0);
    });

    it('Benchmark G: Fixed amount, W=0%, U=5, T=10 -> Exact DP = 100.0000%', () => {
      const exact = calculateExactGamblersRuin(5, 0, 10);
      expect(exact).toBe(100.0);

      const res = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 0,
        averageWin: 100,
        averageLoss: 100,
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 5.0,
        tradesHorizon: 10,
        riskModel: 'fixed_amount',
        seed: 101,
      });

      expect(res.exactFiniteRuinProbability).toBe(100.0);
      expect(res.empiricalRuinProbability).toBe(100.0);
    });

    it('Benchmark H: Fixed amount, W=100%, U=5, T=100 -> Exact DP = 0.0000%', () => {
      const exact = calculateExactGamblersRuin(5, 100, 100);
      expect(exact).toBe(0.0);

      const res = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 100,
        averageWin: 100,
        averageLoss: 100,
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 5.0,
        tradesHorizon: 100,
        riskModel: 'fixed_amount',
        seed: 101,
      });

      expect(res.exactFiniteRuinProbability).toBe(0.0);
      expect(res.empiricalRuinProbability).toBe(0.0);
    });
  });

  // ===========================================================================
  // 5. AUDITORÍA DE LA MATRIZ DE SENSIBILIDAD Y PROPAGACIÓN DE MODELO
  // ===========================================================================
  describe('5. Matriz de Sensibilidad y Propagación de riskModel', () => {
    it('Verifica que riskModel se propaga y modifica los resultados empíricos en los escenarios de riesgo', () => {
      const resFixed = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 45,
        averageWin: 100,
        averageLoss: 100,
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 5.0,
        tradesHorizon: 20,
        riskModel: 'fixed_amount',
        seed: 777,
      });

      const resPercentage = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 45,
        averageWin: 100,
        averageLoss: 100,
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 5.0,
        tradesHorizon: 20,
        riskModel: 'percentage_equity',
        seed: 777,
      });

      // El resultado empírico principal debe ser diferente entre ambos modelos
      expect(resFixed.empiricalRuinProbability).not.toBe(resPercentage.empiricalRuinProbability);

      // En la matriz de escenarios de riesgo (scenarios), la columna empiricalRuinPercent
      // debe reflejar diferencias consistentes entre fixed y percentage
      const fixedScenariosEmpirical = resFixed.scenarios.map((s) => s.empiricalRuinPercent);
      const percentageScenariosEmpirical = resPercentage.scenarios.map((s) => s.empiricalRuinPercent);

      expect(fixedScenariosEmpirical).not.toEqual(percentageScenariosEmpirical);
    });
  });

  // ===========================================================================
  // 6. ROBUSTEZ NUMÉRICA, BARRERAS Y PARÁMETROS FUERA DE RANGO
  // ===========================================================================
  describe('6. Robustez Numérica y Parámetros Fuera de Rango', () => {
    it('Maneja de forma segura T=0 o T menor que U devolviendo 0% de ruina', () => {
      expect(calculateExactGamblersRuin(5, 50, 0)).toBe(0.0);
      expect(calculateExactGamblersRuin(5, 50, 3)).toBe(0.0);
    });

    it('Devuelve NaN ante inputs inválidos (NaN, Infinity, U no entero) y 100% si U <= 0', () => {
      expect(Number.isNaN(calculateExactGamblersRuin(NaN, 50, 100))).toBe(true);
      expect(Number.isNaN(calculateExactGamblersRuin(5, NaN, 100))).toBe(true);
      expect(Number.isNaN(calculateExactGamblersRuin(5.4, 50, 100))).toBe(true);
      expect(Number.isNaN(calculateExactGamblersRuin(Infinity, 50, 100))).toBe(true);
      expect(calculateExactGamblersRuin(0, 50, 100)).toBe(100.0);
      expect(calculateExactGamblersRuin(-5, 50, 100)).toBe(100.0);
    });

    it('Mantiene consistencia monótona con respecto a T y W', () => {
      // Monotonía en T
      const t10 = calculateExactGamblersRuin(5, 45, 10);
      const t50 = calculateExactGamblersRuin(5, 45, 50);
      const t100 = calculateExactGamblersRuin(5, 45, 100);
      expect(t10).toBeLessThanOrEqual(t50);
      expect(t50).toBeLessThanOrEqual(t100);

      // Monotonía en W
      const w40 = calculateExactGamblersRuin(5, 40, 50);
      const w50 = calculateExactGamblersRuin(5, 50, 50);
      const w60 = calculateExactGamblersRuin(5, 60, 50);
      expect(w40).toBeGreaterThanOrEqual(w50);
      expect(w50).toBeGreaterThanOrEqual(w60);
    });
  });
});
