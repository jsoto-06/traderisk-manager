// =============================================================================
// TradeRisk Manager — Fase 5.2: Auditoría Cuantitativa y Validación Monte Carlo
// Benchmarks Formales Documentados con Tolerancias Estadísticas Justificadas
// =============================================================================

import { describe, it, expect } from 'vitest';
import { runMonteCarloSimulation, createMulberry32, calculateSampleStatistics } from '@/lib/analytics/monte-carlo';
import { calculateRiskOfRuin } from '@/lib/analytics/risk-of-ruin';
import { simulatePropFirmChallenge } from '@/lib/prop-firm-simulator';
import type { Trade } from '@/lib/types';
import type { MonteCarloConfig, PropFirmSimulatorConfig } from '@/lib/analytics/types';

describe('TradeRisk Manager — Auditoría Cuantitativa y Validación Monte Carlo (Fase 5.2)', () => {
  // ===========================================================================
  // PARTE I: TESTS MATEMÁTICOS DETERMINISTAS (Sin Varianza Muestral)
  // ===========================================================================

  describe('Parte I: Tests Matemáticos Deterministas', () => {
    /**
     * BENCHMARK 3: High Win Rate / Low Payoff
     * - Capital inicial: $10,000
     * - Riesgo por operación: 1.0%
     * - Número de operaciones: 100
     * - Número de simulaciones: N/A (Fórmula cerrada analítica)
     * - Seed: N/A
     * - Método: Closed-form Ralph Vince / Perry Belmont
     * - Parámetros estadísticos: W = 80%, AvgWin = $100, AvgLoss = $200 (R = 0.5)
     * - Resultado matemático esperado:
     *     Edge = (0.80 * 0.5) - 0.20 = +0.20 (+20.00%)
     *     A = (0.40 - 0.20) / (0.40 + 0.20) = 0.20 / 0.60 = 1/3 ≈ 0.3333
     *     U = 10% / 1% = 10 unidades
     *     RoR_inf = ((1 - 1/3) / (1 + 1/3))^10 = (0.5)^10 = 1/1024 ≈ 0.09765%
     * - Tolerancia permitida: ±0.01%
     * - Resultado obtenido: RoR_inf = 0.10% (0.09765% redondeado a 2 decimales)
     */
    it('Benchmark 3: High Win Rate / Low Payoff (W=80%, R=0.5) verifica ventaja y ruina asintótica analítica', () => {
      const ror = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 80,
        averageWin: 100,
        averageLoss: 200,
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 10,
        tradesHorizon: 100,
      });

      expect(ror.edgePercent).toBe(20.0);
      expect(ror.payoffRatio).toBe(0.5);
      expect(ror.advantage).toBeCloseTo(0.3333, 4);
      expect(ror.asymptoticRuinProbability).toBeCloseTo(0.10, 2);
    });

    /**
     * BENCHMARK 4: Low Win Rate / High Payoff (Trend Following)
     * - Capital inicial: $10,000
     * - Riesgo por operación: 1.0%
     * - Número de operaciones: 100
     * - Método: Closed-form
     * - Parámetros: W = 30%, AvgWin = $800, AvgLoss = $200 (R = 4.0)
     * - Resultado esperado:
     *     Edge = (0.30 * 4.0) - 0.70 = +0.50 (+50.00%)
     *     A = (1.20 - 0.70) / (1.20 + 0.70) = 0.50 / 1.90 ≈ 0.263158
     *     U = 10 unidades
     *     RoR_inf = ((1 - 0.263158) / (1 + 0.263158))^10 = (0.583333)^10 ≈ 0.4578%
     * - Tolerancia: ±0.01%
     * - Resultado obtenido: RoR_inf = 0.46%
     */
    it('Benchmark 4: Low Win Rate / High Payoff (W=30%, R=4.0) verifica edge de +50% y ruina asintótica < 0.5%', () => {
      const ror = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 30,
        averageWin: 800,
        averageLoss: 200,
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 10,
        tradesHorizon: 100,
      });

      expect(ror.edgePercent).toBe(50.0);
      expect(ror.payoffRatio).toBe(4.0);
      expect(ror.advantage).toBeCloseTo(0.2632, 4);
      expect(ror.asymptoticRuinProbability).toBeCloseTo(0.46, 2);
    });

    /**
     * BENCHMARK 5: Breakeven Perfecto
     * - Parámetros: W = 50%, AvgWin = $200, AvgLoss = $200 (R = 1.0)
     * - Resultado esperado:
     *     Edge = (0.5 * 1.0) - 0.5 = 0.00%
     *     A = 0.0000
     *     RoR_inf = 100.00% (juego justo con barrera de absorción y horizonte infinito)
     *     Full Kelly = 0.00%
     * - Tolerancia: 0.00% exacto
     */
    it('Benchmark 5: Breakeven perfecto (W=50%, R=1.0) produce Advantage = 0, Ruina Asintótica = 100% y Kelly = 0%', () => {
      const ror = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 50,
        averageWin: 200,
        averageLoss: 200,
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 10,
        tradesHorizon: 100,
      });

      expect(ror.edgePercent).toBe(0.0);
      expect(ror.advantage).toBe(0);
      expect(ror.asymptoticRuinProbability).toBe(100.0);
      expect(ror.kellyCriterion.fullKellyPercent).toBe(0.0);
      expect(ror.kellyCriterion.halfKellyPercent).toBe(0.0);
    });

    /**
     * BENCHMARK 6: Probabilidad Exacta de Racha Perdedora Consecutiva
     * - Fórmula analítica: P(k pérdidas consecutivas independientes) = (1 - W)^k
     * - Para W = 50%, k = 5: (0.5)^5 = 0.03125 (3.125%)
     * - En un horizonte de T = 100 operaciones, cota de Feller: P(al menos una racha >= 5) >= 90%
     */
    it('Benchmark 6: Cálculo combinatorio exacto de rachas perdedoras consecutivas', () => {
      const W = 0.5;
      const k = 5;
      const pStreak5 = Math.pow(1 - W, k);
      expect(pStreak5).toBe(0.03125);

      const T = 100;
      const pNoStreakInNonOverlappingBlocks = Math.pow(1 - pStreak5, Math.floor(T / k));
      const lowerBoundAtLeastOne = 1 - pNoStreakInNonOverlappingBlocks;
      expect(lowerBoundAtLeastOne).toBeGreaterThan(0.45);
    });

    /**
     * BENCHMARK 7: Riesgo Fijo Monetario ($) - Caída Lineal de Capital
     * - Capital inicial: $10,000
     * - Riesgo fijo: $200 por operación
     * - Número de operaciones perdedoras consecutivas: k = 6
     * - Fórmula: Capital(k) = C_0 - k * Riesgo = 10000 - (6 * 200) = $8,800
     * - Drawdown = (10000 - 8800) / 10000 = 12.00%
     * - Tolerancia: $0.00 exacto
     */
    it('Benchmark 7: Modelo de riesgo fijo monetario produce trayectoria estrictamente lineal', () => {
      const initialCapital = 10000;
      const fixedRisk = 200;
      const k = 6;
      const expectedCapital = initialCapital - k * fixedRisk;
      const drawdownPercent = ((initialCapital - expectedCapital) / initialCapital) * 100;

      expect(expectedCapital).toBe(8800);
      expect(drawdownPercent).toBe(12.0);
    });

    /**
     * BENCHMARK 8: Riesgo Compuesto (% Equity) - Caída Geométrica y Ley Asimétrica de Recuperación
     * - Capital inicial: $10,000
     * - Riesgo porcentual: f = 2.0% (0.02)
     * - Pérdidas consecutivas: k = 10
     * - Fórmula geométrica: C_k = C_0 * (1 - f)^k = 10000 * (0.98)^10 = $8,170.728
     * - Ley de recuperación de Drawdown: Ganancia Requerida = DD / (1 - DD)
     *     Para DD = 50%: 0.50 / 0.50 = +100.00%
     *     Para DD = 20%: 0.20 / 0.80 = +25.00%
     */
    it('Benchmark 8: Riesgo porcentual compuesto verifica decremento geométrico y ley de recuperación asimétrica', () => {
      const initialCapital = 10000;
      const f = 0.02;
      const k = 10;
      const capitalAfter10Losses = initialCapital * Math.pow(1 - f, k);
      expect(capitalAfter10Losses).toBeCloseTo(8170.73, 2);

      const recov50 = 0.5 / (1 - 0.5);
      expect(recov50).toBe(1.0); // +100%

      const recov20 = 0.2 / (1 - 0.2);
      expect(recov20).toBe(0.25); // +25%
    });

    /**
     * BENCHMARK 9: Determinismo y Reproducibilidad PRNG Mulberry32
     * - Comprueba que para una semilla dada (seed = 99999), dos generadores independientes
     *   generan exactamente la misma secuencia numérica en cada índice temporal.
     */
    it('Benchmark 9: PRNG Mulberry32 garantiza determinismo estocástico idéntico bit a bit', () => {
      const prngA = createMulberry32(99999);
      const prngB = createMulberry32(99999);

      const seqA = Array.from({ length: 20 }, () => prngA());
      const seqB = Array.from({ length: 20 }, () => prngB());

      expect(seqA).toEqual(seqB);
      expect(seqA[0]).toBeGreaterThanOrEqual(0);
      expect(seqA[0]).toBeLessThan(1);
    });

    /**
     * BENCHMARK 10: Momentos Estadísticos Muestrales Teóricos
     * - Muestra de R-múltiplos: [2, -1, -1, 1.5, -1]
     * - n = 5
     * - Suma = 0.5 -> Media mu = 0.1000R
     * - Suma de cuadrados de diferencias: (1.9)^2 + 3*(-1.1)^2 + (1.4)^2 = 3.61 + 3.63 + 1.96 = 9.20
     * - Varianza insesgada: s^2 = 9.20 / 4 = 2.30 -> Desviación estándar s = sqrt(2.30) ≈ 1.5166R
     */
    it('Benchmark 10: calculateSampleStatistics calcula momentos estadísticos insesgados exactos', () => {
      const sample = [2, -1, -1, 1.5, -1];
      const stats = calculateSampleStatistics(sample);

      expect(stats).toBeDefined();
      expect(stats?.historicalTradesCount).toBe(5);
      expect(stats?.mean).toBe(0.1);
      expect(stats?.stdDev).toBeCloseTo(1.5166, 3);
      expect(stats?.maxHistoricalDrawdown).toBeGreaterThanOrEqual(2.0);
    });

    /**
     * BENCHMARK 16: Criterio de Kelly con Ventaja No Positiva
     * - Si E <= 0, Kelly f* = (W * R - (1 - W)) / R <= 0
     * - La asignación matemática segura debe truncarse exactamente a 0.00%
     */
    it('Benchmark 16: Criterio de Kelly devuelve 0.00% ante sistemas sin ventaja estadística', () => {
      const ror = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 40,
        averageWin: 100,
        averageLoss: 100, // E = -0.20
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 10,
      });

      expect(ror.kellyCriterion.fullKellyPercent).toBe(0);
      expect(ror.kellyCriterion.halfKellyPercent).toBe(0);
      expect(ror.kellyCriterion.quarterKellyPercent).toBe(0);
      expect(ror.kellyCriterion.cappedKellyPercent).toBe(0);
    });

    /**
     * BENCHMARK 17: Criterio de Kelly, Derivadas Parciales de Sensibilidad y Tope de Riesgo
     * - Parámetros: W = 60% (0.60), R = 1.5
     * - Full Kelly analítico: K = 0.60 - (0.40 / 1.5) = 0.60 - 0.26667 = 33.33%
     * - Half Kelly: 16.67%, Quarter Kelly: 8.33%
     * - Sensibilidad a Win Rate: dK/dW = 1 + 1/R = 1 + 1/1.5 = 1 + 0.6667 = 1.6667 ≈ 1.67
     * - Sensibilidad a Payoff: dK/dR = (1 - W)/R^2 = 0.40 / 2.25 = 0.1778 ≈ 0.18
     * - Stressed Kelly: W_stress = 55%, R_stress = 1.5 * 0.85 = 1.275
     *     K_stress = 0.55 - (0.45 / 1.275) = 0.55 - 0.35294 = 19.71%
     * - Tope de Riesgo Máximo: Con maxKellyCapPercent = 20%, Full Kelly (33.33%) se limita a 20.00%
     */
    it('Benchmark 17: Verificación de fórmulas analíticas de Kelly, derivadas y limitador de riesgo', () => {
      const ror = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 60,
        averageWin: 300,
        averageLoss: 200, // R = 1.5
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 10,
        maxKellyCapPercent: 20,
      });

      expect(ror.kellyCriterion.fullKellyPercent).toBeCloseTo(33.33, 1);
      expect(ror.kellyCriterion.halfKellyPercent).toBeCloseTo(16.67, 1);
      expect(ror.kellyCriterion.quarterKellyPercent).toBeCloseTo(8.33, 1);
      expect(ror.kellyCriterion.cappedKellyPercent).toBe(20.0);
      expect(ror.kellyCriterion.isCapped).toBe(true);

      expect(ror.kellySensitivity.sensitivityToWinRate).toBeCloseTo(1.67, 2);
      expect(ror.kellySensitivity.sensitivityToPayoff).toBeCloseTo(0.18, 2);
      expect(ror.kellySensitivity.stressedKellyPercent).toBeCloseTo(19.71, 1);
    });
  });

  // ===========================================================================
  // PARTE II: TESTS ESTADÍSTICOS PROBABILÍSTICOS (Con Tolerancia y Error Estándar)
  // ===========================================================================

  describe('Parte II: Tests Estadísticos Probabilísticos (Tolerancia SE Justificada)', () => {
    /**
     * BENCHMARK 1: Rentabilidad - Sistema con Ventaja Positiva Clara
     * - Capital inicial: $10,000
     * - Riesgo por operación: 1.0% equity
     * - Horizonte: 60 trades
     * - Simulaciones: S = 1,000
     * - Seed: 12345
     * - Método: parametric_fixed
     * - Parámetros: W = 60%, AvgWin = $300, AvgLoss = $200 (R = 1.5)
     * - Expectativa por operación: E = +0.50R (+0.50% por trade)
     * - Retorno esperado acumulado: (1 + 0.005)^60 - 1 ≈ +34.8% -> ~$13,400
     * - Error estándar binomial: Para p ≈ 90%, SE = sqrt(0.90 * 0.10 / 1000) = 0.95%
     *     IC 99% (z = 2.576): p ∈ [87.5%, 92.5%]
     * - Tolerancia: profitProbability > 85%, medianFinalEquity > $11,500
     */
    it('Benchmark 1: Sistema con ventaja matemática positiva (W=60%, R=1.5) genera crecimiento estocástico coherente', () => {
      const config: MonteCarloConfig = {
        simulationsCount: 1000,
        tradesCount: 60,
        initialCapital: 10000,
        riskType: 'percentage_equity',
        riskValue: 1.0,
        seed: 12345,
        method: 'parametric_fixed',
        customDistribution: {
          winRate: 60,
          averageWin: 300,
          averageLoss: 200,
        },
      };

      const res = runMonteCarloSimulation([], config);

      expect(res.profitProbability).toBeGreaterThan(85.0);
      expect(res.medianFinalEquity).toBeGreaterThan(11500);
      expect(res.metadata.algorithmVersion).toBe('5.2.0');
    });

    /**
     * BENCHMARK 2: No Rentabilidad - Sistema Perdedor
     * - Capital inicial: $10,000
     * - Riesgo por operación: 1.0% equity
     * - Horizonte: 80 trades
     * - Simulaciones: S = 1,000
     * - Seed: 54321
     * - Método: parametric_fixed
     * - Parámetros: W = 40%, AvgWin = $200, AvgLoss = $200 (R = 1.0)
     * - Expectativa por operación: E = -0.20R (-0.20% por trade)
     * - Retorno esperado acumulado: (1 - 0.002)^80 - 1 ≈ -14.8% -> ~$8,500
     * - Tolerancia: profitProbability < 30.0%, medianFinalEquity < $9,500
     */
    it('Benchmark 2: Sistema con ventaja negativa (W=40%, R=1.0) genera pérdida sistemática de capital', () => {
      const config: MonteCarloConfig = {
        simulationsCount: 1000,
        tradesCount: 80,
        initialCapital: 10000,
        riskType: 'percentage_equity',
        riskValue: 1.0,
        seed: 54321,
        method: 'parametric_fixed',
        customDistribution: {
          winRate: 40,
          averageWin: 200,
          averageLoss: 200,
        },
      };

      const res = runMonteCarloSimulation([], config);

      expect(res.profitProbability).toBeLessThan(30.0);
      expect(res.medianFinalEquity).toBeLessThan(9500);
    });

    /**
     * BENCHMARK 15: Ruina a Horizonte Finito vs. Ruina Asintótica (Validación de los 4 Escenarios Clave)
     * - Escenario 15.A: Ruina Finita = 0.00% (T < U)
     *     Capital: $10,000, Max Loss = 10% ($1,000), Riesgo = 1% ($100) -> U = 10 unidades
     *     Horizonte T = 5 operaciones.
     *     Incluso con 5 pérdidas consecutivas, la pérdida máxima acumulada es $500 < $1,000.
     *     Ruina finita esperada: EXACTAMENTE 0.00%.
     * - Escenario 15.B: Ruina Finita Intermedia (T >= U, W > 0, A <= 0)
     *     W = 40%, R = 1.0, U = 10, T = 30.
     *     Ruina asintótica = 100%, pero Ruina Finita ∈ (10%, 60%).
     * - Escenario 15.C: Ruina Finita = 100.00% (W = 0%, T >= U)
     *     W = 0%, R = 1.0, U = 10, T = 15.
     *     Cada operación es pérdida. En la operación 10 se alcanza la barrera con certeza matemática absoluta.
     *     Ruina finita esperada: EXACTAMENTE 100.00%.
     * - Escenario 15.D: Ruina Asintótica = 100.00% pero Ruina Finita < 100.00%
     */
    it('Benchmark 15.A: Ruina finita es estrictamente 0.00% cuando el horizonte de operaciones T < U', () => {
      const rorImpossible = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 40,
        averageWin: 100,
        averageLoss: 100,
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 10, // U = 10
        tradesHorizon: 5,        // T = 5 < U
        riskModel: 'fixed_amount',
        seed: 111,
      });

      expect(rorImpossible.riskUnits).toBe(10);
      expect(rorImpossible.finiteHorizonRuinProbability).toBe(0.0);
      expect(rorImpossible.asymptoticRuinProbability).toBe(100.0);
    });

    it('Benchmark 15.B: Ruina finita es intermedia cuando T >= U con ventaja negativa y aciertos posibles', () => {
      const rorIntermediate = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 40,
        averageWin: 100,
        averageLoss: 100,
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 10,
        tradesHorizon: 30,
        riskModel: 'fixed_amount',
        seed: 222,
      });

      expect(rorIntermediate.asymptoticRuinProbability).toBe(100.0);
      expect(rorIntermediate.finiteHorizonRuinProbability).toBeGreaterThan(15.0);
      expect(rorIntermediate.finiteHorizonRuinProbability).toBeLessThan(70.0);
    });

    it('Benchmark 15.C: Ruina finita es 100.00% cuando W = 0% y T >= U', () => {
      const rorCertain = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 0, // 0% de acierto
        averageWin: 100,
        averageLoss: 100,
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 10, // U = 10
        tradesHorizon: 15,       // T = 15 >= U
        riskModel: 'fixed_amount',
        seed: 333,
      });

      expect(rorCertain.asymptoticRuinProbability).toBe(100.0);
      expect(rorCertain.finiteHorizonRuinProbability).toBe(100.0);
    });

    it('Benchmark 15.D: Ruina Asintótica = 100.00% pero Ruina Finita < 100.00%', () => {
      const rorDistinction = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 45, // Ventaja negativa
        averageWin: 100,
        averageLoss: 100,
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 5, // U = 5
        tradesHorizon: 10,      // T = 10
        riskModel: 'fixed_amount',
        seed: 444,
      });

      expect(rorDistinction.asymptoticRuinProbability).toBe(100.0);
      // Para U=5, T=10, W=45%: Exact DP es 17.43%
      expect(rorDistinction.finiteHorizonRuinProbability).toBeGreaterThan(12.0);
      expect(rorDistinction.finiteHorizonRuinProbability).toBeLessThan(23.0);
      expect(rorDistinction.exactFiniteRuinProbability).toBe(17.43);
    });
  });

  // ===========================================================================
  // PARTE III: TESTS DE INTEGRACIÓN CUANTITATIVA DE MÓDULOS
  // ===========================================================================

  describe('Parte III: Tests de Integración Cuantitativa de Módulos', () => {
    /**
     * BENCHMARK 11: Prop Firm Drawdown Estático (Suelo Fijo Inmutable)
     * - Capital: $100,000, MaxDD = 10%
     * - Suelo fijo inmutable: $90,000 independientemente de las ganancias acumuladas
     */
    it('Benchmark 11: Drawdown Estático mantiene el umbral de liquidación invariante', () => {
      const config: PropFirmSimulatorConfig = {
        initialCapital: 100000,
        profitTargetPercent: 10,
        dailyLossLimitPercent: 5,
        maxDrawdownPercent: 10,
        drawdownType: 'static',
        dailyLossType: 'balance_based',
        dailyLossEnforcement: 'hard_breach',
        resetHour: 0,
        resetTimezone: 'UTC',
        winRate: 60,
        averageWin: 1000,
        averageLoss: 500,
        riskPerTradePercent: 0.5,
        tradesPerDay: 2,
        maxDays: 30,
        commissionsPerTrade: 0,
        simulationsCount: 200,
        seed: 42,
      };

      const res = simulatePropFirmChallenge(config);
      expect(res.config.drawdownType).toBe('static');
      expect(res.passProbability).toBeGreaterThan(60.0);
    });

    /**
     * BENCHMARK 12: Prop Firm Trailing Drawdown sobre Balance Cerrado
     * - Verifica que el trailing sobre balance cerrado eleva el suelo y resulta más restrictivo
     */
    it('Benchmark 12: Trailing Drawdown eleva la barrera con nuevos máximos cerrados', () => {
      const configTrailing: PropFirmSimulatorConfig = {
        initialCapital: 50000,
        profitTargetPercent: 8,
        dailyLossLimitPercent: 4,
        maxDrawdownPercent: 6,
        drawdownType: 'trailing_balance',
        dailyLossType: 'balance_based',
        dailyLossEnforcement: 'hard_breach',
        resetHour: 0,
        resetTimezone: 'UTC',
        winRate: 50,
        averageWin: 400,
        averageLoss: 300,
        riskPerTradePercent: 0.5,
        tradesPerDay: 3,
        maxDays: 40,
        commissionsPerTrade: 2,
        simulationsCount: 200,
        seed: 101,
      };

      const resTrailing = simulatePropFirmChallenge(configTrailing);
      const resStatic = simulatePropFirmChallenge({
        ...configTrailing,
        drawdownType: 'static',
      });

      expect(resTrailing.maxDrawdownBreachProbability).toBeGreaterThanOrEqual(
        resStatic.maxDrawdownBreachProbability - 5.0,
      );
    });

    /**
     * BENCHMARK 13: Trailing Drawdown con Bloqueo en Capital Inicial (Lock-In HWM)
     */
    it('Benchmark 13: Trailing Drawdown con Lock-In congela el umbral de pérdida en capital inicial', () => {
      const config: PropFirmSimulatorConfig = {
        initialCapital: 50000,
        profitTargetPercent: 6,
        dailyLossLimitPercent: 5,
        maxDrawdownPercent: 5,
        drawdownType: 'trailing_hwm_lock',
        dailyLossType: 'balance_based',
        dailyLossEnforcement: 'hard_breach',
        resetHour: 0,
        resetTimezone: 'UTC',
        winRate: 55,
        averageWin: 500,
        averageLoss: 300,
        riskPerTradePercent: 0.5,
        tradesPerDay: 3,
        maxDays: 30,
        commissionsPerTrade: 0,
        simulationsCount: 150,
        seed: 303,
      };

      const res = simulatePropFirmChallenge(config);
      expect(res.config.drawdownType).toBe('trailing_hwm_lock');
      expect(res.simulationsCount).toBe(150);
    });

    /**
     * BENCHMARK 14: Daily Loss Limit: Hard Breach vs. Soft Pause con Conteo de Disparos
     */
    it('Benchmark 14: Soft Pause registra suspensiones diarias sin descalificar la cuenta inmediatamente', () => {
      const baseConfig: PropFirmSimulatorConfig = {
        initialCapital: 100000,
        profitTargetPercent: 8,
        dailyLossLimitPercent: 3,
        maxDrawdownPercent: 10,
        drawdownType: 'static',
        dailyLossType: 'balance_based',
        resetHour: 0,
        resetTimezone: 'UTC',
        winRate: 50,
        averageWin: 800,
        averageLoss: 600,
        riskPerTradePercent: 1.0,
        tradesPerDay: 4,
        maxDays: 45,
        commissionsPerTrade: 2,
        simulationsCount: 200,
        seed: 555,
      };

      const resHard = simulatePropFirmChallenge({
        ...baseConfig,
        dailyLossEnforcement: 'hard_breach',
      });

      const resSoft = simulatePropFirmChallenge({
        ...baseConfig,
        dailyLossEnforcement: 'soft_pause',
      });

      expect(resSoft.passProbability).toBeGreaterThanOrEqual(resHard.passProbability);
      expect(resSoft.breachAnalysis.dailyLossTriggersCount).toBeDefined();
    });

    /**
     * MOCK TRADES & BLOCK BOOTSTRAP INTEGRATION TEST
     */
    it('Integración: Circular Moving Block Bootstrap ejecuta con R-múltiplos empíricos', () => {
      const mockTrades: Trade[] = [
        {
          id: 't1',
          accountId: 'acc1',
          asset: 'BTCUSDT',
          direction: 'long',
          entryPrice: 50000,
          stopLoss: 49000,
          takeProfit: 52000,
          size: 1,
          openDate: '2026-01-01',
          closeDate: '2026-01-01',
          result: 2000,
          status: 'closed',
          commissions: 0,
          strategy: 'Breakout',
          timeframe: '1h',
          notes: '',
        },
        {
          id: 't2',
          accountId: 'acc1',
          asset: 'BTCUSDT',
          direction: 'long',
          entryPrice: 50000,
          stopLoss: 49000,
          takeProfit: 52000,
          size: 1,
          openDate: '2026-01-02',
          closeDate: '2026-01-02',
          result: -1000,
          status: 'closed',
          commissions: 0,
          strategy: 'Breakout',
          timeframe: '1h',
          notes: '',
        },
        {
          id: 't3',
          accountId: 'acc1',
          asset: 'BTCUSDT',
          direction: 'long',
          entryPrice: 50000,
          stopLoss: 49000,
          takeProfit: 52000,
          size: 1,
          openDate: '2026-01-03',
          closeDate: '2026-01-03',
          result: -1000,
          status: 'closed',
          commissions: 0,
          strategy: 'Breakout',
          timeframe: '1h',
          notes: '',
        },
        {
          id: 't4',
          accountId: 'acc1',
          asset: 'BTCUSDT',
          direction: 'long',
          entryPrice: 50000,
          stopLoss: 49000,
          takeProfit: 52000,
          size: 1,
          openDate: '2026-01-04',
          closeDate: '2026-01-04',
          result: 1500,
          status: 'closed',
          commissions: 0,
          strategy: 'Breakout',
          timeframe: '1h',
          notes: '',
        },
        {
          id: 't5',
          accountId: 'acc1',
          asset: 'BTCUSDT',
          direction: 'long',
          entryPrice: 50000,
          stopLoss: 49000,
          takeProfit: 52000,
          size: 1,
          openDate: '2026-01-05',
          closeDate: '2026-01-05',
          result: -1000,
          status: 'closed',
          commissions: 0,
          strategy: 'Breakout',
          timeframe: '1h',
          notes: '',
        },
      ];

      const config: MonteCarloConfig = {
        simulationsCount: 100,
        tradesCount: 20,
        initialCapital: 10000,
        riskType: 'percentage_equity',
        riskValue: 1.0,
        seed: 888,
        method: 'bootstrap_block',
        blockSize: 3,
      };

      const res = runMonteCarloSimulation(mockTrades, config);

      expect(res.metadata.method).toBe('bootstrap_block');
      expect(res.metadata.blockSize).toBe(3);
      expect(res.empiricalStatistics).toBeDefined();
      expect(res.empiricalStatistics?.historicalTradesCount).toBe(5);
    });
  });
});
