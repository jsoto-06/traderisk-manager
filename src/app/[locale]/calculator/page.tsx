'use client';

import React, { useState, useMemo } from 'react';
import {
  Calculator as CalcIcon,
  TrendingUp,
  TrendingDown,
  Plus,
  AlertCircle,
  Coins,
  DollarSign,
  BarChart3,
  Building2,
} from 'lucide-react';
import { useLocale } from '@/lib/i18n/useLocale';
import { useStorage } from '@/hooks/useStorage';
import { calculateRisk, type RiskResult } from '@/lib/risk-engine';
import { InstrumentType, type Direction, type MarketType } from '@/lib/types';
import { formatCurrency, formatPercent } from '@/lib/i18n';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

interface AssetPreset {
  name: string;
  entry: string;
  sl: string;
  tp: string;
  instrument: InstrumentType;
  leverage: string;
  comm: string;
  multiplier?: string;
  tickSize?: string;
  marginPerUnit?: string;
  pipSize?: string;
  fundingRate?: string;
}

const ASSET_PRESETS: Record<MarketType, AssetPreset[]> = {
  crypto: [
    { name: 'BTC/USDT Spot', entry: '80000', sl: '78500', tp: '84500', instrument: InstrumentType.Spot, leverage: '1', comm: '0.05' },
    { name: 'BTC/USDT Perp', entry: '80000', sl: '78000', tp: '86000', instrument: InstrumentType.Perpetual, leverage: '10', comm: '0.04', fundingRate: '0.01' },
    { name: 'ETH/USDT Perp', entry: '3200', sl: '3100', tp: '3450', instrument: InstrumentType.Perpetual, leverage: '10', comm: '0.04', fundingRate: '0.01' },
    { name: 'SOL/USDT Perp', entry: '185', sl: '178', tp: '205', instrument: InstrumentType.Perpetual, leverage: '5', comm: '0.05', fundingRate: '0.01' },
  ],
  forex: [
    { name: 'EUR/USD (Standard Lot)', entry: '1.0850', sl: '1.0820', tp: '1.0940', instrument: InstrumentType.ForexLot, leverage: '30', comm: '0', pipSize: '0.0001' },
    { name: 'GBP/USD (Standard Lot)', entry: '1.2950', sl: '1.2910', tp: '1.3070', instrument: InstrumentType.ForexLot, leverage: '30', comm: '0', pipSize: '0.0001' },
    { name: 'USD/JPY (JPY Cross)', entry: '152.50', sl: '152.00', tp: '154.00', instrument: InstrumentType.ForexLot, leverage: '30', comm: '0', pipSize: '0.01' },
  ],
  futures: [
    { name: 'E-mini S&P 500 (ES)', entry: '5850.00', sl: '5830.00', tp: '5910.00', instrument: InstrumentType.Futures, leverage: '10', comm: '0', multiplier: '50', tickSize: '0.25', marginPerUnit: '1250' },
    { name: 'Micro E-mini S&P (MES)', entry: '5850.00', sl: '5830.00', tp: '5910.00', instrument: InstrumentType.Futures, leverage: '10', comm: '0', multiplier: '5', tickSize: '0.25', marginPerUnit: '125' },
    { name: 'E-mini Nasdaq (NQ)', entry: '20500.00', sl: '20420.00', tp: '20740.00', instrument: InstrumentType.Futures, leverage: '10', comm: '0', multiplier: '20', tickSize: '0.25', marginPerUnit: '1850' },
    { name: 'Crude Oil (CL)', entry: '71.50', sl: '70.70', tp: '73.90', instrument: InstrumentType.Futures, leverage: '10', comm: '0', multiplier: '1000', tickSize: '0.01', marginPerUnit: '1500' },
  ],
  stocks: [
    { name: 'Apple Inc. (AAPL)', entry: '230.00', sl: '224.00', tp: '245.00', instrument: InstrumentType.Stocks, leverage: '1', comm: '0.1' },
    { name: 'Nvidia Corp. (NVDA)', entry: '140.00', sl: '133.00', tp: '158.00', instrument: InstrumentType.Stocks, leverage: '1', comm: '0.1' },
    { name: 'SPDR S&P 500 (SPY)', entry: '580.00', sl: '574.00', tp: '595.00', instrument: InstrumentType.Stocks, leverage: '2', comm: '0.05' },
  ],
  indices: [],
};

