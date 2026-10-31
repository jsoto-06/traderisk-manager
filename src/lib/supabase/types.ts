// =============================================================================
// TradeRisk Manager — Supabase TypeScript Database Definitions
// =============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
      };
      accounts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: string;
          initial_capital: number;
          balance: number;
          equity: number;
          currency: string;
          profit_target: number;
          daily_loss_limit: number;
          max_drawdown: number;
          drawdown_type: string;
          timezone: string;
          daily_reset_hour: number;
          risk_per_trade: number;
          leverage: number;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          version: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type: string;
          initial_capital: number;
          balance: number;
          equity: number;
          currency?: string;
          profit_target?: number;
          daily_loss_limit?: number;
          max_drawdown?: number;
          drawdown_type?: string;
          timezone?: string;
          daily_reset_hour?: number;
          risk_per_trade?: number;
          leverage?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          version?: number;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          type?: string;
          initial_capital?: number;
          balance?: number;
          equity?: number;
          currency?: string;
          profit_target?: number;
          daily_loss_limit?: number;
          max_drawdown?: number;
          drawdown_type?: string;
          timezone?: string;
          daily_reset_hour?: number;
          risk_per_trade?: number;
          leverage?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          version?: number;
        };
      };
      trades: {
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          asset: string;
          direction: string;
          entry_price: number;
          exit_price: number | null;
          stop_loss: number;
          take_profit: number;
          size: number;
          open_date: string;
          close_date: string | null;
          status: string;
          result: number | null;
          pnl_percentage: number | null;
          fees: number;
          risk_reward_ratio: number;
          notes: string | null;
          market_type: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          version: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          account_id: string;
          asset: string;
          direction: string;
          entry_price: number;
          exit_price?: number | null;
          stop_loss: number;
          take_profit: number;
          size: number;
          open_date: string;
          close_date?: string | null;
          status: string;
          result?: number | null;
          pnl_percentage?: number | null;
          fees?: number;
          risk_reward_ratio?: number;
          notes?: string | null;
          market_type?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          version?: number;
        };
        Update: {
          id?: string;
          user_id?: string;
          account_id?: string;
          asset?: string;
          direction?: string;
          entry_price?: number;
          exit_price?: number | null;
          stop_loss?: number;
          take_profit?: number;
          size?: number;
          open_date?: string;
          close_date?: string | null;
          status?: string;
          result?: number | null;
          pnl_percentage?: number | null;
          fees?: number;
          risk_reward_ratio?: number;
          notes?: string | null;
          market_type?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          version?: number;
        };
      };
      journal_entries: {
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          date: string;
          emotional_state: string;
          entry_reason: string;
          plan_compliance: boolean;
          errors: string | null;
          overtrading: boolean;
          observations: string | null;
          discipline: number;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          version: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          account_id: string;
          date: string;
          emotional_state: string;
          entry_reason: string;
          plan_compliance?: boolean;
          errors?: string | null;
          overtrading?: boolean;
          observations?: string | null;
          discipline?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          version?: number;
        };
        Update: {
          id?: string;
          user_id?: string;
          account_id?: string;
          date?: string;
          emotional_state?: string;
          entry_reason?: string;
          plan_compliance?: boolean;
          errors?: string | null;
          overtrading?: boolean;
          observations?: string | null;
          discipline?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          version?: number;
        };
      };
      user_settings: {
        Row: {
          user_id: string;
          language: string;
          theme: string;
          default_account_id: string | null;
          updated_at: string;
          version: number;
        };
        Insert: {
          user_id: string;
          language?: string;
          theme?: string;
          default_account_id?: string | null;
          updated_at?: string;
          version?: number;
        };
        Update: {
          user_id?: string;
          language?: string;
          theme?: string;
          default_account_id?: string | null;
          updated_at?: string;
          version?: number;
        };
      };
    };
  };
}
