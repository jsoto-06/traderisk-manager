'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Flame,
  Activity,
  Calculator,
  ArrowRight,
  Sliders,
  Award,
  Download,
} from 'lucide-react';
import { useLocale } from '@/lib/i18n/useLocale';
import { useStorage } from '@/hooks/useStorage';
import { calculateExpectancy } from '@/lib/analytics/expectancy';
import { calculateDrawdownMetrics } from '@/lib/analytics/drawdown';
import type { AnalyticsFilter } from '@/lib/analytics/types';
import { formatCurrency, formatDate } from '@/lib/i18n';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { ExportReportModal } from '@/components/reports/ExportReportModal';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export default function AnalyticsOverviewPage() {
  const { locale, t } = useLocale();
  const { activeAccount, accounts, trades } = useStorage();

  const [accountId, setAccountId] = useState<string>('all');
  const [direction, setDirection] = useState<'all' | 'long' | 'short'>('all');
  const [assetFilter, setAssetFilter] = useState<string>('');
  const [strategyFilter, setStrategyFilter] = useState<string>('');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const accountToAnalyze = useMemo(() => {
    return accountId === 'all'
      ? activeAccount
      : accounts.find((a) => a.id === accountId) || activeAccount;
  }, [accounts, accountId, activeAccount]);

  const initialCapital = accountToAnalyze?.initialCapital || 10000;
  const currency = accountToAnalyze?.currency || 'USD';

  const filter: AnalyticsFilter = useMemo(() => {
    return {
      accountId: accountId === 'all' ? undefined : accountId,
      direction: direction === 'all' ? undefined : direction,
      asset: assetFilter.trim() ? assetFilter.trim() : undefined,
      strategy: strategyFilter.trim() ? strategyFilter.trim() : undefined,
    };
  }, [accountId, direction, assetFilter, strategyFilter]);

  const expectancy = useMemo(() => {
    return calculateExpectancy(trades, filter);
  }, [trades, filter]);

  const drawdown = useMemo(() => {
    return calculateDrawdownMetrics(trades, initialCapital, filter);
  }, [trades, initialCapital, filter]);

  // Chart data for Equity vs Peak and Underwater Drawdown
  const chartData = useMemo(() => {
    return drawdown.drawdownSeries.map((point) => ({
      index: point.index,
      label: point.index === 0 ? 'Inicio' : `#${point.index}`,
      date: formatDate(point.date, locale),
      balance: point.balance,
      peak: point.peak,
      drawdownPercent: -point.drawdownPercent, // Negative for underwater chart
      drawdownAmount: point.drawdownAmount,
    }));
  }, [drawdown.drawdownSeries, locale]);

  return (
    <div className="space-y-6">
      {/* Header & Sub-navigation */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#F5F7FA] flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-[#00F0FF]" />
            {t.analytics.title}
          </h1>
          <p className="text-sm text-[#8899A6] mt-1">{t.analytics.subtitle}</p>
        </div>

        {/* Quick Nav Pills & Export Button */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/${locale}/analytics`}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30 transition-colors"
          >
            {t.analytics.overviewTab}
          </Link>
          <Link
            href={`/${locale}/analytics/monte-carlo`}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#111C35] text-[#8899A6] hover:text-[#F5F7FA] border border-[#1E2D4A] hover:border-[#00F0FF]/40 transition-colors"
          >
            {t.analytics.monteCarloTab}
          </Link>
          <Link
            href={`/${locale}/analytics/risk-of-ruin`}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#111C35] text-[#8899A6] hover:text-[#F5F7FA] border border-[#1E2D4A] hover:border-[#00F0FF]/40 transition-colors"
          >
            {t.analytics.riskOfRuinTab}
          </Link>
          <Link
            href={`/${locale}/analytics/prop-firm`}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#111C35] text-[#8899A6] hover:text-[#F5F7FA] border border-[#1E2D4A] hover:border-[#00F0FF]/40 transition-colors"
          >
            {t.analytics.propFirmTab}
          </Link>

          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsExportModalOpen(true)}
            leftIcon={<Download className="w-4 h-4" />}
            className="text-xs"
          >
            {locale === 'es' ? 'Exportar Informe' : 'Export Report'}
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <Card className="p-4 bg-[#111C35] border border-[#1E2D4A]">
        <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wider text-[#00F0FF]">
          <Sliders className="w-4 h-4" />
          {t.analytics.filters}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Select
            label={t.accounts.title}
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            options={[
              { value: 'all', label: t.analytics.allAccounts },
              ...accounts.map((acc) => ({
                value: acc.id,
                label: `${acc.name} (${acc.currency})`,
              })),
            ]}
          />

          <Select
            label={t.trades.direction}
            value={direction}
            onChange={(e) => setDirection(e.target.value as 'all' | 'long' | 'short')}
            options={[
              { value: 'all', label: t.analytics.allDirections },
              { value: 'long', label: 'Long (Compra)' },
              { value: 'short', label: 'Short (Venta)' },
            ]}
          />

          <Input
            label={t.trades.asset}
            placeholder="BTC/USDT, EUR/USD..."
            value={assetFilter}
            onChange={(e) => setAssetFilter(e.target.value)}
          />

          <Input
            label={t.trades.strategy}
            placeholder="Breakout, Scalp..."
            value={strategyFilter}
            onChange={(e) => setStrategyFilter(e.target.value)}
          />
        </div>
      </Card>

      {/* Sample Size Warning Alert */}
      {expectancy.sampleSizeWarning && (
        <Alert
          variant={expectancy.isSampleSizeAdequate ? 'info' : 'warning'}
          title={
            expectancy.isSampleSizeAdequate
              ? t.analytics.sampleAdequate
              : t.analytics.sampleWarning
          }
        >
          {expectancy.sampleSizeWarning}
        </Alert>
      )}

      {/* Top Quantitative Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t.analytics.expectancy}
          value={formatCurrency(expectancy.expectancy, currency, locale)}
          subtitle={`${expectancy.expectancyR >= 0 ? '+' : ''}${expectancy.expectancyR} R`}
          icon={<Sparkles className="w-5 h-5 text-[#00F0FF]" />}
          trend={expectancy.expectancy > 0 ? 'up' : expectancy.expectancy < 0 ? 'down' : 'neutral'}
        />

        <StatCard
          title={t.analytics.profitFactor}
          value={expectancy.profitFactor === Infinity ? '∞' : expectancy.profitFactor.toFixed(2)}
          subtitle={`${t.analytics.winLossRatio}: ${
            expectancy.winLossRatio === Infinity ? '∞' : expectancy.winLossRatio.toFixed(2)
          }`}
          icon={<TrendingUp className="w-5 h-5 text-[#10B981]" />}
          trend={expectancy.profitFactor >= 1.5 ? 'up' : expectancy.profitFactor >= 1 ? 'neutral' : 'down'}
        />

        <StatCard
          title={t.analytics.maxDrawdown}
          value={`${drawdown.maxDrawdownPercent}%`}
          subtitle={formatCurrency(drawdown.maxDrawdownAmount, currency, locale)}
          icon={<ShieldAlert className="w-5 h-5 text-[#EF4444]" />}
          trend={drawdown.maxDrawdownPercent > 10 ? 'down' : 'neutral'}
        />

        <StatCard
          title={t.analytics.recoveryFactor}
          value={drawdown.recoveryFactor === Infinity ? '∞' : drawdown.recoveryFactor.toFixed(2)}
          subtitle={`${t.analytics.recoveryTrades}: ${drawdown.recoveryTrades}`}
          icon={<Activity className="w-5 h-5 text-[#8B5CF6]" />}
          trend={drawdown.recoveryFactor >= 2 ? 'up' : 'neutral'}
        />
      </div>

      {/* Secondary Metric Badges Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-3 bg-[#111C35] border border-[#1E2D4A] text-center">
          <span className="text-[11px] text-[#8899A6] uppercase tracking-wider block">
            {t.analytics.winRate}
          </span>
          <span className="text-lg font-bold text-[#10B981]">{expectancy.winRate}%</span>
          <span className="text-[10px] text-[#8899A6] block mt-0.5">
            {expectancy.winningTrades} trades
          </span>
        </Card>

        <Card className="p-3 bg-[#111C35] border border-[#1E2D4A] text-center">
          <span className="text-[11px] text-[#8899A6] uppercase tracking-wider block">
            {t.analytics.lossRate}
          </span>
          <span className="text-lg font-bold text-[#EF4444]">{expectancy.lossRate}%</span>
          <span className="text-[10px] text-[#8899A6] block mt-0.5">
            {expectancy.losingTrades} trades
          </span>
        </Card>

        <Card className="p-3 bg-[#111C35] border border-[#1E2D4A] text-center">
          <span className="text-[11px] text-[#8899A6] uppercase tracking-wider block">
            {t.analytics.breakevenRate}
          </span>
          <span className="text-lg font-bold text-[#F59E0B]">{expectancy.breakevenRate}%</span>
          <span className="text-[10px] text-[#8899A6] block mt-0.5">
            {expectancy.breakevenTrades} trades
          </span>
        </Card>

        <Card className="p-3 bg-[#111C35] border border-[#1E2D4A] text-center">
          <span className="text-[11px] text-[#8899A6] uppercase tracking-wider block">
            {t.analytics.currentDrawdown}
          </span>
          <span className="text-lg font-bold text-[#EF4444]">
            {drawdown.currentDrawdownPercent}%
          </span>
          <span className="text-[10px] text-[#8899A6] block mt-0.5">
            {formatCurrency(drawdown.currentDrawdownAmount, currency, locale)}
          </span>
        </Card>

        <Card className="p-3 bg-[#111C35] border border-[#1E2D4A] text-center">
          <span className="text-[11px] text-[#8899A6] uppercase tracking-wider block">
            {t.analytics.maxWinStreak}
          </span>
          <span className="text-lg font-bold text-[#10B981] flex items-center justify-center gap-1">
            <Flame className="w-4 h-4 text-[#10B981]" />
            {drawdown.maxWinStreak}
          </span>
          <span className="text-[10px] text-[#8899A6] block mt-0.5">consecutivas</span>
        </Card>

        <Card className="p-3 bg-[#111C35] border border-[#1E2D4A] text-center">
          <span className="text-[11px] text-[#8899A6] uppercase tracking-wider block">
            {t.analytics.maxLossStreak}
          </span>
          <span className="text-lg font-bold text-[#EF4444] flex items-center justify-center gap-1">
            <TrendingDown className="w-4 h-4 text-[#EF4444]" />
            {drawdown.maxLossStreak}
          </span>
          <span className="text-[10px] text-[#8899A6] block mt-0.5">consecutivas</span>
        </Card>
      </div>

      {/* Main Charts: Equity Curve vs High Water Mark */}
      <Card className="p-5 bg-[#111C35] border border-[#1E2D4A]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-semibold text-[#F5F7FA]">
              {t.analytics.equityCurveTitle}
            </h2>
            <p className="text-xs text-[#8899A6]">
              Seguimiento del balance acumulado y línea de cresta High-Water Mark
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#00F0FF]/80 inline-block" />
              <span className="text-[#8899A6]">Balance</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-[#8899A6] border-t border-dashed border-[#8899A6] inline-block" />
              <span className="text-[#8899A6]">High-Water Mark</span>
            </div>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00F0FF" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00F0FF" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2D4A" opacity={0.6} />
              <XAxis dataKey="label" stroke="#8899A6" fontSize={11} tickLine={false} />
              <YAxis
                stroke="#8899A6"
                fontSize={11}
                tickLine={false}
                domain={['auto', 'auto']}
                tickFormatter={(val) => `$${Math.round(val)}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0A1128',
                  borderColor: '#1E2D4A',
                  borderRadius: '8px',
                  color: '#F5F7FA',
                }}
                formatter={(val: unknown, name?: unknown) => [
                  `$${Number(val).toLocaleString()}`,
                  name === 'balance' ? 'Balance' : 'High-Water Mark',
                ]}
              />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="#00F0FF"
                strokeWidth={2}
                fill="url(#equityGrad)"
              />
              <Line
                type="stepAfter"
                dataKey="peak"
                stroke="#8899A6"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Underwater Drawdown Chart */}
      <Card className="p-5 bg-[#111C35] border border-[#1E2D4A]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-semibold text-[#F5F7FA]">
              {t.analytics.underwaterTitle}
            </h2>
            <p className="text-xs text-[#8899A6]">
              Porcentaje de caída bajo el High-Water Mark a lo largo de las operaciones
            </p>
          </div>
          <Badge variant="red" className="text-xs">
            Max DD: -{drawdown.maxDrawdownPercent}%
          </Badge>
        </div>

        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0.0} />
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0.35} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2D4A" opacity={0.6} />
              <XAxis dataKey="label" stroke="#8899A6" fontSize={11} tickLine={false} />
              <YAxis
                stroke="#8899A6"
                fontSize={11}
                tickLine={false}
                domain={[-Math.max(10, Math.ceil(drawdown.maxDrawdownPercent * 1.2)), 0]}
                tickFormatter={(val) => `${val}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0A1128',
                  borderColor: '#1E2D4A',
                  borderRadius: '8px',
                  color: '#F5F7FA',
                }}
                formatter={(val: unknown) => [`${val}%`, 'Drawdown']}
              />
              <Area
                type="monotone"
                dataKey="drawdownPercent"
                stroke="#EF4444"
                strokeWidth={2}
                fill="url(#ddGrad)"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Advanced Modules Quick Access Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <Link
          href={`/${locale}/analytics/monte-carlo`}
          className="group block p-5 rounded-xl bg-[#111C35] border border-[#1E2D4A] hover:border-[#00F0FF]/60 transition-all shadow-sm hover:shadow-md hover:shadow-[#00F0FF]/5"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-[#00F0FF]/15 flex items-center justify-center text-[#00F0FF]">
              <Sparkles className="w-5 h-5" />
            </div>
            <ArrowRight className="w-5 h-5 text-[#8899A6] group-hover:text-[#00F0FF] group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="text-base font-semibold text-[#F5F7FA] group-hover:text-[#00F0FF] transition-colors">
            {t.analytics.monteCarloTab}
          </h3>
          <p className="text-xs text-[#8899A6] mt-1 leading-relaxed">
            Simula miles de futuros probabilísticos remuestreando tus trades mediante bootstrap.
          </p>
        </Link>

        <Link
          href={`/${locale}/analytics/risk-of-ruin`}
          className="group block p-5 rounded-xl bg-[#111C35] border border-[#1E2D4A] hover:border-[#00F0FF]/60 transition-all shadow-sm hover:shadow-md hover:shadow-[#00F0FF]/5"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-[#10B981]/15 flex items-center justify-center text-[#10B981]">
              <Calculator className="w-5 h-5" />
            </div>
            <ArrowRight className="w-5 h-5 text-[#8899A6] group-hover:text-[#00F0FF] group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="text-base font-semibold text-[#F5F7FA] group-hover:text-[#10B981] transition-colors">
            {t.analytics.riskOfRuinTab}
          </h3>
          <p className="text-xs text-[#8899A6] mt-1 leading-relaxed">
            Calcula la cota analítica de Ralph Vince, Kelly Criterion y riesgo por niveles de stop.
          </p>
        </Link>

        <Link
          href={`/${locale}/analytics/prop-firm`}
          className="group block p-5 rounded-xl bg-[#111C35] border border-[#1E2D4A] hover:border-[#00F0FF]/60 transition-all shadow-sm hover:shadow-md hover:shadow-[#00F0FF]/5"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/15 flex items-center justify-center text-[#8B5CF6]">
              <Award className="w-5 h-5" />
            </div>
            <ArrowRight className="w-5 h-5 text-[#8899A6] group-hover:text-[#00F0FF] group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="text-base font-semibold text-[#F5F7FA] group-hover:text-[#8B5CF6] transition-colors">
            {t.analytics.propFirmTab}
          </h3>
          <p className="text-xs text-[#8899A6] mt-1 leading-relaxed">
            Verifica la probabilidad matemática de pasar un challenge bajo reglas de trailing y daily loss.
          </p>
        </Link>
      </div>

      {/* Export Report Modal */}
      <ExportReportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        defaultAccountId={accountToAnalyze?.id}
      />
    </div>
  );
}
