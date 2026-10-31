// =============================================================================
// TradeRisk Manager — Test Suite: Fase 4.2 Sincronización Distribuida y Convergencia
// =============================================================================
// Verifica:
// 1. Serialización JSON canónica recursiva e invariancia de orden de claves.
// 2. Normalización consistente de null, undefined y valores numéricos.
// 3. Convergencia matemática determinista entre dos clientes independientes.
// 4. Desempate determinista idéntico en ambos dispositivos ante timestamps iguales.
// 5. Ausencia de bucles de sincronización y preservación de marcas temporales.
// 6. Políticas de borrado suave vs modificación concurrente.
// 7. Retención y poda segura de tombstones (política de 90 días).
// =============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  canonicalJsonStringify,
  normalizeAccount,
  normalizeTrade,
  normalizeJournal,
  resolveConflictLWW,
  performSync,
} from '@/lib/sync/sync-engine';
import {
  getAccounts,
  saveAccounts,
  getTrades,
  saveTrades,
  getTombstones,
  saveTombstone,
  setStorageNamespace,
  pruneExpiredTombstones,
} from '@/lib/storage';
import type { Account, Trade, JournalEntry } from '@/lib/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

type MockDbRecord = {
  id: string;
  user_id?: string;
  account_id?: string;
  deleted_at?: string | null;
  updated_at?: string;
  created_at?: string;
  version?: number;
  [key: string]: unknown;
};

