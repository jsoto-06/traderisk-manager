// =============================================================================
// TradeRisk Manager — Test Suite: Fase 4 Cloud Persistence, Auth & Sync Engine
// =============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isSupabaseConfigured,
  getSupabaseBrowserClient,
} from '@/lib/supabase/client';
import {
  performSync,
  getMigrationPreview,
  createPreMigrationBackup,
} from '@/lib/sync/sync-engine';
import {
  getAccounts,
  saveAccounts,
  getTrades,
  saveTrades,
  saveJournal,
  setStorageNamespace,
} from '@/lib/storage';
import { validateBackupString } from '@/lib/storage/backup-spec';
import type { Account, Trade, JournalEntry } from '@/lib/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

type MockDbRecord = { id: string; user_id?: string; [key: string]: unknown };

describe('FASE 4: Persistencia en la Nube, Autenticación y Sincronización', () => {
  const mockUserId = 'usr_test_12345678-1234-1234-1234-123456789abc';

  const sampleAccount: Account = {
    id: 'acc_sync_01',
    name: 'Cuenta Sync Test',
    type: 'Personal',
    initialCapital: 10000,
    balance: 10500,
    equity: 10500,
    currency: 'USD',
    profitTarget: 10,
    dailyLossLimit: 3,
    maxDrawdown: 5,
    drawdownType: 'static',
    timezone: 'UTC',
    dailyResetHour: 0,
    riskPerTrade: 1,
    leverage: 10,
    createdAt: '2026-10-31T10:00:00.000Z',
    updatedAt: '2026-10-31T12:00:00.000Z',
  };

  const sampleTrade: Trade = {
    id: 'trd_sync_01',
    accountId: 'acc_sync_01',
    asset: 'BTC/USDT',
    direction: 'long',
    entryPrice: 65000,
    exitPrice: 67000,
    stopLoss: 64000,
    takeProfit: 67000,
    size: 0.5,
    openDate: '2026-10-31T10:30:00.000Z',
    closeDate: '2026-10-31T11:45:00.000Z',
    status: 'closed',
    result: 1000,
    commissions: 15,
    strategy: 'Breakout',
    timeframe: '15m',
    notes: 'Operación de prueba de sincronización',
  };

  const sampleJournal: JournalEntry = {
    id: 'jrn_sync_01',
    accountId: 'acc_sync_01',
    date: '2026-10-31T12:00:00.000Z',
    emotionalState: 'calm',
    entryReason: 'Ruptura técnica con volumen confirmada',
    planCompliance: true,
    errors: 'Ninguno',
    overtrading: false,
    observations: 'Excelente gestión del riesgo',
    discipline: 5,
  };

  beforeEach(() => {
    // Clear local storage prior to each test
    window.localStorage.clear();
    saveAccounts([sampleAccount]);
    saveTrades([sampleTrade]);
    saveJournal([sampleJournal]);
  });

  // ---------------------------------------------------------------------------
  // 1. Configuración de Entorno & Fallback Seguro
  // ---------------------------------------------------------------------------
  describe('1. Configuración de Entorno y Fallback Offline', () => {
    it('detecta correctamente cuando Supabase no está configurado sin lanzar excepciones', () => {
      // In default test environment, NEXT_PUBLIC_SUPABASE_URL is not set
      const configured = isSupabaseConfigured();
      expect(typeof configured).toBe('boolean');
      
      const client = getSupabaseBrowserClient();
      if (!configured) {
        expect(client).toBeNull();
      }
    });

    it('opera en modo LocalStorage 100% funcional cuando Supabase no está configurado', () => {
      const localAccs = getAccounts();
      expect(localAccs).toHaveLength(1);
      expect(localAccs[0].id).toBe('acc_sync_01');

      const localTrades = getTrades();
      expect(localTrades).toHaveLength(1);
      expect(localTrades[0].id).toBe('trd_sync_01');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Asistente de Migración & Pre-Migration Backup
  // ---------------------------------------------------------------------------
  describe('2. Asistente de Migración y Respaldo Preventivo', () => {
    it('calcula la vista previa de migración (getMigrationPreview) con precisión', () => {
      const preview = getMigrationPreview();

      expect(preview.accountsCount).toBe(1);
      expect(preview.tradesCount).toBe(1);
      expect(preview.journalCount).toBe(1);
      expect(preview.totalBalance).toBe(10500);
      expect(preview.accountNames).toContain('Cuenta Sync Test');
      expect(preview.hasCorruptedRelations).toBe(false);
    });

    it('detecta relaciones huérfanas en la vista previa de migración si una operación referencia una cuenta inexistente', () => {
      const orphanedTrade: Trade = {
        ...sampleTrade,
        id: 'trd_orphan_99',
        accountId: 'non_existent_account_xyz',
      };
      saveTrades([sampleTrade, orphanedTrade]);

      const preview = getMigrationPreview();
      expect(preview.hasCorruptedRelations).toBe(true);
    });

    it('genera una copia de seguridad preventiva válida con createPreMigrationBackup()', () => {
      const backup = createPreMigrationBackup();

      expect(backup.appName).toBe('TradeRisk Manager');
      expect(backup.version).toBe('1.0.0');
      expect(backup.data.accounts).toHaveLength(1);
      expect(backup.data.trades).toHaveLength(1);
      expect(backup.data.journal).toHaveLength(1);

      // Validate stringified backup through spec validator
      const validation = validateBackupString(JSON.stringify(backup));
      expect(validation.valid).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Motor de Sincronización Bidireccional e Idempotencia
  // ---------------------------------------------------------------------------
  describe('3. Motor de Sincronización Bidireccional', () => {
    // Mock remote database store
    let remoteAccountsDb: MockDbRecord[] = [];
    let remoteTradesDb: MockDbRecord[] = [];
    let remoteJournalDb: MockDbRecord[] = [];

    const createMockSupabase = () => {
      return {
        from: (table: string) => ({
          select: () => ({
            eq: () => {
              if (table === 'accounts') return Promise.resolve({ data: remoteAccountsDb, error: null });
              if (table === 'trades') return Promise.resolve({ data: remoteTradesDb, error: null });
              if (table === 'journal_entries') return Promise.resolve({ data: remoteJournalDb, error: null });
              return Promise.resolve({ data: [], error: null });
            },
          }),
          upsert: (payload: MockDbRecord[]) => {
            if (table === 'accounts') {
              for (const item of payload) {
                const idx = remoteAccountsDb.findIndex((x) => x.id === item.id);
                if (idx >= 0) remoteAccountsDb[idx] = item;
                else remoteAccountsDb.push(item);
              }
            } else if (table === 'trades') {
              for (const item of payload) {
                const idx = remoteTradesDb.findIndex((x) => x.id === item.id);
                if (idx >= 0) remoteTradesDb[idx] = item;
                else remoteTradesDb.push(item);
              }
            } else if (table === 'journal_entries') {
              for (const item of payload) {
                const idx = remoteJournalDb.findIndex((x) => x.id === item.id);
                if (idx >= 0) remoteJournalDb[idx] = item;
                else remoteJournalDb.push(item);
              }
            }
            return Promise.resolve({ error: null });
          },
        }),
      } as unknown as SupabaseClient<Database>;
    };

    beforeEach(() => {
      setStorageNamespace(mockUserId);
      saveAccounts([sampleAccount]);
      saveTrades([sampleTrade]);
      saveJournal([sampleJournal]);
      remoteAccountsDb = [];
      remoteTradesDb = [];
      remoteJournalDb = [];
    });

    afterEach(() => {
      setStorageNamespace(null);
    });

    it('sube correctamente los datos locales a la base de datos remota en la primera sincronización', async () => {
      const mockClient = createMockSupabase();
      const res = await performSync(mockClient, mockUserId);

      expect(res.success).toBe(true);
      expect(res.uploadedCount.accounts).toBe(1);
      expect(res.uploadedCount.trades).toBe(1);
      expect(res.uploadedCount.journal).toBe(1);

      expect(remoteAccountsDb).toHaveLength(1);
      expect(remoteAccountsDb[0].name).toBe('Cuenta Sync Test');
      expect(remoteAccountsDb[0].user_id).toBe(mockUserId);

      expect(remoteTradesDb).toHaveLength(1);
      expect(remoteTradesDb[0].asset).toBe('BTC/USDT');

      expect(remoteJournalDb).toHaveLength(1);
      expect(remoteJournalDb[0].emotional_state).toBe('calm');
    });

    it('es idempotente: sincronizar dos veces consecutivas sin cambios no duplica registros', async () => {
      const mockClient = createMockSupabase();

      // First sync
      const res1 = await performSync(mockClient, mockUserId);
      expect(res1.success).toBe(true);
      expect(res1.uploadedCount.accounts).toBe(1);

      // Second sync immediately after
      const res2 = await performSync(mockClient, mockUserId);
      expect(res2.success).toBe(true);
      expect(res2.uploadedCount.accounts).toBe(0);
      expect(res2.downloadedCount.accounts).toBe(0);

      expect(remoteAccountsDb).toHaveLength(1);
      expect(getAccounts()).toHaveLength(1);
    });

    it('descarga registros remotos nuevos a LocalStorage (sincronización descendente)', async () => {
      // Simulate another device creating an account in remote DB
      remoteAccountsDb.push({
        id: 'acc_device_2',
        user_id: mockUserId,
        name: 'Cuenta Laptop 2',
        type: 'PropFirm',
        initial_capital: 50000,
        balance: 52000,
        equity: 52000,
        currency: 'USD',
        profit_target: 8,
        daily_loss_limit: 4,
        max_drawdown: 8,
        drawdown_type: 'trailing',
        timezone: 'UTC',
        daily_reset_hour: 0,
        risk_per_trade: 0.5,
        leverage: 30,
        created_at: '2026-10-31T14:00:00.000Z',
        updated_at: '2026-10-31T14:00:00.000Z',
      });

      const mockClient = createMockSupabase();
      const res = await performSync(mockClient, mockUserId);

      expect(res.success).toBe(true);
      const localAccs = getAccounts();
      expect(localAccs).toHaveLength(2);
      expect(localAccs.some((a) => a.id === 'acc_device_2')).toBe(true);
    });

    it('resuelve conflictos con Last-Write-Wins: la versión con fecha más reciente prevalece', async () => {
      const mockClient = createMockSupabase();

      // 1. Initial sync
      await performSync(mockClient, mockUserId);

      // 2. Simulate local update with newer timestamp
      const localAcc = getAccounts()[0];
      const updatedLocal: Account = {
        ...localAcc,
        balance: 11000,
        updatedAt: '2026-10-31T16:00:00.000Z', // newer
      };
      saveAccounts([updatedLocal]);

      // 3. Simulate remote update with older timestamp
      remoteAccountsDb[0].balance = 10600;
      remoteAccountsDb[0].updated_at = '2026-10-31T15:00:00.000Z'; // older

      const res = await performSync(mockClient, mockUserId);
      expect(res.success).toBe(true);
      expect(res.conflictsResolved).toBe(1);

      // Local wins because 16:00 > 15:00
      expect(remoteAccountsDb[0].balance).toBe(11000);
      expect(getAccounts()[0].balance).toBe(11000);
    });

    it('no sube operaciones huérfanas que no tengan cuenta asociada válida en el conjunto consolidado', async () => {
      const orphanTrade: Trade = {
        ...sampleTrade,
        id: 'trd_orphan_isolated',
        accountId: 'ghost_account_id',
      };
      saveTrades([sampleTrade, orphanTrade]);

      const mockClient = createMockSupabase();
      const res = await performSync(mockClient, mockUserId);

      expect(res.success).toBe(true);
      // Only sampleTrade should be uploaded, ghost account trade rejected
      expect(remoteTradesDb).toHaveLength(1);
      expect(remoteTradesDb[0].id).toBe('trd_sync_01');
    });
  });
});
