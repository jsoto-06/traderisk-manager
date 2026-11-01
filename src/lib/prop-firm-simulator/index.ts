// =============================================================================
// TradeRisk Manager — Prop Firm Challenge Simulator (Fase 5.1)
// =============================================================================

import type {
  PropFirmSimulatorConfig,
  PropFirmSimulatorResult,
  PropFirmSampleCurve,
  DistributionBin,
} from '../analytics/types';
import { createMulberry32, calculatePercentile, buildHistogramBins } from '../analytics/monte-carlo';

/**
 * Simulates proprietary trading firm challenges under realistic quantitative conditions,
 * supporting static vs. trailing drawdown models, daily loss enforcement (hard breach vs. soft pause),
 * and commission friction.
 *
 * Drawdown Types:
 * - 'static': Stop-out line never moves from initial floor: Capital * (1 - DD%).
 * - 'trailing_balance': Moves up with closed balance peaks: PeakBalance - DD_Amount.
 * - 'trailing_equity': Follows continuous high-water mark.
 * - 'trailing_hwm_lock': Trails peak until it locks permanently at initial capital.
 *
 * Daily Loss Types:
 * - 'balance_based': Evaluated against starting balance of the trading day.
 * - 'equity_based': Evaluated against intraday peak.
 *
 * Daily Loss Enforcement:
 * - 'hard_breach': Violating daily loss limit immediately terminates and fails the challenge.
 * - 'soft_pause': Violating daily loss halts trading for the remainder of that day, resuming next session.
 */
