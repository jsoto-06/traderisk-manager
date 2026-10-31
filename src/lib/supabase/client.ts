// =============================================================================
// TradeRisk Manager — Supabase Browser Client (Safe Client-Side Singleton)
// =============================================================================

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

let browserClient: SupabaseClient<Database> | null = null;

/**
 * Checks whether Supabase environment variables are properly configured.
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(
    url &&
    anonKey &&
    url.startsWith('http') &&
    anonKey.length > 20 &&
    !url.includes('your-project')
  );
}

/**
 * Returns the browser-side Supabase client singleton.
 * Returns null if Supabase environment variables are missing,
 * guaranteeing seamless offline / LocalStorage fallback.
 */
export function getSupabaseBrowserClient(): SupabaseClient<Database> | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  if (!browserClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    browserClient = createBrowserClient<Database>(url, anonKey);
  }

  return browserClient;
}
