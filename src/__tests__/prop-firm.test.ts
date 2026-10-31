// =============================================================================
// TradeRisk Manager — Prop Firm Rules & Drawdown Engine Tests
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  calculateDrawdown,
  calculateDailyLoss,
  calculateProfitTarget,
} from '@/lib/prop-firm';
import type { Account, Trade } from '@/lib/types';

describe('Prop Firm Evaluation Engine Audit', () => {
  const baseAccount: Account = {
    id: 'test-prop-01',
    name: 'Prop 100k Challenge',
    type: 'PropFirm',
    initialCapital: 100000,
    balance: 100000,
    equity: 100000,
    currency: 'USD',
    profitTarget: 10, // 10% = $10,000
    dailyLossLimit: 5, // 5% = $5,000
    maxDrawdown: 10, // 10% = $10,000
    drawdownType: 'static',
    timezone: 'America/New_York',
    dailyResetHour: 17,
    riskPerTrade: 1.0,
    leverage: 10,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };

  describe('Static Drawdown', () => {
    it('computes static floor fixed at initialCapital * (1 - maxDrawdown%)', () => {
      // 100,000 * (1 - 0.10) = 90,000
      const dd = calculateDrawdown(baseAccount);
      expect(dd.drawdownType).toBe('static');
      expect(dd.floor).toBe(90000);
      expect(dd.currentDrawdownAmount).toBe(0);
      expect(dd.remainingDrawdownAmount).toBe(10000);
      expect(dd.isBreached).toBe(false);
    });

    it('detects when static drawdown floor is breached', () => {
      const breachedAcc: Account = {
        ...baseAccount,
        balance: 89500,
        equity: 89500, // below 90,000
      };
      const dd = calculateDrawdown(breachedAcc);
      expect(dd.floor).toBe(90000);
      expect(dd.isBreached).toBe(true);
      expect(dd.currentDrawdownAmount).toBe(10500);
    });
  });

  describe('Trailing Drawdown (High-Water Mark)', () => {
    const trailingAcc: Account = {
      ...baseAccount,
      drawdownType: 'trailing',
      balance: 106000,
      equity: 104000,
    };

    it('trails the floor upward as balance/equity reaches new peak', () => {
      // High-Water Mark reached is 106,000.
      // Floor @ 10% maxDD = 106,000 * 0.90 = 95,400.
      // Current equity is 104,000.
      // Current Drawdown = 106,000 - 104,000 = 2,000.
      // Remaining = 104,000 - 95,400 = 8,600.
      const dd = calculateDrawdown(trailingAcc, 106000);
      expect(dd.drawdownType).toBe('trailing');
      expect(dd.highWaterMark).toBe(106000);
      expect(dd.floor).toBe(95400);
      expect(dd.currentDrawdownAmount).toBe(2000);
      expect(dd.remainingDrawdownAmount).toBe(8600);
      expect(dd.isBreached).toBe(false);
    });

    it('detects trailing drawdown breach if pullback violates the trailing floor', () => {
      // Peak was 106,000 -> Floor is 95,400.
      // Account suffers severe drawdown: equity drops to 95,000.
      const breachedTrailing: Account = {
        ...trailingAcc,
        equity: 95000,
      };
      const dd = calculateDrawdown(breachedTrailing, 106000);
      expect(dd.floor).toBe(95400);
      expect(dd.isBreached).toBe(true);
    });
  });

  describe('Daily Loss Limit Evaluation', () => {
    it('computes daily loss correctly with realized trades', () => {
      // Daily loss limit: 5% of $100k = $5,000
      const todayTrades: Trade[] = [
        {
          id: 't1',
          accountId: baseAccount.id,
          asset: 'BTC/USDT',
          direction: 'long',
          entryPrice: 80000,
          stopLoss: 79000,
          takeProfit: 83000,
          size: 1,
          openDate: '2026-10-31T10:00:00.000Z',
          status: 'closed',
          result: -2000,
          commissions: 50,
          strategy: 'Breakout',
          timeframe: '15m',
          notes: '',
        },
        {
          id: 't2',
          accountId: baseAccount.id,
          asset: 'ETH/USDT',
          direction: 'short',
          entryPrice: 3000,
          stopLoss: 3100,
          takeProfit: 2800,
          size: 10,
          openDate: '2026-10-31T11:00:00.000Z',
          status: 'closed',
          result: -1500,
          commissions: 30,
          strategy: 'Reversal',
          timeframe: '15m',
          notes: '',
        },
      ];

      // Net realized loss = (-2000 - 50) + (-1500 - 30) = -3580
      const dl = calculateDailyLoss(baseAccount, todayTrades, 0);
      expect(dl.dailyLimitAmount).toBe(5000);
      expect(dl.totalLossToday).toBe(3580);
      expect(dl.remainingDailyLossAmount).toBe(1420);
      expect(dl.isBreached).toBe(false);
    });

    it('accounts for open floating losses dragging toward daily limit', () => {
      // Realized loss = -$3,580
      // Open trade has floating loss of -$1,500
      // Total day loss = $3,580 + $1,500 = $5,080 > $5,000 -> BREACH!
      const closedTrades: Trade[] = [
        {
          id: 't1',
          accountId: baseAccount.id,
          asset: 'BTC/USDT',
          direction: 'long',
          entryPrice: 80000,
          stopLoss: 79000,
          takeProfit: 83000,
          size: 1,
          openDate: '2026-10-31T10:00:00.000Z',
          status: 'closed',
          result: -3500,
          commissions: 80,
          strategy: '',
          timeframe: '',
          notes: '',
        },
      ];

      const dl = calculateDailyLoss(baseAccount, closedTrades, -1500);
      expect(dl.totalLossToday).toBe(5080);
      expect(dl.isBreached).toBe(true);
      expect(dl.remainingDailyLossAmount).toBe(0);
    });
  });

  describe('Profit Target Tracking', () => {
    it('computes target progress and completion', () => {
      // Target: 10% of 100k = $10,000
      const midwayAcc: Account = {
        ...baseAccount,
        balance: 106500, // $6,500 made
      };
      const ptMid = calculateProfitTarget(midwayAcc);
      expect(ptMid.targetProfitAmount).toBe(10000);
      expect(ptMid.currentProfitAmount).toBe(6500);
      expect(ptMid.progressPercent).toBe(65);
      expect(ptMid.isTargetReached).toBe(false);

      const completedAcc: Account = {
        ...baseAccount,
        balance: 110500, // $10,500 made
      };
      const ptComplete = calculateProfitTarget(completedAcc);
      expect(ptComplete.progressPercent).toBe(100);
      expect(ptComplete.isTargetReached).toBe(true);
    });
  });
});
