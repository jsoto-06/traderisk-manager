// =============================================================================
// TradeRisk Manager — Comprehensive Statistics Engine Audit Tests
// =============================================================================

import { describe, it, expect } from 'vitest';
import { calculateStatistics } from '@/lib/statistics';
import type { Trade } from '@/lib/types';

describe('Statistics Engine — Functional & Edge-Case Audit', () => {
  it('handles empty trades list gracefully with zero-defaults', () => {
    const stats = calculateStatistics([], 10000);
    expect(stats.totalTrades).toBe(0);
    expect(stats.winningTrades).toBe(0);
    expect(stats.losingTrades).toBe(0);
    expect(stats.winRate).toBe(0);
    expect(stats.profitFactor).toBe(0);
    expect(stats.netProfit).toBe(0);
    expect(stats.averageWin).toBe(0);
    expect(stats.averageLoss).toBe(0);
    expect(stats.bestTrade).toBe(0);
    expect(stats.worstTrade).toBe(0);
    expect(stats.maxWinStreak).toBe(0);
    expect(stats.maxLossStreak).toBe(0);
    expect(stats.currentStreak).toEqual({ type: 'none', count: 0 });
    expect(stats.balanceHistory).toHaveLength(1);
    expect(stats.balanceHistory[0].balance).toBe(10000);
  });

  it('filters out open trades and trades without results', () => {
    const mixedTrades: Trade[] = [
      {
        id: 't-open-1',
        accountId: 'acc1',
        asset: 'BTC/USDT',
        direction: 'long',
        entryPrice: 80000,
        stopLoss: 79000,
        takeProfit: 82000,
        size: 0.05,
        openDate: '2026-10-01T10:00:00Z',
        status: 'open',
        commissions: 0,
        strategy: 'Test',
        timeframe: '1h',
        notes: '',
      },
      {
        id: 't-closed-null',
        accountId: 'acc1',
        asset: 'ETH/USDT',
        direction: 'short',
        entryPrice: 3000,
        stopLoss: 3100,
        takeProfit: 2800,
        size: 1,
        openDate: '2026-10-02T10:00:00Z',
        status: 'closed',
        result: undefined, // no result yet
        commissions: 0,
        strategy: 'Test',
        timeframe: '1h',
        notes: '',
      },
    ];

    const stats = calculateStatistics(mixedTrades, 5000);
    expect(stats.totalTrades).toBe(0);
  });

  it('handles 100% win rate scenario (no losses)', () => {
    const winTrades: Trade[] = [
      {
        id: 'w1',
        accountId: 'acc1',
        asset: 'BTC/USDT',
        direction: 'long',
        entryPrice: 80000,
        stopLoss: 79000,
        takeProfit: 82000,
        size: 0.05,
        openDate: '2026-10-01T10:00:00Z',
        closeDate: '2026-10-01T12:00:00Z',
        status: 'closed',
        result: 100,
        commissions: 1,
        strategy: 'OB',
        timeframe: '15m',
        notes: '',
      },
      {
        id: 'w2',
        accountId: 'acc1',
        asset: 'SOL/USDT',
        direction: 'long',
        entryPrice: 150,
        stopLoss: 145,
        takeProfit: 160,
        size: 2,
        openDate: '2026-10-02T10:00:00Z',
        closeDate: '2026-10-02T12:00:00Z',
        status: 'closed',
        result: 50,
        commissions: 1,
        strategy: 'OB',
        timeframe: '15m',
        notes: '',
      },
    ];

    const stats = calculateStatistics(winTrades, 5000);
    expect(stats.totalTrades).toBe(2);
    expect(stats.winningTrades).toBe(2);
    expect(stats.losingTrades).toBe(0);
    expect(stats.winRate).toBe(100);
    // Net profit = (100 - 1) + (50 - 1) = 99 + 49 = 148
    expect(stats.netProfit).toBe(148);
    expect(stats.averageWin).toBe(74);
    expect(stats.averageLoss).toBe(0);
    expect(stats.maxWinStreak).toBe(2);
    expect(stats.currentStreak).toEqual({ type: 'win', count: 2 });
  });

  it('handles 0% win rate scenario (all losses)', () => {
    const lossTrades: Trade[] = [
      {
        id: 'l1',
        accountId: 'acc1',
        asset: 'BTC/USDT',
        direction: 'long',
        entryPrice: 80000,
        stopLoss: 79000,
        takeProfit: 82000,
        size: 0.05,
        openDate: '2026-10-01T10:00:00Z',
        closeDate: '2026-10-01T12:00:00Z',
        status: 'closed',
        result: -30,
        commissions: 1,
        strategy: '',
        timeframe: '',
        notes: '',
      },
      {
        id: 'l2',
        accountId: 'acc1',
        asset: 'ETH/USDT',
        direction: 'short',
        entryPrice: 3000,
        stopLoss: 3100,
        takeProfit: 2800,
        size: 1,
        openDate: '2026-10-02T10:00:00Z',
        closeDate: '2026-10-02T12:00:00Z',
        status: 'closed',
        result: -70,
        commissions: 1,
        strategy: '',
        timeframe: '',
        notes: '',
      },
    ];

    const stats = calculateStatistics(lossTrades, 5000);
    expect(stats.totalTrades).toBe(2);
    expect(stats.winningTrades).toBe(0);
    expect(stats.losingTrades).toBe(2);
    expect(stats.winRate).toBe(0);
    expect(stats.profitFactor).toBe(0);
    // Net loss = (-30 - 1) + (-70 - 1) = -31 + -71 = -102
    expect(stats.netProfit).toBe(-102);
    expect(stats.averageWin).toBe(0);
    expect(stats.averageLoss).toBe(51); // (31 + 71) / 2 = 51
    expect(stats.maxLossStreak).toBe(2);
    expect(stats.currentStreak).toEqual({ type: 'loss', count: 2 });
  });

  it('properly handles break-even trades (result = 0) and resets streaks', () => {
    const tradesWithBE: Trade[] = [
      {
        id: 't1',
        accountId: 'acc1',
        asset: 'BTC/USDT',
        direction: 'long',
        entryPrice: 80000,
        stopLoss: 79000,
        takeProfit: 82000,
        size: 0.05,
        openDate: '2026-10-01T10:00:00Z',
        closeDate: '2026-10-01T12:00:00Z',
        status: 'closed',
        result: 100, // Win 1
        commissions: 0,
        strategy: '',
        timeframe: '',
        notes: '',
      },
      {
        id: 't2',
        accountId: 'acc1',
        asset: 'ETH/USDT',
        direction: 'short',
        entryPrice: 3000,
        stopLoss: 3100,
        takeProfit: 2800,
        size: 1,
        openDate: '2026-10-02T10:00:00Z',
        closeDate: '2026-10-02T12:00:00Z',
        status: 'closed',
        result: 0, // Breakeven (resets streak)
        commissions: 0,
        strategy: '',
        timeframe: '',
        notes: '',
      },
      {
        id: 't3',
        accountId: 'acc1',
        asset: 'SOL/USDT',
        direction: 'long',
        entryPrice: 150,
        stopLoss: 145,
        takeProfit: 160,
        size: 2,
        openDate: '2026-10-03T10:00:00Z',
        closeDate: '2026-10-03T12:00:00Z',
        status: 'closed',
        result: 50, // Win 1 (new streak)
        commissions: 0,
        strategy: '',
        timeframe: '',
        notes: '',
      },
    ];

    const stats = calculateStatistics(tradesWithBE, 5000);
    expect(stats.totalTrades).toBe(3);
    expect(stats.winningTrades).toBe(2);
    expect(stats.losingTrades).toBe(0);
    expect(stats.winRate).toBeCloseTo(66.67, 1); // 2 out of 3 = 66.67%
    expect(stats.maxWinStreak).toBe(1); // Breakeven prevented streak of 2
    expect(stats.currentStreak).toEqual({ type: 'win', count: 1 });
    expect(stats.bestTrade).toBe(100);
    expect(stats.worstTrade).toBe(0);
  });

  it('calculates chronologically sorted balance progression accurately', () => {
    // Trades in unsorted date order
    const trades: Trade[] = [
      {
        id: 't-day-2',
        accountId: 'acc1',
        asset: 'ETH',
        direction: 'long',
        entryPrice: 3000,
        stopLoss: 2900,
        takeProfit: 3200,
        size: 1,
        openDate: '2026-10-02T10:00:00Z',
        closeDate: '2026-10-02T15:00:00Z',
        status: 'closed',
        result: -50,
        commissions: 0,
        strategy: '',
        timeframe: '',
        notes: '',
      },
      {
        id: 't-day-1',
        accountId: 'acc1',
        asset: 'BTC',
        direction: 'long',
        entryPrice: 80000,
        stopLoss: 79000,
        takeProfit: 82000,
        size: 0.1,
        openDate: '2026-10-01T10:00:00Z',
        closeDate: '2026-10-01T15:00:00Z',
        status: 'closed',
        result: 200,
        commissions: 0,
        strategy: '',
        timeframe: '',
        notes: '',
      },
      {
        id: 't-day-3',
        accountId: 'acc1',
        asset: 'SOL',
        direction: 'long',
        entryPrice: 150,
        stopLoss: 140,
        takeProfit: 170,
        size: 5,
        openDate: '2026-10-03T10:00:00Z',
        closeDate: '2026-10-03T15:00:00Z',
        status: 'closed',
        result: 100,
        commissions: 0,
        strategy: '',
        timeframe: '',
        notes: '',
      },
    ];

    const stats = calculateStatistics(trades, 5000);

    // Initial point: 5000
    // After Day 1 (+200): 5200
    // After Day 2 (-50): 5150
    // After Day 3 (+100): 5250
    expect(stats.balanceHistory).toHaveLength(4);
    expect(stats.balanceHistory[0].balance).toBe(5000);
    expect(stats.balanceHistory[1].balance).toBe(5200);
    expect(stats.balanceHistory[2].balance).toBe(5150);
    expect(stats.balanceHistory[3].balance).toBe(5250);
    expect(stats.netProfit).toBe(250);
  });

  it('correctly accounts for commissions in net PnL, win/loss classification, and balance trajectory', () => {
    const tradesWithCommissions: Trade[] = [
      {
        id: 't-comm-1',
        accountId: 'acc1',
        asset: 'BTC',
        direction: 'long',
        entryPrice: 80000,
        stopLoss: 79000,
        takeProfit: 82000,
        size: 0.1,
        openDate: '2026-10-01T10:00:00Z',
        closeDate: '2026-10-01T15:00:00Z',
        status: 'closed',
        result: 100, // Gross +100
        commissions: 10, // Net +90 (Win)
        strategy: '',
        timeframe: '',
        notes: '',
      },
      {
        id: 't-comm-2',
        accountId: 'acc1',
        asset: 'ETH',
        direction: 'long',
        entryPrice: 3000,
        stopLoss: 2900,
        takeProfit: 3200,
        size: 1,
        openDate: '2026-10-02T10:00:00Z',
        closeDate: '2026-10-02T15:00:00Z',
        status: 'closed',
        result: 5, // Gross +5
        commissions: 15, // Net -10 (Loss due to commissions)
        strategy: '',
        timeframe: '',
        notes: '',
      },
    ];

    const stats = calculateStatistics(tradesWithCommissions, 10000);

    expect(stats.totalTrades).toBe(2);
    expect(stats.winningTrades).toBe(1); // Only trade 1 is net positive
    expect(stats.losingTrades).toBe(1); // Trade 2 is net negative despite gross +5
    expect(stats.winRate).toBe(50);
    expect(stats.netProfit).toBe(80); // 90 - 10 = 80
    expect(stats.bestTrade).toBe(90);
    expect(stats.worstTrade).toBe(-10);

    // Initial 10000 -> Day 1 (10090) -> Day 2 (10080)
    expect(stats.balanceHistory).toHaveLength(3);
    expect(stats.balanceHistory[0].balance).toBe(10000);
    expect(stats.balanceHistory[1].balance).toBe(10090);
    expect(stats.balanceHistory[2].balance).toBe(10080);
  });
});
