// =============================================================================
// TradeRisk Manager — Crypto Risk Engine (Spot & Perpetual Derivatives)
// =============================================================================

import type { RiskCalculationInput, RiskCalculationOutput } from '@/lib/types';
import {
  roundDecimal,
  safeDivide,
} from './precision';

/**
 * Calculates quantitative risk metrics for Crypto Spot and Perpetual contracts.
 * Features:
 * - Isolated vs Cross margin liquidation modeling
 * - Transparent estimated liquidation methodology (MMR + closing fees)
 * - Dynamic funding rate conventions (positive/negative, long/short, payment vs rebate)
 * - Proportional vs discrete settlement funding projections
 * - Free margin verification (accounting for equity and used margin)
 * - Strict risk-budget compliance without optimistic rebate inflation
 */
export function calculateCryptoRisk(input: RiskCalculationInput): RiskCalculationOutput {
  const leverage = input.leverage ?? 1;
  const commissionRate = input.commission ?? 0;
  const marginMode = input.marginMode ?? 'isolated';

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

  // -------------------------------------------------------------------------
  // Funding Rate & Periods Projection
  // -------------------------------------------------------------------------
  let periods = 0;
  if (input.fundingPeriods != null && input.fundingPeriods > 0) {
    periods = input.fundingPeriods;
  } else if (input.holdingPeriodHours != null && input.holdingPeriodHours > 0) {
    const interval = input.fundingIntervalHours ?? 8; // Default 8 hours
    periods = roundDecimal(input.holdingPeriodHours / interval, 2);
  } else if (input.fundingRate != null && input.fundingRate !== 0) {
    periods = 1; // Default 1 cycle if rate is provided
  }

  // Unit fees per coin for net budget sizing
  const commOpenPerUnit = (commissionRate / 100) * input.entryPrice;
  const commCloseSLPerUnit = (commissionRate / 100) * input.stopLoss;

  // Direction factor: Long pays if FR > 0; Short pays if FR < 0
  const fundingPerUnit =
    input.fundingRate != null && input.fundingRate !== 0
      ? input.entryPrice * (input.fundingRate / 100) * periods * (input.direction === 'long' ? 1 : -1)
      : 0;

  // Quantitative risk rule: under strict sizing, only guaranteed costs increase unit loss.
  // Anticipated rebates are NOT used to inflate position size above budget due to rate volatility.
  const fundingCostForSizing = Math.max(0, fundingPerUnit);

  const unitLossAtSL =
    input.includeFeesInRisk === true
      ? stopLossDistance + commOpenPerUnit + commCloseSLPerUnit + fundingCostForSizing
      : stopLossDistance;

  // Fractional position size (units/coins)
  const positionSize = safeDivide(riskAmount, unitLossAtSL);

  // Notional value & required margin
  const notionalValue = positionSize * input.entryPrice;
  const estimatedMargin = safeDivide(notionalValue, leverage);

  // Maintenance margin (typical tier-1 MMR = 0.5% = 0.005)
  const mmr = input.maintenanceMarginPerUnit != null
    ? input.maintenanceMarginPerUnit * positionSize
    : notionalValue * 0.005;

  // -------------------------------------------------------------------------
  // Liquidation Modeling (Isolated vs Cross Margin)
  // -------------------------------------------------------------------------
  let liquidationPrice: number | undefined;
  let isLiquidationBeforeSL = false;
  let liquidationMethodology: string | undefined;

  if (leverage > 1 && positionSize > 0) {
    const closeFeeRate = commissionRate / 100;

    if (marginMode === 'cross') {
      // In Cross Margin, total available equity backs the position
      // Loss tolerated = freeMargin - maintenanceMargin
      const maxCrossLoss = freeMargin - mmr;
      liquidationMethodology =
        'Estimación de margen cruzado: la liquidación ocurre cuando las pérdidas totales superan el margen libre disponible menos el margen de mantenimiento.';

      if (input.direction === 'long') {
        const liqDistance = safeDivide(maxCrossLoss, positionSize);
        liquidationPrice = roundDecimal(Math.max(0, input.entryPrice - liqDistance), 4);
        if (input.stopLoss <= liquidationPrice) {
          isLiquidationBeforeSL = true;
        }
      } else {
        const liqDistance = safeDivide(maxCrossLoss, positionSize);
        liquidationPrice = roundDecimal(input.entryPrice + liqDistance, 4);
        if (input.stopLoss >= liquidationPrice) {
          isLiquidationBeforeSL = true;
        }
      }
    } else {
      // Isolated Margin mode
      liquidationMethodology =
        'Estimación de margen aislado basada en MMR (0.5%) y comisiones de liquidación. Sujeta a variaciones del Mark Price y tarifas del fondo de seguro.';

      if (input.direction === 'long') {
        liquidationPrice = roundDecimal(
          Math.max(0, input.entryPrice * (1 - 1 / leverage + 0.005 + closeFeeRate)),
          4,
        );
        if (input.stopLoss <= liquidationPrice) {
          isLiquidationBeforeSL = true;
        }
      } else {
        liquidationPrice = roundDecimal(
          input.entryPrice * (1 + 1 / leverage - 0.005 - closeFeeRate),
          4,
        );
        if (input.stopLoss >= liquidationPrice) {
          isLiquidationBeforeSL = true;
        }
      }
    }
  }

  // Capital adequacy check against Free Margin (not merely balance)
  const hasSufficientMargin = freeMargin >= estimatedMargin;
  const isOperable = hasSufficientMargin && !isLiquidationBeforeSL;
  let inoperableReason: string | undefined;

  if (isLiquidationBeforeSL) {
    inoperableReason = `ALERTA CRÍTICA: El precio de liquidación estimado ($${liquidationPrice}) se alcanzará antes que el Stop Loss ($${input.stopLoss}). Ajuste el apalancamiento o el Stop Loss.`;
  } else if (!hasSufficientMargin) {
    inoperableReason = `Margen requerido ($${roundDecimal(estimatedMargin, 2)}) supera el margen libre disponible ($${roundDecimal(freeMargin, 2)}).`;
  }

  // Take-profit calculations
  const takeProfitDistance =
    input.takeProfit != null ? Math.abs(input.takeProfit - input.entryPrice) : 0;

  // Potential gross profit and loss
  const potentialProfit = positionSize * takeProfitDistance;
  const potentialLoss = positionSize * stopLossDistance;

  // Commissions
  const commissionOpen = commOpenPerUnit * positionSize;
  const exitNotionalTP =
    input.takeProfit != null ? positionSize * input.takeProfit : notionalValue;
  const commissionCloseTP = (commissionRate / 100) * exitNotionalTP;
  const commissionCloseSL = commCloseSLPerUnit * positionSize;

  const estimatedCommissions = commissionOpen + commissionCloseTP;
  const lossCommissions = commissionOpen + commissionCloseSL;

  // Total funding cost (positive = paid cost; negative = received rebate)
  const fundingCost = fundingPerUnit * positionSize;

  // Net P&L
  const netProfit = potentialProfit - estimatedCommissions - fundingCost;
  const netLoss = -(potentialLoss + lossCommissions + fundingCost);

  // R:R
  const riskRewardRatio = safeDivide(takeProfitDistance, stopLossDistance);
  const netRiskRewardRatio =
    input.takeProfit != null ? safeDivide(netProfit, Math.abs(netLoss)) : 0;

  const totalEstimatedCosts = lossCommissions + Math.max(0, fundingCost);

  return {
    riskAmount,
    riskPercent,
    stopLossDistance,
    stopLossPercent,
    positionSize,
    notionalValue,
    estimatedMargin,
    maintenanceMargin: mmr,
    isMarginEstimated: true,
    freeMargin: roundDecimal(freeMargin, 2),
    liquidationPrice,
    isLiquidationEstimated: true,
    liquidationMethodology,
    isLiquidationBeforeSL,
    potentialProfit,
    potentialLoss,
    grossRisk: potentialLoss,
    totalEstimatedCosts,
    effectiveNetRisk: Math.abs(netLoss),
    riskRewardRatio,
    netRiskRewardRatio,
    estimatedCommissions,
    lossCommissions,
    netProfit,
    netLoss,
    positionSizeUnit: 'coins',
    fundingCost: Number(fundingCost.toFixed(4)),
    effectiveRiskAmount: potentialLoss,
    isOperable,
    inoperableReason,
  };
}
