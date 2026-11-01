// =============================================================================
// TradeRisk Manager — Monte Carlo Simulation Engine (Fase 5.2)
// =============================================================================

import type { Trade } from '@/lib/types';
import type {
  MonteCarloConfig,
  MonteCarloResult,
  MonteCarloCurvePoint,
  DistributionBin,
  MonteCarloMethod,
  MonteCarloMetadata,
  EmpiricalStatistics,
} from './types';

export const MONTE_CARLO_ALGORITHM_VERSION = '5.2.0';

/**
 * Deterministic pseudo-random number generator (Mulberry32).
 * Produces uniform float in [0, 1).
 */
export function createMulberry32(seed: number = 1337) {
  let s = Math.floor(seed) >>> 0;
  return function next(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Samples standard normal variate N(0, 1) using Box-Muller transformation.
 * Deterministic with the given uniform PRNG.
 */
export function sampleStandardNormal(prng: () => number): number {
  let u1 = prng();
  while (u1 <= 1e-15) {
    u1 = prng();
  }
  const u2 = prng();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

/**
 * Samples a continuous strictly positive random variable with exact target expected value (mean)
 * and variance (std^2) using a moment-matched lognormal distribution.
 *
 * For X ~ Lognormal(mu_ln, sigma_ln^2):
 * sigma_ln^2 = ln(1 + (std / mean)^2)
 * mu_ln = ln(mean) - 0.5 * sigma_ln^2
 * E[X] = exp(mu_ln + 0.5 * sigma_ln^2) = mean  (exact)
 * Var(X) = (exp(sigma_ln^2) - 1) * mean^2 = std^2 (exact)
 * Support: (0, +infinity) strictly, completely avoiding artificial floor clipping bias.
 */
export function sampleLognormalVariate(mean: number, std: number, prng: () => number): number {
  if (mean <= 0) return 0;
  if (std <= 0) return mean;

  const variance = Math.pow(std, 2);
  const meanSquared = Math.pow(mean, 2);
  const sigmaLnSquared = Math.log(1 + variance / meanSquared);
  const sigmaLn = Math.sqrt(sigmaLnSquared);
  const muLn = Math.log(mean) - 0.5 * sigmaLnSquared;

  const z = sampleStandardNormal(prng);
  return Math.exp(muLn + sigmaLn * z);
}

/**
 * Computes percentile from a pre-sorted array of numbers using linear interpolation.
 */
export function calculatePercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const clampedP = Math.max(0, Math.min(1, p));
  const index = (sorted.length - 1) * clampedP;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return Number((sorted[lower] * (1 - weight) + sorted[upper] * weight).toFixed(2));
}

/**
 * Builds distribution histogram bins from final equity values.
 */
export function buildHistogramBins(values: number[], binCount: number = 10): DistributionBin[] {
  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    return [
      {
        binLabel: `${Math.round(min)}`,
        binMin: min,
        binMax: max,
        count: values.length,
        percentage: 100,
      },
    ];
  }

  const range = max - min;
  const binWidth = range / binCount;
  const bins: DistributionBin[] = [];

  for (let b = 0; b < binCount; b++) {
    const binMin = Number((min + b * binWidth).toFixed(2));
    const binMax = Number((min + (b + 1) * binWidth).toFixed(2));
    bins.push({
      binLabel: `${Math.round(binMin)} - ${Math.round(binMax)}`,
      binMin,
      binMax,
      count: 0,
      percentage: 0,
    });
  }

  for (const v of values) {
    let index = Math.floor((v - min) / binWidth);
    if (index >= binCount) index = binCount - 1;
    if (index < 0) index = 0;
    bins[index].count++;
  }

  const total = values.length;
  for (const b of bins) {
    b.percentage = Number(((b.count / total) * 100).toFixed(1));
  }

  return bins;
}

/**
 * Computes empirical higher statistical moments and tail metrics from historical R-multiples.
 */
export function calculateSampleStatistics(
  rMultiples: number[],
): EmpiricalStatistics | undefined {
  const n = rMultiples.length;
  if (n < 3) return undefined;

  const sum = rMultiples.reduce((acc, v) => acc + v, 0);
  const mean = sum / n;

  const sumSqDiff = rMultiples.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0);
  const sampleVariance = sumSqDiff / (n - 1);
  const stdDev = Math.sqrt(sampleVariance);

  let skewness = 0;
  let excessKurtosis = 0;

  if (stdDev > 0 && n >= 4) {
    const sumCubeDiff = rMultiples.reduce((acc, v) => acc + Math.pow((v - mean) / stdDev, 3), 0);
    skewness = (n / ((n - 1) * (n - 2))) * sumCubeDiff;

    const sumQuadDiff = rMultiples.reduce((acc, v) => acc + Math.pow((v - mean) / stdDev, 4), 0);
    const kFactor = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3));
    const kSub = (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
    excessKurtosis = kFactor * sumQuadDiff - kSub;
  }

  // Value at Risk 95% (5th percentile of historical R-multiples)
  const sortedR = [...rMultiples].sort((a, b) => a - b);
  const valueAtRisk95 = calculatePercentile(sortedR, 0.05);

  // Compute maximum historical drawdown in R
  let peakR = 0;
  let cumR = 0;
  let maxDdR = 0;
  for (const r of rMultiples) {
    cumR += r;
    if (cumR > peakR) peakR = cumR;
    const dd = peakR - cumR;
    if (dd > maxDdR) maxDdR = dd;
  }

  return {
    mean: Number(mean.toFixed(4)),
    stdDev: Number(stdDev.toFixed(4)),
    skewness: Number(skewness.toFixed(3)),
    excessKurtosis: Number(excessKurtosis.toFixed(3)),
    maxHistoricalDrawdown: Number(maxDdR.toFixed(2)),
    historicalTradesCount: n,
    valueAtRisk95,
  };
}

