// =============================================================================
// TradeRisk Manager — Risk of Ruin & Kelly Criterion Module
// =============================================================================

import type {
  RiskOfRuinConfig,
  RiskOfRuinResult,
  RiskScenarioComparison,
} from './types';
import { createMulberry32 } from './monte-carlo';

/**
 * Calculates analytical and empirical Risk of Ruin, Kelly Criterion fractions,
 * and sensitivity scenarios across different risk-per-trade levels.
 *
 * References:
 * - Ralph Vince: "The Mathematics of Money Management"
 * - Perry Belmont: Analytical advantage formula: A = (W*R - L) / (W*R + L)
 * - J. L. Kelly Jr.: "A New Interpretation of Information Rate"
 */
export function calculateRiskOfRuin(config: RiskOfRuinConfig): RiskOfRuinResult {
  const initialCapital = Math.max(100, config.initialCapital || 10000);
  const winRate = Math.max(0, Math.min(100, config.winRate));
  const averageWin = Math.max(0.01, config.averageWin);
  const averageLoss = Math.max(0.01, config.averageLoss);
  const riskPerTradePercent = Math.max(0.05, Math.min(50, config.riskPerTradePercent));
  const maxLossLimitPercent = Math.max(1, Math.min(100, config.maxLossLimitPercent));
  const tradesHorizon = Math.max(20, Math.min(1000, config.tradesHorizon || 200));

  const W = winRate / 100;
  const L = 1 - W;
  const payoffRatio = Number((averageWin / averageLoss).toFixed(3));

  // Edge percent: (W * Payoff) - L
  const edgePercent = Number(((W * payoffRatio - L) * 100).toFixed(2));

  // Perry / Ralph Vince Advantage Parameter A
  // A = (W * R - L) / (W * R + L)
  const numerator = W * payoffRatio - L;
  const denominator = W * payoffRatio + L;
  const advantage = denominator > 0 ? Number((numerator / denominator).toFixed(4)) : 0;

  // Risk units: number of risk units until hitting the max loss limit
  // e.g. 10% limit with 1% risk = 10 units
  const riskUnits = Number((maxLossLimitPercent / riskPerTradePercent).toFixed(2));

  // Closed-form analytical Risk of Ruin
  let analyticalRuinProbability = 100;
  if (advantage > 0) {
    const ratio = (1 - advantage) / (1 + advantage);
    analyticalRuinProbability = Number((Math.pow(ratio, riskUnits) * 100).toFixed(2));
    analyticalRuinProbability = Math.max(0, Math.min(100, analyticalRuinProbability));
  } else {
    analyticalRuinProbability = 100;
  }

  // Kelly Criterion: K = (W * (R + 1) - 1) / R
  let fullKelly = 0;
  if (payoffRatio > 0) {
    const k = (W * (payoffRatio + 1) - 1) / payoffRatio;
    fullKelly = Number((Math.max(0, k) * 100).toFixed(2));
  }
  const halfKelly = Number((fullKelly / 2).toFixed(2));
  const quarterKelly = Number((fullKelly / 4).toFixed(2));

  // Recovery probability from a 50% drawdown
  // To recover from 50% drawdown, equity must double (100% gain).
  let recoveryProbability50Pct = 0;
  if (advantage > 0) {
    const ratio = (1 - advantage) / (1 + advantage);
    // Gambler's ruin probability of reaching 2x before 0x starting at 1x
    // P = (1 - ratio^U) / (1 - ratio^(2U)) with U units of risk
    const uRecovery = 50 / riskPerTradePercent;
    const rU = Math.pow(ratio, uRecovery);
    const r2U = Math.pow(ratio, 2 * uRecovery);
    if (r2U < 1) {
      recoveryProbability50Pct = Number((((1 - rU) / (1 - r2U)) * 100).toFixed(2));
    } else {
      recoveryProbability50Pct = Number((50).toFixed(2));
    }
  } else {
    recoveryProbability50Pct = 0;
  }

  // Empirical Monte Carlo validation for the current config
  const empiricalRuinProbability = simulateEmpiricalRuin({
    initialCapital,
    winRate,
    payoffRatio,
    riskPercent: riskPerTradePercent,
    maxLossPercent: maxLossLimitPercent,
    tradesCount: tradesHorizon,
    simulationsCount: 1000,
    seed: config.seed ?? 101,
  });

  // Risk sensitivity scenarios table (0.25%, 0.5%, 1.0%, 1.5%, 2.0%, 3.0%)
  const standardRiskLevels = [0.25, 0.5, 1.0, 1.5, 2.0, 3.0];
  const scenarios: RiskScenarioComparison[] = standardRiskLevels.map((riskPct, idx) => {
    const units = maxLossLimitPercent / riskPct;
    let formulaRuin = 100;
    if (advantage > 0) {
      const ratio = (1 - advantage) / (1 + advantage);
      formulaRuin = Number((Math.pow(ratio, units) * 100).toFixed(2));
      formulaRuin = Math.max(0, Math.min(100, formulaRuin));
    }

    const empirical = simulateEmpiricalRuin({
      initialCapital,
      winRate,
      payoffRatio,
      riskPercent: riskPct,
      maxLossPercent: maxLossLimitPercent,
      tradesCount: tradesHorizon,
      simulationsCount: 500,
      seed: (config.seed ?? 101) + idx * 7,
    });

    // Approximate expected final return & max drawdown for this risk tier
    const expectedReturn = Number(
      ((tradesHorizon * (W * payoffRatio - L) * riskPct)).toFixed(1),
    );
    const expectedMaxDd = Number(
      Math.min(100, (riskPct * Math.sqrt(tradesHorizon) * 1.8)).toFixed(1),
    );

    let riskTag: 'conservative' | 'balanced' | 'aggressive' | 'extreme' = 'balanced';
    if (riskPct <= 0.5) riskTag = 'conservative';
    else if (riskPct <= 1.0) riskTag = 'balanced';
    else if (riskPct <= 2.0) riskTag = 'aggressive';
    else riskTag = 'extreme';

    const isRecommended =
      advantage > 0 &&
      riskPct <= 1.5 &&
      formulaRuin <= 2.0 &&
      riskPct <= (quarterKelly > 0 ? quarterKelly : 1.5);

    return {
      riskPercent: riskPct,
      formulaRuinPercent: formulaRuin,
      empiricalRuinPercent: empirical,
      expectedFinalReturnPercent: expectedReturn,
      expectedMaxDrawdownPercent: expectedMaxDd,
      isRecommended,
      riskTag,
    };
  });

  return {
    initialCapital,
    winRate,
    payoffRatio,
    edgePercent,
    advantage,
    riskUnits,
    analyticalRuinProbability,
    empiricalRuinProbability,
    scenarios,
    kellyCriterion: {
      fullKellyPercent: fullKelly,
      halfKellyPercent: halfKelly,
      quarterKellyPercent: quarterKelly,
    },
    recoveryProbability50Pct,
  };
}

interface EmpiricalSimParams {
  initialCapital: number;
  winRate: number;
  payoffRatio: number;
  riskPercent: number;
  maxLossPercent: number;
  tradesCount: number;
  simulationsCount: number;
  seed: number;
}

function simulateEmpiricalRuin(params: EmpiricalSimParams): number {
  const prng = createMulberry32(params.seed);
  const ruinThreshold = params.initialCapital * (1 - params.maxLossPercent / 100);
  let ruinedCount = 0;

  for (let s = 0; s < params.simulationsCount; s++) {
    let balance = params.initialCapital;
    let ruined = false;

    for (let t = 0; t < params.tradesCount; t++) {
      const riskAmount = balance * (params.riskPercent / 100);
      const isWin = prng() * 100 < params.winRate;

      if (isWin) {
        balance += riskAmount * params.payoffRatio;
      } else {
        balance -= riskAmount;
      }

      if (balance <= ruinThreshold || balance <= 0) {
        ruined = true;
        break;
      }
    }

    if (ruined) ruinedCount++;
  }

  return Number(((ruinedCount / params.simulationsCount) * 100).toFixed(2));
}
