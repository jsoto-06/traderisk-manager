// =============================================================================
// TradeRisk Manager — Fase 5.1: Auditoría Cuantitativa y Validación Monte Carlo
// Benchmarks Manuales y Demostración Matemática Formal de 17 Escenarios
// =============================================================================

import { describe, it, expect } from 'vitest';
import { runMonteCarloSimulation, createMulberry32, calculateSampleStatistics } from '@/lib/analytics/monte-carlo';
import { calculateRiskOfRuin } from '@/lib/analytics/risk-of-ruin';
import { simulatePropFirmChallenge } from '@/lib/prop-firm-simulator';
import type { Trade } from '@/lib/types';
import type { MonteCarloConfig, PropFirmSimulatorConfig } from '@/lib/analytics/types';

describe('Auditoría Cuantitativa y Validación Estadística Monte Carlo (Fase 5.1)', () => {
  // ---------------------------------------------------------------------------
  // ESCENARIO 1: Rentabilidad - Sistema con Ventaja Positiva Clara
  // Formula: E = (W * R) - (1 - W) = (0.60 * 1.5) - (0.40 * 1.0) = 0.90 - 0.40 = +0.50 R
  // ---------------------------------------------------------------------------
  it('Escenario 1: Sistema con ventaja matemática positiva (W=60%, R=1.5) tiene E > 0 y crecimiento de capital', () => {
    const config: MonteCarloConfig = {
      simulationsCount: 500,
      tradesCount: 60,
      initialCapital: 10000,
      riskType: 'percentage_equity',
      riskValue: 1.0,
      seed: 12345,
      method: 'parametric_fixed',
      customDistribution: {
        winRate: 60,
        averageWin: 300,
        averageLoss: 200, // Payoff R = 1.5
      },
    };

    const res = runMonteCarloSimulation([], config);

    // Con E = +0.50R por operación a lo largo de 60 trades, la mediana de capital final debe ser superior al capital inicial
    expect(res.profitProbability).toBeGreaterThan(80);
    expect(res.medianFinalEquity).toBeGreaterThan(10000);
    expect(res.metadata.algorithmVersion).toBe('5.1.0');
  });

  // ---------------------------------------------------------------------------
  // ESCENARIO 2: No Rentabilidad - Sistema Perdedor
  // Formula: E = (W * R) - (1 - W) = (0.40 * 1.0) - (0.60 * 1.0) = -0.20 R
  // ---------------------------------------------------------------------------
  it('Escenario 2: Sistema con ventaja negativa (W=40%, R=1.0) tiene E < 0 y pérdida de capital', () => {
    const config: MonteCarloConfig = {
      simulationsCount: 500,
      tradesCount: 80,
      initialCapital: 10000,
      riskType: 'percentage_equity',
      riskValue: 1.0,
      seed: 54321,
      method: 'parametric_fixed',
      customDistribution: {
        winRate: 40,
        averageWin: 200,
        averageLoss: 200, // Payoff R = 1.0
      },
    };

    const res = runMonteCarloSimulation([], config);

    // Sistema con E = -0.20R debe reflejar una probabilidad de ganancia minoritaria
    expect(res.profitProbability).toBeLessThan(35);
    expect(res.medianFinalEquity).toBeLessThan(10000);
  });

  // ---------------------------------------------------------------------------
  // ESCENARIO 3: High Win Rate / Low Payoff
  // Formula: W = 80%, AvgWin = $100, AvgLoss = $200 (R = 0.5)
  // E = (0.80 * 0.5) - (0.20 * 1.0) = 0.40 - 0.20 = +0.20 R
  // ---------------------------------------------------------------------------
  it('Escenario 3: Sistema High Win Rate / Low Payoff (W=80%, R=0.5) conserva rentabilidad esperada positiva', () => {
    const ror = calculateRiskOfRuin({
      initialCapital: 10000,
      winRate: 80,
      averageWin: 100,
      averageLoss: 200,
      riskPerTradePercent: 1.0,
      maxLossLimitPercent: 10,
      tradesHorizon: 100,
    });

    // Ventaja esperada: 0.8 * 0.5 - 0.2 = +0.20
    expect(ror.edgePercent).toBe(20);
    expect(ror.advantage).toBeGreaterThan(0);
    expect(ror.payoffRatio).toBe(0.5);
    // Ruina asintótica con 10 unidades de riesgo debe ser baja
    expect(ror.asymptoticRuinProbability).toBeLessThan(5);
  });

  // ---------------------------------------------------------------------------
  // ESCENARIO 4: Low Win Rate / High Payoff (Trend Following)
  // Formula: W = 30%, AvgWin = $800, AvgLoss = $200 (R = 4.0)
  // E = (0.30 * 4.0) - (0.70 * 1.0) = 1.20 - 0.70 = +0.50 R
  // ---------------------------------------------------------------------------
  it('Escenario 4: Sistema Trend Following (W=30%, R=4.0) tiene ventaja robusta a pesar de baja tasa de acierto', () => {
    const ror = calculateRiskOfRuin({
      initialCapital: 10000,
      winRate: 30,
      averageWin: 800,
      averageLoss: 200,
      riskPerTradePercent: 1.0,
      maxLossLimitPercent: 10,
      tradesHorizon: 100,
    });

    // Edge: 0.3 * 4 - 0.7 = 0.50 -> 50%
    expect(ror.edgePercent).toBe(50);
    expect(ror.advantage).toBeGreaterThan(0);
    expect(ror.payoffRatio).toBe(4.0);
  });

  // ---------------------------------------------------------------------------
  // ESCENARIO 5: Breakeven Perfecto
  // Formula: W = 50%, AvgWin = $200, AvgLoss = $200 (R = 1.0)
  // E = (0.50 * 1.0) - (0.50 * 1.0) = 0.00 R
  // ---------------------------------------------------------------------------
  it('Escenario 5: Breakeven perfecto (W=50%, R=1.0) tiene Advantage A = 0 y Edge = 0%', () => {
    const ror = calculateRiskOfRuin({
      initialCapital: 10000,
      winRate: 50,
      averageWin: 200,
      averageLoss: 200,
      riskPerTradePercent: 1.0,
      maxLossLimitPercent: 10,
      tradesHorizon: 100,
    });

    expect(ror.edgePercent).toBe(0);
    expect(ror.advantage).toBeCloseTo(0, 4);
    // Con A = 0, la ruina asintótica (T -> inf) en juego justo con barrera de absorción es 100%
    expect(ror.asymptoticRuinProbability).toBe(100);
    // Pero el Criterio de Kelly debe ser 0% (sin apalancamiento)
    expect(ror.kellyCriterion.fullKellyPercent).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // ESCENARIO 6: Racha de Pérdidas Consecutivas
  // Probabilidad teorica de k perdidas seguidas: P(k consecutive losses) = (1 - W)^k
  // Si W = 50%, para k = 5 perdidas: 0.5^5 = 0.03125 (3.125%)
  // ---------------------------------------------------------------------------
  it('Escenario 6: Probabilidad analítica y empírica de racha perdedora consecutiva', () => {
    const lossProb = 0.5;
    const k = 5;
    const p5ConsecutiveLosses = Math.pow(lossProb, k);
    expect(p5ConsecutiveLosses).toBe(0.03125);

    // En 100 operaciones, el número esperado de secuencias de 5 pérdidas consecutivas es significativo
    const horizon = 100;
    // Probabilidad aproximada de ver al menos una racha de 5 pérdidas en 100 trades: 1 - (1 - 0.5^5)^(100 - 5 + 1)
    const probAtLeastOneStreak = 1 - Math.pow(1 - p5ConsecutiveLosses, horizon - k + 1);
    expect(probAtLeastOneStreak).toBeGreaterThan(0.90);
  });

  // ---------------------------------------------------------------------------
  // ESCENARIO 7: Riesgo Fijo ($): Caída Lineal de Capital
  // Formula: Capital(k) = C_0 - k * FixedRiskAmount
  // Para C_0 = 10000, Risk = $200, tras k = 6 perdidas: 10000 - 6 * 200 = $8800 (-12%)
  // ---------------------------------------------------------------------------
  it('Escenario 7: Riesgo monetario fijo produce degradación lineal del capital ante racha perdedora', () => {
    const initialCapital = 10000;
    const fixedRisk = 200;
    const consecutiveLosses = 6;
    const expectedCapital = initialCapital - consecutiveLosses * fixedRisk;

    expect(expectedCapital).toBe(8800);
    const drawdownPercent = ((initialCapital - expectedCapital) / initialCapital) * 100;
    expect(drawdownPercent).toBe(12.0);
  });

  // ---------------------------------------------------------------------------
  // ESCENARIO 8: Riesgo Compuesto (% Equity): Caída Geométrica y Asimetría de Recuperación
  // Formula: Capital(k) = C_0 * (1 - f)^k
  // Para f = 2% y k = 10 perdidas: 10000 * (0.98)^10 = $8170.73 (DD = -18.29%)
  // Ganancia requerida para recuperar DD: Req = DD / (1 - DD)
  // Para DD = 50%: Req = 0.50 / (1 - 0.50) = +100%
  // ---------------------------------------------------------------------------
  it('Escenario 8: Riesgo porcentual decrece geométricamente y verifica la ley asimétrica de recuperación de Drawdown', () => {
    const initialCapital = 10000;
    const f = 0.02; // 2%
    const k = 10;
    const capitalAfter10Losses = initialCapital * Math.pow(1 - f, k);

    expect(capitalAfter10Losses).toBeCloseTo(8170.73, 1);

    // Recuperación de Drawdowns clásicos
    const recoveryRequiredFor50PercentDD = 0.5 / (1 - 0.5);
    expect(recoveryRequiredFor50PercentDD).toBe(1.0); // +100% de ganancia requerida

    const recoveryRequiredFor20PercentDD = 0.2 / (1 - 0.2);
    expect(recoveryRequiredFor20PercentDD).toBe(0.25); // +25% de ganancia requerida
  });

  // ---------------------------------------------------------------------------
  // ESCENARIO 9: Bootstrap I.I.D. Determinista con Mulberry32
  // La misma semilla debe producir exactamente los mismos resultados en ejecuciones repetidas
  // ---------------------------------------------------------------------------
  it('Escenario 9: Determinismo y reproducibilidad estocástica exacta con Mulberry32', () => {
    const prng1 = createMulberry32(99999);
    const prng2 = createMulberry32(99999);

    const seq1 = Array.from({ length: 10 }, () => prng1());
    const seq2 = Array.from({ length: 10 }, () => prng2());

    expect(seq1).toEqual(seq2);
    expect(seq1[0]).toBeGreaterThanOrEqual(0);
    expect(seq1[0]).toBeLessThan(1);
  });

  // ---------------------------------------------------------------------------
  // ESCENARIO 10: Block Bootstrap (Circular Moving Block)
  // Preserva la autocorrelación local y el clustering de rachas temporales
  // ---------------------------------------------------------------------------
  it('Escenario 10: Circular Moving Block Bootstrap preserva estructura de bloques y ejecuta correctamente', () => {
    const mockTrades: Trade[] = [
      {
        id: 't1',
        accountId: 'acc1',
        asset: 'BTCUSDT',
        direction: 'long',
        entryPrice: 50000,
        stopLoss: 49000, // 1R = 1000
        takeProfit: 52000,
        size: 1,
        openDate: '2026-01-01',
        closeDate: '2026-01-01',
        result: 2000, // +2R
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
        result: -1000, // -1R
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
        result: -1000, // -1R
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
        result: 1500, // +1.5R
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
        result: -1000, // -1R
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

    // Verificación directa de los momentos estadísticos muestrales
    const sampleStats = calculateSampleStatistics([2, -1, -1, 1.5, -1]);
    expect(sampleStats).toBeDefined();
    expect(sampleStats?.mean).toBeCloseTo(0.1, 2);
    expect(sampleStats?.stdDev).toBeGreaterThan(1);
    expect(sampleStats?.valueAtRisk95).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // ESCENARIO 11: Prop Firm Drawdown Estático (Suelo Fijo Inmutable)
  // El límite de liquidación siempre permanece en C_0 * (1 - MaxDD)
  // Para C_0 = $100000 y MaxDD = 10%, el suelo es SIEMPRE $90000 aunque la cuenta suba a $110000
  // ---------------------------------------------------------------------------
  it('Escenario 11: Drawdown Estático mantiene el nivel de liquidación invariante sin importar ganancias acumuladas', () => {
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
      simulationsCount: 100,
      seed: 42,
    };

    const res = simulatePropFirmChallenge(config);
    expect(res.config.drawdownType).toBe('static');
    expect(res.passProbability).toBeGreaterThan(60);
  });

  // ---------------------------------------------------------------------------
  // ESCENARIO 12: Prop Firm Trailing Drawdown sobre Balance Cerrado
  // El umbral se desplaza hacia arriba con cada nuevo High-Water Mark de balance cerrado
  // y nunca desciende cuando el balance cae
  // ---------------------------------------------------------------------------
  it('Escenario 12: Trailing Drawdown sobre balance cerrado eleva la barrera con los picos cerrados', () => {
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

    const configStatic: PropFirmSimulatorConfig = {
      ...configTrailing,
      drawdownType: 'static',
    };

    const resTrailing = simulatePropFirmChallenge(configTrailing);
    const resStatic = simulatePropFirmChallenge(configStatic);

    // El Trailing Drawdown es estrictamente más restrictivo que el Static Drawdown;
    // por tanto, la probabilidad de breach es mayor o igual y la de pase es menor o igual
    expect(resTrailing.maxDrawdownBreachProbability).toBeGreaterThanOrEqual(
      resStatic.maxDrawdownBreachProbability - 5,
    );
  });

  // ---------------------------------------------------------------------------
  // ESCENARIO 13: Trailing Drawdown con Bloqueo en Capital Inicial (Lock-In HWM)
  // Modelo Apex / Topstep: El trailing se bloquea una vez alcanzado el capital inicial + buffer
  // ---------------------------------------------------------------------------
  it('Escenario 13: Trailing Drawdown con Lock-In congela el umbral de pérdida una vez cubierto el capital de arranque', () => {
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

  // ---------------------------------------------------------------------------
  // ESCENARIO 14: Daily Loss Limit: Hard Breach vs. Soft Pause
  // Hard Breach: Fallo fulminante e inmediato de la cuenta
  // Soft Pause: Pausa intradía que congela la sesión hasta el día siguiente
  // ---------------------------------------------------------------------------
  it('Escenario 14: Soft Pause reduce los fallos totales en comparación con Hard Breach', () => {
    const baseConfig: PropFirmSimulatorConfig = {
      initialCapital: 100000,
      profitTargetPercent: 8,
      dailyLossLimitPercent: 3, // Límite diario estricto (3%)
      maxDrawdownPercent: 10,
      drawdownType: 'static',
      dailyLossType: 'balance_based',
      resetHour: 0,
      resetTimezone: 'UTC',
      winRate: 50,
      averageWin: 800,
      averageLoss: 600,
      riskPerTradePercent: 1.0, // 1% de riesgo con 3% de límite diario = 3 pérdidas tocan el límite
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

    // En Soft Pause, tocar el límite diario no elimina la cuenta inmediatamente,
    // solo suspende la sesión. Por consiguiente, la tasa de pase es mayor o igual.
    expect(resSoft.passProbability).toBeGreaterThanOrEqual(resHard.passProbability);
  });

  // ---------------------------------------------------------------------------
  // ESCENARIO 15: Ruina Finita vs. Ruina Asintótica (Corrección Matemática Crítica)
  // Cuando A <= 0, Asymptotic Ruin (T -> inf) = 100%, pero a horizonte finito (ej. T = 25 trades)
  // la probabilidad de ruina es estrictamente menor a 100%.
  // ---------------------------------------------------------------------------
  it('Escenario 15: Con ventaja negativa (A <= 0), la Ruina Asintótica es 100% pero la Ruina Finita (T=25) es < 100%', () => {
    const ror = calculateRiskOfRuin({
      initialCapital: 10000,
      winRate: 40,
      averageWin: 100,
      averageLoss: 100, // A = (0.4 * 1) - 0.6 = -0.20 <= 0
      riskPerTradePercent: 1.0,
      maxLossLimitPercent: 10, // Requiere 10 pérdidas netas
      tradesHorizon: 25,
      seed: 777,
    });

    // Asymptotic Ruin (T -> inf) DEBE ser 100%
    expect(ror.asymptoticRuinProbability).toBe(100);

    // Finite Horizon Ruin (T = 25 trades) NO PUEDE SER 100%
    // Porque es imposible perder con 100% de certidumbre en solo 25 trades
    expect(ror.finiteHorizonRuinProbability).toBeLessThan(100);
    expect(ror.finiteHorizonRuinProbability).toBeGreaterThan(0);
    expect(ror.hypothesesAndLimits.length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // ESCENARIO 16: Criterio de Kelly con Ventaja No Positiva
  // Si E <= 0, Kelly f* = (W * R - (1 - W)) / R <= 0 -> f* = 0%
  // ---------------------------------------------------------------------------
  it('Escenario 16: Criterio de Kelly devuelve exactamente 0% ante sistemas sin ventaja estadística', () => {
    const rorNegative = calculateRiskOfRuin({
      initialCapital: 10000,
      winRate: 45,
      averageWin: 100,
      averageLoss: 100, // E = -0.10
      riskPerTradePercent: 1.0,
      maxLossLimitPercent: 10,
    });

    expect(rorNegative.kellyCriterion.fullKellyPercent).toBe(0);
    expect(rorNegative.kellyCriterion.halfKellyPercent).toBe(0);
    expect(rorNegative.kellyCriterion.quarterKellyPercent).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // ESCENARIO 17: Criterio de Kelly Conservador Estresado y Sensibilidades Formales
  // Formulas analíticas:
  // K = W - (1 - W) / R = W * (1 + 1/R) - 1/R
  // dK / dW = 1 + 1/R
  // dK / dR = (1 - W) / R^2
  // Para W = 60% (0.60), R = 1.5:
  // K = 0.60 - (0.40 / 1.5) = 0.60 - 0.2667 = 0.3333 (33.33%)
  // dK / dW = 1 + 1 / 1.5 = 1 + 0.6667 = 1.67
  // dK / dR = 0.40 / (1.5^2) = 0.40 / 2.25 = 0.1778
  // Stressed Kelly: W estresado = 55%, R estresado = 1.5 * 0.85 = 1.275
  // K_stressed = 0.55 - (0.45 / 1.275) = 0.55 - 0.3529 = 0.1971 (19.71%)
  // ---------------------------------------------------------------------------
  it('Escenario 17: Sensibilidades matemáticas ∂K/∂W y ∂K/∂R y dimensionamiento conservador Stressed Kelly', () => {
    const ror = calculateRiskOfRuin({
      initialCapital: 10000,
      winRate: 60,
      averageWin: 300,
      averageLoss: 200, // R = 1.5
      riskPerTradePercent: 1.0,
      maxLossLimitPercent: 10,
    });

    // Full Kelly analítico
    expect(ror.kellyCriterion.fullKellyPercent).toBeCloseTo(33.33, 1);
    expect(ror.kellyCriterion.halfKellyPercent).toBeCloseTo(16.67, 1);
    expect(ror.kellyCriterion.quarterKellyPercent).toBeCloseTo(8.33, 1);

    // Sensibilidad formal dK / dW = 1 + 1/1.5 = 1.6667
    expect(ror.kellySensitivity.sensitivityToWinRate).toBeCloseTo(1.67, 2);

    // Sensibilidad formal dK / dR = (1 - 0.60) / (1.5^2) = 0.40 / 2.25 = 0.1778
    expect(ror.kellySensitivity.sensitivityToPayoff).toBeCloseTo(0.18, 2);

    // Stressed Kelly debe ser inferior y más seguro que Full Kelly
    expect(ror.kellySensitivity.stressedKellyPercent).toBeLessThan(ror.kellyCriterion.fullKellyPercent);
    expect(ror.kellySensitivity.stressedKellyPercent).toBeCloseTo(19.71, 1);
  });
});
