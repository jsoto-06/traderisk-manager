// =============================================================================
// TradeRisk Manager — Integration Test Suite: Real PostgreSQL & Supabase RLS Audit
// =============================================================================
// REQUISITO DE ENTORNO:
// Este archivo está diseñado para ejecutarse EXCLUSIVAMENTE contra una instancia real
// de PostgreSQL / Supabase (local o en la nube), no mediante mocks.
//
// Para ejecutar contra una instancia activa de Supabase:
// 1. Configurar en .env.local o variables de entorno:
//    - NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
//    - NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
//    - SUPABASE_TEST_USER_A_EMAIL=test_user_a@traderisk.local
//    - SUPABASE_TEST_USER_A_PASSWORD=TestPass123!Secure
//    - SUPABASE_TEST_USER_B_EMAIL=test_user_b@traderisk.local
//    - SUPABASE_TEST_USER_B_PASSWORD=TestPass123!Secure
// 2. Ejecutar: npm test -- src/__tests__/supabase-integration.real.test.ts
//
// Si las credenciales no están presentes en el entorno, Vitest omite este suite
// e informa de las condiciones necesarias para su ejecución real.
// =============================================================================

import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const isPlaceholder = (val: string) =>
  !val ||
  val.includes('your-project-ref') ||
  val.includes('localhost') ||
  val === 'mock' ||
  val.length < 20;

const hasLiveSupabaseConfig = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !isPlaceholder(supabaseUrl) &&
  !isPlaceholder(supabaseAnonKey),
);

