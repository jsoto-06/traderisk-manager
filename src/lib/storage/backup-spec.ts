// =============================================================================
// TradeRisk Manager — Backup & Restore Specification (Security Hardened)
// =============================================================================

import { z } from 'zod';
import { AccountSchema, TradeSchema, JournalEntrySchema } from '@/lib/validation/schemas';
import type { Account, Trade, JournalEntry, Settings } from '@/lib/types';

export const BACKUP_SCHEMA_VERSION = '1.0.0';

/** 10 MB maximum allowed payload size to prevent browser OOM Denial-of-Service */
export const MAX_BACKUP_SIZE_BYTES = 10 * 1024 * 1024;

export const SettingsSchema = z.object({
  language: z.enum(['es', 'en']),
  theme: z.enum(['light', 'dark', 'system']),
  defaultAccountId: z.string().min(1),
});

export const BackupPayloadSchema = z.object({
  version: z.literal(BACKUP_SCHEMA_VERSION),
  exportedAt: z.string().min(1, 'Missing exportedAt timestamp'),
  appName: z.literal('TradeRisk Manager'),
  data: z.object({
    accounts: z.array(AccountSchema).min(1, 'Backup must contain at least one valid account'),
    trades: z.array(TradeSchema),
    journal: z.array(JournalEntrySchema),
    settings: SettingsSchema,
  }),
});

export type BackupPayload = z.infer<typeof BackupPayloadSchema>;

export interface BackupValidationResult {
  valid: boolean;
  payload?: BackupPayload;
  errors?: string[];
  warnings?: string[];
  stats?: {
    accountsCount: number;
    tradesCount: number;
    journalCount: number;
    accountNames: string[];
    exportedAt: string;
    appName: string;
    version: string;
  };
}

/**
 * Validates an imported JSON string against the TradeRisk Manager backup specification,
 * performing security size checks, schema validation, duplicate id detection, and
 * relational integrity verification.
 */
export function validateBackupString(rawJson: string): BackupValidationResult {
  // 1. Size guard
  if (!rawJson || typeof rawJson !== 'string') {
    return { valid: false, errors: ['El archivo de copia de seguridad está vacío o no es una cadena válida'] };
  }

  const byteLength = new Blob([rawJson]).size;
  if (byteLength > MAX_BACKUP_SIZE_BYTES) {
    const sizeMb = (byteLength / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      errors: [`El archivo es demasiado grande (${sizeMb} MB). El tamaño máximo permitido es de 10 MB`],
    };
  }

  // 2. JSON Syntax Parsing
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (e) {
    return {
      valid: false,
      errors: [`Error de sintaxis JSON: ${e instanceof Error ? e.message : 'Sintaxis inválida'}`],
    };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      valid: false,
      errors: ['El archivo no tiene el formato raíz de objeto esperado'],
    };
  }

  // 3. Schema Validation with Zod
  const result = BackupPayloadSchema.safeParse(parsed);
  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`,
    );
    return { valid: false, errors };
  }

  const payload = result.data;
  const errors: string[] = [];
  const warnings: string[] = [];

  // 4. Duplicate ID Detection
  const accountIds = new Set<string>();
  for (const acc of payload.data.accounts) {
    if (accountIds.has(acc.id)) {
      errors.push(`Identificador de cuenta duplicado detectado: "${acc.id}"`);
    }
    accountIds.add(acc.id);
  }

  const tradeIds = new Set<string>();
  for (const trd of payload.data.trades) {
    if (tradeIds.has(trd.id)) {
      errors.push(`Identificador de operación duplicado detectado: "${trd.id}"`);
    }
    tradeIds.add(trd.id);
  }

  const journalIds = new Set<string>();
  for (const jnl of payload.data.journal) {
    if (journalIds.has(jnl.id)) {
      errors.push(`Identificador de entrada de diario duplicado detectado: "${jnl.id}"`);
    }
    journalIds.add(jnl.id);
  }

  // 5. Relational Integrity Checks
  for (const trd of payload.data.trades) {
    if (!accountIds.has(trd.accountId)) {
      errors.push(
        `Violación de integridad relacional: La operación "${trd.id}" (${trd.asset}) está vinculada a una cuenta inexistente "${trd.accountId}"`,
      );
    }
  }

  for (const jnl of payload.data.journal) {
    if (!accountIds.has(jnl.accountId)) {
      errors.push(
        `Violación de integridad relacional: La nota de diario "${jnl.id}" está vinculada a una cuenta inexistente "${jnl.accountId}"`,
      );
    }
  }

  if (!accountIds.has(payload.data.settings.defaultAccountId)) {
    warnings.push(
      `La cuenta predeterminada configurada "${payload.data.settings.defaultAccountId}" no existe en el conjunto de cuentas. Se asignará la primera cuenta disponible.`,
    );
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    payload,
    warnings: warnings.length > 0 ? warnings : undefined,
    stats: {
      accountsCount: payload.data.accounts.length,
      tradesCount: payload.data.trades.length,
      journalCount: payload.data.journal.length,
      accountNames: payload.data.accounts.map((a) => a.name),
      exportedAt: payload.exportedAt,
      appName: String(payload.appName),
      version: String(payload.version),
    },
  };
}

/**
 * Constructs a validated backup payload object ready for JSON export.
 */
export function createBackupPayload(
  accounts: Account[],
  trades: Trade[],
  journal: JournalEntry[],
  settings: Settings,
): BackupPayload {
  return {
    version: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appName: 'TradeRisk Manager',
    data: {
      accounts,
      trades,
      journal,
      settings,
    },
  };
}
