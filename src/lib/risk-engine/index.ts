// =============================================================================
// TradeRisk Manager — Risk Calculation Engine
// =============================================================================

import {
  InstrumentType,
  type RiskCalculationInput,
  type RiskCalculationOutput,
} from '@/lib/types';
import { calculateCryptoRisk } from './crypto';
import { calculateForexRisk } from './forex';
import { calculateFuturesRisk } from './futures';
import { calculateStocksRisk } from './stocks';
import { isPriceOnGrid } from './precision';

// Re-export the types under the engine-specific names for convenience
export type RiskInput = RiskCalculationInput;
export type RiskResult = RiskCalculationOutput;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number, got ${value}`);
  }
}

function assertPositive(value: number, label: string): void {
  assertFinite(value, label);
  if (value <= 0) {
    throw new Error(`${label} must be positive, got ${value}`);
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateInputs(input: RiskInput): void {
  assertPositive(input.accountBalance, 'accountBalance');
  assertPositive(input.entryPrice, 'entryPrice');
  assertPositive(input.stopLoss, 'stopLoss');

  if (input.riskPercent != null) {
    assertPositive(input.riskPercent, 'riskPercent');
  }
  if (input.riskAmount != null) {
    assertPositive(input.riskAmount, 'riskAmount');
  }
  if (input.riskPercent == null && input.riskAmount == null) {
    throw new Error('Either riskPercent or riskAmount must be provided');
  }

  if (input.takeProfit != null) {
    assertPositive(input.takeProfit, 'takeProfit');
  }

  if (input.commission != null) {
    assertFinite(input.commission, 'commission');
    if (input.commission < 0) {
      throw new Error('commission must be non-negative');
    }
  }

  if (input.leverage != null) {
    assertPositive(input.leverage, 'leverage');
  }

  if (input.contractMultiplier != null) {
    assertPositive(input.contractMultiplier, 'contractMultiplier');
  }

  if (input.tickSize != null) {
    assertPositive(input.tickSize, 'tickSize');
  }

  if (input.pipSize != null) {
    assertPositive(input.pipSize, 'pipSize');
  }

  if (input.quoteToAccountRate != null) {
    assertPositive(input.quoteToAccountRate, 'quoteToAccountRate');
  }

  if (input.commissionPerContract != null) {
    assertFinite(input.commissionPerContract, 'commissionPerContract');
    if (input.commissionPerContract < 0) {
      throw new Error('commissionPerContract must be non-negative');
    }
  }

  if (input.spreadPips != null) {
    assertFinite(input.spreadPips, 'spreadPips');
    if (input.spreadPips < 0) {
      throw new Error('spreadPips must be non-negative');
    }
  }

  if (input.initialMarginPerUnit != null) {
    assertFinite(input.initialMarginPerUnit, 'initialMarginPerUnit');
    if (input.initialMarginPerUnit < 0) {
      throw new Error('initialMarginPerUnit must be non-negative');
    }
  }

  if (input.enforceTickGrid && input.tickSize != null) {
    if (!isPriceOnGrid(input.entryPrice, input.tickSize)) {
      throw new Error(`entryPrice (${input.entryPrice}) does not align with tickSize (${input.tickSize})`);
    }
    if (!isPriceOnGrid(input.stopLoss, input.tickSize)) {
      throw new Error(`stopLoss (${input.stopLoss}) does not align with tickSize (${input.tickSize})`);
    }
  }

  // Direction-specific validations
  if (input.direction === 'long') {
    if (input.stopLoss >= input.entryPrice) {
      throw new Error(
        `For long positions, stopLoss (${input.stopLoss}) must be below entryPrice (${input.entryPrice})`,
      );
    }
    if (input.takeProfit != null && input.takeProfit <= input.entryPrice) {
      throw new Error(
        `For long positions, takeProfit (${input.takeProfit}) must be above entryPrice (${input.entryPrice})`,
      );
    }
  } else {
    // short
    if (input.stopLoss <= input.entryPrice) {
      throw new Error(
        `For short positions, stopLoss (${input.stopLoss}) must be above entryPrice (${input.entryPrice})`,
      );
    }
    if (input.takeProfit != null && input.takeProfit >= input.entryPrice) {
      throw new Error(
        `For short positions, takeProfit (${input.takeProfit}) must be below entryPrice (${input.entryPrice})`,
      );
    }
  }

  // Stop loss distance check to prevent division overflow with near-zero distance
  const stopLossDist = Math.abs(input.entryPrice - input.stopLoss);
  if (stopLossDist < 1e-8) {
    throw new Error(
      `Stop loss is too close to entry price (distance ${stopLossDist} must be greater than 1e-8)`,
    );
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Calculate risk metrics for a trade.
 *
 * Dispatches to dedicated sub-engines for crypto, forex, futures, and stocks.
 *
 * @throws {Error} if inputs are invalid or calculations would produce NaN/Infinity
 */
export function calculateRisk(input: RiskInput): RiskResult {
  validateInputs(input);

  switch (input.instrumentType) {
    case InstrumentType.Spot:
    case InstrumentType.Perpetual:
      return calculateCryptoRisk(input);

    case InstrumentType.ForexLot:
      return calculateForexRisk(input);

    case InstrumentType.Futures:
      return calculateFuturesRisk(input);

    case InstrumentType.Stocks:
      return calculateStocksRisk(input);

    // Reserved future instrument models:
    case InstrumentType.Multiplier:
    case InstrumentType.TickValue:
      throw new Error(
        `Instrument type "${input.instrumentType}" is not yet implemented.`,
      );

    default:
      throw new Error(`Unknown instrument type: ${String(input.instrumentType)}`);
  }
}