describe.skipIf(!hasLiveSupabaseConfig)(
  'FASE 4.2: Auditoría Real de Aislamiento Multi-Tenant y Seguridad RLS en PostgreSQL',
  () => {
    let clientUserA: SupabaseClient<Database>;
    let clientUserB: SupabaseClient<Database>;
    let userIdA: string;
    let userIdB: string;

    const emailA = process.env.SUPABASE_TEST_USER_A_EMAIL || `test_a_${Date.now()}@traderisk.internal`;
    const passwordA = process.env.SUPABASE_TEST_USER_A_PASSWORD || 'TraderRisk_Secure_Pass_A_123!';

    const emailB = process.env.SUPABASE_TEST_USER_B_EMAIL || `test_b_${Date.now()}@traderisk.internal`;
    const passwordB = process.env.SUPABASE_TEST_USER_B_PASSWORD || 'TraderRisk_Secure_Pass_B_123!';

    const testAccountIdA = `acc_real_a_${Date.now()}`;
    const testTradeIdA = `trd_real_a_${Date.now()}`;

    type PostgrestMutation<T> = {
      insert: (payload: unknown) => {
        select: () => Promise<{ data: T[] | null; error: { code?: string; message?: string } | null }>;
      };
      update: (payload: unknown) => {
        eq: (col: string, val: string) => {
          select: () => Promise<{ data: T[] | null; error: Error | null }>;
        };
      };
    };

    const asMutation = <T>(client: SupabaseClient<Database>, table: string): PostgrestMutation<T> => {
      return client.from(table) as unknown as PostgrestMutation<T>;
    };

    beforeAll(async () => {
      clientUserA = createClient<Database>(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      clientUserB = createClient<Database>(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      // Autenticar Usuario A
      const authResA = await clientUserA.auth.signInWithPassword({ email: emailA, password: passwordA });
      if (authResA.data.user) {
        userIdA = authResA.data.user.id;
      } else {
        const signUpA = await clientUserA.auth.signUp({ email: emailA, password: passwordA });
        if (signUpA.error) throw new Error(`Fallo al autenticar Usuario A: ${signUpA.error.message}`);
        userIdA = signUpA.data.user!.id;
      }

      // Autenticar Usuario B
      const authResB = await clientUserB.auth.signInWithPassword({ email: emailB, password: passwordB });
      if (authResB.data.user) {
        userIdB = authResB.data.user.id;
      } else {
        const signUpB = await clientUserB.auth.signUp({ email: emailB, password: passwordB });
        if (signUpB.error) throw new Error(`Fallo al autenticar Usuario B: ${signUpB.error.message}`);
        userIdB = signUpB.data.user!.id;
      }
    });

    // -------------------------------------------------------------------------
    // 1. Usuario A crea una cuenta y una operación
    // -------------------------------------------------------------------------
    it('1. Usuario A crea legítimamente su cuenta y operación en PostgreSQL', async () => {
      const { data: accData, error: accError } = await asMutation(clientUserA, 'accounts')
        .insert({
          id: testAccountIdA,
          user_id: userIdA,
          name: 'Cuenta Real Auditoría A',
          type: 'Personal',
          initial_capital: 10000,
          balance: 10000,
          equity: 10000,
          currency: 'USD',
          profit_target: 10,
          daily_loss_limit: 3,
          max_drawdown: 5,
          drawdown_type: 'static',
          timezone: 'UTC',
          daily_reset_hour: 0,
          risk_per_trade: 1,
          leverage: 10,
        })
        .select();

      expect(accError).toBeNull();
      expect(accData).toHaveLength(1);

      const { data: trdData, error: trdError } = await asMutation(clientUserA, 'trades')
        .insert({
          id: testTradeIdA,
          user_id: userIdA,
          account_id: testAccountIdA,
          asset: 'EUR/USD',
          direction: 'long',
          entry_price: 1.085,
          stop_loss: 1.08,
          take_profit: 1.095,
          size: 100000,
          open_date: new Date().toISOString(),
          status: 'open',
          fees: 5,
        })
        .select();

      expect(trdError).toBeNull();
      expect(trdData).toHaveLength(1);
    });

    // -------------------------------------------------------------------------
    // 2. Usuario B intenta consultar los registros de Usuario A
    // -------------------------------------------------------------------------
    it('2. Usuario B intenta consultar la cuenta de Usuario A (debe devolver 0 filas por RLS)', async () => {
      const { data: accountsB, error: readError } = await clientUserB
        .from('accounts')
        .select('*')
        .eq('id', testAccountIdA);

      expect(readError).toBeNull();
      // PostgreSQL RLS USING (auth.uid() = user_id) filtra silenciosamente las filas
      expect(accountsB).toHaveLength(0);
    });

    // -------------------------------------------------------------------------
    // 3. Usuario B intenta modificar una operación de Usuario A
    // -------------------------------------------------------------------------
    it('3. Usuario B intenta modificar la operación de Usuario A (RLS debe rechazar o actualizar 0 filas)', async () => {
      const { data: updatedData, error: updateError } = await asMutation(clientUserB, 'trades')
        .update({ notes: 'Ataque malicioso por Usuario B' })
        .eq('id', testTradeIdA)
        .select();

      expect(updateError).toBeNull();
      expect(updatedData).toHaveLength(0); // Ninguna fila modificada
    });

    // -------------------------------------------------------------------------
    // 4. Usuario B intenta asociar una operación propia a la cuenta de Usuario A
    // -------------------------------------------------------------------------
    it('4. Usuario B intenta asociar una operación a la cuenta de A (debe violar la FK compuesta fk_trades_account_user)', async () => {
      const maliciousTradeId = `trd_malicious_${Date.now()}`;

      const { data: insertedData, error: insertError } = await asMutation(clientUserB, 'trades')
        .insert({
          id: maliciousTradeId,
          user_id: userIdB, // Su propio user_id
          account_id: testAccountIdA, // PERO la cuenta pertenece al Usuario A
          asset: 'BTC/USDT',
          direction: 'short',
          entry_price: 68000,
          stop_loss: 69000,
          take_profit: 65000,
          size: 1,
          open_date: new Date().toISOString(),
          status: 'open',
        })
        .select();

      // PostgreSQL DEBE rechazar la inserción con código 23503 (foreign_key_violation)
      expect(insertError).not.toBeNull();
      expect(insertError?.code).toBe('23503');
      expect(insertedData).toBeNull();
    });

    // -------------------------------------------------------------------------
    // 5. Usuario B intenta insertar un diario con la cuenta ajena
    // -------------------------------------------------------------------------
    it('5. Usuario B intenta insertar un diario con la cuenta de A (debe violar fk_journal_account_user)', async () => {
      const maliciousJournalId = `jrn_malicious_${Date.now()}`;

      const { data: insertedData, error: insertError } = await asMutation(clientUserB, 'journal_entries')
        .insert({
          id: maliciousJournalId,
          user_id: userIdB,
          account_id: testAccountIdA,
          date: new Date().toISOString(),
          emotional_state: 'anxious',
          entry_reason: 'Intento de inyección de bitácora no autorizada',
          plan_compliance: false,
        })
        .select();

      expect(insertError).not.toBeNull();
      expect(insertError?.code).toBe('23503');
      expect(insertedData).toBeNull();
    });

    // -------------------------------------------------------------------------
    // 6. Usuario A intenta consultar datos de Usuario B
    // -------------------------------------------------------------------------
    it('6. Usuario A intenta consultar datos creados por Usuario B (aislamiento bidireccional)', async () => {
      // B crea una cuenta propia
      const bAccountId = `acc_real_b_${Date.now()}`;
      await asMutation(clientUserB, 'accounts').insert({
        id: bAccountId,
        user_id: userIdB,
        name: 'Cuenta de Bob',
        type: 'Personal',
        initial_capital: 5000,
        balance: 5000,
        equity: 5000,
        currency: 'USD',
        profit_target: 10,
        daily_loss_limit: 3,
        max_drawdown: 5,
        drawdown_type: 'static',
        timezone: 'UTC',
        daily_reset_hour: 0,
        risk_per_trade: 1,
        leverage: 10,
      });

      // A intenta leer las cuentas de B
      const { data: accountsReadByA } = await clientUserA
        .from('accounts')
        .select('*')
        .eq('id', bAccountId);

      expect(accountsReadByA).toHaveLength(0);
    });
  },
);
