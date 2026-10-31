'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Account, Trade, JournalEntry, Settings } from '@/lib/types';
import {
  getAccounts,
  saveAccounts,
  getTrades,
  saveTrades,
  getJournal,
  saveJournal,
  getSettings,
  saveSettings,
  resetDemoData,
  clearAllData,
  DEMO_ACCOUNT_ID,
  getCorruptionReport,
  clearCorruptionReport,
  applyBackup,
  saveTombstone,
  getActiveAccountIdKey,
  type StorageCorruptionReport,
} from '@/lib/storage';
import { createBackupPayload, type BackupPayload } from '@/lib/storage/backup-spec';

const STORAGE_EVENT = 'trm-storage-update';

function notifyStorageUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(STORAGE_EVENT));
  }
}

export function useStorage() {
  const [isLoaded, setIsLoaded] = useState(false);

  const [accounts, setAccounts] = useState<Account[]>(() => {
    if (typeof window !== 'undefined') {
      return getAccounts();
    }
    return [];
  });

  const [settings, setSettings] = useState<Settings>(() => {
    if (typeof window !== 'undefined') {
      return getSettings();
    }
    return {
      language: 'es',
      theme: 'dark',
      defaultAccountId: DEMO_ACCOUNT_ID,
    };
  });

  const [activeAccountId, setActiveAccountId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const savedActiveId = window.localStorage.getItem(getActiveAccountIdKey());
      const accs = getAccounts();
      if (savedActiveId && accs.some((a) => a.id === savedActiveId)) {
        return savedActiveId;
      }
      return accs[0]?.id || DEMO_ACCOUNT_ID;
    }
    return DEMO_ACCOUNT_ID;
  });

  const [trades, setTrades] = useState<Trade[]>(() => {
    if (typeof window !== 'undefined') {
      return getTrades();
    }
    return [];
  });

  const [journal, setJournal] = useState<JournalEntry[]>(() => {
    if (typeof window !== 'undefined') {
      return getJournal();
    }
    return [];
  });

  const [corruptionReport, setCorruptionReport] = useState<StorageCorruptionReport | null>(() => {
    if (typeof window !== 'undefined') {
      return getCorruptionReport();
    }
    return null;
  });

  const loadData = useCallback(() => {
    if (typeof window === 'undefined') return;

    const accs = getAccounts();
    const trds = getTrades();
    const jrnl = getJournal();
    const stt = getSettings();
    const report = getCorruptionReport();

    setAccounts(accs);
    setTrades(trds);
    setJournal(jrnl);
    setSettings(stt);
    setCorruptionReport(report);

    const savedActiveId = window.localStorage.getItem(getActiveAccountIdKey());
    const validActiveId =
      savedActiveId && accs.some((a) => a.id === savedActiveId)
        ? savedActiveId
        : accs.find((a) => a.id === stt.defaultAccountId)?.id || accs[0]?.id || DEMO_ACCOUNT_ID;

    setActiveAccountId(validActiveId);
  }, []);

  useEffect(() => {
    const handleUpdate = () => {
      loadData();
    };

    window.addEventListener(STORAGE_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);

    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 0);

    return () => {
      clearTimeout(timer);
      window.removeEventListener(STORAGE_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [loadData]);

  // Active account derived
  const activeAccount = useMemo(() => {
    return accounts.find((a) => a.id === activeAccountId) || accounts[0] || null;
  }, [accounts, activeAccountId]);

  // Filtered trades & journal for the active account
  const activeAccountTrades = useMemo(() => {
    if (!activeAccount) return [];
    return trades.filter((t) => t.accountId === activeAccount.id);
  }, [trades, activeAccount]);

  const activeAccountJournal = useMemo(() => {
    if (!activeAccount) return [];
    return journal.filter((j) => j.accountId === activeAccount.id);
  }, [journal, activeAccount]);

  // Account actions
  const selectAccount = useCallback((id: string) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(getActiveAccountIdKey(), id);
    }
    setActiveAccountId(id);
  }, []);

  const addAccount = useCallback(
    (newAccountData: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      const newAccount: Account = {
        ...newAccountData,
        id: `acc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        createdAt: now,
        updatedAt: now,
      };
      const updated = [...accounts, newAccount];
      saveAccounts(updated);
      selectAccount(newAccount.id);
      notifyStorageUpdate();
      return newAccount;
    },
    [accounts, selectAccount],
  );

  const updateAccount = useCallback(
    (updatedAccount: Account) => {
      const updated = accounts.map((a) =>
        a.id === updatedAccount.id
          ? { ...updatedAccount, updatedAt: new Date().toISOString() }
          : a,
      );
      saveAccounts(updated);
      notifyStorageUpdate();
    },
    [accounts],
  );

  const deleteAccount = useCallback(
    (id: string) => {
      if (accounts.length <= 1) return false;
      const now = new Date().toISOString();
      const updated = accounts.filter((a) => a.id !== id);
      saveAccounts(updated);

      // Record tombstone for deleted account
      saveTombstone({
        id,
        entity: 'account',
        deletedAt: now,
        updatedAt: now,
      });

      // Cascade cleanup: remove orphaned trades and record their tombstones
      const tradesToDelete = trades.filter((t) => t.accountId === id);
      const remainingTrades = trades.filter((t) => t.accountId !== id);
      saveTrades(remainingTrades);
      for (const t of tradesToDelete) {
        saveTombstone({
          id: t.id,
          entity: 'trade',
          deletedAt: now,
          updatedAt: now,
          accountId: id,
        });
      }

      // Cascade cleanup: remove orphaned journal entries and record their tombstones
      const journalToDelete = journal.filter((j) => j.accountId === id);
      const remainingJournal = journal.filter((j) => j.accountId !== id);
      saveJournal(remainingJournal);
      for (const j of journalToDelete) {
        saveTombstone({
          id: j.id,
          entity: 'journal',
          deletedAt: now,
          updatedAt: now,
          accountId: id,
        });
      }

      if (activeAccountId === id) {
        selectAccount(updated[0].id);
      }
      notifyStorageUpdate();
      return true;
    },
    [accounts, trades, journal, activeAccountId, selectAccount],
  );

  // Trade actions with audited double-entry balance accounting
  const addTrade = useCallback(
    (tradeData: Omit<Trade, 'id'>) => {
      const newTrade: Trade = {
        ...tradeData,
        id: `trade-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      };
      const updatedTrades = [newTrade, ...trades];
      saveTrades(updatedTrades);

      // If the trade is closed upon creation, adjust account balance by net result
      if (newTrade.status === 'closed' && newTrade.result != null) {
        const acc = accounts.find((a) => a.id === newTrade.accountId);
        if (acc) {
          const net = newTrade.result - (newTrade.commissions || 0);
          const updatedAcc: Account = {
            ...acc,
            balance: Number((acc.balance + net).toFixed(2)),
            equity: Number((acc.equity + net).toFixed(2)),
            updatedAt: new Date().toISOString(),
          };
          updateAccount(updatedAcc);
        }
      }

      notifyStorageUpdate();
      return newTrade;
    },
    [trades, accounts, updateAccount],
  );

  const updateTrade = useCallback(
    (updatedTrade: Trade) => {
      const oldTrade = trades.find((t) => t.id === updatedTrade.id);
      const updatedTrades = trades.map((t) => (t.id === updatedTrade.id ? updatedTrade : t));
      saveTrades(updatedTrades);

      if (oldTrade) {
        // Account transfer handling
        if (oldTrade.accountId !== updatedTrade.accountId) {
          // 1) Revert old trade from former account
          if (oldTrade.status === 'closed' && oldTrade.result != null) {
            const oldAcc = accounts.find((a) => a.id === oldTrade.accountId);
            if (oldAcc) {
              const oldNet = oldTrade.result - (oldTrade.commissions || 0);
              const updatedOldAcc: Account = {
                ...oldAcc,
                balance: Number((oldAcc.balance - oldNet).toFixed(2)),
                equity: Number((oldAcc.equity - oldNet).toFixed(2)),
                updatedAt: new Date().toISOString(),
              };
              updateAccount(updatedOldAcc);
            }
          }
          // 2) Apply new trade to target account
          if (updatedTrade.status === 'closed' && updatedTrade.result != null) {
            const newAcc = accounts.find((a) => a.id === updatedTrade.accountId);
            if (newAcc) {
              const newNet = updatedTrade.result - (updatedTrade.commissions || 0);
              const updatedNewAcc: Account = {
                ...newAcc,
                balance: Number((newAcc.balance + newNet).toFixed(2)),
                equity: Number((newAcc.equity + newNet).toFixed(2)),
                updatedAt: new Date().toISOString(),
              };
              updateAccount(updatedNewAcc);
            }
          }
        } else {
          // Same account update: calculate delta
          const acc = accounts.find((a) => a.id === updatedTrade.accountId);
          if (acc) {
            const oldNet =
              oldTrade.status === 'closed' && oldTrade.result != null
                ? oldTrade.result - (oldTrade.commissions || 0)
                : 0;

            const newNet =
              updatedTrade.status === 'closed' && updatedTrade.result != null
                ? updatedTrade.result - (updatedTrade.commissions || 0)
                : 0;

            const diff = newNet - oldNet;
            if (diff !== 0) {
              const updatedAcc: Account = {
                ...acc,
                balance: Number((acc.balance + diff).toFixed(2)),
                equity: Number((acc.equity + diff).toFixed(2)),
                updatedAt: new Date().toISOString(),
              };
              updateAccount(updatedAcc);
            }
          }
        }
      }

      notifyStorageUpdate();
    },
    [trades, accounts, updateAccount],
  );

  const deleteTrade = useCallback(
    (id: string) => {
      const now = new Date().toISOString();
      const tradeToDelete = trades.find((t) => t.id === id);
      const updatedTrades = trades.filter((t) => t.id !== id);
      saveTrades(updatedTrades);

      saveTombstone({
        id,
        entity: 'trade',
        deletedAt: now,
        updatedAt: now,
        accountId: tradeToDelete?.accountId,
      });

      // Revert closed trade result if it was closed
      if (tradeToDelete && tradeToDelete.status === 'closed' && tradeToDelete.result != null) {
        const acc = accounts.find((a) => a.id === tradeToDelete.accountId);
        if (acc) {
          const net = tradeToDelete.result - (tradeToDelete.commissions || 0);
          const updatedAcc: Account = {
            ...acc,
            balance: Number((acc.balance - net).toFixed(2)),
            equity: Number((acc.equity - net).toFixed(2)),
            updatedAt: new Date().toISOString(),
          };
          updateAccount(updatedAcc);
        }
      }

      notifyStorageUpdate();
    },
    [trades, accounts, updateAccount],
  );

  // Journal actions
  const addJournalEntry = useCallback(
    (entryData: Omit<JournalEntry, 'id'>) => {
      const newEntry: JournalEntry = {
        ...entryData,
        id: `journal-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      };
      const updated = [newEntry, ...journal];
      saveJournal(updated);
      notifyStorageUpdate();
      return newEntry;
    },
    [journal],
  );

  const updateJournalEntry = useCallback(
    (updatedEntry: JournalEntry) => {
      const updated = journal.map((j) => (j.id === updatedEntry.id ? updatedEntry : j));
      saveJournal(updated);
      notifyStorageUpdate();
    },
    [journal],
  );

  const deleteJournalEntry = useCallback(
    (id: string) => {
      const now = new Date().toISOString();
      const entryToDelete = journal.find((j) => j.id === id);
      const updated = journal.filter((j) => j.id !== id);
      saveJournal(updated);

      saveTombstone({
        id,
        entity: 'journal',
        deletedAt: now,
        updatedAt: now,
        accountId: entryToDelete?.accountId,
      });

      notifyStorageUpdate();
    },
    [journal],
  );

  // Settings actions
  const updateSettings = useCallback((newSettings: Settings) => {
    saveSettings(newSettings);
    setSettings(newSettings);
    notifyStorageUpdate();
  }, []);

  // Demo reset
  const resetDemo = useCallback(() => {
    resetDemoData();
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('trm_active_account_id', DEMO_ACCOUNT_ID);
    }
    loadData();
    notifyStorageUpdate();
  }, [loadData]);

  const clearAll = useCallback(() => {
    clearAllData();
    loadData();
    notifyStorageUpdate();
  }, [loadData]);

  // Backup and restore actions
  const exportBackup = useCallback((): BackupPayload => {
    return createBackupPayload(accounts, trades, journal, settings);
  }, [accounts, trades, journal, settings]);

  const importBackup = useCallback(
    (payload: BackupPayload, mode: 'replace' | 'merge' = 'replace') => {
      const result = applyBackup(payload, mode);
      if (result.success) {
        loadData();
        notifyStorageUpdate();
      }
      return result;
    },
    [loadData],
  );

  const clearCorruption = useCallback(() => {
    clearCorruptionReport();
    setCorruptionReport(null);
    notifyStorageUpdate();
  }, []);

  return {
    isLoaded,
    accounts,
    activeAccountId,
    activeAccount,
    trades,
    activeAccountTrades,
    journal,
    activeAccountJournal,
    settings,
    corruptionReport,
    selectAccount,
    addAccount,
    updateAccount,
    deleteAccount,
    addTrade,
    updateTrade,
    deleteTrade,
    addJournalEntry,
    updateJournalEntry,
    deleteJournalEntry,
    updateSettings,
    resetDemo,
    clearAll,
    exportBackup,
    importBackup,
    clearCorruption,
  };
}
