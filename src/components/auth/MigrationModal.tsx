'use client';

import React, { useState, useMemo } from 'react';
import {
  CloudUpload,
  Download,
  CheckCircle2,
  Shield,
  Wallet,
  TrendingUp,
  BookOpen,
  Sparkles,
  RefreshCw,
  Hash,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useAuth } from '@/hooks/useAuth';
import { useLocale } from '@/lib/i18n/useLocale';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  getMigrationPreview,
  createPreMigrationBackup,
  executeResilientMigration,
  type MigrationPreview,
  type MigrationStep,
  type ResilientMigrationResult,
} from '@/lib/sync/sync-engine';
import { formatCurrency } from '@/lib/i18n';

interface MigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompleted?: () => void;
}

export function MigrationModal({
  isOpen,
  onClose,
  onCompleted,
}: MigrationModalProps) {
  const { locale } = useLocale();
  const isEs = locale === 'es';
  const { user, isConfigured } = useAuth();

  const preview: MigrationPreview | null = useMemo(
    () => (isOpen ? getMigrationPreview() : null),
    [isOpen],
  );

  const [backupDownloaded, setBackupDownloaded] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationStep, setMigrationStep] = useState<MigrationStep>('idle');
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressDetail, setProgressDetail] = useState('');
  const [migrationResult, setMigrationResult] = useState<ResilientMigrationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleClose = () => {
    if (isMigrating) return;
    setMigrationResult(null);
    setErrorMessage(null);
    setBackupDownloaded(false);
    setProgressPercent(0);
    setMigrationStep('idle');
    onClose();
  };

  const handleDownloadBackup = () => {
    try {
      const payload = createPreMigrationBackup();
      const jsonString = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const filename = `traderisk-pre-migration-backup-${dateStr}.json`;

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setBackupDownloaded(true);
    } catch {
      setErrorMessage(
        isEs
          ? 'Error al generar la copia de seguridad previa.'
          : 'Error generating pre-migration backup.',
      );
    }
  };

  const handleExecuteMigration = async () => {
    if (!user) {
      setErrorMessage(
        isEs
          ? 'Debes iniciar sesión con tu cuenta antes de migrar tus datos.'
          : 'You must sign in before migrating your data.',
      );
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setErrorMessage(
        isEs
          ? 'Cliente de Supabase no disponible o no configurado.'
          : 'Supabase client unavailable or unconfigured.',
      );
      return;
    }

    setErrorMessage(null);
    setIsMigrating(true);

    try {
      const result = await executeResilientMigration(supabase, user.id, {
        onProgress: (step, percent, detail) => {
          setMigrationStep(step);
          setProgressPercent(percent);
          setProgressDetail(detail);
        },
      });

      setMigrationResult(result);
      if (onCompleted) onCompleted();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setMigrationStep('error');
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#00F0FF]/10 text-[#00F0FF] flex items-center justify-center">
            <CloudUpload className="w-4 h-4" />
          </div>
          <span>
            {isEs
              ? 'Asistente de Migración a la Nube'
              : 'Cloud Migration Wizard'}
          </span>
        </div>
      }
      subtitle={
        isEs
          ? 'Transfiere de forma segura tus datos locales a tu base de datos en Supabase'
          : 'Safely transfer your local trading data to your Supabase cloud database'
      }
      size="lg"
    >
      <div className="space-y-5 py-2">
        {/* Error message */}
        {errorMessage && (
          <Alert variant="error">
            <span className="text-xs">{errorMessage}</span>
          </Alert>
        )}

        {/* Success message */}
        {migrationResult ? (
          <div className="space-y-4 text-center py-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-[#10B981]/10 text-[#10B981] flex items-center justify-center border border-[#10B981]/30 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#F5F7FA]">
                {isEs ? '¡Migración Verificada con Éxito!' : 'Migration Verified Successfully!'}
              </h3>
              <p className="text-xs text-[#94A3B8] max-w-md mx-auto mt-1">
                {isEs
                  ? 'Tus cuentas, operaciones y diario han sido consolidados de forma segura en tu base de datos PostgreSQL privada con Row Level Security.'
                  : 'Your accounts, trades, and journal entries have been securely consolidated into your private PostgreSQL database with Row Level Security.'}
              </p>
            </div>

            {/* Migration Details Card */}
            <div className="p-3 bg-[#0A1128] border border-[#1E2D4A] rounded-xl max-w-md mx-auto text-left text-xs space-y-2">
              <div className="flex items-center justify-between text-[#94A3B8] border-b border-[#1E2D4A]/60 pb-1.5">
                <span className="flex items-center gap-1 font-mono text-[11px]">
                  <Hash className="w-3 h-3 text-[#00F0FF]" /> {migrationResult.migrationId}
                </span>
                <Badge variant="green" size="sm">
                  {isEs ? 'Verificado' : 'Verified'}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono text-xs">
                <div>
                  <span className="text-[#94A3B8] block text-[10px]">Cuentas</span>
                  <span className="text-[#00F0FF] font-bold">
                    {migrationResult.verifiedRemoteCounts.accounts}
                  </span>
                </div>
                <div>
                  <span className="text-[#94A3B8] block text-[10px]">Operaciones</span>
                  <span className="text-[#3B82F6] font-bold">
                    {migrationResult.verifiedRemoteCounts.trades}
                  </span>
                </div>
                <div>
                  <span className="text-[#94A3B8] block text-[10px]">Diario</span>
                  <span className="text-[#10B981] font-bold">
                    {migrationResult.verifiedRemoteCounts.journal}
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-[#94A3B8] text-center pt-1">
                {isEs
                  ? 'Tus datos locales se conservan intactos. No se ha eliminado ningún registro de este dispositivo.'
                  : 'Your local data is preserved intact. No records were deleted from this device.'}
              </p>
            </div>

            <div className="flex justify-center pt-2">
              <Button variant="primary" onClick={handleClose}>
                {isEs ? 'Finalizar y Continuar' : 'Finish & Continue'}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Supabase status verification banner */}
            {!isConfigured ? (
              <Alert variant="warning">
                <div className="text-xs space-y-1">
                  <p className="font-semibold text-[#F5F7FA]">
                    {isEs ? 'Supabase no está configurado' : 'Supabase is not configured'}
                  </p>
                  <p className="text-[#94A3B8]">
                    {isEs
                      ? 'Para utilizar el asistente de migración, añade NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY a tu archivo .env.local.'
                      : 'To use the migration wizard, set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file.'}
                  </p>
                </div>
              </Alert>
            ) : !user ? (
              <Alert variant="warning">
                <div className="text-xs space-y-1">
                  <p className="font-semibold text-[#F5F7FA]">
                    {isEs ? 'Sesión no iniciada' : 'Not signed in'}
                  </p>
                  <p className="text-[#94A3B8]">
                    {isEs
                      ? 'Inicia sesión primero para vincular estos datos a tu identificador de usuario único en Supabase.'
                      : 'Please sign in first to link these records to your unique Supabase user ID.'}
                  </p>
                </div>
              </Alert>
            ) : (
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#0A1128] border border-[#1E2D4A] text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#10B981] shadow-[0_0_8px_#10B981]" />
                  <span className="text-[#94A3B8]">
                    {isEs ? 'Destino Supabase:' : 'Supabase Destination:'}
                  </span>
                  <span className="font-semibold text-[#F5F7FA] font-mono">{user.email}</span>
                </div>
                <Badge variant="cyan" size="sm">
                  {isEs ? 'Autenticado' : 'Authenticated'}
                </Badge>
              </div>
            )}

            {/* Preview Cards */}
            <div>
              <div className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mb-2">
                {isEs ? 'Resumen de Datos Locales a Migrar' : 'Summary of Local Data to Migrate'}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-[#0A1128] border border-[#1E2D4A]">
                  <div className="flex items-center gap-2 text-[#00F0FF] mb-1">
                    <Wallet className="w-4 h-4" />
                    <span className="text-xs font-medium">{isEs ? 'Cuentas' : 'Accounts'}</span>
                  </div>
                  <div className="text-xl font-bold font-mono text-[#F5F7FA]">
                    {preview?.accountsCount ?? 0}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#0A1128] border border-[#1E2D4A]">
                  <div className="flex items-center gap-2 text-[#3B82F6] mb-1">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-xs font-medium">{isEs ? 'Operaciones' : 'Trades'}</span>
                  </div>
                  <div className="text-xl font-bold font-mono text-[#F5F7FA]">
                    {preview?.tradesCount ?? 0}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#0A1128] border border-[#1E2D4A]">
                  <div className="flex items-center gap-2 text-[#10B981] mb-1">
                    <BookOpen className="w-4 h-4" />
                    <span className="text-xs font-medium">{isEs ? 'Diario' : 'Journal'}</span>
                  </div>
                  <div className="text-xl font-bold font-mono text-[#F5F7FA]">
                    {preview?.journalCount ?? 0}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#0A1128] border border-[#1E2D4A]">
                  <div className="flex items-center gap-2 text-[#EAB308] mb-1">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-xs font-medium">{isEs ? 'Balance' : 'Balance'}</span>
                  </div>
                  <div className="text-base font-bold font-mono text-[#F5F7FA] truncate">
                    {preview ? formatCurrency(preview.totalBalance, 'USD', locale) : '$0'}
                  </div>
                </div>
              </div>
            </div>

            {/* Step 1: Pre-migration backup */}
            <div className="p-4 rounded-xl bg-[#0A1128] border border-[#1E2D4A] space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-[#3B82F6]/10 text-[#3B82F6] mt-0.5">
                  <Shield className="w-4 h-4" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="text-xs font-semibold text-[#F5F7FA]">
                    {isEs
                      ? 'Paso 1: Copia de Seguridad Preventiva Inmutable'
                      : 'Step 1: Immutable Preventive Backup'}
                  </div>
                  <p className="text-[11px] text-[#94A3B8]">
                    {isEs
                      ? 'Descarga una copia JSON de tu estado local antes de iniciar. Esta copia protege tus datos ante cualquier fallo de red.'
                      : 'Download a JSON backup before starting. This copy shields your data against any network disruption.'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant={backupDownloaded ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={handleDownloadBackup}
                  className="flex items-center gap-1.5 shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>
                    {backupDownloaded
                      ? isEs
                        ? 'Descargada ✓'
                        : 'Downloaded ✓'
                      : isEs
                      ? 'Descargar Copia'
                      : 'Download Backup'}
                  </span>
                </Button>
              </div>
            </div>

            {/* Migration In Progress State */}
            {isMigrating && (
              <div className="p-4 rounded-xl bg-[#0A1128] border border-[#00F0FF]/40 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#00F0FF] font-medium flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> {progressDetail}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="gray" size="sm" className="font-mono text-[10px]">
                      {migrationStep}
                    </Badge>
                    <span className="font-mono text-[#94A3B8]">{progressPercent}%</span>
                  </div>
                </div>
                <ProgressBar value={progressPercent} max={100} variant="cyan" />
              </div>
            )}

            {/* Migration action buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#1E2D4A]/60">
              <div className="text-[11px] text-[#94A3B8]">
                {isEs
                  ? 'La migración es idempotente: no se duplican registros ni se eliminan datos locales.'
                  : 'Migration is idempotent: no records are duplicated and no local data is deleted.'}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button variant="secondary" onClick={handleClose} disabled={isMigrating}>
                  {isEs ? 'Cancelar' : 'Cancel'}
                </Button>
                <Button
                  variant="primary"
                  onClick={handleExecuteMigration}
                  disabled={!user || isMigrating}
                  className="flex items-center justify-center gap-2 flex-1 sm:flex-none"
                >
                  <CloudUpload className="w-4 h-4" />
                  <span>
                    {isMigrating
                      ? isEs
                        ? 'Migrando...'
                        : 'Migrating...'
                      : isEs
                      ? 'Confirmar y Migrar a Supabase'
                      : 'Confirm & Migrate to Supabase'}
                  </span>
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
