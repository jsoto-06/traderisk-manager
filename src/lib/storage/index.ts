// =============================================================================
// TradeRisk Manager — Storage Layer (Secure Client-Side LocalStorage with Namespaces & Tombstones)
// =============================================================================

import type { Account, Trade, JournalEntry, Settings, StorageProvider, Tombstone } from '@/lib/types';
import {
  AccountSchema,
  TradeSchema,
  JournalEntrySchema,
} from '@/lib/validation/schemas';
import type { BackupPayload } from './backup-spec';
import {
  DEMO_ACCOUNT,
  DEMO_TRADES,
  DEMO_JOURNAL,
  DEMO_SETTINGS,
  DEMO_ACCOUNT_ID,
} from './demo-data';

export {
  DEMO_ACCOUNT,
  DEMO_TRADES,
  DEMO_JOURNAL,
  DEMO_SETTINGS,
  DEMO_ACCOUNT_ID,
};

export const STORAGE_KEYS = {
  ACCOUNTS: 'trm_accounts',
  TRADES: 'trm_trades',
  JOURNAL: 'trm_journal',
  SETTINGS: 'trm_settings',
  TOMBSTONES: 'trm_tombstones',
  ACTIVE_ACCOUNT: 'trm_active_account_id',
  CORRUPTION_REPORT: 'trm_corruption_report',
  QUARANTINE_PREFIX: 'trm_quarantine_',
} as const;

export interface StorageCorruptionReport {
  detectedAt: string;
  key: string;
  error: string;
  quarantineKey: string;
  rawSample?: string;
}

// ---------------------------------------------------------------------------
// User Namespace Isolation Helper
// ---------------------------------------------------------------------------

let activeNamespace = 'guest';

/**
 * Sets the active storage namespace.
 * - If userId is null/undefined/empty: switches to 'guest'.
 * - If userId is provided: switches to 'user_<userId>'.
 */
export function setStorageNamespace(userId?: string | null): void {
  activeNamespace = userId && userId.trim() ? `user_${userId.trim()}` : 'guest';
}

export function getStorageNamespace(): string {
  return activeNamespace;
}

/**
 * Resolves the physical LocalStorage key considering the active namespace.
 * In 'guest' mode, retains legacy keys ('trm_accounts') for 100% backward compatibility.
 * In authenticated mode, scopes keys to 'trm_user_<userId>_<entity>'.
 */
export function getStorageKey(baseKey: string, namespace: string = activeNamespace): string {
  if (namespace === 'guest') {
    return baseKey.startsWith('trm_') ? baseKey : `trm_${baseKey}`;
  }
  const cleanBase = baseKey.replace(/^trm_/, '');
  return `trm_${namespace}_${cleanBase}`;
}

class LocalStorageProvider implements StorageProvider {
  get<T>(key: string): T | null {
    if (typeof window === 'undefined') return null;
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : null;
    } catch (e) {
      console.error(`Error reading ${key} from localStorage:`, e);
      return null;
    }
  }

  set<T>(key: string, value: T): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(`Error writing ${key} to localStorage:`, e);
    }
  }

  remove(key: string): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      console.error(`Error removing ${key} from localStorage:`, e);
    }
  }

  clear(): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.clear();
    } catch (e) {
      console.error('Error clearing localStorage:', e);
    }
  }
}

export const storage: StorageProvider = new LocalStorageProvider();

// ---------------------------------------------------------------------------
// Quarantine & Corruption Reporting Helpers
// ---------------------------------------------------------------------------

