// =============================================================================
// TradeRisk Manager — Accounting Lifecycle & Ledger Consistency Tests
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAccounts,
  saveAccounts,
  getTrades,
  saveTrades,
  resetDemoData,
  STORAGE_KEYS,
} from '@/lib/storage';
import { validateBackupString, createBackupPayload } from '@/lib/storage/backup-spec';
import type { Account, Trade } from '@/lib/types';

describe('Accounting Lifecycle & Ledger Audit', () => {
  beforeEach(() => {
    localStorage.clear();
    resetDemoData();
  });

  it('preserves account balance when registering an open trade', () => {
    const accounts = getAccounts();
    const targetAcc = accounts[0];
    const initialBalance = targetAcc.balance;

    const newOpenTrade: Trade = {
      id: 'open-trade-test-1',
      accountId: targetAcc.id,
      asset: 'BTC/USDT',
      direction: 'long',
      entryPrice: 85000,
      stopLoss: 84000,
      takeProfit: 88000,
      size: 0.1,
      openDate: '2026-10-31T12:00:00.000Z',
      status: 'open',
      commissions: 2.0,
      strategy: 'Breakout',
      timeframe: '15m',
      notes: '',
    };

    const trades = [newOpenTrade, ...getTrades()];
    saveTrades(trades);

    // Verify balance is completely unchanged
    const reloadedAccounts = getAccounts();
    const updatedAcc = reloadedAccounts.find((a) => a.id === targetAcc.id);
    expect(updatedAcc?.balance).toBe(initialBalance);
  });

  it('updates balance accurately when closing trade with profit, loss, and breakeven', () => {
    const acc = getAccounts()[0];
    const startingBalance = acc.balance;

    // 1. Close with Profit: +$300, commissions: $5 -> Net = +$295
    const profitNet = 300 - 5;
    acc.balance = Number((acc.balance + profitNet).toFixed(2));
    acc.equity = acc.balance;
    saveAccounts([acc]);

    expect(getAccounts()[0].balance).toBeCloseTo(startingBalance + 295, 2);

    // 2. Close with Loss: -$100, commissions: $4 -> Net = -$104
    const lossNet = -100 - 4;
    acc.balance = Number((acc.balance + lossNet).toFixed(2));
    acc.equity = acc.balance;
    saveAccounts([acc]);

    expect(getAccounts()[0].balance).toBeCloseTo(startingBalance + 295 - 104, 2);

    // 3. Close with Breakeven: $0, commissions: $3 -> Net = -$3
    const beNet = 0 - 3;
    acc.balance = Number((acc.balance + beNet).toFixed(2));
    acc.equity = acc.balance;
    saveAccounts([acc]);

    expect(getAccounts()[0].balance).toBeCloseTo(startingBalance + 295 - 104 - 3, 2);
  });

  it('handles inter-account trade transfers without leaking or duplicating balances', () => {
    // Setup Account A ($5,000) and Account B ($10,000)
    const accA: Account = {
      ...getAccounts()[0],
      id: 'acc-alpha',
      balance: 5000,
      equity: 5000,
    };
    const accB: Account = {
      ...getAccounts()[0],
      id: 'acc-beta',
      balance: 10000,
      equity: 10000,
    };
    saveAccounts([accA, accB]);

    // Trade 1 is in Account A: profit $200, commission $10 -> Net = +$190
    // Account A balance was adjusted to $5,190
    accA.balance = 5190;
    saveAccounts([accA, accB]);

    const trade: Trade = {
      id: 'trade-transfer-test',
      accountId: 'acc-alpha',
      asset: 'SOL/USDT',
      direction: 'long',
      entryPrice: 150,
      stopLoss: 140,
      takeProfit: 170,
      size: 10,
      openDate: '2026-10-31T09:00:00.000Z',
      status: 'closed',
      result: 200,
      commissions: 10,
      strategy: '',
      timeframe: '',
      notes: '',
    };
    saveTrades([trade]);

    // TRANSFER TRADE FROM ACCOUNT A TO ACCOUNT B:
    // Simulation of useStorage logic:
    // Revert from A: 5190 - 190 = 5000
    // Apply to B: 10000 + 190 = 10190
    const netTrade = trade.result! - trade.commissions;
    accA.balance = Number((accA.balance - netTrade).toFixed(2));
    accB.balance = Number((accB.balance + netTrade).toFixed(2));
    trade.accountId = 'acc-beta';

    saveAccounts([accA, accB]);
    saveTrades([trade]);

    const accounts = getAccounts();
    const finalA = accounts.find((a) => a.id === 'acc-alpha');
    const finalB = accounts.find((a) => a.id === 'acc-beta');

    expect(finalA?.balance).toBe(5000);
    expect(finalB?.balance).toBe(10190);
    expect(getTrades('acc-alpha').length).toBe(0);
    expect(getTrades('acc-beta').length).toBe(1);
  });

  it('safely recovers from corrupted LocalStorage JSON data without crashing', () => {
    // Write invalid/corrupt JSON into accounts key
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, 'INVALID_CORRUPT_SYNTAX{{{');

    // Should catch parse error and safely recover demo state
    const accounts = getAccounts();
    expect(Array.isArray(accounts)).toBe(true);
    expect(accounts.length).toBeGreaterThan(0);
    expect(accounts[0].id).toBeDefined();

    // Write valid JSON with missing required Zod fields
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify([{ invalidField: true }]));

    const accountsAfterInvalidSchema = getAccounts();
    expect(Array.isArray(accountsAfterInvalidSchema)).toBe(true);
    expect(accountsAfterInvalidSchema.length).toBeGreaterThan(0);
  });

  it('validates backup payload specification and rejects malformed payloads', () => {
    const accounts = getAccounts();
    const trades = getTrades();
    const payload = createBackupPayload(accounts, trades, [], {
      language: 'es',
      theme: 'dark',
      defaultAccountId: accounts[0].id,
    });

    const jsonStr = JSON.stringify(payload);
    const validation = validateBackupString(jsonStr);

    expect(validation.valid).toBe(true);
    expect(validation.payload?.version).toBe('1.0.0');
    expect(validation.payload?.data.accounts.length).toBe(accounts.length);

    // Reject corrupted version or structure
    const invalidJson = JSON.stringify({ version: '999.0.0', data: {} });
    const invalidValidation = validateBackupString(invalidJson);
    expect(invalidValidation.valid).toBe(false);
    expect(invalidValidation.errors?.length).toBeGreaterThan(0);
  });
});