/**
 * Runs a Monte Carlo simulation engine with deterministic output,
 * supporting IID bootstrap, Moving Block Bootstrap, and parametric modeling.
 */
export function runMonteCarloSimulation(
  trades: Trade[],
  config: MonteCarloConfig,
): MonteCarloResult {
  const seed = config.seed ?? 42;
  const prng = createMulberry32(seed);
  const simulationsCount = Math.max(10, Math.min(config.simulationsCount || 1000, 5000));
  const tradesCount = Math.max(1, Math.min(config.tradesCount || 100, 2000));
  const initialCapital = Math.max(100, config.initialCapital || 10000);
  const maxDdLimitPercent = config.maxDrawdownLimitPercent ?? 10;
  const profitTarget = config.profitTarget;

  // Extract trade R-multiples from historical closed trades
  const closed = trades.filter((t) => t.status === 'closed' && t.result != null);
  const historicalRMultiples: number[] = [];

  for (const t of closed) {
    const rawResult = Number(t.result);
    const comms = Number(t.commissions || 0);
    const netResult = rawResult - comms;

    let initialRisk = 0;
    if (t.stopLoss && t.entryPrice && t.size) {
      initialRisk = Math.abs(t.entryPrice - t.stopLoss) * t.size;
    }

    if (initialRisk > 0) {
      historicalRMultiples.push(netResult / initialRisk);
    } else {
      // Fallback: scale against 1% of initial capital
      historicalRMultiples.push(netResult / (initialCapital * 0.01));
    }
  }

  // Determine simulation method
  let method: MonteCarloMethod;
  if (config.method) {
    method = config.method;
  } else if (config.customDistribution) {
    method =
      config.customDistribution.winStdDev || config.customDistribution.lossStdDev
        ? 'parametric_variable'
        : 'parametric_fixed';
  } else if (historicalRMultiples.length >= 5) {
    method = 'bootstrap_iid';
  } else {
    method = 'parametric_fixed';
  }

  // Empirical descriptive statistics
  const empiricalStatistics = calculateSampleStatistics(historicalRMultiples);

  // Block size for Block Bootstrap
  const blockSize = Math.max(1, Math.min(config.blockSize || 5, Math.max(1, historicalRMultiples.length)));

  // Matrix of simulations: [tradeStep][simIndex]
  const stepValues: number[][] = Array.from({ length: tradesCount + 1 }, () => []);
  for (let s = 0; s < simulationsCount; s++) {
    stepValues[0].push(initialCapital);
  }

  const finalEquities: number[] = [];
  const maxDrawdownsAmount: number[] = [];
  const maxDrawdownsPercent: number[] = [];

  let profitCount = 0;
  let targetCount = 0;
  let ruinCount = 0;
  let drawdownBreachCount = 0;

  for (let s = 0; s < simulationsCount; s++) {
    let currentEquity = initialCapital;
    let peakEquity = initialCapital;
    let simMaxDdAmount = 0;
    let simMaxDdPercent = 0;
    let hitTarget = false;
    let hitRuin = false;
    let breachedDd = false;

    // Buffer for Block Bootstrap
    let blockBuffer: number[] = [];
    let blockIndex = 0;

    for (let t = 1; t <= tradesCount; t++) {
      if (currentEquity <= 0) {
        hitRuin = true;
        currentEquity = 0;
        stepValues[t].push(0);
        continue;
      }

      let rMultiple = 0;

      if (method === 'bootstrap_block' && historicalRMultiples.length > 0) {
        // Circular Moving Block Bootstrap
        if (blockIndex >= blockBuffer.length) {
          blockBuffer = [];
          const startIdx = Math.floor(prng() * historicalRMultiples.length);
          for (let b = 0; b < blockSize; b++) {
            blockBuffer.push(historicalRMultiples[(startIdx + b) % historicalRMultiples.length]);
          }
          blockIndex = 0;
        }
        rMultiple = blockBuffer[blockIndex++];
      } else if (method === 'bootstrap_iid' && historicalRMultiples.length > 0) {
        // Standard IID Bootstrap with replacement
        const randomIndex = Math.floor(prng() * historicalRMultiples.length);
        rMultiple = historicalRMultiples[randomIndex];
      } else if (method === 'parametric_variable') {
        // Continuous Parametric distribution with dispersion
        const dist = config.customDistribution ?? {
          winRate: 50,
          averageWin: 200,
          averageLoss: 100,
          winStdDev: 80,
          lossStdDev: 30,
        };

        const isWin = prng() * 100 < dist.winRate;
        const avgLoss = Math.max(0.01, dist.averageLoss);
        const avgWin = Math.max(0.01, dist.averageWin);
        const family = dist.distributionFamily || 'lognormal';

        if (isWin) {
          const winStd = dist.winStdDev ?? (dist.averageWin * 0.4);
          let winGain: number;
          if (family === 'lognormal') {
            winGain = sampleLognormalVariate(avgWin, winStd, prng);
          } else {
            const z = sampleStandardNormal(prng);
            winGain = Math.max(0.01, avgWin + winStd * z);
          }
          rMultiple = winGain / avgLoss;
        } else {
          const lossStd = dist.lossStdDev ?? (dist.averageLoss * 0.3);
          let lossAmt: number;
          if (family === 'lognormal') {
            lossAmt = sampleLognormalVariate(avgLoss, lossStd, prng);
          } else {
            const z = sampleStandardNormal(prng);
            lossAmt = Math.max(0.01, avgLoss + lossStd * z);
          }
          rMultiple = -(lossAmt / avgLoss);
        }
      } else {
        // Parametric Fixed (2-point Bernoulli model)
        const dist = config.customDistribution ?? {
          winRate: 50,
          averageWin: 200,
          averageLoss: 100,
        };

        const isWin = prng() * 100 < dist.winRate;
        const payoffRatio = dist.averageLoss > 0 ? dist.averageWin / dist.averageLoss : 1.5;
        rMultiple = isWin ? payoffRatio : -1.0;
      }

      let pnl = 0;
      if (config.riskType === 'percentage_equity') {
        const riskDollars = currentEquity * (config.riskValue / 100);
        pnl = riskDollars * rMultiple;
      } else {
        pnl = config.riskValue * rMultiple;
      }

      currentEquity = Math.max(0, currentEquity + pnl);

      if (currentEquity > peakEquity) {
        peakEquity = currentEquity;
      }

      const ddAmount = peakEquity - currentEquity;
      const ddPercent = peakEquity > 0 ? (ddAmount / peakEquity) * 100 : 0;

      if (ddAmount > simMaxDdAmount) simMaxDdAmount = ddAmount;
      if (ddPercent > simMaxDdPercent) simMaxDdPercent = ddPercent;

      if (ddPercent >= maxDdLimitPercent) {
        breachedDd = true;
      }

      if (profitTarget && currentEquity >= profitTarget) {
        hitTarget = true;
      }

      if (currentEquity <= initialCapital * 0.1 || currentEquity <= 0) {
        hitRuin = true;
      }

      stepValues[t].push(Number(currentEquity.toFixed(2)));
    }

    finalEquities.push(Number(currentEquity.toFixed(2)));
    maxDrawdownsAmount.push(Number(simMaxDdAmount.toFixed(2)));
    maxDrawdownsPercent.push(Number(simMaxDdPercent.toFixed(2)));

    if (currentEquity > initialCapital) profitCount++;
    if (hitTarget || (profitTarget && currentEquity >= profitTarget)) targetCount++;
    if (hitRuin) ruinCount++;
    if (breachedDd) drawdownBreachCount++;
  }

  // Calculate curves percentiles for each trade step
  const curves: MonteCarloCurvePoint[] = [];
  for (let t = 0; t <= tradesCount; t++) {
    const sortedStep = stepValues[t].slice().sort((a, b) => a - b);
    curves.push({
      tradeIndex: t,
      p5: calculatePercentile(sortedStep, 0.05),
      p25: calculatePercentile(sortedStep, 0.25),
      p50: calculatePercentile(sortedStep, 0.5),
      p75: calculatePercentile(sortedStep, 0.75),
      p95: calculatePercentile(sortedStep, 0.95),
    });
  }

  finalEquities.sort((a, b) => a - b);
  maxDrawdownsPercent.sort((a, b) => a - b);

  const profitProbability = Number(((profitCount / simulationsCount) * 100).toFixed(2));
  const targetProbability = profitTarget
    ? Number(((targetCount / simulationsCount) * 100).toFixed(2))
    : 0;
  const ruinProbability = Number(((ruinCount / simulationsCount) * 100).toFixed(2));
  const drawdownBreachProbability = Number(
    ((drawdownBreachCount / simulationsCount) * 100).toFixed(2),
  );

  const medianFinalEquity = calculatePercentile(finalEquities, 0.5);
  const maxDrawdownMedian = calculatePercentile(maxDrawdownsPercent, 0.5);
  const maxDrawdownP95 = calculatePercentile(maxDrawdownsPercent, 0.95);

  const percentiles = {
    p5: calculatePercentile(finalEquities, 0.05),
    p25: calculatePercentile(finalEquities, 0.25),
    p50: medianFinalEquity,
    p75: calculatePercentile(finalEquities, 0.75),
    p95: calculatePercentile(finalEquities, 0.95),
  };

  const finalEquityDistribution = buildHistogramBins(finalEquities, 10);

  const metadata: MonteCarloMetadata = {
    seed,
    algorithmVersion: MONTE_CARLO_ALGORITHM_VERSION,
    method,
    simulationsCount,
    tradesCount,
    blockSize: method === 'bootstrap_block' ? blockSize : undefined,
    riskType: config.riskType,
    riskValue: config.riskValue,
    timestamp: '2026-11-01T00:00:00Z',
  };

  const disclaimer =
    'Aviso metodológico: Las simulaciones estocásticas son modelos matemáticos basados en supuestos de distribución y remuestreo empírico. No constituyen asesoramiento financiero ni garantías de resultados futuros.';

  return {
    simulationsCount,
    tradesCount,
    initialCapital,
    profitProbability,
    targetProbability,
    ruinProbability,
    drawdownBreachProbability,
    medianFinalEquity,
    percentiles,
    maxDrawdownMedian,
    maxDrawdownP95,
    curves,
    finalEquityDistribution,
    disclaimer,
    metadata,
    empiricalStatistics,
  };
}
