// =============================================================================
// TradeRisk Manager — Futures Risk Engine (Contracts, Ticks, Multipliers & Margin)
// =============================================================================

import type { RiskCalculationInput, RiskCalculationOutput } from '@/lib/types';
import {
  calcTicks,
  isPriceOnGrid,
  roundDecimal,
  safeDivide,
} from './precision';

/**
 * Calculates risk metrics for exchange-traded Futures contracts.
 * Enforces discrete contracts, strict risk-budget caps, margin validation,
 * free margin checks, tick grid alignment, and separation of gross/net risks.
 */
export function calculateFuturesRisk(input: RiskCalculationInput): RiskCalculationOutput {
  // Contract Multiplier (e.g. 50 for ES, 5 for MES, 20 for NQ, 1000 for CL)
  const multiplier = input.contractMultiplier ?? 50;
  if (multiplier <= 0) {
    throw new Error('contractMultiplier must be a positive number');
  }

  // Tick Size (minimum price increment, e.g. 0.25 for ES/NQ, 0.01 for CL)
  const tickSize = input.tickSize ?? 0.25;
  if (tickSize <= 0) {
    throw new Error('tickSize must be a positive number');
  }

  // Available free margin verification (accounting for equity and used margin)
  const freeMargin =
    input.freeMargin != null
      ? input.freeMargin
      : input.accountEquity != null
        ? input.accountEquity - (input.usedMargin ?? 0)
        : input.accountBalance - (input.usedMargin ?? 0);

  // Tick Value = tickSize * multiplier (e.g. 0.25 * 50 = $12.50)
  const tickValue = input.tickValue ?? roundDecimal(tickSize * multiplier, 4);

  // Point Value = 1 full point * multiplier
  const pointValue = multiplier;

  // Price grid check
  let priceGridWarning: string | undefined;
  const entryOnGrid = isPriceOnGrid(input.entryPrice, tickSize);
  const slOnGrid = isPriceOnGrid(input.stopLoss, tickSize);
  if (!entryOnGrid || !slOnGrid) {
    priceGridWarning = `El precio de ${!entryOnGrid ? 'entrada' : 'Stop Loss'} no coincide con el incremento mínimo de tick (${tickSize}).`;
    if (input.enforceTickGrid) {
      throw new Error(priceGridWarning);
    }
  }

  // Base risk budget
  const riskAmount =
    input.riskAmount != null
      ? input.riskAmount
      : (input.riskPercent! / 100) * input.accountBalance;

  const riskPercent =
    input.riskPercent != null
      ? input.riskPercent
      : safeDivide(riskAmount * 100, input.accountBalance);

  // Stop loss distance in points and ticks
  const stopLossDistance = Math.abs(input.entryPrice - input.stopLoss);
  const stopLossPercent = safeDivide(stopLossDistance * 100, input.entryPrice);
  const stopLossTicks = calcTicks(stopLossDistance, tickSize);

  // Monetary loss per single contract from price distance alone
  const priceLossPerContract = stopLossDistance * multiplier;

  // Round-turn commissions per single contract
  const flatPerContract = input.commissionPerContract ?? (input.commission ? 0 : 4.5);
  const commPerContract =
    flatPerContract > 0
      ? flatPerContract
      : ((input.commission ?? 0) / 100) * (input.entryPrice * multiplier);

  // Unit risk when sizing to strictly respect risk budget including fees
  const unitRiskForSizing =
    input.includeFeesInRisk === true
      ? priceLossPerContract + commPerContract
      : priceLossPerContract;

  // Discrete contracts sizing
  const allowFractional = input.allowFractional ?? false;
  const rawContracts = safeDivide(riskAmount, unitRiskForSizing);
  const positionSize = allowFractional
    ? roundDecimal(rawContracts, 2)
    : Math.floor(rawContracts);

  // Take profit distance
  const takeProfitDistance =
    input.takeProfit != null ? Math.abs(input.takeProfit - input.entryPrice) : 0;
  const riskRewardRatio = safeDivide(takeProfitDistance, stopLossDistance);

  // -------------------------------------------------------------------------
  // INSUFFICIENT RISK CASE: When budget cannot cover 1 single contract
  // -------------------------------------------------------------------------
  if (positionSize === 0) {
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
      freeMargin: roundDecimal(freeMargin, 2),
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
      positionSizeUnit: 'contracts',
      ticksOrPips: stopLossTicks,
      tickValue: roundDecimal(tickValue, 2),
      pointValue,
      effectiveRiskAmount: 0,
      isOperable: false,
      inoperableReason:
        'Presupuesto de riesgo insuficiente para operar 1 contrato entero sin exceder el riesgo permitido.',
      priceGridWarning,
    };
  }

  // -------------------------------------------------------------------------
  // OPERABLE POSITION CALCULATIONS
  // -------------------------------------------------------------------------
  const effectiveRiskAmount = positionSize * priceLossPerContract;
  const notionalValue = positionSize * input.entryPrice * multiplier;

  // Margin requirements
  const leverage = input.leverage ?? 10;
  const hasBrokerMargin = input.initialMarginPerUnit != null;
  const estimatedMargin = hasBrokerMargin
    ? positionSize * input.initialMarginPerUnit!
    : safeDivide(notionalValue, leverage);

  const maintenanceMargin =
    input.maintenanceMarginPerUnit != null
      ? positionSize * input.maintenanceMarginPerUnit
      : roundDecimal(estimatedMargin * 0.5, 2);

  // Verify capital sufficiency against Free Margin (not merely balance)
  const hasSufficientMargin = freeMargin >= estimatedMargin;
  const isOperable = hasSufficientMargin;
  const inoperableReason = !hasSufficientMargin
    ? `Margen requerido ($${roundDecimal(estimatedMargin, 2)}) supera el margen libre disponible ($${roundDecimal(freeMargin, 2)}).`
    : undefined;

  const potentialProfit = positionSize * takeProfitDistance * multiplier;
  const potentialLoss = effectiveRiskAmount;

  const totalCommissions =
    flatPerContract > 0
      ? positionSize * flatPerContract
      : ((input.commission ?? 0) / 100) * notionalValue;

  const netProfit = potentialProfit - totalCommissions;
  const netLoss = -(potentialLoss + totalCommissions);

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
    isMarginEstimated: !hasBrokerMargin,
    freeMargin: roundDecimal(freeMargin, 2),
    potentialProfit: roundDecimal(potentialProfit, 2),
    potentialLoss: roundDecimal(potentialLoss, 2),
    grossRisk: roundDecimal(potentialLoss, 2),
    totalEstimatedCosts: roundDecimal(totalCommissions, 2),
    effectiveNetRisk: roundDecimal(Math.abs(netLoss), 2),
    riskRewardRatio: roundDecimal(riskRewardRatio, 2),
    netRiskRewardRatio: roundDecimal(netRiskRewardRatio, 2),
    estimatedCommissions: roundDecimal(totalCommissions, 2),
    lossCommissions: roundDecimal(totalCommissions, 2),
    netProfit: roundDecimal(netProfit, 2),
    netLoss: roundDecimal(netLoss, 2),
    positionSizeUnit: 'contracts',
    ticksOrPips: stopLossTicks,
    tickValue: roundDecimal(tickValue, 2),
    pointValue,
    effectiveRiskAmount: roundDecimal(effectiveRiskAmount, 2),
    isOperable,
    inoperableReason,
    priceGridWarning,
  };
}
