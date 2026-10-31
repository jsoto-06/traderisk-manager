-- =============================================================================
-- TradeRisk Manager — PostgreSQL Production Security & Trigger Hardening (Fase 4.2)
-- Migration: 20261031_phase_4_2_production_hardening.sql
-- Description:
-- 1. Universal versioning across all tables (profiles, user_settings).
-- 2. Fixed handle_updated_at() to support tables with or without version and
--    preserve client-provided timestamps during offline sync without drift.
-- 3. Hardened RLS policies on profiles (explicit INSERT + WITH CHECK on UPDATE).
-- 4. High-performance composite indices for multi-tenant isolation.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. UNIVERSAL VERSIONING ON PROFILES & USER SETTINGS
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.user_settings 
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- -----------------------------------------------------------------------------
-- 2. HARDENED TRIGGER FUNCTION: handle_updated_at()
-- -----------------------------------------------------------------------------
-- - Preserves client-supplied updated_at during offline sync to prevent drift.
-- - Automatically maintains versioning without throwing on missing columns.
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, auth, pg_temp
LANGUAGE plpgsql AS $$
BEGIN
    -- Only set updated_at to now() if not explicitly provided or unchanged by client
    IF NEW.updated_at IS NULL OR (TG_OP = 'UPDATE' AND NEW.updated_at = OLD.updated_at) THEN
        NEW.updated_at = timezone('utc'::text, now());
    END IF;

    -- Manage version column safely (supports tables with or without version)
    BEGIN
        IF (TG_OP = 'UPDATE') THEN
            IF NEW.version IS NULL OR NEW.version <= OLD.version THEN
                NEW.version = COALESCE(OLD.version, 1) + 1;
            END IF;
        ELSIF (TG_OP = 'INSERT') THEN
            IF NEW.version IS NULL THEN
                NEW.version = 1;
            END IF;
        END IF;
    EXCEPTION WHEN undefined_column THEN
        -- Graceful fallback for any table lacking a version column
        NULL;
    END;

    RETURN NEW;
END;
$$;

-- Restrict execution to authenticated users and service_role
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_updated_at() TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. PROFILES RLS POLICY HARDENING
-- -----------------------------------------------------------------------------
-- Allow authenticated users to insert their own profile record if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'Users can insert own profile'
    ) THEN
        CREATE POLICY "Users can insert own profile" 
            ON public.profiles FOR INSERT 
            WITH CHECK (auth.uid() = id);
    END IF;
END $$;

-- Harden profile update with strict WITH CHECK
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- -----------------------------------------------------------------------------
-- 4. COMPOSITE INDICES FOR HIGH PERFORMANCE MULTI-TENANT QUERIES
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_trades_user_account ON public.trades(user_id, account_id);
CREATE INDEX IF NOT EXISTS idx_journal_user_account ON public.journal_entries(user_id, account_id);
