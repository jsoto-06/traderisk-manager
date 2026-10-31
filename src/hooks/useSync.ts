'use client';

// =============================================================================
// TradeRisk Manager — Reactive Cloud Synchronization Hook
// =============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  performSync,
  getMigrationPreview,
  createPreMigrationBackup,
  type SyncState,
  type SyncResult,
} from '@/lib/sync/sync-engine';

const SYNC_KEY = 'trm_last_synced_at';

export function useSync() {
  const { user, isConfigured } = useAuth();
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem(SYNC_KEY);
    }
    return null;
  });
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const isSyncingRef = useRef(false);

  const triggerSync = useCallback(async (): Promise<SyncResult> => {
    if (!isConfigured || !user) {
      return {
        success: false,
        uploadedCount: { accounts: 0, trades: 0, journal: 0 },
        downloadedCount: { accounts: 0, trades: 0, journal: 0 },
        deletedCount: { accounts: 0, trades: 0, journal: 0 },
        conflictsResolved: 0,
        error: 'Usuario no autenticado o Supabase no configurado.',
      };
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSyncState('offline');
      return {
        success: false,
        uploadedCount: { accounts: 0, trades: 0, journal: 0 },
        downloadedCount: { accounts: 0, trades: 0, journal: 0 },
        deletedCount: { accounts: 0, trades: 0, journal: 0 },
        conflictsResolved: 0,
        error: 'Sin conexión a internet (modo offline).',
      };
    }

    if (isSyncingRef.current) {
      return {
        success: false,
        uploadedCount: { accounts: 0, trades: 0, journal: 0 },
        downloadedCount: { accounts: 0, trades: 0, journal: 0 },
        deletedCount: { accounts: 0, trades: 0, journal: 0 },
        conflictsResolved: 0,
        error: 'Sincronización ya en curso.',
      };
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setSyncState('offline');
      return {
        success: false,
        uploadedCount: { accounts: 0, trades: 0, journal: 0 },
        downloadedCount: { accounts: 0, trades: 0, journal: 0 },
        deletedCount: { accounts: 0, trades: 0, journal: 0 },
        conflictsResolved: 0,
        error: 'Cliente Supabase no disponible.',
      };
    }

    isSyncingRef.current = true;
    setSyncState('syncing');

    try {
      const res = await performSync(supabase, user.id);
      setLastResult(res);

      if (res.success && res.syncedAt) {
        setSyncState('synced');
        setLastSyncedAt(res.syncedAt);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(SYNC_KEY, res.syncedAt);
          // Notify storage listeners that accounts/trades were updated from cloud
          window.dispatchEvent(new Event('trm-storage-update'));
        }
      } else {
        setSyncState('error');
      }

      return res;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error inesperado';
      setSyncState('error');
      const failResult: SyncResult = {
        success: false,
        uploadedCount: { accounts: 0, trades: 0, journal: 0 },
        downloadedCount: { accounts: 0, trades: 0, journal: 0 },
        deletedCount: { accounts: 0, trades: 0, journal: 0 },
        conflictsResolved: 0,
        error: errorMsg,
      };
      setLastResult(failResult);
      return failResult;
    } finally {
      isSyncingRef.current = false;
    }
  }, [isConfigured, user]);

  // Automatically sync when user logs in or when coming back online
  useEffect(() => {
    if (!user || !isConfigured) {
      return;
    }

    // Defer initial sync to avoid synchronous render cascade
    const initTimer = setTimeout(() => {
      triggerSync();
    }, 0);

    const handleOnline = () => {
      triggerSync();
    };

    const handleOffline = () => {
      setSyncState('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic sync every 5 minutes while active
    const intervalId = setInterval(() => {
      if (navigator.onLine && !isSyncingRef.current) {
        triggerSync();
      }
    }, 5 * 60 * 1000);

    return () => {
      clearTimeout(initTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(intervalId);
    };
  }, [user, isConfigured, triggerSync]);

  return {
    syncState,
    lastSyncedAt,
    lastSyncTime: lastSyncedAt,
    lastResult,
    triggerSync,
    syncNow: triggerSync,
    isSyncing: syncState === 'syncing',
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    getMigrationPreview,
    createPreMigrationBackup,
  };
}
