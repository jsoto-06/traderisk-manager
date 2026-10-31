// =============================================================================
// TradeRisk Manager — Core Types
// =============================================================================

/** Supported account types */
export type AccountType =
  | 'Personal'
  | 'PropFirm'
  | 'Exchange'
  | 'Broker'
  | 'Demo'
  | 'Custom';

/** How drawdown is calculated */
export type DrawdownType = 'static' | 'trailing' | 'custom';

/** Instrument calculation models */
export enum InstrumentType {
  Spot = 'spot',
  ForexLot = 'forex_lot',
  Futures = 'futures',
  Perpetual = 'perpetual',
  Stocks = 'stocks',
  Multiplier = 'multiplier',
  TickValue = 'tick_value',
}

/** Trade direction */
export type Direction = 'long' | 'short';

/** Trade status */
export type TradeStatus = 'open' | 'closed';

/** Supported locales */
export type Locale = 'es' | 'en';

/** Theme preference */
export type Theme = 'light' | 'dark' | 'system';

/** Emotional states for journal */
export type EmotionalState =
  | 'calm'
  | 'anxious'
  | 'confident'
  | 'fearful'
  | 'euphoric'
  | 'frustrated';

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------
export interface Account {
  id: string;
  name: string;
  type: AccountType;
  initialCapital: number;
  balance: number;
  equity: number;
  currency: string;
  profitTarget: number;       // percentage
  dailyLossLimit: number;     // percentage
  maxDrawdown: number;        // percentage
  drawdownType: DrawdownType;
  timezone: string;
  dailyResetHour: number;
  riskPerTrade: number;       // percentage
  leverage: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  version?: number;
}

// ---------------------------------------------------------------------------
// Trade
// ---------------------------------------------------------------------------
export interface Trade {
  id: string;
  accountId: string;
  asset: string;
  direction: Direction;
  entryPrice: number;
  exitPrice?: number;
  stopLoss: number;
  takeProfit: number;
  size: number;
  openDate: string;
  closeDate?: string;
  status: TradeStatus;
  result?: number;
  commissions: number;
  strategy: string;
  timeframe: string;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  version?: number;
}

// ---------------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------------
export interface JournalEntry {
  id: string;
  date: string;
  emotionalState: EmotionalState;
  entryReason: string;
  planCompliance: boolean;
  errors: string;
  overtrading: boolean;
  observations: string;
  discipline: 1 | 2 | 3 | 4 | 5;
  accountId: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  version?: number;
}

/** Tombstone tracking for distributed soft-delete synchronization */
export type EntityType = 'account' | 'trade' | 'journal';

export interface Tombstone {
  id: string;
  entity: EntityType;
  deletedAt: string;
  updatedAt: string;
  accountId?: string;
  userId?: string;
}

/** Supported market categories for multi-asset trading */
export type MarketType = 'crypto' | 'forex' | 'futures' | 'stocks' | 'indices';

// ---------------------------------------------------------------------------
// Risk Calculation
// ---------------------------------------------------------------------------
export interface RiskCalculationInput {
  accountBalance: number;
  riskPercent?: number;
  riskAmount?: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit?: number;
  direction: Direction;
  commission?: number;        // percentage per trade (or base rate)
  leverage?: number;
  instrumentType: InstrumentType;

