'use client';

import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Plus,
  Search,
  Clock,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { useLocale } from '@/lib/i18n/useLocale';
import { useStorage } from '@/hooks/useStorage';
import type { Trade, Direction, TradeStatus } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/i18n';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Table, TableRow, TableCell } from '@/components/ui/Table';
import { Alert } from '@/components/ui/Alert';

export default function TradesPage() {
  const { locale, t } = useLocale();
  const {
    activeAccount,
    accounts,
    trades,
    addTrade,
    updateTrade,
    deleteTrade,
  } = useStorage();

  const isEs = locale === 'es';

  // Filter States
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | TradeStatus>('all');
  const [directionFilter, setDirectionFilter] = useState<'all' | Direction>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal States
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [closingTrade, setClosingTrade] = useState<Trade | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // New Trade Form State
  const [formAccountId, setFormAccountId] = useState(activeAccount?.id || '');
  const [asset, setAsset] = useState('BTC/USDT');
  const [direction, setDirection] = useState<Direction>('long');
  const [entryPrice, setEntryPrice] = useState('');
  const [exitPrice, setExitPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [size, setSize] = useState('');
  const [status, setStatus] = useState<TradeStatus>('open');
  const [result, setResult] = useState('');
  const [commissions, setCommissions] = useState('0');
  const [strategy, setStrategy] = useState('');
  const [timeframe, setTimeframe] = useState('1h');
  const [notes, setNotes] = useState('');

  // Close Trade Form State
  const [closeExitPrice, setCloseExitPrice] = useState('');
  const [closeResult, setCloseResult] = useState('');

  // Open Add Modal
  const openAddModal = () => {
    setFormAccountId(activeAccount?.id || accounts[0]?.id || '');
    setAsset('BTC/USDT');
    setDirection('long');
    setEntryPrice('');
    setExitPrice('');
    setStopLoss('');
    setTakeProfit('');
    setSize('');
    setStatus('open');
    setResult('');
    setCommissions('0');
    setStrategy('');
    setTimeframe('1h');
    setNotes('');
    setFormError(null);
    setIsNewModalOpen(true);
  };

  const handleSaveTrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!asset.trim()) {
      setFormError(isEs ? 'El activo es obligatorio (ej. BTC/USDT)' : 'Asset is required (e.g. BTC/USDT)');
      return;
    }
    const entry = parseFloat(entryPrice);
    const sl = parseFloat(stopLoss);
    const sz = parseFloat(size);

    if (!entry || entry <= 0) {
      setFormError(isEs ? 'El precio de entrada debe ser mayor a 0' : 'Entry price must be positive');
      return;
    }
    if (!sl || sl <= 0) {
      setFormError(isEs ? 'El stop loss debe ser mayor a 0' : 'Stop loss must be positive');
      return;
    }
    if (!sz || sz <= 0) {
      setFormError(isEs ? 'El tamaño de la posición debe ser mayor a 0' : 'Position size must be positive');
      return;
    }

    if (direction === 'long' && sl >= entry) {
      setFormError(
        isEs
          ? 'Para Long, el Stop Loss debe ser menor al precio de entrada'
          : 'For Long, Stop Loss must be below entry price',
      );
      return;
    }
    if (direction === 'short' && sl <= entry) {
      setFormError(
        isEs
          ? 'Para Short, el Stop Loss debe ser mayor al precio de entrada'
          : 'For Short, Stop Loss must be above entry price',
      );
      return;
    }

    addTrade({
      accountId: formAccountId || activeAccount?.id || accounts[0]?.id || '',
      asset: asset.toUpperCase().trim(),
      direction,
      entryPrice: entry,
      exitPrice: exitPrice ? parseFloat(exitPrice) : undefined,
      stopLoss: sl,
      takeProfit: takeProfit ? parseFloat(takeProfit) : 0,
      size: sz,
      status,
      result: status === 'closed' && result !== '' ? parseFloat(result) : undefined,
      commissions: parseFloat(commissions) || 0,
      openDate: new Date().toISOString(),
      closeDate: status === 'closed' ? new Date().toISOString() : undefined,
      strategy: strategy.trim(),
      timeframe,
      notes: notes.trim(),
    });

    setIsNewModalOpen(false);
  };

  const handleConfirmClose = (e: React.FormEvent) => {
    e.preventDefault();
    if (!closingTrade) return;

    const exit = parseFloat(closeExitPrice);
    const res = parseFloat(closeResult);

    if (isNaN(exit) || exit <= 0) {
      alert(isEs ? 'Ingresa un precio de salida válido' : 'Enter a valid exit price');
      return;
    }

    const calculatedPnl =
      (closingTrade.direction === 'long'
        ? exit - closingTrade.entryPrice
        : closingTrade.entryPrice - exit) * closingTrade.size;

    const updated: Trade = {
      ...closingTrade,
      status: 'closed',
      exitPrice: exit,
      result: !isNaN(res) ? res : calculatedPnl,
      closeDate: new Date().toISOString(),
    };

    updateTrade(updated);
    setClosingTrade(null);
  };

  const filteredTrades = useMemo(() => {
    return trades.filter((trade) => {
      if (selectedAccountId !== 'all' && trade.accountId !== selectedAccountId) {
        return false;
      }
      if (statusFilter !== 'all' && trade.status !== statusFilter) {
        return false;
      }
      if (directionFilter !== 'all' && trade.direction !== directionFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          trade.asset.toLowerCase().includes(query) ||
          trade.strategy.toLowerCase().includes(query) ||
          trade.notes.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [trades, selectedAccountId, statusFilter, directionFilter, searchQuery]);

  const totalClosed = filteredTrades.filter((t) => t.status === 'closed');
  const netPnL = totalClosed.reduce((sum, t) => sum + (t.result ?? 0), 0);
  const wins = totalClosed.filter((t) => (t.result ?? 0) > 0).length;
  const winRate = totalClosed.length > 0 ? (wins / totalClosed.length) * 100 : 0;

  const tableHeaders = isEs
    ? ['Fecha', 'Activo', 'Dirección', 'Entrada', 'Salida / SL', 'Tamaño', 'Resultado', 'Estado', 'Acciones']
    : ['Date', 'Asset', 'Direction', 'Entry', 'Exit / SL', 'Size', 'Result', 'Status', 'Actions'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#F5F7FA] flex items-center gap-2.5">
            <TrendingUp className="w-6 h-6 text-[#00F0FF]" />
            {t.trades.title}
          </h1>
          <p className="text-sm text-[#94A3B8] mt-1">
            {isEs
              ? 'Registro, monitoreo y auditoría de todas tus operaciones de trading'
              : 'Log, track and audit all your trading positions'}
          </p>
        </div>

        <Button
          onClick={openAddModal}
          variant="primary"
          leftIcon={<Plus className="w-4 h-4" />}
        >
          {t.trades.newTrade}
        </Button>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#111C35] border border-[#1E2D4A] p-4 rounded-xl">
        <div>
          <span className="text-[11px] text-[#94A3B8] block">
            {isEs ? 'Operaciones Filtradas' : 'Filtered Trades'}
          </span>
          <span className="text-lg font-bold text-[#F5F7FA]">{filteredTrades.length}</span>
        </div>
        <div>
          <span className="text-[11px] text-[#94A3B8] block">
            {isEs ? 'Abiertas / En curso' : 'Open Positions'}
          </span>
          <span className="text-lg font-bold text-[#00F0FF]">
            {filteredTrades.filter((t) => t.status === 'open').length}
          </span>
        </div>
        <div>
          <span className="text-[11px] text-[#94A3B8] block">
            {isEs ? 'P&L Acumulado' : 'Cumulative P&L'}
          </span>
          <span
            className={`text-lg font-bold font-mono ${
              netPnL >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
            }`}
          >
            {netPnL >= 0 ? '+' : ''}
            {formatCurrency(netPnL, activeAccount?.currency || 'USD', locale)}
          </span>
        </div>
        <div>
          <span className="text-[11px] text-[#94A3B8] block">Win Rate</span>
          <span className="text-lg font-bold text-[#10B981]">{winRate.toFixed(1)}%</span>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="p-4" noPadding>
        <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-[#94A3B8]" />
            <input
              type="text"
              placeholder={isEs ? 'Buscar por activo, estrategia o notas...' : 'Search by asset, strategy or notes...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-sm text-[#F5F7FA] placeholder-[#475569] outline-none w-full"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Account filter */}
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="bg-[#0A1128] border border-[#1E2D4A] rounded-lg text-xs text-[#F5F7FA] px-2.5 py-1.5 outline-none focus:border-[#00F0FF]"
            >
              <option value="all">{isEs ? 'Todas las cuentas' : 'All Accounts'}</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | TradeStatus)}
              className="bg-[#0A1128] border border-[#1E2D4A] rounded-lg text-xs text-[#F5F7FA] px-2.5 py-1.5 outline-none focus:border-[#00F0FF]"
            >
              <option value="all">{isEs ? 'Todos los estados' : 'All Statuses'}</option>
              <option value="open">{t.trades.open}</option>
              <option value="closed">{t.trades.closed}</option>
            </select>

            {/* Direction filter */}
            <select
              value={directionFilter}
              onChange={(e) => setDirectionFilter(e.target.value as 'all' | Direction)}
              className="bg-[#0A1128] border border-[#1E2D4A] rounded-lg text-xs text-[#F5F7FA] px-2.5 py-1.5 outline-none focus:border-[#00F0FF]"
            >
              <option value="all">{isEs ? 'Todas las direcciones' : 'All Directions'}</option>
              <option value="long">{t.trades.long}</option>
              <option value="short">{t.trades.short}</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Trades Table */}
      <Table
        headers={tableHeaders}
        isEmpty={filteredTrades.length === 0}
        emptyText={isEs ? 'No se encontraron operaciones con los filtros aplicados' : 'No trades match the current filters'}
      >
        {filteredTrades.map((trade) => {
          const isProfit = (trade.result ?? 0) >= 0;
          return (
            <TableRow key={trade.id}>
              {/* Date */}
              <TableCell className="text-xs text-[#94A3B8]">
                {formatDate(trade.openDate, locale)}
              </TableCell>

              {/* Asset & Strategy */}
              <TableCell>
                <div className="font-semibold text-xs text-[#F5F7FA]">{trade.asset}</div>
                {trade.strategy && (
                  <div className="text-[10px] text-[#94A3B8]">{trade.strategy}</div>
                )}
              </TableCell>

              {/* Direction */}
              <TableCell>
                <Badge
                  variant={trade.direction === 'long' ? 'green' : 'red'}
                  size="sm"
                >
                  {trade.direction.toUpperCase()}
                </Badge>
              </TableCell>

              {/* Entry */}
              <TableCell className="font-mono text-xs">
                ${trade.entryPrice.toLocaleString()}
              </TableCell>

              {/* Exit / SL */}
              <TableCell className="font-mono text-xs">
                {trade.exitPrice != null ? (
                  `$${trade.exitPrice.toLocaleString()}`
                ) : (
                  <span className="text-[#EF4444]">SL: ${trade.stopLoss.toLocaleString()}</span>
                )}
              </TableCell>

              {/* Size */}
              <TableCell className="font-mono text-xs text-[#94A3B8]">
                {trade.size}
              </TableCell>

              {/* Result */}
              <TableCell>
                {trade.status === 'closed' && trade.result != null ? (
                  <span
                    className={`font-semibold font-mono text-xs ${
                      isProfit ? 'text-[#10B981]' : 'text-[#EF4444]'
                    }`}
                  >
                    {isProfit ? '+' : ''}
                    {formatCurrency(trade.result, activeAccount?.currency || 'USD', locale)}
                  </span>
                ) : (
                  <span className="text-xs text-[#00F0FF] font-medium flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {isEs ? 'Abierta' : 'Open'}
                  </span>
                )}
              </TableCell>

              {/* Status */}
              <TableCell>
                <Badge
                  variant={trade.status === 'open' ? 'cyan' : 'gray'}
                  size="sm"
                  dot={trade.status === 'open'}
                >
                  {trade.status === 'open' ? (isEs ? 'Abierta' : 'Open') : (isEs ? 'Cerrada' : 'Closed')}
                </Badge>
              </TableCell>

              {/* Actions */}
              <TableCell>
                <div className="flex items-center gap-1.5">
                  {trade.status === 'open' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-[11px] py-1 px-2 text-[#00F0FF] hover:bg-[#00F0FF]/10"
                      onClick={() => {
                        setClosingTrade(trade);
                        setCloseExitPrice(String(trade.entryPrice));
                        setCloseResult('0');
                      }}
                    >
                      {isEs ? 'Cerrar' : 'Close'}
                    </Button>
                  )}

                  <button
                    onClick={() => setDeleteConfirmId(trade.id)}
                    className="p-1 text-[#94A3B8] hover:text-[#EF4444] rounded hover:bg-[#1A2744] transition-colors"
                    title={isEs ? 'Eliminar operación' : 'Delete trade'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </Table>

      {/* Modal: Nueva Operación */}
      <Modal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        title={t.trades.newTrade}
        subtitle={isEs ? 'Ingresa los detalles de la posición para su seguimiento' : 'Enter trade details for risk tracking'}
        size="lg"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsNewModalOpen(false)}
            >
              {t.common.cancel}
            </Button>
            <Button variant="primary" size="sm" onClick={handleSaveTrade}>
              {t.common.save}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveTrade} className="space-y-4">
          {formError && <Alert variant="error">{formError}</Alert>}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label={t.trades.account}
              value={formAccountId}
              onChange={(e) => setFormAccountId(e.target.value)}
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </Select>

            <Input
              label={t.trades.asset}
              value={asset}
              onChange={(e) => setAsset(e.target.value)}
              placeholder="BTC/USDT"
              required
            />

            <Select
              label={t.trades.direction}
              value={direction}
              onChange={(e) => setDirection(e.target.value as Direction)}
            >
              <option value="long">Long</option>
              <option value="short">Short</option>
            </Select>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Input
              label={t.trades.entryPrice}
              type="number"
              step="any"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              prefixText="$"
              required
            />

            <Input
              label={t.trades.stopLoss}
              type="number"
              step="any"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              prefixText="$"
              required
            />

            <Input
              label={t.trades.takeProfit}
              type="number"
              step="any"
              value={takeProfit}
              onChange={(e) => setTakeProfit(e.target.value)}
              prefixText="$"
            />

            <Input
              label={t.trades.size}
              type="number"
              step="any"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label={t.trades.status}
              value={status}
              onChange={(e) => setStatus(e.target.value as TradeStatus)}
            >
              <option value="open">{t.trades.open}</option>
              <option value="closed">{t.trades.closed}</option>
            </Select>

            {status === 'closed' && (
              <>
                <Input
                  label={t.trades.exitPrice}
                  type="number"
                  step="any"
                  value={exitPrice}
                  onChange={(e) => setExitPrice(e.target.value)}
                  prefixText="$"
                />

                <Input
                  label={t.trades.result}
                  type="number"
                  step="any"
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                  prefixText="$"
                />
              </>
            )}

            <Input
              label={t.trades.commissions}
              type="number"
              step="any"
              value={commissions}
              onChange={(e) => setCommissions(e.target.value)}
              prefixText="$"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t.trades.strategy}
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              placeholder="OrderBlock, Breakout..."
            />

            <Input
              label={t.trades.timeframe}
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              placeholder="15m, 1h, 4h, 1D"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#94A3B8]">{t.trades.notes}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full bg-[#0A1128] border border-[#1E2D4A] rounded-lg p-2.5 text-xs text-[#F5F7FA] outline-none focus:border-[#00F0FF]"
              placeholder={isEs ? 'Detalles del trade o contexto de mercado...' : 'Trade notes and market context...'}
            />
          </div>
        </form>
      </Modal>

      {/* Modal: Cerrar Operación */}
      <Modal
        isOpen={Boolean(closingTrade)}
        onClose={() => setClosingTrade(null)}
        title={isEs ? `Cerrar Operación: ${closingTrade?.asset}` : `Close Trade: ${closingTrade?.asset}`}
        subtitle={isEs ? 'Introduce los datos de salida para computar el resultado' : 'Enter exit details to calculate net P&L'}
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setClosingTrade(null)}
            >
              {t.common.cancel}
            </Button>
            <Button variant="primary" size="sm" onClick={handleConfirmClose}>
              {isEs ? 'Confirmar Cierre' : 'Confirm Close'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleConfirmClose} className="space-y-4">
          <div className="p-3 bg-[#0A1128] border border-[#1E2D4A] rounded-xl text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-[#94A3B8]">{t.trades.entryPrice}:</span>
              <span className="font-mono text-[#F5F7FA]">${closingTrade?.entryPrice}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#94A3B8]">{t.trades.direction} / {t.trades.size}:</span>
              <span className="text-[#F5F7FA]">
                {closingTrade?.direction.toUpperCase()} · {closingTrade?.size} units
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t.trades.exitPrice}
              type="number"
              step="any"
              value={closeExitPrice}
              onChange={(e) => {
                setCloseExitPrice(e.target.value);
                const exit = parseFloat(e.target.value);
                if (closingTrade && !isNaN(exit)) {
                  const pnl =
                    (closingTrade.direction === 'long'
                      ? exit - closingTrade.entryPrice
                      : closingTrade.entryPrice - exit) * closingTrade.size;
                  setCloseResult(pnl.toFixed(2));
                }
              }}
              prefixText="$"
              required
            />

            <Input
              label={isEs ? 'Resultado Neto ($ PnL)' : 'Net Result ($ PnL)'}
              type="number"
              step="any"
              value={closeResult}
              onChange={(e) => setCloseResult(e.target.value)}
              prefixText="$"
              required
            />
          </div>
        </form>
      </Modal>

      {/* Modal: Confirmar Eliminación */}
      <Modal
        isOpen={Boolean(deleteConfirmId)}
        onClose={() => setDeleteConfirmId(null)}
        title={t.trades.deleteTrade}
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirmId(null)}
            >
              {t.common.cancel}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (deleteConfirmId) {
                  deleteTrade(deleteConfirmId);
                  setDeleteConfirmId(null);
                }
              }}
            >
              {t.common.delete}
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[#EF4444] shrink-0" />
          <p className="text-sm text-[#F5F7FA]">
            {t.trades.deleteConfirm}
          </p>
        </div>
      </Modal>
    </div>
  );
}
