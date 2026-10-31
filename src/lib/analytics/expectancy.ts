// =============================================================================
// TradeRisk Manager — Mathematical Expectancy & Performance Analytics
// =============================================================================

import type { Trade } from '@/lib/types';
import type { ExpectancyMetrics, AnalyticsFilter } from './types';

export const MIN_ADEQUATE_SAMPLE_SIZE = 10;
export const RECOMMENDED_SAMPLE_SIZE = 30;

/**
 * Filters a collection of trades according to user-selected analytics criteria.
 */
export function filterTrades(trades: Trade[], filter?: AnalyticsFilter): Trade[] {
  if (!filter) return trades;

  return trades.filter((t) => {
    if (filter.accountId && t.accountId !== filter.accountId) return false;
    if (filter.asset && t.asset.toUpperCase() !== filter.asset.toUpperCase()) return false;
    if (filter.direction && t.direction !== filter.direction) return false;
    if (filter.strategy && t.strategy !== filter.strategy) return false;

    const tradeDate = t.closeDate || t.openDate;
    if (filter.startDate) {
      if (new Date(tradeDate).getTime() < new Date(filter.startDate).getTime()) return false;
    }
    if (filter.endDate) {
      if (new Date(tradeDate).getTime() > new Date(filter.endDate).getTime()) return false;
    }

    return true;
  });
}

/**
 * Calculates comprehensive mathematical expectancy and core quantitative performance metrics.
 *
 * Rules:
 * - Only closed trades with valid result are processed.
 * - Net results (accounting for commissions) are used when calculating profits and losses.
 * - Breakeven trades (net result between -0.001 and +0.001) are handled distinctly.
 * - Division by zero is protected with Infinity / 0 fallbacks.
 * - Sample size adequacy warnings are generated for small datasets.
 */
