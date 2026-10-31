// =============================================================================
// TradeRisk Manager — Forex Risk Engine (Lots, Pips, Cross-Currency & Spread)
// =============================================================================

import type { RiskCalculationInput, RiskCalculationOutput } from '@/lib/types';
import {
  calcPips,
  floorToStep,
  roundDecimal,
  safeDivide,
} from './precision';

/**
 * Calculates risk metrics for Forex instruments with standard, mini, and micro lots.
 * Supports cross-currency conversions, pip/pipette precision, mid/bid/ask spread
 * accounting without double-counting, and strict risk-budget capping.
 */
export function calculateForexRisk(input: RiskCalculationInput): RiskCalculationOutput {
  const leverage = input.leverage ?? 30; // Standard retail forex leverage default (e.g. ESMA 30:1)

  // Lot unit configuration (Standard: 100,000; Mini: 10,000; Micro: 1,000)
  const lotType = input.lotType ?? 'standard';
  const lotUnits =
    lotType === 'mini' ? 10000 : lotType === 'micro' ? 1000 : 100000;

  // Pip size determination (0.01 for JPY pairs or price > 50; 0.0001 otherwise)
  const pipSize =
    input.pipSize != null
      ? input.pipSize
      : input.entryPrice > 50
        ? 0.01
        : 0.0001;

  // Available free margin verification (accounting for equity and used margin)
  const freeMargin =
    input.freeMargin != null
      ? input.freeMargin
      : input.accountEquity != null
        ? input.accountEquity - (input.usedMargin ?? 0)
        : input.accountBalance - (input.usedMargin ?? 0);

  // Monetary risk budget
  const riskAmount =
    input.riskAmount != null
      ? input.riskAmount
      : (input.riskPercent! / 100) * input.accountBalance;

  const riskPercent =
    input.riskPercent != null
      ? input.riskPercent
      : safeDivide(riskAmount * 100, input.accountBalance);

  // Stop loss distance in price and in pips (with pipette precision)
  const stopLossDistance = Math.abs(input.entryPrice - input.stopLoss);
  const stopLossPercent = safeDivide(stopLossDistance * 100, input.entryPrice);
  const stopLossPips = calcPips(stopLossDistance, pipSize);

  // -------------------------------------------------------------------------
  // Currency Conversion Validation & Resolution
  // -------------------------------------------------------------------------
  let baseCurrency: string | undefined;
  let quoteCurrency: string | undefined;
  if (input.assetSymbol) {
    const parts = input.assetSymbol.split(/[/_-]/);
    if (parts.length >= 2) {
      baseCurrency = parts[0].toUpperCase();
      quoteCurrency = parts[1].toUpperCase();
    }
  }

  const accountCurrency = (input.accountCurrency ?? 'USD').toUpperCase();
  let quoteToAccountRate: number | undefined = input.quoteToAccountRate;
  let conversionError: string | undefined;

  if (quoteToAccountRate != null) {
    if (quoteToAccountRate <= 0 || !Number.isFinite(quoteToAccountRate)) {
      conversionError = 'La tasa de conversión quoteToAccountRate debe ser un número positivo.';
    }
  } else if (quoteCurrency && accountCurrency) {
    if (quoteCurrency === accountCurrency) {
      // E.g. EUR/USD with USD account -> rate = 1.0
      quoteToAccountRate = 1.0;
    } else if (baseCurrency === accountCurrency) {
      // E.g. USD/JPY with USD account -> rate = 1 / entryPrice
      // E.g. EUR/GBP with EUR account -> rate = 1 / entryPrice
      quoteToAccountRate = safeDivide(1, input.entryPrice);
    } else {
      // Cross currency: quote is neither account nor base currency
      conversionError = `Falta la tasa de conversión de la divisa cotizada (${quoteCurrency}) a la divisa de cuenta (${accountCurrency}). Especifique quoteToAccountRate.`;
    }
  } else {
    // Heuristic fallback when assetSymbol is not explicitly specified
    if (accountCurrency === 'USD') {
      if (pipSize === 0.01 && input.entryPrice > 50) {
        quoteToAccountRate = safeDivide(1, input.entryPrice, 1.0);
      } else {
        quoteToAccountRate = 1.0;
      }
    } else {
      conversionError = `Para cuentas en ${accountCurrency}, debe especificar quoteToAccountRate para calcular el valor exacto del pip.`;
    }
  }

  // -------------------------------------------------------------------------
  // MISSING CONVERSION RATE: Abort as Inoperable
  // -------------------------------------------------------------------------
  if (conversionError || quoteToAccountRate == null || quoteToAccountRate <= 0) {
    return {
      riskAmount: roundDecimal(riskAmount, 2),
      riskPercent: roundDecimal(riskPercent, 2),
      stopLossDistance,
      stopLossPercent: roundDecimal(stopLossPercent, 2),
      positionSize: 0,
      notionalValue: 0,
      estimatedMargin: 0,
      maintenanceMargin: 0,
      isMarginEstimated: false,
      potentialProfit: 0,
      potentialLoss: 0,
      grossRisk: 0,
      totalEstimatedCosts: 0,
      effectiveNetRisk: 0,
      riskRewardRatio: 0,
      netRiskRewardRatio: 0,
      estimatedCommissions: 0,
      lossCommissions: 0,
      netProfit: 0,
      netLoss: 0,
      positionSizeUnit: 'lots',
      ticksOrPips: stopLossPips,
      pipValue: 0,
      effectiveRiskAmount: 0,
      isOperable: false,
      inoperableReason: conversionError || 'Tasa de conversión de divisa inválida.',
    };
  }

  // Pip value in account currency per standard lot (1.0 standard lot = 100,000 units)
  const pipValuePerStandardLot = 100000 * pipSize * quoteToAccountRate;
  // Scaled pip value for the specific lot type being traded
  const pipValuePerLot = (lotUnits / 100000) * pipValuePerStandardLot;

  // -------------------------------------------------------------------------
  // Spread & Commission Costs per Lot
  // -------------------------------------------------------------------------
  // Mid vs Bid/Ask price convention:
  // If input.pricesIncludeSpread === true, the user entered broker Bid/Ask execution prices,
  // so the spread is ALREADY embedded in (entryPrice - stopLoss). Do NOT double count.
  const spreadPips = input.pricesIncludeSpread ? 0 : (input.spreadPips ?? 0);
  const spreadCostPerLot = spreadPips * pipValuePerLot;

  // Base currency to account currency rate (for notional value calculation)
  // E.g. EUR/USD with USD account: 1 EUR = entryPrice (1.0850) USD
  // E.g. USD/JPY with USD account: 1 USD = 1.0 USD
  // E.g. GBP/JPY with USD account: 1 GBP in USD = entryPrice (190) * quoteToAccountRate (1/155) = 1.2258 USD
  const baseToAccountRate =
    input.baseToAccountRate ??
    (baseCurrency === accountCurrency
      ? 1.0
      : input.entryPrice * quoteToAccountRate);

  // Institutional ECN commission: percentage or flat $7 round-turn per standard lot
  const commissionRate = input.commission ?? 0;
  const commPerStandardLot =
    commissionRate > 0
      ? (commissionRate / 100) * (100000 * baseToAccountRate)
      : 7.0;
  const commPerLot = (lotUnits / 100000) * commPerStandardLot;

  // -------------------------------------------------------------------------
  // Lot Sizing
  // -------------------------------------------------------------------------
  const priceLossPerLot = stopLossPips * pipValuePerLot;

  // If includeFeesInRisk is requested, budget includes spread friction and commissions
  const unitCostForSizing =
    input.includeFeesInRisk === true
      ? priceLossPerLot + spreadCostPerLot + commPerLot
      : priceLossPerLot;

  const rawLots = safeDivide(riskAmount, unitCostForSizing);

  // Position sizing in steps of 0.01 lots
  let positionSize = floorToStep(rawLots, 0.01);

  // If includeFeesInRisk is NOT enabled, maintain standard retail round-to-nearest
  if (input.includeFeesInRisk !== true) {
    positionSize = Math.max(0.01, roundDecimal(rawLots, 2));
  }

  // Take profit calculations
  const takeProfitDistance =
    input.takeProfit != null ? Math.abs(input.takeProfit - input.entryPrice) : 0;
  const takeProfitPips = calcPips(takeProfitDistance, pipSize);
  const riskRewardRatio = safeDivide(takeProfitPips, stopLossPips);

  // -------------------------------------------------------------------------
  // INSUFFICIENT RISK CASE: When budget cannot cover 0.01 lot safely
  // -------------------------------------------------------------------------
  if (positionSize <= 0 || (input.includeFeesInRisk === true && rawLots < 0.01)) {
    return {
      riskAmount: roundDecimal(riskAmount, 2),
      riskPercent: roundDecimal(riskPercent, 2),
      stopLossDistance,
      stopLossPercent: roundDecimal(stopLossPercent, 2),
      positionSize: 0,
      notionalValue: 0,
      estimatedMargin: 0,
      maintenanceMargin: 0,
      isMarginEstimated: false,
      potentialProfit: 0,
      potentialLoss: 0,
      grossRisk: 0,
      totalEstimatedCosts: 0,
      effectiveNetRisk: 0,
      riskRewardRatio: roundDecimal(riskRewardRatio, 2),
      netRiskRewardRatio: 0,
      estimatedCommissions: 0,
      lossCommissions: 0,
      netProfit: 0,
      netLoss: 0,
      positionSizeUnit: 'lots',
      ticksOrPips: stopLossPips,
      pipValue: 0,
      effectiveRiskAmount: 0,
      isOperable: false,
      inoperableReason:
        'Presupuesto de riesgo insuficiente para operar el lote mínimo (0.01) sin superar el límite de pérdida.',
    };
  }

  // -------------------------------------------------------------------------
  // OPERABLE FOREX POSITION
  // -------------------------------------------------------------------------
  const effectiveRiskAmount = positionSize * priceLossPerLot;
  const notionalValue = positionSize * lotUnits * baseToAccountRate;
  const estimatedMargin = safeDivide(notionalValue, leverage);
  const maintenanceMargin = roundDecimal(estimatedMargin * 0.5, 2);

  // Check capital sufficiency against Free Margin (not merely balance)
  const hasSufficientMargin = freeMargin >= estimatedMargin;
  const isOperable = hasSufficientMargin;
  const inoperableReason = !hasSufficientMargin
    ? `Margen requerido ($${roundDecimal(estimatedMargin, 2)}) supera el margen libre disponible ($${roundDecimal(freeMargin, 2)}).`
    : undefined;

  const potentialProfit = positionSize * takeProfitPips * pipValuePerLot;
  const potentialLoss = effectiveRiskAmount;

  const spreadCost = positionSize * spreadCostPerLot;
  const commissionCost = positionSize * commPerLot;
  const totalFrictions = commissionCost + spreadCost;

  const netProfit = potentialProfit - totalFrictions;
  const netLoss = -(potentialLoss + totalFrictions);

  const netRiskRewardRatio =
    input.takeProfit != null ? safeDivide(netProfit, Math.abs(netLoss)) : 0;

  return {
    riskAmount: roundDecimal(riskAmount, 2),
    riskPercent: roundDecimal(riskPercent, 2),
    stopLossDistance,
    stopLossPercent: roundDecimal(stopLossPercent, 2),
    positionSize,
    notionalValue: roundDecimal(notionalValue, 2),
    estimatedMargin: roundDecimal(estimatedMargin, 2),
    maintenanceMargin: roundDecimal(maintenanceMargin, 2),
    isMarginEstimated: false,
    freeMargin: roundDecimal(freeMargin, 2),
    potentialProfit: roundDecimal(potentialProfit, 2),
    potentialLoss: roundDecimal(potentialLoss, 2),
    grossRisk: roundDecimal(potentialLoss, 2),
    totalEstimatedCosts: roundDecimal(totalFrictions, 2),
    effectiveNetRisk: roundDecimal(Math.abs(netLoss), 2),
    riskRewardRatio: roundDecimal(riskRewardRatio, 2),
    netRiskRewardRatio: roundDecimal(netRiskRewardRatio, 2),
    estimatedCommissions: roundDecimal(totalFrictions, 2),
    lossCommissions: roundDecimal(totalFrictions, 2),
    netProfit: roundDecimal(netProfit, 2),
    netLoss: roundDecimal(netLoss, 2),
    positionSizeUnit: 'lots',
    ticksOrPips: stopLossPips,
    pipValue: roundDecimal(positionSize * pipValuePerLot, 2),
    effectiveRiskAmount: roundDecimal(effectiveRiskAmount, 2),
    isOperable,
    inoperableReason,
  };
}
