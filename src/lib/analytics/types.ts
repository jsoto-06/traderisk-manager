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

export type MonteCarloMethod =
  | 'bootstrap_iid'
  | 'bootstrap_block'
  | 'parametric_fixed'
  | 'parametric_variable';

export interface MonteCarloConfig {
  simulationsCount: number; // e.g. 1000
  tradesCount: number; // Horizon: e.g. 50, 100, 200 trades
  initialCapital: number;
  riskType: 'fixed_amount' | 'percentage_equity';
  riskValue: number; // Currency amount or percent (e.g. 100 or 1.0)
  profitTarget?: number; // Optional target equity or target gain
  maxDrawdownLimitPercent?: number; // e.g. 10%
  seed?: number; // For deterministic reproducible simulation
  method?: MonteCarloMethod; // default: 'bootstrap_iid'
  blockSize?: number; // for block bootstrap (default: 5)
  // Custom trade parameters if no historical trades exist or for theoretical modeling
  customDistribution?: {
    winRate: number; // 0-100
    averageWin: number;
    averageLoss: number;
    winStdDev?: number; // Optional dispersion of winning trades
    lossStdDev?: number; // Optional dispersion of losing trades
    skewness?: number; // Optional skewness
    kurtosis?: number; // Optional kurtosis
    distributionFamily?: 'lognormal' | 'truncated_normal'; // default: 'lognormal'
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

export interface MonteCarloMetadata {
  seed: number;
  algorithmVersion: string; // e.g. '5.1.0'
  method: MonteCarloMethod;
  simulationsCount: number;
  tradesCount: number;
  blockSize?: number;
  riskType: 'fixed_amount' | 'percentage_equity';
  riskValue: number;
  timestamp: string;
}

export interface EmpiricalStatistics {
  mean: number;
  stdDev: number;
  skewness: number;
  excessKurtosis: number;
  maxHistoricalDrawdown: number;
  historicalTradesCount: number;
  valueAtRisk95: number; // 5th percentile loss in R
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
  metadata: MonteCarloMetadata;
  empiricalStatistics?: EmpiricalStatistics;
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
  riskModel?: 'fixed_amount' | 'percentage_equity'; // default: 'fixed_amount' for analytical Gambler's Ruin alignment
  maxKellyCapPercent?: number; // default: 25% max risk cap
  historicalSampleSize?: number; // sample size N to evaluate parameter stability
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

export interface KellySensitivity {
  sensitivityToWinRate: number; // dK / dW = 1 + 1/R
  sensitivityToPayoff: number; // dK / dR = (1 - W) / R^2
  stressedKellyPercent: number; // Kelly under stressed parameters (e.g. W - 5%, R * 0.85)
  stressedWinRate: number;
  stressedPayoffRatio: number;
}

export interface RiskOfRuinResult {
  initialCapital: number;
  winRate: number;
  payoffRatio: number; // averageWin / averageLoss
  edgePercent: number; // Edge = (WinRate * Payoff - LossRate)
  advantage: number; // A parameter in Ralph Vince / Perry formula
  riskUnits: number; // Units of risk to breach
  analyticalRuinProbability: number; // Asymptotic closed-form formula % (Ralph Vince, T -> inf)
  asymptoticRuinProbability: number; // Explicit asymptotic ruin %
  finiteHorizonRuinProbability: number; // Empirical & barrier finite horizon % for tradesHorizon
  empiricalRuinProbability: number; // Monte Carlo %
  scenarios: RiskScenarioComparison[];
  kellyCriterion: {
    fullKellyPercent: number;
    halfKellyPercent: number;
    quarterKellyPercent: number;
    cappedKellyPercent: number;
    maxKellyCapPercent: number;
    isCapped: boolean;
  };
  kellySensitivity: KellySensitivity;
  recoveryProbability50Pct: number;
  hypothesesAndLimits: string[];
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

export type PropFirmDailyLossEnforcement = 'hard_breach' | 'soft_pause';

export interface PropFirmSimulatorConfig {
  initialCapital: number;
  profitTargetPercent: number; // e.g. 8% or 10%
  dailyLossLimitPercent: number; // e.g. 4% or 5%
  maxDrawdownPercent: number; // e.g. 8% or 10%
  drawdownType: PropFirmDrawdownType;
  dailyLossType: PropFirmDailyLossType;
  dailyLossEnforcement?: PropFirmDailyLossEnforcement; // default: 'hard_breach'
  dailyLossBase?: 'initial_capital' | 'day_start_balance'; // default: 'initial_capital'
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
  dailyLossTriggersProbability?: number; // % paths triggering daily loss pause/breach
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
    dailyLossTriggersCount?: number;
  };
}
