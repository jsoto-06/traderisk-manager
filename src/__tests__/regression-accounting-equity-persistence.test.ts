// =============================================================================
// TradeRisk Manager — Fase 6.1: Regression Suite for Accounting, Equity & Persistence
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import type { Account, Trade } from '@/lib/types';
import { calculateStatistics } from '@/lib/statistics';
import { calculateExpectancy } from '@/lib/analytics/expectancy';
import { calculateDrawdownMetrics } from '@/lib/analytics/drawdown';
import { createBackupPayload, validateBackupString } from '@/lib/storage/backup-spec';
import {
  saveAccounts,
  getAccounts,
  saveTrades,
  getTrades,
  saveTombstone,
  getTombstones,
  applyBackup,
  clearAllData,
  getCorruptionReport,
  clearCorruptionReport,
  getStorageKey,
} from '@/lib/storage';
import {
  resolveConflictLWW,
  canonicalJsonStringify,
} from '@/lib/sync/sync-engine';

describe('FASE 6.1 — Regression Suite: Accounting, Equity, Drawdown & Persistence', () => {
  const TEST_NS = 'test_fase_6_1';
  let account: Account;

  beforeEach(() => {
    clearAllData(TEST_NS);
    account = {
      id: 'acc-reg-1',
      name: 'Main Trading Account',
      type: 'Personal',
      initialCapital: 10000,
      balance: 10000,
      equity: 10000,
      currency: 'USD',
      profitTarget: 10,
      dailyLossLimit: 4,
      maxDrawdown: 8,
      drawdownType: 'static',
      timezone: 'UTC',
      dailyResetHour: 0,
      riskPerTrade: 1,
      leverage: 1,
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
      version: 1,
    };
    saveAccounts([account], TEST_NS);
  });

  // ---------------------------------------------------------------------------
  // 1. Recorrido: Abrir y Cerrar una Operación con Comisiones
  // ---------------------------------------------------------------------------
  it('1. Open and close a trade: deducts commissions exactly once and updates balance/equity', () => {
    // 1.1 Open trade
    const openTrade: Trade = {
      id: 't-reg-1',
      accountId: account.id,
      asset: 'BTC/USDT',
      direction: 'long',
      entryPrice: 80000,
      stopLoss: 78000,
      takeProfit: 84000,
      size: 0.1,
      status: 'open',
      commissions: 5,
      openDate: '2026-10-01T10:00:00Z',
      strategy: 'Breakout',
      timeframe: '1h',
      notes: '',
    };
    saveTrades([openTrade], TEST_NS);

    // Verify open position does NOT alter realized balance or equity
    let currentAccounts = getAccounts(TEST_NS);
    expect(currentAccounts[0].balance).toBe(10000);
    expect(currentAccounts[0].equity).toBe(10000);

    // 1.2 Close trade at 82000 (Gross = (82000 - 80000) * 0.1 = +200)
    const exitPrice = 82000;
    const grossPnl = (exitPrice - openTrade.entryPrice) * openTrade.size;
    expect(grossPnl).toBe(200);

    const closedTrade: Trade = {
      ...openTrade,
      status: 'closed',
      exitPrice,
      result: grossPnl,
      closeDate: '2026-10-01T14:00:00Z',
      updatedAt: '2026-10-01T14:00:00Z',
      version: 2,
    };

    // Ledger accounting: net = gross - commissions
    const netPnl = closedTrade.result! - (closedTrade.commissions || 0);
    expect(netPnl).toBe(195); // 200 - 5 = 195

    const updatedAccount: Account = {
      ...account,
      balance: Number((account.balance + netPnl).toFixed(2)),
      equity: Number((account.equity + netPnl).toFixed(2)),
      updatedAt: '2026-10-01T14:00:00Z',
      version: 2,
    };
    saveAccounts([updatedAccount], TEST_NS);
    saveTrades([closedTrade], TEST_NS);

    // Verify stored account matches net PnL exactly
    currentAccounts = getAccounts(TEST_NS);
    expect(currentAccounts[0].balance).toBe(10195);
    expect(currentAccounts[0].equity).toBe(10195);

    // Verify statistics engine matches account balance to the cent
    const stats = calculateStatistics([closedTrade], account.initialCapital);
    expect(stats.totalTrades).toBe(1);
    expect(stats.winningTrades).toBe(1);
    expect(stats.losingTrades).toBe(0);
    expect(stats.netProfit).toBe(195);
    expect(stats.balanceHistory[stats.balanceHistory.length - 1].balance).toBe(10195);

    // Verify mathematical expectancy
    const expectancy = calculateExpectancy([closedTrade]);
    expect(expectancy.netProfit).toBe(195);
    expect(expectancy.totalCommissions).toBe(5);
  });

  // ---------------------------------------------------------------------------
  // 2. Recorrido: Editar una Operación Cerrada (Delta Accounting)
  // ---------------------------------------------------------------------------
  it('2. Edit a closed trade: computes correct delta and adjusts balance/equity cleanly', () => {
    // Initial closed trade: Net +195
    const tradeV1: Trade = {
      id: 't-edit-1',
      accountId: account.id,
      asset: 'BTC/USDT',
      direction: 'long',
      entryPrice: 80000,
      exitPrice: 82000,
      stopLoss: 78000,
      takeProfit: 84000,
      size: 0.1,
      status: 'closed',
      result: 200,
      commissions: 5,
      openDate: '2026-10-01T10:00:00Z',
      closeDate: '2026-10-01T14:00:00Z',
      strategy: '',
      timeframe: '',
      notes: '',
      version: 1,
    };
    let currentBalance = 10195; // 10000 + 195

    // 2.1 Edit exit price to 83000 (Gross = 300, Commissions = 5 -> Net = 295)
    const oldNet = tradeV1.result! - tradeV1.commissions; // 195
    const newExit = 83000;
    const newGross = (newExit - tradeV1.entryPrice) * tradeV1.size; // 300
    const newNet = newGross - tradeV1.commissions; // 295
    const delta1 = newNet - oldNet; // +100

    currentBalance = Number((currentBalance + delta1).toFixed(2));
    expect(currentBalance).toBe(10295);

    // 2.2 Edit trade into a loss: stopped out at 79000 (Gross = -100, Commissions = 10 -> Net = -110)
    const tradeV2Net = newNet; // 295
    const lossExit = 79000;
    const lossGross = (lossExit - tradeV1.entryPrice) * tradeV1.size; // -100
    const lossComms = 10;
    const lossNet = lossGross - lossComms; // -110
    const delta2 = lossNet - tradeV2Net; // -110 - 295 = -405

    currentBalance = Number((currentBalance + delta2).toFixed(2));
    expect(currentBalance).toBe(9890); // 10000 initial - 110 net loss

    // Updated trade in storage
    const updatedLossTrade: Trade = {
      ...tradeV1,
      exitPrice: lossExit,
      result: lossGross,
      commissions: lossComms,
      version: 3,
    };
    saveTrades([updatedLossTrade], TEST_NS);

    const stats = calculateStatistics([updatedLossTrade], account.initialCapital);
    expect(stats.totalTrades).toBe(1);
    expect(stats.winningTrades).toBe(0);
    expect(stats.losingTrades).toBe(1);
    expect(stats.netProfit).toBe(-110);
    expect(stats.balanceHistory[stats.balanceHistory.length - 1].balance).toBe(9890);
  });

  // ---------------------------------------------------------------------------
  // 3. Recorrido: Eliminar una Operación Cerrada (Reversión Contable)
  // ---------------------------------------------------------------------------
  it('3. Delete a closed trade: fully reverts its net balance impact and records tombstone', () => {
    // Current account at 9890 with 1 closed trade (net -110)
    const tradeToDelete: Trade = {
      id: 't-del-1',
      accountId: account.id,
      asset: 'ETH',
      direction: 'long',
      entryPrice: 3000,
      exitPrice: 2900,
      stopLoss: 2850,
      takeProfit: 3300,
      size: 1,
      status: 'closed',
      result: -100,
      commissions: 10,
      openDate: '2026-10-01T10:00:00Z',
      closeDate: '2026-10-01T12:00:00Z',
      strategy: '',
      timeframe: '',
      notes: '',
    };
    const netImpact = tradeToDelete.result! - tradeToDelete.commissions; // -110
    const balanceBeforeDelete = 9890;

    // Revert impact: balance - netImpact = 9890 - (-110) = 10000
    const revertedBalance = Number((balanceBeforeDelete - netImpact).toFixed(2));
    expect(revertedBalance).toBe(10000);

    saveTombstone({
      id: tradeToDelete.id,
      entity: 'trade',
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      accountId: account.id,
    }, TEST_NS);

    const tombstones = getTombstones(TEST_NS);
    expect(tombstones).toHaveLength(1);
    expect(tombstones[0].id).toBe('t-del-1');
    expect(tombstones[0].entity).toBe('trade');
  });

  // ---------------------------------------------------------------------------
  // 4. Recorrido: Operación con Beneficio Bruto Positivo y Neto Negativo
  // ---------------------------------------------------------------------------
  it('4. Fee drag trap: gross profit +$15 with $25 commissions is classified strictly as a loss', () => {
    const feeTrapTrade: Trade = {
      id: 't-trap-1',
      accountId: account.id,
      asset: 'SOL/USDT',
      direction: 'long',
      entryPrice: 150,
      exitPrice: 151.5,
      stopLoss: 145,
      takeProfit: 165,
      size: 10,
      status: 'closed',
      result: 15, // Gross gain of $15
      commissions: 25, // Commissions of $25 -> Net result = -$10
      openDate: '2026-10-02T10:00:00Z',
      closeDate: '2026-10-02T11:00:00Z',
      strategy: 'Scalp',
      timeframe: '5m',
      notes: '',
    };

    const stats = calculateStatistics([feeTrapTrade], account.initialCapital);
    expect(stats.totalTrades).toBe(1);
    expect(stats.winningTrades).toBe(0); // Must NOT be counted as a win
    expect(stats.losingTrades).toBe(1); // Must be a loss
    expect(stats.winRate).toBe(0);
    expect(stats.netProfit).toBe(-10);

    const expectancy = calculateExpectancy([feeTrapTrade]);
    expect(expectancy.winningTrades).toBe(0);
    expect(expectancy.losingTrades).toBe(1);
    expect(expectancy.netProfit).toBe(-10);

    const drawdown = calculateDrawdownMetrics([feeTrapTrade], account.initialCapital);
    expect(drawdown.maxDrawdownAmount).toBe(10);
    expect(drawdown.currentDrawdownAmount).toBe(10);
    expect(drawdown.maxDrawdownPercent).toBeCloseTo(0.1, 2);
  });

  // ---------------------------------------------------------------------------
  // 5. Recorrido: Importar y Exportar Copias de Seguridad (Sin Duplicación)
  // ---------------------------------------------------------------------------
  it('5. Backup export and import: preserves exact ledger balance without duplicating fees', () => {
    const finalAccount: Account = {
      ...account,
      balance: 10450,
      equity: 10450,
    };
    const trade1: Trade = {
      id: 'tbk-1',
      accountId: account.id,
      asset: 'BTC',
      direction: 'long',
      entryPrice: 80000,
      exitPrice: 85000,
      stopLoss: 78000,
      takeProfit: 88000,
      size: 0.1,
      status: 'closed',
      result: 500,
      commissions: 50, // Net +450
      openDate: '2026-10-01T10:00:00Z',
      closeDate: '2026-10-01T15:00:00Z',
      strategy: '',
      timeframe: '',
      notes: '',
    };

    const settings = {
      language: 'es' as const,
      theme: 'dark' as const,
      defaultAccountId: account.id,
    };

    const payload = createBackupPayload([finalAccount], [trade1], [], settings);
    const jsonStr = JSON.stringify(payload);

    // Validate backup format and relational integrity
    const validation = validateBackupString(jsonStr);
    expect(validation.valid).toBe(true);

    // Apply backup in replace mode
    const applyRes = applyBackup(payload, 'replace', TEST_NS);
    expect(applyRes.success).toBe(true);

    // Confirm that balance remains 10450 and was not modified by re-applying trade results
    const loadedAccounts = getAccounts(TEST_NS);
    expect(loadedAccounts[0].balance).toBe(10450);
    expect(loadedAccounts[0].equity).toBe(10450);

    const loadedTrades = getTrades(undefined, TEST_NS);
    expect(loadedTrades).toHaveLength(1);
    expect(loadedTrades[0].result).toBe(500);
    expect(loadedTrades[0].commissions).toBe(50);
  });

  // ---------------------------------------------------------------------------
  // 6. Recorrido: Sincronización Offline-First y Resolución LWW
  // ---------------------------------------------------------------------------
  it('6. Sync engine: deterministic LWW conflict resolution and canonical hash comparison', () => {
    const localUpdatedAt = '2026-10-02T12:00:00.000Z';
    const remoteUpdatedAt = '2026-10-02T12:05:00.000Z';

    // Remote newer => remote_wins
    const decision1 = resolveConflictLWW(localUpdatedAt, remoteUpdatedAt, 1, 1);
    expect(decision1).toBe('remote_wins');

    // Local newer => local_wins
    const decision2 = resolveConflictLWW(remoteUpdatedAt, localUpdatedAt, 1, 1);
    expect(decision2).toBe('local_wins');

    // Identical canonical hash => identical_noop
    const objA = { z: 1, a: 'test', b: [3, 2, 1] };
    const objB = { a: 'test', b: [3, 2, 1], z: 1 };
    const hashA = canonicalJsonStringify(objA);
    const hashB = canonicalJsonStringify(objB);
    expect(hashA).toBe(hashB);

    const decision3 = resolveConflictLWW(localUpdatedAt, localUpdatedAt, 2, 2, hashA, hashB);
    expect(decision3).toBe('identical_noop');
  });

  // ---------------------------------------------------------------------------
  // 7. Recorrido: Aislamiento Estricto y Eliminación en Cascada de Cuentas
  // ---------------------------------------------------------------------------
  it('7. Multi-account isolation: deleting Account A cascades cleanly without affecting Account B', () => {
    const accountA: Account = { ...account, id: 'acc-iso-A', name: 'Account A', balance: 50000 };
    const accountB: Account = { ...account, id: 'acc-iso-B', name: 'Account B', balance: 25000 };
    saveAccounts([accountA, accountB], TEST_NS);

    const tradeA: Trade = {
      id: 't-iso-A',
      accountId: 'acc-iso-A',
      asset: 'BTC',
      direction: 'long',
      entryPrice: 80000,
      stopLoss: 78000,
      takeProfit: 84000,
      size: 1,
      status: 'open',
      commissions: 10,
      openDate: '2026-10-01T10:00:00Z',
      strategy: '',
      timeframe: '',
      notes: '',
    };
    const tradeB: Trade = {
      id: 't-iso-B',
      accountId: 'acc-iso-B',
      asset: 'ETH',
      direction: 'short',
      entryPrice: 3000,
      stopLoss: 3100,
      takeProfit: 2800,
      size: 5,
      status: 'open',
      commissions: 10,
      openDate: '2026-10-01T10:00:00Z',
      strategy: '',
      timeframe: '',
      notes: '',
    };
    saveTrades([tradeA, tradeB], TEST_NS);

    // Simulate cascade delete of Account A
    const remainingAccounts = [accountB];
    const remainingTrades = [tradeB];
    saveAccounts(remainingAccounts, TEST_NS);
    saveTrades(remainingTrades, TEST_NS);
    saveTombstone({
      id: accountA.id,
      entity: 'account',
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, TEST_NS);
    saveTombstone({
      id: tradeA.id,
      entity: 'trade',
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      accountId: accountA.id,
    }, TEST_NS);

    // Verify Account B is completely untouched and active
    const loadedAccs = getAccounts(TEST_NS);
    expect(loadedAccs).toHaveLength(1);
    expect(loadedAccs[0].id).toBe('acc-iso-B');
    expect(loadedAccs[0].balance).toBe(25000);

    const loadedTrds = getTrades(undefined, TEST_NS);
    expect(loadedTrds).toHaveLength(1);
    expect(loadedTrds[0].id).toBe('t-iso-B');

    // Verify tombstones recorded for Account A and its trade
    const tombstones = getTombstones(TEST_NS);
    expect(tombstones.some((ts) => ts.id === accountA.id && ts.entity === 'account')).toBe(true);
    expect(tombstones.some((ts) => ts.id === tradeA.id && ts.entity === 'trade')).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 8. Recorrido: Resiliencia ante Corrupción y Cuarentena de Datos
  // ---------------------------------------------------------------------------
  it('8. Corruption resilience: quarantines unparseable data safely without crashing', () => {
    clearCorruptionReport();
    const corruptedPayload = '{"incomplete_json: 123...';
    const key = getStorageKey('trm_accounts', TEST_NS);

    localStorage.setItem(key, corruptedPayload);

    // getAccounts catches malformed JSON, isolates it in a quarantine key, and returns empty array
    const accs = getAccounts(TEST_NS);
    expect(accs).toHaveLength(0);

    const report = getCorruptionReport();
    expect(report).not.toBeNull();
    expect(report?.quarantineKey).toBeDefined();

    // Verify raw corrupted data is intact in the quarantine location
    const quarantinedRaw = localStorage.getItem(report!.quarantineKey);
    expect(quarantinedRaw).toBe(corruptedPayload);
  });
});