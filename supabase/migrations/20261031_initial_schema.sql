-- =============================================================================
-- TradeRisk Manager — Supabase PostgreSQL Schema & Security Migration (Fase 4)
-- Migration: 20261031_initial_schema.sql
-- Description: Core tables, indices, RLS policies, triggers and user profiles
-- =============================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. PROFILES TABLE (Linked 1:1 with auth.users)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- -----------------------------------------------------------------------------
-- 2. ACCOUNTS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Personal', 'PropFirm', 'Exchange', 'Broker', 'Demo', 'Custom')),
    initial_capital NUMERIC(18, 4) NOT NULL CHECK (initial_capital >= 0),
    balance NUMERIC(18, 4) NOT NULL,
    equity NUMERIC(18, 4) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    profit_target NUMERIC(8, 4) NOT NULL DEFAULT 10,
    daily_loss_limit NUMERIC(8, 4) NOT NULL DEFAULT 5,
    max_drawdown NUMERIC(8, 4) NOT NULL DEFAULT 10,
    drawdown_type TEXT NOT NULL DEFAULT 'static' CHECK (drawdown_type IN ('static', 'trailing', 'custom')),
    timezone TEXT NOT NULL DEFAULT 'UTC',
    daily_reset_hour INTEGER NOT NULL DEFAULT 0 CHECK (daily_reset_hour >= 0 AND daily_reset_hour <= 23),
    risk_per_trade NUMERIC(8, 4) NOT NULL DEFAULT 1 CHECK (risk_per_trade >= 0 AND risk_per_trade <= 100),
    leverage NUMERIC(8, 4) NOT NULL DEFAULT 1 CHECK (leverage >= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- -----------------------------------------------------------------------------
-- 3. TRADES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    asset TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('long', 'short')),
    entry_price NUMERIC(18, 8) NOT NULL CHECK (entry_price > 0),
    exit_price NUMERIC(18, 8),
    stop_loss NUMERIC(18, 8) NOT NULL CHECK (stop_loss > 0),
    take_profit NUMERIC(18, 8) NOT NULL CHECK (take_profit > 0),
    size NUMERIC(18, 8) NOT NULL CHECK (size >= 0),
    open_date TIMESTAMPTZ NOT NULL,
    close_date TIMESTAMPTZ,
    status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
    result NUMERIC(18, 4),
    pnl_percentage NUMERIC(10, 4),
    fees NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (fees >= 0),
    risk_reward_ratio NUMERIC(10, 4) NOT NULL DEFAULT 0,
    notes TEXT,
    market_type TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- -----------------------------------------------------------------------------
-- 4. JOURNAL ENTRIES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    date TIMESTAMPTZ NOT NULL,
    emotional_state TEXT NOT NULL CHECK (emotional_state IN ('calm', 'anxious', 'confident', 'fearful', 'euphoric', 'frustrated')),
    entry_reason TEXT NOT NULL,
    plan_compliance BOOLEAN NOT NULL DEFAULT true,
    errors TEXT,
    overtrading BOOLEAN NOT NULL DEFAULT false,
    observations TEXT,
    discipline INTEGER NOT NULL DEFAULT 5 CHECK (discipline >= 1 AND discipline <= 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- -----------------------------------------------------------------------------
-- 5. USER SETTINGS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    language TEXT NOT NULL DEFAULT 'es' CHECK (language IN ('es', 'en')),
    theme TEXT NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark', 'light')),
    default_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- -----------------------------------------------------------------------------
-- 6. INDICES FOR HIGH PERFORMANCE QUERIES & RLS FILTERS
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON public.trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_account_id ON public.trades(account_id);
CREATE INDEX IF NOT EXISTS idx_trades_status ON public.trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_open_date ON public.trades(open_date);
CREATE INDEX IF NOT EXISTS idx_journal_user_id ON public.journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_account_id ON public.journal_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_journal_date ON public.journal_entries(date);

-- -----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only select and update their own profile
CREATE POLICY "Users can view own profile" 
    ON public.profiles FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id);

-- Accounts: Full CRUD scoped to auth.uid()
CREATE POLICY "Users can manage own accounts" 
    ON public.accounts FOR ALL 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Trades: Full CRUD scoped to auth.uid()
CREATE POLICY "Users can manage own trades" 
    ON public.trades FOR ALL 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Journal Entries: Full CRUD scoped to auth.uid()
CREATE POLICY "Users can manage own journal entries" 
    ON public.journal_entries FOR ALL 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- User Settings: Full CRUD scoped to auth.uid()
CREATE POLICY "Users can manage own settings" 
    ON public.user_settings FOR ALL 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 8. DATABASE FUNCTIONS & TRIGGERS
-- -----------------------------------------------------------------------------

-- Trigger function to automatically update `updated_at` timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply updated_at trigger across all tables
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_accounts_updated_at ON public.accounts;
CREATE TRIGGER trg_accounts_updated_at BEFORE UPDATE ON public.accounts
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_trades_updated_at ON public.trades;
CREATE TRIGGER trg_trades_updated_at BEFORE UPDATE ON public.trades
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_journal_updated_at ON public.journal_entries;
CREATE TRIGGER trg_journal_updated_at BEFORE UPDATE ON public.journal_entries
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER trg_user_settings_updated_at BEFORE UPDATE ON public.user_settings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Automatically provision a user profile and default settings on new auth.user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger fired after an auth.user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
