// =============================================================================
// TradeRisk Manager — Prop Firm Risk Evaluation Engine
// =============================================================================

import type { Account, Trade, DrawdownType } from '@/lib/types';

export interface DrawdownResult {
  drawdownType: DrawdownType;
  highWaterMark: number;
  floor: number;
  currentDrawdownAmount: number;
  currentDrawdownPercent: number;
  remainingDrawdownAmount: number;
  remainingDrawdownPercent: number;
  isBreached: boolean;
}

export interface DailyLossResult {
  baseCapital: number;
  dailyLossLimitPercent: number;
  dailyLimitAmount: number;
  realizedPnLToday: number;
  floatingLossToday: number;
  totalLossToday: number;
  remainingDailyLossAmount: number;
  remainingDailyLossPercent: number;
  isBreached: boolean;
}

export interface ProfitTargetResult {
  initialCapital: number;
  profitTargetPercent: number;
  targetProfitAmount: number;
  currentProfitAmount: number;
  remainingProfitAmount: number;
  progressPercent: number;
  isTargetReached: boolean;
}

/**
 * Calculates current drawdown status against maximum permissible loss.
 *
 * Supports:
 * - 'static': Floor is fixed below initial capital (e.g., initialCapital * (1 - maxDrawdown%)).
 * - 'trailing': Floor trails the High-Water Mark (HWM) of account equity/balance.
 * - 'custom': Treated as static with user-configured parameters.
 */
export function calculateDrawdown(
  account: Account,
  highWaterMark?: number,
): DrawdownResult {
  const initial = account.initialCapital;
  const currentEquity = account.equity;
  const maxDDPercent = account.maxDrawdown;

  if (account.drawdownType === 'trailing') {
    // High-Water Mark is the highest equity reached, at least initial capital
    const hwm = Math.max(initial, highWaterMark ?? account.balance, currentEquity);
    const floor = hwm * (1 - maxDDPercent / 100);
    const currentDrawdownAmount = Math.max(0, hwm - currentEquity);
    const currentDrawdownPercent = hwm > 0 ? (currentDrawdownAmount / hwm) * 100 : 0;
    const remainingDrawdownAmount = Math.max(0, currentEquity - floor);
    const remainingDrawdownPercent = hwm > 0 ? (remainingDrawdownAmount / hwm) * 100 : 0;
    const isBreached = currentEquity <= floor;

    return {
      drawdownType: 'trailing',
      highWaterMark: Number(hwm.toFixed(2)),
      floor: Number(floor.toFixed(2)),
      currentDrawdownAmount: Number(currentDrawdownAmount.toFixed(2)),
      currentDrawdownPercent: Number(currentDrawdownPercent.toFixed(2)),
      remainingDrawdownAmount: Number(remainingDrawdownAmount.toFixed(2)),
      remainingDrawdownPercent: Number(remainingDrawdownPercent.toFixed(2)),
      isBreached,
    };
  }

  // Static / Custom Drawdown
  const floor = initial * (1 - maxDDPercent / 100);
  const currentDrawdownAmount = Math.max(0, initial - currentEquity);
  const currentDrawdownPercent = initial > 0 ? (currentDrawdownAmount / initial) * 100 : 0;
  const remainingDrawdownAmount = Math.max(0, currentEquity - floor);
  const remainingDrawdownPercent = initial > 0 ? (remainingDrawdownAmount / initial) * 100 : 0;
  const isBreached = currentEquity <= floor;

  return {
    drawdownType: account.drawdownType,
    highWaterMark: initial,
    floor: Number(floor.toFixed(2)),
    currentDrawdownAmount: Number(currentDrawdownAmount.toFixed(2)),
    currentDrawdownPercent: Number(currentDrawdownPercent.toFixed(2)),
    remainingDrawdownAmount: Number(remainingDrawdownAmount.toFixed(2)),
    remainingDrawdownPercent: Number(remainingDrawdownPercent.toFixed(2)),
    isBreached,
  };
}

/**
 * Calculates daily loss consumption and distance to breach.
 *
 * In prop firms, daily loss is computed either against initial capital (FTMO style)
 * or against the account balance at the start of the trading day (after daily reset hour).
 * Both realized closed losses today and open unrealized floating losses count towards the limit.
 */
export function calculateDailyLoss(
  account: Account,
  closedTradesToday: Trade[],
  floatingLossToday: number = 0,
  options?: {
    useDayStartBalance?: boolean;
    dayStartBalance?: number;
  },
): DailyLossResult {
  const baseCapital =
    options?.useDayStartBalance && options?.dayStartBalance != null
      ? options.dayStartBalance
      : account.initialCapital;

  const dailyLimitAmount = (baseCapital * account.dailyLossLimit) / 100;

  // Realized net P&L from trades closed today
  const realizedPnLToday = closedTradesToday.reduce((sum, trade) => {
    if (trade.status === 'closed' && trade.result != null) {
      return sum + (trade.result - (trade.commissions || 0));
    }
    return sum;
  }, 0);

  // Floating loss (only negative P&L counts as a loss drag)
  const unrealizedLoss = Math.min(0, floatingLossToday);

  // Total daily loss is the net drop: if (realized + unrealized) < 0
  const netDayPerformance = realizedPnLToday + unrealizedLoss;
  const totalLossToday = Math.max(0, -netDayPerformance);

  const remainingDailyLossAmount = Math.max(0, dailyLimitAmount - totalLossToday);
  const remainingDailyLossPercent =
    baseCapital > 0 ? (remainingDailyLossAmount / baseCapital) * 100 : 0;

  const isBreached = totalLossToday >= dailyLimitAmount;

  return {
    baseCapital: Number(baseCapital.toFixed(2)),
    dailyLossLimitPercent: account.dailyLossLimit,
    dailyLimitAmount: Number(dailyLimitAmount.toFixed(2)),
    realizedPnLToday: Number(realizedPnLToday.toFixed(2)),
    floatingLossToday: Number(unrealizedLoss.toFixed(2)),
    totalLossToday: Number(totalLossToday.toFixed(2)),
    remainingDailyLossAmount: Number(remainingDailyLossAmount.toFixed(2)),
    remainingDailyLossPercent: Number(remainingDailyLossPercent.toFixed(2)),
    isBreached,
  };
}

/**
 * Calculates profit target milestone and progress.
 */
export function calculateProfitTarget(account: Account): ProfitTargetResult {
  const initial = account.initialCapital;
  const targetProfitAmount = (initial * account.profitTarget) / 100;
  const currentProfitAmount = Math.max(0, account.balance - initial);
  const remainingProfitAmount = Math.max(0, targetProfitAmount - currentProfitAmount);
  const progressPercent =
    targetProfitAmount > 0
      ? Math.min(100, Number(((currentProfitAmount / targetProfitAmount) * 100).toFixed(2)))
      : 0;

  return {
    initialCapital: initial,
    profitTargetPercent: account.profitTarget,
    targetProfitAmount: Number(targetProfitAmount.toFixed(2)),
    currentProfitAmount: Number(currentProfitAmount.toFixed(2)),
    remainingProfitAmount: Number(remainingProfitAmount.toFixed(2)),
    progressPercent,
    isTargetReached: account.balance >= initial + targetProfitAmount,
  };
}
