// =============================================================================
// TradeRisk Manager — Prop Firm Intraday Daily Loss Calculator (Paso 8.2)
// =============================================================================

import type { DailyLossSnapshot } from './types';
import { roundDecimal } from '../risk-engine/precision';
import { getNewYorkSessionStart } from './timezone';

export interface DailyLossInput {
  accountId: string;
  /** Ledger balance at the start of the current trading session */
  startOfDayBalance: number;
  /** Dynamic equity at the start of the current trading session */
  startOfDayEquity: number;
  /** Floating unrealized PnL of positions that were already open at session start */
  startOfDayOpenFloating: number;
  /** Net realized PnL of trades closed during today's session (including commissions) */
  closedPnLToday: number;
  /** Sum of net floating PnL of currently open valuable positions */
  currentOpenFloating: number;
  /** Cash deposits credited during today's session */
  depositsToday?: number;
  /** Cash withdrawals debited during today's session */
  withdrawalsToday?: number;
  /** Daily loss limit expressed in currency amount (e.g. $5,000) */
  dailyLossLimitAmount: number;
  /** Session reference date */
  referenceDate?: Date;
  /** Reset hour in America/New_York (default 17) */
  resetHour?: number;
}

/**
 * Computes the rigorous intraday Daily Loss adhering to Prop Firm requirements:
 * 1. Isolates prior-day floating drawdown from today's quota.
 * 2. Fully captures intraday recovery of prior losses without false penalties.
 * 3. Eliminates double-counting when closing positions that carried prior floating loss.
 * 4. Neutralizes cash deposits and withdrawals from operational performance.
 */
export function calculateDailyLoss(input: DailyLossInput): DailyLossSnapshot {
  const {
    startOfDayBalance,
    startOfDayEquity,
    startOfDayOpenFloating,
    closedPnLToday,
    currentOpenFloating,
    depositsToday = 0,
    withdrawalsToday = 0,
    dailyLossLimitAmount,
    referenceDate = new Date(),
    resetHour = 17,
  } = input;

  // 1. Intraday floating variation
  const deltaOpenFloatingToday = roundDecimal(currentOpenFloating - startOfDayOpenFloating, 2);

  // 2. Net cash flows
  const netCashFlowsToday = roundDecimal(depositsToday - withdrawalsToday, 2);

  // 3. Operational Daily Net Performance: Realized closed today + Intraday delta of open positions
  const dailyNetPerformance = roundDecimal(closedPnLToday + deltaOpenFloatingToday, 2);

  // 4. Daily Loss Total: only positive loss amounts count towards the drawdown limit
  const dailyLossTotal = Math.max(0, roundDecimal(-dailyNetPerformance, 2));

  // 5. Remaining daily loss budget and breach status
  const remainingDailyLoss = Math.max(0, roundDecimal(dailyLossLimitAmount - dailyLossTotal, 2));
  const isBreached = dailyLossTotal >= dailyLossLimitAmount && dailyLossLimitAmount > 0;

  // 6. Canonical session reset timestamp
  const sessionStart = getNewYorkSessionStart(referenceDate, resetHour);

  return {
    startOfDayBalance: roundDecimal(startOfDayBalance, 2),
    startOfDayEquity: roundDecimal(startOfDayEquity, 2),
    startOfDayOpenFloating: roundDecimal(startOfDayOpenFloating, 2),
    closedPnLToday: roundDecimal(closedPnLToday, 2),
    deltaOpenFloatingToday,
    netCashFlowsToday,
    dailyNetPerformance,
    dailyLossTotal,
    dailyLossLimitAmount: roundDecimal(dailyLossLimitAmount, 2),
    remainingDailyLoss,
    isBreached,
    resetTimestamp: sessionStart.toISOString(),
  };
}

/**
 * Verifies global accounting consistency:
 * DailyNetPerformance == (CurrentEquity - StartOfDayEquity) - NetCashFlowsToday
 */
export function verifyDailyLossConsistency(
  currentEquity: number,
  snapshot: DailyLossSnapshot,
  tolerance = 0.05
): { isConsistent: boolean; discrepancy: number } {
  const equityDelta = currentEquity - snapshot.startOfDayEquity;
  const expectedPerformance = equityDelta - snapshot.netCashFlowsToday;
  const discrepancy = roundDecimal(Math.abs(snapshot.dailyNetPerformance - expectedPerformance), 4);

  return {
    isConsistent: discrepancy <= tolerance,
    discrepancy,
  };
}
