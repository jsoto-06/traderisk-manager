'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Award,
  ArrowLeft,
  Play,
  ShieldAlert,
  ShieldCheck,
  Clock,
  Sliders,
  AlertTriangle,
} from 'lucide-react';
import { useLocale } from '@/lib/i18n/useLocale';
import { useStorage } from '@/hooks/useStorage';
import { simulatePropFirmChallenge } from '@/lib/prop-firm-simulator';
import type {
  PropFirmSimulatorConfig,
  PropFirmSimulatorResult,
  PropFirmDrawdownType,
  PropFirmDailyLossType,
  PropFirmDailyLossEnforcement,
} from '@/lib/analytics/types';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
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

export default function PropFirmSimulatorPage() {
  const { locale, t } = useLocale();
  const { activeAccount } = useStorage();

  const defaultCapital = activeAccount?.initialCapital || 50000;

  // Config parameters
  const [initialCapital, setInitialCapital] = useState<number>(defaultCapital);
  const [profitTargetPercent, setProfitTargetPercent] = useState<number>(
    activeAccount?.profitTarget || 8,
  );
  const [dailyLossLimitPercent, setDailyLossLimitPercent] = useState<number>(
    activeAccount?.dailyLossLimit || 4,
  );
  const [maxDrawdownPercent, setMaxDrawdownPercent] = useState<number>(
    activeAccount?.maxDrawdown || 8,
  );
  const [drawdownType, setDrawdownType] = useState<PropFirmDrawdownType>(
    activeAccount?.drawdownType === 'trailing' ? 'trailing_balance' : 'static',
  );
  const [dailyLossType, setDailyLossType] = useState<PropFirmDailyLossType>('balance_based');
  const [dailyLossEnforcement, setDailyLossEnforcement] =
    useState<PropFirmDailyLossEnforcement>('hard_breach');
  const [dailyLossBase, setDailyLossBase] =
    useState<'initial_capital' | 'day_start_balance'>('initial_capital');
  const [riskPerTradePercent, setRiskPerTradePercent] = useState<number>(
    activeAccount?.riskPerTrade || 0.5,
  );
  const [winRate, setWinRate] = useState<number>(55);
  const [averageWin, setAverageWin] = useState<number>(600);
  const [averageLoss, setAverageLoss] = useState<number>(300);
  const [tradesPerDay, setTradesPerDay] = useState<number>(3);
  const [maxDays, setMaxDays] = useState<number>(45);
  const [commissions, setCommissions] = useState<number>(2.5);
  const [simulationsCount, setSimulationsCount] = useState<number>(1000);
  const [seed, setSeed] = useState<number>(777);

  // Result state
  const [result, setResult] = useState<PropFirmSimulatorResult>(() => {
    const config: PropFirmSimulatorConfig = {
      initialCapital: defaultCapital,
      profitTargetPercent: activeAccount?.profitTarget || 8,
      dailyLossLimitPercent: activeAccount?.dailyLossLimit || 4,
      maxDrawdownPercent: activeAccount?.maxDrawdown || 8,
      drawdownType: activeAccount?.drawdownType === 'trailing' ? 'trailing_balance' : 'static',
      dailyLossType: 'balance_based',
      dailyLossEnforcement: 'hard_breach',
      dailyLossBase: 'initial_capital',
      resetHour: 0,
      resetTimezone: 'UTC',
      winRate: 55,
      averageWin: 600,
      averageLoss: 300,
      riskPerTradePercent: activeAccount?.riskPerTrade || 0.5,
      tradesPerDay: 3,
      maxDays: 45,
      commissionsPerTrade: 2.5,
      simulationsCount: 1000,
      seed: 777,
    };
    return simulatePropFirmChallenge(config);
  });

  const [isSimulating, setIsSimulating] = useState(false);

  const handleSimulate = () => {
    setIsSimulating(true);

    setTimeout(() => {
      const config: PropFirmSimulatorConfig = {
        initialCapital: Number(initialCapital) || 50000,
        profitTargetPercent: Number(profitTargetPercent) || 8,
        dailyLossLimitPercent: Number(dailyLossLimitPercent) || 4,
        maxDrawdownPercent: Number(maxDrawdownPercent) || 8,
        drawdownType,
        dailyLossType,
        dailyLossEnforcement,
        dailyLossBase,
        resetHour: 0,
        resetTimezone: 'UTC',
        winRate: Number(winRate) || 50,
        averageWin: Number(averageWin) || 600,
        averageLoss: Number(averageLoss) || 300,
        riskPerTradePercent: Number(riskPerTradePercent) || 0.5,
        tradesPerDay: Number(tradesPerDay) || 3,
        maxDays: Number(maxDays) || 45,
        commissionsPerTrade: Number(commissions) || 0,
        simulationsCount: Number(simulationsCount) || 1000,
        seed: Number(seed) || 777,
      };

      const res = simulatePropFirmChallenge(config);
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
            <Award className="w-6 h-6 text-[#8B5CF6]" />
            {t.propFirm.title}
          </h1>
          <p className="text-sm text-[#8899A6] mt-1">{t.propFirm.subtitle}</p>
        </div>

        <Button
          onClick={handleSimulate}
          disabled={isSimulating}
          className="bg-[#8B5CF6] hover:bg-[#8B5CF6]/90 text-white font-semibold gap-2"
        >
          <Play className="w-4 h-4 fill-current" />
          {isSimulating ? 'Simulando Challenge...' : t.propFirm.runButton}
        </Button>
      </div>

      {/* Rules Configuration Card */}
      <Card className="p-5 bg-[#111C35] border border-[#1E2D4A]">
        <div className="flex items-center gap-2 mb-4 text-xs font-semibold uppercase tracking-wider text-[#8B5CF6]">
          <Sliders className="w-4 h-4" />
          {t.propFirm.configTitle}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Input
            label={t.propFirm.capital}
            type="number"
            step="1000"
            value={initialCapital}
            onChange={(e) => setInitialCapital(Number(e.target.value))}
          />

          <Input
            label={t.propFirm.profitTarget}
            type="number"
            step="0.5"
            value={profitTargetPercent}
            onChange={(e) => setProfitTargetPercent(Number(e.target.value))}
          />

          <Input
            label={t.propFirm.dailyLossLimit}
            type="number"
            step="0.5"
            value={dailyLossLimitPercent}
            onChange={(e) => setDailyLossLimitPercent(Number(e.target.value))}
          />

          <Input
            label={t.propFirm.maxDrawdown}
            type="number"
            step="0.5"
            value={maxDrawdownPercent}
            onChange={(e) => setMaxDrawdownPercent(Number(e.target.value))}
          />

          <Select
            label={t.propFirm.drawdownType}
            value={drawdownType}
            onChange={(e) => setDrawdownType(e.target.value as PropFirmDrawdownType)}
            options={[
              { value: 'static', label: t.propFirm.drawdownStatic },
              { value: 'trailing_balance', label: t.propFirm.drawdownTrailingBalance },
              { value: 'trailing_equity', label: t.propFirm.drawdownTrailingEquity },
              { value: 'trailing_hwm_lock', label: t.propFirm.drawdownTrailingLock },
            ]}
          />

          <Select
            label={t.propFirm.dailyLossType}
            value={dailyLossType}
            onChange={(e) => setDailyLossType(e.target.value as PropFirmDailyLossType)}
            options={[
              { value: 'balance_based', label: t.propFirm.dailyBalanceBased },
              { value: 'equity_based', label: t.propFirm.dailyEquityBased },
            ]}
          />

          <Select
            label={t.propFirm.enforcement}
            value={dailyLossEnforcement}
            onChange={(e) =>
              setDailyLossEnforcement(e.target.value as PropFirmDailyLossEnforcement)
            }
            options={[
              { value: 'hard_breach', label: t.propFirm.enforceHardBreach },
              { value: 'soft_pause', label: t.propFirm.enforceSoftPause },
            ]}
          />

          <Select
            label="Base Límite Diario"
            value={dailyLossBase}
            onChange={(e) =>
              setDailyLossBase(e.target.value as 'initial_capital' | 'day_start_balance')
            }
            options={[
              { value: 'initial_capital', label: 'Capital Inicial (Estilo FTMO)' },
              { value: 'day_start_balance', label: 'Balance de Apertura del Día' },
            ]}
          />

          <Input
            label={t.propFirm.riskPerTrade}
            type="number"
            step="0.1"
            value={riskPerTradePercent}
            onChange={(e) => setRiskPerTradePercent(Number(e.target.value))}
          />

          <Input
            label={t.propFirm.tradesPerDay}
            type="number"
            min={1}
            max={15}
            value={tradesPerDay}
            onChange={(e) => setTradesPerDay(Number(e.target.value))}
          />

          <Input
            label="Win Rate (%)"
            type="number"
            min={1}
            max={99}
            value={winRate}
            onChange={(e) => setWinRate(Number(e.target.value))}
          />

          <Input
            label="Ganancia Media ($)"
            type="number"
            value={averageWin}
            onChange={(e) => setAverageWin(Number(e.target.value))}
          />

          <Input
            label="Pérdida Media ($)"
            type="number"
            value={averageLoss}
            onChange={(e) => setAverageLoss(Number(e.target.value))}
          />

          <Input
            label={t.propFirm.maxDays}
            type="number"
            min={5}
            max={180}
            value={maxDays}
            onChange={(e) => setMaxDays(Number(e.target.value))}
          />

          <Input
            label={t.propFirm.commissions}
            type="number"
            step="0.5"
            value={commissions}
            onChange={(e) => setCommissions(Number(e.target.value))}
          />

          <Select
            label="Iteraciones"
            value={String(simulationsCount)}
            onChange={(e) => setSimulationsCount(Number(e.target.value))}
            options={[
              { value: '250', label: '250 iteraciones' },
              { value: '500', label: '500 iteraciones' },
              { value: '1000', label: '1,000 iteraciones' },
              { value: '2000', label: '2,000 iteraciones' },
            ]}
          />

          <Input
            label="Semilla (Seed)"
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
          />
        </div>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t.propFirm.passProb}
          value={`${result.passProbability}%`}
          subtitle={`${result.simulationsCount} iteraciones`}
          icon={<ShieldCheck className="w-5 h-5 text-[#10B981]" />}
          trend={result.passProbability >= 60 ? 'up' : result.passProbability >= 30 ? 'neutral' : 'down'}
        />

        <StatCard
          title={t.propFirm.failProb}
          value={`${result.failProbability}%`}
          subtitle={`Timeout: ${result.timeoutProbability}%`}
          icon={<ShieldAlert className="w-5 h-5 text-[#EF4444]" />}
          trend={result.failProbability > 40 ? 'down' : 'neutral'}
        />

        <StatCard
          title={t.propFirm.dailyBreachProb}
          value={`${result.dailyLossBreachProbability}%`}
          subtitle={`Límite: ${result.config.dailyLossLimitPercent}% ($${Math.round(
            (result.config.initialCapital * result.config.dailyLossLimitPercent) / 100,
          )})`}
          icon={<AlertTriangle className="w-5 h-5 text-[#F59E0B]" />}
          trend={result.dailyLossBreachProbability > 20 ? 'down' : 'neutral'}
        />

        <StatCard
          title={t.propFirm.expectedDays}
          value={result.expectedDaysToPass !== null ? `${result.expectedDaysToPass} días` : 'N/A'}
          subtitle={
            result.medianDaysToPass !== null
              ? `Mediana: ${result.medianDaysToPass} días`
              : 'Sin aprobaciones'
          }
          icon={<Clock className="w-5 h-5 text-[#00F0FF]" />}
          trend="neutral"
        />
      </div>

      {/* Sample Trajectories Chart */}
      <Card className="p-5 bg-[#111C35] border border-[#1E2D4A]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-semibold text-[#F5F7FA]">
              {t.propFirm.sampleTrajectories}
            </h2>
            <p className="text-xs text-[#8899A6]">
              Simulación de trayectorias en paralelo frente al Target y al Capital inicial
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-[#10B981]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" /> Target
            </span>
            <span className="flex items-center gap-1 text-[#00F0FF]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00F0FF]" /> Mediana
            </span>
            <span className="flex items-center gap-1 text-[#EF4444]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" /> Fallidas
            </span>
          </div>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={result.samplePaths} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2D4A" opacity={0.6} />
              <XAxis
                dataKey="day"
                stroke="#8899A6"
                fontSize={11}
                tickLine={false}
                tickFormatter={(val) => `Día ${val}`}
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
                formatter={(val: unknown) => [`$${Number(val).toLocaleString()}`, 'Balance']}
              />
              {/* Target Line */}
              <Line
                type="monotone"
                dataKey="targetLine"
                stroke="#10B981"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
              />
              {/* Initial Capital Line */}
              <Line
                type="monotone"
                dataKey="initialCapitalLine"
                stroke="#8899A6"
                strokeWidth={1}
                strokeDasharray="2 2"
                dot={false}
              />
              {/* Passed trajectories */}
              <Line type="monotone" dataKey="passed1" stroke="#34D399" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="passed2" stroke="#6EE7B7" strokeWidth={1} dot={false} />
              {/* Median Path */}
              <Line type="monotone" dataKey="medianPath" stroke="#00F0FF" strokeWidth={2.5} dot={false} />
              {/* Failed trajectories */}
              <Line type="monotone" dataKey="failed1" stroke="#EF4444" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="failed2" stroke="#F87171" strokeWidth={1} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Breach Breakdown & Days Distribution Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Breach Causes Breakdown */}
        <Card className="p-5 bg-[#111C35] border border-[#1E2D4A]">
          <h2 className="text-base font-semibold text-[#F5F7FA] mb-2">
            {t.propFirm.breachBreakdown}
          </h2>
          <p className="text-xs text-[#8899A6] mb-4">
            Análisis de las vulnerabilidades del sistema frente a las reglas de la empresa
          </p>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-[#0A1128] border border-[#1E2D4A] flex items-center justify-between">
              <span className="text-[#8899A6]">Breach por Límite de Pérdida Diaria:</span>
              <span className="font-bold text-[#F59E0B]">
                {result.breachAnalysis.dailyLossBreaches} cuentas ({result.dailyLossBreachProbability}%)
              </span>
            </div>

            <div className="p-3 rounded-lg bg-[#0A1128] border border-[#1E2D4A] flex items-center justify-between">
              <span className="text-[#8899A6]">Breach por Drawdown Máximo:</span>
              <span className="font-bold text-[#EF4444]">
                {result.breachAnalysis.maxDrawdownBreaches} cuentas ({result.maxDrawdownBreachProbability}%)
              </span>
            </div>

            <div className="p-3 rounded-lg bg-[#0A1128] border border-[#1E2D4A] flex items-center justify-between">
              <span className="text-[#8899A6]">Incumplimiento Simultáneo (Ambas):</span>
              <span className="font-bold text-[#8899A6]">
                {result.breachAnalysis.bothBreached} cuentas
              </span>
            </div>
          </div>
        </Card>

        {/* Days to Pass Distribution Histogram */}
        <Card className="p-5 bg-[#111C35] border border-[#1E2D4A]">
          <h2 className="text-base font-semibold text-[#F5F7FA] mb-2">
            Distribución de Días para Pasar
          </h2>
          <p className="text-xs text-[#8899A6] mb-4">
            Tiempo requerido para alcanzar el objetivo sin incurrir en infracción
          </p>

          {result.daysDistribution.length > 0 ? (
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={result.daysDistribution}
                  margin={{ top: 5, right: 5, left: 5, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E2D4A" opacity={0.6} />
                  <XAxis dataKey="binLabel" stroke="#8899A6" fontSize={9} tickLine={false} />
                  <YAxis stroke="#8899A6" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0A1128',
                      borderColor: '#1E2D4A',
                      borderRadius: '8px',
                      color: '#F5F7FA',
                    }}
                    formatter={(val: unknown) => [`${val}% de pases`, 'Frecuencia']}
                  />
                  <Bar dataKey="percentage" fill="#8B5CF6" radius={[4, 4, 0, 0]} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-44 flex items-center justify-center text-xs text-[#8899A6]">
              No hubo suficientes simulaciones con pase exitoso para generar el histograma.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
