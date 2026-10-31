// =============================================================================
// TradeRisk Manager — Backup & Secure Recovery Tests (Fase 2.3)
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createBackupPayload,
  validateBackupString,
  BACKUP_SCHEMA_VERSION,
} from '@/lib/storage/backup-spec';
import {
  applyBackup,
  getAccounts,
  getTrades,
  getCorruptionReport,
  clearCorruptionReport,
  STORAGE_KEYS,
  resetDemoData,
} from '@/lib/storage';
import type { Account, Trade, JournalEntry, Settings } from '@/lib/types';

describe('Backup & Secure Recovery (Fase 2.3)', () => {
  beforeEach(() => {
    localStorage.clear();
    resetDemoData();
  });

  const sampleAccounts: Account[] = [
    {
      id: 'acc-real-1',
      name: 'Real Apex 50k',
      type: 'PropFirm',
      initialCapital: 50000,
      balance: 51500,
      equity: 51500,
      currency: 'USD',
      profitTarget: 6,
      dailyLossLimit: 4,
      maxDrawdown: 5,
      drawdownType: 'trailing',
      timezone: 'America/New_York',
      dailyResetHour: 17,
      riskPerTrade: 0.5,
      leverage: 1,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-31T00:00:00.000Z',
    },
  ];

  const sampleTrades: Trade[] = [
    {
      id: 'trade-real-1',
      accountId: 'acc-real-1',
      asset: 'BTC/USDT',
      direction: 'long',
      entryPrice: 80000,
      stopLoss: 79000,
      takeProfit: 83000,
      size: 0.25,
      openDate: '2026-10-30T10:00:00.000Z',
      status: 'closed',
      result: 750,
      commissions: 20,
      strategy: 'Breakout',
      timeframe: '15m',
      notes: 'Clean execution',
    },
  ];

  const sampleJournal: JournalEntry[] = [
    {
      id: 'journal-real-1',
      accountId: 'acc-real-1',
      date: '2026-10-30T11:00:00.000Z',
      emotionalState: 'calm',
      entryReason: 'Valid plan confirmation',
      planCompliance: true,
      errors: 'None',
      overtrading: false,
      observations: 'Patience paid off',
      discipline: 5,
    },
  ];

  const sampleSettings: Settings = {
    language: 'es',
    theme: 'dark',
    defaultAccountId: 'acc-real-1',
  };

  // ---------------------------------------------------------------------------
  // 1. Exportación Correcta
  // ---------------------------------------------------------------------------
  describe('Exportación de Copias de Seguridad', () => {
    it('genera un payload de copia completo con metadatos válidos y versión 1.0.0', () => {
      const payload = createBackupPayload(
        sampleAccounts,
        sampleTrades,
        sampleJournal,
        sampleSettings,
      );

      expect(payload.version).toBe(BACKUP_SCHEMA_VERSION);
      expect(payload.appName).toBe('TradeRisk Manager');
      expect(new Date(payload.exportedAt).getTime()).not.toBeNaN();
      expect(payload.data.accounts.length).toBe(1);
      expect(payload.data.trades.length).toBe(1);
      expect(payload.data.journal.length).toBe(1);
      expect(payload.data.settings.defaultAccountId).toBe('acc-real-1');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Validación de Importación
  // ---------------------------------------------------------------------------
  describe('Validación de Archivos de Copia', () => {
    it('valida con éxito un JSON exportado correctamente', () => {
      const payload = createBackupPayload(
        sampleAccounts,
        sampleTrades,
        sampleJournal,
        sampleSettings,
      );
      const jsonStr = JSON.stringify(payload);
      const res = validateBackupString(jsonStr);

      expect(res.valid).toBe(true);
      expect(res.errors).toBeUndefined();
      expect(res.stats?.accountsCount).toBe(1);
      expect(res.stats?.tradesCount).toBe(1);
      expect(res.stats?.journalCount).toBe(1);
      expect(res.stats?.accountNames).toContain('Real Apex 50k');
    });

    it('rechaza JSON corrupto o con sintaxis inválida', () => {
      const res = validateBackupString('{"version": "1.0.0", invalid_syntax}');
      expect(res.valid).toBe(false);
      expect(res.errors?.[0]).toMatch(/sintaxis/i);
    });

    it('rechaza versiones de esquema incompatibles', () => {
      const payload = {
        ...createBackupPayload(sampleAccounts, sampleTrades, sampleJournal, sampleSettings),
        version: '2.5.0', // incompatible
      };
      const res = validateBackupString(JSON.stringify(payload));
      expect(res.valid).toBe(false);
      expect(res.errors?.some((e) => e.includes('version'))).toBe(true);
    });

    it('rechaza identificadores duplicados en cuentas', () => {
      const duplicateAccs = [
        sampleAccounts[0],
        { ...sampleAccounts[0], name: 'Duplicate ID Account' },
      ];
      const payload = createBackupPayload(
        duplicateAccs,
        sampleTrades,
        sampleJournal,
        sampleSettings,
      );
      const res = validateBackupString(JSON.stringify(payload));
      expect(res.valid).toBe(false);
      expect(res.errors?.some((e) => e.includes('cuenta duplicado'))).toBe(true);
    });

    it('rechaza violación de integridad relacional (operaciones huérfanas)', () => {
      const orphanTrade: Trade = {
        ...sampleTrades[0],
        id: 'orphan-trade',
        accountId: 'non-existent-account-id',
      };
      const payload = createBackupPayload(
        sampleAccounts,
        [orphanTrade],
        sampleJournal,
        sampleSettings,
      );
      const res = validateBackupString(JSON.stringify(payload));
      expect(res.valid).toBe(false);
      expect(res.errors?.some((e) => e.includes('integridad relacional'))).toBe(true);
    });

    it('rechaza archivos que excedan el límite de seguridad (10 MB)', () => {
      // Create a dummy large string > 10MB
      const hugeString = 'a'.repeat(10 * 1024 * 1024 + 10);
      const res = validateBackupString(hugeString);
      expect(res.valid).toBe(false);
      expect(res.errors?.[0]).toMatch(/demasiado grande/i);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Aplicación de Copias (Replace vs Merge)
  // ---------------------------------------------------------------------------
  describe('Modos de Importación (Replace vs Merge)', () => {
    it('aplica correctamente en modo REPLACE sobrescribiendo todo el estado', () => {
      // Initial state has demo accounts
      expect(getAccounts().length).toBeGreaterThan(0);

      const payload = createBackupPayload(
        sampleAccounts,
        sampleTrades,
        sampleJournal,
        sampleSettings,
      );

      const result = applyBackup(payload, 'replace');
      expect(result.success).toBe(true);
      expect(result.accountsAdded).toBe(1);
      expect(result.tradesAdded).toBe(1);

      // Verify state was completely replaced
      const newAccounts = getAccounts();
      expect(newAccounts.length).toBe(1);
      expect(newAccounts[0].id).toBe('acc-real-1');
      expect(getTrades().length).toBe(1);
      expect(getTrades()[0].id).toBe('trade-real-1');
    });

    it('aplica correctamente en modo MERGE conservando datos existentes sin duplicar', () => {
      // 1. Setup base state with account A
      const initialAcc = getAccounts()[0]; // Demo account
      const initialTradeCount = getTrades().length;

      // 2. Prepare backup with account B
      const payload = createBackupPayload(
        sampleAccounts,
        sampleTrades,
        sampleJournal,
        sampleSettings,
      );

      // 3. Apply merge
      const result = applyBackup(payload, 'merge');
      expect(result.success).toBe(true);
      expect(result.accountsAdded).toBe(1);

      const mergedAccounts = getAccounts();
      // Should now contain both Demo account and Real account
      expect(mergedAccounts.length).toBe(2);
      expect(mergedAccounts.some((a) => a.id === initialAcc.id)).toBe(true);
      expect(mergedAccounts.some((a) => a.id === 'acc-real-1')).toBe(true);

      // Trades from backup added without removing existing trades
      expect(getTrades().length).toBe(initialTradeCount + 1);

      // 4. Apply merge AGAIN: should detect existing IDs and add 0 duplicates!
      const secondMerge = applyBackup(payload, 'merge');
      expect(secondMerge.accountsAdded).toBe(0);
      expect(secondMerge.tradesAdded).toBe(0);
      expect(getAccounts().length).toBe(2);
    });

    it('conserva los datos anteriores intactos si se cancela la importación o falla la validación', () => {
      const initialAccounts = getAccounts();
      const initialTrades = getTrades();

      // Attempting to validate a corrupt string does not touch storage
      const corruptJson = '{"corrupted": true}';
      const validation = validateBackupString(corruptJson);
      expect(validation.valid).toBe(false);

      // Verify storage was never modified
      expect(getAccounts().length).toBe(initialAccounts.length);
      expect(getTrades().length).toBe(initialTrades.length);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Recuperación No Destructiva de Datos Corruptos
  // ---------------------------------------------------------------------------
  describe('Recuperación No Destructiva ante Corrupción Local', () => {
    it('preserva datos corruptos en cuarentena sin sobrescribir la clave original con datos demo', () => {
      const rawCorruptString = 'CORRUPTED_RAW_BINARY_DATA_{{{';
      localStorage.setItem(STORAGE_KEYS.ACCOUNTS, rawCorruptString);

      // getAccounts should safely detect corruption, quarantine it, and NOT overwrite the key
      const accounts = getAccounts();
      expect(accounts.length).toBeGreaterThan(0);

      // Key in localStorage was NOT wiped/overwritten with demo JSON!
      expect(localStorage.getItem(STORAGE_KEYS.ACCOUNTS)).toBe(rawCorruptString);

      // Corruption report is generated
      const report = getCorruptionReport();
      expect(report).not.toBeNull();
      expect(report?.key).toBe(STORAGE_KEYS.ACCOUNTS);
      expect(report?.quarantineKey).toBeDefined();

      // Corrupted data is preserved in the quarantine key
      const quarantinedData = localStorage.getItem(report!.quarantineKey);
      expect(quarantinedData).toBe(rawCorruptString);

      // Clearing quarantine removes report
      clearCorruptionReport();
      expect(getCorruptionReport()).toBeNull();
    });
  });
});
