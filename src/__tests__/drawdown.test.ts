// =============================================================================
// TradeRisk Manager — Drawdown & Consistency Analytics Tests (Fase 5)
// =============================================================================

import { describe, it, expect } from 'vitest';
import { calculateDrawdownMetrics } from '@/lib/analytics/drawdown';
import type { Trade } from '@/lib/types';

describe('Analytics — Drawdown & Consistency Module', () => {
  it('returns valid initial state on empty trade history', () => {
    const res = calculateDrawdownMetrics([], 20000);
    expect(res.maxDrawdownAmount).toBe(0);
    expect(res.maxDrawdownPercent).toBe(0);
    expect(res.currentDrawdownAmount).toBe(0);
    expect(res.recoveryFactor).toBe(0);
    expect(res.recoveryTrades).toBe(0);
    expect(res.maxWinStreak).toBe(0);
    expect(res.maxLossStreak).toBe(0);
    expect(res.drawdownSeries).toHaveLength(1);
    expect(res.drawdownSeries[0].balance).toBe(20000);
  });

  it('accurately tracks peak, max drawdown ($ and %), and streaks', () => {
    // Sequence:
    // Initial: $10,000
    // Trade 1: +$1,000 -> Balance $11,000 (Peak $11,000, DD 0)
    // Trade 2: +$1,000 -> Balance $12,000 (Peak $12,000, DD 0)
    // Trade 3: -$2,400 -> Balance $9,600  (Peak $12,000, DD $2400 / 20%)
    // Trade 4: -$600   -> Balance $9,000  (Peak $12,000, DD $3000 / 25%)
    // Trade 5: +$2,000 -> Balance $11,000 (Peak $12,000, DD $1000 / 8.33%)
    // Trade 6: +$2,000 -> Balance $13,000 (Peak $13,000, DD 0, new peak!)
    const trades: Trade[] = [
      {
        id: '1',
        accountId: 'acc',
        asset: 'BTC',
        direction: 'long',
        entryPrice: 100,
        stopLoss: 90,
        takeProfit: 120,
        size: 1,
        openDate: '2026-10-01',
        closeDate: '2026-10-01',
        status: 'closed',
        result: 1000,
        commissions: 0,
        strategy: '',
        timeframe: '',
        notes: '',
      },
      {
        id: '2',
        accountId: 'acc',
        asset: 'BTC',
        direction: 'long',
        entryPrice: 100,
        stopLoss: 90,
        takeProfit: 120,
        size: 1,
        openDate: '2026-10-02',
        closeDate: '2026-10-02',
        status: 'closed',
        result: 1000,
        commissions: 0,
        strategy: '',
        timeframe: '',
        notes: '',
      },
      {
        id: '3',
        accountId: 'acc',
        asset: 'BTC',
        direction: 'long',
        entryPrice: 100,
        stopLoss: 90,
        takeProfit: 120,
        size: 1,
        openDate: '2026-10-03',
        closeDate: '2026-10-03',
        status: 'closed',
        result: -2400,
        commissions: 0,
        strategy: '',
        timeframe: '',
        notes: '',
      },
      {
        id: '4',
        accountId: 'acc',
        asset: 'BTC',
        direction: 'long',
        entryPrice: 100,
        stopLoss: 90,
        takeProfit: 120,
        size: 1,
        openDate: '2026-10-04',
        closeDate: '2026-10-04',
        status: 'closed',
        result: -600,
        commissions: 0,
        strategy: '',
        timeframe: '',
        notes: '',
      },
      {
        id: '5',
        accountId: 'acc',
        asset: 'BTC',
        direction: 'long',
        entryPrice: 100,
        stopLoss: 90,
        takeProfit: 120,
        size: 1,
        openDate: '2026-10-05',
        closeDate: '2026-10-05',
        status: 'closed',
        result: 2000,
        commissions: 0,
        strategy: '',
        timeframe: '',
        notes: '',
      },
      {
        id: '6',
        accountId: 'acc',
        asset: 'BTC',
        direction: 'long',
        entryPrice: 100,
        stopLoss: 90,
        takeProfit: 120,
        size: 1,
        openDate: '2026-10-06',
        closeDate: '2026-10-06',
        status: 'closed',
        result: 2000,
        commissions: 0,
        strategy: '',
        timeframe: '',
        notes: '',
      },
    ];

    const metrics = calculateDrawdownMetrics(trades, 10000);

    expect(metrics.maxDrawdownAmount).toBe(3000);
    expect(metrics.maxDrawdownPercent).toBe(25); // 3000 / 12000 * 100 = 25%
    expect(metrics.currentDrawdownAmount).toBe(0); // Trade 6 is at new peak $13,000
    expect(metrics.currentDrawdownPercent).toBe(0);

    // Max win streak: trade 1, 2 = 2. Trade 5, 6 = 2.
    expect(metrics.maxWinStreak).toBe(2);
    // Max loss streak: trade 3, 4 = 2.
    expect(metrics.maxLossStreak).toBe(2);

    // Recovery trades: trades 3, 4, 5 were underwater (3 trades) before trade 6 reached new peak
    expect(metrics.recoveryTrades).toBe(3);

    // Net profit = 13000 - 10000 = 3000. Recovery Factor = 3000 / 3000 = 1.0
    expect(metrics.recoveryFactor).toBe(1.0);

    expect(metrics.drawdownSeries).toHaveLength(7);
  });

  it('computes average drawdown percent across underwater dips', () => {
    const trades: Trade[] = [
      {
        id: '1',
        accountId: 'acc',
        asset: 'XAU',
        direction: 'long',
        entryPrice: 2000,
        stopLoss: 1990,
        takeProfit: 2020,
        size: 1,
        openDate: '2026-10-01',
        closeDate: '2026-10-01',
        status: 'closed',
        result: -1000, // 10k -> 9k (-10%)
        commissions: 0,
        strategy: '',
        timeframe: '',
        notes: '',
      },
      {
        id: '2',
        accountId: 'acc',
        asset: 'XAU',
        direction: 'long',
        entryPrice: 2000,
        stopLoss: 1990,
        takeProfit: 2020,
        size: 1,
        openDate: '2026-10-02',
        closeDate: '2026-10-02',
        status: 'closed',
        result: -1000, // 9k -> 8k (-20%)
        commissions: 0,
        strategy: '',
        timeframe: '',
        notes: '',
      },
    ];

    const metrics = calculateDrawdownMetrics(trades, 10000);
    expect(metrics.maxDrawdownPercent).toBe(20);
    // Underwater values: 10% and 20% -> average is 15%
    expect(metrics.averageDrawdownPercent).toBe(15);
  });
});
