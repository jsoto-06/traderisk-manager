// =============================================================================
// TradeRisk Manager — Stocks & Equities / Indices Risk Engine
// =============================================================================

import type { RiskCalculationInput, RiskCalculationOutput } from '@/lib/types';
import {
  roundDecimal,
  safeDivide,
} from './precision';

/**
 * Calculates risk metrics for Stocks, Equities and Index CFDs.
 * Supports whole shares (traditional brokers) and fractional shares (fintechs),
 * cash accounts (1x) and leveraged equity CFDs, with free margin verification.
 */
export function calculateStocksRisk(input: RiskCalculationInput): RiskCalculationOutput {
  const leverage = input.leverage ?? 1; // Default cash 1x
  const multiplier = input.contractMultiplier ?? 1;
  const allowFractional = input.allowFractional ?? true;

  // Available free margin verification
  const freeMargin =
    input.freeMargin != null
      ? input.freeMargin
      : input.accountEquity != null
        ? input.accountEquity - (input.usedMargin ?? 0)
        : input.accountBalance - (input.usedMargin ?? 0);

  // Base monetary risk budget
  const riskAmount =
    input.riskAmount != null
      ? input.riskAmount
      : (input.riskPercent! / 100) * input.accountBalance;

  const riskPercent =
    input.riskPercent != null
      ? input.riskPercent
      : safeDivide(riskAmount * 100, input.accountBalance);

  // Stop loss distance
  const stopLossDistance = Math.abs(input.entryPrice - input.stopLoss);
  const stopLossPercent = safeDivide(stopLossDistance * 100, input.entryPrice);

  // Unit costs
  const commissionRate = input.commission ?? 0;
  const commPerShare = ((commissionRate / 100) * input.entryPrice * multiplier) * 2; // Entry + exit

  const unitLossAtSL =
    input.includeFeesInRisk === true
      ? stopLossDistance * multiplier + commPerShare
      : stopLossDistance * multiplier;

  // Position sizing in shares
  const rawShares = safeDivide(riskAmount, unitLossAtSL);
  const positionSize = allowFractional
    ? roundDecimal(rawShares, 4)
    : Math.floor(rawShares);

  // Take-profit distance
  const takeProfitDistance =
    input.takeProfit != null ? Math.abs(input.takeProfit - input.entryPrice) : 0;
  const riskRewardRatio = safeDivide(takeProfitDistance, stopLossDistance);

  // -------------------------------------------------------------------------
  // INSUFFICIENT RISK CASE: When budget cannot cover 1 whole share
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
      positionSizeUnit: 'shares',
      pointValue: multiplier,
      effectiveRiskAmount: 0,
      isOperable: false,
      inoperableReason:
        'Presupuesto de riesgo insuficiente para comprar 1 acción entera sin exceder el riesgo permitido.',
    };
  }

  // -------------------------------------------------------------------------
  // OPERABLE STOCKS POSITION
  // -------------------------------------------------------------------------
  const notionalValue = positionSize * input.entryPrice * multiplier;
  const estimatedMargin = safeDivide(notionalValue, leverage);
  const maintenanceMargin = roundDecimal(estimatedMargin * 0.5, 2);

  // Capital adequacy check against Free Margin
  const hasSufficientMargin = freeMargin >= estimatedMargin;
  const isOperable = hasSufficientMargin;
  const inoperableReason = !hasSufficientMargin
    ? `Margen requerido ($${roundDecimal(estimatedMargin, 2)}) supera el margen libre disponible ($${roundDecimal(freeMargin, 2)}).`
    : undefined;

  const potentialProfit = positionSize * takeProfitDistance * multiplier;
  const potentialLoss = positionSize * stopLossDistance * multiplier;

  const commissionCost = (commissionRate / 100) * notionalValue;
  const totalCommissions = commissionCost * 2; // entry + exit

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
    isMarginEstimated: leverage > 1,
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
    positionSizeUnit: 'shares',
    pointValue: multiplier,
    effectiveRiskAmount: roundDecimal(potentialLoss, 2),
    isOperable,
    inoperableReason,
  };
}
