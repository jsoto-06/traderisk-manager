'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  ArrowLeft,
  Play,
  TrendingUp,
  ShieldAlert,
  DollarSign,
  Sliders,
  BarChart3,
} from 'lucide-react';
import { useLocale } from '@/lib/i18n/useLocale';
import { useStorage } from '@/hooks/useStorage';
import { runMonteCarloSimulation } from '@/lib/analytics/monte-carlo';
import type { MonteCarloConfig, MonteCarloResult, MonteCarloMethod } from '@/lib/analytics/types';
import { formatCurrency } from '@/lib/i18n';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export default function MonteCarloPage() {
  const { locale, t } = useLocale();
  const { activeAccount, trades } = useStorage();

  const initialCapital = activeAccount?.initialCapital || 10000;
  const currency = activeAccount?.currency || 'USD';

  const closedTrades = useMemo(() => {
    return trades.filter((tr) => tr.status === 'closed' && tr.result != null);
  }, [trades]);

  const hasHistorical = closedTrades.length >= 5;

  // Form states
  const [dataSource, setDataSource] = useState<'historical' | 'custom'>(
    hasHistorical ? 'historical' : 'custom',
  );
  const [method, setMethod] = useState<MonteCarloMethod>(
    hasHistorical ? 'bootstrap_block' : 'parametric_fixed',
  );
  const [blockSize, setBlockSize] = useState<number>(5);
  const [simulationsCount, setSimulationsCount] = useState<number>(1000);
  const [tradesCount, setTradesCount] = useState<number>(100);
  const [riskType, setRiskType] = useState<'fixed_amount' | 'percentage_equity'>('percentage_equity');
  const [riskValue, setRiskValue] = useState<number>(1.0);
  const [profitTarget, setProfitTarget] = useState<string>(
    String(Math.round(initialCapital * 1.15)),
  );
  const [maxDrawdownLimit, setMaxDrawdownLimit] = useState<number>(10);
  const [seed, setSeed] = useState<number>(42);

  // Custom distribution fields
  const [customWinRate, setCustomWinRate] = useState<number>(55);
  const [customAvgWin, setCustomAvgWin] = useState<number>(200);
  const [customAvgLoss, setCustomAvgLoss] = useState<number>(100);
  const [customWinStdDev, setCustomWinStdDev] = useState<number>(50);
  const [customLossStdDev, setCustomLossStdDev] = useState<number>(25);

  // Simulation execution & result state
  const [result, setResult] = useState<MonteCarloResult>(() => {
    const initialConfig: MonteCarloConfig = {
      simulationsCount: 1000,
      tradesCount: 100,
      initialCapital,
      riskType: 'percentage_equity',
      riskValue: 1.0,
      profitTarget: Math.round(initialCapital * 1.15),
      maxDrawdownLimitPercent: 10,
      seed: 42,
      method: hasHistorical ? 'bootstrap_block' : 'parametric_fixed',
      blockSize: 5,
      customDistribution: hasHistorical
        ? undefined
        : {
            winRate: 55,
            averageWin: 200,
            averageLoss: 100,
          },
    };
    return runMonteCarloSimulation(trades, initialConfig);
  });

  const [isSimulating, setIsSimulating] = useState(false);

  const handleRunSimulation = () => {
    setIsSimulating(true);

    setTimeout(() => {
      const config: MonteCarloConfig = {
        simulationsCount: Number(simulationsCount) || 1000,
        tradesCount: Number(tradesCount) || 100,
        initialCapital,
        riskType,
        riskValue: Number(riskValue) || 1.0,
        profitTarget: profitTarget ? Number(profitTarget) : undefined,
        maxDrawdownLimitPercent: Number(maxDrawdownLimit) || 10,
        seed: Number(seed) || 42,
        method,
        blockSize: Number(blockSize) || 5,
        customDistribution:
          dataSource === 'custom' || method.startsWith('parametric')
            ? {
                winRate: Number(customWinRate) || 50,
                averageWin: Number(customAvgWin) || 200,
                averageLoss: Number(customAvgLoss) || 100,
                winStdDev: method === 'parametric_variable' ? Number(customWinStdDev) || 0 : undefined,
                lossStdDev: method === 'parametric_variable' ? Number(customLossStdDev) || 0 : undefined,
              }
            : undefined,
      };

      const res = runMonteCarloSimulation(trades, config);
      setResult(res);
      setIsSimulating(false);
    }, 50);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href={`/${locale}/analytics`}
              className="inline-flex items-center gap-1 text-xs text-[#8899A6] hover:text-[#00F0FF] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {t.analytics.overviewTab}
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#F5F7FA] flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-[#00F0FF]" />
            {t.monteCarlo.title}
          </h1>
          <p className="text-sm text-[#8899A6] mt-1">{t.monteCarlo.subtitle}</p>
        </div>

        <Button
          onClick={handleRunSimulation}
          disabled={isSimulating}
          className="bg-[#00F0FF] hover:bg-[#00F0FF]/90 text-[#0A1128] font-semibold gap-2"
        >
          <Play className="w-4 h-4 fill-current" />
          {isSimulating ? t.monteCarlo.running : t.monteCarlo.runButton}
        </Button>
      </div>

      {/* Configuration Grid */}
      <Card className="p-5 bg-[#111C35] border border-[#1E2D4A]">
        <div className="flex items-center gap-2 mb-4 text-xs font-semibold uppercase tracking-wider text-[#00F0FF]">
          <Sliders className="w-4 h-4" />
          {t.monteCarlo.parameters}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Select
            label={t.monteCarlo.dataSource}
            value={dataSource}
            onChange={(e) => {
              const ds = e.target.value as 'historical' | 'custom';
              setDataSource(ds);
              if (ds === 'historical') {
                setMethod('bootstrap_block');
              } else {
                setMethod('parametric_fixed');
              }
            }}
            options={[
              {
                value: 'historical',
                label: `${t.monteCarlo.useHistorical} (${closedTrades.length} trades)`,
              },
              { value: 'custom', label: t.monteCarlo.useCustom },
            ]}
          />

          <Select
            label={t.monteCarlo.method}
            value={method}
            onChange={(e) => setMethod(e.target.value as MonteCarloMethod)}
            options={
              dataSource === 'historical'
                ? [
                    { value: 'bootstrap_block', label: t.monteCarlo.methodBlock },
                    { value: 'bootstrap_iid', label: t.monteCarlo.methodIid },
                  ]
                : [
                    { value: 'parametric_fixed', label: t.monteCarlo.methodParamFixed },
                    { value: 'parametric_variable', label: t.monteCarlo.methodParamVariable },
                  ]
            }
          />

          {method === 'bootstrap_block' ? (
            <Input
              label={t.monteCarlo.blockSize}
              type="number"
              min={1}
              max={50}
              value={blockSize}
              onChange={(e) => setBlockSize(Number(e.target.value))}
            />
          ) : (
            <Select
              label={t.monteCarlo.simulationsCount}
              value={String(simulationsCount)}
              onChange={(e) => setSimulationsCount(Number(e.target.value))}
              options={[
                { value: '200', label: '200 iteraciones' },
                { value: '500', label: '500 iteraciones' },
                { value: '1000', label: '1,000 iteraciones' },
                { value: '2000', label: '2,000 iteraciones' },
              ]}
            />
          )}

          <Select
            label={t.monteCarlo.tradesHorizon}
            value={String(tradesCount)}
            onChange={(e) => setTradesCount(Number(e.target.value))}
            options={[
              { value: '30', label: '30 operaciones' },
              { value: '50', label: '50 operaciones' },
              { value: '100', label: '100 operaciones' },
              { value: '200', label: '200 operaciones' },
              { value: '500', label: '500 operaciones' },
            ]}
          />

          {method === 'bootstrap_block' && (
            <Select
              label={t.monteCarlo.simulationsCount}
              value={String(simulationsCount)}
              onChange={(e) => setSimulationsCount(Number(e.target.value))}
              options={[
                { value: '200', label: '200 iteraciones' },
                { value: '500', label: '500 iteraciones' },
                { value: '1000', label: '1,000 iteraciones' },
                { value: '2000', label: '2,000 iteraciones' },
              ]}
            />
          )}

          <Select
            label={t.monteCarlo.riskModel}
            value={riskType}
            onChange={(e) =>
              setRiskType(e.target.value as 'fixed_amount' | 'percentage_equity')
            }
            options={[
              { value: 'percentage_equity', label: t.monteCarlo.riskPercent },
              { value: 'fixed_amount', label: t.monteCarlo.riskFixed },
            ]}
          />

          <Input
            label={`${t.monteCarlo.riskValue} (${riskType === 'percentage_equity' ? '%' : '$'})`}
            type="number"
            step={riskType === 'percentage_equity' ? '0.1' : '10'}
            value={riskValue}
            onChange={(e) => setRiskValue(Number(e.target.value))}
          />

          <Input
            label={t.monteCarlo.profitTarget}
            type="number"
            value={profitTarget}
            onChange={(e) => setProfitTarget(e.target.value)}
          />

          <Input
            label={t.monteCarlo.maxDrawdownLimit}
            type="number"
            value={maxDrawdownLimit}
            onChange={(e) => setMaxDrawdownLimit(Number(e.target.value))}
          />

          <Input
            label={t.monteCarlo.seed}
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
          />
        </div>

        {/* Custom Theoretical Distribution Inputs (if selected) */}
        {(dataSource === 'custom' || method.startsWith('parametric')) && (
          <div className="mt-4 pt-4 border-t border-[#1E2D4A] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Input
              label={t.monteCarlo.winRateCustom}
              type="number"
              min={1}
              max={99}
              value={customWinRate}
              onChange={(e) => setCustomWinRate(Number(e.target.value))}
            />
            <Input
              label={t.monteCarlo.avgWinCustom}
              type="number"
              value={customAvgWin}
              onChange={(e) => setCustomAvgWin(Number(e.target.value))}
            />
            <Input
              label={t.monteCarlo.avgLossCustom}
              type="number"
              value={customAvgLoss}
              onChange={(e) => setCustomAvgLoss(Number(e.target.value))}
            />
            {method === 'parametric_variable' && (
              <>
                <Input
                  label={t.monteCarlo.winStdDev}
                  type="number"
                  value={customWinStdDev}
                  onChange={(e) => setCustomWinStdDev(Number(e.target.value))}
                />
                <Input
                  label={t.monteCarlo.lossStdDev}
                  type="number"
                  value={customLossStdDev}
                  onChange={(e) => setCustomLossStdDev(Number(e.target.value))}
                />
              </>
            )}
          </div>
        )}

        {/* Metadata info badge bar */}
        {result.metadata && (
          <div className="mt-4 pt-3 border-t border-[#1E2D4A]/60 flex flex-wrap items-center gap-3 text-xs text-[#8899A6]">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#1E2D4A] text-[#00F0FF] font-mono">
              Engine v{result.metadata.algorithmVersion}
            </span>
            <span>
              Método: <strong className="text-[#F5F7FA] font-mono">{result.metadata.method}</strong>
            </span>
            {result.metadata.blockSize && (
              <span>
                Bloque: <strong className="text-[#F5F7FA]">{result.metadata.blockSize} trades</strong>
              </span>
            )}
            <span>
              Semilla: <strong className="text-[#F5F7FA] font-mono">{result.metadata.seed}</strong>
            </span>
            <span>
              Iteraciones: <strong className="text-[#F5F7FA]">{result.metadata.simulationsCount}</strong>
            </span>
            <span>
              Horizonte: <strong className="text-[#F5F7FA]">{result.metadata.tradesCount} trades</strong>
            </span>
          </div>
        )}
      </Card>

      {/* Empirical Sample Statistics Card (if available) */}
      {result.empiricalStatistics && (
        <Card className="p-5 bg-[#111C35] border border-[#1E2D4A]">
          <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wider text-[#00F0FF]">
            <BarChart3 className="w-4 h-4" />
            {t.monteCarlo.statsTitle} (n = {result.empiricalStatistics.historicalTradesCount} trades)
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3 bg-[#0A1128] rounded border border-[#1E2D4A]/60">
              <span className="text-[11px] text-[#8899A6] block">Media (R)</span>
              <span className="text-sm font-bold text-[#F5F7FA] font-mono">
                {result.empiricalStatistics.mean.toFixed(2)}R
              </span>
            </div>
            <div className="p-3 bg-[#0A1128] rounded border border-[#1E2D4A]/60">
              <span className="text-[11px] text-[#8899A6] block">{t.monteCarlo.stdDev} (R)</span>
              <span className="text-sm font-bold text-[#F5F7FA] font-mono">
                {result.empiricalStatistics.stdDev.toFixed(2)}R
              </span>
            </div>
            <div className="p-3 bg-[#0A1128] rounded border border-[#1E2D4A]/60">
              <span className="text-[11px] text-[#8899A6] block">{t.monteCarlo.skewness}</span>
              <span className={`text-sm font-bold font-mono ${result.empiricalStatistics.skewness >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                {result.empiricalStatistics.skewness.toFixed(2)}
              </span>
            </div>
            <div className="p-3 bg-[#0A1128] rounded border border-[#1E2D4A]/60">
              <span className="text-[11px] text-[#8899A6] block">{t.monteCarlo.kurtosis}</span>
              <span className="text-sm font-bold text-[#F5F7FA] font-mono">
                {result.empiricalStatistics.excessKurtosis.toFixed(2)}
              </span>
            </div>
            <div className="p-3 bg-[#0A1128] rounded border border-[#1E2D4A]/60">
              <span className="text-[11px] text-[#8899A6] block">{t.monteCarlo.var95}</span>
              <span className="text-sm font-bold text-[#EF4444] font-mono">
                {result.empiricalStatistics.valueAtRisk95.toFixed(2)}R
              </span>
            </div>
            <div className="p-3 bg-[#0A1128] rounded border border-[#1E2D4A]/60">
              <span className="text-[11px] text-[#8899A6] block">Max DD Histórico</span>
              <span className="text-sm font-bold text-[#EF4444] font-mono">
                {result.empiricalStatistics.maxHistoricalDrawdown.toFixed(1)}R
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t.monteCarlo.profitProb}
          value={`${result.profitProbability}%`}
          subtitle={`${result.simulationsCount} trayectorias`}
          icon={<TrendingUp className="w-5 h-5 text-[#10B981]" />}
          trend={result.profitProbability >= 70 ? 'up' : result.profitProbability >= 50 ? 'neutral' : 'down'}
        />

        <StatCard
          title={t.monteCarlo.targetProb}
          value={`${result.targetProbability}%`}
          subtitle={`Target: ${formatCurrency(profitTarget ? Number(profitTarget) : 0, currency, locale)}`}
          icon={<Sparkles className="w-5 h-5 text-[#00F0FF]" />}
          trend={result.targetProbability >= 50 ? 'up' : 'neutral'}
        />

        <StatCard
          title={t.monteCarlo.drawdownBreachProb}
          value={`${result.drawdownBreachProbability}%`}
          subtitle={`Límite: ${maxDrawdownLimit}%`}
          icon={<ShieldAlert className="w-5 h-5 text-[#EF4444]" />}
          trend={result.drawdownBreachProbability > 20 ? 'down' : 'neutral'}
        />

        <StatCard
          title={t.monteCarlo.medianEquity}
          value={formatCurrency(result.medianFinalEquity, currency, locale)}
          subtitle={`P95 DD: ${result.maxDrawdownP95}%`}
          icon={<DollarSign className="w-5 h-5 text-[#F5F7FA]" />}
          trend={result.medianFinalEquity > initialCapital ? 'up' : 'down'}
        />
      </div>

      {/* Percentiles Fan Chart */}
      <Card className="p-5 bg-[#111C35] border border-[#1E2D4A]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-semibold text-[#F5F7FA]">
              {t.monteCarlo.percentilesEvolution}
            </h2>
            <p className="text-xs text-[#8899A6]">
              Haz de curvas estocásticas: P95 (optimista), P75, P50 (mediana), P25 y P5 (pesimista)
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-[#10B981]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" /> P95
            </span>
            <span className="flex items-center gap-1 text-[#00F0FF]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00F0FF]" /> Mediana (P50)
            </span>
            <span className="flex items-center gap-1 text-[#EF4444]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" /> P5
            </span>
          </div>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={result.curves} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2D4A" opacity={0.6} />
              <XAxis
                dataKey="tradeIndex"
                stroke="#8899A6"
                fontSize={11}
                tickLine={false}
                tickFormatter={(val) => `T${val}`}
              />
              <YAxis
                stroke="#8899A6"
                fontSize={11}
                tickLine={false}
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
                  String(name || '').toUpperCase(),
                ]}
              />
              <Line type="monotone" dataKey="p95" stroke="#10B981" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="p75" stroke="#34D399" strokeWidth={1} strokeDasharray="3 3" dot={false} />
              <Line type="monotone" dataKey="p50" stroke="#00F0FF" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="p25" stroke="#F87171" strokeWidth={1} strokeDasharray="3 3" dot={false} />
              <Line type="monotone" dataKey="p5" stroke="#EF4444" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Final Equity Distribution Histogram */}
      <Card className="p-5 bg-[#111C35] border border-[#1E2D4A]">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-[#F5F7FA]">
            {t.monteCarlo.finalDistribution}
          </h2>
          <p className="text-xs text-[#8899A6]">
            Densidad de frecuencia del capital al final de las {result.tradesCount} operaciones simuladas
          </p>
        </div>

        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={result.finalEquityDistribution}
              margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2D4A" opacity={0.6} />
              <XAxis dataKey="binLabel" stroke="#8899A6" fontSize={10} tickLine={false} />
              <YAxis
                stroke="#8899A6"
                fontSize={11}
                tickLine={false}
                tickFormatter={(val) => `${val}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0A1128',
                  borderColor: '#1E2D4A',
                  borderRadius: '8px',
                  color: '#F5F7FA',
                }}
                formatter={(val: unknown) => [`${val}% de iteraciones`, 'Frecuencia']}
              />
              <Bar dataKey="percentage" fill="#00F0FF" radius={[4, 4, 0, 0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Quantitative Disclaimer */}
      <Alert variant="info" title="Disclaimer Cuantitativo y Legal">
        {result.disclaimer}
      </Alert>
    </div>
  );
}
