// =============================================================================
// TradeRisk Manager — Statistics Engine
// =============================================================================

import type { Trade, TradeStatistics } from '@/lib/types';

/**
 * Return a default (empty) statistics object with zero values.
 */
function emptyStatistics(initialBalance: number): TradeStatistics {
  return {
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    winRate: 0,
    profitFactor: 0,
    netProfit: 0,
    averageWin: 0,
    averageLoss: 0,
    bestTrade: 0,
    worstTrade: 0,
    maxWinStreak: 0,
    maxLossStreak: 0,
    currentStreak: { type: 'none', count: 0 },
    balanceHistory: [{ date: '1970-01-01T00:00:00.000Z', balance: initialBalance }],
  };
}

/**
 * Calculate comprehensive statistics from a list of trades.
 *
 * Only closed trades with a non-null `result` are considered.
 * Returns sensible zero-values when there are no qualifying trades.
 */
export function calculateStatistics(
  trades: Trade[],
  initialBalance: number,
): TradeStatistics {
  // Filter to closed trades with a result
  const closed = trades.filter(
    (t) => t.status === 'closed' && t.result != null,
  );

  if (closed.length === 0) {
    return emptyStatistics(initialBalance);
  }

  // Sort by closeDate (or openDate as fallback) ascending
  const sorted = [...closed].sort((a, b) => {
    const dateA = a.closeDate ?? a.openDate;
    const dateB = b.closeDate ?? b.openDate;
    return new Date(dateA).getTime() - new Date(dateB).getTime();
  });

  let winningTrades = 0;
  let losingTrades = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let bestTrade = -Infinity;
  let worstTrade = Infinity;

  // Streak tracking
  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let currentWinStreak = 0;
  let currentLossStreak = 0;

  // Balance history
  let runningBalance = initialBalance;
  const balanceHistory: { date: string; balance: number }[] = [
    { date: sorted[0].openDate, balance: initialBalance },
  ];

  for (const trade of sorted) {
    const result = trade.result!;

    if (result > 0) {
      winningTrades++;
      grossProfit += result;
      currentWinStreak++;
      currentLossStreak = 0;
      if (currentWinStreak > maxWinStreak) {
        maxWinStreak = currentWinStreak;
      }
    } else if (result < 0) {
      losingTrades++;
      grossLoss += Math.abs(result);
      currentLossStreak++;
      currentWinStreak = 0;
      if (currentLossStreak > maxLossStreak) {
        maxLossStreak = currentLossStreak;
      }
    } else {
      // Breakeven trade — resets both streaks
      currentWinStreak = 0;
      currentLossStreak = 0;
    }

    if (result > bestTrade) bestTrade = result;
    if (result < worstTrade) worstTrade = result;

    runningBalance += result;
    balanceHistory.push({
      date: trade.closeDate ?? trade.openDate,
      balance: runningBalance,
    });
  }

  const totalTrades = sorted.length;
  const netProfit = grossProfit - grossLoss;

  // Win rate
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

  // Profit factor (grossProfit / grossLoss, 0 if no losses)
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0);
  // Cap at a safe number to avoid Infinity in JSON
  const safeProfitFactor = Number.isFinite(profitFactor) ? profitFactor : 0;

  // Averages
  const averageWin = winningTrades > 0 ? grossProfit / winningTrades : 0;
  const averageLoss = losingTrades > 0 ? grossLoss / losingTrades : 0;

  // Current streak
  let currentStreak: TradeStatistics['currentStreak'];
  if (currentWinStreak > 0) {
    currentStreak = { type: 'win', count: currentWinStreak };
  } else if (currentLossStreak > 0) {
    currentStreak = { type: 'loss', count: currentLossStreak };
  } else {
    currentStreak = { type: 'none', count: 0 };
  }

  // Guard against Infinity for best/worst when list was all break-even
  const safeBest = Number.isFinite(bestTrade) ? bestTrade : 0;
  const safeWorst = Number.isFinite(worstTrade) ? worstTrade : 0;

  return {
    totalTrades,
    winningTrades,
    losingTrades,
    winRate,
    profitFactor: safeProfitFactor,
    netProfit,
    averageWin,
    averageLoss,
    bestTrade: safeBest,
    worstTrade: safeWorst,
    maxWinStreak,
    maxLossStreak,
    currentStreak,
    balanceHistory,
  };
}