function quarantineCorruption(key: string, rawData: string, errorMessage: string): void {
  if (typeof window === 'undefined') return;
  const timestamp = Date.now();
  const quarantineKey = `${STORAGE_KEYS.QUARANTINE_PREFIX}${key}_${timestamp}`;
  try {
    window.localStorage.setItem(quarantineKey, rawData);
    const report: StorageCorruptionReport = {
      detectedAt: new Date().toISOString(),
      key,
      error: errorMessage,
      quarantineKey,
      rawSample: rawData.slice(0, 150),
    };
    window.localStorage.setItem(STORAGE_KEYS.CORRUPTION_REPORT, JSON.stringify(report));
    console.warn(
      `[TradeRisk Storage] Corrupted data in "${key}" preserved in quarantine key "${quarantineKey}".`,
      errorMessage,
    );
  } catch (err) {
    console.error('Failed to write quarantine entry to localStorage:', err);
  }
}

export function getCorruptionReport(): StorageCorruptionReport | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.CORRUPTION_REPORT);
    return raw ? (JSON.parse(raw) as StorageCorruptionReport) : null;
  } catch {
    return null;
  }
}

export function clearCorruptionReport(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEYS.CORRUPTION_REPORT);
  } catch {}
}

// ---------------------------------------------------------------------------
// Tombstone Tracking for Soft-Deletes
// ---------------------------------------------------------------------------

export function getTombstones(namespace: string = activeNamespace): Tombstone[] {
  const key = getStorageKey(STORAGE_KEYS.TOMBSTONES, namespace);
  return storage.get<Tombstone[]>(key) || [];
}

export function saveTombstone(tombstone: Tombstone, namespace: string = activeNamespace): void {
  const key = getStorageKey(STORAGE_KEYS.TOMBSTONES, namespace);
  const existing = getTombstones(namespace);
  const filtered = existing.filter((t) => t.id !== tombstone.id);
  storage.set(key, [...filtered, tombstone]);
}

export function saveTombstones(newTombstones: Tombstone[], namespace: string = activeNamespace): void {
  const key = getStorageKey(STORAGE_KEYS.TOMBSTONES, namespace);
  const existing = getTombstones(namespace);
  const map = new Map(existing.map((t) => [t.id, t]));
  for (const t of newTombstones) {
    map.set(t.id, t);
  }
  storage.set(key, Array.from(map.values()));
}

export function removeTombstone(id: string, namespace: string = activeNamespace): void {
  const key = getStorageKey(STORAGE_KEYS.TOMBSTONES, namespace);
  const existing = getTombstones(namespace);
  storage.set(key, existing.filter((t) => t.id !== id));
}

export function clearTombstones(namespace: string = activeNamespace): void {
  const key = getStorageKey(STORAGE_KEYS.TOMBSTONES, namespace);
  storage.remove(key);
}

// ---------------------------------------------------------------------------
// Account CRUD with Non-Destructive Quarantine & Namespace Support
// ---------------------------------------------------------------------------

export function getAccounts(namespace: string = activeNamespace): Account[] {
  if (typeof window === 'undefined') return [DEMO_ACCOUNT];

  const key = getStorageKey(STORAGE_KEYS.ACCOUNTS, namespace);
  const raw = window.localStorage.getItem(key);

  if (raw === null) {
    // Only initialize demo data for guest mode; authenticated spaces start uninitialized
    if (namespace === 'guest') {
      initializeDemoData();
      return storage.get<Account[]>(key) || [DEMO_ACCOUNT];
    }
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    const validation = AccountSchema.array().safeParse(parsed);
    if (!validation.success) {
      quarantineCorruption(
        key,
        raw,
        `Validation failed: ${validation.error.issues.map((i) => i.message).join(', ')}`,
      );
      return namespace === 'guest' ? [DEMO_ACCOUNT] : [];
    }
    if (validation.data.length === 0 && namespace === 'guest') {
      return [DEMO_ACCOUNT];
    }
    return validation.data;
  } catch (e) {
    quarantineCorruption(
      key,
      raw,
      `JSON Syntax Error: ${e instanceof Error ? e.message : 'Malformed JSON'}`,
    );
    return namespace === 'guest' ? [DEMO_ACCOUNT] : [];
  }
}

