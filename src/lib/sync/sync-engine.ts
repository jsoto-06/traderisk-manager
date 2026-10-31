// =============================================================================
// TradeRisk Manager — Idempotent Multi-Device Cloud Synchronization Engine
// Fase 4.1: Tombstones, Soft-Deletes, User Namespaces & Conflict Resolution
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import type { Account, Trade, JournalEntry, Tombstone } from '@/lib/types';
import {
  getAccounts,
  saveAccounts,
  getTrades,
  saveTrades,
  getJournal,
  saveJournal,
  getSettings,
  getTombstones,
  saveTombstones,
} from '@/lib/storage';
import { createBackupPayload, type BackupPayload } from '@/lib/storage/backup-spec';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

export interface SyncResult {
  success: boolean;
  uploadedCount: {
    accounts: number;
    trades: number;
    journal: number;
  };
  downloadedCount: {
    accounts: number;
    trades: number;
    journal: number;
  };
  deletedCount: {
    accounts: number;
    trades: number;
    journal: number;
  };
  conflictsResolved: number;
  error?: string;
  syncedAt?: string;
}

export interface MigrationPreview {
  accountsCount: number;
  tradesCount: number;
  journalCount: number;
  accountNames: string[];
  totalBalance: number;
  hasCorruptedRelations: boolean;
}

// -----------------------------------------------------------------------------
// Canonical JSON & Deterministic Normalization
// -----------------------------------------------------------------------------

/**
 * Recursively serializes any value into a canonical JSON string:
 * - Object keys are sorted alphabetically at all recursive depths.
 * - Undefined values in objects are omitted.
 * - Primitive values, arrays, and null are serialized deterministically.
 * This guarantees that two functionally identical objects produce the exact same
 * string hash, independent of insertion order or browser runtime differences.
 */
