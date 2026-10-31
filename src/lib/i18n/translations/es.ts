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