export default function CalculatorPage() {
  const { locale, t } = useLocale();
  const { activeAccount, accounts, selectAccount, addTrade } = useStorage();

  // Multiasset Market & Preset State
  const [market, setMarket] = useState<MarketType>('crypto');
  const [selectedAccountId, setSelectedAccountId] = useState(activeAccount?.id || '');
  const [asset, setAsset] = useState('BTC/USDT Spot');
  const [direction, setDirection] = useState<Direction>('long');
  const [instrumentType, setInstrumentType] = useState<InstrumentType>(InstrumentType.Spot);
  const [entryPrice, setEntryPrice] = useState('80000');
  const [stopLoss, setStopLoss] = useState('78500');
  const [takeProfit, setTakeProfit] = useState('84500');
  const [riskMode, setRiskMode] = useState<'percent' | 'amount'>('percent');
  const [riskPercent, setRiskPercent] = useState(
    activeAccount ? String(activeAccount.riskPerTrade) : '0.40',
  );
  const [riskAmount, setRiskAmount] = useState('20');
  const [commission, setCommission] = useState('0.05');
  const [leverage, setLeverage] = useState(
    activeAccount ? String(activeAccount.leverage) : '1',
  );

  // Multi-asset specialized parameter state
  const [contractMultiplier, setContractMultiplier] = useState('50');
  const [tickSize, setTickSize] = useState('0.25');
  const [initialMarginPerUnit, setInitialMarginPerUnit] = useState('1250');
  const [fundingRate, setFundingRate] = useState('0.01');
  const [spreadPips, setSpreadPips] = useState('1.0');
  const [lotType, setLotType] = useState<'standard' | 'mini' | 'micro'>('standard');
  const [allowFractional, setAllowFractional] = useState(true);
  const [includeFeesInRisk, setIncludeFeesInRisk] = useState(false);

  const [capitalBase, setCapitalBase] = useState<'balance' | 'equity'>('balance');
  const [tradeRegistered, setTradeRegistered] = useState(false);

  // Synchronize with active account when it changes or on initial load
  const currentAccount = useMemo(() => {
    return accounts.find((a) => a.id === selectedAccountId) || activeAccount;
  }, [accounts, selectedAccountId, activeAccount]);

  // Handle switching market category tabs and updating asset presets
  const handleMarketChange = (newMarket: MarketType) => {
    setMarket(newMarket);
    const presets = ASSET_PRESETS[newMarket];
    if (presets && presets.length > 0) {
      applyPreset(presets[0]);
    }
  };

  const applyPreset = (preset: AssetPreset) => {
    setAsset(preset.name);
    setEntryPrice(preset.entry);
    setStopLoss(preset.sl);
    setTakeProfit(preset.tp);
    setInstrumentType(preset.instrument);
    setLeverage(preset.leverage);
    setCommission(preset.comm);
    if (preset.multiplier) setContractMultiplier(preset.multiplier);
    if (preset.tickSize) setTickSize(preset.tickSize);
    if (preset.marginPerUnit) setInitialMarginPerUnit(preset.marginPerUnit);
    if (preset.fundingRate) setFundingRate(preset.fundingRate);
    if (preset.instrument === InstrumentType.Futures) {
      setAllowFractional(false);
    } else {
      setAllowFractional(true);
    }
  };

  // Execute multiasset risk engine calculation in real-time
  const { calculation, error }: { calculation: RiskResult | null; error: string | null } =
    useMemo(() => {
      if (!currentAccount) {
        return { calculation: null, error: 'No hay cuenta seleccionada' };
      }

      const baseCapital =
        capitalBase === 'equity' ? currentAccount.equity : currentAccount.balance;
      const entry = parseFloat(entryPrice);
      const sl = parseFloat(stopLoss);
      const tp = takeProfit ? parseFloat(takeProfit) : undefined;
      const comm = commission ? parseFloat(commission) : 0;
      const lev = leverage ? parseFloat(leverage) : 1;

      if (!entry || entry <= 0 || isNaN(entry)) {
        return { calculation: null, error: 'Ingresa un precio de entrada válido' };
      }
      if (!sl || sl <= 0 || isNaN(sl)) {
        return { calculation: null, error: 'Ingresa un nivel de Stop Loss válido' };
      }

      const mult = parseFloat(contractMultiplier) || 1;
      const tSize = parseFloat(tickSize) || 0.25;
      const fRate = parseFloat(fundingRate) || 0;
      const marginUnit = parseFloat(initialMarginPerUnit) || undefined;
      const sPips = parseFloat(spreadPips) || 0;

      const riskInput = {
        accountBalance: baseCapital,
        direction,
        entryPrice: entry,
        stopLoss: sl,
        takeProfit: tp && !isNaN(tp) ? tp : undefined,
        commission: !isNaN(comm) ? comm : 0,
        leverage: !isNaN(lev) && lev > 0 ? lev : 1,
        instrumentType,
        market,
        contractMultiplier: mult,
        tickSize: tSize,
        fundingRate: fRate,
        initialMarginPerUnit: marginUnit,
        spreadPips: sPips,
        lotType,
        allowFractional,
        includeFeesInRisk,
        ...(riskMode === 'percent'
          ? { riskPercent: parseFloat(riskPercent) || 0.4 }
          : { riskAmount: parseFloat(riskAmount) || 20 }),
      };

      try {
        const result = calculateRisk(riskInput);
        return { calculation: result, error: null };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error en el cálculo';
        return { calculation: null, error: msg };
      }
    }, [
      currentAccount,
      capitalBase,
      direction,
      instrumentType,
      market,
      entryPrice,
      stopLoss,
      takeProfit,
      riskMode,
      riskPercent,
      riskAmount,
      commission,
      leverage,
      contractMultiplier,
      tickSize,
      fundingRate,
      initialMarginPerUnit,
      spreadPips,
      lotType,
      allowFractional,
      includeFeesInRisk,
    ]);

  // Handle registering calculated trade into storage
  const handleRegisterTrade = () => {
    if (!calculation || !currentAccount) return;

    addTrade({
      accountId: currentAccount.id,
      asset,
      direction,
      entryPrice: parseFloat(entryPrice),
      stopLoss: parseFloat(stopLoss),
      takeProfit: parseFloat(takeProfit) || 0,
      size: calculation.positionSize,
      status: 'open',
      commissions: calculation.estimatedCommissions,
      openDate: new Date().toISOString(),
      strategy: `MultiAsset (${market.toUpperCase()})`,
      timeframe: '1h',
      notes: `Trade calculado con ${calculation.riskRewardRatio.toFixed(2)} R:R y riesgo de ${formatCurrency(
        calculation.effectiveRiskAmount ?? calculation.riskAmount,
        currentAccount.currency,
        locale,
      )}`,
    });

    setTradeRegistered(true);
    setTimeout(() => setTradeRegistered(false), 4000);
  };

  const accountCurrency = currentAccount?.currency || 'USD';

  return (
    <div className="space-y-6">
      {/* Title Header & Account Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#F5F7FA] flex items-center gap-2.5">
            <CalcIcon className="w-6 h-6 text-[#00F0FF]" />
            {t.calculator.title} Multi-Asset
          </h1>
          <p className="text-sm text-[#94A3B8] mt-1">
            Dimensionamiento exacto para Cripto, Forex, Futuros y Acciones
          </p>
        </div>

        {currentAccount && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#94A3B8]">Cuenta:</span>
              <Select
                value={selectedAccountId}
                onChange={(e) => {
                  setSelectedAccountId(e.target.value);
                  selectAccount(e.target.value);
                }}
                className="py-1 text-xs"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({formatCurrency(acc.balance, acc.currency, locale)})
                  </option>
                ))}
              </Select>
            </div>

            {/* Capital Base Toggle (Balance vs Equity) */}
            <div className="flex bg-[#0A1128] border border-[#1E2D4A] rounded-lg p-0.5 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setCapitalBase('balance')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  capitalBase === 'balance'
                    ? 'bg-[#00F0FF] text-[#0A1128] font-semibold'
                    : 'text-[#94A3B8] hover:text-[#F5F7FA]'
                }`}
                title="Calcular riesgo sobre el saldo actual"
              >
                Balance: {formatCurrency(currentAccount.balance, accountCurrency, locale)}
              </button>
              <button
                type="button"
                onClick={() => setCapitalBase('equity')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  capitalBase === 'equity'
                    ? 'bg-[#00F0FF] text-[#0A1128] font-semibold'
                    : 'text-[#94A3B8] hover:text-[#F5F7FA]'
                }`}
                title="Calcular riesgo sobre la equidad (incluyendo flotante)"
              >
                Equidad: {formatCurrency(currentAccount.equity, accountCurrency, locale)}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Market Category Selector Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 bg-[#111C35] border border-[#1E2D4A] rounded-2xl shadow-lg">
        <button
          type="button"
          onClick={() => handleMarketChange('crypto')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all ${
            market === 'crypto'
              ? 'bg-[#00F0FF] text-[#0A1128] shadow-md'
              : 'text-[#94A3B8] hover:text-[#F5F7FA] hover:bg-[#0A1128]/50'
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>Criptomonedas</span>
        </button>

        <button
          type="button"
          onClick={() => handleMarketChange('forex')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all ${
            market === 'forex'
              ? 'bg-[#00F0FF] text-[#0A1128] shadow-md'
              : 'text-[#94A3B8] hover:text-[#F5F7FA] hover:bg-[#0A1128]/50'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Forex (Divisas)</span>
        </button>

        <button
          type="button"
          onClick={() => handleMarketChange('futures')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all ${
            market === 'futures'
              ? 'bg-[#00F0FF] text-[#0A1128] shadow-md'
              : 'text-[#94A3B8] hover:text-[#F5F7FA] hover:bg-[#0A1128]/50'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Futuros (Ticks)</span>
        </button>

        <button
          type="button"
          onClick={() => handleMarketChange('stocks')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all ${
            market === 'stocks'
              ? 'bg-[#00F0FF] text-[#0A1128] shadow-md'
              : 'text-[#94A3B8] hover:text-[#F5F7FA] hover:bg-[#0A1128]/50'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Acciones / Índices</span>
        </button>
      </div>

      {tradeRegistered && (
        <Alert variant="success" title="¡Operación Registrada con Éxito!">
          La posición se ha guardado en el módulo de Operaciones con estado &quot;Abierta&quot;.
        </Alert>
      )}

      {/* Grid: Form on Left (5 cols), Live Results on Right (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Input Form */}
        <div className="lg:col-span-5 space-y-5">
          <Card
            title="Parámetros de la Operación"
            subtitle="Configura el setup para calcular el tamaño óptimo"
          >
            <div className="space-y-4">
              {/* Preset Selector */}
              {ASSET_PRESETS[market].length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[#94A3B8] block">
                    Preajustes Comunes ({market.toUpperCase()}):
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {ASSET_PRESETS[market].map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                          asset === preset.name
                            ? 'bg-[#00F0FF]/20 border-[#00F0FF] text-[#00F0FF] font-semibold'
                            : 'bg-[#0A1128] border-[#1E2D4A] text-[#94A3B8] hover:text-[#F5F7FA]'
                        }`}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Asset & Direction */}
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Activo / Símbolo"
                  value={asset}
                  onChange={(e) => setAsset(e.target.value)}
                  placeholder="BTC/USDT"
                  required
                />

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#94A3B8]">
                    {t.calculator.direction}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#0A1128] border border-[#1E2D4A] rounded-lg">
                    <button
                      type="button"
                      onClick={() => setDirection('long')}
                      className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                        direction === 'long'
                          ? 'bg-[#10B981] text-white shadow-md'
                          : 'text-[#94A3B8] hover:text-[#F5F7FA]'
                      }`}
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      Long
                    </button>
                    <button
                      type="button"
                      onClick={() => setDirection('short')}
                      className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                        direction === 'short'
                          ? 'bg-[#EF4444] text-white shadow-md'
                          : 'text-[#94A3B8] hover:text-[#F5F7FA]'
                      }`}
                    >
                      <TrendingDown className="w-3.5 h-3.5" />
                      Short
                    </button>
                  </div>
                </div>
              </div>

              {/* Entry Price & Stop Loss */}
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label={t.calculator.entryPrice}
                  type="number"
                  step="any"
                  value={entryPrice}
                  onChange={(e) => setEntryPrice(e.target.value)}
                  prefixText="$"
                  required
                />

                <Input
                  label={t.calculator.stopLoss}
                  type="number"
                  step="any"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  prefixText="$"
                  required
                />
              </div>

              {/* Take Profit */}
              <Input
                label={t.calculator.takeProfit}
                type="number"
                step="any"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                prefixText="$"
                helperText="Opcional: necesario para calcular el ratio Riesgo/Beneficio (R:R)"
              />

              {/* Risk Mode Switcher & Input */}
              <div className="space-y-2 pt-2 border-t border-[#1E2D4A]/50">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#94A3B8]">Modo de Riesgo</span>
                  <div className="flex bg-[#0A1128] border border-[#1E2D4A] rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => setRiskMode('percent')}
                      className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
                        riskMode === 'percent'
                          ? 'bg-[#00F0FF] text-[#0A1128] font-semibold'
                          : 'text-[#94A3B8]'
                      }`}
                    >
                      % Porcentaje
                    </button>
                    <button
                      type="button"
                      onClick={() => setRiskMode('amount')}
                      className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
                        riskMode === 'amount'
                          ? 'bg-[#00F0FF] text-[#0A1128] font-semibold'
                          : 'text-[#94A3B8]'
                      }`}
                    >
                      $ Monto Fijo
                    </button>
                  </div>
                </div>

                {riskMode === 'percent' ? (
                  <Input
                    label="Porcentaje de Riesgo"
                    type="number"
                    step="0.05"
                    value={riskPercent}
                    onChange={(e) => setRiskPercent(e.target.value)}
                    suffixText="%"
                    helperText={`Equivalente a: ${formatCurrency(
                      ((currentAccount?.balance || 5000) * (parseFloat(riskPercent) || 0)) / 100,
                      accountCurrency,
                      locale,
                    )}`}
                  />
                ) : (
                  <Input
                    label="Monto Monetario en Riesgo"
                    type="number"
                    step="5"
                    value={riskAmount}
                    onChange={(e) => setRiskAmount(e.target.value)}
                    prefixText="$"
                    helperText={`Equivalente al ${formatPercent(
                      ((parseFloat(riskAmount) || 0) / (currentAccount?.balance || 5000)) * 100,
                      locale,
                    )} del balance`}
                  />
                )}
              </div>

              {/* Market Specific Inputs Section */}
              <div className="space-y-3 pt-3 border-t border-[#1E2D4A]/50">
                <div className="text-xs font-semibold text-[#00F0FF] uppercase tracking-wider">
                  Especificaciones de {market.toUpperCase()}
                </div>

                {market === 'crypto' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-[#94A3B8] block">Tipo de Contrato</label>
                      <Select
                        value={instrumentType}
                        onChange={(e) => setInstrumentType(e.target.value as InstrumentType)}
                        className="text-xs py-1.5"
                      >
                        <option value={InstrumentType.Spot}>Spot (Contado)</option>
                        <option value={InstrumentType.Perpetual}>Perpetual Swap (Futuro)</option>
                      </Select>
                    </div>

                    {instrumentType === InstrumentType.Perpetual && (
                      <Input
                        label="Funding Rate (8h)"
                        type="number"
                        step="0.005"
                        value={fundingRate}
                        onChange={(e) => setFundingRate(e.target.value)}
                        suffixText="%"
                        helperText="Tasa de financiación estimada"
                      />
                    )}
                  </div>
                )}

                {market === 'forex' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-[#94A3B8] block">Tipo de Lote</label>
                      <Select
                        value={lotType}
                        onChange={(e) => setLotType(e.target.value as 'standard' | 'mini' | 'micro')}
                        className="text-xs py-1.5"
                      >
                        <option value="standard">Estándar (100,000)</option>
                        <option value="mini">Mini (10,000)</option>
                        <option value="micro">Micro (1,000)</option>
                      </Select>
                    </div>

                    <Input
                      label="Spread en Pips"
                      type="number"
                      step="0.1"
                      value={spreadPips}
                      onChange={(e) => setSpreadPips(e.target.value)}
                      suffixText="pips"
                    />
                  </div>
                )}

                {market === 'futures' && (
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Multiplicador ($/punto)"
                      type="number"
                      step="any"
                      value={contractMultiplier}
                      onChange={(e) => setContractMultiplier(e.target.value)}
                      prefixText="$"
                      helperText="P. ej., 50 para ES, 5 para MES"
                    />

                    <Input
                      label="Margen Broker / Contrato"
                      type="number"
                      step="50"
                      value={initialMarginPerUnit}
                      onChange={(e) => setInitialMarginPerUnit(e.target.value)}
                      prefixText="$"
                      helperText="Margen intradiario"
                    />
                  </div>
                )}

                {market === 'stocks' && (
                  <div className="flex items-center justify-between p-2.5 bg-[#0A1128] border border-[#1E2D4A] rounded-xl text-xs">
                    <span className="text-[#F5F7FA]">Permitir Acciones Fraccionadas</span>
                    <button
                      type="button"
                      onClick={() => setAllowFractional(!allowFractional)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                        allowFractional
                          ? 'bg-[#10B981] text-white'
                          : 'bg-[#1E2D4A] text-[#94A3B8]'
                      }`}
                    >
                      {allowFractional ? 'Habilitado' : 'Enteras Solamente'}
                    </button>
                  </div>
                )}
              </div>

              {/* Leverage & Commission */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#1E2D4A]/50">
                <Input
                  label={t.calculator.leverage}
                  type="number"
                  step="1"
                  min="1"
                  value={leverage}
                  onChange={(e) => setLeverage(e.target.value)}
                  suffixText="x"
                />

                <Input
                  label="Comisión Base"
                  type="number"
                  step="0.01"
                  value={commission}
                  onChange={(e) => setCommission(e.target.value)}
                  suffixText="%"
                />
              </div>

              {/* Strict Risk Budget Protection Toggle */}
              <div className="flex items-center justify-between p-3 bg-[#0A1128] border border-[#1E2D4A] rounded-xl text-xs">
                <div>
                  <span className="text-[#F5F7FA] font-medium block">Presupuesto de Riesgo Neto Estricto</span>
                  <span className="text-[11px] text-[#94A3B8]">Deduce comisiones y spread en el dimensionamiento para no exceder el riesgo</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIncludeFeesInRisk(!includeFeesInRisk)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ml-3 ${
                    includeFeesInRisk
                      ? 'bg-[#00F0FF] text-[#0A1128]'
                      : 'bg-[#1E2D4A] text-[#94A3B8]'
                  }`}
                >
                  {includeFeesInRisk ? 'Activado' : 'Desactivado'}
                </button>
              </div>
            </div>
          </Card>
        </div>

        {/* Right: Live Interactive Results */}
        <div className="lg:col-span-7 space-y-5">
          {error ? (
            <Alert variant="warning" title="Parámetros Incompletos">
              {error}
            </Alert>
          ) : calculation ? (
            <>
              {/* Posición Inoperable Warning */}
              {calculation.isOperable === false && calculation.inoperableReason && (
                <Alert variant="error" title="Posición No Operable">
                  {calculation.inoperableReason}
                </Alert>
              )}

              {/* Early Liquidation Alert */}
              {calculation.isLiquidationBeforeSL && (
                <Alert variant="error" title="Peligro: Liquidación Previa al Stop Loss">
                  {`El precio de liquidación estimado ($${calculation.liquidationPrice}) se alcanzará ANTES que el Stop Loss. Reduzca el apalancamiento o acerque el Stop Loss para evitar liquidación forzosa.`}
                </Alert>
              )}

              {/* Highlight Position Card */}
              <div className="bg-gradient-to-br from-[#111C35] to-[#0A1128] border-2 border-[#00F0FF]/40 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#00F0FF]/5 rounded-full blur-2xl pointer-events-none" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1E2D4A]/60">
                  <div>
                    <span className="text-xs font-semibold text-[#00F0FF] uppercase tracking-wider">
                      {t.calculator.positionSize} Óptimo
                    </span>
                    <div className="text-3xl sm:text-4xl font-extrabold text-[#F5F7FA] font-mono mt-1">
                      {calculation.positionSize}{' '}
                      <span className="text-lg text-[#00F0FF] font-medium">
                        {calculation.positionSizeUnit || 'unidades'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-[#94A3B8] block">Riesgo Monetario</span>
                    <div className="text-xl font-bold text-[#EF4444] font-mono">
                      -{formatCurrency(calculation.effectiveRiskAmount ?? calculation.riskAmount, accountCurrency, locale)}
                      <span className="text-xs text-[#94A3B8] font-normal ml-1">
                        ({calculation.riskPercent.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sub metrics grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
                  <div>
                    <span className="text-[11px] text-[#94A3B8] block">Distancia al SL</span>
                    <span className="text-sm font-semibold text-[#F5F7FA] font-mono">
                      {calculation.ticksOrPips != null
                        ? `${calculation.ticksOrPips} ${market === 'forex' ? 'pips' : 'ticks'}`
                        : `$${calculation.stopLossDistance.toFixed(2)}`}
                    </span>
                    <span className="text-[10px] text-[#EF4444] block">
                      ({calculation.stopLossPercent.toFixed(2)}%)
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-[#94A3B8] block">Valor Nocional</span>
                    <span className="text-sm font-semibold text-[#F5F7FA] font-mono">
                      {formatCurrency(calculation.notionalValue, accountCurrency, locale)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-[#94A3B8] block">Margen Requerido</span>
                    <span className="text-sm font-semibold text-[#00F0FF] font-mono">
                      {formatCurrency(calculation.estimatedMargin, accountCurrency, locale)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-[#94A3B8] block">Ratio R:R</span>
                    <span className="text-sm font-bold text-[#10B981] font-mono">
                      {calculation.riskRewardRatio > 0
                        ? `1 : ${calculation.riskRewardRatio.toFixed(2)}`
                        : 'N/A'}
                    </span>
                    {calculation.netRiskRewardRatio > 0 && (
                      <span className="text-[10px] text-[#00F0FF] block">
                        Neto: 1 : {calculation.netRiskRewardRatio.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Overleverage warning */}
                {calculation.estimatedMargin > (currentAccount?.balance || 0) && (
                  <div className="mt-4 p-3 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/40 flex items-start gap-2.5 text-xs text-[#EF4444]">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold block">Margen Insuficiente para la Posición</span>
                      <p className="text-[#94A3B8] text-[11px] mt-0.5">
                        El margen requerido ({formatCurrency(calculation.estimatedMargin, accountCurrency, locale)}) supera el balance de la cuenta ({formatCurrency(currentAccount?.balance || 0, accountCurrency, locale)}).
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Profit & Loss Expectations Card */}
              <Card title="Proyección de Resultados (Neto de Comisiones y Costes)">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Profit Target Result */}
                  <div className="p-4 rounded-xl bg-[#10B981]/10 border border-[#10B981]/30 space-y-1">
                    <div className="flex items-center justify-between text-xs text-[#10B981] font-medium">
                      <span>Beneficio Neto</span>
                      <span>Take Profit</span>
                    </div>
                    <div className="text-2xl font-bold text-[#10B981] font-mono">
                      +{formatCurrency(calculation.netProfit, accountCurrency, locale)}
                    </div>
                    <p className="text-[11px] text-[#94A3B8]">
                      Bruto: {formatCurrency(calculation.potentialProfit, accountCurrency, locale)} · Comisiones al TP:{' '}
                      {formatCurrency(calculation.estimatedCommissions, accountCurrency, locale)}
                    </p>
                  </div>

                  {/* Stop Loss Result */}
                  <div className="p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 space-y-1">
                    <div className="flex items-center justify-between text-xs text-[#EF4444] font-medium">
                      <span>Pérdida Máxima Neta</span>
                      <span>Stop Loss</span>
                    </div>
                    <div className="text-2xl font-bold text-[#EF4444] font-mono">
                      {formatCurrency(calculation.netLoss, accountCurrency, locale)}
                    </div>
                    <p className="text-[11px] text-[#94A3B8]">
                      Bruto: {formatCurrency(calculation.potentialLoss, accountCurrency, locale)} · Costes al SL:{' '}
                      {formatCurrency(calculation.lossCommissions, accountCurrency, locale)}
                    </p>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-[#1E2D4A]/60 flex items-center justify-between flex-wrap gap-3">
                  <div className="text-xs text-[#94A3B8]">
                    ¿Listo para ejecutar? Registra esta posición para monitorearla en tiempo real.
                  </div>
                  <Button
                    onClick={handleRegisterTrade}
                    variant="primary"
                    size="sm"
                    leftIcon={<Plus className="w-4 h-4" />}
                  >
                    Registrar en Operaciones
                  </Button>
                </div>
              </Card>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
