// =============================================================================
// TradeRisk Manager — Quantitative Analytics & Simulation Types (Fase 5)
// =============================================================================

export interface ExpectancyMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;
  winRate: number; // 0 - 100
  lossRate: number; // 0 - 100
  breakevenRate: number; // 0 - 100
  averageWin: number;
  averageLoss: number;
  winLossRatio: number; // Payoff ratio: averageWin / averageLoss
  expectancy: number; // Monetary expectancy per trade: (WinRate * AvgWin) - (LossRate * AvgLoss)
  expectancyR: number; // Expectancy in R-multiples
  profitFactor: number; // GrossProfit / |GrossLoss|
  netProfit: number;
  grossProfit: number;
  grossLoss: number;
  totalCommissions: number;
  bestTrade: number;
  worstTrade: number;
  sampleSize: number;
  isSampleSizeAdequate: boolean;
  sampleSizeWarning: string | null;
}

export interface DrawdownSeriesPoint {
  index: number;
  date: string;
  balance: number;
  equity?: number;
  peak: number;
  drawdownAmount: number;
  drawdownPercent: number;
}

export interface DrawdownMetrics {
  maxDrawdownAmount: number;
  maxDrawdownPercent: number;
  currentDrawdownAmount: number;
  currentDrawdownPercent: number;
  averageDrawdownPercent: number;
  recoveryFactor: number; // Net Profit / Max Drawdown Amount
  recoveryTrades: number; // Max consecutive trades spent in drawdown before reaching new peak
  maxWinStreak: number;
  maxLossStreak: number;
  drawdownSeries: DrawdownSeriesPoint[];
}

export interface AnalyticsFilter {
  accountId?: string;
  asset?: string;
  direction?: 'long' | 'short';
  startDate?: string;
  endDate?: string;
  strategy?: string;
}

// -----------------------------------------------------------------------------
// Monte Carlo Simulation Types
// -----------------------------------------------------------------------------

export interface MonteCarloConfig {
  simulationsCount: number; // e.g. 1000
  tradesCount: number; // Horizon: e.g. 50, 100, 200 trades
  initialCapital: number;
  riskType: 'fixed_amount' | 'percentage_equity';
  riskValue: number; // Currency amount or percent (e.g. 100 or 1.0)
  profitTarget?: number; // Optional target equity or target gain
  maxDrawdownLimitPercent?: number; // e.g. 10%
  seed?: number; // For deterministic reproducible simulation
  // Custom trade parameters if no historical trades exist
  customDistribution?: {
    winRate: number; // 0-100
    averageWin: number;
    averageLoss: number;
  };
}

export interface MonteCarloCurvePoint {
  tradeIndex: number;
  p5: number;
  p25: number;
  p50: number; // Median
  p75: number;
  p95: number;
}

export interface DistributionBin {
  binLabel: string;
  binMin: number;
  binMax: number;
  count: number;
  percentage: number;
}

export interface MonteCarloResult {
  simulationsCount: number;
  tradesCount: number;
  initialCapital: number;
  profitProbability: number; // % simulations ending > initialCapital
  targetProbability: number; // % simulations reaching profitTarget
  ruinProbability: number; // % simulations losing >= 90% capital or maxDrawdown
  drawdownBreachProbability: number; // % simulations exceeding maxDrawdownLimit
  medianFinalEquity: number;
  percentiles: {
    p5: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
  };
  maxDrawdownMedian: number;
  maxDrawdownP95: number; // Worst 5% drawdown
  curves: MonteCarloCurvePoint[];
  finalEquityDistribution: DistributionBin[];
  disclaimer: string;
}

// -----------------------------------------------------------------------------
// Risk of Ruin Types
// -----------------------------------------------------------------------------

export interface RiskOfRuinConfig {
  initialCapital: number;
  winRate: number; // 0-100
  averageWin: number;
  averageLoss: number;
  riskPerTradePercent: number; // e.g. 1.0%
  maxLossLimitPercent: number; // e.g. 10% for Prop Firm or 100% for total ruin
  tradesHorizon?: number; // default 200
  seed?: number;
}

export interface RiskScenarioComparison {
  riskPercent: number;
  formulaRuinPercent: number;
  empiricalRuinPercent: number;
  expectedFinalReturnPercent: number;
  expectedMaxDrawdownPercent: number;
  isRecommended: boolean;
  riskTag: 'conservative' | 'balanced' | 'aggressive' | 'extreme';
}

export interface RiskOfRuinResult {
  initialCapital: number;
  winRate: number;
  payoffRatio: number; // averageWin / averageLoss
  edgePercent: number; // Edge = (WinRate * Payoff - LossRate)
  advantage: number; // A parameter in Ralph Vince / Perry formula
  riskUnits: number; // Units of risk to breach
  analyticalRuinProbability: number; // Closed form formula %
  empiricalRuinProbability: number; // Monte Carlo %
  scenarios: RiskScenarioComparison[];
  kellyCriterion: {
    fullKellyPercent: number;
    halfKellyPercent: number;
    quarterKellyPercent: number;
  };
  recoveryProbability50Pct: number;
}

// -----------------------------------------------------------------------------
// Prop Firm Simulator Types
// -----------------------------------------------------------------------------

export type PropFirmDrawdownType =
  | 'static'
  | 'trailing_balance'
  | 'trailing_equity'
  | 'trailing_hwm_lock';

export type PropFirmDailyLossType = 'balance_based' | 'equity_based';

export interface PropFirmSimulatorConfig {
  initialCapital: number;
  profitTargetPercent: number; // e.g. 8% or 10%
  dailyLossLimitPercent: number; // e.g. 4% or 5%
  maxDrawdownPercent: number; // e.g. 8% or 10%
  drawdownType: PropFirmDrawdownType;
  dailyLossType: PropFirmDailyLossType;
  resetHour: number; // 0-23
  resetTimezone: string; // e.g. 'UTC', 'America/New_York'
  winRate: number; // 0-100
  averageWin: number;
  averageLoss: number;
  riskPerTradePercent: number; // e.g. 0.5% or 1%
  tradesPerDay: number; // e.g. 3
  maxDays: number; // e.g. 30, 60 or 90
  commissionsPerTrade: number;
  simulationsCount: number; // e.g. 1000
  seed?: number;
}

export interface PropFirmSampleCurve {
  day: number;
  passed1?: number;
  passed2?: number;
  failed1?: number;
  failed2?: number;
  medianPath?: number;
  targetLine: number;
  initialCapitalLine: number;
}

export interface PropFirmSimulatorResult {
  config: PropFirmSimulatorConfig;
  simulationsCount: number;
  passProbability: number; // % reaching target without any breach
  failProbability: number;
  dailyLossBreachProbability: number; // % breaching daily loss limit
  maxDrawdownBreachProbability: number; // % breaching overall max drawdown
  timeoutProbability: number; // % reaching maxDays without passing or failing
  expectedDaysToPass: number | null;
  medianDaysToPass: number | null;
  daysDistribution: DistributionBin[];
  samplePaths: PropFirmSampleCurve[];
  breachAnalysis: {
    dailyLossBreaches: number;
    maxDrawdownBreaches: number;
    bothBreached: number;
  };
}
