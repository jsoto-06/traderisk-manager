// =============================================================================
// TradeRisk Manager — Spanish Translations
// =============================================================================

const es = {
  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------
  nav: {
    dashboard: 'Panel Principal',
    accounts: 'Cuentas',
    calculator: 'Calculadora',
    trades: 'Operaciones',
    statistics: 'Estadísticas',
    analytics: 'Analítica Cuantitativa',
    journal: 'Diario',
    settings: 'Configuración',
  },

  // ---------------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------------
  dashboard: {
    balance: 'Balance',
    equity: 'Equidad',
    dailyPnl: 'PnL Diario',
    totalPnl: 'PnL Total',
    profitTarget: 'Objetivo de Ganancia',
    progress: 'Progreso',
    dailyLossLimit: 'Límite de Pérdida Diaria',
    drawdownAvailable: 'Drawdown Disponible',
    openRisk: 'Riesgo Abierto',
    todayTrades: 'Operaciones de Hoy',
    accountStatus: 'Estado de la Cuenta',
    balanceEvolution: 'Evolución del Balance',
    recentTrades: 'Operaciones Recientes',
    riskSummary: 'Resumen de Riesgo',
    demoNotice: 'Esta es una cuenta demo. Los datos se almacenan localmente en tu navegador.',
  },

  // ---------------------------------------------------------------------------
  // Accounts
  // ---------------------------------------------------------------------------
  accounts: {
    title: 'Cuentas',
    name: 'Nombre',
    type: 'Tipo',
    initialCapital: 'Capital Inicial',
    balance: 'Balance',
    equity: 'Equidad',
    currency: 'Moneda',
    profitTarget: 'Objetivo de Ganancia (%)',
    dailyLossLimit: 'Límite de Pérdida Diaria (%)',
    maxDrawdown: 'Drawdown Máximo (%)',
    drawdownType: 'Tipo de Drawdown',
    timezone: 'Zona Horaria',
    dailyResetHour: 'Hora de Reinicio Diario',
    riskPerTrade: 'Riesgo por Operación (%)',
    leverage: 'Apalancamiento',
    create: 'Crear Cuenta',
    edit: 'Editar Cuenta',
    delete: 'Eliminar Cuenta',
    accountTypes: {
      Personal: 'Personal',
      PropFirm: 'Firma de Fondeo',
      Exchange: 'Exchange',
      Broker: 'Broker',
      Demo: 'Demo',
      Custom: 'Personalizado',
    },
    drawdownTypes: {
      static: 'Estático',
      trailing: 'Trailing',
      custom: 'Personalizado',
    },
  },

  // ---------------------------------------------------------------------------
  // Calculator
  // ---------------------------------------------------------------------------
  calculator: {
    title: 'Calculadora de Riesgo',
    accountBalance: 'Balance de la Cuenta',
    riskPercent: 'Riesgo (%)',
    riskAmount: 'Riesgo (Monto)',
    entryPrice: 'Precio de Entrada',
    stopLoss: 'Stop Loss',
    takeProfit: 'Take Profit',
    direction: 'Dirección',
    long: 'Largo (Long)',
    short: 'Corto (Short)',
    commission: 'Comisión (%)',
    leverage: 'Apalancamiento',
    instrumentType: 'Tipo de Instrumento',
    calculate: 'Calcular',
    results: 'Resultados',
    riskAmount_result: 'Monto en Riesgo',
    riskPercent_result: 'Porcentaje de Riesgo',
    stopLossDistance: 'Distancia al Stop Loss',
    stopLossPercent: 'Distancia al SL (%)',
    positionSize: 'Tamaño de Posición',
    notionalValue: 'Valor Nocional',
    estimatedMargin: 'Margen Estimado',
    potentialProfit: 'Ganancia Potencial',
    potentialLoss: 'Pérdida Potencial',
    riskRewardRatio: 'Ratio Riesgo/Beneficio',
    estimatedCommissions: 'Comisiones Estimadas',
    netProfit: 'Ganancia Neta',
    netLoss: 'Pérdida Neta',
  },

  // ---------------------------------------------------------------------------
  // Trades
  // ---------------------------------------------------------------------------
  trades: {
    title: 'Operaciones',
    asset: 'Activo',
    direction: 'Dirección',
    entryPrice: 'Precio de Entrada',
    exitPrice: 'Precio de Salida',
    stopLoss: 'Stop Loss',
    takeProfit: 'Take Profit',
    size: 'Tamaño',
    openDate: 'Fecha de Apertura',
    closeDate: 'Fecha de Cierre',
    status: 'Estado',
    result: 'Resultado',
    commissions: 'Comisiones',
    strategy: 'Estrategia',
    timeframe: 'Temporalidad',
    notes: 'Notas',
    create: 'Crear Operación',
    edit: 'Editar Operación',
    delete: 'Eliminar Operación',
    statuses: {
      open: 'Abierta',
      closed: 'Cerrada',
    },
    directions: {
      long: 'Largo',
      short: 'Corto',
    },
    filterByStatus: 'Filtrar por Estado',
    filterByAsset: 'Filtrar por Activo',
    filterByStrategy: 'Filtrar por Estrategia',
  },

  // ---------------------------------------------------------------------------
  // Statistics
  // ---------------------------------------------------------------------------
  statistics: {
    title: 'Estadísticas',
    totalTrades: 'Total de Operaciones',
    winningTrades: 'Operaciones Ganadoras',
    losingTrades: 'Operaciones Perdedoras',
    winRate: 'Tasa de Acierto',
    profitFactor: 'Factor de Beneficio',
    netProfit: 'Ganancia Neta',
    averageWin: 'Ganancia Promedio',
    averageLoss: 'Pérdida Promedio',
    bestTrade: 'Mejor Operación',
    worstTrade: 'Peor Operación',
    maxWinStreak: 'Racha Ganadora Máxima',
    maxLossStreak: 'Racha Perdedora Máxima',
    currentStreak: 'Racha Actual',
    balanceHistory: 'Historial de Balance',
    streakTypes: {
      win: 'Ganadora',
      loss: 'Perdedora',
      none: 'Ninguna',
    },
  },

  // ---------------------------------------------------------------------------
  // Journal
  // ---------------------------------------------------------------------------
  journal: {
    title: 'Diario de Trading',
    date: 'Fecha',
    emotionalState: 'Estado Emocional',
    entryReason: 'Razón de Entrada',
    planCompliance: 'Cumplimiento del Plan',
    errors: 'Errores',
    overtrading: 'Sobreoperar',
    observations: 'Observaciones',
    discipline: 'Disciplina',
    create: 'Crear Entrada',
    edit: 'Editar Entrada',
    delete: 'Eliminar Entrada',
    emotionalStates: {
      calm: 'Calmado',
      anxious: 'Ansioso',
      confident: 'Seguro',
      fearful: 'Temeroso',
      euphoric: 'Eufórico',
      frustrated: 'Frustrado',
    },
    disciplineLevels: {
      1: 'Muy Baja',
      2: 'Baja',
      3: 'Media',
      4: 'Alta',
      5: 'Muy Alta',
    },
    yes: 'Sí',
    no: 'No',
  },

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------
  settings: {
    title: 'Configuración',
    language: 'Idioma',
    theme: 'Tema',
    defaultAccount: 'Cuenta por Defecto',
    dataInfo:
      'Los datos se almacenan localmente en tu navegador usando localStorage. No se envían a ningún servidor.',
    backupTitle: 'Copias de Seguridad y Recuperación',
    backupDescription:
      'Exporta o importa tus datos para transferirlos entre navegadores o proteger tu información',
    exportBackup: 'Exportar Copia de Seguridad',
    exportDescription:
      'Descarga un archivo JSON con todas tus cuentas, operaciones y notas del diario',
    importBackup: 'Importar Copia de Seguridad',
    importDescription:
      'Carga un archivo JSON generado previamente para restaurar o fusionar tus datos',
    importPreviewTitle: 'Vista Previa de la Copia de Seguridad',
    importPreviewSubtitle:
      'Verifica los datos antes de aplicar la restauración en el navegador',
    importModeReplace: 'Reemplazar datos actuales (Sobrescribir)',
    importModeReplaceDesc:
      'Sustituye todas las cuentas, operaciones y notas actuales por las de la copia',
    importModeMerge: 'Fusionar datos (Conservar actuales)',
    importModeMergeDesc:
      'Mantiene tus datos existentes y añade los registros no duplicados de la copia',
    confirmImport: 'Confirmar Importación',
    cancelImport: 'Cancelar',
    corruptedTitle: 'Atención: Datos Locales Inconsistentes',
    corruptedDesc:
      'Se detectó una inconsistencia o corrupción en el almacenamiento local. Los datos originales se han preservado en cuarentena para evitar pérdidas. Puedes importar una copia de seguridad válida para recuperar tu información.',
    clearQuarantine: 'Descartar Cuarentena',
    themes: {
      light: 'Claro',
      dark: 'Oscuro',
      system: 'Sistema',
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
    title: 'Analítica Cuantitativa y Modelado',
    subtitle: 'Expectativa matemática, curvas de drawdown, Monte Carlo y simulador institucional',
    overviewTab: 'Resumen Cuantitativo',
    monteCarloTab: 'Simulador Monte Carlo',
    riskOfRuinTab: 'Riesgo de Ruina & Kelly',
    propFirmTab: 'Simulador Prop Firm',
    expectancy: 'Expectativa Matemática',
    expectancyR: 'Expectativa en R',
    profitFactor: 'Profit Factor',
    winLossRatio: 'Ratio Ganancia / Pérdida',
    recoveryFactor: 'Factor de Recuperación',
    recoveryTrades: 'Duración Recuperación (Trades)',
    maxDrawdown: 'Drawdown Máximo',
    currentDrawdown: 'Drawdown Actual',
    averageDrawdown: 'Drawdown Promedio',
    highWaterMark: 'High-Water Mark (Pico)',
    maxWinStreak: 'Racha Ganadora Máxima',
    maxLossStreak: 'Racha Perdedora Máxima',
    winRate: 'Tasa de Acierto (Win Rate)',
    lossRate: 'Tasa de Pérdida',
    breakevenRate: 'Tasa de Breakeven',
    sampleAdequate: 'Muestra Estadísticamente Significativa',
    sampleWarning: 'Advertencia de Muestra',
    equityCurveTitle: 'Curva de Equidad vs. High-Water Mark',
    underwaterTitle: 'Curva de Drawdown Sumergido (%)',
    filters: 'Filtros de Análisis',
    allAccounts: 'Todas las cuentas',
    allAssets: 'Todos los activos',
    allDirections: 'Todas las direcciones',
    allStrategies: 'Todas las estrategias',
  },

  monteCarlo: {
    title: 'Simulador Monte Carlo Bootstrap',
    subtitle: 'Proyección estocástica de trayectorias basada en remuestreo con reemplazo',
    parameters: 'Parámetros de Simulación',
    simulationsCount: 'Número de Simulaciones',
    tradesHorizon: 'Horizonte (Operaciones)',
    riskModel: 'Modelo de Riesgo',
    riskFixed: 'Monto Fijo ($)',
    riskPercent: 'Porcentaje de Equidad (%)',
    riskValue: 'Valor de Riesgo',
    profitTarget: 'Objetivo de Ganancia ($)',
    maxDrawdownLimit: 'Límite de Drawdown (%)',
    seed: 'Semilla Determinista (Seed)',
    method: 'Método de Simulación',
    methodIid: 'Bootstrap I.I.D. (Remuestreo Individual)',
    methodBlock: 'Block Bootstrap (Bloques Consecutivos)',
    methodParamFixed: 'Paramétrico Fijo (Dos Estados)',
    methodParamVariable: 'Paramétrico Continuo (Con Dispersión)',
    blockSize: 'Tamaño de Bloque (Trades)',
    statsTitle: 'Estadísticas Empíricas Muestrales',
    stdDev: 'Desviación Estándar',
    skewness: 'Asimetría (Skewness)',
    kurtosis: 'Exceso de Curtosis',
    var95: 'Value at Risk (VaR 95%)',
    winStdDev: 'Desv. Estándar Ganancias ($)',
    lossStdDev: 'Desv. Estándar Pérdidas ($)',
    dataSource: 'Origen de Datos',
    useHistorical: 'Operaciones Históricas Reales',
    useCustom: 'Distribución Teórica Personalizada',
    winRateCustom: 'Win Rate Teórico (%)',
    avgWinCustom: 'Ganancia Media ($)',
    avgLossCustom: 'Pérdida Media ($)',
    runButton: 'Ejecutar Simulación Monte Carlo',
    running: 'Simulando trayectorias...',
    profitProb: 'Probabilidad de Ganancia',
    targetProb: 'Probabilidad de Objetivo',
    ruinProb: 'Probabilidad de Ruina (<10% Cap)',
    drawdownBreachProb: 'Probabilidad de Breach de DD',
    medianEquity: 'Equidad Mediana Final (P50)',
    worstDrawdownP95: 'Drawdown Máximo (P95)',
    percentilesEvolution: 'Evolución de Equidad por Percentiles (P5, P25, P50, P75, P95)',
    finalDistribution: 'Distribución de Frecuencia de Equidad Final',
    disclaimer: 'Aviso Cuantitativo: Las simulaciones son modelos probabilísticos matemáticos basados en supuestos y remuestreo bootstrap. No constituyen garantías ni asesoramiento financiero.',
  },

  riskOfRuin: {
    title: 'Riesgo de Ruina & Criterio de Kelly',
    subtitle: 'Formulación analítica cerrada de Perry/Ralph Vince y dimensionamiento óptimo de capital',
    configTitle: 'Parámetros del Sistema de Trading',
    winRate: 'Win Rate (%)',
    avgWin: 'Ganancia Promedio ($)',
    avgLoss: 'Pérdida Promedio ($)',
    riskPerTrade: 'Riesgo por Operación (%)',
    maxLossLimit: 'Límite de Pérdida Tolerada (%)',
    analyticalRoR: 'Riesgo de Ruina Analítico',
    asymptoticRoR: 'Ruina Asintótica (T → ∞)',
    finiteRoR: 'Ruina a Horizonte Finito',
    empiricalRoR: 'Riesgo de Ruina Empírico (MC)',
    advantage: 'Ventaja Matemática (A)',
    edge: 'Edge del Sistema (%)',
    riskUnits: 'Unidades de Riesgo Disponibles',
    recoveryProb50: 'Probabilidad de Recuperar 50% DD',
    kellyTitle: 'Dimensionamiento de Kelly Criterion',
    fullKelly: 'Full Kelly (Riesgo Teórico Máximo)',
    halfKelly: 'Half Kelly (Recomendado Institucional)',
    quarterKelly: 'Quarter Kelly (Enfoque Conservador)',
    stressedKelly: 'Kelly Conservador / Estresado',
    stressedKellyDesc: 'Escenario de estrés con degradación de Win Rate y Payoff',
    sensitivitiesTitle: 'Sensibilidad del Criterio de Kelly',
    sensitivityW: 'Sensibilidad a Variación en Win Rate (∂K/∂W)',
    sensitivityR: 'Sensibilidad a Variación en Payoff (∂K/∂R)',
    hypothesesTitle: 'Hipótesis Matemáticas y Limitaciones del Modelo',
    kellyWarning: 'Nota: Full Kelly maximiza el crecimiento asintótico pero genera volatilidad extrema. En trading profesional se suele emplear Half o Quarter Kelly.',
    scenariosTitle: 'Comparativa de Sensibilidad por Nivel de Riesgo',
    riskTier: 'Nivel de Riesgo',
    ruinRisk: 'Riesgo de Ruina',
    expectedReturn: 'Retorno Estimado',
    expectedMaxDd: 'DD Máximo Estimado',
    recommendation: 'Recomendación',
  },

  propFirm: {
    title: 'Simulador de Reglas Prop Firm',
    subtitle: 'Modelado multi-regla: Drawdown estático vs. trailing y control de pérdida diaria',
    configTitle: 'Reglas y Condiciones del Challenge',
    capital: 'Capital de la Cuenta ($)',
    profitTarget: 'Objetivo de Ganancia (%)',
    dailyLossLimit: 'Límite de Pérdida Diaria (%)',
    maxDrawdown: 'Límite de Drawdown Máximo (%)',
    drawdownType: 'Mecanismo de Drawdown',
    drawdownStatic: 'Estático (Static Floor)',
    drawdownTrailingBalance: 'Trailing sobre Balance Cerrado',
    drawdownTrailingEquity: 'Trailing sobre Equidad en Vivo',
    drawdownTrailingLock: 'Trailing con Bloqueo en Capital Inicial (Lock-In)',
    dailyLossType: 'Cálculo de Pérdida Diaria',
    dailyBalanceBased: 'Sobre Balance de Inicio del Día',
    dailyEquityBased: 'Sobre Equidad Flotante / Pico Intradía',
    enforcement: 'Régimen de Pérdida Diaria',
    enforceHardBreach: 'Hard Breach (Fallo Definitivo)',
    enforceSoftPause: 'Soft Pause (Pausa Intradía)',
    riskPerTrade: 'Riesgo por Operación (%)',
    tradesPerDay: 'Operaciones Promedio por Día',
    maxDays: 'Días Máximos (Horizonte)',
    commissions: 'Comisiones por Trade ($)',
    runButton: 'Simular Challenge Prop Firm',
    passProb: 'Probabilidad de Superar Challenge',
    failProb: 'Probabilidad Total de Infracción (Breach)',
    dailyBreachProb: 'Breach por Pérdida Diaria',
    maxDdBreachProb: 'Breach por Drawdown Máximo',
    timeoutProb: 'Tiempo Agotado sin Decisión',
    expectedDays: 'Días Estimados para Aprobar (Media)',
    medianDays: 'Días Estimados (Mediana)',
    sampleTrajectories: 'Muestra de Trayectorias (Aprobadas vs. Fallidas)',
    breachBreakdown: 'Desglose de Causas de Suspensión',
  },

  // ---------------------------------------------------------------------------
  // Common
  // ---------------------------------------------------------------------------
  common: {
    save: 'Guardar',
    cancel: 'Cancelar',
    delete: 'Eliminar',
    edit: 'Editar',
    create: 'Crear',
    confirm: 'Confirmar',
    close: 'Cerrar',
    search: 'Buscar',
    filter: 'Filtrar',
    noData: 'Sin datos',
    loading: 'Cargando...',
    error: 'Error',
    success: 'Éxito',
    actions: 'Acciones',
  },
} as const;

export default es;

type DeepString<T> = {
  [K in keyof T]: T[K] extends object ? DeepString<T[K]> : string;
};

export type Translations = DeepString<typeof es>;
