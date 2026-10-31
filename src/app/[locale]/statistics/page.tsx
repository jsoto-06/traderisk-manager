'use client';

import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Award,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Flame,
} from 'lucide-react';
import { useLocale } from '@/lib/i18n/useLocale';
import { useStorage } from '@/hooks/useStorage';
import { calculateStatistics } from '@/lib/statistics';
import { formatCurrency, formatDate } from '@/lib/i18n';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export default function StatisticsPage() {
  const { locale, t } = useLocale();
  const { activeAccount, accounts, trades } = useStorage();

  const [selectedAccountId, setSelectedAccountId] = useState(activeAccount?.id || 'all');

  const accountToAnalyze = useMemo(() => {
    return selectedAccountId === 'all'
      ? activeAccount
      : accounts.find((a) => a.id === selectedAccountId) || activeAccount;
  }, [accounts, selectedAccountId, activeAccount]);

  const relevantTrades = useMemo(() => {
    if (selectedAccountId === 'all') {
      return trades;
    }
    return trades.filter((t) => t.accountId === selectedAccountId);
  }, [trades, selectedAccountId]);

  const stats = useMemo(() => {
    const initialCap = accountToAnalyze?.initialCapital || 5000;
    return calculateStatistics(relevantTrades, initialCap);
  }, [relevantTrades, accountToAnalyze]);

  const currency = accountToAnalyze?.currency || 'USD';

  // Chart data
  const chartData = useMemo(() => {
    if (!stats || stats.balanceHistory.length === 0) return [];
    return stats.balanceHistory.map((item) => ({
      date: formatDate(item.date, locale),
      balance: item.balance,
    }));
  }, [stats, locale]);

  // Strategy breakdown
  const strategyStats = useMemo(() => {
    const closed = relevantTrades.filter((t) => t.status === 'closed' && t.result != null);
    const map = new Map<string, { count: number; profit: number; wins: number }>();

    closed.forEach((t) => {
      const strat = t.strategy || 'Sin clasificar';
      const existing = map.get(strat) || { count: 0, profit: 0, wins: 0 };
      existing.count += 1;
      existing.profit += (t.result ?? 0) - (t.commissions || 0);
      if ((t.result ?? 0) > 0) existing.wins += 1;
      map.set(strat, existing);
    });

    return Array.from(map.entries()).map(([strategy, data]) => ({
      strategy,
      count: data.count,
      profit: data.profit,
      winRate: data.count > 0 ? (data.wins / data.count) * 100 : 0,
    }));
  }, [relevantTrades]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#F5F7FA] flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-[#00F0FF]" />
            {t.statistics.title}
          </h1>
          <p className="text-sm text-[#94A3B8] mt-1">
            Análisis cuantitativo de rendimiento, consistencia y rachas operativas
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#94A3B8]">Filtrar Cuenta:</span>
          <Select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="py-1 text-xs"
          >
            <option value="all">Todas las cuentas</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Primary KPI Grid (4 cols) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Trades */}
        <StatCard
          title="Total Operaciones"
          value={stats.totalTrades}
          subtitle={`${stats.winningTrades} Ganadoras · ${stats.losingTrades} Perdedoras`}
          icon={<BarChart3 className="w-5 h-5 text-[#00F0FF]" />}
        />

        {/* Win Rate */}
        <StatCard
          title="Tasa de Acierto (Win Rate)"
          value={`${stats.winRate.toFixed(1)}%`}
          subtitle={
            stats.winRate >= 50
              ? 'Tasa por encima del benchmark positivo'
              : 'Atención al ratio riesgo/beneficio'
          }
          change={{
            value: `${stats.winRate.toFixed(1)}%`,
            isPositive: stats.winRate >= 50,
            isNegative: stats.winRate < 50,
          }}
          icon={<Award className="w-5 h-5 text-[#10B981]" />}
        />

        {/* Profit Factor */}
        <StatCard
          title="Factor de Beneficio"
          value={stats.profitFactor.toFixed(2)}
          subtitle={stats.profitFactor > 1.5 ? 'Excelente consistencia' : 'En desarrollo'}
          change={{
            value: `PF ${stats.profitFactor.toFixed(2)}`,
            isPositive: stats.profitFactor >= 1.5,
            isNegative: stats.profitFactor < 1.0,
          }}
          icon={<Zap className="w-5 h-5 text-[#F59E0B]" />}
        />

        {/* Net Profit */}
        <StatCard
          title="Beneficio Neto Total"
          value={
            <span className={stats.netProfit >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}>
              {stats.netProfit >= 0 ? '+' : ''}
              {formatCurrency(stats.netProfit, currency, locale)}
            </span>
          }
          subtitle={`Inicial: ${formatCurrency(accountToAnalyze?.initialCapital || 5000, currency, locale)}`}
          icon={
            stats.netProfit >= 0 ? (
              <TrendingUp className="w-5 h-5 text-[#10B981]" />
            ) : (
              <TrendingDown className="w-5 h-5 text-[#EF4444]" />
            )
          }
        />
      </div>

      {/* Secondary Metrics & Streaks Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card title="Ganancia / Pérdida Media">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#94A3B8] flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5 text-[#10B981]" /> Ganancia Media
              </span>
              <span className="text-sm font-semibold text-[#10B981] font-mono">
                +{formatCurrency(stats.averageWin, currency, locale)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#94A3B8] flex items-center gap-1">
                <ArrowDownRight className="w-3.5 h-3.5 text-[#EF4444]" /> Pérdida Media
              </span>
              <span className="text-sm font-semibold text-[#EF4444] font-mono">
                -{formatCurrency(stats.averageLoss, currency, locale)}
              </span>
            </div>
            <div className="pt-2 border-t border-[#1E2D4A] flex items-center justify-between text-xs">
              <span className="text-[#94A3B8]">Ratio Win/Loss:</span>
              <span className="font-semibold text-[#F5F7FA]">
                {stats.averageLoss > 0
                  ? (stats.averageWin / stats.averageLoss).toFixed(2)
                  : 'N/A'}
              </span>
            </div>
          </div>
        </Card>

        <Card title="Récord de Operaciones">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#94A3B8]">Mejor Operación</span>
              <span className="text-sm font-bold text-[#10B981] font-mono">
                +{formatCurrency(stats.bestTrade, currency, locale)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#94A3B8]">Peor Operación</span>
              <span className="text-sm font-bold text-[#EF4444] font-mono">
                {formatCurrency(stats.worstTrade, currency, locale)}
              </span>
            </div>
            <div className="pt-2 border-t border-[#1E2D4A] text-xs text-[#94A3B8]">
              Control de riesgo: {accountToAnalyze?.riskPerTrade || 0.5}% máximo
            </div>
          </div>
        </Card>

        <Card title="Rachas de Operativa">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#94A3B8] flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-[#10B981]" /> Racha Ganadora Máx
              </span>
              <span className="text-sm font-bold text-[#10B981]">
                {stats.maxWinStreak} seguidas
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#94A3B8] flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-[#EF4444]" /> Racha Perdedora Máx
              </span>
              <span className="text-sm font-bold text-[#EF4444]">
                {stats.maxLossStreak} seguidas
              </span>
            </div>
            <div className="pt-2 border-t border-[#1E2D4A] flex items-center justify-between text-xs">
              <span className="text-[#94A3B8]">Racha Actual:</span>
              <Badge
                variant={
                  stats.currentStreak.type === 'win'
                    ? 'green'
                    : stats.currentStreak.type === 'loss'
                    ? 'red'
                    : 'gray'
                }
                size="sm"
              >
                {stats.currentStreak.count} {stats.currentStreak.type.toUpperCase()}
              </Badge>
            </div>
          </div>
        </Card>

        <Card title="Estado de la Cuenta">
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-[#94A3B8]">Capital Actual:</span>
              <span className="font-mono text-[#F5F7FA]">
                {formatCurrency(accountToAnalyze?.balance || 5000, currency, locale)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#94A3B8]">Equidad Flotante:</span>
              <span className="font-mono text-[#00F0FF]">
                {formatCurrency(accountToAnalyze?.equity || 5000, currency, locale)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#94A3B8]">Apalancamiento:</span>
              <span className="text-[#F5F7FA]">{accountToAnalyze?.leverage || 1}x</span>
            </div>
            <div className="pt-1">
              <Badge variant="cyan" size="sm" className="w-full justify-center">
                Reglas Disciplinarias Activas
              </Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Balance Progression Chart */}
      <Card
        title="Curva de Equidad / Crecimiento de Capital"
        subtitle="Evolución acumulativa de balance tras cada operación cerrada"
      >
        <div className="h-80 w-full pt-4">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="statBalanceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00F0FF" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#00F0FF" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2D4A" opacity={0.5} />
                <XAxis
                  dataKey="date"
                  stroke="#475569"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#1E2D4A' }}
                />
                <YAxis
                  stroke="#475569"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#1E2D4A' }}
                  domain={['auto', 'auto']}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111C35',
                    borderColor: '#1E2D4A',
                    borderRadius: '8px',
                    color: '#F5F7FA',
                    fontSize: '12px',
                  }}
                  formatter={(val: unknown) => [
                    formatCurrency(Number(val) || 0, currency, locale),
                    'Balance',
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="#00F0FF"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#statBalanceGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-[#94A3B8]">
              Sin datos históricos suficientes
            </div>
          )}
        </div>
      </Card>

      {/* Strategy Performance Breakdown */}
      {strategyStats.length > 0 && (
        <Card
          title="Rendimiento por Estrategia"
          subtitle="Desglose de resultados según la estrategia aplicada"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {strategyStats.map((item) => (
              <div
                key={item.strategy}
                className="p-4 bg-[#0A1128] border border-[#1E2D4A] rounded-xl space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-[#F5F7FA]">
                    {item.strategy}
                  </span>
                  <Badge variant={item.winRate >= 50 ? 'green' : 'yellow'} size="sm">
                    {item.winRate.toFixed(0)}% Win
                  </Badge>
                </div>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-[#94A3B8]">{item.count} trades</span>
                  <span
                    className={`font-mono font-semibold ${
                      item.profit >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                    }`}
                  >
                    {item.profit >= 0 ? '+' : ''}
                    {formatCurrency(item.profit, currency, locale)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
