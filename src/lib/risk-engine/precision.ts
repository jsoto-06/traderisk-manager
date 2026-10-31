// =============================================================================
// TradeRisk Manager — Quantitative Numerical Precision & IEEE-754 Utilities
// =============================================================================

/**
 * Robust division that avoids NaN, Infinity, and zero-division errors.
 */
export function safeDivide(numerator: number, denominator: number, fallback = 0): number {
  if (denominator === 0 || !Number.isFinite(denominator)) {
    return fallback;
  }
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : fallback;
}

/**
 * Accurate decimal rounding avoiding IEEE-754 float drift and scientific notation bugs.
 * (e.g. 1.005 rounded to 2 decimals gives 1.01; 5e-17 gives 0).
 */
export function roundDecimal(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) return 0;
  if (Math.abs(value) < 1e-12) return 0;
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Snaps a price or value to the nearest discrete tick or step.
 * e.g. roundToStep(5000.12, 0.25) -> 5000.00; roundToStep(5000.13, 0.25) -> 5000.25
 */
export function roundToStep(value: number, step: number): number {
  if (step <= 0 || !Number.isFinite(step)) return value;
  const inv = 1 / step;
  return Math.round(value * inv) / inv;
}

/**
 * Floors a quantity strictly to a step, preventing rounding UP that would breach risk limits.
 * e.g. floorToStep(0.339, 0.01) -> 0.33
 */
export function floorToStep(value: number, step: number): number {
  if (step <= 0 || !Number.isFinite(step)) return Math.floor(value);
  const scaledVal = Math.floor(roundDecimal(value / step, 8));
  return roundDecimal((scaledVal * step), 8);
}

/**
 * Calculates discrete ticks distance avoiding floating point representation errors.
 */
export function calcTicks(distance: number, tickSize: number): number {
  if (tickSize <= 0 || !Number.isFinite(tickSize)) return 0;
  return Math.round(distance / tickSize);
}

/**
 * Calculates pips distance with pipette (tenth of a pip) precision.
 */
export function calcPips(distance: number, pipSize: number): number {
  if (pipSize <= 0 || !Number.isFinite(pipSize)) return 0;
  // Round to 1 decimal place of pips (pipette)
  return roundDecimal(distance / pipSize, 1);
}

/**
 * Checks whether a price is an integer multiple of the exchange tick size.
 * Uses robust tolerance to account for floating point micro-remainders.
 */
export function isPriceOnGrid(price: number, tickSize: number, tolerance = 1e-6): boolean {
  if (tickSize <= 0 || !Number.isFinite(tickSize) || !Number.isFinite(price)) return true;
  const ratio = price / tickSize;
  const nearestInteger = Math.round(ratio);
  return Math.abs(ratio - nearestInteger) < tolerance;
}

/**
 * Robust sum of PnL entries avoiding IEEE-754 summation drift.
 */
export function sumPnL(...amounts: number[]): number {
  const sum = amounts.reduce((acc, curr) => acc + (Number.isFinite(curr) ? curr : 0), 0);
  return roundDecimal(sum, 2);
}
