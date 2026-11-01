// =============================================================================
// TradeRisk Manager — Dynamic Open Risk Calculator (Paso 8.2)
// =============================================================================

import type { Direction } from '../types';
import type { FloatingPositionValuation, DynamicOpenRiskSnapshot } from './types';
import { roundDecimal } from '../risk-engine/precision';

export interface DynamicRiskInput {
  direction: Direction;
  entryPrice: number;
  exitPrice: number; // Bid for Long, Ask for Short
  size: number;
  multiplier?: number;
  fxRate?: number;
  originalSL?: number;
  currentSL?: number;
}

export interface PositionRiskResult {
  isStopLossConfigured: boolean;
  isStopCrossed: boolean;
  originalSL?: number;
  currentSL?: number;
  initialCapitalRisk?: number;
  capitalRiskAtSL?: number;
  markToStopDistance?: number;
}

/**
 * Computes Dynamic Open Risk metrics for a single position:
 * - Distinguishes original SL from current SL.
 * - Evaluates Long against Bid and Short against Ask.
 * - Enforces zero risk when Stop Loss is in profit/break-even or already crossed.
 * - Identifies unmitigated risk when no Stop Loss is configured.
 */
export function calculatePositionDynamicRisk(input: DynamicRiskInput): PositionRiskResult {
  const {
    direction,
    entryPrice,
    exitPrice,
    size,
    multiplier = 1,
    fxRate = 1,
    originalSL,
    currentSL,
  } = input;

  // 1. If no current Stop Loss is configured
  if (currentSL == null || !Number.isFinite(currentSL) || currentSL <= 0) {
    let initialCapitalRisk: number | undefined;
    if (originalSL != null && Number.isFinite(originalSL) && originalSL > 0) {
      if (direction === 'long') {
        initialCapitalRisk = Math.max(0, (entryPrice - originalSL) * size * multiplier * fxRate);
      } else {
        initialCapitalRisk = Math.max(0, (originalSL - entryPrice) * size * multiplier * fxRate);
      }
      initialCapitalRisk = roundDecimal(initialCapitalRisk, 2);
    }

    return {
      isStopLossConfigured: false,
      isStopCrossed: false,
      originalSL: originalSL && originalSL > 0 ? originalSL : undefined,
      currentSL: undefined,
      initialCapitalRisk,
      capitalRiskAtSL: undefined,
      markToStopDistance: undefined,
    };
  }

  // 2. Initial Capital Risk (at original Stop Loss)
  const effectiveOriginalSL = originalSL != null && Number.isFinite(originalSL) && originalSL > 0 ? originalSL : currentSL;
  let initialCapitalRisk = 0;
  if (direction === 'long') {
    initialCapitalRisk = Math.max(0, (entryPrice - effectiveOriginalSL) * size * multiplier * fxRate);
  } else {
    initialCapitalRisk = Math.max(0, (effectiveOriginalSL - entryPrice) * size * multiplier * fxRate);
  }
  initialCapitalRisk = roundDecimal(initialCapitalRisk, 2);

  // 3. Check if market price has crossed or reached current Stop Loss
  // Long exits at Bid; crossed if Bid <= currentSL
  // Short exits at Ask; crossed if Ask >= currentSL
  const isStopCrossed = direction === 'long' ? exitPrice <= currentSL : exitPrice >= currentSL;

  // 4. Current Capital Risk (CapitalRiskAtSL):
  // Long: 0 if currentSL >= entryPrice (BE/profit) or if stop is already crossed
  // Short: 0 if currentSL <= entryPrice (BE/profit) or if stop is already crossed
  let capitalRiskAtSL = 0;
  if (direction === 'long') {
    if (currentSL >= entryPrice || isStopCrossed) {
      capitalRiskAtSL = 0;
    } else {
      capitalRiskAtSL = Math.max(0, (entryPrice - currentSL) * size * multiplier * fxRate);
    }
  } else {
    if (currentSL <= entryPrice || isStopCrossed) {
      capitalRiskAtSL = 0;
    } else {
      capitalRiskAtSL = Math.max(0, (currentSL - entryPrice) * size * multiplier * fxRate);
    }
  }
  capitalRiskAtSL = roundDecimal(capitalRiskAtSL, 2);

  // 5. Remaining Equity Risk (MarkToStopDistance):
  // Distance from current market mark price (Bid/Ask) to current SL
  // Long: 0 if stop is already crossed; else (Bid - currentSL) * size * M * FX
  // Short: 0 if stop is already crossed; else (currentSL - Ask) * size * M * FX
  let markToStopDistance = 0;
  if (isStopCrossed) {
    markToStopDistance = 0;
  } else if (direction === 'long') {
    markToStopDistance = Math.max(0, (exitPrice - currentSL) * size * multiplier * fxRate);
  } else {
    markToStopDistance = Math.max(0, (currentSL - exitPrice) * size * multiplier * fxRate);
  }
  markToStopDistance = roundDecimal(markToStopDistance, 2);

  return {
    isStopLossConfigured: true,
    isStopCrossed,
    originalSL: effectiveOriginalSL,
    currentSL,
    initialCapitalRisk,
    capitalRiskAtSL,
    markToStopDistance,
  };
}

/**
 * Aggregates position-level dynamic risk metrics into an account-level snapshot.
 */
export function aggregateAccountRisk(positions: FloatingPositionValuation[]): DynamicOpenRiskSnapshot {
  let totalInitialCapitalRisk = 0;
  let totalCapitalRiskAtSL = 0;
  let totalMarkToStopDistance = 0;
  let totalEstimatedExitCosts = 0;
  let unboundedRiskCount = 0;

  for (const pos of positions) {
    if (!pos.isStopLossConfigured) {
      unboundedRiskCount++;
    }
    if (pos.initialCapitalRisk != null) {
      totalInitialCapitalRisk += pos.initialCapitalRisk;
    }
    if (pos.capitalRiskAtSL != null) {
      totalCapitalRiskAtSL += pos.capitalRiskAtSL;
    }
    if (pos.markToStopDistance != null) {
      totalMarkToStopDistance += pos.markToStopDistance;
    }
    if (pos.estimatedExitCosts != null) {
      totalEstimatedExitCosts += pos.estimatedExitCosts;
    }
  }

  const totalEstimatedOpenRisk = roundDecimal(totalMarkToStopDistance + totalEstimatedExitCosts, 2);

  return {
    totalInitialCapitalRisk: roundDecimal(totalInitialCapitalRisk, 2),
    totalCapitalRiskAtSL: roundDecimal(totalCapitalRiskAtSL, 2),
    totalMarkToStopDistance: roundDecimal(totalMarkToStopDistance, 2),
    totalEstimatedExitCosts: roundDecimal(totalEstimatedExitCosts, 2),
    totalEstimatedOpenRisk,
    unboundedRiskCount,
  };
}
