'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Calculator,
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  Percent,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Info,
} from 'lucide-react';
import { useLocale } from '@/lib/i18n/useLocale';
import { useStorage } from '@/hooks/useStorage';
import { calculateRiskOfRuin } from '@/lib/analytics/risk-of-ruin';
import { calculateExpectancy } from '@/lib/analytics/expectancy';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';

export default function RiskOfRuinPage() {
  const { locale, t } = useLocale();
  const { activeAccount, trades } = useStorage();

  const initialCapital = activeAccount?.initialCapital || 10000;

  // Seed default parameters with account historical metrics if available
  const historicalExpectancy = useMemo(() => {
    return calculateExpectancy(trades);
  }, [trades]);

  const [winRate, setWinRate] = useState<number>(
    historicalExpectancy.totalTrades >= 5 ? historicalExpectancy.winRate : 50,
  );
  const [avgWin, setAvgWin] = useState<number>(
    historicalExpectancy.totalTrades >= 5 && historicalExpectancy.averageWin > 0
      ? historicalExpectancy.averageWin
      : 200,
  );
  const [avgLoss, setAvgLoss] = useState<number>(
    historicalExpectancy.totalTrades >= 5 && historicalExpectancy.averageLoss > 0
      ? historicalExpectancy.averageLoss
      : 100,
  );
  const [riskPerTrade, setRiskPerTrade] = useState<number>(1.0);
  const [maxLossLimit, setMaxLossLimit] = useState<number>(10); // 10% Prop Firm drawdown limit default
  const [tradesHorizon, setTradesHorizon] = useState<number>(200);
  const [maxKellyCap, setMaxKellyCap] = useState<number>(20);

  const closedTradesCount = useMemo(() => {
    return trades.filter((tr) => tr.status === 'closed').length;
  }, [trades]);

  const result = useMemo(() => {
    return calculateRiskOfRuin({
      initialCapital,
      winRate: Number(winRate) || 50,
      averageWin: Number(avgWin) || 200,
      averageLoss: Number(avgLoss) || 100,
      riskPerTradePercent: Number(riskPerTrade) || 1.0,
      maxLossLimitPercent: Number(maxLossLimit) || 10,
      tradesHorizon: Number(tradesHorizon) || 200,
      maxKellyCapPercent: Number(maxKellyCap) || 20,
      historicalSampleSize: closedTradesCount,
    });
  }, [initialCapital, winRate, avgWin, avgLoss, riskPerTrade, maxLossLimit, tradesHorizon, maxKellyCap, closedTradesCount]);

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
            <Calculator className="w-6 h-6 text-[#10B981]" />
            {t.riskOfRuin.title}
          </h1>
          <p className="text-sm text-[#8899A6] mt-1">{t.riskOfRuin.subtitle}</p>
        </div>
      </div>

      {/* Input Form Card */}
      <Card className="p-5 bg-[#111C35] border border-[#1E2D4A]">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#10B981] mb-4">
          {t.riskOfRuin.configTitle}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Input
            label={t.riskOfRuin.winRate}
            type="number"
            min={1}
            max={99}
            step="0.5"
            value={winRate}
            onChange={(e) => setWinRate(Number(e.target.value))}
          />
          <Input
            label={t.riskOfRuin.avgWin}
            type="number"
            min={1}
            value={avgWin}
            onChange={(e) => setAvgWin(Number(e.target.value))}
          />
          <Input
            label={t.riskOfRuin.avgLoss}
            type="number"
            min={1}
            value={avgLoss}
            onChange={(e) => setAvgLoss(Number(e.target.value))}
          />
          <Input
            label={t.riskOfRuin.riskPerTrade}
            type="number"
            min={0.1}
            max={20}
            step="0.25"
            value={riskPerTrade}
            onChange={(e) => setRiskPerTrade(Number(e.target.value))}
          />
          <Input
            label={t.riskOfRuin.maxLossLimit}
            type="number"
            min={1}
            max={100}
            value={maxLossLimit}
            onChange={(e) => setMaxLossLimit(Number(e.target.value))}
          />
          <Input
            label="Horizonte de Operaciones"
            type="number"
            min={50}
            max={1000}
            value={tradesHorizon}
            onChange={(e) => setTradesHorizon(Number(e.target.value))}
          />
          <Input
            label="Tope Máx. Kelly (%)"
            type="number"
            min={1}
            max={50}
            value={maxKellyCap}
            onChange={(e) => setMaxKellyCap(Number(e.target.value))}
          />
        </div>
      </Card>

      {/* Analytical KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t.riskOfRuin.asymptoticRoR}
          value={`${result.asymptoticRuinProbability}%`}
          subtitle={`Horizonte T → ∞ (Perry/Vince)`}
          icon={
            result.asymptoticRuinProbability < 1 ? (
              <ShieldCheck className="w-5 h-5 text-[#10B981]" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-[#EF4444]" />
            )
          }
          trend={result.asymptoticRuinProbability < 1 ? 'up' : 'down'}
        />

        <StatCard
          title={`${t.riskOfRuin.finiteRoR} (${tradesHorizon} T)`}
          value={`${result.finiteHorizonRuinProbability}%`}
          subtitle={
            result.exactFiniteRuinProbability !== undefined
              ? `MC (${result.riskUnits} stops) · Exacto DP: ${result.exactFiniteRuinProbability}%`
              : `Simulación Monte Carlo (${result.riskUnits} stops)`
          }
          icon={<Calculator className="w-5 h-5 text-[#00F0FF]" />}
          trend={result.finiteHorizonRuinProbability < 1 ? 'up' : 'down'}
        />

        <StatCard
          title={t.riskOfRuin.advantage}
          value={result.advantage.toFixed(4)}
          subtitle={`${t.riskOfRuin.edge}: ${result.edgePercent >= 0 ? '+' : ''}${result.edgePercent}%`}
          icon={<TrendingUp className="w-5 h-5 text-[#10B981]" />}
          trend={result.advantage > 0 ? 'up' : 'down'}
        />

        <StatCard
          title={t.riskOfRuin.recoveryProb50}
          value={`${result.recoveryProbability50Pct}%`}
          subtitle="Probabilidad de duplicar capital antes de 0"
          icon={<Percent className="w-5 h-5 text-[#8B5CF6]" />}
          trend={result.recoveryProbability50Pct >= 80 ? 'up' : 'neutral'}
        />
      </div>

      {/* Kelly Criterion Card */}
      <Card className="p-5 bg-[#111C35] border border-[#1E2D4A]">
        <div className="flex items-center gap-2 mb-2">
          <Percent className="w-5 h-5 text-[#00F0FF]" />
          <h2 className="text-base font-semibold text-[#F5F7FA]">{t.riskOfRuin.kellyTitle}</h2>
        </div>
        <p className="text-xs text-[#8899A6] mb-4">{t.riskOfRuin.kellyWarning}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-[#0A1128] border border-[#1E2D4A] text-center">
            <span className="text-xs text-[#8899A6] block">{t.riskOfRuin.fullKelly}</span>
            <span className="text-2xl font-bold text-[#F59E0B] mt-1 block">
              {result.kellyCriterion.fullKellyPercent}%
            </span>
            <span className="text-[11px] text-[#8899A6] mt-0.5 block">
              {result.kellyCriterion.isCapped
                ? `Limitado por tope a ${result.kellyCriterion.cappedKellyPercent}%`
                : 'Máximo crecimiento teórico'}
            </span>
          </div>

          <div className="p-4 rounded-lg bg-[#0A1128] border border-[#10B981]/30 text-center">
            <span className="text-xs text-[#10B981] font-medium block">
              {t.riskOfRuin.halfKelly}
            </span>
            <span className="text-2xl font-bold text-[#10B981] mt-1 block">
              {result.kellyCriterion.halfKellyPercent}%
            </span>
            <span className="text-[11px] text-[#8899A6] mt-0.5 block">
              75% del retorno con 50% de volatilidad
            </span>
          </div>

          <div className="p-4 rounded-lg bg-[#0A1128] border border-[#00F0FF]/30 text-center">
            <span className="text-xs text-[#00F0FF] font-medium block">
              {t.riskOfRuin.quarterKelly}
            </span>
            <span className="text-2xl font-bold text-[#00F0FF] mt-1 block">
              {result.kellyCriterion.quarterKellyPercent}%
            </span>
            <span className="text-[11px] text-[#8899A6] mt-0.5 block">
              Enfoque recomendado para cuentas fondeadas
            </span>
          </div>

          <div className="p-4 rounded-lg bg-[#0A1128] border border-[#8B5CF6]/30 text-center">
            <span className="text-xs text-[#A78BFA] font-medium block">
              {t.riskOfRuin.stressedKelly}
            </span>
            <span className="text-2xl font-bold text-[#A78BFA] mt-1 block">
              {result.kellySensitivity.stressedKellyPercent}%
            </span>
            <span className="text-[11px] text-[#8899A6] mt-0.5 block">
              Degradación muestral (-5% W, -15% R)
            </span>
          </div>
        </div>

        {/* Kelly Sensitivity Card / Sub-row */}
        <div className="mt-4 pt-4 border-t border-[#1E2D4A] grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3 bg-[#0A1128] rounded border border-[#1E2D4A]/60 flex items-center justify-between">
            <div>
              <span className="text-xs text-[#8899A6] block">{t.riskOfRuin.sensitivityW}</span>
              <span className="text-[11px] text-[#8899A6]/70">Derivada formal ∂K/∂W = 1 + 1/R</span>
            </div>
            <span className="text-sm font-bold text-[#00F0FF] font-mono">
              +{result.kellySensitivity.sensitivityToWinRate.toFixed(2)}x
            </span>
          </div>
          <div className="p-3 bg-[#0A1128] rounded border border-[#1E2D4A]/60 flex items-center justify-between">
            <div>
              <span className="text-xs text-[#8899A6] block">{t.riskOfRuin.sensitivityR}</span>
              <span className="text-[11px] text-[#8899A6]/70">Derivada formal ∂K/∂R = (1-W)/R²</span>
            </div>
            <span className="text-sm font-bold text-[#00F0FF] font-mono">
              +{result.kellySensitivity.sensitivityToPayoff.toFixed(2)}x
            </span>
          </div>
        </div>
      </Card>

      {/* Multi-Tier Risk Sensitivity Comparison Table */}
      <Card className="p-5 bg-[#111C35] border border-[#1E2D4A]">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-[#F5F7FA]">
            {t.riskOfRuin.scenariosTitle}
          </h2>
          <p className="text-xs text-[#8899A6]">
            Evaluación comparativa de supervivencia matemática para un límite de pérdida de {maxLossLimit}%
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#1E2D4A] text-[#8899A6]">
                <th className="py-2.5 px-3">{t.riskOfRuin.riskTier}</th>
                <th className="py-2.5 px-3">Riesgo / Trade</th>
                <th className="py-2.5 px-3">Unidades de Parada</th>
                <th className="py-2.5 px-3">{t.riskOfRuin.analyticalRoR}</th>
                <th className="py-2.5 px-3">{t.riskOfRuin.empiricalRoR}</th>
                <th className="py-2.5 px-3">{t.riskOfRuin.expectedReturn}</th>
                <th className="py-2.5 px-3">{t.riskOfRuin.expectedMaxDd}</th>
                <th className="py-2.5 px-3 text-right">{t.riskOfRuin.recommendation}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2D4A]/50 text-[#F5F7FA]">
              {result.scenarios.map((sc) => {
                const units = Number((maxLossLimit / sc.riskPercent).toFixed(1));
                return (
                  <tr
                    key={sc.riskPercent}
                    className={`hover:bg-[#1E2D4A]/30 transition-colors ${
                      sc.riskPercent === riskPerTrade ? 'bg-[#00F0FF]/5' : ''
                    }`}
                  >
                    <td className="py-3 px-3">
                      <Badge
                        variant={
                          sc.riskTag === 'conservative'
                            ? 'green'
                            : sc.riskTag === 'balanced'
                            ? 'cyan'
                            : sc.riskTag === 'aggressive'
                            ? 'yellow'
                            : 'red'
                        }
                      >
                        {sc.riskTag.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 font-semibold">{sc.riskPercent}%</td>
                    <td className="py-3 px-3 text-[#8899A6]">{units} stops</td>
                    <td className="py-3 px-3 font-medium">
                      <span
                        className={
                          sc.formulaRuinPercent < 1
                            ? 'text-[#10B981]'
                            : sc.formulaRuinPercent < 5
                            ? 'text-[#F59E0B]'
                            : 'text-[#EF4444]'
                        }
                      >
                        {sc.formulaRuinPercent}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[#8899A6]">{sc.empiricalRuinPercent}%</td>
                    <td className="py-3 px-3 text-[#10B981]">
                      +{sc.expectedFinalReturnPercent}%
                    </td>
                    <td className="py-3 px-3 text-[#EF4444]">
                      ~{sc.expectedMaxDrawdownPercent}%
                    </td>
                    <td className="py-3 px-3 text-right">
                      {sc.isRecommended ? (
                        <span className="inline-flex items-center gap-1 text-[#10B981] font-medium text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Recomendado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[#8899A6] text-xs">
                          <XCircle className="w-3.5 h-3.5 text-[#EF4444]" /> Elevado Riesgo
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mathematical Hypotheses and Limitations */}
      {result.hypothesesAndLimits && result.hypothesesAndLimits.length > 0 && (
        <Card className="p-5 bg-[#111C35] border border-[#1E2D4A]">
          <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wider text-[#00F0FF]">
            <Info className="w-4 h-4" />
            {t.riskOfRuin.hypothesesTitle}
          </div>
          <ul className="space-y-2 text-xs text-[#8899A6]">
            {result.hypothesesAndLimits.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-[#00F0FF] font-bold">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
