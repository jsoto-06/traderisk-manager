// =============================================================================
// TradeRisk Manager — Demo Data Generator
// =============================================================================

import type { Account, Trade, JournalEntry, Settings } from '@/lib/types';

export const DEMO_ACCOUNT_ID = 'demo-account-001';

export const DEMO_ACCOUNT: Account = {
  id: DEMO_ACCOUNT_ID,
  name: 'Demo Account (Prop Challenge)',
  type: 'Demo',
  initialCapital: 5000,
  balance: 5120.5,
  equity: 5120.5,
  currency: 'USD',
  profitTarget: 10,       // 10%
  dailyLossLimit: 3,      // 3%
  maxDrawdown: 6,         // 6%
  drawdownType: 'static',
  timezone: 'America/New_York',
  dailyResetHour: 17,     // 17:00 EST
  riskPerTrade: 0.40,     // 0.40% = $20 on $5k
  leverage: 1,
  createdAt: '2026-10-01T08:00:00.000Z',
  updatedAt: '2026-10-31T12:00:00.000Z',
};

export const DEMO_TRADES: Trade[] = [
  {
    id: 'demo-trade-1',
    accountId: DEMO_ACCOUNT_ID,
    asset: 'BTC/USDT',
    direction: 'long',
    entryPrice: 82000,
    exitPrice: 84500,
    stopLoss: 81000,
    takeProfit: 84500,
    size: 0.02,
    openDate: '2026-10-25T14:30:00.000Z',
    closeDate: '2026-10-25T18:45:00.000Z',
    status: 'closed',
    result: 50.0,
    commissions: 2.5,
    strategy: 'OrderBlock Retest',
    timeframe: '15m',
    notes: 'Clean bounce on the 15m bullish order block. Target hit smoothly.',
  },
  {
    id: 'demo-trade-2',
    accountId: DEMO_ACCOUNT_ID,
    asset: 'ETH/USDT',
    direction: 'short',
    entryPrice: 3450,
    exitPrice: 3510,
    stopLoss: 3510,
    takeProfit: 3300,
    size: 0.35,
    openDate: '2026-10-26T09:15:00.000Z',
    closeDate: '2026-10-26T11:00:00.000Z',
    status: 'closed',
    result: -21.0,
    commissions: 1.2,
    strategy: 'Liquidity Grab',
    timeframe: '1h',
    notes: 'Failed breakdown, stopped out at initial risk level. Followed plan.',
  },
  {
    id: 'demo-trade-3',
    accountId: DEMO_ACCOUNT_ID,
    asset: 'SOL/USDT',
    direction: 'long',
    entryPrice: 195.0,
    exitPrice: 204.0,
    stopLoss: 191.0,
    takeProfit: 205.0,
    size: 5.0,
    openDate: '2026-10-27T16:00:00.000Z',
    closeDate: '2026-10-28T02:30:00.000Z',
    status: 'closed',
    result: 45.0,
    commissions: 1.8,
    strategy: 'Trend Continuation',
    timeframe: '4h',
    notes: 'Higher-high break on 4h timeframe, partial exit before TP.',
  },
  {
    id: 'demo-trade-4',
    accountId: DEMO_ACCOUNT_ID,
    asset: 'BTC/USDT',
    direction: 'short',
    entryPrice: 85200,
    exitPrice: 83100,
    stopLoss: 86000,
    takeProfit: 83000,
    size: 0.025,
    openDate: '2026-10-29T10:00:00.000Z',
    closeDate: '2026-10-29T20:15:00.000Z',
    status: 'closed',
    result: 52.5,
    commissions: 2.8,
    strategy: 'Range Deviation',
    timeframe: '1h',
    notes: 'Clear rejection at range high, perfect R:R ratio trade.',
  },
  {
    id: 'demo-trade-5',
    accountId: DEMO_ACCOUNT_ID,
    asset: 'EUR/USD',
    direction: 'long',
    entryPrice: 1.0850,
    exitPrice: 1.0825,
    stopLoss: 1.0825,
    takeProfit: 1.0920,
    size: 0.1,
    openDate: '2026-10-30T08:00:00.000Z',
    closeDate: '2026-10-30T10:30:00.000Z',
    status: 'closed',
    result: -6.0,
    commissions: 0.5,
    strategy: 'London Open Breakout',
    timeframe: '5m',
    notes: 'False breakout during London session, strictly cut loss at stop.',
  },
];

export const DEMO_JOURNAL: JournalEntry[] = [
  {
    id: 'demo-journal-1',
    date: '2026-10-25T20:00:00.000Z',
    emotionalState: 'calm',
    entryReason: 'High probability setup on BTC 15m order block after liquidity sweep.',
    planCompliance: true,
    errors: 'None, followed checklist and respected R:R.',
    overtrading: false,
    observations: 'Good patience waiting for the retest instead of chasing the breakout candle.',
    discipline: 5,
    accountId: DEMO_ACCOUNT_ID,
  },
  {
    id: 'demo-journal-2',
    date: '2026-10-26T12:00:00.000Z',
    emotionalState: 'anxious',
    entryReason: 'Attempted to short ETH after rapid upward rally.',
    planCompliance: false,
    errors: 'Entered slightly early before confirmation candle closed.',
    overtrading: false,
    observations: 'Felt slight FOMO due to missing the previous morning move. SL protected capital as designed.',
    discipline: 3,
    accountId: DEMO_ACCOUNT_ID,
  },
];

export const DEMO_SETTINGS: Settings = {
  language: 'es',
  theme: 'dark',
  defaultAccountId: DEMO_ACCOUNT_ID,
};
