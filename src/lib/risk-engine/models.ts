// =============================================================================
// TradeRisk Manager — Instrument Model Stubs
// =============================================================================
// Future calculation models for different instrument types.
// Each model will implement the RiskModel interface to be used by the engine.

import type { RiskCalculationInput, RiskCalculationOutput } from '@/lib/types';

/**
 * Common interface all instrument models must implement.
 */
export interface RiskModel {
  readonly name: string;
  calculate(input: RiskCalculationInput): RiskCalculationOutput;
}

/**
 * Forex standard/mini/micro lot model.
 * Handles pip values and lot size conversions.
 */
export interface ForexLotModel extends RiskModel {
  readonly name: 'forex_lot';
}

/**
 * Futures contract model.
 * Handles tick size, tick value, and contract multipliers.
 */
export interface FuturesModel extends RiskModel {
  readonly name: 'futures';
}

/**
 * Perpetual swap / inverse perpetual model.
 * Handles funding rates, mark price, and liquidation calculations.
 */
export interface PerpetualModel extends RiskModel {
  readonly name: 'perpetual';
}

/**
 * Stocks / equities model.
 * Handles share-based position sizing and fractional shares.
 */
export interface StocksModel extends RiskModel {
  readonly name: 'stocks';
}

/**
 * Multiplier-based model (e.g., Deriv multiplier contracts).
 * Handles multiplier factor and deal cancellation fee.
 */
export interface MultiplierModel extends RiskModel {
  readonly name: 'multiplier';
}

/**
 * Tick-value-based model (e.g., some futures and CFDs).
 * Handles custom tick size and tick monetary value.
 */
export interface TickValueModel extends RiskModel {
  readonly name: 'tick_value';
}