export function simulatePropFirmChallenge(
  config: PropFirmSimulatorConfig,
): PropFirmSimulatorResult {
  const prng = createMulberry32(config.seed ?? 777);
  const simulationsCount = Math.max(10, Math.min(config.simulationsCount || 1000, 5000));
  const initialCapital = Math.max(1000, config.initialCapital || 50000);
  const profitTargetPercent = Math.max(1, config.profitTargetPercent || 10);
  const targetEquity = Number((initialCapital * (1 + profitTargetPercent / 100)).toFixed(2));
  const dailyLossLimitAmount = Number(
    (initialCapital * (config.dailyLossLimitPercent / 100)).toFixed(2),
  );
  const maxDrawdownAmount = Number((initialCapital * (config.maxDrawdownPercent / 100)).toFixed(2));
  const tradesPerDay = Math.max(1, Math.min(20, config.tradesPerDay || 3));
  const maxDays = Math.max(5, Math.min(365, config.maxDays || 60));
  const dailyEnforcement = config.dailyLossEnforcement || 'hard_breach';
  const payoffRatio =
    config.averageLoss > 0
      ? Number((config.averageWin / config.averageLoss).toFixed(3))
      : 1.5;

  let passCount = 0;
  let failCount = 0;
  let dailyLossBreachCount = 0;
  let maxDrawdownBreachCount = 0;
  let bothBreachedCount = 0;
  let timeoutCount = 0;

  const daysToPassList: number[] = [];

  // Storage for sample trajectory paths (up to 2 passed, 2 failed, 1 all-days median)
  const passedTrajectories: number[][] = [];
  const failedTrajectories: number[][] = [];
  const dayStepValues: number[][] = Array.from({ length: maxDays + 1 }, () => []);

  for (let s = 0; s < simulationsCount; s++) {
    let currentBalance = initialCapital;
    let peakBalance = initialCapital;

    // Determine initial drawdown floor
    let maxDrawdownFloor = initialCapital - maxDrawdownAmount;

    let passed = false;
    let breachedDailyHard = false;
    let breachedMaxDd = false;
    let experiencedDailyLoss = false;
    let finishDay = maxDays;

    const trajectory: number[] = [initialCapital];
    dayStepValues[0].push(initialCapital);

    for (let day = 1; day <= maxDays; day++) {
      if (passed || breachedDailyHard || breachedMaxDd) {
        trajectory.push(currentBalance);
        dayStepValues[day].push(currentBalance);
        continue;
      }

      const dayStartBalance = currentBalance;
      let dayPeak = dayStartBalance;

      // Execute trades for the day
      for (let trade = 0; trade < tradesPerDay; trade++) {
        const riskAmount = currentBalance * (config.riskPerTradePercent / 100);
        const isWin = prng() * 100 < config.winRate;
        const comms = config.commissionsPerTrade || 0;

        const grossPnl = isWin ? riskAmount * payoffRatio : -riskAmount;
        const netPnl = grossPnl - comms;

        currentBalance = Number((currentBalance + netPnl).toFixed(2));
        if (currentBalance > dayPeak) dayPeak = currentBalance;
        if (currentBalance > peakBalance) peakBalance = currentBalance;

        // Update trailing drawdown floor according to mode
        if (config.drawdownType === 'static') {
          maxDrawdownFloor = initialCapital - maxDrawdownAmount;
        } else if (config.drawdownType === 'trailing_balance' || config.drawdownType === 'trailing_equity') {
          maxDrawdownFloor = peakBalance - maxDrawdownAmount;
        } else if (config.drawdownType === 'trailing_hwm_lock') {
          const trailingFloor = peakBalance - maxDrawdownAmount;
          // Lock at initial capital once peak reaches initialCapital + maxDrawdownAmount
          maxDrawdownFloor = trailingFloor >= initialCapital ? initialCapital : trailingFloor;
        }

        // Check Max Drawdown breach (applies immediately)
        if (currentBalance <= maxDrawdownFloor) {
          breachedMaxDd = true;
          break;
        }

        // Check Daily Loss breach
        const currentDailyLoss =
          config.dailyLossType === 'equity_based'
            ? dayPeak - currentBalance
            : dayStartBalance - currentBalance;

        if (currentDailyLoss >= dailyLossLimitAmount) {
          experiencedDailyLoss = true;
          if (dailyEnforcement === 'hard_breach') {
            breachedDailyHard = true;
            break;
          } else {
            // soft_pause: halt trading for today and resume next session
            break;
          }
        }

        // Check Target reached
        if (currentBalance >= targetEquity) {
          passed = true;
          finishDay = day;
          break;
        }
      }

      trajectory.push(currentBalance);
      dayStepValues[day].push(currentBalance);

      if (passed || breachedDailyHard || breachedMaxDd) {
        finishDay = day;
      }
    }

    const failed = breachedDailyHard || breachedMaxDd;

    if (passed) {
      passCount++;
      daysToPassList.push(finishDay);
      if (passedTrajectories.length < 2) {
        passedTrajectories.push(trajectory);
      }
    } else if (failed) {
      failCount++;
      const dlBreached = breachedDailyHard || experiencedDailyLoss;
      if (dlBreached && breachedMaxDd) bothBreachedCount++;
      else if (dlBreached) dailyLossBreachCount++;
      else if (breachedMaxDd) maxDrawdownBreachCount++;

      if (failedTrajectories.length < 2) {
        failedTrajectories.push(trajectory);
      }
    } else {
      timeoutCount++;
    }
  }

  // Aggregate probabilities
  const passProbability = Number(((passCount / simulationsCount) * 100).toFixed(2));
  const failProbability = Number(((failCount / simulationsCount) * 100).toFixed(2));
  const dailyLossBreachProbability = Number(
    (((dailyLossBreachCount + bothBreachedCount) / simulationsCount) * 100).toFixed(2),
  );
  const maxDrawdownBreachProbability = Number(
    (((maxDrawdownBreachCount + bothBreachedCount) / simulationsCount) * 100).toFixed(2),
  );
  const timeoutProbability = Number(((timeoutCount / simulationsCount) * 100).toFixed(2));

  // Compute days to pass metrics
  let expectedDaysToPass: number | null = null;
  let medianDaysToPass: number | null = null;
  let daysDistribution: DistributionBin[] = [];

  if (daysToPassList.length > 0) {
    daysToPassList.sort((a, b) => a - b);
    const sumDays = daysToPassList.reduce((acc, d) => acc + d, 0);
    expectedDaysToPass = Number((sumDays / daysToPassList.length).toFixed(1));
    medianDaysToPass = calculatePercentile(daysToPassList, 0.5);
    daysDistribution = buildHistogramBins(daysToPassList, Math.min(10, maxDays));
  }

  // Build sample trajectories for Recharts visualization
  const samplePaths: PropFirmSampleCurve[] = [];
  for (let d = 0; d <= maxDays; d++) {
    const sortedDayValues = dayStepValues[d].slice().sort((a, b) => a - b);
    const medianVal = calculatePercentile(sortedDayValues, 0.5);

    samplePaths.push({
      day: d,
      passed1: passedTrajectories[0] ? passedTrajectories[0][d] : undefined,
      passed2: passedTrajectories[1] ? passedTrajectories[1][d] : undefined,
      failed1: failedTrajectories[0] ? failedTrajectories[0][d] : undefined,
      failed2: failedTrajectories[1] ? failedTrajectories[1][d] : undefined,
      medianPath: medianVal,
      targetLine: targetEquity,
      initialCapitalLine: initialCapital,
    });
  }

  return {
    config,
    simulationsCount,
    passProbability,
    failProbability,
    dailyLossBreachProbability,
    maxDrawdownBreachProbability,
    timeoutProbability,
    expectedDaysToPass,
    medianDaysToPass,
    daysDistribution,
    samplePaths,
    breachAnalysis: {
      dailyLossBreaches: dailyLossBreachCount + bothBreachedCount,
      maxDrawdownBreaches: maxDrawdownBreachCount + bothBreachedCount,
      bothBreached: bothBreachedCount,
    },
  };
}