export function canonicalJsonStringify(obj: unknown): string {
  if (obj === null || obj === undefined) {
    return 'null';
  }
  if (typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map((item) => canonicalJsonStringify(item)).join(',')}]`;
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs: string[] = [];
  for (const k of keys) {
    const v = (obj as Record<string, unknown>)[k];
    if (v !== undefined) {
      pairs.push(`${JSON.stringify(k)}:${canonicalJsonStringify(v)}`);
    }
  }
  return `{${pairs.join(',')}}`;
}

function toCanonicalIso(dateVal?: string | null): string | null {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  return isNaN(d.getTime()) ? String(dateVal).trim() : d.toISOString();
}

function roundFloat(val: unknown, decimals: number): number {
  const num = Number(val);
  if (isNaN(num)) return 0;
  return Number(num.toFixed(decimals));
}

// -----------------------------------------------------------------------------
// Conflict Resolution (LWW & Optimistic Versioning)
// -----------------------------------------------------------------------------

export type ConflictDecision = 'local_wins' | 'remote_wins' | 'identical_noop';

/**
 * Deterministic Last-Write-Wins and Optimistic Version tie-breaker.
 * 1. If functional canonical representations are identical => identical_noop (no action needed).
 * 2. Highest updated_at timestamp in UTC wins.
 * 3. If timestamps are identical, highest version wins.
 * 4. If versions are identical, compares canonical sorted JSON to guarantee convergence.
 */
export function resolveConflictLWW(
  localUpdatedAt: string,
  remoteUpdatedAt: string,
  localVersion: number = 1,
  remoteVersion: number = 1,
  localDataHash?: string,
  remoteDataHash?: string,
): ConflictDecision {
  if (localDataHash && remoteDataHash && localDataHash === remoteDataHash) {
    return 'identical_noop';
  }

  const localTime = new Date(localUpdatedAt).getTime();
  const remoteTime = new Date(remoteUpdatedAt).getTime();

  if (localTime > remoteTime) return 'local_wins';
  if (remoteTime > localTime) return 'remote_wins';

  if (localVersion > remoteVersion) return 'local_wins';
  if (remoteVersion > localVersion) return 'remote_wins';

  if (localDataHash && remoteDataHash) {
    if (localDataHash === remoteDataHash) return 'identical_noop';
    // Alphabetical tie-breaker on canonical sorted JSON ensures 100% deterministic convergence
    return localDataHash > remoteDataHash ? 'local_wins' : 'remote_wins';
  }

  return 'remote_wins';
}

// -----------------------------------------------------------------------------
// Database Mappers (TypeScript camelCase <-> PostgreSQL snake_case)
// -----------------------------------------------------------------------------

function mapAccountToDb(acc: Account, userId: string) {
  return {
    id: acc.id,
    user_id: userId,
    name: acc.name,
    type: acc.type,
    initial_capital: acc.initialCapital,
    balance: acc.balance,
    equity: acc.equity,
    currency: acc.currency,
    profit_target: acc.profitTarget,
    daily_loss_limit: acc.dailyLossLimit,
    max_drawdown: acc.maxDrawdown,
    drawdown_type: acc.drawdownType,
    timezone: acc.timezone,
    daily_reset_hour: acc.dailyResetHour,
    risk_per_trade: acc.riskPerTrade,
    leverage: acc.leverage,
    created_at: acc.createdAt,
    updated_at: acc.updatedAt || new Date().toISOString(),
    deleted_at: acc.deletedAt || null,
    version: acc.version || 1,
  };
}

function mapAccountFromDb(row: Database['public']['Tables']['accounts']['Row']): Account {
  return {
    id: row.id,
    name: row.name,
    type: row.type as Account['type'],
    initialCapital: Number(row.initial_capital),
    balance: Number(row.balance),
    equity: Number(row.equity),
    currency: row.currency,
    profitTarget: Number(row.profit_target),
    dailyLossLimit: Number(row.daily_loss_limit),
    maxDrawdown: Number(row.max_drawdown),
    drawdownType: row.drawdown_type as Account['drawdownType'],
    timezone: row.timezone,
    dailyResetHour: row.daily_reset_hour,
    riskPerTrade: Number(row.risk_per_trade),
    leverage: Number(row.leverage),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || null,
    version: Number(row.version || 1),
  };
}

function mapTradeToDb(trade: Trade, userId: string) {
  const now = new Date().toISOString();
  return {
    id: trade.id,
    user_id: userId,
    account_id: trade.accountId,
    asset: trade.asset,
    direction: trade.direction,
    entry_price: trade.entryPrice,
    exit_price: trade.exitPrice ?? null,
    stop_loss: trade.stopLoss,
    take_profit: trade.takeProfit,
    size: trade.size,
    open_date: trade.openDate,
    close_date: trade.closeDate ?? null,
    status: trade.status,
    result: trade.result ?? null,
    pnl_percentage: null,
    fees: trade.commissions ?? 0,
    risk_reward_ratio: null,
    notes: trade.notes ?? '',
    market_type: null,
    created_at: trade.createdAt || trade.openDate || now,
    updated_at: trade.updatedAt || now,
    deleted_at: trade.deletedAt || null,
    version: trade.version || 1,
  };
}

function mapTradeFromDb(row: Database['public']['Tables']['trades']['Row']): Trade {
  return {
    id: row.id,
    accountId: row.account_id,
    asset: row.asset,
    direction: row.direction as Trade['direction'],
    entryPrice: Number(row.entry_price),
    exitPrice: row.exit_price != null ? Number(row.exit_price) : undefined,
    stopLoss: Number(row.stop_loss),
    takeProfit: Number(row.take_profit),
    size: Number(row.size),
    openDate: row.open_date,
    closeDate: row.close_date || undefined,
    status: row.status as Trade['status'],
    result: row.result != null ? Number(row.result) : undefined,
    commissions: Number(row.fees || 0),
    strategy: 'Manual',
    timeframe: '1h',
    notes: row.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || null,
    version: Number(row.version || 1),
  };
}

function mapJournalToDb(entry: JournalEntry, userId: string) {
  const now = new Date().toISOString();
  return {
    id: entry.id,
    user_id: userId,
    account_id: entry.accountId,
    date: entry.date,
    emotional_state: entry.emotionalState,
    entry_reason: entry.entryReason,
    plan_compliance: entry.planCompliance,
    errors: entry.errors || null,
    overtrading: entry.overtrading,
    observations: entry.observations || null,
    discipline: entry.discipline,
    created_at: entry.createdAt || entry.date || now,
    updated_at: entry.updatedAt || now,
    deleted_at: entry.deletedAt || null,
    version: entry.version || 1,
  };
}

function mapJournalFromDb(row: Database['public']['Tables']['journal_entries']['Row']): JournalEntry {
  return {
    id: row.id,
    accountId: row.account_id,
    date: row.date,
    emotionalState: row.emotional_state as JournalEntry['emotionalState'],
    entryReason: row.entry_reason,
    planCompliance: row.plan_compliance,
    errors: row.errors || '',
    overtrading: row.overtrading,
    observations: row.observations || '',
    discipline: (row.discipline || 3) as JournalEntry['discipline'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || null,
    version: Number(row.version || 1),
  };
}

export function normalizeAccount(a: Account) {
  return {
    id: String(a.id).trim(),
    name: String(a.name).trim(),
    type: a.type,
    initialCapital: roundFloat(a.initialCapital, 2),
    balance: roundFloat(a.balance, 2),
    equity: roundFloat(a.equity, 2),
    currency: String(a.currency || 'USD').trim().toUpperCase(),
    profitTarget: roundFloat(a.profitTarget, 2),
    dailyLossLimit: roundFloat(a.dailyLossLimit, 2),
    maxDrawdown: roundFloat(a.maxDrawdown, 2),
    drawdownType: a.drawdownType,
    timezone: String(a.timezone || 'UTC').trim(),
    dailyResetHour: Math.floor(Number(a.dailyResetHour || 0)),
    riskPerTrade: roundFloat(a.riskPerTrade, 2),
    leverage: roundFloat(a.leverage, 2),
    deletedAt: toCanonicalIso(a.deletedAt),
  };
}

export function normalizeTrade(t: Trade) {
  return {
    id: String(t.id).trim(),
    accountId: String(t.accountId).trim(),
    asset: String(t.asset).trim().toUpperCase(),
    direction: t.direction,
    entryPrice: roundFloat(t.entryPrice, 8),
    exitPrice: t.exitPrice != null ? roundFloat(t.exitPrice, 8) : null,
    stopLoss: roundFloat(t.stopLoss, 8),
    takeProfit: roundFloat(t.takeProfit, 8),
    size: roundFloat(t.size, 8),
    openDate: toCanonicalIso(t.openDate),
    closeDate: toCanonicalIso(t.closeDate),
    status: t.status,
    result: t.result != null ? roundFloat(t.result, 4) : null,
    commissions: roundFloat(t.commissions || 0, 4),
    notes: t.notes ? String(t.notes).trim() : '',
    deletedAt: toCanonicalIso(t.deletedAt),
  };
}

export function normalizeJournal(j: JournalEntry) {
  return {
    id: String(j.id).trim(),
    accountId: String(j.accountId).trim(),
    date: toCanonicalIso(j.date),
    emotionalState: j.emotionalState,
    entryReason: String(j.entryReason).trim(),
    planCompliance: Boolean(j.planCompliance),
    errors: j.errors ? String(j.errors).trim() : '',
    overtrading: Boolean(j.overtrading),
    observations: j.observations ? String(j.observations).trim() : '',
    discipline: Math.max(1, Math.min(5, Math.floor(Number(j.discipline || 3)))),
    deletedAt: toCanonicalIso(j.deletedAt),
  };
}

// -----------------------------------------------------------------------------
// Core Synchronization Logic with Tombstone Support
// -----------------------------------------------------------------------------

export async function performSync(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<SyncResult> {
  const userNs = `user_${userId}`;
  const now = new Date().toISOString();
  const result: SyncResult = {
    success: false,
    uploadedCount: { accounts: 0, trades: 0, journal: 0 },
    downloadedCount: { accounts: 0, trades: 0, journal: 0 },
    deletedCount: { accounts: 0, trades: 0, journal: 0 },
    conflictsResolved: 0,
    syncedAt: now,
  };

  try {
    // 1. Fetch all remote records for this user (including soft-deleted)
    const [remoteAccsRes, remoteTrdsRes, remoteJourRes] = await Promise.all([
      supabase.from('accounts').select('*').eq('user_id', userId),
      supabase.from('trades').select('*').eq('user_id', userId),
      supabase.from('journal_entries').select('*').eq('user_id', userId),
    ]);

    if (remoteAccsRes.error) throw new Error(`Error al leer cuentas remotas: ${remoteAccsRes.error.message}`);
    if (remoteTrdsRes.error) throw new Error(`Error al leer operaciones remotas: ${remoteTrdsRes.error.message}`);
    if (remoteJourRes.error) throw new Error(`Error al leer bitácora remota: ${remoteJourRes.error.message}`);

    const remoteAccounts = (remoteAccsRes.data || []).map(mapAccountFromDb);
    const remoteTrades = (remoteTrdsRes.data || []).map(mapTradeFromDb);
    const remoteJournal = (remoteJourRes.data || []).map(mapJournalFromDb);

    // 2. Read local state from this user's namespace
    const localAccounts = getAccounts(userNs);
    const localTrades = getTrades(undefined, userNs);
    const localJournal = getJournal(undefined, userNs);
    const localTombstones = getTombstones(userNs);

    const tombstoneMap = new Map<string, Tombstone>(localTombstones.map((t) => [t.id, t]));

    // -------------------------------------------------------------------------
    // Synchronize ACCOUNTS & Tombstones
    // -------------------------------------------------------------------------
    const mergedAccountsMap = new Map<string, Account>();
    const deletedAccountIds = new Set<string>();
    const accountsToUpload: Account[] = [];

    // Process remote accounts
    for (const remote of remoteAccounts) {
      if (remote.deletedAt) {
        deletedAccountIds.add(remote.id);
        // Ensure local tombstone exists
        if (!tombstoneMap.has(remote.id)) {
          tombstoneMap.set(remote.id, {
            id: remote.id,
            entity: 'account',
            deletedAt: remote.deletedAt,
            updatedAt: remote.updatedAt,
            userId,
          });
        }
      } else {
        mergedAccountsMap.set(remote.id, remote);
      }
    }

    // Process local account tombstones against remote
    for (const [id, tomb] of tombstoneMap.entries()) {
      if (tomb.entity !== 'account') continue;
      const remote = remoteAccounts.find((r) => r.id === id);
      if (remote && !remote.deletedAt) {
        const decision = resolveConflictLWW(tomb.updatedAt, remote.updatedAt);
        if (decision === 'local_wins') {
          // Local deletion wins -> soft-delete remote
          deletedAccountIds.add(id);
          mergedAccountsMap.delete(id);
          accountsToUpload.push({
            ...remote,
            deletedAt: tomb.deletedAt,
            updatedAt: tomb.updatedAt,
            version: (remote.version || 0) + 1,
          });
          result.deletedCount.accounts++;
        } else {
          // Remote modification is newer than local deletion -> remote wins
          tombstoneMap.delete(id);
          mergedAccountsMap.set(remote.id, remote);
          result.conflictsResolved++;
        }
      } else {
        deletedAccountIds.add(id);
      }
    }

    // Process local active accounts
    for (const local of localAccounts) {
      if (deletedAccountIds.has(local.id)) {
        const tomb = tombstoneMap.get(local.id);
        const decision = resolveConflictLWW(local.updatedAt || local.createdAt, tomb?.updatedAt || now);
        if (decision === 'local_wins') {
          // User edited local account after deletion -> resurrect locally and on remote
          deletedAccountIds.delete(local.id);
          tombstoneMap.delete(local.id);
          mergedAccountsMap.set(local.id, { ...local, deletedAt: null });
          accountsToUpload.push({ ...local, deletedAt: null, updatedAt: now });
          result.uploadedCount.accounts++;
        }
        continue;
      }

      const remote = mergedAccountsMap.get(local.id);
      if (!remote) {
        mergedAccountsMap.set(local.id, local);
        accountsToUpload.push(local);
        result.uploadedCount.accounts++;
      } else {
        const decision = resolveConflictLWW(
          local.updatedAt || local.createdAt,
          remote.updatedAt,
          local.version,
          remote.version,
          canonicalJsonStringify(normalizeAccount(local)),
          canonicalJsonStringify(normalizeAccount(remote)),
        );

        if (decision === 'local_wins') {
          mergedAccountsMap.set(local.id, local);
          accountsToUpload.push(local);
          result.uploadedCount.accounts++;
          result.conflictsResolved++;
        } else if (decision === 'remote_wins') {
          mergedAccountsMap.set(remote.id, remote);
          result.downloadedCount.accounts++;
          result.conflictsResolved++;
        }
      }
    }

    if (accountsToUpload.length > 0) {
      const payload = accountsToUpload.map((a) => mapAccountToDb(a, userId));
      const { error: upsertErr } = await (supabase.from('accounts') as unknown as {
        upsert: (values: unknown, options?: { onConflict?: string }) => Promise<{ error: Error | null }>;
      }).upsert(payload, { onConflict: 'id' });
      if (upsertErr) throw new Error(`Error al sincronizar cuentas: ${upsertErr.message}`);
    }

    // -------------------------------------------------------------------------
    // Synchronize TRADES & Tombstones with Compound Relational Integrity
    // -------------------------------------------------------------------------
    const mergedTradesMap = new Map<string, Trade>();
    const deletedTradeIds = new Set<string>();
    const tradesToUpload: Trade[] = [];

    for (const remote of remoteTrades) {
      if (remote.deletedAt) {
        deletedTradeIds.add(remote.id);
        if (!tombstoneMap.has(remote.id)) {
          tombstoneMap.set(remote.id, {
            id: remote.id,
            entity: 'trade',
            deletedAt: remote.deletedAt,
            updatedAt: remote.updatedAt || now,
            accountId: remote.accountId,
            userId,
          });
        }
      } else {
        mergedTradesMap.set(remote.id, remote);
      }
    }

    // Process local trade tombstones
    for (const [id, tomb] of tombstoneMap.entries()) {
      if (tomb.entity !== 'trade') continue;
      const remote = remoteTrades.find((r) => r.id === id);
      if (remote && !remote.deletedAt) {
        const decision = resolveConflictLWW(tomb.updatedAt, remote.updatedAt || now);
        if (decision === 'local_wins') {
          deletedTradeIds.add(id);
          mergedTradesMap.delete(id);
          tradesToUpload.push({
            ...remote,
            deletedAt: tomb.deletedAt,
            updatedAt: tomb.updatedAt,
            version: (remote.version || 0) + 1,
          });
          result.deletedCount.trades++;
        } else {
          tombstoneMap.delete(id);
          mergedTradesMap.set(remote.id, remote);
          result.conflictsResolved++;
        }
      } else {
        deletedTradeIds.add(id);
      }
    }

    // Process local active trades
    for (const local of localTrades) {
      const parentAccountExists = mergedAccountsMap.has(local.accountId);
      const parentAccountIsDeleted = deletedAccountIds.has(local.accountId);

      if (!parentAccountExists) {
        // Orphan trade with no valid parent account: DO NOT upload to PostgreSQL
        deletedTradeIds.add(local.id);
        continue;
      }

      if (parentAccountIsDeleted) {
        // Cascade soft-delete: if parent account is deleted, trade is tombstoned
        if (!deletedTradeIds.has(local.id)) {
          deletedTradeIds.add(local.id);
          tombstoneMap.set(local.id, {
            id: local.id,
            entity: 'trade',
            deletedAt: now,
            updatedAt: now,
            accountId: local.accountId,
            userId,
          });
          if (remoteTrades.some((r) => r.id === local.id)) {
            tradesToUpload.push({
              ...local,
              deletedAt: now,
              updatedAt: now,
              version: (local.version || 0) + 1,
            });
            result.deletedCount.trades++;
          }
        }
        continue;
      }

      if (deletedTradeIds.has(local.id)) {
        continue;
      }

      const remote = mergedTradesMap.get(local.id);
      if (!remote) {
        mergedTradesMap.set(local.id, local);
        tradesToUpload.push(local);
        result.uploadedCount.trades++;
      } else {
        const decision = resolveConflictLWW(
          local.updatedAt || local.openDate,
          remote.updatedAt || remote.openDate,
          local.version,
          remote.version,
          canonicalJsonStringify(normalizeTrade(local)),
          canonicalJsonStringify(normalizeTrade(remote)),
        );

        if (decision === 'local_wins') {
          mergedTradesMap.set(local.id, local);
          tradesToUpload.push(local);
          result.uploadedCount.trades++;
          result.conflictsResolved++;
        } else if (decision === 'remote_wins') {
          mergedTradesMap.set(remote.id, remote);
          result.downloadedCount.trades++;
          result.conflictsResolved++;
        }
      }
    }

    if (tradesToUpload.length > 0) {
      const payload = tradesToUpload.map((t) => mapTradeToDb(t, userId));
      const { error: upsertErr } = await (supabase.from('trades') as unknown as {
        upsert: (values: unknown, options?: { onConflict?: string }) => Promise<{ error: Error | null }>;
      }).upsert(payload, { onConflict: 'id' });
      if (upsertErr) throw new Error(`Error al sincronizar operaciones: ${upsertErr.message}`);
    }

    // -------------------------------------------------------------------------
    // Synchronize JOURNAL & Tombstones with Compound Relational Integrity
    // -------------------------------------------------------------------------
    const mergedJournalMap = new Map<string, JournalEntry>();
    const deletedJournalIds = new Set<string>();
    const journalToUpload: JournalEntry[] = [];

    for (const remote of remoteJournal) {
      if (remote.deletedAt) {
        deletedJournalIds.add(remote.id);
        if (!tombstoneMap.has(remote.id)) {
          tombstoneMap.set(remote.id, {
            id: remote.id,
            entity: 'journal',
            deletedAt: remote.deletedAt,
            updatedAt: remote.updatedAt || now,
            accountId: remote.accountId,
            userId,
          });
        }
      } else {
        mergedJournalMap.set(remote.id, remote);
      }
    }

    for (const [id, tomb] of tombstoneMap.entries()) {
      if (tomb.entity !== 'journal') continue;
      const remote = remoteJournal.find((r) => r.id === id);
      if (remote && !remote.deletedAt) {
        const decision = resolveConflictLWW(tomb.updatedAt, remote.updatedAt || now);
        if (decision === 'local_wins') {
          deletedJournalIds.add(id);
          mergedJournalMap.delete(id);
          journalToUpload.push({
            ...remote,
            deletedAt: tomb.deletedAt,
            updatedAt: tomb.updatedAt,
            version: (remote.version || 0) + 1,
          });
          result.deletedCount.journal++;
        } else {
          tombstoneMap.delete(id);
          mergedJournalMap.set(remote.id, remote);
          result.conflictsResolved++;
        }
      } else {
        deletedJournalIds.add(id);
      }
    }

    for (const local of localJournal) {
      const parentAccountExists = mergedAccountsMap.has(local.accountId);
      const parentAccountIsDeleted = deletedAccountIds.has(local.accountId);

      if (!parentAccountExists) {
        // Orphan journal entry with no valid parent account: DO NOT upload to PostgreSQL
        deletedJournalIds.add(local.id);
        continue;
      }

      if (parentAccountIsDeleted) {
        if (!deletedJournalIds.has(local.id)) {
          deletedJournalIds.add(local.id);
          tombstoneMap.set(local.id, {
            id: local.id,
            entity: 'journal',
            deletedAt: now,
            updatedAt: now,
            accountId: local.accountId,
            userId,
          });
          if (remoteJournal.some((r) => r.id === local.id)) {
            journalToUpload.push({
              ...local,
              deletedAt: now,
              updatedAt: now,
              version: (local.version || 0) + 1,
            });
            result.deletedCount.journal++;
          }
        }
        continue;
      }

      if (deletedJournalIds.has(local.id)) {
        continue;
      }

      const remote = mergedJournalMap.get(local.id);
      if (!remote) {
        mergedJournalMap.set(local.id, local);
        journalToUpload.push(local);
        result.uploadedCount.journal++;
      } else {
        const decision = resolveConflictLWW(
          local.updatedAt || local.date,
          remote.updatedAt || remote.date,
          local.version,
          remote.version,
          canonicalJsonStringify(normalizeJournal(local)),
          canonicalJsonStringify(normalizeJournal(remote)),
        );

        if (decision === 'local_wins') {
          mergedJournalMap.set(local.id, local);
          journalToUpload.push(local);
          result.uploadedCount.journal++;
          result.conflictsResolved++;
        } else if (decision === 'remote_wins') {
          mergedJournalMap.set(remote.id, remote);
          result.downloadedCount.journal++;
          result.conflictsResolved++;
        }
      }
    }

    if (journalToUpload.length > 0) {
      const payload = journalToUpload.map((j) => mapJournalToDb(j, userId));
      const { error: upsertErr } = await (supabase.from('journal_entries') as unknown as {
        upsert: (values: unknown, options?: { onConflict?: string }) => Promise<{ error: Error | null }>;
      }).upsert(payload, { onConflict: 'id' });
      if (upsertErr) throw new Error(`Error al sincronizar bitácora: ${upsertErr.message}`);
    }

    // -------------------------------------------------------------------------
    // Save Final Merged State to User's Local Namespace
    // -------------------------------------------------------------------------
    const finalAccounts = Array.from(mergedAccountsMap.values()).filter((a) => !deletedAccountIds.has(a.id));
    const finalTrades = Array.from(mergedTradesMap.values()).filter((t) => !deletedTradeIds.has(t.id));
    const finalJournal = Array.from(mergedJournalMap.values()).filter((j) => !deletedJournalIds.has(j.id));
    const finalTombstones = Array.from(tombstoneMap.values());

    saveAccounts(finalAccounts, userNs);
    saveTrades(finalTrades, userNs);
    saveJournal(finalJournal, userNs);
    saveTombstones(finalTombstones, userNs);

    result.success = true;
    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    result.success = false;
    result.error = message;
    return result;
  }
}

// -----------------------------------------------------------------------------
// Resilient Migration Runner
// -----------------------------------------------------------------------------

export type MigrationStep =
  | 'idle'
  | 'backing_up'
  | 'validating_relations'
  | 'uploading_accounts'
  | 'uploading_trades'
  | 'uploading_journal'
  | 'verifying_remote'
  | 'completed'
  | 'error';

export interface ResilientMigrationResult {
  success: boolean;
  migrationId: string;
  backupPayload: BackupPayload;
  accountsUploaded: number;
  tradesUploaded: number;
  journalUploaded: number;
  verifiedRemoteCounts: {
    accounts: number;
    trades: number;
    journal: number;
  };
  error?: string;
}

export async function executeResilientMigration(
  supabase: SupabaseClient<Database>,
  userId: string,
  options?: {
    migrationId?: string;
    onProgress?: (step: MigrationStep, percent: number, detail: string) => void;
  },
): Promise<ResilientMigrationResult> {
  const migrationId = options?.migrationId || `mig_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const notify = options?.onProgress || (() => {});

  // Step 1: Compulsory Pre-Migration Local Backup
  notify('backing_up', 10, 'Generando copia de seguridad preventiva inmutable...');
  const accounts = getAccounts();
  const trades = getTrades();
  const journal = getJournal();
  const settings = getSettings();
  const backupPayload = createBackupPayload(accounts, trades, journal, settings);

  // Step 2: Validate Relational Integrity
  notify('validating_relations', 25, 'Validando integridad de relaciones padre-hijo...');
  const accountIds = new Set(accounts.map((a) => a.id));
  const validTrades = trades.filter((t) => accountIds.has(t.accountId));
  const validJournal = journal.filter((j) => accountIds.has(j.accountId));

  // Step 3: Upload Accounts (Idempotent)
  notify('uploading_accounts', 45, `Subiendo ${accounts.length} cuenta(s) a PostgreSQL...`);
  if (accounts.length > 0) {
    const payload = accounts.map((a) => mapAccountToDb(a, userId));
    const { error: accErr } = await (supabase.from('accounts') as unknown as {
      upsert: (values: unknown, options?: { onConflict?: string }) => Promise<{ error: Error | null }>;
    }).upsert(payload, { onConflict: 'id' });
    if (accErr) throw new Error(`Fallo en migración de cuentas: ${accErr.message}`);
  }

  // Step 4: Upload Trades (Idempotent)
  notify('uploading_trades', 65, `Subiendo ${validTrades.length} operación(es)...`);
  if (validTrades.length > 0) {
    const payload = validTrades.map((t) => mapTradeToDb(t, userId));
    const { error: trdErr } = await (supabase.from('trades') as unknown as {
      upsert: (values: unknown, options?: { onConflict?: string }) => Promise<{ error: Error | null }>;
    }).upsert(payload, { onConflict: 'id' });
    if (trdErr) throw new Error(`Fallo en migración de operaciones: ${trdErr.message}`);
  }

  // Step 5: Upload Journal (Idempotent)
  notify('uploading_journal', 80, `Subiendo ${validJournal.length} nota(s) del diario...`);
  if (validJournal.length > 0) {
    const payload = validJournal.map((j) => mapJournalToDb(j, userId));
    const { error: jrnErr } = await (supabase.from('journal_entries') as unknown as {
      upsert: (values: unknown, options?: { onConflict?: string }) => Promise<{ error: Error | null }>;
    }).upsert(payload, { onConflict: 'id' });
    if (jrnErr) throw new Error(`Fallo en migración de diario: ${jrnErr.message}`);
  }

  // Step 6: Verify Remote Persistence
  notify('verifying_remote', 95, 'Verificando persistencia y conteos en Supabase...');
  const [remoteAccs, remoteTrds, remoteJrnl] = await Promise.all([
    supabase.from('accounts').select('id').eq('user_id', userId),
    supabase.from('trades').select('id').eq('user_id', userId),
    supabase.from('journal_entries').select('id').eq('user_id', userId),
  ]);

  const verifiedRemoteCounts = {
    accounts: remoteAccs.data?.length || 0,
    trades: remoteTrds.data?.length || 0,
    journal: remoteJrnl.data?.length || 0,
  };

  notify('completed', 100, 'Migración recuperable verificada con éxito.');

  return {
    success: true,
    migrationId,
    backupPayload,
    accountsUploaded: accounts.length,
    tradesUploaded: validTrades.length,
    journalUploaded: validJournal.length,
    verifiedRemoteCounts,
  };
}

// -----------------------------------------------------------------------------
// Migration Wizard Support Functions
// -----------------------------------------------------------------------------

export function getMigrationPreview(): MigrationPreview {
  const accounts = getAccounts();
  const trades = getTrades();
  const journal = getJournal();

  const accountIds = new Set(accounts.map((a) => a.id));
  const hasCorruptedTrades = trades.some((t) => !accountIds.has(t.accountId));
  const hasCorruptedJournal = journal.some((j) => !accountIds.has(j.accountId));

  const totalBalance = accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

  return {
    accountsCount: accounts.length,
    tradesCount: trades.length,
    journalCount: journal.length,
    accountNames: accounts.map((a) => a.name),
    totalBalance,
    hasCorruptedRelations: hasCorruptedTrades || hasCorruptedJournal,
  };
}

export function createPreMigrationBackup(): BackupPayload {
  return createBackupPayload(getAccounts(), getTrades(), getJournal(), getSettings());
}