export function saveAccounts(accounts: Account[], namespace: string = activeNamespace): void {
  const key = getStorageKey(STORAGE_KEYS.ACCOUNTS, namespace);
  const now = new Date().toISOString();
  const stamped = accounts.map((a) => ({
    ...a,
    createdAt: a.createdAt || now,
    updatedAt: a.updatedAt || now,
    version: a.version != null ? a.version : 1,
  }));
  storage.set(key, stamped);
}

export function getAccountById(id: string, namespace: string = activeNamespace): Account | undefined {
  const accounts = getAccounts(namespace);
  return accounts.find((a) => a.id === id);
}

// ---------------------------------------------------------------------------
// Trades CRUD with Non-Destructive Quarantine & Namespace Support
// ---------------------------------------------------------------------------

export function getTrades(accountId?: string, namespace: string = activeNamespace): Trade[] {
  if (typeof window === 'undefined') return DEMO_TRADES;

  const key = getStorageKey(STORAGE_KEYS.TRADES, namespace);
  const raw = window.localStorage.getItem(key);

  if (raw === null) {
    if (namespace === 'guest') {
      initializeDemoData();
      const loaded = storage.get<Trade[]>(key) || DEMO_TRADES;
      return accountId ? loaded.filter((t) => t.accountId === accountId) : loaded;
    }
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    const validation = TradeSchema.array().safeParse(parsed);
    if (!validation.success) {
      quarantineCorruption(
        key,
        raw,
        `Validation failed: ${validation.error.issues.map((i) => i.message).join(', ')}`,
      );
      return [];
    }
    return accountId ? validation.data.filter((t) => t.accountId === accountId) : validation.data;
  } catch (e) {
    quarantineCorruption(
      key,
      raw,
      `JSON Syntax Error: ${e instanceof Error ? e.message : 'Malformed JSON'}`,
    );
    return [];
  }
}

export function saveTrades(trades: Trade[], namespace: string = activeNamespace): void {
  const key = getStorageKey(STORAGE_KEYS.TRADES, namespace);
  const now = new Date().toISOString();
  const stamped = trades.map((t) => ({
    ...t,
    createdAt: t.createdAt || t.openDate || now,
    updatedAt: t.updatedAt || now,
    version: t.version != null ? t.version : 1,
  }));
  storage.set(key, stamped);
}

// ---------------------------------------------------------------------------
// Journal CRUD with Non-Destructive Quarantine & Namespace Support
// ---------------------------------------------------------------------------

export function getJournal(accountId?: string, namespace: string = activeNamespace): JournalEntry[] {
  if (typeof window === 'undefined') return DEMO_JOURNAL;

  const key = getStorageKey(STORAGE_KEYS.JOURNAL, namespace);
  const raw = window.localStorage.getItem(key);

  if (raw === null) {
    if (namespace === 'guest') {
      initializeDemoData();
      const loaded = storage.get<JournalEntry[]>(key) || DEMO_JOURNAL;
      return accountId ? loaded.filter((j) => j.accountId === accountId) : loaded;
    }
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    const validation = JournalEntrySchema.array().safeParse(parsed);
    if (!validation.success) {
      quarantineCorruption(
        key,
        raw,
        `Validation failed: ${validation.error.issues.map((i) => i.message).join(', ')}`,
      );
      return [];
    }
    return accountId ? validation.data.filter((j) => j.accountId === accountId) : validation.data;
  } catch (e) {
    quarantineCorruption(
      key,
      raw,
      `JSON Syntax Error: ${e instanceof Error ? e.message : 'Malformed JSON'}`,
    );
    return [];
  }
}

