'use client';

import React, { useState, useRef } from 'react';
import {
  Settings as SettingsIcon,
  Globe,
  Wallet,
  RotateCcw,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  Download,
  Upload,
  FileJson,
  CheckCircle2,
  Cloud,
  CloudOff,
  RefreshCw,
  LogIn,
  LogOut,
  CloudUpload,
  Database,
} from 'lucide-react';
import { useLocale } from '@/lib/i18n/useLocale';
import { useStorage } from '@/hooks/useStorage';
import { useAuth } from '@/hooks/useAuth';
import { useSync } from '@/hooks/useSync';
import type { Locale } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { AuthModal } from '@/components/auth/AuthModal';
import { MigrationModal } from '@/components/auth/MigrationModal';
import {
  validateBackupString,
  type BackupValidationResult,
} from '@/lib/storage/backup-spec';

export default function SettingsPage() {
  const { locale, t, switchLocale } = useLocale();
  const {
    accounts,
    settings,
    corruptionReport,
    updateSettings,
    resetDemo,
    clearAll,
    exportBackup,
    importBackup,
    clearCorruption,
  } = useStorage();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Backup Import State
  const [pendingValidation, setPendingValidation] = useState<BackupValidationResult | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');

  // Cloud & Auth State
  const { user, isConfigured, signOut } = useAuth();
  const { isOnline, isSyncing, syncNow, lastSyncTime } = useSync();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [migrationModalOpen, setMigrationModalOpen] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleLanguageChange = (newLocale: Locale) => {
    updateSettings({ ...settings, language: newLocale });
    switchLocale(newLocale);
    showToast(newLocale === 'es' ? 'Idioma cambiado a Español' : 'Language switched to English');
  };

  const handleDefaultAccountChange = (accountId: string) => {
    updateSettings({ ...settings, defaultAccountId: accountId });
    showToast('Cuenta predeterminada actualizada');
  };

  const handleExecuteReset = () => {
    resetDemo();
    setConfirmResetOpen(false);
    showToast('Datos de demostración restablecidos correctamente');
  };

  const handleExecuteClear = () => {
    clearAll();
    setConfirmClearOpen(false);
    showToast('Todos los datos han sido borrados');
  };

  // ---------------------------------------------------------------------------
  // JSON Backup Export
  // ---------------------------------------------------------------------------
  const handleExportBackup = () => {
    try {
      const payload = exportBackup();
      const jsonString = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      const filename = `traderisk-backup-${dateStr}-${timeStr}.json`;

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast(`Copia de seguridad exportada con éxito (${filename})`);
    } catch (e) {
      setErrorMessage(
        `Error al exportar la copia: ${e instanceof Error ? e.message : 'Error desconocido'}`,
      );
    }
  };

  // ---------------------------------------------------------------------------
  // JSON Backup Import Flow
  // ---------------------------------------------------------------------------
  const handleTriggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const validation = validateBackupString(text);

      if (!validation.valid || !validation.payload) {
        setPendingValidation(null);
        setErrorMessage(
          `Archivo de copia inválido:\n${validation.errors?.join('\n') || 'Estructura no válida'}`,
        );
        return;
      }

      setErrorMessage(null);
      setPendingValidation(validation);
      setImportMode('replace'); // default to replace
      setImportModalOpen(true);
    } catch (err) {
      setErrorMessage(
        `Error al leer el archivo: ${err instanceof Error ? err.message : 'Error de lectura'}`,
      );
    }
  };

  const handleConfirmImport = () => {
    if (!pendingValidation?.payload) return;

    const result = importBackup(pendingValidation.payload, importMode);
    setImportModalOpen(false);
    setPendingValidation(null);

    if (result.success) {
      showToast(
        `Importación completada con éxito: ${result.accountsAdded} cuenta(s), ${result.tradesAdded} operación(es) incorporadas.`,
      );
    } else {
      setErrorMessage(`Fallo al aplicar la copia de seguridad: ${result.error}`);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Hidden File Input for JSON Import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#F5F7FA] flex items-center gap-2.5">
          <SettingsIcon className="w-6 h-6 text-[#00F0FF]" />
          {t.settings.title}
        </h1>
        <p className="text-sm text-[#94A3B8] mt-1">
          Preferencias de usuario, gestión de datos locales y copias de seguridad seguras
        </p>
      </div>

      {/* Storage Corruption / Quarantine Alert */}
      {corruptionReport && (
        <Alert
          variant="warning"
          title={t.settings.corruptedTitle}
          action={
            <div className="flex items-center gap-2 mt-2 sm:mt-0">
              <Button size="sm" variant="outline" onClick={handleTriggerFileInput}>
                <Upload className="w-3.5 h-3.5 mr-1" /> Importar Copia Válida
              </Button>
              <Button size="sm" variant="ghost" onClick={clearCorruption}>
                {t.settings.clearQuarantine}
              </Button>
            </div>
          }
        >
          <div className="space-y-1">
            <p className="text-xs">{t.settings.corruptedDesc}</p>
            <p className="text-[11px] text-[#94A3B8] font-mono">
              Clave afectada: <code className="text-[#F59E0B]">{corruptionReport.key}</code> · Copia en cuarentena:{' '}
              <code className="text-[#00F0FF]">{corruptionReport.quarantineKey}</code>
            </p>
          </div>
        </Alert>
      )}

      {toastMessage && (
        <Alert variant="success" title="Operación Exitosa">
          {toastMessage}
        </Alert>
      )}

      {errorMessage && (
        <Alert
          variant="error"
          title="Error en la Operación"
          action={
            <Button size="sm" variant="ghost" onClick={() => setErrorMessage(null)}>
              Cerrar
            </Button>
          }
        >
          <p className="text-xs whitespace-pre-line">{errorMessage}</p>
        </Alert>
      )}

      {/* Backup & Secure Recovery Section */}
      <Card
        title={t.settings.backupTitle}
        subtitle={t.settings.backupDescription}
      >
        <div className="space-y-4">
          {/* Export Action Card */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-[#0A1128] border border-[#1E2D4A] rounded-xl hover:border-[#00F0FF]/40 transition-colors">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <FileJson className="w-5 h-5 text-[#00F0FF]" />
                <h5 className="font-semibold text-sm text-[#F5F7FA]">
                  {t.settings.exportBackup}
                </h5>
                <Badge variant="cyan">Schema v1.0.0</Badge>
              </div>
              <p className="text-xs text-[#94A3B8]">
                {t.settings.exportDescription}
              </p>
            </div>

            <Button
              onClick={handleExportBackup}
              variant="primary"
              size="sm"
              leftIcon={<Download className="w-4 h-4" />}
            >
              Exportar JSON
            </Button>
          </div>

          {/* Import Action Card */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-[#0A1128] border border-[#1E2D4A] rounded-xl hover:border-[#10B981]/40 transition-colors">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-[#10B981]" />
                <h5 className="font-semibold text-sm text-[#F5F7FA]">
                  {t.settings.importBackup}
                </h5>
                <Badge variant="green">Validación Zod</Badge>
              </div>
              <p className="text-xs text-[#94A3B8]">
                {t.settings.importDescription}
              </p>
            </div>

            <Button
              onClick={handleTriggerFileInput}
              variant="outline"
              size="sm"
              leftIcon={<Upload className="w-4 h-4" />}
            >
              Cargar Archivo...
            </Button>
          </div>
        </div>
      </Card>

      {/* Cloud Persistence & Supabase Sync Section */}
      <Card
        title="Persistencia en la Nube y Sincronización (Supabase)"
        subtitle="Sincronización bidireccional cifrada con PostgreSQL y Row Level Security (RLS)"
      >
        <div className="space-y-4">
          {!isConfigured ? (
            <div className="p-4 bg-[#0A1128] border border-[#1E2D4A] rounded-xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-[#3B82F6]/10 text-[#3B82F6]">
                    <CloudOff className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h5 className="font-semibold text-sm text-[#F5F7FA]">
                        Modo Local Activo (Offline-First)
                      </h5>
                      <Badge variant="yellow">Supabase no configurado</Badge>
                    </div>
                    <p className="text-xs text-[#94A3B8] mt-0.5">
                      Todos los datos están guardados de forma segura en LocalStorage de este navegador.
                    </p>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAuthModalOpen(true)}
                  leftIcon={<Database className="w-3.5 h-3.5 text-[#00F0FF]" />}
                >
                  Configurar Supabase
                </Button>
              </div>

              <div className="p-3 bg-[#111C35] rounded-lg border border-[#1E2D4A]/60 text-xs space-y-1.5">
                <p className="text-[#94A3B8]">
                  Para habilitar el respaldo multi-dispositivo y la sincronización en la nube, añade tus credenciales en{' '}
                  <code className="text-[#00F0FF]">.env.local</code>:
                </p>
                <code className="block bg-[#0A1128] p-2 rounded text-[11px] text-[#00F0FF] font-mono select-all">
                  NEXT_PUBLIC_SUPABASE_URL=https://xyz.supabase.co
                  <br />
                  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
                </code>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-[#0A1128] border border-[#1E2D4A] rounded-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-lg ${user ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-[#EAB308]/10 text-[#EAB308]'}`}>
                    <Cloud className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h5 className="font-semibold text-sm text-[#F5F7FA]">
                        {user ? user.email : 'Sesión de Supabase no iniciada'}
                      </h5>
                      <Badge variant={user ? 'green' : 'yellow'}>
                        {user ? 'Autenticado' : 'Sin Sesión'}
                      </Badge>
                      {isOnline ? (
                        <span className="text-[10px] text-[#10B981] flex items-center gap-1">● Online</span>
                      ) : (
                        <span className="text-[10px] text-[#EF4444] flex items-center gap-1">● Offline</span>
                      )}
                    </div>
                    <p className="text-xs text-[#94A3B8] mt-0.5">
                      {user
                        ? `ID de usuario: ${user.id.slice(0, 12)}... · Row Level Security activo`
                        : 'Inicia sesión para sincronizar tus cuentas y operaciones con la nube.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!user ? (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => setAuthModalOpen(true)}
                      leftIcon={<LogIn className="w-3.5 h-3.5" />}
                    >
                      Iniciar Sesión
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const res = await syncNow();
                          if (res.success) {
                            showToast('Sincronización con la nube completada con éxito');
                          } else {
                            setErrorMessage(res.error || 'Error al sincronizar');
                          }
                        }}
                        disabled={isSyncing || !isOnline}
                        leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />}
                      >
                        {isSyncing ? 'Sincronizando...' : 'Sincronizar Ahora'}
                      </Button>

                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setMigrationModalOpen(true)}
                        leftIcon={<CloudUpload className="w-3.5 h-3.5" />}
                      >
                        Asistente Migración
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={signOut}
                        className="text-[#EF4444] hover:bg-[#EF4444]/10"
                        leftIcon={<LogOut className="w-3.5 h-3.5" />}
                      >
                        Salir
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {lastSyncTime && (
                <div className="text-[11px] text-[#94A3B8] flex items-center gap-1.5 pt-2 border-t border-[#1E2D4A]/60">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
                  <span>Última sincronización exitosa: {new Date(lastSyncTime).toLocaleTimeString()}</span>
                </div>
              )}
            </div>
          )}

          <div className="p-3 rounded-lg bg-[#0A1128]/60 border border-[#1E2D4A]/40 text-xs text-[#94A3B8] space-y-1">
            <span className="font-semibold text-[#F5F7FA] block">Seguridad y Políticas RLS:</span>
            <p>
              Todas las tablas de Supabase (perfiles, cuentas, operaciones, diario y configuración) tienen habilitado
              aislamiento criptográfico <strong className="text-[#00F0FF]">Row Level Security (RLS)</strong>. Ningún otro usuario
              puede acceder, consultar ni modificar tus registros.
            </p>
          </div>
        </div>
      </Card>

      {/* Preferences Section */}
      <Card title="Preferencias de la Plataforma">
        <div className="space-y-5">
          {/* Language Selection */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#1E2D4A]/60">
            <div>
              <span className="font-semibold text-sm text-[#F5F7FA] flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#00F0FF]" /> {t.settings.language}
              </span>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Selecciona el idioma principal de la interfaz
              </p>
            </div>

            <div className="flex bg-[#0A1128] border border-[#1E2D4A] rounded-xl p-1">
              <button
                onClick={() => handleLanguageChange('es')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  locale === 'es'
                    ? 'bg-[#00F0FF] text-[#0A1128] shadow-md'
                    : 'text-[#94A3B8] hover:text-[#F5F7FA]'
                }`}
              >
                🇪🇸 {t.settings.spanish}
              </button>
              <button
                onClick={() => handleLanguageChange('en')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  locale === 'en'
                    ? 'bg-[#00F0FF] text-[#0A1128] shadow-md'
                    : 'text-[#94A3B8] hover:text-[#F5F7FA]'
                }`}
              >
                🇺🇸 {t.settings.english}
              </button>
            </div>
          </div>

          {/* Default Account */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#1E2D4A]/60">
            <div>
              <span className="font-semibold text-sm text-[#F5F7FA] flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[#00F0FF]" /> {t.settings.defaultAccount}
              </span>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Cuenta seleccionada por defecto al abrir la aplicación
              </p>
            </div>

            <Select
              value={settings.defaultAccountId}
              onChange={(e) => handleDefaultAccountChange(e.target.value)}
              className="w-full sm:w-60 text-xs py-1.5"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.type})
                </option>
              ))}
            </Select>
          </div>

          {/* Theme Indicator */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="font-semibold text-sm text-[#F5F7FA] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#10B981]" /> Tema y Apariencia
              </span>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Tema de alto contraste optimizado para salas de trading
              </p>
            </div>

            <span className="px-3 py-1 bg-[#0A1128] border border-[#1E2D4A] rounded-lg text-xs font-semibold text-[#00F0FF]">
              Fintech Dark Navy (Activo)
            </span>
          </div>
        </div>
      </Card>

      {/* Storage & Privacy Information */}
      <Card title="Privacidad y Almacenamiento Local">
        <div className="space-y-4">
          <Alert variant="info" title="Persistencia Segura en el Navegador">
            {t.settings.storageInfo}
          </Alert>

          <p className="text-xs text-[#94A3B8] leading-relaxed">
            TradeRisk Manager está diseñado bajo un modelo Zero-Knowledge del lado del servidor:
            tus cuentas, operaciones, montos y notas psicológicas residen 100% en el almacenamiento
            local (<code className="text-[#00F0FF]">localStorage</code>) de tu navegador. Ninguna API
            remota recopila tus balances ni historial de trading.
          </p>
        </div>
      </Card>

      {/* Data Management Actions */}
      <Card title="Mantenimiento y Restauración">
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-[#0A1128] border border-[#1E2D4A] rounded-xl">
            <div>
              <h5 className="font-semibold text-sm text-[#F5F7FA]">
                {t.settings.resetDemoData}
              </h5>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Restaura la cuenta demo de $5,000 con las 5 operaciones y 2 notas originales
              </p>
            </div>

            <Button
              onClick={() => setConfirmResetOpen(true)}
              variant="outline"
              size="sm"
              leftIcon={<RotateCcw className="w-4 h-4" />}
            >
              Resetear Demo
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-[#EF4444]/5 border border-[#EF4444]/20 rounded-xl">
            <div>
              <h5 className="font-semibold text-sm text-[#EF4444]">
                Borrado Completo de Datos
              </h5>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Elimina permanentemente todas las cuentas, operaciones y notas de la memoria local
              </p>
            </div>

            <Button
              onClick={() => setConfirmClearOpen(true)}
              variant="danger"
              size="sm"
              leftIcon={<Trash2 className="w-4 h-4" />}
            >
              Limpiar Todo
            </Button>
          </div>
        </div>
      </Card>

      {/* App Version Card */}
      <div className="flex items-center justify-between text-xs text-[#94A3B8] px-2">
        <span>TradeRisk Manager Platform</span>
        <span className="font-mono text-[#00F0FF]">v1.1.0 (Fase 4 Nube y Sincronización)</span>
      </div>

      {/* Modal: Backup Data Preview & Confirmation */}
      <Modal
        isOpen={importModalOpen}
        onClose={() => {
          setImportModalOpen(false);
          setPendingValidation(null);
        }}
        title={t.settings.importPreviewTitle}
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setImportModalOpen(false);
                setPendingValidation(null);
              }}
            >
              {t.settings.cancelImport}
            </Button>
            <Button variant="primary" size="sm" onClick={handleConfirmImport}>
              {t.settings.confirmImport}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-[#94A3B8]">
            {t.settings.importPreviewSubtitle}
          </p>

          {/* Stats Summary Grid */}
          {pendingValidation?.stats && (
            <div className="grid grid-cols-3 gap-2 p-3 bg-[#0A1128] border border-[#1E2D4A] rounded-xl text-center">
              <div>
                <span className="text-[11px] text-[#94A3B8] block">Cuentas</span>
                <span className="text-base font-bold text-[#00F0FF] font-mono">
                  {pendingValidation.stats.accountsCount}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-[#94A3B8] block">Operaciones</span>
                <span className="text-base font-bold text-[#10B981] font-mono">
                  {pendingValidation.stats.tradesCount}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-[#94A3B8] block">Notas Diario</span>
                <span className="text-base font-bold text-[#F5F7FA] font-mono">
                  {pendingValidation.stats.journalCount}
                </span>
              </div>
            </div>
          )}

          {/* Metadata Info */}
          <div className="text-xs text-[#94A3B8] space-y-1 bg-[#111C35] p-3 rounded-lg border border-[#1E2D4A]/50">
            <div>
              <span className="text-[#F5F7FA] font-medium">Fecha de generación: </span>
              {pendingValidation?.stats?.exportedAt
                ? new Date(pendingValidation.stats.exportedAt).toLocaleString()
                : 'N/A'}
            </div>
            <div>
              <span className="text-[#F5F7FA] font-medium">Versión del esquema: </span>
              {pendingValidation?.stats?.version}
            </div>
            <div>
              <span className="text-[#F5F7FA] font-medium">Cuentas incluidas: </span>
              {pendingValidation?.stats?.accountNames.join(', ')}
            </div>
          </div>

          {/* Import Mode Radio Selectors */}
          <div className="space-y-2 pt-2 border-t border-[#1E2D4A]/60">
            <label className="text-xs font-semibold text-[#F5F7FA] block">
              Modo de Restauración:
            </label>

            <div className="space-y-2">
              <label className="flex items-start gap-3 p-2.5 rounded-lg border border-[#1E2D4A] bg-[#0A1128] cursor-pointer hover:border-[#00F0FF]/40 transition-colors">
                <input
                  type="radio"
                  name="importMode"
                  value="replace"
                  checked={importMode === 'replace'}
                  onChange={() => setImportMode('replace')}
                  className="mt-0.5 accent-[#00F0FF]"
                />
                <div className="text-xs">
                  <span className="font-semibold text-[#F5F7FA] block">
                    {t.settings.importModeReplace}
                  </span>
                  <span className="text-[#94A3B8] text-[11px]">
                    {t.settings.importModeReplaceDesc}
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-2.5 rounded-lg border border-[#1E2D4A] bg-[#0A1128] cursor-pointer hover:border-[#10B981]/40 transition-colors">
                <input
                  type="radio"
                  name="importMode"
                  value="merge"
                  checked={importMode === 'merge'}
                  onChange={() => setImportMode('merge')}
                  className="mt-0.5 accent-[#10B981]"
                />
                <div className="text-xs">
                  <span className="font-semibold text-[#F5F7FA] block">
                    {t.settings.importModeMerge}
                  </span>
                  <span className="text-[#94A3B8] text-[11px]">
                    {t.settings.importModeMergeDesc}
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Security Notice */}
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-xs text-[#00F0FF]">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Tus datos actuales solo se modificarán al hacer clic en &quot;Confirmar Importación&quot;.</span>
          </div>
        </div>
      </Modal>

      {/* Modal: Confirm Reset Demo */}
      <Modal
        isOpen={confirmResetOpen}
        onClose={() => setConfirmResetOpen(false)}
        title={t.settings.resetDemoData}
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmResetOpen(false)}
            >
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={handleExecuteReset}>
              Confirmar Reseteo
            </Button>
          </>
        }
      >
        <p className="text-sm text-[#F5F7FA]">
          {t.settings.resetDemoConfirm}
        </p>
      </Modal>

      {/* Modal: Confirm Clear All */}
      <Modal
        isOpen={confirmClearOpen}
        onClose={() => setConfirmClearOpen(false)}
        title="¿Borrar todos los datos locales?"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmClearOpen(false)}
            >
              Cancelar
            </Button>
            <Button variant="danger" size="sm" onClick={handleExecuteClear}>
              Borrar Definitivamente
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-[#EF4444] shrink-0" />
          <p className="text-sm text-[#F5F7FA]">
            Esta acción borrará todas tus cuentas, operaciones y notas del navegador. No se podrá
            recuperar ningún registro a menos que tengas una copia de seguridad exportada.
          </p>
        </div>
      </Modal>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => {
          showToast('Sesión iniciada con éxito');
        }}
      />

      {/* Migration Wizard Modal */}
      <MigrationModal
        isOpen={migrationModalOpen}
        onClose={() => setMigrationModalOpen(false)}
        onCompleted={() => {
          showToast('Migración a la nube completada correctamente');
        }}
      />
    </div>
  );
}
