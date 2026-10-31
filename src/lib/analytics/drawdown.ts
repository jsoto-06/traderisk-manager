// =============================================================================
// TradeRisk Manager — Drawdown & Consistency Analytics
// =============================================================================

import type { Trade } from '@/lib/types';
import type { DrawdownMetrics, DrawdownSeriesPoint, AnalyticsFilter } from './types';
import { filterTrades } from './expectancy';

/**
 * Calculates High-Water Mark, Drawdown metrics, recovery factors, and streak analytics.
 *
 * Rules:
 * - Only closed trades with valid result are evaluated.
 * - Chronologically ordered by closeDate (or openDate/createdAt fallback).
 * - Net results (trade.result - commissions) are applied to equity balance.
 * - Drawdown percent is computed relative to the High-Water Mark (peak) at each step.
 * - Recovery factor = Total Net Profit / Max Drawdown Amount.
 * - Recovery trades = Maximum number of trades spent underwater before reaching a new peak.
 */
export function calculateDrawdownMetrics(
  trades: Trade[],
  initialBalance: number = 10000,
  filter?: AnalyticsFilter,
): DrawdownMetrics {
  const filtered = filterTrades(trades, filter);
  const closed = filtered
    .filter((t) => t.status === 'closed' && t.result != null)
    .sort((a, b) => {
      const dateA = new Date(a.closeDate || a.openDate || a.createdAt || 0).getTime();
      const dateB = new Date(b.closeDate || b.openDate || b.createdAt || 0).getTime();
      return dateA - dateB;
    });

  const baseBalance = Math.max(0, Number(initialBalance) || 10000);

  if (closed.length === 0) {
    const initialPoint: DrawdownSeriesPoint = {
      index: 0,
      date: '2026-01-01',
      balance: baseBalance,
      peak: baseBalance,
      drawdownAmount: 0,
      drawdownPercent: 0,
    };

    return {
      maxDrawdownAmount: 0,
      maxDrawdownPercent: 0,
      currentDrawdownAmount: 0,
      currentDrawdownPercent: 0,
      averageDrawdownPercent: 0,
      recoveryFactor: 0,
      recoveryTrades: 0,
      maxWinStreak: 0,
      maxLossStreak: 0,
      drawdownSeries: [initialPoint],
    };
  }

  let currentBalance = baseBalance;
  let peak = baseBalance;
  let maxDrawdownAmount = 0;
  let maxDrawdownPercent = 0;

  let currentWinStreak = 0;
  let maxWinStreak = 0;
  let currentLossStreak = 0;
  let maxLossStreak = 0;

  let currentRecoveryTrades = 0;
  let maxRecoveryTrades = 0;

  const drawdownSeries: DrawdownSeriesPoint[] = [
    {
      index: 0,
      date: (closed[0].openDate || closed[0].createdAt || '2026-01-01').split('T')[0],
      balance: currentBalance,
      peak,
      drawdownAmount: 0,
      drawdownPercent: 0,
    },
  ];

  const drawdownValues: number[] = [];

  for (let i = 0; i < closed.length; i++) {
    const trade = closed[i];
    const rawResult = Number(trade.result || 0);
    const comms = Number(trade.commissions || 0);
    const netResult = Number((rawResult - comms).toFixed(4));

    // Update streaks (threshold for breakeven: +/- 0.01)
    if (netResult > 0.01) {
      currentWinStreak++;
      currentLossStreak = 0;
      if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
    } else if (netResult < -0.01) {
      currentLossStreak++;
      currentWinStreak = 0;
      if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
    } else {
      // Breakeven trade does not increment either streak
      currentWinStreak = 0;
      currentLossStreak = 0;
    }

    currentBalance = Number((currentBalance + netResult).toFixed(2));

    if (currentBalance >= peak) {
      peak = currentBalance;
      currentRecoveryTrades = 0;
    } else {
      currentRecoveryTrades++;
      if (currentRecoveryTrades > maxRecoveryTrades) {
        maxRecoveryTrades = currentRecoveryTrades;
      }
    }

    const ddAmount = Number(Math.max(0, peak - currentBalance).toFixed(2));
    const ddPercent = peak > 0 ? Number(((ddAmount / peak) * 100).toFixed(2)) : 0;

    if (ddAmount > maxDrawdownAmount) maxDrawdownAmount = ddAmount;
    if (ddPercent > maxDrawdownPercent) maxDrawdownPercent = ddPercent;

    if (ddPercent > 0) {
      drawdownValues.push(ddPercent);
    }

    const tradeDate = (trade.closeDate || trade.openDate || trade.createdAt || '2026-01-01').split('T')[0];

    drawdownSeries.push({
      index: i + 1,
      date: tradeDate,
      balance: currentBalance,
      peak,
      drawdownAmount: ddAmount,
      drawdownPercent: ddPercent,
    });
  }

  const lastPoint = drawdownSeries[drawdownSeries.length - 1];
  const currentDrawdownAmount = lastPoint.drawdownAmount;
  const currentDrawdownPercent = lastPoint.drawdownPercent;

  const averageDrawdownPercent =
    drawdownValues.length > 0
      ? Number((drawdownValues.reduce((a, b) => a + b, 0) / drawdownValues.length).toFixed(2))
      : 0;

  const netProfit = Number((currentBalance - baseBalance).toFixed(2));
  let recoveryFactor = 0;
  if (maxDrawdownAmount > 0) {
    recoveryFactor = Number((netProfit / maxDrawdownAmount).toFixed(2));
  } else if (netProfit > 0) {
    recoveryFactor = Infinity;
  }

  return {
    maxDrawdownAmount,
    maxDrawdownPercent,
    currentDrawdownAmount,
    currentDrawdownPercent,
    averageDrawdownPercent,
    recoveryFactor,
    recoveryTrades: maxRecoveryTrades,
    maxWinStreak,
    maxLossStreak,
    drawdownSeries,
  };
}