export function saveJournal(entries: JournalEntry[], namespace: string = activeNamespace): void {
  const key = getStorageKey(STORAGE_KEYS.JOURNAL, namespace);
  const now = new Date().toISOString();
  const stamped = entries.map((j) => ({
    ...j,
    createdAt: j.createdAt || j.date || now,
    updatedAt: j.updatedAt || now,
    version: j.version != null ? j.version : 1,
  }));
  storage.set(key, stamped);
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function getSettings(namespace: string = activeNamespace): Settings {
  const key = getStorageKey(STORAGE_KEYS.SETTINGS, namespace);
  const settings = storage.get<Settings>(key);
  if (!settings) {
    storage.set(key, DEMO_SETTINGS);
    return DEMO_SETTINGS;
  }
  return settings;
}

export function saveSettings(settings: Settings, namespace: string = activeNamespace): void {
  const key = getStorageKey(STORAGE_KEYS.SETTINGS, namespace);
  storage.set(key, settings);
}

// ---------------------------------------------------------------------------
// Active Account Key per Namespace
// ---------------------------------------------------------------------------

export function getActiveAccountIdKey(namespace: string = activeNamespace): string {
  return getStorageKey(STORAGE_KEYS.ACTIVE_ACCOUNT, namespace);
}

// ---------------------------------------------------------------------------
// Guest Data Import & Detection
// ---------------------------------------------------------------------------

export function hasGuestDataToImport(): boolean {
  if (typeof window === 'undefined') return false;
  const guestAccounts = getAccounts('guest');
  const guestTrades = getTrades(undefined, 'guest');
  if (guestAccounts.length > 1) return true;
  if (guestAccounts.length === 1 && guestAccounts[0].id !== DEMO_ACCOUNT_ID) return true;
  if (guestTrades.length > DEMO_TRADES.length) return true;
  return false;
}

export function importGuestDataToUser(userId: string): {
  accountsAdded: number;
  tradesAdded: number;
  journalAdded: number;
} {
  const userNs = `user_${userId}`;
  const guestAccounts = getAccounts('guest');
  const guestTrades = getTrades(undefined, 'guest');
  const guestJournal = getJournal(undefined, 'guest');

  const now = new Date().toISOString();
  const accountsToSave = guestAccounts.map((a) => ({
    ...a,
    updatedAt: now,
    version: (a.version || 0) + 1,
  }));
  const tradesToSave = guestTrades.map((t) => ({
    ...t,
    createdAt: t.createdAt || t.openDate || now,
    updatedAt: now,
    version: (t.version || 0) + 1,
  }));
  const journalToSave = guestJournal.map((j) => ({
    ...j,
    createdAt: j.createdAt || j.date || now,
    updatedAt: now,
    version: (j.version || 0) + 1,
  }));

  saveAccounts(accountsToSave, userNs);
  saveTrades(tradesToSave, userNs);
  saveJournal(journalToSave, userNs);

  return {
    accountsAdded: accountsToSave.length,
    tradesAdded: tradesToSave.length,
    journalAdded: journalToSave.length,
  };
}

// ---------------------------------------------------------------------------
// Transactional Backup Application (Replace vs Merge)
// ---------------------------------------------------------------------------

export interface ApplyBackupResult {
  success: boolean;
  accountsAdded: number;
  tradesAdded: number;
  journalAdded: number;
  error?: string;
}

export function applyBackup(
  payload: BackupPayload,
  mode: 'replace' | 'merge' = 'replace',
  namespace: string = activeNamespace,
): ApplyBackupResult {
  try {
    if (mode === 'replace') {
      saveAccounts(payload.data.accounts, namespace);
      saveTrades(payload.data.trades, namespace);
      saveJournal(payload.data.journal, namespace);
      saveSettings(payload.data.settings, namespace);
      clearCorruptionReport();
      return {
        success: true,
        accountsAdded: payload.data.accounts.length,
        tradesAdded: payload.data.trades.length,
        journalAdded: payload.data.journal.length,
      };
    }

    // Merge mode
    const currentAccounts = getAccounts(namespace);
    const currentTrades = getTrades(undefined, namespace);
    const currentJournal = getJournal(undefined, namespace);

    const accountMap = new Map<string, Account>(currentAccounts.map((a) => [a.id, a]));
    let accountsAdded = 0;
    for (const acc of payload.data.accounts) {
      if (!accountMap.has(acc.id)) {
        accountMap.set(acc.id, acc);
        accountsAdded++;
      }
    }
    const mergedAccounts = Array.from(accountMap.values());

    const tradeMap = new Map<string, Trade>(currentTrades.map((t) => [t.id, t]));
    let tradesAdded = 0;
    for (const trd of payload.data.trades) {
      if (!tradeMap.has(trd.id) && accountMap.has(trd.accountId)) {
        tradeMap.set(trd.id, trd);
        tradesAdded++;
      }
    }
    const mergedTrades = Array.from(tradeMap.values());

    const journalMap = new Map<string, JournalEntry>(currentJournal.map((j) => [j.id, j]));
    let journalAdded = 0;
    for (const jnl of payload.data.journal) {
      if (!journalMap.has(jnl.id) && accountMap.has(jnl.accountId)) {
        journalMap.set(jnl.id, jnl);
        journalAdded++;
      }
    }
    const mergedJournal = Array.from(journalMap.values());

    saveAccounts(mergedAccounts, namespace);
    saveTrades(mergedTrades, namespace);
    saveJournal(mergedJournal, namespace);
    clearCorruptionReport();

    return {
      success: true,
      accountsAdded,
      tradesAdded,
      journalAdded,
    };
  } catch (e) {
    return {
      success: false,
      accountsAdded: 0,
      tradesAdded: 0,
      journalAdded: 0,
      error: e instanceof Error ? e.message : 'Error applying backup',
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers & Demo State Management
// ---------------------------------------------------------------------------

export function isDemo(accountId: string): boolean {
  return accountId === DEMO_ACCOUNT_ID || accountId.startsWith('demo-');
}

export function initializeDemoData(force: boolean = false, namespace: string = activeNamespace): void {
  if (typeof window === 'undefined') return;

  const keyAccounts = getStorageKey(STORAGE_KEYS.ACCOUNTS, namespace);
  const existingAccounts = storage.get<Account[]>(keyAccounts);
  if (force || !existingAccounts || existingAccounts.length === 0) {
    storage.set(keyAccounts, [DEMO_ACCOUNT]);
  }

  const keyTrades = getStorageKey(STORAGE_KEYS.TRADES, namespace);
  const existingTrades = storage.get<Trade[]>(keyTrades);
  if (force || !existingTrades) {
    storage.set(keyTrades, DEMO_TRADES);
  }

  const keyJournal = getStorageKey(STORAGE_KEYS.JOURNAL, namespace);
  const existingJournal = storage.get<JournalEntry[]>(keyJournal);
  if (force || !existingJournal) {
    storage.set(keyJournal, DEMO_JOURNAL);
  }

  const keySettings = getStorageKey(STORAGE_KEYS.SETTINGS, namespace);
  const existingSettings = storage.get<Settings>(keySettings);
  if (force || !existingSettings) {
    storage.set(keySettings, DEMO_SETTINGS);
  }
}

export function resetDemoData(namespace: string = activeNamespace): void {
  initializeDemoData(true, namespace);
}

export function clearAllData(namespace: string = activeNamespace): void {
  const keys = [
    getStorageKey(STORAGE_KEYS.ACCOUNTS, namespace),
    getStorageKey(STORAGE_KEYS.TRADES, namespace),
    getStorageKey(STORAGE_KEYS.JOURNAL, namespace),
    getStorageKey(STORAGE_KEYS.SETTINGS, namespace),
    getStorageKey(STORAGE_KEYS.TOMBSTONES, namespace),
    getStorageKey(STORAGE_KEYS.ACTIVE_ACCOUNT, namespace),
  ];
  for (const k of keys) {
    storage.remove(k);
  }
}
