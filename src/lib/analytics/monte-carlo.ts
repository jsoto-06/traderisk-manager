// =============================================================================
// TradeRisk Manager — Monte Carlo Simulation Engine
// =============================================================================

import type { Trade } from '@/lib/types';
import type {
  MonteCarloConfig,
  MonteCarloResult,
  MonteCarloCurvePoint,
  DistributionBin,
} from './types';

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
 * Computes percentile from a pre-sorted array of numbers using linear interpolation.
 */
export function calculatePercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const index = (sorted.length - 1) * p;
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
 * Runs a Monte Carlo bootstrap simulation on trading strategy or historical trades.
 *
 * Capabilities:
 * - Deterministic output with reproducible seed.
 * - Bootstrap sampling with replacement from historical closed trades.
 * - Parametric custom distribution mode (winRate, avgWin, avgLoss) when trades are scarce.
 * - Fixed dollar risk or Percentage-of-equity compounding risk models.
 * - Multi-percentile equity evolution curves (P5, P25, P50, P75, P95).
 * - Target probability, ruin probability, and drawdown breach metrics.
 */
export function runMonteCarloSimulation(
  trades: Trade[],
  config: MonteCarloConfig,
): MonteCarloResult {
  const prng = createMulberry32(config.seed ?? 42);
  const simulationsCount = Math.max(10, Math.min(config.simulationsCount || 1000, 5000));
  const tradesCount = Math.max(5, Math.min(config.tradesCount || 100, 1000));
  const initialCapital = Math.max(100, config.initialCapital || 10000);
  const maxDdLimitPercent = config.maxDrawdownLimitPercent ?? 10;
  const profitTarget = config.profitTarget;

  // Extract trade R-multiples or net dollar profits from historical trades
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
      // Fallback: assume 1R is equal to average absolute loss or 1% of initial capital
      historicalRMultiples.push(netResult / (initialCapital * 0.01));
    }
  }

  const useHistorical = !config.customDistribution && historicalRMultiples.length >= 5;

  // Pre-allocate matrix of simulations: [simIndex][tradeStep]
  // tradeStep 0 = initialCapital
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

    for (let t = 1; t <= tradesCount; t++) {
      if (currentEquity <= 0) {
        hitRuin = true;
        currentEquity = 0;
        stepValues[t].push(0);
        continue;
      }

      let pnl = 0;

      if (useHistorical) {
        // Bootstrap sample with replacement
        const randomIndex = Math.floor(prng() * historicalRMultiples.length);
        const rMultiple = historicalRMultiples[randomIndex];

        if (config.riskType === 'percentage_equity') {
          const riskDollars = currentEquity * (config.riskValue / 100);
          pnl = riskDollars * rMultiple;
        } else {
          pnl = config.riskValue * rMultiple;
        }
      } else {
        // Parametric mode
        const dist = config.customDistribution ?? {
          winRate: 50,
          averageWin: 200,
          averageLoss: 100,
        };

        const isWin = prng() * 100 < dist.winRate;
        const payoffRatio = dist.averageLoss > 0 ? dist.averageWin / dist.averageLoss : 1.5;

        if (config.riskType === 'percentage_equity') {
          const riskDollars = currentEquity * (config.riskValue / 100);
          pnl = isWin ? riskDollars * payoffRatio : -riskDollars;
        } else {
          pnl = isWin ? config.riskValue * payoffRatio : -config.riskValue;
        }
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

      // Check ruin (<= 10% of initial capital or <= 0)
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

  const disclaimer =
    'Aviso de riesgo: Las simulaciones Monte Carlo son estimaciones estadísticas basadas en supuestos y datos históricos. No garantizan rendimientos futuros ni protegen contra pérdidas.';

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
  };
}
