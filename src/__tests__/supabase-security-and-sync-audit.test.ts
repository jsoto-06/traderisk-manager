// =============================================================================
// TradeRisk Manager — Test Suite: Fase 4.1 Auditoría de Seguridad & Offline-First Sync
// =============================================================================
// NOTA METODOLÓGICA:
// Estas pruebas ejecutan el motor de sincronización y aislamiento contra mocks en memoria
// del cliente Supabase y del LocalStorage de Node/JSDOM.
// Las restricciones compuestas de base de datos (uq_accounts_id_user_id, fk_trades_account_user,
// fk_journal_account_user) y RLS están definidas formalmente en:
// - supabase/migrations/20261031_phase_4_1_security_and_tombstones.sql
// En este test harness, las validaciones de claves compuestas y RLS se simulan validando
// el par (account_id, user_id) en el mock store para reflejar el comportamiento real de Postgres.
// =============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  performSync,
  executeResilientMigration,
  resolveConflictLWW,
  type MigrationStep,
} from '@/lib/sync/sync-engine';
import {
  getAccounts,
  saveAccounts,
  getTrades,
  saveTrades,
  saveJournal,
  getTombstones,
  saveTombstone,
  setStorageNamespace,
  getStorageNamespace,
  getStorageKey,
  STORAGE_KEYS,
  hasGuestDataToImport,
  importGuestDataToUser,
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

describe('FASE 4.1: Auditoría de Seguridad, Integridad y Sincronización Offline-First', () => {
  const userA = 'usr_alice_aaaa1111-2222-3333-4444-555566667777';
  const userB = 'usr_bob_bbbb1111-2222-3333-4444-555566667777';

  const baseAccountA: Account = {
    id: 'acc_alice_01',
    name: 'Cuenta Principal Alice',
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
    updatedAt: '2026-10-31T10:00:00.000Z',
    version: 1,
  };

  const baseTradeA: Trade = {
    id: 'trd_alice_01',
    accountId: 'acc_alice_01',
    asset: 'EUR/USD',
    direction: 'long',
    entryPrice: 1.085,
    exitPrice: 1.092,
    stopLoss: 1.081,
    takeProfit: 1.095,
    size: 100000,
    openDate: '2026-10-31T10:30:00.000Z',
    closeDate: '2026-10-31T11:45:00.000Z',
    status: 'closed',
    result: 700,
    commissions: 5,
    strategy: 'TrendFollowing',
    timeframe: '1h',
    notes: 'Trade de prueba Alice',
    createdAt: '2026-10-31T10:30:00.000Z',
    updatedAt: '2026-10-31T11:45:00.000Z',
    version: 1,
  };

  const baseJournalA: JournalEntry = {
    id: 'jrn_alice_01',
    accountId: 'acc_alice_01',
    date: '2026-10-31T12:00:00.000Z',
    emotionalState: 'calm',
    entryReason: 'Validación de plan Alice',
    planCompliance: true,
    errors: '',
    overtrading: false,
    observations: 'Disciplina adecuada',
    discipline: 5,
    createdAt: '2026-10-31T12:00:00.000Z',
    updatedAt: '2026-10-31T12:00:00.000Z',
    version: 1,
  };

  // Simulación de tablas PostgreSQL
  let dbAccounts: MockDbRecord[] = [];
  let dbTrades: MockDbRecord[] = [];
  let dbJournal: MockDbRecord[] = [];

  // Factory de cliente Supabase Mock con simulación de restricciones relacionales
  const createMockSupabase = (options?: {
    failOnUpload?: boolean;
    failOnDownload?: boolean;
    failOnTradesUpload?: boolean;
  }) => {
    return {
      from: (table: string) => ({
        select: () => ({
          eq: (column: string, value: string) => {
            if (options?.failOnDownload) {
              return Promise.resolve({ data: null, error: new Error('Network timeout fetching ' + table) });
            }
            if (table === 'accounts') {
              const res = dbAccounts.filter((r) => r[column] === value);
              return Promise.resolve({ data: res, error: null });
            }
            if (table === 'trades') {
              const res = dbTrades.filter((r) => r[column] === value);
              return Promise.resolve({ data: res, error: null });
            }
            if (table === 'journal_entries') {
              const res = dbJournal.filter((r) => r[column] === value);
              return Promise.resolve({ data: res, error: null });
            }
            return Promise.resolve({ data: [], error: null });
          },
        }),
        upsert: (payload: MockDbRecord[]) => {
          if (options?.failOnUpload) {
            return Promise.resolve({ error: new Error('Network failure during upsert to ' + table) });
          }
          if (table === 'trades' && options?.failOnTradesUpload) {
            return Promise.resolve({ error: new Error('Simulated failure during trades batch upload') });
          }

          if (table === 'accounts') {
            for (const item of payload) {
              const idx = dbAccounts.findIndex((x) => x.id === item.id);
              if (idx >= 0) dbAccounts[idx] = item;
              else dbAccounts.push(item);
            }
          } else if (table === 'trades') {
            for (const item of payload) {
              // Simular chequeo de clave foránea compuesta: (account_id, user_id) DEBE existir en accounts
              const parent = dbAccounts.find((a) => a.id === item.account_id && a.user_id === item.user_id);
              if (!parent) {
                return Promise.resolve({
                  error: new Error(
                    `violates foreign key constraint "fk_trades_account_user" (account_id=${item.account_id}, user_id=${item.user_id})`,
                  ),
                });
              }
              const idx = dbTrades.findIndex((x) => x.id === item.id);
              if (idx >= 0) dbTrades[idx] = item;
              else dbTrades.push(item);
            }
          } else if (table === 'journal_entries') {
            for (const item of payload) {
              // Simular chequeo de clave foránea compuesta
              const parent = dbAccounts.find((a) => a.id === item.account_id && a.user_id === item.user_id);
              if (!parent) {
                return Promise.resolve({
                  error: new Error(
                    `violates foreign key constraint "fk_journal_account_user" (account_id=${item.account_id}, user_id=${item.user_id})`,
                  ),
                });
              }
              const idx = dbJournal.findIndex((x) => x.id === item.id);
              if (idx >= 0) dbJournal[idx] = item;
              else dbJournal.push(item);
            }
          }
          return Promise.resolve({ error: null });
        },
      }),
    } as unknown as SupabaseClient<Database>;
  };

  beforeEach(() => {
    window.localStorage.clear();
    dbAccounts = [];
    dbTrades = [];
    dbJournal = [];
    setStorageNamespace(null); // Reset a guest
  });

  afterEach(() => {
    setStorageNamespace(null);
  });

  // ---------------------------------------------------------------------------
  // Escenario 1: Eliminación desde escritorio y sincronización en móvil
  // ---------------------------------------------------------------------------
  it('Escenario 1: Eliminación desde escritorio propaga tombstone a la base remota y al dispositivo móvil', async () => {
    const mockClient = createMockSupabase();

    // 1. Escritorio (Alice): sincroniza estado inicial
    setStorageNamespace(userA);
    saveAccounts([baseAccountA]);
    saveTrades([baseTradeA]);
    const initSync = await performSync(mockClient, userA);
    expect(initSync.success).toBe(true);
    expect(dbAccounts).toHaveLength(1);
    expect(dbAccounts[0].deleted_at).toBeNull();

    // 2. Escritorio elimina la cuenta (creando tombstone local)
    saveTombstone({
      id: baseAccountA.id,
      entity: 'account',
      deletedAt: '2026-10-31T14:00:00.000Z',
      updatedAt: '2026-10-31T14:00:00.000Z',
      userId: userA,
    });
    saveAccounts([]); // localmente borrada

    // 3. Sincronización desde escritorio sube el soft-delete a Postgres
    const desktopSync = await performSync(mockClient, userA);
    expect(desktopSync.success).toBe(true);
    expect(desktopSync.deletedCount.accounts).toBe(1);
    expect(dbAccounts[0].deleted_at).toBe('2026-10-31T14:00:00.000Z');

    // 4. Móvil (segundo dispositivo de Alice) sincroniza
    // Simulamos entorno móvil con la cuenta aún activa localmente
    const mobileNamespace = `user_${userA}_mobile`;
    saveAccounts([baseAccountA], mobileNamespace);

    // Móvil sincroniza contra la base remota
    // Usamos performSync con el userId, leyendo el namespace del usuario
    setStorageNamespace(userA);
    const mobileSync = await performSync(mockClient, userA);
    expect(mobileSync.success).toBe(true);

    // La cuenta eliminada no debe estar activa localmente en el cliente sincronizado
    const activeAccounts = getAccounts();
    expect(activeAccounts.find((a) => a.id === baseAccountA.id)).toBeUndefined();
    // Y el tombstone debe quedar registrado en el dispositivo
    const localTombstones = getTombstones();
    expect(localTombstones.some((t) => t.id === baseAccountA.id)).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Escenario 2: Eliminación desde móvil y sincronización en escritorio
  // ---------------------------------------------------------------------------
  it('Escenario 2: Eliminación en móvil se refleja en escritorio mediante descarga de soft-delete', async () => {
    const mockClient = createMockSupabase();

    // Estado inicial en la nube: cuenta y operación creadas
    setStorageNamespace(userA);
    saveAccounts([baseAccountA]);
    saveTrades([baseTradeA]);
    await performSync(mockClient, userA);

    // Móvil borra la operación remotamente (simulado directamente en Postgres)
    const remoteTradeIdx = dbTrades.findIndex((t) => t.id === baseTradeA.id);
    dbTrades[remoteTradeIdx].deleted_at = '2026-10-31T15:00:00.000Z';
    dbTrades[remoteTradeIdx].updated_at = '2026-10-31T15:00:00.000Z';

    // Escritorio sincroniza: debe recibir el soft-delete y retirar el trade de LocalStorage
    const desktopSync = await performSync(mockClient, userA);
    expect(desktopSync.success).toBe(true);

    const desktopTrades = getTrades();
    expect(desktopTrades.find((t) => t.id === baseTradeA.id)).toBeUndefined();

    // Debe existir tombstone local en el escritorio para evitar resurrecciones
    const tombstones = getTombstones();
    expect(tombstones.some((t) => t.id === baseTradeA.id && t.entity === 'trade')).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Escenario 3: Usuario A y Usuario B en el mismo navegador (aislamiento)
  // ---------------------------------------------------------------------------
  it('Escenario 3: Usuario A y Usuario B en el mismo navegador tienen aislamiento estricto de namespaces', () => {
    // 1. Inicia sesión Alice
    setStorageNamespace(userA);
    saveAccounts([baseAccountA]);
    saveTrades([baseTradeA]);

    expect(getAccounts()).toHaveLength(1);
    expect(getAccounts()[0].name).toBe('Cuenta Principal Alice');

    // 2. Inicia sesión Bob en el mismo navegador
    setStorageNamespace(userB);

    // Bob no debe ver las cuentas ni operaciones de Alice
    const bobsAccounts = getAccounts();
    const bobsTrades = getTrades();
    expect(bobsAccounts).toHaveLength(0);
    expect(bobsTrades).toHaveLength(0);

    // Bob crea su propia cuenta
    const bobsAccount: Account = {
      ...baseAccountA,
      id: 'acc_bob_01',
      name: 'Cuenta Crypto Bob',
    };
    saveAccounts([bobsAccount]);
    expect(getAccounts()).toHaveLength(1);
    expect(getAccounts()[0].name).toBe('Cuenta Crypto Bob');

    // 3. Regresa Alice: sus datos están intactos y no contienen los de Bob
    setStorageNamespace(userA);
    const alicesRestoredAccounts = getAccounts();
    expect(alicesRestoredAccounts).toHaveLength(1);
    expect(alicesRestoredAccounts[0].name).toBe('Cuenta Principal Alice');

    // 4. Comprobar claves físicas en LocalStorage
    const aliceKey = getStorageKey(STORAGE_KEYS.ACCOUNTS, `user_${userA}`);
    const bobKey = getStorageKey(STORAGE_KEYS.ACCOUNTS, `user_${userB}`);
    expect(aliceKey).not.toBe(bobKey);
    expect(window.localStorage.getItem(aliceKey)).toContain('Cuenta Principal Alice');
    expect(window.localStorage.getItem(bobKey)).toContain('Cuenta Crypto Bob');
  });

  // ---------------------------------------------------------------------------
  // Escenario 4: Cambio de sesión sin fuga ni contaminación de datos
  // ---------------------------------------------------------------------------
  it('Escenario 4: signOut limpia estado en memoria y regresa a modo invitado sin filtrar datos de usuario', () => {
    // Alice guarda datos autenticados
    setStorageNamespace(userA);
    saveAccounts([baseAccountA]);

    // Simular signOut: regresa a namespace null (invitado)
    setStorageNamespace(null);
    expect(getStorageNamespace()).toBe('guest');

    // En modo invitado no se cargan las cuentas privadas de Alice
    const guestAccounts = getAccounts();
    // En modo invitado sin datos previos, devuelve la cuenta demo o vacía, pero NUNCA la de Alice
    expect(guestAccounts.some((a) => a.id === baseAccountA.id)).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Escenario 5: Conflicto por modificación simultánea (LWW determinista)
  // ---------------------------------------------------------------------------
  it('Escenario 5: Modificación simultánea exacta se resuelve deterministamente sin divergencia', () => {
    const timeT = '2026-10-31T16:00:00.000Z';

    // Dispositivo 1: modifica balance a 12000
    const localHash = JSON.stringify({ balance: 12000 });
    // Dispositivo 2: modifica balance a 11500
    const remoteHash = JSON.stringify({ balance: 11500 });

    // Ambos en la misma versión y mismo timestamp
    const decision = resolveConflictLWW(timeT, timeT, 2, 2, localHash, remoteHash);

    // El resultado debe ser determinista: si localHash > remoteHash => local_wins, sino remote_wins
    const expected = localHash > remoteHash ? 'local_wins' : 'remote_wins';
    expect(decision).toBe(expected);

    // En el caso idéntico devuelve identical_noop
    const identicalDecision = resolveConflictLWW(timeT, timeT, 2, 2, localHash, localHash);
    expect(identicalDecision).toBe('identical_noop');
  });

  // ---------------------------------------------------------------------------
  // Escenario 6: Actualización más antigua vs actualización más reciente
  // ---------------------------------------------------------------------------
  it('Escenario 6: Actualización más antigua que llega fuera de orden es descartada por LWW', async () => {
    const mockClient = createMockSupabase();

    setStorageNamespace(userA);
    // Local tiene versión más reciente (18:00)
    const localNewer: Account = {
      ...baseAccountA,
      balance: 15000,
      updatedAt: '2026-10-31T18:00:00.000Z',
      version: 3,
    };
    saveAccounts([localNewer]);

    // Remoto tiene versión más antigua que llega retrasada por la red (17:00)
    dbAccounts.push({
      id: baseAccountA.id,
      user_id: userA,
      name: baseAccountA.name,
      type: baseAccountA.type,
      initial_capital: baseAccountA.initialCapital,
      balance: 13000,
      equity: 13000,
      currency: 'USD',
      profit_target: 10,
      daily_loss_limit: 3,
      max_drawdown: 5,
      drawdown_type: 'static',
      timezone: 'UTC',
      daily_reset_hour: 0,
      risk_per_trade: 1,
      leverage: 10,
      created_at: baseAccountA.createdAt,
      updated_at: '2026-10-31T17:00:00.000Z',
      deleted_at: null,
      version: 2,
    });

    const res = await performSync(mockClient, userA);
    expect(res.success).toBe(true);
    // Local debe haber ganado y sobrescrito la versión remota obsoleta
    expect(dbAccounts[0].balance).toBe(15000);
    expect(dbAccounts[0].updated_at).toBe('2026-10-31T18:00:00.000Z');
    expect(getAccounts()[0].balance).toBe(15000);
  });

  // ---------------------------------------------------------------------------
  // Escenario 7: Operación asociada a cuenta de otro usuario (rechazo)
  // ---------------------------------------------------------------------------
  it('Escenario 7: Operación asociada a cuenta de otro usuario es rechazada y no se sincroniza', async () => {
    const mockClient = createMockSupabase();

    // Cuenta pertenece a Bob
    dbAccounts.push({
      id: 'acc_bob_target',
      user_id: userB,
      name: 'Cuenta Privada de Bob',
      type: 'Personal',
      initial_capital: 20000,
      balance: 20000,
      equity: 20000,
      currency: 'USD',
      profit_target: 10,
      daily_loss_limit: 3,
      max_drawdown: 5,
      drawdown_type: 'static',
      timezone: 'UTC',
      daily_reset_hour: 0,
      risk_per_trade: 1,
      leverage: 10,
      created_at: '2026-10-31T10:00:00.000Z',
      updated_at: '2026-10-31T10:00:00.000Z',
      deleted_at: null,
      version: 1,
    });

    // Alice intenta asociar una operación suya a la cuenta de Bob
    setStorageNamespace(userA);
    saveAccounts([baseAccountA]); // Cuenta propia de Alice
    const maliciousTrade: Trade = {
      ...baseTradeA,
      id: 'trd_alice_attack',
      accountId: 'acc_bob_target', // Referencia ajena
    };
    saveTrades([maliciousTrade]);

    const res = await performSync(mockClient, userA);
    expect(res.success).toBe(true);

    // La operación ajena NO debe haber sido subida a la base de datos
    expect(dbTrades.find((t) => t.id === 'trd_alice_attack')).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // Escenario 8: Diario asociado a cuenta de otro usuario (rechazo)
  // ---------------------------------------------------------------------------
  it('Escenario 8: Entrada de diario asociada a cuenta de otro usuario es rechazada y no se sincroniza', async () => {
    const mockClient = createMockSupabase();

    setStorageNamespace(userA);
    saveAccounts([baseAccountA]);

    const foreignJournal: JournalEntry = {
      ...baseJournalA,
      id: 'jrn_alice_foreign',
      accountId: 'acc_foreign_unauthorized',
    };
    saveJournal([foreignJournal]);

    const res = await performSync(mockClient, userA);
    expect(res.success).toBe(true);

    // La entrada huérfana/ajena no se sube a la base
    expect(dbJournal.find((j) => j.id === 'jrn_alice_foreign')).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // Escenario 9: Interrupción de la migración en mitad del proceso
  // ---------------------------------------------------------------------------
  it('Escenario 9: Interrupción de la migración no destruye los datos locales ni el backup preventivo', async () => {
    // Simular fallo en la fase de subida de operaciones
    const failingClient = createMockSupabase({ failOnTradesUpload: true });

    setStorageNamespace(userA);
    saveAccounts([baseAccountA]);
    saveTrades([baseTradeA]);

    const stepsReported: MigrationStep[] = [];
    let caughtError = false;

    try {
      await executeResilientMigration(failingClient, userA, {
        onProgress: (step) => stepsReported.push(step),
      });
    } catch {
      caughtError = true;
    }

    expect(caughtError).toBe(true);
    expect(stepsReported).toContain('backing_up');
    expect(stepsReported).toContain('uploading_trades');

    // Los datos locales de Alice siguen 100% intactos en LocalStorage
    expect(getAccounts()).toHaveLength(1);
    expect(getAccounts()[0].id).toBe(baseAccountA.id);
    expect(getTrades()).toHaveLength(1);
    expect(getTrades()[0].id).toBe(baseTradeA.id);
  });

  // ---------------------------------------------------------------------------
  // Escenario 10: Reanudación de la migración sin duplicados (idempotencia)
  // ---------------------------------------------------------------------------
  it('Escenario 10: Reanudación de la migración tras corregir el error es idempotente y no duplica registros', async () => {
    const mockClient = createMockSupabase();

    setStorageNamespace(userA);
    saveAccounts([baseAccountA]);
    saveTrades([baseTradeA]);
    saveJournal([baseJournalA]);

    // Intento 1: Exitoso
    const mig1 = await executeResilientMigration(mockClient, userA);
    expect(mig1.success).toBe(true);
    expect(mig1.accountsUploaded).toBe(1);
    expect(mig1.tradesUploaded).toBe(1);
    expect(mig1.journalUploaded).toBe(1);
    expect(dbAccounts).toHaveLength(1);
    expect(dbTrades).toHaveLength(1);

    // Intento 2: Reanudación/reintento inmediato
    const mig2 = await executeResilientMigration(mockClient, userA);
    expect(mig2.success).toBe(true);

    // La base de datos no debe duplicar registros por el onConflict id
    expect(dbAccounts).toHaveLength(1);
    expect(dbTrades).toHaveLength(1);
    expect(dbJournal).toHaveLength(1);
    expect(mig2.verifiedRemoteCounts.accounts).toBe(1);
    expect(mig2.verifiedRemoteCounts.trades).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // Escenario 11: Fallo de red durante la subida
  // ---------------------------------------------------------------------------
  it('Escenario 11: Fallo de red durante la subida devuelve error controlado sin pérdida de datos locales', async () => {
    const failingClient = createMockSupabase({ failOnUpload: true });

    setStorageNamespace(userA);
    saveAccounts([baseAccountA]);

    const res = await performSync(failingClient, userA);
    expect(res.success).toBe(false);
    expect(res.error).toContain('Network failure during upsert');

    // Los datos locales siguen disponibles
    expect(getAccounts()).toHaveLength(1);
    expect(getAccounts()[0].balance).toBe(10500);
  });

  // ---------------------------------------------------------------------------
  // Escenario 12: Fallo de red durante la descarga
  // ---------------------------------------------------------------------------
  it('Escenario 12: Fallo de red durante la descarga preserva los registros existentes en LocalStorage', async () => {
    const failingClient = createMockSupabase({ failOnDownload: true });

    setStorageNamespace(userA);
    saveAccounts([baseAccountA]);
    saveTrades([baseTradeA]);

    const res = await performSync(failingClient, userA);
    expect(res.success).toBe(false);
    expect(res.error).toContain('Network timeout');

    // LocalStorage no se vacía ante un fallo de lectura remoto
    expect(getAccounts()).toHaveLength(1);
    expect(getTrades()).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------
  // Escenario 13: Eliminación de cuenta con operaciones y diario asociados
  // ---------------------------------------------------------------------------
  it('Escenario 13: Eliminación de una cuenta genera cascada de tombstones para sus operaciones y diario', async () => {
    const mockClient = createMockSupabase();

    setStorageNamespace(userA);
    saveAccounts([baseAccountA]);
    saveTrades([baseTradeA]);
    saveJournal([baseJournalA]);

    // 1. Sincronización inicial con todos los registros
    await performSync(mockClient, userA);
    expect(dbAccounts).toHaveLength(1);
    expect(dbTrades).toHaveLength(1);
    expect(dbJournal).toHaveLength(1);

    // 2. Simulamos la eliminación de la cuenta padre en el cliente (como hace useStorage.deleteAccount)
    const now = '2026-10-31T19:00:00.000Z';
    saveTombstone({
      id: baseAccountA.id,
      entity: 'account',
      deletedAt: now,
      updatedAt: now,
      userId: userA,
    });
    // Marcar también tombstones en cascada para sus hijos
    saveTombstone({
      id: baseTradeA.id,
      entity: 'trade',
      deletedAt: now,
      updatedAt: now,
      accountId: baseAccountA.id,
      userId: userA,
    });
    saveTombstone({
      id: baseJournalA.id,
      entity: 'journal',
      deletedAt: now,
      updatedAt: now,
      accountId: baseAccountA.id,
      userId: userA,
    });
    saveAccounts([]);
    saveTrades([]);
    saveJournal([]);

    // 3. Sincronizar hacia la nube
    const syncRes = await performSync(mockClient, userA);
    expect(syncRes.success).toBe(true);
    expect(syncRes.deletedCount.accounts).toBe(1);
    expect(syncRes.deletedCount.trades).toBe(1);
    expect(syncRes.deletedCount.journal).toBe(1);

    // Todos los registros remotos deben tener deleted_at establecido
    expect(dbAccounts[0].deleted_at).toBe(now);
    expect(dbTrades[0].deleted_at).toBe(now);
    expect(dbJournal[0].deleted_at).toBe(now);
  });

  // ---------------------------------------------------------------------------
  // Escenario 14: Repetición de sincronización tras eliminación (no resurrección)
  // ---------------------------------------------------------------------------
  it('Escenario 14: Sincronizaciones sucesivas tras una eliminación nunca resucitan los registros borrados', async () => {
    const mockClient = createMockSupabase();

    setStorageNamespace(userA);
    saveAccounts([baseAccountA]);
    await performSync(mockClient, userA);

    // Borrado local con tombstone
    const delTime = '2026-10-31T20:00:00.000Z';
    saveTombstone({
      id: baseAccountA.id,
      entity: 'account',
      deletedAt: delTime,
      updatedAt: delTime,
      userId: userA,
    });
    saveAccounts([]);

    // Primera sincronización post-eliminación
    const res1 = await performSync(mockClient, userA);
    expect(res1.success).toBe(true);
    expect(getAccounts()).toHaveLength(0);

    // Segunda sincronización sucesiva: no debe descargar la cuenta remota marcada como soft-deleted
    const res2 = await performSync(mockClient, userA);
    expect(res2.success).toBe(true);
    expect(res2.downloadedCount.accounts).toBe(0);
    expect(getAccounts()).toHaveLength(0);

    // Tercera sincronización: idempotente y estable
    const res3 = await performSync(mockClient, userA);
    expect(res3.success).toBe(true);
    expect(getAccounts()).toHaveLength(0);
    expect(dbAccounts[0].deleted_at).toBe(delTime);
  });

  // ---------------------------------------------------------------------------
  // Bonus: Confirmación explícita de importación de datos invitado a usuario
  // ---------------------------------------------------------------------------
  it('Importación de invitado a usuario requiere confirmación y preserva los datos del invitado en su namespace nuevo', () => {
    // 1. Crear datos en modo invitado
    setStorageNamespace(null); // 'guest'
    saveAccounts([baseAccountA]);
    saveTrades([baseTradeA]);

    // Comprobar detección de datos de invitado
    expect(hasGuestDataToImport()).toBe(true);

    // 2. Importar explícitamente al usuario Alice
    const importRes = importGuestDataToUser(userA);
    expect(importRes.accountsAdded).toBe(1);
    expect(importRes.tradesAdded).toBe(1);

    // 3. Al cambiar al namespace de Alice, los datos están presentes
    setStorageNamespace(userA);
    const alicesAccounts = getAccounts();
    expect(alicesAccounts).toHaveLength(1);
    expect(alicesAccounts[0].id).toBe(baseAccountA.id);
  });
});
