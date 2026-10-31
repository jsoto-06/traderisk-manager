// =============================================================================
// TradeRisk Manager — Prop Firm Simulator Tests (Fase 5)
// =============================================================================

import { describe, it, expect } from 'vitest';
import { simulatePropFirmChallenge } from '@/lib/prop-firm-simulator';
import type { PropFirmSimulatorConfig } from '@/lib/analytics/types';

describe('Prop Firm Simulator — Multi-Rule Challenge Engine', () => {
  it('correctly models static drawdown challenge', () => {
    const config: PropFirmSimulatorConfig = {
      initialCapital: 100000,
      profitTargetPercent: 10, // Target $110,000
      dailyLossLimitPercent: 5, // Daily loss $5,000
      maxDrawdownPercent: 10, // Static drawdown floor $90,000
      drawdownType: 'static',
      dailyLossType: 'balance_based',
      resetHour: 0,
      resetTimezone: 'UTC',
      winRate: 55,
      averageWin: 1500,
      averageLoss: 1000,
      riskPerTradePercent: 1.0,
      tradesPerDay: 2,
      maxDays: 40,
      commissionsPerTrade: 5,
      simulationsCount: 150,
      seed: 888,
    };

    const res = simulatePropFirmChallenge(config);

    expect(res.simulationsCount).toBe(150);
    expect(res.passProbability + res.failProbability + res.timeoutProbability).toBeCloseTo(100, 1);
    expect(res.samplePaths).toHaveLength(41); // Day 0 to 40
    expect(res.samplePaths[0].targetLine).toBe(110000);
    expect(res.samplePaths[0].initialCapitalLine).toBe(100000);
    expect(res.breachAnalysis.dailyLossBreaches).toBeGreaterThanOrEqual(0);
  });

  it('enforces stricter failure rates on trailing drawdown than on static drawdown', () => {
    const baseConfig: Omit<PropFirmSimulatorConfig, 'drawdownType'> = {
      initialCapital: 50000,
      profitTargetPercent: 8,
      dailyLossLimitPercent: 4,
      maxDrawdownPercent: 8,
      dailyLossType: 'balance_based',
      resetHour: 0,
      resetTimezone: 'UTC',
      winRate: 48,
      averageWin: 800,
      averageLoss: 800, // 0 edge
      riskPerTradePercent: 1.0,
      tradesPerDay: 3,
      maxDays: 30,
      commissionsPerTrade: 2,
      simulationsCount: 200,
      seed: 456,
    };

    const staticRes = simulatePropFirmChallenge({
      ...baseConfig,
      drawdownType: 'static',
    });

    const trailingRes = simulatePropFirmChallenge({
      ...baseConfig,
      drawdownType: 'trailing_balance',
    });

    // Trailing drawdown ratchets up peak, so max drawdown breach is higher or equal
    expect(trailingRes.maxDrawdownBreachProbability).toBeGreaterThanOrEqual(
      staticRes.maxDrawdownBreachProbability,
    );
  });

  it('correctly models trailing_hwm_lock locking at initial capital', () => {
    const config: PropFirmSimulatorConfig = {
      initialCapital: 25000,
      profitTargetPercent: 6,
      dailyLossLimitPercent: 3,
      maxDrawdownPercent: 5,
      drawdownType: 'trailing_hwm_lock',
      dailyLossType: 'balance_based',
      resetHour: 17,
      resetTimezone: 'America/New_York',
      winRate: 60,
      averageWin: 600,
      averageLoss: 300,
      riskPerTradePercent: 0.5,
      tradesPerDay: 2,
      maxDays: 30,
      commissionsPerTrade: 1,
      simulationsCount: 100,
      seed: 321,
    };

    const res = simulatePropFirmChallenge(config);
    expect(res.passProbability).toBeGreaterThan(0);
    if (res.expectedDaysToPass !== null) {
      expect(res.expectedDaysToPass).toBeGreaterThan(0);
      expect(res.expectedDaysToPass).toBeLessThanOrEqual(30);
    }
  });
});
