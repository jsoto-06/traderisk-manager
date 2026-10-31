// =============================================================================
// TradeRisk Manager — Monte Carlo Simulation Engine Tests (Fase 5)
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  runMonteCarloSimulation,
  createMulberry32,
  calculatePercentile,
  buildHistogramBins,
} from '@/lib/analytics/monte-carlo';
import type { Trade } from '@/lib/types';
import type { MonteCarloConfig } from '@/lib/analytics/types';

describe('Analytics — Monte Carlo Simulation Engine', () => {
  it('PRNG generates deterministic repeatable values for identical seed', () => {
    const prng1 = createMulberry32(12345);
    const prng2 = createMulberry32(12345);

    for (let i = 0; i < 100; i++) {
      expect(prng1()).toBe(prng2());
    }
  });

  it('calculatePercentile computes accurate percentiles', () => {
    const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(calculatePercentile(values, 0.5)).toBe(55);
    expect(calculatePercentile(values, 0.0)).toBe(10);
    expect(calculatePercentile(values, 1.0)).toBe(100);
  });

  it('buildHistogramBins distributes values correctly into bins', () => {
    const values = [10, 15, 20, 25, 30, 35, 40, 45, 50];
    const bins = buildHistogramBins(values, 4);
    expect(bins).toHaveLength(4);
    const totalCount = bins.reduce((acc, b) => acc + b.count, 0);
    expect(totalCount).toBe(values.length);
  });

  it('runs deterministic simulation using custom distribution and returns percentiles', () => {
    const config: MonteCarloConfig = {
      simulationsCount: 200,
      tradesCount: 50,
      initialCapital: 10000,
      riskType: 'percentage_equity',
      riskValue: 1.0, // 1% risk per trade
      seed: 999,
      customDistribution: {
        winRate: 55,
        averageWin: 200,
        averageLoss: 100, // 2:1 payoff
      },
      profitTarget: 12000,
      maxDrawdownLimitPercent: 10,
    };

    const res1 = runMonteCarloSimulation([], config);
    const res2 = runMonteCarloSimulation([], config);

    // Exact determinism
    expect(res1.medianFinalEquity).toBe(res2.medianFinalEquity);
    expect(res1.profitProbability).toBe(res2.profitProbability);
    expect(res1.drawdownBreachProbability).toBe(res2.drawdownBreachProbability);

    // Strong edge (55% win rate, 2:1 payoff) -> positive expectancy
    expect(res1.profitProbability).toBeGreaterThan(60);
    expect(res1.medianFinalEquity).toBeGreaterThan(10000);
    expect(res1.percentiles.p95).toBeGreaterThan(res1.percentiles.p50);
    expect(res1.percentiles.p50).toBeGreaterThan(res1.percentiles.p5);

    // Curves have correct length (tradesCount + 1)
    expect(res1.curves).toHaveLength(51);
    expect(res1.curves[0].p50).toBe(10000);

    // Disclaimer is present
    expect(res1.disclaimer).toBeTruthy();
  });

  it('runs bootstrap sampling with replacement from historical trades', () => {
    const historicalTrades: Trade[] = [
      {
        id: 't1',
        accountId: 'acc',
        asset: 'BTC',
        direction: 'long',
        entryPrice: 50000,
        stopLoss: 49000,
        takeProfit: 52000,
        size: 1,
        openDate: '2026-10-01',
        closeDate: '2026-10-01',
        status: 'closed',
        result: 2000, // +2R
        commissions: 0,
        strategy: '',
        timeframe: '',
        notes: '',
      },
      {
        id: 't2',
        accountId: 'acc',
        asset: 'BTC',
        direction: 'long',
        entryPrice: 50000,
        stopLoss: 49000,
        takeProfit: 52000,
        size: 1,
        openDate: '2026-10-02',
        closeDate: '2026-10-02',
        status: 'closed',
        result: -1000, // -1R
        commissions: 0,
        strategy: '',
        timeframe: '',
        notes: '',
      },
      {
        id: 't3',
        accountId: 'acc',
        asset: 'BTC',
        direction: 'long',
        entryPrice: 50000,
        stopLoss: 49000,
        takeProfit: 52000,
        size: 1,
        openDate: '2026-10-03',
        closeDate: '2026-10-03',
        status: 'closed',
        result: 1500, // +1.5R
        commissions: 0,
        strategy: '',
        timeframe: '',
        notes: '',
      },
      {
        id: 't4',
        accountId: 'acc',
        asset: 'BTC',
        direction: 'long',
        entryPrice: 50000,
        stopLoss: 49000,
        takeProfit: 52000,
        size: 1,
        openDate: '2026-10-04',
        closeDate: '2026-10-04',
        status: 'closed',
        result: -1000, // -1R
        commissions: 0,
        strategy: '',
        timeframe: '',
        notes: '',
      },
      {
        id: 't5',
        accountId: 'acc',
        asset: 'BTC',
        direction: 'long',
        entryPrice: 50000,
        stopLoss: 49000,
        takeProfit: 52000,
        size: 1,
        openDate: '2026-10-05',
        closeDate: '2026-10-05',
        status: 'closed',
        result: 3000, // +3R
        commissions: 0,
        strategy: '',
        timeframe: '',
        notes: '',
      },
    ];

    const config: MonteCarloConfig = {
      simulationsCount: 150,
      tradesCount: 40,
      initialCapital: 50000,
      riskType: 'fixed_amount',
      riskValue: 500,
      seed: 42,
    };

    const res = runMonteCarloSimulation(historicalTrades, config);
    expect(res.simulationsCount).toBe(150);
    expect(res.tradesCount).toBe(40);
    expect(res.medianFinalEquity).toBeGreaterThan(50000);
  });
});
