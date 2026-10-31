// =============================================================================
// TradeRisk Manager — Risk of Ruin & Kelly Criterion Module Tests (Fase 5)
// =============================================================================

import { describe, it, expect } from 'vitest';
import { calculateRiskOfRuin } from '@/lib/analytics/risk-of-ruin';

describe('Analytics — Risk of Ruin & Kelly Criterion Module', () => {
  it('returns 100% ruin probability when edge is zero or negative', () => {
    // 40% win rate with 1:1 payoff -> negative expectancy
    const res = calculateRiskOfRuin({
      initialCapital: 10000,
      winRate: 40,
      averageWin: 100,
      averageLoss: 100,
      riskPerTradePercent: 1.0,
      maxLossLimitPercent: 10,
    });

    expect(res.advantage).toBeLessThanOrEqual(0);
    expect(res.analyticalRuinProbability).toBe(100);
    expect(res.kellyCriterion.fullKellyPercent).toBe(0);
    expect(res.kellyCriterion.halfKellyPercent).toBe(0);
    expect(res.recoveryProbability50Pct).toBe(0);
  });

  it('calculates analytical Perry/Ralph Vince ruin and Kelly criterion with positive edge', () => {
    // 50% win rate with 2:1 payoff
    // W = 0.5, L = 0.5, R = 2
    // A = (0.5*2 - 0.5) / (0.5*2 + 0.5) = 0.5 / 1.5 = 0.3333
    // Ratio = (1 - 0.3333)/(1 + 0.3333) = 0.6667 / 1.3333 = 0.5
    // With 10% max loss limit and 1% risk per trade -> 10 units
    // RoR = (0.5)^10 = 0.000976 = ~0.10%
    // Kelly: K = (0.5 * 3 - 1) / 2 = 0.5 / 2 = 0.25 (25%)
    const res = calculateRiskOfRuin({
      initialCapital: 10000,
      winRate: 50,
      averageWin: 200,
      averageLoss: 100,
      riskPerTradePercent: 1.0,
      maxLossLimitPercent: 10,
      seed: 1234,
    });

    expect(res.advantage).toBeCloseTo(0.3333, 2);
    expect(res.analyticalRuinProbability).toBeLessThan(1.0); // Very low ruin with 1% risk
    expect(res.analyticalRuinProbability).toBeGreaterThan(0);

    expect(res.kellyCriterion.fullKellyPercent).toBe(25.0);
    expect(res.kellyCriterion.halfKellyPercent).toBe(12.5);
    expect(res.kellyCriterion.quarterKellyPercent).toBe(6.25);

    expect(res.recoveryProbability50Pct).toBeGreaterThan(90);
  });

  it('evaluates multi-tier risk sensitivity scenarios', () => {
    const res = calculateRiskOfRuin({
      initialCapital: 50000,
      winRate: 55,
      averageWin: 300,
      averageLoss: 200, // 1.5:1 payoff
      riskPerTradePercent: 1.0,
      maxLossLimitPercent: 10, // 10% Prop Firm drawdown limit
      seed: 42,
    });

    expect(res.scenarios).toHaveLength(6); // 0.25%, 0.5%, 1%, 1.5%, 2%, 3%
    const [sc025, sc05, sc1, , , sc3] = res.scenarios;

    expect(sc025.riskPercent).toBe(0.25);
    expect(sc025.riskTag).toBe('conservative');

    expect(sc3.riskPercent).toBe(3.0);
    expect(sc3.riskTag).toBe('extreme');

    // Risk of ruin must increase as risk-per-trade increases
    expect(sc3.formulaRuinPercent).toBeGreaterThanOrEqual(sc1.formulaRuinPercent);
    expect(sc1.formulaRuinPercent).toBeGreaterThanOrEqual(sc025.formulaRuinPercent);

    // Conservative tiers should be recommended when edge is positive
    expect(sc05.isRecommended).toBe(true);
  });
});
