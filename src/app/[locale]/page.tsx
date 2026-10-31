'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Target,
  AlertOctagon,
  ShieldAlert,
  ArrowRight,
  PlusCircle,
  Calculator,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { useLocale } from '@/lib/i18n/useLocale';
import { useStorage } from '@/hooks/useStorage';
import { calculateStatistics } from '@/lib/statistics';
import { calculateExpectancy } from '@/lib/analytics/expectancy';
import { calculateDrawdownMetrics } from '@/lib/analytics/drawdown';
import { formatCurrency, formatDate } from '@/lib/i18n';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Alert } from '@/components/ui/Alert';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function DashboardPage() {
  const { locale, t } = useLocale();
  const { isLoaded, activeAccount, activeAccountTrades } = useStorage();

  // Calculate statistics for active account
  const stats = useMemo(() => {
    if (!activeAccount) return null;
    return calculateStatistics(activeAccountTrades, activeAccount.initialCapital);
  }, [activeAccount, activeAccountTrades]);

  // Quantitative Expectancy & Drawdown (Fase 5)
  const expectancy = useMemo(() => {
    return calculateExpectancy(activeAccountTrades);
  }, [activeAccountTrades]);

  const drawdownMetrics = useMemo(() => {
    if (!activeAccount) return null;
    return calculateDrawdownMetrics(activeAccountTrades, activeAccount.initialCapital);
  }, [activeAccount, activeAccountTrades]);

  // Derived metrics
  const totalPnL = activeAccount ? activeAccount.balance - activeAccount.initialCapital : 0;
  const totalPnLPercent = activeAccount && activeAccount.initialCapital > 0
    ? (totalPnL / activeAccount.initialCapital) * 100
    : 0;

  // Open trades risk
  const openTrades = useMemo(() => {
    return activeAccountTrades.filter((t) => t.status === 'open');
  }, [activeAccountTrades]);

  const openRiskAmount = useMemo(() => {
    return openTrades.reduce((acc, trade) => {
      const dist = Math.abs(trade.entryPrice - trade.stopLoss);
      return acc + dist * trade.size;
    }, 0);
  }, [openTrades]);

  const openRiskPercent = activeAccount && activeAccount.balance > 0
    ? (openRiskAmount / activeAccount.balance) * 100
    : 0;

  // Profit target progress
  const targetProfitAmount = activeAccount
    ? (activeAccount.initialCapital * activeAccount.profitTarget) / 100
    : 0;
  const targetProgress = targetProfitAmount > 0
    ? Math.max(0, Math.min((totalPnL / targetProfitAmount) * 100, 100))
    : 0;

  // Recent 5 trades
  const recentTrades = useMemo(() => {
    return [...activeAccountTrades]
      .sort((a, b) => new Date(b.openDate).getTime() - new Date(a.openDate).getTime())
      .slice(0, 5);
  }, [activeAccountTrades]);

  // Chart data
  const chartData = useMemo(() => {
    if (!stats || stats.balanceHistory.length === 0) return [];
    return stats.balanceHistory.map((item) => ({
      date: formatDate(item.date, locale),
      balance: item.balance,
    }));
  }, [stats, locale]);

  if (!isLoaded || !activeAccount) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#00F0FF]/30 border-t-[#00F0FF] rounded-full animate-spin" />
          <p className="text-sm text-[#94A3B8]">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  const isDemoAccount = activeAccount.type === 'Demo' || activeAccount.id.startsWith('demo');

  return (
    <div className="space-y-6">
      {/* Top Banner for Demo Accounts */}
      {isDemoAccount && (
        <Alert
          variant="info"
          title="Modo Demostración Activo"
          action={
            <div className="flex items-center gap-3">
              <Link href={`/${locale}/accounts`}>
                <Button size="sm" variant="outline" className="text-xs">
                  Gestionar Cuentas
                </Button>
              </Link>
            </div>
          }
        >
          {t.dashboard.demoBanner}
        </Alert>
      )}

      {/* Account Header Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111C35] border border-[#1E2D4A] p-5 rounded-2xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-[#F5F7FA]">
              {activeAccount.name}
            </h1>
            <Badge variant={isDemoAccount ? 'yellow' : 'cyan'}>
              {activeAccount.type}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-[#94A3B8]">
            Capital Inicial: {formatCurrency(activeAccount.initialCapital, activeAccount.currency, locale)} · Apalancamiento: {activeAccount.leverage}x
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Link href={`/${locale}/calculator`}>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Calculator className="w-4 h-4" />}
            >
              {t.nav.calculator}
            </Button>
          </Link>
          <Link href={`/${locale}/trades`}>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<PlusCircle className="w-4 h-4" />}
            >
              {t.nav.trades}
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Balance */}
        <StatCard
          title={t.dashboard.balance}
          value={formatCurrency(activeAccount.balance, activeAccount.currency, locale)}
          subtitle={`Equidad: ${formatCurrency(activeAccount.equity, activeAccount.currency, locale)}`}
          icon={<Wallet className="w-5 h-5" />}
        />

        {/* PnL Total */}
        <StatCard
          title={t.dashboard.pnlTotal}
          value={
            <span className={totalPnL >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}>
              {totalPnL >= 0 ? '+' : ''}
              {formatCurrency(totalPnL, activeAccount.currency, locale)}
            </span>
          }
          change={{
            value: `${totalPnL >= 0 ? '+' : ''}${totalPnLPercent.toFixed(2)}%`,
            isPositive: totalPnL >= 0,
            isNegative: totalPnL < 0,
            label: 'vs inicial',
          }}
          icon={
            totalPnL >= 0 ? (
              <TrendingUp className="w-5 h-5 text-[#10B981]" />
            ) : (
              <TrendingDown className="w-5 h-5 text-[#EF4444]" />
            )
          }
        />

        {/* Win Rate / Profit Factor */}
        <StatCard
          title="Tasa de Acierto (Win Rate)"
          value={`${stats?.winRate.toFixed(1) || 0}%`}
          subtitle={`Profit Factor: ${stats?.profitFactor.toFixed(2) || '0.00'} (${stats?.winningTrades || 0}W / ${stats?.losingTrades || 0}L)`}
          icon={<CheckCircle2 className="w-5 h-5 text-[#00F0FF]" />}
        />

        {/* Open Risk */}
        <StatCard
          title={t.dashboard.openRisk}
          value={formatCurrency(openRiskAmount, activeAccount.currency, locale)}
          subtitle={`${openTrades.length} operación(es) abierta(s)`}
          change={{
            value: `${openRiskPercent.toFixed(2)}%`,
            isPositive: openRiskPercent < activeAccount.riskPerTrade * 2,
            isNegative: openRiskPercent >= activeAccount.riskPerTrade * 2,
            label: 'del balance',
          }}
          icon={<ShieldAlert className="w-5 h-5 text-[#F59E0B]" />}
        />
      </div>

      {/* Rules & Targets Progress Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Profit Target */}
        <Card
          title={
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-[#10B981]" />
              <span>{t.dashboard.profitTarget}</span>
            </div>
          }
          subtitle={`Objetivo: ${activeAccount.profitTarget}% (${formatCurrency(targetProfitAmount, activeAccount.currency, locale)})`}
        >
          <div className="space-y-4">
            <ProgressBar
              value={targetProgress}
              variant="green"
              size="lg"
              label="Progreso hacia el Objetivo"
              sublabel={`${formatCurrency(totalPnL, activeAccount.currency, locale)} conseguidos`}
            />
            <div className="flex justify-between text-xs text-[#94A3B8] pt-1">
              <span>Restante: {formatCurrency(Math.max(0, targetProfitAmount - totalPnL), activeAccount.currency, locale)}</span>
              <span className="font-semibold text-[#10B981]">
                {targetProgress >= 100 ? '¡Objetivo Superado!' : `${(100 - targetProgress).toFixed(1)}% faltante`}
              </span>
            </div>
          </div>
        </Card>

        {/* Daily Loss Limit & Drawdown */}
        <Card
          title={
            <div className="flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-[#EF4444]" />
              <span>{t.dashboard.dailyLossLimit} & Drawdown</span>
            </div>
          }
          subtitle={`Límite Diario: ${activeAccount.dailyLossLimit}% · Max Drawdown: ${activeAccount.maxDrawdown}%`}
        >
          <div className="space-y-4">
            <ProgressBar
              value={Math.min(Math.max(openRiskPercent, 0), activeAccount.maxDrawdown)}
              max={activeAccount.maxDrawdown}
              variant={openRiskPercent > activeAccount.dailyLossLimit ? 'red' : 'yellow'}
              size="lg"
              label="Consumo de Drawdown"
              sublabel={`Límite: ${activeAccount.maxDrawdown}%`}
            />
            <div className="flex justify-between text-xs text-[#94A3B8] pt-1">
              <span>Tipo: {activeAccount.drawdownType}</span>
              <span className="text-[#00F0FF]">
                Riesgo por trade: {activeAccount.riskPerTrade}%
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Quantitative Analytics Widget (Fase 5) */}
      <Card className="p-5 bg-[#111C35] border border-[#1E2D4A] hover:border-[#00F0FF]/30 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#00F0FF]/15 flex items-center justify-center text-[#00F0FF]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#F5F7FA]">
                {t.analytics.title}
              </h2>
              <p className="text-xs text-[#8899A6]">
                Expectativa matemática, drawdown institucional y simulador Monte Carlo
              </p>
            </div>
          </div>
          <Link href={`/${locale}/analytics`}>
            <Button variant="ghost" size="sm" className="text-xs text-[#00F0FF] hover:bg-[#00F0FF]/10">
              Ver Analítica Completa <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-[#0A1128] border border-[#1E2D4A]">
            <span className="text-[#8899A6] block">{t.analytics.expectancy}</span>
            <span
              className={`text-base font-bold mt-0.5 block ${
                expectancy.expectancy >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
              }`}
            >
              {formatCurrency(expectancy.expectancy, activeAccount.currency, locale)}
            </span>
            <span className="text-[10px] text-[#8899A6] block">
              {expectancy.expectancyR >= 0 ? '+' : ''}
              {expectancy.expectancyR} R / trade
            </span>
          </div>

          <div className="p-3 rounded-lg bg-[#0A1128] border border-[#1E2D4A]">
            <span className="text-[#8899A6] block">{t.analytics.profitFactor}</span>
            <span className="text-base font-bold text-[#F5F7FA] mt-0.5 block">
              {expectancy.profitFactor === Infinity ? '∞' : expectancy.profitFactor.toFixed(2)}
            </span>
            <span className="text-[10px] text-[#8899A6] block">Win Rate: {expectancy.winRate}%</span>
          </div>

          <div className="p-3 rounded-lg bg-[#0A1128] border border-[#1E2D4A]">
            <span className="text-[#8899A6] block">{t.analytics.maxDrawdown}</span>
            <span className="text-base font-bold text-[#EF4444] mt-0.5 block">
              {drawdownMetrics ? `${drawdownMetrics.maxDrawdownPercent}%` : '0%'}
            </span>
            <span className="text-[10px] text-[#8899A6] block">
              {drawdownMetrics
                ? formatCurrency(drawdownMetrics.maxDrawdownAmount, activeAccount.currency, locale)
                : '$0'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-[#0A1128] border border-[#1E2D4A]">
            <span className="text-[#8899A6] block">{t.analytics.recoveryFactor}</span>
            <span className="text-base font-bold text-[#00F0FF] mt-0.5 block">
              {drawdownMetrics && drawdownMetrics.recoveryFactor === Infinity
                ? '∞'
                : (drawdownMetrics?.recoveryFactor?.toFixed(2) ?? '0')}
            </span>
            <span className="text-[10px] text-[#8899A6] block">
              Max Racha: {drawdownMetrics?.maxWinStreak ?? 0} wins
            </span>
          </div>
        </div>
      </Card>

      {/* Balance Evolution Chart & Recent Trades */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Balance Chart (2 cols) */}
        <Card
          className="lg:col-span-2"
          title={t.dashboard.balanceEvolution}
          subtitle="Historial de capital acumulado en base a operaciones cerradas"
          action={
            <Link href={`/${locale}/statistics`}>
              <Button variant="ghost" size="sm" className="text-xs">
                Ver Métricas <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          }
        >
          <div className="h-72 w-full pt-2">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00F0FF" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#00F0FF" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
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
                    formatter={(val: unknown) => [formatCurrency(Number(val) || 0, activeAccount.currency, locale), 'Balance']}
                  />
                  <Area
                    type="monotone"
                    dataKey="balance"
                    stroke="#00F0FF"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#balanceGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-[#94A3B8]">
                {t.common.noData}
              </div>
            )}
          </div>
        </Card>

        {/* Recent Trades (1 col) */}
        <Card
          title={t.dashboard.recentTrades}
          subtitle="Últimos movimientos registrados"
          action={
            <Link href={`/${locale}/trades`}>
              <Button variant="ghost" size="sm" className="text-xs">
                Ver Todos <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          }
        >
          <div className="space-y-3">
            {recentTrades.length === 0 ? (
              <div className="text-center py-8 text-xs text-[#94A3B8]">
                No hay operaciones registradas aún.
              </div>
            ) : (
              recentTrades.map((trade) => {
                const isProfit = (trade.result ?? 0) >= 0;
                return (
                  <div
                    key={trade.id}
                    className="p-3 rounded-xl bg-[#0A1128]/60 border border-[#1E2D4A]/60 flex items-center justify-between hover:border-[#00F0FF]/30 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-[#F5F7FA]">
                          {trade.asset}
                        </span>
                        <Badge
                          variant={trade.direction === 'long' ? 'green' : 'red'}
                          size="sm"
                        >
                          {trade.direction}
                        </Badge>
                        <Badge
                          variant={trade.status === 'open' ? 'cyan' : 'gray'}
                          size="sm"
                        >
                          {trade.status}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-[#94A3B8]">
                        {formatDate(trade.openDate, locale)} · Tamaño: {trade.size}
                      </p>
                    </div>

                    <div className="text-right">
                      {trade.status === 'closed' && trade.result != null ? (
                        <div
                          className={`font-semibold text-xs font-mono ${
                            isProfit ? 'text-[#10B981]' : 'text-[#EF4444]'
                          }`}
                        >
                          {isProfit ? '+' : ''}
                          {formatCurrency(trade.result, activeAccount.currency, locale)}
                        </div>
                      ) : (
                        <span className="text-[11px] text-[#00F0FF] font-medium">
                          En curso
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
