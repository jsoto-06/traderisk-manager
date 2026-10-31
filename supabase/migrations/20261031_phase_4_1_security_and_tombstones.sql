-- =============================================================================
-- TradeRisk Manager — PostgreSQL Security, Referential Integrity & Tombstones (Fase 4.1)
-- Migration: 20261031_phase_4_1_security_and_tombstones.sql
-- Description: Composite foreign keys, soft delete (tombstones), optimistic versioning,
--              trigger search_path hardening, and execution permissions.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. SOFT DELETE (TOMBSTONES) & VERSIONING COLUMNS
-- -----------------------------------------------------------------------------

-- Accounts
ALTER TABLE public.accounts 
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Trades
ALTER TABLE public.trades 
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Journal Entries
ALTER TABLE public.journal_entries 
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- -----------------------------------------------------------------------------
-- 2. COMPOSITE UNIQUE CONSTRAINTS & MULTI-TENANT REFERENTIAL INTEGRITY
-- -----------------------------------------------------------------------------
-- Enforce that a trade or journal entry can ONLY reference an account belonging
-- to the exact same user_id, completely closing cross-tenant leakage.

-- Step 2.1: Add UNIQUE constraint on accounts(id, user_id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_accounts_id_user_id'
    ) THEN
        ALTER TABLE public.accounts ADD CONSTRAINT uq_accounts_id_user_id UNIQUE (id, user_id);
    END IF;
END $$;

-- Step 2.2: Upgrade foreign key on public.trades
DO $$
BEGIN
    -- Drop legacy single-column foreign key if present
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'trades_account_id_fkey'
    ) THEN
        ALTER TABLE public.trades DROP CONSTRAINT trades_account_id_fkey;
    END IF;

    -- Add compound foreign key (account_id, user_id)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_trades_account_user'
    ) THEN
        ALTER TABLE public.trades
            ADD CONSTRAINT fk_trades_account_user
            FOREIGN KEY (account_id, user_id)
            REFERENCES public.accounts(id, user_id)
            ON DELETE CASCADE;
    END IF;
END $$;

-- Step 2.3: Upgrade foreign key on public.journal_entries
DO $$
BEGIN
    -- Drop legacy single-column foreign key if present
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'journal_entries_account_id_fkey'
    ) THEN
        ALTER TABLE public.journal_entries DROP CONSTRAINT journal_entries_account_id_fkey;
    END IF;

    -- Add compound foreign key (account_id, user_id)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_journal_account_user'
    ) THEN
        ALTER TABLE public.journal_entries
            ADD CONSTRAINT fk_journal_account_user
            FOREIGN KEY (account_id, user_id)
            REFERENCES public.accounts(id, user_id)
            ON DELETE CASCADE;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3. INDICES FOR HIGH PERFORMANCE SOFT-DELETE FILTERING
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_accounts_user_deleted ON public.accounts(user_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_trades_user_deleted ON public.trades(user_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_journal_user_deleted ON public.journal_entries(user_id, deleted_at);

-- -----------------------------------------------------------------------------
-- 4. HARDEN SECURITY DEFINER FUNCTIONS & SECURE SEARCH_PATH
-- -----------------------------------------------------------------------------

-- Fix handle_updated_at search_path
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, auth, pg_temp
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    -- Increment version counter on update
    IF (TG_OP = 'UPDATE') THEN
        NEW.version = COALESCE(OLD.version, 1) + 1;
    END IF;
    RETURN NEW;
END;
$$;

-- Revoke default public execution & grant to least privileged roles
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_updated_at() TO authenticated, service_role;

-- Fix handle_new_user search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, auth, pg_temp
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.user_settings (user_id, language, theme)
    VALUES (NEW.id, 'es', 'dark')
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- Revoke default public execution & grant strictly to auth admin & service role
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role, supabase_auth_admin;