  // Multi-asset specific parameters (optional with intelligent defaults):
  market?: MarketType;
  accountCurrency?: string;   // Account base currency (e.g. 'USD', 'EUR', 'GBP')
  assetSymbol?: string;       // Asset symbol / ticker (e.g. 'EUR/USD', 'GBP/JPY', 'BTC/USDT', 'ES')
  marginMode?: 'isolated' | 'cross'; // Margin isolation mode for derivatives (default 'isolated')
  accountEquity?: number;     // Real-time equity including unrealized P&L
  usedMargin?: number;        // Margin currently allocated to open positions
  freeMargin?: number;        // Explicit free margin available
  enforceTickGrid?: boolean;  // Whether to strictly enforce tick grid multiples on price inputs
  contractMultiplier?: number; // Futures / Index multiplier (e.g., 50 for ES, 5 for MES)
  tickSize?: number;          // Min price increment (e.g., 0.25 for ES)
  tickValue?: number;         // Monetary value per tick fluctuation
  lotType?: 'standard' | 'mini' | 'micro'; // Forex lot size unit
  pipSize?: number;           // Forex pip increment (0.0001 or 0.01 for JPY)
  quoteToAccountRate?: number;// Exchange rate from quote currency to account currency (default 1.0)
  baseToAccountRate?: number; // Exchange rate from base currency to account currency
  fundingRate?: number;       // Perpetual funding rate per period (% e.g., 0.01%)
  fundingPeriods?: number;    // Estimated funding cycles held (default 0)
  fundingIntervalHours?: number; // Interval between funding settlements (e.g. 8 for Binance, 1 for dYdX)
  holdingPeriodHours?: number;// Expected position duration in hours
  spreadPips?: number;        // Forex spread in pips
  pricesIncludeSpread?: boolean; // Whether input entry/SL already reflect Bid/Ask execution
  commissionPerContract?: number; // Flat fee per futures contract (e.g., $4.50 round turn)
  initialMarginPerUnit?: number;  // Futures broker initial margin per contract
  maintenanceMarginPerUnit?: number; // Maintenance margin required per unit/contract
  allowFractional?: boolean;  // Allow fractional units (true for crypto/stocks, false for futures)
  includeFeesInRisk?: boolean;// Whether to size strictly so total Net Loss (distance + fees) <= riskBudget
}

export interface RiskCalculationOutput {
  riskAmount: number;
  riskPercent: number;
  stopLossDistance: number;
  stopLossPercent: number;
  positionSize: number;
  notionalValue: number;
  estimatedMargin: number;
  maintenanceMargin?: number; // Required maintenance margin before liquidation
  isMarginEstimated?: boolean;// True if margin requirement is estimated due to missing broker specs
  freeMargin?: number;        // Free margin available in account
  potentialProfit: number;
  potentialLoss: number;
  grossRisk?: number;         // Gross monetary loss at SL before fees
  totalEstimatedCosts?: number; // Sum of commissions, spread friction and funding drag at SL
  effectiveNetRisk?: number;  // Total net loss at SL in account currency (|netLoss|)
  riskRewardRatio: number;
  netRiskRewardRatio: number;
  estimatedCommissions: number;
  lossCommissions: number;
  netProfit: number;
  netLoss: number;

  // Quantitative Protection & Feasibility metrics:
  isOperable?: boolean;        // True if position can be safely opened within the risk budget
  inoperableReason?: string;   // Reason why position is not operable (e.g. insufficient risk for 1 contract)
  liquidationPrice?: number;   // Estimated liquidation price
  isLiquidationEstimated?: boolean; // True if liquidation price is an approximation based on MMR
  liquidationMethodology?: string;  // Explanation of model assumptions for liquidation
  isLiquidationBeforeSL?: boolean; // Warning: position will be liquidated before reaching Stop Loss
  priceGridWarning?: string;   // Warning if price input does not align with exchange tick grid

  // Multi-asset specific detail metrics:
  positionSizeUnit?: string;   // 'BTC', 'ETH', 'lots', 'contracts', 'shares', 'units'
  ticksOrPips?: number;        // Distance in ticks (futures) or pips (forex)
  pipValue?: number;           // Calculated monetary pip value for forex
  tickValue?: number;          // Monetary value of 1 tick (futures)
  fundingCost?: number;        // Total funding fee for perpetual positions
  pointValue?: number;         // Dollar value per 1.0 full point movement (futures)
  effectiveRiskAmount?: number;// Actual monetary risk after lot/contract rounding
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
export interface Settings {
  language: Locale;
  theme: Theme;
  defaultAccountId: string;
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------
export interface TradeStatistics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  netProfit: number;
  averageWin: number;
  averageLoss: number;
  bestTrade: number;
  worstTrade: number;
  maxWinStreak: number;
  maxLossStreak: number;
  currentStreak: { type: 'win' | 'loss' | 'none'; count: number };
  balanceHistory: { date: string; balance: number }[];
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------
export interface StorageProvider {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
  clear(): void;
}

// ---------------------------------------------------------------------------
// Validation result
// ---------------------------------------------------------------------------
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}
