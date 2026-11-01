// =============================================================================
// TradeRisk Manager — Exact Gambler's Ruin & Dynamic Programming Audit Suite
// Fase 5.2.1: Corrección y validación independiente del cálculo de riesgo de ruina
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  calculateRiskOfRuin,
  calculateExactGamblersRuin,
} from '../lib/analytics/risk-of-ruin';

describe('Fase 5.2.1: Validación Determinista de Ruina del Jugador (Dynamic Programming)', () => {
  // ---------------------------------------------------------------------------
  // 1. Invariantes Matemáticas y Casos Límite
  // ---------------------------------------------------------------------------
  describe('1. Invariantes y Condiciones de Frontera', () => {
    it('Caso Límite 1: Ruina finita es 0.0000% si el horizonte T < U', () => {
      // Con U = 5 y T = 4, incluso 4 derrotas consecutivas no alcanzan la barrera
      const p = calculateExactGamblersRuin(5, 40, 4);
      expect(p).toBe(0.0);
    });

    it('Caso Límite 2: Ruina finita es exactamente 100.0000% si Win Rate = 0% y T >= U', () => {
      const p = calculateExactGamblersRuin(5, 0, 10);
      expect(p).toBe(100.0);
    });

    it('Caso Límite 3: Ruina finita es exactamente 0.0000% si Win Rate = 100%', () => {
      const p = calculateExactGamblersRuin(5, 100, 100);
      expect(p).toBe(0.0);
    });

    it('Caso Límite 4: Ruina es 100.0000% si las unidades de capital U <= 0', () => {
      const p = calculateExactGamblersRuin(0, 50, 10);
      expect(p).toBe(100.0);
    });

    it('Invariante Monótona: La probabilidad de ruina crece monótonamente con el horizonte T', () => {
      const p10 = calculateExactGamblersRuin(5, 45, 10);
      const p50 = calculateExactGamblersRuin(5, 45, 50);
      const p100 = calculateExactGamblersRuin(5, 45, 100);
      const p200 = calculateExactGamblersRuin(5, 45, 200);

      expect(p10).toBeLessThan(p50);
      expect(p50).toBeLessThan(p100);
      expect(p100).toBeLessThan(p200);
    });

    it('Invariante Monótona: La probabilidad de ruina decrece estrictamente al aumentar la tasa de acierto W', () => {
      const pW40 = calculateExactGamblersRuin(5, 40, 100);
      const pW45 = calculateExactGamblersRuin(5, 45, 100);
      const pW50 = calculateExactGamblersRuin(5, 50, 100);
      const pW60 = calculateExactGamblersRuin(5, 60, 100);

      expect(pW40).toBeGreaterThan(pW45);
      expect(pW45).toBeGreaterThan(pW50);
      expect(pW50).toBeGreaterThan(pW60);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Validación de los 8 Escenarios Canónicos (Exacto DP vs Monte Carlo)
  // ---------------------------------------------------------------------------
  describe('2. Verificación de los 8 Escenarios Canónicos', () => {
    // Escenario A: W=0.40, U=3, T=50 -> Exact DP = 94.9825%
    it('Escenario A: W=0.40, U=3, T=50', () => {
      const exact = calculateExactGamblersRuin(3, 40, 50);
      expect(exact).toBeCloseTo(94.98, 1);

      const ror = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 40,
        averageWin: 100,
        averageLoss: 100,
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 3.0, // U = 3
        tradesHorizon: 50,
        riskModel: 'fixed_amount',
        seed: 101,
      });

      expect(ror.exactFiniteRuinProbability).toBe(94.98);
      // Monte Carlo con N=2000: SE = sqrt(0.95 * 0.05 / 2000) ≈ 0.49% -> IC 99% ± 1.26%
      expect(Math.abs(ror.finiteHorizonRuinProbability - exact)).toBeLessThan(1.5);
    });

    // Escenario B: W=0.40, U=5, T=100 -> Exact DP = 97.9956%
    it('Escenario B: W=0.40, U=5, T=100', () => {
      const exact = calculateExactGamblersRuin(5, 40, 100);
      expect(exact).toBeCloseTo(98.00, 1);

      const ror = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 40,
        averageWin: 100,
        averageLoss: 100,
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 5.0, // U = 5
        tradesHorizon: 100,
        riskModel: 'fixed_amount',
        seed: 101,
      });

      expect(ror.exactFiniteRuinProbability).toBe(98.00);
      // Monte Carlo con N=2000: SE ≈ 0.31%
      expect(Math.abs(ror.finiteHorizonRuinProbability - exact)).toBeLessThan(1.2);
    });

    // Escenario C: W=0.45, U=5, T=10 -> Exact DP = 17.4269%
    it('Escenario C: W=0.45, U=5, T=10', () => {
      const exact = calculateExactGamblersRuin(5, 45, 10);
      expect(exact).toBeCloseTo(17.43, 1);

      const ror = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 45,
        averageWin: 100,
        averageLoss: 100,
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 5.0, // U = 5
        tradesHorizon: 10,
        riskModel: 'fixed_amount',
        seed: 101,
      });

      expect(ror.exactFiniteRuinProbability).toBe(17.43);
      // Monte Carlo con N=2000: SE ≈ 0.85% -> IC 99% ± 2.2%
      expect(Math.abs(ror.finiteHorizonRuinProbability - exact)).toBeLessThan(2.5);
    });

    // Escenario D: W=0.45, U=5, T=100 -> Exact DP = 87.3602%
    it('Escenario D: W=0.45, U=5, T=100', () => {
      const exact = calculateExactGamblersRuin(5, 45, 100);
      expect(exact).toBeCloseTo(87.36, 1);

      const ror = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 45,
        averageWin: 100,
        averageLoss: 100,
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 5.0, // U = 5
        tradesHorizon: 100,
        riskModel: 'fixed_amount',
        seed: 101,
      });

      expect(ror.exactFiniteRuinProbability).toBe(87.36);
      // Monte Carlo con N=2000: SE ≈ 0.74%
      expect(Math.abs(ror.finiteHorizonRuinProbability - exact)).toBeLessThan(2.5);
    });

    // Escenario E: W=0.50, U=5, T=100 -> Exact DP = 61.7299%
    it('Escenario E: W=0.50, U=5, T=100', () => {
      const exact = calculateExactGamblersRuin(5, 50, 100);
      expect(exact).toBeCloseTo(61.73, 1);

      const ror = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 50,
        averageWin: 100,
        averageLoss: 100,
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 5.0, // U = 5
        tradesHorizon: 100,
        riskModel: 'fixed_amount',
        seed: 101,
      });

      expect(ror.exactFiniteRuinProbability).toBe(61.73);
      // Monte Carlo con N=2000: SE ≈ 1.09%
      expect(Math.abs(ror.finiteHorizonRuinProbability - exact)).toBeLessThan(3.0);
    });

    // Escenario F: W=0.60, U=5, T=100 -> Exact DP = 12.9048%
    it('Escenario F: W=0.60, U=5, T=100', () => {
      const exact = calculateExactGamblersRuin(5, 60, 100);
      expect(exact).toBeCloseTo(12.90, 1);

      const ror = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 60,
        averageWin: 100,
        averageLoss: 100,
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 5.0, // U = 5
        tradesHorizon: 100,
        riskModel: 'fixed_amount',
        seed: 101,
      });

      expect(ror.exactFiniteRuinProbability).toBe(12.90);
      // Asymptotico cerrado: ((1 - 0.20)/(1 + 0.20))^5 = (2/3)^5 = 13.17%
      expect(ror.asymptoticRuinProbability).toBeCloseTo(13.17, 1);
      // Monte Carlo con N=2000: SE ≈ 0.75%
      expect(Math.abs(ror.finiteHorizonRuinProbability - exact)).toBeLessThan(2.0);
    });

    // Escenario G: W=0.00, U=5, T=10 -> Exact DP = 100.0000%
    it('Escenario G: W=0.00, U=5, T=10', () => {
      const exact = calculateExactGamblersRuin(5, 0, 10);
      expect(exact).toBe(100.0);

      const ror = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 0,
        averageWin: 100,
        averageLoss: 100,
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 5.0, // U = 5
        tradesHorizon: 10,
        riskModel: 'fixed_amount',
        seed: 101,
      });

      expect(ror.exactFiniteRuinProbability).toBe(100.0);
      expect(ror.finiteHorizonRuinProbability).toBe(100.0);
    });

    // Escenario H: W=1.00, U=5, T=100 -> Exact DP = 0.0000%
    it('Escenario H: W=1.00, U=5, T=100', () => {
      const exact = calculateExactGamblersRuin(5, 100, 100);
      expect(exact).toBe(0.0);

      const ror = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 100,
        averageWin: 100,
        averageLoss: 100,
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 5.0, // U = 5
        tradesHorizon: 100,
        riskModel: 'fixed_amount',
        seed: 101,
      });

      expect(ror.exactFiniteRuinProbability).toBe(0.0);
      expect(ror.finiteHorizonRuinProbability).toBe(0.0);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Comparación Fixed Risk vs Percentage Equity Risk
  // ---------------------------------------------------------------------------
  describe('3. Diferenciación de Modelos: Riesgo Fijo vs Riesgo Porcentual', () => {
    it('Demuestra matemáticamente que el riesgo porcentual reduce la probabilidad de ruina para drawdowns parciales', () => {
      // Con capital 10,000 y límite 5% ($500), riesgo 1%:
      // - Riesgo fijo: Cada derrota resta $100. Ruina ocurre en exactamente 5 pérdidas netas.
      // - Riesgo porcentual: 10,000 * 0.99^5 = 9,509.90 > 9,500. Se requieren 6 derrotas netas.
      const rorFixed = calculateRiskOfRuin({
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

      const rorPercentage = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 45,
        averageWin: 100,
        averageLoss: 100,
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 5.0,
        tradesHorizon: 10,
        riskModel: 'percentage_equity',
        seed: 101,
      });

      // Fixed: 17.55% (coincide con exact DP U=5 -> 17.43%)
      // Percentage: 11.60% (coincide con exact DP U=6 -> 11.46%)
      expect(rorFixed.finiteHorizonRuinProbability).toBeGreaterThan(rorPercentage.finiteHorizonRuinProbability);
      expect(rorPercentage.finiteHorizonRuinProbability).toBeCloseTo(11.60, 0);
    });
  });
});
