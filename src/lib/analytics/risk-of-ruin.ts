// =============================================================================
// TradeRisk Manager — Risk of Ruin & Kelly Criterion Module (Fase 5.1)
// =============================================================================

import type {
  RiskOfRuinConfig,
  RiskOfRuinResult,
  RiskScenarioComparison,
  KellySensitivity,
} from './types';
import { createMulberry32 } from './monte-carlo';

/**
 * Calculates asymptotic (T -> inf) and finite horizon (T trades) Risk of Ruin,
 * Kelly Criterion fractions, Kelly sensitivity analysis, and multi-tier risk scenarios.
 *
 * References:
 * - Ralph Vince: "The Mathematics of Money Management"
 * - Perry Belmont: Analytical advantage formula: A = (W*R - L) / (W*R + L)
 * - J. L. Kelly Jr.: "A New Interpretation of Information Rate" (1956)
 */
export function calculateRiskOfRuin(config: RiskOfRuinConfig): RiskOfRuinResult {
  const initialCapital = Math.max(100, config.initialCapital || 10000);
  const winRate = Math.max(0, Math.min(100, config.winRate));
  const averageWin = Math.max(0.01, config.averageWin);
  const averageLoss = Math.max(0.01, config.averageLoss);
  const riskPerTradePercent = Math.max(0.05, Math.min(50, config.riskPerTradePercent));
  const maxLossLimitPercent = Math.max(1, Math.min(100, config.maxLossLimitPercent));
  const tradesHorizon = Math.max(1, Math.min(5000, config.tradesHorizon || 200));

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

  // 1. Asymptotic Risk of Ruin (T -> infinity)
  // Vince / Belmont closed form: RoR = ((1 - A) / (1 + A))^U
  let asymptoticRuinProbability = 100;
  if (advantage > 0) {
    const ratio = (1 - advantage) / (1 + advantage);
    asymptoticRuinProbability = Number((Math.pow(ratio, riskUnits) * 100).toFixed(2));
    asymptoticRuinProbability = Math.max(0, Math.min(100, asymptoticRuinProbability));
  } else {
    // Over an infinite sequence of trades with negative or zero advantage, ruin is mathematically certain (100%)
    asymptoticRuinProbability = 100;
  }

  // 2. Finite Horizon Risk of Ruin (T trades)
  // Evaluated via 2,000 deterministic Monte Carlo paths over the specific tradesHorizon
  const riskModel = config.riskModel ?? 'fixed_amount';
  const empiricalSimulation = simulateEmpiricalRuin({
    initialCapital,
    winRate,
    payoffRatio,
    riskPercent: riskPerTradePercent,
    maxLossPercent: maxLossLimitPercent,
    tradesCount: tradesHorizon,
    simulationsCount: 2000,
    seed: config.seed ?? 101,
    riskModel,
  });

  const finiteHorizonRuinProbability = empiricalSimulation.ruinProbability;
  const empiricalRuinProbability = finiteHorizonRuinProbability;

  // 3. Kelly Criterion & Sensitivity Analysis
  // K = (W * (R + 1) - 1) / R
  let fullKelly = 0;
  if (payoffRatio > 0) {
    const k = (W * (payoffRatio + 1) - 1) / payoffRatio;
    fullKelly = Number((Math.max(0, k) * 100).toFixed(2));
  }
  const halfKelly = Number((fullKelly / 2).toFixed(2));
  const quarterKelly = Number((fullKelly / 4).toFixed(2));
  const maxKellyCap = config.maxKellyCapPercent ?? 25;
  const cappedKelly = Number(Math.min(fullKelly, maxKellyCap).toFixed(2));
  const isCapped = fullKelly > maxKellyCap;

  // Kelly Sensitivities:
  // dK / dW = 1 + 1/R
  const sensitivityToWinRate = Number((1 + 1 / payoffRatio).toFixed(3));
  // dK / dR = (1 - W) / R^2
  const sensitivityToPayoff = Number(((1 - W) / Math.pow(payoffRatio, 2)).toFixed(3));

  // Stressed / Conservative Kelly scenario:
  // Stressed Win Rate (conservative -5% absolute)
  const stressedW = Math.max(0, W - 0.05);
  // Stressed Payoff Ratio (-15% relative degradation due to slippage/spread)
  const stressedR = Math.max(0.1, payoffRatio * 0.85);
  let stressedKelly = 0;
  if (stressedR > 0) {
    const kStressed = (stressedW * (stressedR + 1) - 1) / stressedR;
    stressedKelly = Number((Math.max(0, kStressed) * 100).toFixed(2));
  }

  const kellySensitivity: KellySensitivity = {
    sensitivityToWinRate,
    sensitivityToPayoff,
    stressedKellyPercent: stressedKelly,
    stressedWinRate: Number((stressedW * 100).toFixed(1)),
    stressedPayoffRatio: Number(stressedR.toFixed(2)),
  };

  // Recovery probability from a 50% drawdown
  // To recover from a 50% drawdown, equity must double (+100% gain).
  let recoveryProbability50Pct = 0;
  if (advantage > 0) {
    const ratio = (1 - advantage) / (1 + advantage);
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
      simulationsCount: 1000,
      seed: (config.seed ?? 101) + (idx + 1) * 13,
    });

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
      empiricalRuinPercent: empirical.ruinProbability,
      expectedFinalReturnPercent: expectedReturn,
      expectedMaxDrawdownPercent: expectedMaxDd,
      isRecommended,
      riskTag,
    };
  });

  const hypothesesAndLimits = [
    'Independencia e idéntica distribución (I.I.D.): Las fórmulas asumen ausencia de autocorrelación serial entre operaciones consecutivas.',
    'Horizonte Asintótico vs. Finito: La fórmula cerrada de Ralph Vince / Belmont modela el límite asintótico cuando T -> infinito. En un horizonte finito T, la probabilidad empírica de ruina depende de T y de las unidades de parada U (puede ser 0% si T < U, intermedia, o 100% si el sistema carece de aciertos o el riesgo por operación agota el capital).',
    'Criterio de Kelly No es una Garantía: Maximiza asintóticamente la tasa de crecimiento logarítmico del capital, pero no garantiza rentabilidad en plazos finitos y expone la cuenta a drawdowns profundos (50%-80%). Se incluye un tope de riesgo máximo configurable para prevenir sobreexposición.',
    'Sensibilidad de Parámetros: Pequeñas variaciones muestrales en el Win Rate o Payoff Ratio modifican de forma desproporcionada la fracción óptima de Kelly.',
    'Estacionariedad de Régimen: Los modelos asumen constancia en las condiciones de mercado; no contemplan cisnes negros fuera de la muestra histórica.',
  ];

  if (config.historicalSampleSize !== undefined && config.historicalSampleSize < 30) {
    hypothesesAndLimits.push(
      `Muestra Histórica Insuficiente (N = ${config.historicalSampleSize} < 30): La estimación empírica de Win Rate y Payoff Ratio presenta un error estándar muestral elevado. El Criterio de Kelly sin regularizar amplifica estos errores de estimación.`,
    );
  }

  return {
    initialCapital,
    winRate,
    payoffRatio,
    edgePercent,
    advantage,
    riskUnits,
    analyticalRuinProbability: asymptoticRuinProbability, // preserved for backward-compatibility
    asymptoticRuinProbability,
    finiteHorizonRuinProbability,
    empiricalRuinProbability,
    scenarios,
    kellyCriterion: {
      fullKellyPercent: fullKelly,
      halfKellyPercent: halfKelly,
      quarterKellyPercent: quarterKelly,
      cappedKellyPercent: cappedKelly,
      maxKellyCapPercent: maxKellyCap,
      isCapped,
    },
    kellySensitivity,
    recoveryProbability50Pct,
    hypothesesAndLimits,
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
  riskModel?: 'fixed_amount' | 'percentage_equity';
}

interface EmpiricalSimOutput {
  ruinProbability: number;
  lossProbability: number;
}

function simulateEmpiricalRuin(params: EmpiricalSimParams): EmpiricalSimOutput {
  const prng = createMulberry32(params.seed);
  const ruinThreshold = params.initialCapital * (1 - params.maxLossPercent / 100);
  const isFixed = (params.riskModel ?? 'fixed_amount') === 'fixed_amount';
  const fixedRiskDollars = params.initialCapital * (params.riskPercent / 100);
  let ruinedCount = 0;
  let endingLossCount = 0;

  for (let s = 0; s < params.simulationsCount; s++) {
    let balance = params.initialCapital;
    let ruined = false;

    for (let t = 0; t < params.tradesCount; t++) {
      const riskAmount = isFixed ? fixedRiskDollars : balance * (params.riskPercent / 100);
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
    if (balance < params.initialCapital) endingLossCount++;
  }

  return {
    ruinProbability: Number(((ruinedCount / params.simulationsCount) * 100).toFixed(2)),
    lossProbability: Number(((endingLossCount / params.simulationsCount) * 100).toFixed(2)),
  };
}
