// =============================================================================
// TradeRisk Manager — Storage & Account Accounting Audit Tests
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAccounts,
  saveAccounts,
  getTrades,
  getJournal,
  resetDemoData,
  clearAllData,
  DEMO_ACCOUNT_ID,
} from '@/lib/storage';
import type { Account } from '@/lib/types';

describe('Storage & Balance Accounting Audit', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes demo data with correct default parameters', () => {
    resetDemoData();
    const accounts = getAccounts();
    const trades = getTrades();
    const journal = getJournal();

    expect(accounts).toHaveLength(1);
    expect(accounts[0].id).toBe(DEMO_ACCOUNT_ID);
    expect(accounts[0].initialCapital).toBe(5000);
    expect(accounts[0].profitTarget).toBe(10);
    expect(accounts[0].dailyLossLimit).toBe(3);
    expect(accounts[0].maxDrawdown).toBe(6);

    expect(trades.length).toBeGreaterThanOrEqual(5);
    expect(journal.length).toBeGreaterThanOrEqual(2);
  });

  it('persists accounts and maintains independent balances', () => {
    const acc1: Account = {
      id: 'acc-prop-100k',
      name: 'FTMO 100K Challenge',
      type: 'PropFirm',
      initialCapital: 100000,
      balance: 102500,
      equity: 102500,
      currency: 'USD',
      profitTarget: 10,
      dailyLossLimit: 5,
      maxDrawdown: 10,
      drawdownType: 'static',
      timezone: 'America/New_York',
      dailyResetHour: 17,
      riskPerTrade: 0.5,
      leverage: 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const acc2: Account = {
      id: 'acc-spot-5k',
      name: 'Binance Spot',
      type: 'Exchange',
      initialCapital: 5000,
      balance: 4800,
      equity: 4800,
      currency: 'USDT',
      profitTarget: 20,
      dailyLossLimit: 3,
      maxDrawdown: 8,
      drawdownType: 'trailing',
      timezone: 'UTC',
      dailyResetHour: 0,
      riskPerTrade: 1.0,
      leverage: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveAccounts([acc1, acc2]);
    const loaded = getAccounts();

    expect(loaded).toHaveLength(2);
    expect(loaded[0].balance).toBe(102500);
    expect(loaded[1].balance).toBe(4800);
    expect(loaded[0].profitTarget).toBe(10);
    expect(loaded[1].profitTarget).toBe(20);
  });

  it('clears all storage completely on clearAllData()', () => {
    resetDemoData();
    expect(getAccounts().length).toBeGreaterThan(0);

    clearAllData();
    expect(localStorage.getItem('trm_accounts')).toBeNull();
    expect(localStorage.getItem('trm_trades')).toBeNull();
    expect(localStorage.getItem('trm_journal')).toBeNull();
  });
});
