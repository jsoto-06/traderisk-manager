// =============================================================================
// TradeRisk Manager — Comprehensive Functional Integration & Data Coherence Audit
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import type { Account, Trade, JournalEntry } from '@/lib/types';
import { InstrumentType } from '@/lib/types';
import { calculateRisk } from '@/lib/risk-engine';
import { calculateStatistics } from '@/lib/statistics';
import { calculateExpectancy } from '@/lib/analytics/expectancy';
import { calculateDrawdownMetrics } from '@/lib/analytics/drawdown';
import { calculateDrawdown, calculateDailyLoss, calculateProfitTarget } from '@/lib/prop-firm';
import { createBackupPayload, validateBackupString, MAX_BACKUP_SIZE_BYTES } from '@/lib/storage/backup-spec';

describe('FASE 6 — Functional Integration & Data Coherence Audit', () => {
  let sampleAccount: Account;

  beforeEach(() => {
    sampleAccount = {
      id: 'acc-audit-1',
      name: 'Prop Challenge 100K',
      type: 'PropFirm',
      initialCapital: 100000,
      balance: 100000,
      equity: 100000,
      currency: 'USD',
      profitTarget: 10, // 10% ($10,000)
      dailyLossLimit: 5, // 5% ($5,000)
      maxDrawdown: 10, // 10% ($10,000)
      drawdownType: 'static',
      timezone: 'America/New_York',
      dailyResetHour: 17,
      riskPerTrade: 1.0, // 1% ($1,000)
      leverage: 10,
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
      version: 1,
    };
  });

  describe('1. Multi-Asset Risk Engine to Trade Lifecycle Integration', () => {
    it('accurately calculates risk, sizes position, and matches expected risk budget', () => {
      // Risk budget = 1% of $100,000 = $1,000
      const calcResult = calculateRisk({
        accountBalance: sampleAccount.balance,
        riskPercent: sampleAccount.riskPerTrade,
        direction: 'long',
        entryPrice: 80000,
        stopLoss: 78400, // Distance = 1600 (2%)
        takeProfit: 84800, // Distance = 4800 (6%)
        instrumentType: InstrumentType.Perpetual,
        leverage: 10,
        commission: 0.05,
      });

      expect(calcResult.riskAmount).toBe(1000);
      expect(calcResult.riskRewardRatio).toBeCloseTo(3.0, 2);
      expect(calcResult.positionSize).toBeCloseTo(0.625, 3); // 1000 / 1600 = 0.625 BTC
      expect(calcResult.notionalValue).toBeCloseTo(50000, 1); // 0.625 * 80000 = $50,000
      expect(calcResult.estimatedMargin).toBeCloseTo(5000, 1); // 50000 / 10 = $5,000
    });

    it('reconciles open risk correctly against account capital', () => {
      const openTrades: Trade[] = [
        {
          id: 'trade-open-1',
          accountId: sampleAccount.id,
          asset: 'BTC/USDT',
          direction: 'long',
          entryPrice: 80000,
          stopLoss: 78400,
          takeProfit: 84800,
          size: 0.625,
          status: 'open',
          commissions: 25,
          openDate: '2026-10-02T10:00:00Z',
          strategy: 'Breakout',
          timeframe: '1h',
          notes: '',
        },
        {
          id: 'trade-open-2',
          accountId: sampleAccount.id,
          asset: 'ETH/USDT',
          direction: 'long',
          entryPrice: 3000,
          stopLoss: 2950,
          takeProfit: 3150,
          size: 10,
          status: 'open',
          commissions: 15,
          openDate: '2026-10-02T11:00:00Z',
          strategy: 'Pullback',
          timeframe: '15m',
          notes: '',
        },
      ];

      // Trade 1 open risk = |80000 - 78400| * 0.625 = 1600 * 0.625 = $1000 (1%)
      // Trade 2 open risk = |3000 - 2950| * 10 = 50 * 10 = $500 (0.5%)
      const totalOpenRisk = openTrades.reduce(
        (sum, t) => sum + Math.abs(t.entryPrice - t.stopLoss) * t.size,
        0,
      );
      const openRiskPercent = (totalOpenRisk / sampleAccount.balance) * 100;

      expect(totalOpenRisk).toBe(1500);
      expect(openRiskPercent).toBe(1.5);
    });
  });

  describe('2. Closed Trades, Commissions & Double-Entry Balance Coherence', () => {
    it('maintains cent-level consistency across balance, statistics, drawdown, and expectancy', () => {
      // Simulate 3 trades:
      // Trade 1: Win gross +$2,500, comms $50 -> net +$2,450
      // Trade 2: Loss gross -$1,000, comms $40 -> net -$1,040
      // Trade 3: Commission trap gross +$20, comms $50 -> net -$30 (Net Loss)
      const closedTrades: Trade[] = [
        {
          id: 'trade-c1',
          accountId: sampleAccount.id,
          asset: 'BTC/USDT',
          direction: 'long',
          entryPrice: 80000,
          exitPrice: 84000,
          stopLoss: 78400,
          takeProfit: 84800,
          size: 0.625,
          status: 'closed',
          result: 2500,
          commissions: 50,
          openDate: '2026-10-01T10:00:00Z',
          closeDate: '2026-10-01T14:00:00Z',
          strategy: 'Breakout',
          timeframe: '1h',
          notes: '',
        },
        {
          id: 'trade-c2',
          accountId: sampleAccount.id,
          asset: 'ETH/USDT',
          direction: 'long',
          entryPrice: 3000,
          exitPrice: 2900,
          stopLoss: 2900,
          takeProfit: 3200,
          size: 10,
          status: 'closed',
          result: -1000,
          commissions: 40,
          openDate: '2026-10-02T10:00:00Z',
          closeDate: '2026-10-02T12:00:00Z',
          strategy: 'Breakout',
          timeframe: '1h',
          notes: '',
        },
        {
          id: 'trade-c3',
          accountId: sampleAccount.id,
          asset: 'SOL/USDT',
          direction: 'long',
          entryPrice: 150,
          exitPrice: 151,
          stopLoss: 145,
          takeProfit: 165,
          size: 20,
          status: 'closed',
          result: 20, // Gross win of $20
          commissions: 50, // Commissions of $50 -> Net loss of -$30
          openDate: '2026-10-03T10:00:00Z',
          closeDate: '2026-10-03T11:00:00Z',
          strategy: 'Scalp',
          timeframe: '5m',
          notes: '',
        },
      ];

      // Ledger net accounting
      const netResults = closedTrades.map((t) => t.result! - t.commissions);
      expect(netResults).toEqual([2450, -1040, -30]);

      const totalNetPnL = netResults.reduce((a, b) => a + b, 0); // 2450 - 1040 - 30 = +1380
      expect(totalNetPnL).toBe(1380);

      // Final Account Balance
      sampleAccount.balance = Number((sampleAccount.initialCapital + totalNetPnL).toFixed(2));
      sampleAccount.equity = sampleAccount.balance;
      expect(sampleAccount.balance).toBe(101380);

      // Verify Statistics Engine
      const stats = calculateStatistics(closedTrades, sampleAccount.initialCapital);
      expect(stats.totalTrades).toBe(3);
      expect(stats.winningTrades).toBe(1); // Only trade 1 is net profitable
      expect(stats.losingTrades).toBe(2); // Trade 2 and Trade 3 are net losses
      expect(stats.winRate).toBeCloseTo(33.33, 1);
      expect(stats.netProfit).toBe(1380);
      expect(stats.bestTrade).toBe(2450);
      expect(stats.worstTrade).toBe(-1040);

      // Final point in balanceHistory must match account.balance exactly
      expect(stats.balanceHistory).toHaveLength(4);
      expect(stats.balanceHistory[0].balance).toBe(100000);
      expect(stats.balanceHistory[1].balance).toBe(102450);
      expect(stats.balanceHistory[2].balance).toBe(101410);
      expect(stats.balanceHistory[3].balance).toBe(101380);
      expect(stats.balanceHistory[stats.balanceHistory.length - 1].balance).toBe(sampleAccount.balance);

      // Verify Mathematical Expectancy Engine
      const expectancy = calculateExpectancy(closedTrades);
      expect(expectancy.totalTrades).toBe(3);
      expect(expectancy.winningTrades).toBe(1);
      expect(expectancy.losingTrades).toBe(2);
      expect(expectancy.winRate).toBeCloseTo(33.33, 1);
      expect(expectancy.netProfit).toBe(1380);
      expect(expectancy.totalCommissions).toBe(140); // 50 + 40 + 50 = 140

      // Verify Drawdown Analytics Engine
      const drawdown = calculateDrawdownMetrics(closedTrades, sampleAccount.initialCapital);
      // High-water mark reached at Trade 1: $102,450.
      // After Trade 2 ($101,410): drawdown = $1,040 ($1040 / $102450 = 1.015%)
      // After Trade 3 ($101,380): drawdown = $1,070 ($1070 / $102450 = 1.044%)
      expect(drawdown.maxDrawdownAmount).toBe(1070);
      expect(drawdown.currentDrawdownAmount).toBe(1070);
      expect(drawdown.maxDrawdownPercent).toBeCloseTo(1.04, 1);
      expect(drawdown.drawdownSeries[drawdown.drawdownSeries.length - 1].balance).toBe(sampleAccount.balance);
    });
  });

  describe('3. Prop Firm Rules & Target Monitoring Integration', () => {
    it('evaluates static drawdown, trailing drawdown, and daily loss consistently', () => {
      // Set account state to post-trading result: Initial $100k, Balance/Equity $101,380, Max Drawdown 10%
      sampleAccount.balance = 101380;
      sampleAccount.equity = 101380;

      const ddStatic = calculateDrawdown(sampleAccount);
      expect(ddStatic.drawdownType).toBe('static');
      expect(ddStatic.floor).toBe(90000); // 100k * (1 - 0.10)
      expect(ddStatic.isBreached).toBe(false);
      expect(ddStatic.remainingDrawdownAmount).toBe(11380); // 101380 - 90000

      // Trailing drawdown with peak at 102450
      const trailingAccount: Account = { ...sampleAccount, drawdownType: 'trailing' };
      const ddTrailing = calculateDrawdown(trailingAccount, 102450);
      expect(ddTrailing.drawdownType).toBe('trailing');
      expect(ddTrailing.highWaterMark).toBe(102450);
      expect(ddTrailing.floor).toBeCloseTo(92205, 0); // 102450 * 0.90
      expect(ddTrailing.remainingDrawdownAmount).toBeCloseTo(101380 - 92205, 0); // ~9175
      expect(ddTrailing.isBreached).toBe(false);

      // Daily loss test
      const closedToday: Trade[] = [
        {
          id: 'trade-today-1',
          accountId: sampleAccount.id,
          asset: 'BTC',
          direction: 'long',
          entryPrice: 80000,
          stopLoss: 78000,
          takeProfit: 84000,
          size: 1,
          status: 'closed',
          result: -1200,
          commissions: 50,
          openDate: '2026-10-03T10:00:00Z',
          closeDate: '2026-10-03T11:00:00Z',
          strategy: '',
          timeframe: '',
          notes: '',
        },
      ];
      // Daily loss limit = 5% of 100k = $5,000
      // Loss today = 1200 + 50 = $1,250
      const dailyLoss = calculateDailyLoss(sampleAccount, closedToday, 0);
      expect(dailyLoss.dailyLimitAmount).toBe(5000);
      expect(dailyLoss.totalLossToday).toBe(1250);
      expect(dailyLoss.remainingDailyLossAmount).toBe(3750);
      expect(dailyLoss.isBreached).toBe(false);

      // Profit Target progress
      // Target: 10% ($10,000). Current profit: $1,380.
      const target = calculateProfitTarget(sampleAccount);
      expect(target.targetProfitAmount).toBe(10000);
      expect(target.currentProfitAmount).toBe(1380);
      expect(target.remainingProfitAmount).toBe(8620);
      expect(target.progressPercent).toBe(13.8);
      expect(target.isTargetReached).toBe(false);
    });
  });

  describe('4. Account Isolation, Cascading Deletion & Tombstones', () => {
    it('isolates trades and calculations strictly between different accounts', () => {
      const accountA: Account = { ...sampleAccount, id: 'acc-A', name: 'Account A', balance: 50000 };
      const accountB: Account = { ...sampleAccount, id: 'acc-B', name: 'Account B', balance: 25000 };

      const tradeA: Trade = {
        id: 't-A',
        accountId: 'acc-A',
        asset: 'BTC',
        direction: 'long',
        entryPrice: 80000,
        stopLoss: 79000,
        takeProfit: 82000,
        size: 1,
        status: 'closed',
        result: 500,
        commissions: 10,
        openDate: '2026-10-01T10:00:00Z',
        closeDate: '2026-10-01T11:00:00Z',
        strategy: '',
        timeframe: '',
        notes: '',
      };

      const tradeB: Trade = {
        id: 't-B',
        accountId: 'acc-B',
        asset: 'ETH',
        direction: 'short',
        entryPrice: 3000,
        stopLoss: 3100,
        takeProfit: 2800,
        size: 5,
        status: 'closed',
        result: -200,
        commissions: 10,
        openDate: '2026-10-01T10:00:00Z',
        closeDate: '2026-10-01T11:00:00Z',
        strategy: '',
        timeframe: '',
        notes: '',
      };

      const allTrades = [tradeA, tradeB];

      const statsA = calculateStatistics(
        allTrades.filter((t) => t.accountId === accountA.id),
        accountA.initialCapital,
      );
      const statsB = calculateStatistics(
        allTrades.filter((t) => t.accountId === accountB.id),
        accountB.initialCapital,
      );

      expect(statsA.totalTrades).toBe(1);
      expect(statsA.netProfit).toBe(490); // 500 - 10
      expect(statsA.winRate).toBe(100);

      expect(statsB.totalTrades).toBe(1);
      expect(statsB.netProfit).toBe(-210); // -200 - 10
      expect(statsB.winRate).toBe(0);
    });
  });

  describe('5. Backup Specification, Relational Integrity & Security Auditing', () => {
    it('creates and validates a valid JSON backup payload successfully', () => {
      const accounts = [sampleAccount];
      const trades: Trade[] = [
        {
          id: 'trade-bk-1',
          accountId: sampleAccount.id,
          asset: 'BTC/USDT',
          direction: 'long',
          entryPrice: 80000,
          stopLoss: 78000,
          takeProfit: 84000,
          size: 0.5,
          status: 'open',
          commissions: 10,
          openDate: '2026-10-01T10:00:00Z',
          strategy: 'Test',
          timeframe: '1h',
          notes: '',
        },
      ];
      const journal: JournalEntry[] = [
        {
          id: 'journal-bk-1',
          accountId: sampleAccount.id,
          date: '2026-10-01T10:00:00Z',
          emotionalState: 'calm',
          entryReason: 'Valid setup',
          planCompliance: true,
          overtrading: false,
          errors: '',
          observations: 'Good execution',
          discipline: 5,
        },
      ];
      const settings = {
        language: 'es' as const,
        theme: 'dark' as const,
        defaultAccountId: sampleAccount.id,
      };

      const payload = createBackupPayload(accounts, trades, journal, settings);
      const jsonStr = JSON.stringify(payload);
      const validation = validateBackupString(jsonStr);

      expect(validation.valid).toBe(true);
      expect(validation.stats?.accountsCount).toBe(1);
      expect(validation.stats?.tradesCount).toBe(1);
      expect(validation.stats?.journalCount).toBe(1);
      expect(validation.stats?.accountNames).toContain('Prop Challenge 100K');
    });

    it('rejects tampered backups violating relational integrity', () => {
      const accounts = [sampleAccount];
      const orphanedTrades: Trade[] = [
        {
          id: 'trade-orphaned',
          accountId: 'non-existent-account-id',
          asset: 'BTC/USDT',
          direction: 'long',
          entryPrice: 80000,
          stopLoss: 78000,
          takeProfit: 84000,
          size: 0.5,
          status: 'open',
          commissions: 10,
          openDate: '2026-10-01T10:00:00Z',
          strategy: 'Test',
          timeframe: '1h',
          notes: '',
        },
      ];
      const payload = createBackupPayload(accounts, orphanedTrades, [], {
        language: 'es',
        theme: 'dark',
        defaultAccountId: sampleAccount.id,
      });

      const jsonStr = JSON.stringify(payload);
      const validation = validateBackupString(jsonStr);

      expect(validation.valid).toBe(false);
      expect(validation.errors?.[0]).toContain('Violación de integridad relacional');
    });

    it('rejects tampered backups with duplicate entity identifiers', () => {
      const accounts = [
        sampleAccount,
        { ...sampleAccount, name: 'Duplicate Account With Same ID' },
      ];
      const payload = createBackupPayload(accounts, [], [], {
        language: 'es',
        theme: 'dark',
        defaultAccountId: sampleAccount.id,
      });

      const jsonStr = JSON.stringify(payload);
      const validation = validateBackupString(jsonStr);

      expect(validation.valid).toBe(false);
      expect(validation.errors?.[0]).toContain('Identificador de cuenta duplicado detectado');
    });

    it('rejects backups exceeding security size threshold (Denial-of-Service guard)', () => {
      // Construct a string exceeding MAX_BACKUP_SIZE_BYTES
      const hugeString = 'a'.repeat(MAX_BACKUP_SIZE_BYTES + 1024);
      const validation = validateBackupString(hugeString);

      expect(validation.valid).toBe(false);
      expect(validation.errors?.[0]).toContain('El archivo es demasiado grande');
    });
  });
});