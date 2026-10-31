'use client';

import React, { useState } from 'react';
import {
  Wallet,
  Plus,
  Edit2,
  Trash2,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { useLocale } from '@/lib/i18n/useLocale';
import { useStorage } from '@/hooks/useStorage';
import type { Account, AccountType, DrawdownType } from '@/lib/types';
import { formatCurrency } from '@/lib/i18n';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';

export default function AccountsPage() {
  const { locale, t } = useLocale();
  const { accounts, activeAccountId, selectAccount, addAccount, updateAccount, deleteAccount } =
    useStorage();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('Personal');
  const [initialCapital, setInitialCapital] = useState('10000');
  const [currency, setCurrency] = useState('USD');
  const [profitTarget, setProfitTarget] = useState('10');
  const [dailyLossLimit, setDailyLossLimit] = useState('3');
  const [maxDrawdown, setMaxDrawdown] = useState('6');
  const [drawdownType, setDrawdownType] = useState<DrawdownType>('static');
  const [riskPerTrade, setRiskPerTrade] = useState('0.5');
  const [leverage, setLeverage] = useState('1');
  const [timezone, setTimezone] = useState('America/New_York');

  const openCreateModal = () => {
    setName('');
    setType('Personal');
    setInitialCapital('10000');
    setCurrency('USD');
    setProfitTarget('10');
    setDailyLossLimit('3');
    setMaxDrawdown('6');
    setDrawdownType('static');
    setRiskPerTrade('0.5');
    setLeverage('1');
    setTimezone('America/New_York');
    setErrorMessage(null);
    setIsCreateModalOpen(true);
  };

  const openEditModal = (account: Account) => {
    setEditingAccount(account);
    setName(account.name);
    setType(account.type);
    setInitialCapital(String(account.initialCapital));
    setCurrency(account.currency);
    setProfitTarget(String(account.profitTarget));
    setDailyLossLimit(String(account.dailyLossLimit));
    setMaxDrawdown(String(account.maxDrawdown));
    setDrawdownType(account.drawdownType);
    setRiskPerTrade(String(account.riskPerTrade));
    setLeverage(String(account.leverage));
    setTimezone(account.timezone);
    setErrorMessage(null);
  };

  const handleSaveCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('El nombre de la cuenta es obligatorio');
      return;
    }
    const cap = parseFloat(initialCapital);
    if (!cap || cap <= 0) {
      setErrorMessage('El capital inicial debe ser mayor a 0');
      return;
    }

    addAccount({
      name: name.trim(),
      type,
      initialCapital: cap,
      balance: cap,
      equity: cap,
      currency: currency.toUpperCase(),
      profitTarget: parseFloat(profitTarget) || 10,
      dailyLossLimit: parseFloat(dailyLossLimit) || 3,
      maxDrawdown: parseFloat(maxDrawdown) || 6,
      drawdownType,
      timezone,
      dailyResetHour: 17,
      riskPerTrade: parseFloat(riskPerTrade) || 0.5,
      leverage: parseFloat(leverage) || 1,
    });

    setIsCreateModalOpen(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    if (!name.trim()) {
      setErrorMessage('El nombre de la cuenta es obligatorio');
      return;
    }

    const cap = parseFloat(initialCapital);
    const updated: Account = {
      ...editingAccount,
      name: name.trim(),
      type,
      initialCapital: cap > 0 ? cap : editingAccount.initialCapital,
      currency: currency.toUpperCase(),
      profitTarget: parseFloat(profitTarget) || editingAccount.profitTarget,
      dailyLossLimit: parseFloat(dailyLossLimit) || editingAccount.dailyLossLimit,
      maxDrawdown: parseFloat(maxDrawdown) || editingAccount.maxDrawdown,
      drawdownType,
      timezone,
      riskPerTrade: parseFloat(riskPerTrade) || editingAccount.riskPerTrade,
      leverage: parseFloat(leverage) || editingAccount.leverage,
      updatedAt: new Date().toISOString(),
    };

    updateAccount(updated);
    setEditingAccount(null);
  };

  const handleDelete = (id: string) => {
    if (accounts.length <= 1) {
      alert('No puedes eliminar la única cuenta existente.');
      return;
    }
    deleteAccount(id);
    setDeleteConfirmId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#F5F7FA] flex items-center gap-2.5">
            <Wallet className="w-6 h-6 text-[#00F0FF]" />
            {t.accounts.title}
          </h1>
          <p className="text-sm text-[#94A3B8] mt-1">
            Administra tus cuentas personales, prop firms, brokers o exchanges
          </p>
        </div>

        <Button
          onClick={openCreateModal}
          variant="primary"
          leftIcon={<Plus className="w-4 h-4" />}
        >
          {t.accounts.createAccount}
        </Button>
      </div>

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map((account) => {
          const isActive = account.id === activeAccountId;
          const pnl = account.balance - account.initialCapital;
          const pnlPercent = account.initialCapital > 0 ? (pnl / account.initialCapital) * 100 : 0;

          return (
            <Card
              key={account.id}
              className={`flex flex-col justify-between transition-all duration-200 ${
                isActive ? 'border-[#00F0FF]/60 shadow-[0_0_20px_rgba(0,240,255,0.15)] ring-1 ring-[#00F0FF]/40' : ''
              }`}
              title={
                <div className="flex items-center justify-between w-full pr-1">
                  <span className="truncate font-bold text-[#F5F7FA]">{account.name}</span>
                  <Badge variant={account.type === 'Demo' ? 'yellow' : 'cyan'} size="sm">
                    {account.type}
                  </Badge>
                </div>
              }
            >
              <div className="space-y-4">
                {/* Balance and PnL */}
                <div className="flex items-baseline justify-between pt-1">
                  <div>
                    <span className="text-[11px] text-[#94A3B8] block">Balance Actual</span>
                    <span className="text-2xl font-bold text-[#F5F7FA] font-mono">
                      {formatCurrency(account.balance, account.currency, locale)}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] text-[#94A3B8] block">P&L Histórico</span>
                    <span
                      className={`text-sm font-semibold font-mono ${
                        pnl >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                      }`}
                    >
                      {pnl >= 0 ? '+' : ''}
                      {formatCurrency(pnl, account.currency, locale)} ({pnlPercent.toFixed(1)}%)
                    </span>
                  </div>
                </div>

                {/* Rules Details */}
                <div className="grid grid-cols-2 gap-2 p-3 bg-[#0A1128]/70 border border-[#1E2D4A] rounded-xl text-xs">
                  <div>
                    <span className="text-[#94A3B8] block text-[10px]">Capital Inicial</span>
                    <span className="font-medium text-[#F5F7FA]">
                      {formatCurrency(account.initialCapital, account.currency, locale)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[#94A3B8] block text-[10px]">Riesgo por Trade</span>
                    <span className="font-medium text-[#00F0FF]">{account.riskPerTrade}%</span>
                  </div>

                  <div>
                    <span className="text-[#94A3B8] block text-[10px]">Objetivo Target</span>
                    <span className="font-medium text-[#10B981]">{account.profitTarget}%</span>
                  </div>

                  <div>
                    <span className="text-[#94A3B8] block text-[10px]">Max Drawdown</span>
                    <span className="font-medium text-[#EF4444]">
                      {account.maxDrawdown}% ({account.drawdownType})
                    </span>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-[#1E2D4A]/60">
                  {isActive ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00F0FF]">
                      <Check className="w-4 h-4" /> Cuenta Activa
                    </span>
                  ) : (
                    <Button
                      onClick={() => selectAccount(account.id)}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                    >
                      Seleccionar
                    </Button>
                  )}

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(account)}
                      className="p-1.5 text-[#94A3B8] hover:text-[#00F0FF] hover:bg-[#1A2744] rounded-lg transition-colors"
                      title="Editar cuenta"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setDeleteConfirmId(account.id)}
                      disabled={accounts.length <= 1}
                      className="p-1.5 text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#1A2744] rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title={accounts.length <= 1 ? 'No puedes eliminar la única cuenta' : 'Eliminar cuenta'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Modal: Crear Cuenta */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Crear Nueva Cuenta"
        subtitle="Configura una nueva cuenta con sus reglas de riesgo asociadas"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={handleSaveCreate}>
              Crear Cuenta
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveCreate} className="space-y-4">
          {errorMessage && (
            <Alert variant="error">{errorMessage}</Alert>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Nombre de la Cuenta"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. FTMO 100k, Binance Spot"
              required
            />

            <Select
              label="Tipo de Cuenta"
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
            >
              <option value="PropFirm">PropFirm</option>
              <option value="Personal">Personal</option>
              <option value="Exchange">Exchange</option>
              <option value="Broker">Broker</option>
              <option value="Demo">Demo</option>
              <option value="Custom">Personalizada</option>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Capital Inicial"
              type="number"
              value={initialCapital}
              onChange={(e) => setInitialCapital(e.target.value)}
              prefixText="$"
              required
            />

            <Input
              label="Moneda"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              placeholder="USD, EUR, USDT"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Profit Target"
              type="number"
              value={profitTarget}
              onChange={(e) => setProfitTarget(e.target.value)}
              suffixText="%"
            />

            <Input
              label="Pérdida Diaria"
              type="number"
              value={dailyLossLimit}
              onChange={(e) => setDailyLossLimit(e.target.value)}
              suffixText="%"
            />

            <Input
              label="Max Drawdown"
              type="number"
              value={maxDrawdown}
              onChange={(e) => setMaxDrawdown(e.target.value)}
              suffixText="%"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Select
              label="Tipo Drawdown"
              value={drawdownType}
              onChange={(e) => setDrawdownType(e.target.value as DrawdownType)}
            >
              <option value="static">Estático</option>
              <option value="trailing">Trailing</option>
              <option value="custom">Personalizado</option>
            </Select>

            <Input
              label="Riesgo/Trade"
              type="number"
              step="0.05"
              value={riskPerTrade}
              onChange={(e) => setRiskPerTrade(e.target.value)}
              suffixText="%"
            />

            <Input
              label="Apalancamiento"
              type="number"
              value={leverage}
              onChange={(e) => setLeverage(e.target.value)}
              suffixText="x"
            />
          </div>
        </form>
      </Modal>

      {/* Modal: Editar Cuenta */}
      <Modal
        isOpen={Boolean(editingAccount)}
        onClose={() => setEditingAccount(null)}
        title="Editar Cuenta"
        subtitle={`Modificando parámetros para ${editingAccount?.name}`}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setEditingAccount(null)}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={handleSaveEdit}>
              Guardar Cambios
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          {errorMessage && (
            <Alert variant="error">{errorMessage}</Alert>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Nombre de la Cuenta"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <Select
              label="Tipo de Cuenta"
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
            >
              <option value="PropFirm">PropFirm</option>
              <option value="Personal">Personal</option>
              <option value="Exchange">Exchange</option>
              <option value="Broker">Broker</option>
              <option value="Demo">Demo</option>
              <option value="Custom">Personalizada</option>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Profit Target"
              type="number"
              value={profitTarget}
              onChange={(e) => setProfitTarget(e.target.value)}
              suffixText="%"
            />

            <Input
              label="Pérdida Diaria"
              type="number"
              value={dailyLossLimit}
              onChange={(e) => setDailyLossLimit(e.target.value)}
              suffixText="%"
            />

            <Input
              label="Max Drawdown"
              type="number"
              value={maxDrawdown}
              onChange={(e) => setMaxDrawdown(e.target.value)}
              suffixText="%"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Riesgo Máximo / Trade"
              type="number"
              step="0.05"
              value={riskPerTrade}
              onChange={(e) => setRiskPerTrade(e.target.value)}
              suffixText="%"
            />

            <Input
              label="Apalancamiento"
              type="number"
              value={leverage}
              onChange={(e) => setLeverage(e.target.value)}
              suffixText="x"
            />
          </div>
        </form>
      </Modal>

      {/* Modal: Confirmar Eliminación */}
      <Modal
        isOpen={Boolean(deleteConfirmId)}
        onClose={() => setDeleteConfirmId(null)}
        title="Confirmar Eliminación"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirmId(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            >
              Eliminar Definitivamente
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-[#EF4444] shrink-0" />
          <p className="text-sm text-[#F5F7FA]">
            ¿Estás seguro de que deseas eliminar esta cuenta? Se mantendrán las operaciones
            pero la cuenta dejará de estar disponible para nuevos registros.
          </p>
        </div>
      </Modal>
    </div>
  );
}