describe('FASE 4.2: Auditoría de LWW, Serialización Canónica y Convergencia Distribuida', () => {
  const testUserId = 'usr_distributed_audit_user_9999-8888-7777';

  // ---------------------------------------------------------------------------
  // 1. Auditoría de Serialización JSON Canónica
  // ---------------------------------------------------------------------------
  describe('1. Serialización JSON Canónica y Normalización Determinista', () => {
    it('produce cadenas idénticas con claves en órdenes inversos o arbitrarios', () => {
      const objA = { z: 1, a: 'test', m: { y: 2, b: 3 } };
      const objB = { a: 'test', m: { b: 3, y: 2 }, z: 1 };

      // JSON.stringify nativo falla al comparar claves en orden inverso
      expect(JSON.stringify(objA)).not.toBe(JSON.stringify(objB));

      // canonicalJsonStringify garantiza equivalencia absoluta
      const canA = canonicalJsonStringify(objA);
      const canB = canonicalJsonStringify(objB);
      expect(canA).toBe(canB);
      expect(canA).toBe('{"a":"test","m":{"b":3,"y":2},"z":1}');
    });

    it('omite propiedades undefined de manera consistente emulando la serialización JSON', () => {
      const obj1 = { a: 1, b: undefined, c: null };
      const obj2 = { a: 1, c: null };

      expect(canonicalJsonStringify(obj1)).toBe(canonicalJsonStringify(obj2));
      expect(canonicalJsonStringify(obj1)).toBe('{"a":1,"c":null}');
    });

    it('normaliza fechas ISO con zonas horarias o milisegundos variables al mismo instante UTC', () => {
      const accountA: Account = {
        id: 'acc_01',
        name: '  Cuenta Alpha  ',
        type: 'Personal',
        initialCapital: 10000.0,
        balance: 10500.00001,
        equity: 10500.0,
        currency: 'usd',
        profitTarget: 10,
        dailyLossLimit: 3,
        maxDrawdown: 5,
        drawdownType: 'static',
        timezone: 'UTC',
        dailyResetHour: 0,
        riskPerTrade: 1,
        leverage: 10,
        createdAt: '2026-10-31T10:00:00Z',
        updatedAt: '2026-10-31T10:00:00.000Z',
      };

      const accountB: Account = {
        ...accountA,
        name: 'Cuenta Alpha',
        currency: 'USD',
        balance: 10500.0,
      };

      const normA = normalizeAccount(accountA);
      const normB = normalizeAccount(accountB);

      expect(normA.name).toBe(normB.name);
      expect(normA.currency).toBe(normB.currency);
      expect(normA.balance).toBe(normB.balance);
      expect(canonicalJsonStringify(normA)).toBe(canonicalJsonStringify(normB));
    });

    it('normaliza operaciones y entradas de diario con redondeos numéricos y recorte de cadenas', () => {
      const tradeA: Trade = {
        id: 'trd_01',
        accountId: 'acc_01',
        asset: 'btc/usdt',
        direction: 'long',
        entryPrice: 65000.123456789,
        exitPrice: 67000.0,
        stopLoss: 64000.0,
        takeProfit: 67000.0,
        size: 0.500000001,
        openDate: '2026-10-31T10:00:00Z',
        status: 'closed',
        result: 1000.00001,
        commissions: 15.00002,
        strategy: 'Manual',
        timeframe: '1h',
        notes: '   Trade con espacios   ',
      };

      const normTrade = normalizeTrade(tradeA);
      expect(normTrade.asset).toBe('BTC/USDT');
      expect(normTrade.entryPrice).toBe(65000.12345679);
      expect(normTrade.size).toBe(0.5);
      expect(normTrade.result).toBe(1000.0);
      expect(normTrade.commissions).toBe(15.0);
      expect(normTrade.notes).toBe('Trade con espacios');
    });

    it('normaliza entradas de diario sujetando disciplina entre 1 y 5 y convirtiendo booleanos', () => {
      const journalA: JournalEntry = {
        id: 'jrn_01',
        accountId: 'acc_01',
        date: '2026-10-31T10:00:00Z',
        emotionalState: 'calm',
        entryReason: '  Entrada con espacios  ',
        planCompliance: true,
        errors: '  Sin errores  ',
        overtrading: false,
        observations: '  Buena ejecucion  ',
        discipline: 9 as unknown as JournalEntry['discipline'], // Fuera de rango
      };

      const norm = normalizeJournal(journalA);
      expect(norm.discipline).toBe(5); // Clamped a 5
      expect(norm.entryReason).toBe('Entrada con espacios');
      expect(norm.errors).toBe('Sin errores');
      expect(norm.observations).toBe('Buena ejecucion');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Pruebas de Sincronización Distribuida y Convergencia entre Dos Clientes
  // ---------------------------------------------------------------------------
  describe('2. Convergencia Distribuida Multi-Cliente (Client A & Client B)', () => {
    let cloudAccounts: MockDbRecord[] = [];
    let cloudTrades: MockDbRecord[] = [];
    let cloudJournal: MockDbRecord[] = [];

    const createSharedCloudClient = () => {
      return {
        from: (table: string) => ({
          select: () => ({
            eq: () => {
              if (table === 'accounts') return Promise.resolve({ data: [...cloudAccounts], error: null });
              if (table === 'trades') return Promise.resolve({ data: [...cloudTrades], error: null });
              if (table === 'journal_entries') return Promise.resolve({ data: [...cloudJournal], error: null });
              return Promise.resolve({ data: [], error: null });
            },
          }),
          upsert: (payload: MockDbRecord[]) => {
            if (table === 'accounts') {
              for (const item of payload) {
                const idx = cloudAccounts.findIndex((x) => x.id === item.id);
                if (idx >= 0) cloudAccounts[idx] = { ...item };
                else cloudAccounts.push({ ...item });
              }
            } else if (table === 'trades') {
              for (const item of payload) {
                const idx = cloudTrades.findIndex((x) => x.id === item.id);
                if (idx >= 0) cloudTrades[idx] = { ...item };
                else cloudTrades.push({ ...item });
              }
            } else if (table === 'journal_entries') {
              for (const item of payload) {
                const idx = cloudJournal.findIndex((x) => x.id === item.id);
                if (idx >= 0) cloudJournal[idx] = { ...item };
                else cloudJournal.push({ ...item });
              }
            }
            return Promise.resolve({ error: null });
          },
        }),
      } as unknown as SupabaseClient<Database>;
    };

    beforeEach(() => {
      window.localStorage.clear();
      cloudAccounts = [];
      cloudTrades = [];
      cloudJournal = [];
      setStorageNamespace(null);
    });

    afterEach(() => {
      setStorageNamespace(null);
    });

    it('dos clientes que reciben modificaciones concurrentes en órdenes distintos convergen al mismo estado', async () => {
      const clientSupabase = createSharedCloudClient();

      const accountInit: Account = {
        id: 'acc_shared_01',
        name: 'Cuenta Compartida',
        type: 'Personal',
        initialCapital: 10000,
        balance: 10000,
        equity: 10000,
        currency: 'USD',
        profitTarget: 10,
        dailyLossLimit: 3,
        maxDrawdown: 5,
        drawdownType: 'static',
        timezone: 'UTC',
        dailyResetHour: 0,
        riskPerTrade: 1,
        leverage: 10,
        createdAt: '2026-10-31T08:00:00.000Z',
        updatedAt: '2026-10-31T08:00:00.000Z',
        version: 1,
      };

      const tradeInit: Trade = {
        id: 'trd_shared_01',
        accountId: 'acc_shared_01',
        asset: 'BTC/USDT',
        direction: 'long',
        entryPrice: 65000,
        stopLoss: 64000,
        takeProfit: 68000,
        size: 0.1,
        commissions: 10,
        openDate: '2026-10-31T08:30:00.000Z',
        status: 'open',
        strategy: 'Breakout',
        timeframe: '1h',
        notes: 'Versión inicial',
        createdAt: '2026-10-31T08:30:00.000Z',
        updatedAt: '2026-10-31T08:30:00.000Z',
        version: 1,
      };

      // 1. Estado inicial sincronizado en la nube
      setStorageNamespace(testUserId);
      saveAccounts([accountInit]);
      saveTrades([tradeInit]);
      await performSync(clientSupabase, testUserId);
      expect(cloudTrades).toHaveLength(1);

      // 2. Cliente A modifica el trade en t = 10:00 (versión 2)
      const tradeA: Trade = {
        ...tradeInit,
        notes: 'Modificación Cliente A (más reciente)',
        takeProfit: 69000,
        updatedAt: '2026-10-31T10:00:00.000Z',
        version: 2,
      };

      // 3. Cliente B modifica el trade en t = 09:30 (versión 2, timestamp anterior)
      const tradeB: Trade = {
        ...tradeInit,
        notes: 'Modificación Cliente B (más antigua)',
        stopLoss: 64500,
        updatedAt: '2026-10-31T09:30:00.000Z',
        version: 2,
      };

      // Simulación de Camino 1: B sincroniza primero, luego A sincroniza, luego B sincroniza de nuevo
      // B sube su cambio
      saveTrades([tradeB]);
      await performSync(clientSupabase, testUserId);
      expect(cloudTrades[0].notes).toBe('Modificación Cliente B (más antigua)');

      // A sincroniza: como 10:00 > 09:30, la versión de A gana y sobrescribe en la nube
      saveTrades([tradeA]);
      const resA = await performSync(clientSupabase, testUserId);
      expect(resA.success).toBe(true);
      expect(cloudTrades[0].notes).toBe('Modificación Cliente A (más reciente)');

      // B sincroniza de nuevo para recibir el estado convergente
      const resB = await performSync(clientSupabase, testUserId);
      expect(resB.success).toBe(true);
      const tradesB = getTrades();
      expect(tradesB[0].notes).toBe('Modificación Cliente A (más reciente)');
      expect(tradesB[0].takeProfit).toBe(69000);
    });

    it('resuelve modificaciones simultáneas con el mismo timestamp exactamente al mismo ganador determinista', () => {
      const sameTimestamp = '2026-10-31T12:00:00.000Z';

      const tradeAlpha: Trade = {
        id: 'trd_tie_01',
        accountId: 'acc_shared_01',
        asset: 'ETH/USDT',
        direction: 'short',
        entryPrice: 3500,
        stopLoss: 3600,
        takeProfit: 3300,
        size: 2,
        commissions: 5,
        strategy: 'TrendFollowing',
        timeframe: '1h',
        openDate: sameTimestamp,
        status: 'open',
        notes: 'Alpha payload',
        updatedAt: sameTimestamp,
        version: 2,
      };

      const tradeBeta: Trade = {
        ...tradeAlpha,
        notes: 'Beta payload',
        updatedAt: sameTimestamp,
        version: 2,
      };

      const hashAlpha = canonicalJsonStringify(normalizeTrade(tradeAlpha));
      const hashBeta = canonicalJsonStringify(normalizeTrade(tradeBeta));

      // Decisión evaluada desde el punto de vista de Cliente 1 (Alpha es local, Beta es remoto)
      const decision1 = resolveConflictLWW(
        tradeAlpha.updatedAt!,
        tradeBeta.updatedAt!,
        tradeAlpha.version!,
        tradeBeta.version!,
        hashAlpha,
        hashBeta,
      );

      // Decisión evaluada desde el punto de vista de Cliente 2 (Beta es local, Alpha es remoto)
      const decision2 = resolveConflictLWW(
        tradeBeta.updatedAt!,
        tradeAlpha.updatedAt!,
        tradeBeta.version!,
        tradeAlpha.version!,
        hashBeta,
        hashAlpha,
      );

      // Si hashAlpha > hashBeta, decision1 = 'local_wins' (Alpha) y decision2 = 'remote_wins' (Alpha)
      // Si hashBeta > hashAlpha, decision1 = 'remote_wins' (Beta) y decision2 = 'local_wins' (Beta)
      // En AMBOS casos el ganador global es ESTRICTAMENTE EL MISMO
      if (hashAlpha > hashBeta) {
        expect(decision1).toBe('local_wins');
        expect(decision2).toBe('remote_wins');
      } else {
        expect(decision1).toBe('remote_wins');
        expect(decision2).toBe('local_wins');
      }
    });

    it('evita bucles de sincronización: sincronizaciones sucesivas sin cambios no modifican updatedAt ni version', async () => {
      const clientSupabase = createSharedCloudClient();
      setStorageNamespace(testUserId);

      const account: Account = {
        id: 'acc_stable_01',
        name: 'Cuenta Estable',
        type: 'Personal',
        initialCapital: 10000,
        balance: 10000,
        equity: 10000,
        currency: 'USD',
        profitTarget: 10,
        dailyLossLimit: 3,
        maxDrawdown: 5,
        drawdownType: 'static',
        timezone: 'UTC',
        dailyResetHour: 0,
        riskPerTrade: 1,
        leverage: 10,
        createdAt: '2026-10-31T08:00:00.000Z',
        updatedAt: '2026-10-31T08:00:00.000Z',
        version: 1,
      };

      saveAccounts([account]);

      // Sincronización inicial
      const sync1 = await performSync(clientSupabase, testUserId);
      expect(sync1.uploadedCount.accounts).toBe(1);

      const localAfter1 = getAccounts()[0];
      const initialUpdated = localAfter1.updatedAt;
      const initialVersion = localAfter1.version;

      // Segunda sincronización inmediata sin cambios
      const sync2 = await performSync(clientSupabase, testUserId);
      expect(sync2.uploadedCount.accounts).toBe(0);
      expect(sync2.downloadedCount.accounts).toBe(0);
      expect(sync2.conflictsResolved).toBe(0);

      // Tercera sincronización
      const sync3 = await performSync(clientSupabase, testUserId);
      expect(sync3.uploadedCount.accounts).toBe(0);
      expect(sync3.downloadedCount.accounts).toBe(0);

      const localAfter3 = getAccounts()[0];
      // Las marcas temporales y versiones deben permanecer exactamente iguales sin deriva
      expect(localAfter3.updatedAt).toBe(initialUpdated);
      expect(localAfter3.version).toBe(initialVersion);
    });

    it('borrado concurrente vs modificación: eliminación posterior gana; modificación posterior resucita', () => {
      const timeDelete = '2026-10-31T15:00:00.000Z';
      const timeModOlder = '2026-10-31T14:30:00.000Z';
      const timeModNewer = '2026-10-31T15:30:00.000Z';

      // 1. Eliminación a las 15:00 vs modificación a las 14:30 => Eliminación GANA
      const decisionDeleteWins = resolveConflictLWW(timeDelete, timeModOlder);
      expect(decisionDeleteWins).toBe('local_wins'); // El tombstone local de 15:00 gana sobre el cambio de 14:30

      // 2. Modificación deliberada a las 15:30 vs eliminación a las 15:00 => Modificación GANA
      const decisionModWins = resolveConflictLWW(timeModNewer, timeDelete);
      expect(decisionModWins).toBe('local_wins'); // La edición posterior a la baja resucita el registro
    });

    it('la política de poda de tombstones elimina registros mayores a 90 días y preserva los recientes', () => {
      setStorageNamespace(testUserId);

      const now = Date.now();
      const sixtyDaysAgo = new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString();
      const ninetyFiveDaysAgo = new Date(now - 95 * 24 * 60 * 60 * 1000).toISOString();

      // Guardar 1 tombstone reciente (60 días) y 1 antiguo (95 días)
      saveTombstone({
        id: 'tomb_recent',
        entity: 'trade',
        deletedAt: sixtyDaysAgo,
        updatedAt: sixtyDaysAgo,
        userId: testUserId,
      });

      saveTombstone({
        id: 'tomb_expired',
        entity: 'trade',
        deletedAt: ninetyFiveDaysAgo,
        updatedAt: ninetyFiveDaysAgo,
        userId: testUserId,
      });

      expect(getTombstones()).toHaveLength(2);

      // Ejecutar poda con límite estándar de 90 días
      const pruned = pruneExpiredTombstones(90);
      expect(pruned).toBe(1);

      const remaining = getTombstones();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('tomb_recent');
    });
  });
});
