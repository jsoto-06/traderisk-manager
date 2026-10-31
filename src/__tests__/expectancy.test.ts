// =============================================================================
// TradeRisk Manager — Mathematical Expectancy Tests (Fase 5)
// =============================================================================

import { describe, it, expect } from 'vitest';
import { calculateExpectancy, filterTrades } from '@/lib/analytics/expectancy';
import type { Trade } from '@/lib/types';

describe('Analytics — Mathematical Expectancy Module', () => {
  const sampleTrades: Trade[] = [
    {
      id: 't1',
      accountId: 'acc-1',
      asset: 'BTC/USDT',
      direction: 'long',
      entryPrice: 50000,
      stopLoss: 49000, // 1000 risk per unit -> 1 unit = $1000 risk
      takeProfit: 52000,
      size: 1,
      openDate: '2026-10-01T10:00:00Z',
      closeDate: '2026-10-01T12:00:00Z',
      status: 'closed',
      result: 2000, // +$2000 gross
      commissions: 10, // +$1990 net (+1.99R)
      strategy: 'Breakout',
      timeframe: '1h',
      notes: '',
    },
    {
      id: 't2',
      accountId: 'acc-1',
      asset: 'BTC/USDT',
      direction: 'long',
      entryPrice: 50000,
      stopLoss: 49000,
      takeProfit: 52000,
      size: 1,
      openDate: '2026-10-02T10:00:00Z',
      closeDate: '2026-10-02T12:00:00Z',
      status: 'closed',
      result: -1000, // -$1000 gross
      commissions: 10, // -$1010 net (-1.01R)
      strategy: 'Breakout',
      timeframe: '1h',
      notes: '',
    },
    {
      id: 't3',
      accountId: 'acc-2',
      asset: 'EUR/USD',
      direction: 'short',
      entryPrice: 1.1000,
      stopLoss: 1.1050,
      takeProfit: 1.0900,
      size: 100000,
      openDate: '2026-10-03T10:00:00Z',
      closeDate: '2026-10-03T12:00:00Z',
      status: 'closed',
      result: 0, // Breakeven trade
      commissions: 0,
      strategy: 'Reversal',
      timeframe: '4h',
      notes: '',
    },
    {
      id: 't4-open',
      accountId: 'acc-1',
      asset: 'ETH/USDT',
      direction: 'long',
      entryPrice: 3000,
      stopLoss: 2900,
      takeProfit: 3200,
      size: 1,
      openDate: '2026-10-04T10:00:00Z',
      status: 'open',
      commissions: 0,
      strategy: 'Trend',
      timeframe: '15m',
      notes: '',
    },
  ];

  it('handles empty trade list safely', () => {
    const res = calculateExpectancy([]);
    expect(res.totalTrades).toBe(0);
    expect(res.winRate).toBe(0);
    expect(res.expectancy).toBe(0);
    expect(res.isSampleSizeAdequate).toBe(false);
    expect(res.sampleSizeWarning).toContain('No hay operaciones');
  });

  it('filters open trades and accurately classifies win, loss, and breakeven', () => {
    const res = calculateExpectancy(sampleTrades);
    expect(res.totalTrades).toBe(3); // excludes t4-open
    expect(res.winningTrades).toBe(1);
    expect(res.losingTrades).toBe(1);
    expect(res.breakevenTrades).toBe(1);

    expect(res.winRate).toBe(33.33);
    expect(res.lossRate).toBe(33.33);
    expect(res.breakevenRate).toBe(33.33);

    expect(res.netProfit).toBe(980); // 1990 - 1010 = 980
    expect(res.grossProfit).toBe(1990);
    expect(res.grossLoss).toBe(1010);
    expect(res.totalCommissions).toBe(20);

    // Expectancy per trade: 980 / 3 = 326.67
    expect(res.expectancy).toBeCloseTo(326.67, 1);
    expect(res.expectancyR).toBeGreaterThan(0);
    expect(res.profitFactor).toBeCloseTo(1990 / 1010, 2);
  });

  it('evaluates sample size adequacy warnings', () => {
    const resSmall = calculateExpectancy(sampleTrades);
    expect(resSmall.isSampleSizeAdequate).toBe(false);
    expect(resSmall.sampleSizeWarning).toContain('Muestra insuficiente');

    // Generate 35 mock trades
    const thirtyFiveTrades: Trade[] = Array.from({ length: 35 }, (_, i) => ({
      id: `gen-${i}`,
      accountId: 'acc-1',
      asset: 'BTC/USDT',
      direction: 'long',
      entryPrice: 50000,
      stopLoss: 49500,
      takeProfit: 51000,
      size: 1,
      openDate: '2026-10-01T10:00:00Z',
      closeDate: '2026-10-01T12:00:00Z',
      status: 'closed',
      result: i % 2 === 0 ? 500 : -300,
      commissions: 2,
      strategy: 'Scalp',
      timeframe: '5m',
      notes: '',
    }));

    const resLarge = calculateExpectancy(thirtyFiveTrades);
    expect(resLarge.totalTrades).toBe(35);
    expect(resLarge.isSampleSizeAdequate).toBe(true);
    expect(resLarge.sampleSizeWarning).toBeNull();
  });

  it('correctly filters by account, asset, and strategy', () => {
    const accFiltered = filterTrades(sampleTrades, { accountId: 'acc-1' });
    expect(accFiltered).toHaveLength(3); // t1, t2, t4-open

    const assetFiltered = filterTrades(sampleTrades, { asset: 'EUR/USD' });
    expect(assetFiltered).toHaveLength(1);
    expect(assetFiltered[0].id).toBe('t3');

    const strategyFiltered = filterTrades(sampleTrades, { strategy: 'Breakout' });
    expect(strategyFiltered).toHaveLength(2);
  });

  it('protects against division by zero when there are no losses (infinite profit factor)', () => {
    const onlyWins: Trade[] = [
      {
        id: 'w1',
        accountId: 'acc-1',
        asset: 'BTC',
        direction: 'long',
        entryPrice: 50000,
        stopLoss: 49000,
        takeProfit: 52000,
        size: 1,
        openDate: '2026-10-01',
        closeDate: '2026-10-01',
        status: 'closed',
        result: 1000,
        commissions: 0,
        strategy: 'A',
        timeframe: '1d',
        notes: '',
      },
    ];

    const res = calculateExpectancy(onlyWins);
    expect(res.profitFactor).toBe(Infinity);
    expect(res.winLossRatio).toBe(Infinity);
    expect(res.lossRate).toBe(0);
    expect(res.winRate).toBe(100);
  });
});
