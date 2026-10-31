// =============================================================================
// TradeRisk Manager — Validation Schemas (Zod v4)
// =============================================================================

import { z } from 'zod';
import { InstrumentType, type ValidationResult } from '@/lib/types';
import type { Account, Trade, JournalEntry, RiskCalculationInput } from '@/lib/types';

// ---------------------------------------------------------------------------
// Reusable primitives
// ---------------------------------------------------------------------------

const positiveNumber = z.number().positive();
const nonNegativeNumber = z.number().nonnegative();
const percentNumber = z.number().nonnegative().max(100);
const uuidString = z.string().min(1);

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

export const AccountSchema = z.object({
  id: uuidString,
  name: z.string().min(1).max(100),
  type: z.enum(['Personal', 'PropFirm', 'Exchange', 'Broker', 'Demo', 'Custom']),
  initialCapital: positiveNumber,
  balance: nonNegativeNumber,
  equity: nonNegativeNumber,
  currency: z.string().min(1).max(10),
  profitTarget: percentNumber,
  dailyLossLimit: percentNumber,
  maxDrawdown: percentNumber,
  drawdownType: z.enum(['static', 'trailing', 'custom']),
  timezone: z.string().min(1),
  dailyResetHour: z.number().int().min(0).max(23),
  riskPerTrade: z.number().positive().max(100),
  leverage: positiveNumber,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  deletedAt: z.string().nullable().optional(),
  version: z.number().int().nonnegative().optional(),
});

// ---------------------------------------------------------------------------
// Trade
// ---------------------------------------------------------------------------

export const TradeSchema = z
  .object({
    id: uuidString,
    accountId: uuidString,
    asset: z.string().min(1).max(50),
    direction: z.enum(['long', 'short']),
    entryPrice: positiveNumber,
    exitPrice: positiveNumber.optional(),
    stopLoss: positiveNumber,
    takeProfit: positiveNumber,
    size: positiveNumber,
    openDate: z.string().min(1),
    closeDate: z.string().optional(),
    status: z.enum(['open', 'closed']),
    result: z.number().optional(),
    commissions: nonNegativeNumber,
    strategy: z.string().max(100),
    timeframe: z.string().max(20),
    notes: z.string().max(2000),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    deletedAt: z.string().nullable().optional(),
    version: z.number().int().nonnegative().optional(),
  })
  .refine(
    (data) => {
      if (data.direction === 'long') {
        return data.stopLoss < data.entryPrice;
      }
      return data.stopLoss > data.entryPrice;
    },
    {
      message: 'Stop loss must be below entry price for long, above for short',
      path: ['stopLoss'],
    },
  )
  .refine(
    (data) => {
      if (data.direction === 'long') {
        return data.takeProfit > data.entryPrice;
      }
      return data.takeProfit < data.entryPrice;
    },
    {
      message: 'Take profit must be above entry price for long, below for short',
      path: ['takeProfit'],
    },
  );

// ---------------------------------------------------------------------------
// Journal Entry
// ---------------------------------------------------------------------------

export const JournalEntrySchema = z.object({
  id: uuidString,
  date: z.string().min(1),
  emotionalState: z.enum([
    'calm',
    'anxious',
    'confident',
    'fearful',
    'euphoric',
    'frustrated',
  ]),
  entryReason: z.string().min(1).max(2000),
  planCompliance: z.boolean(),
  errors: z.string().max(2000),
  overtrading: z.boolean(),
  observations: z.string().max(2000),
  discipline: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
  accountId: uuidString,
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  deletedAt: z.string().nullable().optional(),
  version: z.number().int().nonnegative().optional(),
});

// ---------------------------------------------------------------------------
// Risk Calculation Input
// ---------------------------------------------------------------------------

export const RiskCalculationInputSchema = z
  .object({
    accountBalance: positiveNumber,
    riskPercent: z.number().positive().max(100).optional(),
    riskAmount: positiveNumber.optional(),
    entryPrice: positiveNumber,
    stopLoss: positiveNumber,
    takeProfit: positiveNumber.optional(),
    direction: z.enum(['long', 'short']),
    commission: nonNegativeNumber.optional(),
    leverage: positiveNumber.optional(),
    instrumentType: z.nativeEnum(InstrumentType),
    market: z.enum(['crypto', 'forex', 'futures', 'stocks', 'indices']).optional(),
    contractMultiplier: positiveNumber.optional(),
    tickSize: positiveNumber.optional(),
    tickValue: positiveNumber.optional(),
    lotType: z.enum(['standard', 'mini', 'micro']).optional(),
    pipSize: positiveNumber.optional(),
    quoteToAccountRate: positiveNumber.optional(),
    baseToAccountRate: positiveNumber.optional(),
    fundingRate: z.number().optional(),
    fundingPeriods: z.number().nonnegative().optional(),
    spreadPips: nonNegativeNumber.optional(),
    commissionPerContract: nonNegativeNumber.optional(),
    initialMarginPerUnit: nonNegativeNumber.optional(),
    maintenanceMarginPerUnit: nonNegativeNumber.optional(),
    allowFractional: z.boolean().optional(),
    accountCurrency: z.string().optional(),
    assetSymbol: z.string().optional(),
    marginMode: z.enum(['isolated', 'cross']).optional(),
    accountEquity: positiveNumber.optional(),
    usedMargin: nonNegativeNumber.optional(),
    freeMargin: z.number().optional(),
    enforceTickGrid: z.boolean().optional(),
    fundingIntervalHours: positiveNumber.optional(),
    holdingPeriodHours: nonNegativeNumber.optional(),
    pricesIncludeSpread: z.boolean().optional(),
    includeFeesInRisk: z.boolean().optional(),
  })
  .refine(
    (data) => data.riskPercent != null || data.riskAmount != null,
    {
      message: 'Either riskPercent or riskAmount must be provided',
      path: ['riskPercent'],
    },
  );

// ---------------------------------------------------------------------------
// Validator helpers
// ---------------------------------------------------------------------------

function validate<T>(
  schema: z.ZodType<T>,
  data: unknown,
): ValidationResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errors = result.error.issues.map(
    (issue) => `${issue.path.join('.')}: ${issue.message}`,
  );
  return { success: false, errors };
}

export function validateAccount(data: unknown): ValidationResult<Account> {
  return validate(AccountSchema, data);
}

export function validateTrade(data: unknown): ValidationResult<Trade> {
  return validate(TradeSchema as z.ZodType<Trade>, data);
}

export function validateJournalEntry(data: unknown): ValidationResult<JournalEntry> {
  return validate(JournalEntrySchema, data);
}

export function validateRiskInput(data: unknown): ValidationResult<RiskCalculationInput> {
  return validate(RiskCalculationInputSchema as z.ZodType<RiskCalculationInput>, data);
}