export function calculateExpectancy(
  trades: Trade[],
  filter?: AnalyticsFilter,
): ExpectancyMetrics {
  const filtered = filterTrades(trades, filter);

  // 1. Consider strictly closed trades with a defined result
  const closed = filtered.filter((t) => t.status === 'closed' && t.result != null);

  if (closed.length === 0) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      breakevenTrades: 0,
      winRate: 0,
      lossRate: 0,
      breakevenRate: 0,
      averageWin: 0,
      averageLoss: 0,
      winLossRatio: 0,
      expectancy: 0,
      expectancyR: 0,
      profitFactor: 0,
      netProfit: 0,
      grossProfit: 0,
      grossLoss: 0,
      totalCommissions: 0,
      bestTrade: 0,
      worstTrade: 0,
      sampleSize: 0,
      isSampleSizeAdequate: false,
      sampleSizeWarning: 'No hay operaciones cerradas disponibles para calcular métricas.',
    };
  }

  let winningTrades = 0;
  let losingTrades = 0;
  let breakevenTrades = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let totalCommissions = 0;
  let bestTrade = -Infinity;
  let worstTrade = Infinity;

  // Variables for R-multiples computation
  let sumWinningR = 0;
  let countWinningR = 0;
  let sumLosingR = 0;
  let countLosingR = 0;

  for (const trade of closed) {
    const rawResult = Number(trade.result);
    const comms = Number(trade.commissions || 0);
    totalCommissions += comms;

    // Use net profit of trade
    const netResult = Number((rawResult - comms).toFixed(4));

    if (netResult > bestTrade) bestTrade = netResult;
    if (netResult < worstTrade) worstTrade = netResult;

    // Determine initial risk unit R
    let initialRiskDollars = 0;
    if (trade.stopLoss && trade.entryPrice && trade.size) {
      initialRiskDollars = Math.abs(trade.entryPrice - trade.stopLoss) * trade.size;
    }

    // Threshold for breakeven: less than 0.01 currency unit
    if (Math.abs(netResult) < 0.01) {
      breakevenTrades++;
    } else if (netResult > 0) {
      winningTrades++;
      grossProfit += netResult;
      if (initialRiskDollars > 0) {
        sumWinningR += netResult / initialRiskDollars;
        countWinningR++;
      }
    } else {
      losingTrades++;
      grossLoss += Math.abs(netResult);
      if (initialRiskDollars > 0) {
        sumLosingR += Math.abs(netResult) / initialRiskDollars;
        countLosingR++;
      }
    }
  }

  const totalTrades = closed.length;
  grossProfit = Number(grossProfit.toFixed(2));
  grossLoss = Number(grossLoss.toFixed(2));
  totalCommissions = Number(totalCommissions.toFixed(2));
  const netProfit = Number((grossProfit - grossLoss).toFixed(2));

  // Win and Loss Rates (based on total closed trades)
  const winRate = Number(((winningTrades / totalTrades) * 100).toFixed(2));
  const lossRate = Number(((losingTrades / totalTrades) * 100).toFixed(2));
  const breakevenRate = Number(((breakevenTrades / totalTrades) * 100).toFixed(2));

  // Average Win and Average Loss
  const averageWin = winningTrades > 0 ? Number((grossProfit / winningTrades).toFixed(2)) : 0;
  const averageLoss = losingTrades > 0 ? Number((grossLoss / losingTrades).toFixed(2)) : 0;

  // Win / Loss Ratio (Payoff Ratio)
  let winLossRatio = 0;
  if (averageLoss > 0) {
    winLossRatio = Number((averageWin / averageLoss).toFixed(3));
  } else if (averageWin > 0) {
    winLossRatio = Infinity;
  }

  // Monetary Expectancy: (WinRate * AvgWin) - (LossRate * AvgLoss)
  // Mathematically equals netProfit / totalTrades
  const expectancy = Number(
    ((winRate / 100) * averageWin - (lossRate / 100) * averageLoss).toFixed(2),
  );

  // Expectancy in R-multiples
  let avgWinR = 0;
  let avgLossR = 0;
  if (countWinningR > 0) {
    avgWinR = sumWinningR / countWinningR;
  } else if (averageLoss > 0 && averageWin > 0) {
    avgWinR = averageWin / averageLoss; // Normalized payoff fallback
  }

  if (countLosingR > 0) {
    avgLossR = sumLosingR / countLosingR;
  } else if (averageLoss > 0) {
    avgLossR = 1.0; // 1R standard loss
  }

  const expectancyR = Number(
    ((winRate / 100) * avgWinR - (lossRate / 100) * avgLossR).toFixed(3),
  );

  // Profit Factor
  let profitFactor = 0;
  if (grossLoss > 0) {
    profitFactor = Number((grossProfit / grossLoss).toFixed(3));
  } else if (grossProfit > 0) {
    profitFactor = Infinity;
  }

  // Sample size evaluation
  let isSampleSizeAdequate = true;
  let sampleSizeWarning: string | null = null;

  if (totalTrades < MIN_ADEQUATE_SAMPLE_SIZE) {
    isSampleSizeAdequate = false;
    sampleSizeWarning = `Muestra insuficiente (${totalTrades} operaciones). Se recomiendan al menos ${RECOMMENDED_SAMPLE_SIZE} para significancia estadística.`;
  } else if (totalTrades < RECOMMENDED_SAMPLE_SIZE) {
    isSampleSizeAdequate = true;
    sampleSizeWarning = `Muestra moderada (${totalTrades} operaciones). Margen de error estadístico elevado.`;
  }

  return {
    totalTrades,
    winningTrades,
    losingTrades,
    breakevenTrades,
    winRate,
    lossRate,
    breakevenRate,
    averageWin,
    averageLoss,
    winLossRatio,
    expectancy,
    expectancyR,
    profitFactor,
    netProfit,
    grossProfit,
    grossLoss,
    totalCommissions,
    bestTrade: bestTrade === -Infinity ? 0 : Number(bestTrade.toFixed(2)),
    worstTrade: worstTrade === Infinity ? 0 : Number(worstTrade.toFixed(2)),
    sampleSize: totalTrades,
    isSampleSizeAdequate,
    sampleSizeWarning,
  };
}
