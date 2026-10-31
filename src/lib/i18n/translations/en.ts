// =============================================================================
// TradeRisk Manager — English Translations
// =============================================================================

import type { Translations } from './es';

const en: Translations = {
  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------
  nav: {
    dashboard: 'Dashboard',
    accounts: 'Accounts',
    calculator: 'Calculator',
    trades: 'Trades',
    statistics: 'Statistics',
    analytics: 'Quantitative Analytics',
    journal: 'Journal',
    settings: 'Settings',
  },

  // ---------------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------------
  dashboard: {
    balance: 'Balance',
    equity: 'Equity',
    dailyPnl: 'Daily PnL',
    totalPnl: 'Total PnL',
    profitTarget: 'Profit Target',
    progress: 'Progress',
    dailyLossLimit: 'Daily Loss Limit',
    drawdownAvailable: 'Available Drawdown',
    openRisk: 'Open Risk',
    todayTrades: "Today's Trades",
    accountStatus: 'Account Status',
    balanceEvolution: 'Balance Evolution',
    recentTrades: 'Recent Trades',
    riskSummary: 'Risk Summary',
    demoNotice: 'This is a demo account. Data is stored locally in your browser.',
  },

  // ---------------------------------------------------------------------------
  // Accounts
  // ---------------------------------------------------------------------------
  accounts: {
    title: 'Accounts',
    name: 'Name',
    type: 'Type',
    initialCapital: 'Initial Capital',
    balance: 'Balance',
    equity: 'Equity',
    currency: 'Currency',
    profitTarget: 'Profit Target (%)',
    dailyLossLimit: 'Daily Loss Limit (%)',
    maxDrawdown: 'Max Drawdown (%)',
    drawdownType: 'Drawdown Type',
    timezone: 'Timezone',
    dailyResetHour: 'Daily Reset Hour',
    riskPerTrade: 'Risk Per Trade (%)',
    leverage: 'Leverage',
    create: 'Create Account',
    edit: 'Edit Account',
    delete: 'Delete Account',
    accountTypes: {
      Personal: 'Personal',
      PropFirm: 'Prop Firm',
      Exchange: 'Exchange',
      Broker: 'Broker',
      Demo: 'Demo',
      Custom: 'Custom',
    },
    drawdownTypes: {
      static: 'Static',
      trailing: 'Trailing',
      custom: 'Custom',
    },
  },

  // ---------------------------------------------------------------------------
  // Calculator
  // ---------------------------------------------------------------------------
  calculator: {
    title: 'Risk Calculator',
    accountBalance: 'Account Balance',
    riskPercent: 'Risk (%)',
    riskAmount: 'Risk (Amount)',
    entryPrice: 'Entry Price',
    stopLoss: 'Stop Loss',
    takeProfit: 'Take Profit',
    direction: 'Direction',
    long: 'Long',
    short: 'Short',
    commission: 'Commission (%)',
    leverage: 'Leverage',
    instrumentType: 'Instrument Type',
    calculate: 'Calculate',
    results: 'Results',
    riskAmount_result: 'Risk Amount',
    riskPercent_result: 'Risk Percentage',
    stopLossDistance: 'Stop Loss Distance',
    stopLossPercent: 'SL Distance (%)',
    positionSize: 'Position Size',
    notionalValue: 'Notional Value',
    estimatedMargin: 'Estimated Margin',
    potentialProfit: 'Potential Profit',
    potentialLoss: 'Potential Loss',
    riskRewardRatio: 'Risk/Reward Ratio',
    estimatedCommissions: 'Estimated Commissions',
    netProfit: 'Net Profit',
    netLoss: 'Net Loss',
  },

  // ---------------------------------------------------------------------------
  // Trades
  // ---------------------------------------------------------------------------
  trades: {
    title: 'Trades',
    asset: 'Asset',
    direction: 'Direction',
    entryPrice: 'Entry Price',
    exitPrice: 'Exit Price',
    stopLoss: 'Stop Loss',
    takeProfit: 'Take Profit',
    size: 'Size',
    openDate: 'Open Date',
    closeDate: 'Close Date',
    status: 'Status',
    result: 'Result',
    commissions: 'Commissions',
    strategy: 'Strategy',
    timeframe: 'Timeframe',
    notes: 'Notes',
    create: 'Create Trade',
    edit: 'Edit Trade',
    delete: 'Delete Trade',
    statuses: {
      open: 'Open',
      closed: 'Closed',
    },
    directions: {
      long: 'Long',
      short: 'Short',
    },
    filterByStatus: 'Filter by Status',
    filterByAsset: 'Filter by Asset',
    filterByStrategy: 'Filter by Strategy',
  },

  // ---------------------------------------------------------------------------
  // Statistics
  // ---------------------------------------------------------------------------
  statistics: {
    title: 'Statistics',
    totalTrades: 'Total Trades',
    winningTrades: 'Winning Trades',
    losingTrades: 'Losing Trades',
    winRate: 'Win Rate',
    profitFactor: 'Profit Factor',
    netProfit: 'Net Profit',
    averageWin: 'Average Win',
    averageLoss: 'Average Loss',
    bestTrade: 'Best Trade',
    worstTrade: 'Worst Trade',
    maxWinStreak: 'Max Win Streak',
    maxLossStreak: 'Max Loss Streak',
    currentStreak: 'Current Streak',
    balanceHistory: 'Balance History',
    streakTypes: {
      win: 'Winning',
      loss: 'Losing',
      none: 'None',
    },
  },

  // ---------------------------------------------------------------------------
  // Journal
  // ---------------------------------------------------------------------------
  journal: {
    title: 'Trading Journal',
    date: 'Date',
    emotionalState: 'Emotional State',
    entryReason: 'Entry Reason',
    planCompliance: 'Plan Compliance',
    errors: 'Errors',
    overtrading: 'Overtrading',
    observations: 'Observations',
    discipline: 'Discipline',
    create: 'Create Entry',
    edit: 'Edit Entry',
    delete: 'Delete Entry',
    emotionalStates: {
      calm: 'Calm',
      anxious: 'Anxious',
      confident: 'Confident',
      fearful: 'Fearful',
      euphoric: 'Euphoric',
      frustrated: 'Frustrated',
    },
    disciplineLevels: {
      1: 'Very Low',
      2: 'Low',
      3: 'Medium',
      4: 'High',
      5: 'Very High',
    },
    yes: 'Yes',
    no: 'No',
  },

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------
  settings: {
    title: 'Settings',
    language: 'Language',
    theme: 'Theme',
    defaultAccount: 'Default Account',
    dataInfo:
      'Data is stored locally in your browser using localStorage. It is not sent to any server.',
    backupTitle: 'Backup & Secure Recovery',
    backupDescription:
      'Export or import your data to transfer between browsers or protect your records',
    exportBackup: 'Export Backup',
    exportDescription:
      'Download a JSON file containing all your accounts, trades, and psychological notes',
    importBackup: 'Import Backup',
    importDescription:
      'Load a previously exported JSON backup to restore or merge your data',
    importPreviewTitle: 'Backup Data Preview',
    importPreviewSubtitle:
      'Review the backup details before applying changes to local storage',
    importModeReplace: 'Replace current data (Overwrite)',
    importModeReplaceDesc:
      'Replaces all existing accounts, trades, and notes with the backup contents',
    importModeMerge: 'Merge with current data (Keep existing)',
    importModeMergeDesc:
      'Preserves your existing data and appends non-duplicate records from the backup',
    confirmImport: 'Confirm Import',
    cancelImport: 'Cancel',
    corruptedTitle: 'Warning: Inconsistent Local Data',
    corruptedDesc:
      'Inconsistent or corrupted data was detected in local storage. The original content has been safely quarantined to prevent data loss. You can restore a valid backup or reset the application.',
    clearQuarantine: 'Dismiss Quarantine',
    themes: {
      light: 'Light',
      dark: 'Dark',
      system: 'System',
    },
    languages: {
      es: 'Español',
      en: 'English',
    },
  },

  // ---------------------------------------------------------------------------
  // Quantitative Analytics & Simulation (Fase 5)
  // ---------------------------------------------------------------------------
  analytics: {
    title: 'Quantitative Analytics & Modeling',
    subtitle: 'Mathematical expectancy, drawdown curves, Monte Carlo & institutional simulation',
    overviewTab: 'Quantitative Overview',
    monteCarloTab: 'Monte Carlo Simulator',
    riskOfRuinTab: 'Risk of Ruin & Kelly',
    propFirmTab: 'Prop Firm Simulator',
    expectancy: 'Mathematical Expectancy',
    expectancyR: 'Expectancy in R',
    profitFactor: 'Profit Factor',
    winLossRatio: 'Win / Loss Ratio',
    recoveryFactor: 'Recovery Factor',
    recoveryTrades: 'Recovery Duration (Trades)',
    maxDrawdown: 'Max Drawdown',
    currentDrawdown: 'Current Drawdown',
    averageDrawdown: 'Average Drawdown',
    highWaterMark: 'High-Water Mark (Peak)',
    maxWinStreak: 'Max Win Streak',
    maxLossStreak: 'Max Loss Streak',
    winRate: 'Win Rate',
    lossRate: 'Loss Rate',
    breakevenRate: 'Breakeven Rate',
    sampleAdequate: 'Statistically Significant Sample',
    sampleWarning: 'Sample Size Warning',
    equityCurveTitle: 'Equity Curve vs. High-Water Mark',
    underwaterTitle: 'Underwater Drawdown Curve (%)',
    filters: 'Analysis Filters',
    allAccounts: 'All accounts',
    allAssets: 'All assets',
    allDirections: 'All directions',
    allStrategies: 'All strategies',
  },

  monteCarlo: {
    title: 'Monte Carlo Bootstrap Simulator',
    subtitle: 'Stochastic path projection based on resampling with replacement',
    parameters: 'Simulation Parameters',
    simulationsCount: 'Number of Simulations',
    tradesHorizon: 'Horizon (Trades)',
    riskModel: 'Risk Model',
    riskFixed: 'Fixed Dollar Amount ($)',
    riskPercent: 'Equity Percentage (%)',
    riskValue: 'Risk Value',
    profitTarget: 'Profit Target ($)',
    maxDrawdownLimit: 'Max Drawdown Limit (%)',
    seed: 'Deterministic Seed',
    dataSource: 'Data Source',
    useHistorical: 'Real Historical Trades',
    useCustom: 'Custom Theoretical Distribution',
    winRateCustom: 'Theoretical Win Rate (%)',
    avgWinCustom: 'Average Win ($)',
    avgLossCustom: 'Average Loss ($)',
    runButton: 'Run Monte Carlo Simulation',
    running: 'Simulating paths...',
    profitProb: 'Profit Probability',
    targetProb: 'Target Probability',
    ruinProb: 'Ruin Probability (<10% Cap)',
    drawdownBreachProb: 'DD Breach Probability',
    medianEquity: 'Median Final Equity (P50)',
    worstDrawdownP95: 'Max Drawdown (P95)',
    percentilesEvolution: 'Equity Percentiles Evolution (P5, P25, P50, P75, P95)',
    finalDistribution: 'Final Equity Frequency Distribution',
    disclaimer: 'Quantitative Disclaimer: Simulations are mathematical probabilistic models based on assumptions and bootstrap resampling. They do not constitute financial advice or guarantees.',
  },

  riskOfRuin: {
    title: 'Risk of Ruin & Kelly Criterion',
    subtitle: 'Closed-form Perry/Ralph Vince analytical formula & optimal capital sizing',
    configTitle: 'Trading System Parameters',
    winRate: 'Win Rate (%)',
    avgWin: 'Average Win ($)',
    avgLoss: 'Average Loss ($)',
    riskPerTrade: 'Risk Per Trade (%)',
    maxLossLimit: 'Tolerated Loss Limit (%)',
    analyticalRoR: 'Analytical Risk of Ruin',
    empiricalRoR: 'Empirical Risk of Ruin (MC)',
    advantage: 'Mathematical Advantage (A)',
    edge: 'System Edge (%)',
    riskUnits: 'Available Risk Units',
    recoveryProb50: '50% DD Recovery Probability',
    kellyTitle: 'Kelly Criterion Sizing',
    fullKelly: 'Full Kelly (Max Growth Risk)',
    halfKelly: 'Half Kelly (Institutional Recommended)',
    quarterKelly: 'Quarter Kelly (Conservative Approach)',
    kellyWarning: 'Note: Full Kelly maximizes asymptotic growth but generates severe drawdowns. Professional trading standardly uses Half or Quarter Kelly.',
    scenariosTitle: 'Risk Level Sensitivity Comparison',
    riskTier: 'Risk Level',
    ruinRisk: 'Risk of Ruin',
    expectedReturn: 'Expected Return',
    expectedMaxDd: 'Expected Max DD',
    recommendation: 'Recommendation',
  },

  propFirm: {
    title: 'Prop Firm Rules Simulator',
    subtitle: 'Multi-rule modeling: Static vs. Trailing drawdown & daily loss enforcement',
    configTitle: 'Challenge Rules & Settings',
    capital: 'Account Capital ($)',
    profitTarget: 'Profit Target (%)',
    dailyLossLimit: 'Daily Loss Limit (%)',
    maxDrawdown: 'Max Drawdown Limit (%)',
    drawdownType: 'Drawdown Mechanism',
    drawdownStatic: 'Static (Static Floor)',
    drawdownTrailingBalance: 'Trailing on Closed Balance',
    drawdownTrailingEquity: 'Trailing on Live Equity',
    drawdownTrailingLock: 'Trailing with Lock-In at Starting Capital',
    dailyLossType: 'Daily Loss Calculation',
    dailyBalanceBased: 'From Day Start Balance',
    dailyEquityBased: 'From Floating Equity / Intraday Peak',
    riskPerTrade: 'Risk Per Trade (%)',
    tradesPerDay: 'Average Trades Per Day',
    maxDays: 'Max Days (Horizon)',
    commissions: 'Commissions Per Trade ($)',
    runButton: 'Simulate Prop Firm Challenge',
    passProb: 'Challenge Pass Probability',
    failProb: 'Total Breach Probability',
    dailyBreachProb: 'Daily Loss Breach',
    maxDdBreachProb: 'Max Drawdown Breach',
    timeoutProb: 'Time Expired Without Decision',
    expectedDays: 'Estimated Days to Pass (Mean)',
    medianDays: 'Estimated Days to Pass (Median)',
    sampleTrajectories: 'Sample Trajectories (Passed vs. Failed)',
    breachBreakdown: 'Breach Cause Breakdown',
  },

  // ---------------------------------------------------------------------------
  // Common
  // ---------------------------------------------------------------------------
  common: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    create: 'Create',
    confirm: 'Confirm',
    close: 'Close',
    search: 'Search',
    filter: 'Filter',
    noData: 'No data',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    actions: 'Actions',
  },
} as const;

export default en;
