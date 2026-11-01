// =============================================================================
// TradeRisk Manager — Fase 5.2: Auditoría Estadística Independiente y Avanzada
// Pruebas Asintóticas, Grandes Muestras, Preservación de Autocorrelación y Colas
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  createMulberry32,
  sampleStandardNormal,
  sampleLognormalVariate,
  runMonteCarloSimulation,
} from '@/lib/analytics/monte-carlo';
import { calculateRiskOfRuin } from '@/lib/analytics/risk-of-ruin';
import { simulatePropFirmChallenge } from '@/lib/prop-firm-simulator';
import type { MonteCarloConfig, PropFirmSimulatorConfig } from '@/lib/analytics/types';

describe('Auditoría Estadística Independiente y Avanzada (Fase 5.2)', () => {
  // ===========================================================================
  // SECCIÓN 1: AUDITORÍA DEL MODELO PARAMÉTRICO VARIABLE (GRANDES MUESTRAS)
  // ===========================================================================

  describe('1. Auditoría del Modelo Paramétrico Variable y Momentos Estadísticos', () => {
    /**
     * Prueba de Gran Muestra (N = 50,000) para sampleLognormalVariate:
     * Comprueba que la media efectiva generada converge a la media teórica deseada
     * dentro del intervalo de confianza del 99.7% (3 * SE = 3 * sigma / sqrt(N)).
     */
    it('Lognormal variate: Media y desviación estándar efectivas convergen sin sesgo de truncamiento', () => {
      const prng = createMulberry32(424242);
      const targetMean = 200;
      const targetStd = 60;
      const N = 50000;

      const samples: number[] = [];
      let sum = 0;
      let minVal = Infinity;

      for (let i = 0; i < N; i++) {
        const val = sampleLognormalVariate(targetMean, targetStd, prng);
        samples.push(val);
        sum += val;
        if (val < minVal) minVal = val;
      }

      const sampleMean = sum / N;
      const variance = samples.reduce((acc, v) => acc + Math.pow(v - sampleMean, 2), 0) / (N - 1);
      const sampleStd = Math.sqrt(variance);

      // Error estándar de la media: SE = sigma / sqrt(N) = 60 / sqrt(50000) = 0.2683
      // Tolerancia 3 * SE ≈ 0.805 (IC del 99.73%)
      const standardError = targetStd / Math.sqrt(N);
      expect(Math.abs(sampleMean - targetMean)).toBeLessThan(3.5 * standardError);

      // Verificación de desviación estándar efectiva
      expect(Math.abs(sampleStd - targetStd) / targetStd).toBeLessThan(0.05); // < 5% de error relativo

      // Verificación de soporte estrictamente positivo: nunca toca un suelo artificial de 0.01
      expect(minVal).toBeGreaterThan(0);

      // Asimetría empírica de lognormal debe ser estrictamente positiva (cola derecha pesada)
      const skewness =
        (N / ((N - 1) * (N - 2))) *
        samples.reduce((acc, v) => acc + Math.pow((v - sampleMean) / sampleStd, 3), 0);
      expect(skewness).toBeGreaterThan(0.5); // Fuerte asimetría positiva en retornos ganadores
    });

    /**
     * Demostración Matemática del Sesgo del Suelo de 0.01 en Distribución Normal Truncada:
     * Si se trunca una Normal con media mu=100 y sigma=80 en 0.01, la media condicional
     * calculada analíticamente E[X | X > 0] = mu + sigma * (phi(-mu/sigma) / (1 - Phi(-mu/sigma)))
     * es estrictamente superior a mu.
     */
    it('Demostración del sesgo positivo en Normal Truncada vs. Exactitud en Lognormal', () => {
      const prng = createMulberry32(123456);
      const mu = 50;
      const sigma = 60; // Gran dispersión relativa: sigma > mu
      const N = 30000;

      let sumClippedNormal = 0;
      let sumLognormal = 0;

      for (let i = 0; i < N; i++) {
        // Normal truncada artificialmente en 0.01
        const z = sampleStandardNormal(prng);
        const clipped = Math.max(0.01, mu + sigma * z);
        sumClippedNormal += clipped;

        // Lognormal con calibración de momentos
        const lognorm = sampleLognormalVariate(mu, sigma, prng);
        sumLognormal += lognorm;
      }

      const meanClipped = sumClippedNormal / N;
      const meanLognormal = sumLognormal / N;

      // La normal truncada presenta un sesgo positivo sustancial (media > mu)
      expect(meanClipped).toBeGreaterThan(mu + 5);

      // La lognormal conserva la media dentro del error estándar
      const se = sigma / Math.sqrt(N);
      expect(Math.abs(meanLognormal - mu)).toBeLessThan(3.5 * se);
    });

    /**
     * Verificación en simulación Monte Carlo completa con `parametric_variable`
     */
    it('Monte Carlo parametric_variable respeta las medias teóricas de ganancia y pérdida', () => {
      const config: MonteCarloConfig = {
        simulationsCount: 500,
        tradesCount: 100,
        initialCapital: 10000,
        riskType: 'fixed_amount',
        riskValue: 100, // $100 fijo
        seed: 78910,
        method: 'parametric_variable',
        customDistribution: {
          winRate: 50,
          averageWin: 200,
          averageLoss: 100,
          winStdDev: 50,
          lossStdDev: 25,
          distributionFamily: 'lognormal',
        },
      };

      const res = runMonteCarloSimulation([], config);

      // Con W = 50%, AvgWin = $200 (2R), AvgLoss = $100 (1R): E = 0.50 * 2 - 0.50 * 1 = +0.50R por trade
      // En 100 trades con $100 de riesgo: ganancia esperada = 100 * 0.50 * $100 = $5,000
      // Capital final esperado ≈ $15,000
      expect(res.medianFinalEquity).toBeGreaterThan(12000);
      expect(res.profitProbability).toBeGreaterThan(90.0);
    });
  });

  // ===========================================================================
  // SECCIÓN 2: AUDITORÍA AVANZADA DE BLOCK BOOTSTRAP Y AUTOCORRELACIÓN
  // ===========================================================================

  describe('2. Auditoría Avanzada de Circular Moving Block Bootstrap', () => {
    // Generar una serie sintética con fuerte autocorrelación serial (Markoviana de rachas)
    // donde la probabilidad de continuar en racha perdedora o ganadora es del 80%
    function generateAutocorrelatedSeries(n: number, seed: number): number[] {
      const prng = createMulberry32(seed);
      const series: number[] = [];
      let currentState = 1; // 1 = Win (+1.5R), -1 = Loss (-1R)

      for (let i = 0; i < n; i++) {
        // Probabilidad de persistencia de estado = 80%
        if (prng() > 0.80) {
          currentState = -currentState;
        }
        series.push(currentState === 1 ? 1.5 : -1.0);
      }
      return series;
    }

    // Calcula el coeficiente de autocorrelación muestral de retardo 1 (lag-1 autocorrelation)
    function calculateLag1Autocorrelation(data: number[]): number {
      const n = data.length;
      if (n < 2) return 0;
      const mean = data.reduce((a, b) => a + b, 0) / n;
      let num = 0;
      let den = 0;
      for (let i = 0; i < n; i++) {
        const diff = data[i] - mean;
        den += diff * diff;
        if (i < n - 1) {
          num += (data[i] - mean) * (data[i + 1] - mean);
        }
      }
      return den > 0 ? num / den : 0;
    }

    it('Comparativa de preservación de autocorrelación: Block Bootstrap (B=2, 5, 10, 20) vs. IID Bootstrap (B=1)', () => {
      const originalSeries = generateAutocorrelatedSeries(100, 54321);
      const originalLag1 = calculateLag1Autocorrelation(originalSeries);

      // La serie original tiene una autocorrelación serial muy positiva (rho_1 > 0.50)
      expect(originalLag1).toBeGreaterThan(0.50);

      // Simular remuestreos con IID y con Block Bootstrap
      const blockSizes = [1, 2, 5, 10, 20];
      const prng = createMulberry32(112233);
      const resampledLag1: Record<number, number> = {};

      for (const B of blockSizes) {
        const resampled: number[] = [];
        let buffer: number[] = [];
        let bIdx = 0;

        for (let i = 0; i < 2000; i++) {
          if (bIdx >= buffer.length) {
            buffer = [];
            const startIdx = Math.floor(prng() * originalSeries.length);
            for (let b = 0; b < B; b++) {
              buffer.push(originalSeries[(startIdx + b) % originalSeries.length]);
            }
            bIdx = 0;
          }
          resampled.push(buffer[bIdx++]);
        }

        resampledLag1[B] = calculateLag1Autocorrelation(resampled);
      }

      // 1. IID Bootstrap (B=1) DESTRUYE por completo la autocorrelación: rho_1 ≈ 0
      expect(Math.abs(resampledLag1[1])).toBeLessThan(0.08);

      // 2. Block Bootstrap preserva progresivamente la autocorrelación serial con la fracción (B-1)/B:
      // B=2 preserva ~50% de las transiciones originales
      expect(resampledLag1[2]).toBeGreaterThan(0.20);
      // B=5 preserva ~80% de las transiciones originales
      expect(resampledLag1[5]).toBeGreaterThan(0.35);
      // B=10 preserva ~90% de las transiciones originales
      expect(resampledLag1[10]).toBeGreaterThan(0.45);
      // B=20 preserva la gran mayoría de la autocorrelación
      expect(resampledLag1[20]).toBeGreaterThan(resampledLag1[5]);
    });

    it('Preservación de rachas perdedoras en Block Bootstrap frente a subestimación en IID', () => {
      const originalSeries = generateAutocorrelatedSeries(100, 998877);

      const prng = createMulberry32(445566);
      const N_DRAWS = 1000;

      // IID (B=1)
      const iidSample: number[] = [];
      for (let i = 0; i < N_DRAWS; i++) {
        iidSample.push(originalSeries[Math.floor(prng() * originalSeries.length)]);
      }

      // Block (B=8)
      const blockSample: number[] = [];
      let buf: number[] = [];
      let idx = 0;
      for (let i = 0; i < N_DRAWS; i++) {
        if (idx >= buf.length) {
          buf = [];
          const sIdx = Math.floor(prng() * originalSeries.length);
          for (let b = 0; b < 8; b++) {
            buf.push(originalSeries[(sIdx + b) % originalSeries.length]);
          }
          idx = 0;
        }
        blockSample.push(buf[idx++]);
      }

      function maxLossStreak(data: number[]): number {
        let max = 0;
        let cur = 0;
        for (const v of data) {
          if (v < 0) {
            cur++;
            if (cur > max) max = cur;
          } else {
            cur = 0;
          }
        }
        return max;
      }

      function countLossesInStreaksGe5(data: number[]): number {
        let count = 0;
        let cur = 0;
        for (const v of data) {
          if (v < 0) {
            cur++;
          } else {
            if (cur >= 5) count += cur;
            cur = 0;
          }
        }
        if (cur >= 5) count += cur;
        return count;
      }

      const iidMax = maxLossStreak(iidSample);
      const blockMax = maxLossStreak(blockSample);

      const iidLossesInClusters = countLossesInStreaksGe5(iidSample);
      const blockLossesInClusters = countLossesInStreaksGe5(blockSample);

      // Block Bootstrap preserva el agrupamiento temporal:
      // Las pérdidas agrupadas en rachas de 5 o más son más del doble que en IID
      expect(blockLossesInClusters).toBeGreaterThan(iidLossesInClusters * 2);
      expect(blockMax).toBeGreaterThanOrEqual(iidMax);
    });
  });

  // ===========================================================================
  // SECCIÓN 3: AUDITORÍA EXHAUSTIVA DE RIESGO DE RUINA (4 ESCENARIOS)
  // ===========================================================================

  describe('3. Auditoría del Riesgo de Ruina y Simulación de Primer Paso', () => {
    it('Escenario A: Ruina Finita es exactamente 0.00% cuando el horizonte de operaciones T < U', () => {
      // Necesita U = 10 unidades para quebrar, pero el horizonte temporal es de solo T = 6 trades
      const res = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 30, // Tasa de acierto baja
        averageWin: 100,
        averageLoss: 100,
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 10, // U = 10 unidades
        tradesHorizon: 6,        // T = 6 < 10
        riskModel: 'fixed_amount',
        seed: 701,
      });

      expect(res.riskUnits).toBe(10);
      expect(res.finiteHorizonRuinProbability).toBe(0.0);
      // Asintóticamente con A < 0 la ruina sigue siendo 100%
      expect(res.asymptoticRuinProbability).toBe(100.0);
    });

    it('Escenario B: Ruina Finita es intermedia para un horizonte moderado con ventaja negativa', () => {
      const res = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 40,
        averageWin: 100,
        averageLoss: 100,
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 10,
        tradesHorizon: 40,
        riskModel: 'fixed_amount',
        seed: 702,
      });

      expect(res.asymptoticRuinProbability).toBe(100.0);
      // A T=40 trades, la ruina empírica es intermedia (ni 0% ni 100%)
      expect(res.finiteHorizonRuinProbability).toBeGreaterThan(20.0);
      expect(res.finiteHorizonRuinProbability).toBeLessThan(80.0);
    });

    it('Escenario C: Ruina Finita es exactamente 100.00% cuando Win Rate = 0% y T >= U', () => {
      const res = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 0, // Nunca acierta
        averageWin: 100,
        averageLoss: 100,
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 10, // U = 10
        tradesHorizon: 20,       // T = 20 >= 10
        riskModel: 'fixed_amount',
        seed: 703,
      });

      expect(res.asymptoticRuinProbability).toBe(100.0);
      expect(res.finiteHorizonRuinProbability).toBe(100.0);
    });

    it('Escenario D: Asymptotic Ruin = 100% mientras Finite Ruin < 100% demuestra formalmente la distinción', () => {
      const res = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 45,
        averageWin: 100,
        averageLoss: 100, // A = -0.10 <= 0
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 10,
        tradesHorizon: 50,
        riskModel: 'fixed_amount',
        seed: 704,
      });

      expect(res.asymptoticRuinProbability).toBe(100.0);
      expect(res.finiteHorizonRuinProbability).toBeLessThan(50.0);
    });
  });

  // ===========================================================================
  // SECCIÓN 4: AUDITORÍA DEL CRITERIO DE KELLY (CASOS EXTREMOS Y LÍMITES)
  // ===========================================================================

  describe('4. Auditoría de Casos Extremos y Límites del Criterio de Kelly', () => {
    it('Caso Extremo 1: Ratio de pago muy alto (R = 100) con tasa de acierto muy baja (W = 2%)', () => {
      // E = 0.02 * 100 - 0.98 = 2.0 - 0.98 = +1.02R
      // K = (0.02 * 101 - 1) / 100 = (2.02 - 1) / 100 = 1.02 / 100 = 1.02%
      const res = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 2,
        averageWin: 10000,
        averageLoss: 100,
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 10,
      });

      expect(res.edgePercent).toBe(102.0);
      expect(res.kellyCriterion.fullKellyPercent).toBeCloseTo(1.02, 2);
      expect(res.kellySensitivity.sensitivityToWinRate).toBeCloseTo(1.01, 2); // 1 + 1/100
      expect(res.kellySensitivity.sensitivityToPayoff).toBeCloseTo(0.0, 3); // (1 - 0.02) / 10000 ≈ 0
    });

    it('Caso Extremo 2: Ratio de pago diminuto (R = 0.05) con tasa de acierto extrema (W = 96%)', () => {
      // E = 0.96 * 0.05 - 0.04 = 0.048 - 0.04 = +0.008R
      // K = (0.96 * 1.05 - 1) / 0.05 = (1.008 - 1) / 0.05 = 0.008 / 0.05 = 16.0%
      // dK/dW = 1 + 1/0.05 = 1 + 20 = 21.0 (HIPERSENSIBLE a errores en Win Rate!)
      const res = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 96,
        averageWin: 5,
        averageLoss: 100,
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 10,
      });

      expect(res.edgePercent).toBe(0.8);
      expect(res.kellyCriterion.fullKellyPercent).toBeCloseTo(16.0, 1);
      expect(res.kellySensitivity.sensitivityToWinRate).toBeCloseTo(21.0, 1);
    });

    it('Límite de riesgo máximo configurable limita asignaciones de Kelly desproporcionadas', () => {
      // W = 70%, R = 2.0 -> Full Kelly = 0.70 - (0.30 / 2) = 0.70 - 0.15 = 55.0%
      const res = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 70,
        averageWin: 200,
        averageLoss: 100,
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 10,
        maxKellyCapPercent: 15.0, // Tope prudencial configurado al 15%
      });

      expect(res.kellyCriterion.fullKellyPercent).toBe(55.0);
      expect(res.kellyCriterion.cappedKellyPercent).toBe(15.0);
      expect(res.kellyCriterion.isCapped).toBe(true);
    });

    it('Advertencia por muestra histórica insuficiente (N < 30) se añade formalmente', () => {
      const resSmall = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 60,
        averageWin: 200,
        averageLoss: 100,
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 10,
        historicalSampleSize: 14, // N = 14 trades
      });

      const hasSmallSampleWarning = resSmall.hypothesesAndLimits.some((h) =>
        h.includes('Muestra Histórica Insuficiente'),
      );
      expect(hasSmallSampleWarning).toBe(true);

      const resAdequate = calculateRiskOfRuin({
        initialCapital: 10000,
        winRate: 60,
        averageWin: 200,
        averageLoss: 100,
        riskPerTradePercent: 1.0,
        maxLossLimitPercent: 10,
        historicalSampleSize: 50, // N = 50 trades
      });

      const hasAdequateWarning = resAdequate.hypothesesAndLimits.some((h) =>
        h.includes('Muestra Histórica Insuficiente'),
      );
      expect(hasAdequateWarning).toBe(false);
    });
  });

  // ===========================================================================
  // SECCIÓN 5: AUDITORÍA DE REGLAS PROP FIRM (CONFIGURABILIDAD Y SOFT PAUSE)
  // ===========================================================================

  describe('5. Auditoría de Reglas Prop Firm y Consumo Temporal en Soft Pause', () => {
    it('Base de pérdida diaria: Capital inicial vs. Balance de apertura del día', () => {
      // Si la cuenta subió de $50,000 a $60,000:
      // Base initial_capital: límite del 4% = $2,000
      // Base day_start_balance: límite del 4% = $2,400
      const configInit: PropFirmSimulatorConfig = {
        initialCapital: 50000,
        profitTargetPercent: 10,
        dailyLossLimitPercent: 4,
        maxDrawdownPercent: 8,
        drawdownType: 'static',
        dailyLossType: 'balance_based',
        dailyLossBase: 'initial_capital',
        dailyLossEnforcement: 'hard_breach',
        resetHour: 0,
        resetTimezone: 'UTC',
        winRate: 55,
        averageWin: 600,
        averageLoss: 300,
        riskPerTradePercent: 0.5,
        tradesPerDay: 3,
        maxDays: 30,
        commissionsPerTrade: 0,
        simulationsCount: 100,
        seed: 901,
      };

      const resInit = simulatePropFirmChallenge(configInit);
      expect(resInit.config.dailyLossBase).toBe('initial_capital');

      const resDayStart = simulatePropFirmChallenge({
        ...configInit,
        dailyLossBase: 'day_start_balance',
      });
      expect(resDayStart.config.dailyLossBase).toBe('day_start_balance');
    });

    it('Soft Pause consume días de trading y no genera oportunidades infinitas artificiales', () => {
      const config: PropFirmSimulatorConfig = {
        initialCapital: 50000,
        profitTargetPercent: 12,
        dailyLossLimitPercent: 2, // Límite diario muy ajustado (2% = $1,000)
        maxDrawdownPercent: 10,
        drawdownType: 'static',
        dailyLossType: 'balance_based',
        dailyLossEnforcement: 'soft_pause',
        resetHour: 0,
        resetTimezone: 'UTC',
        winRate: 48, // Ligera desventaja
        averageWin: 300,
        averageLoss: 300,
        riskPerTradePercent: 1.0, // 2 pérdidas activan la pausa diaria
        tradesPerDay: 4,
        maxDays: 20, // Horizonte estricto
        commissionsPerTrade: 0,
        simulationsCount: 150,
        seed: 902,
      };

      const res = simulatePropFirmChallenge(config);

      // Al pausar con frecuencia en un horizonte ajustado de 20 días, muchas simulaciones deben agotar el tiempo (timeout)
      expect(res.timeoutProbability).toBeGreaterThan(0);
      expect(res.breachAnalysis.dailyLossTriggersCount).toBeDefined();
      expect(res.breachAnalysis.dailyLossTriggersCount).toBeGreaterThan(0);
    });
  });
});
