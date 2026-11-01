// =============================================================================
// TradeRisk Manager — Institutional CSV Report Generator
// =============================================================================

import type { Trade } from '@/lib/types';
import type {
  ReportQuantitativeData,
  CsvExportOptions,
} from './types';

/**
 * Escapes a cell according to RFC 4180:
 * - If value contains comma, double quote, or newline, wraps in double quotes and doubles internal quotes.
 */
export function escapeCsvCell(val: unknown, delimiter: string = ','): string {
  if (val == null) return '';
  const str = String(val);
  if (
    str.includes(delimiter) ||
    str.includes('"') ||
    str.includes('\n') ||
    str.includes('\r')
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Formats a number with standard decimal places.
 */
function fmtNum(n: number | null | undefined, decimals: number = 2): string {
  if (n == null || isNaN(n)) return '';
  return Number(n).toFixed(decimals);
}

/**
 * Generates an RFC 4180 compliant CSV string containing the complete Trade Ledger.
 */
export function generateTradeLedgerCsv(
  trades: Trade[],
  options?: CsvExportOptions,
): string {
  const isEs = options?.locale !== 'en';
  const delim = options?.delimiter || ',';
  const includeBom = options?.includeBom ?? true;

  const headers = isEs
    ? [
        'ID Operación',
        'Fecha Apertura',
        'Fecha Cierre',
        'Activo',
        'Dirección',
        'Estado',
        'Tamaño',
        'Precio Entrada',
        'Precio Salida',
        'Stop Loss',
        'Take Profit',
        'Resultado Bruto',
        'Comisiones',
        'Resultado Neto',
        'Estrategia',
        'Temporalidad',
        'Notas',
      ]
    : [
        'Trade ID',
        'Open Date',
        'Close Date',
        'Asset',
        'Direction',
        'Status',
        'Size',
        'Entry Price',
        'Exit Price',
        'Stop Loss',
        'Take Profit',
        'Gross PnL',
        'Commissions',
        'Net PnL',
        'Strategy',
        'Timeframe',
        'Notes',
      ];

  const rows: string[] = [];
  rows.push(headers.map((h) => escapeCsvCell(h, delim)).join(delim));

  // Sort chronologically ascending
  const sorted = [...trades].sort((a, b) => {
    const dateA = new Date(a.closeDate || a.openDate || a.createdAt || 0).getTime();
    const dateB = new Date(b.closeDate || b.openDate || b.createdAt || 0).getTime();
    return dateA - dateB;
  });

  for (const t of sorted) {
    const rawResult = t.result != null ? Number(t.result) : null;
    const comms = Number(t.commissions || 0);
    const netResult = rawResult != null ? rawResult - comms : null;

    const row = [
      escapeCsvCell(t.id, delim),
      escapeCsvCell(t.openDate, delim),
      escapeCsvCell(t.closeDate || '', delim),
      escapeCsvCell(t.asset, delim),
      escapeCsvCell(t.direction.toUpperCase(), delim),
      escapeCsvCell(t.status.toUpperCase(), delim),
      escapeCsvCell(fmtNum(t.size, 4), delim),
      escapeCsvCell(fmtNum(t.entryPrice, 4), delim),
      escapeCsvCell(t.exitPrice != null ? fmtNum(t.exitPrice, 4) : '', delim),
      escapeCsvCell(fmtNum(t.stopLoss, 4), delim),
      escapeCsvCell(t.takeProfit ? fmtNum(t.takeProfit, 4) : '', delim),
      escapeCsvCell(rawResult != null ? fmtNum(rawResult, 2) : '', delim),
      escapeCsvCell(fmtNum(comms, 2), delim),
      escapeCsvCell(netResult != null ? fmtNum(netResult, 2) : '', delim),
      escapeCsvCell(t.strategy || '', delim),
      escapeCsvCell(t.timeframe || '', delim),
      escapeCsvCell(t.notes || '', delim),
    ];
    rows.push(row.join(delim));
  }

  const csvContent = rows.join('\r\n');
  return includeBom ? `\uFEFF${csvContent}` : csvContent;
}

/**
 * Generates an institutional multi-section Executive Summary CSV.
 */
export function generateExecutiveSummaryCsv(
  data: ReportQuantitativeData,
  options?: CsvExportOptions,
): string {
  const isEs = options?.locale !== 'en';
  const delim = options?.delimiter || ',';
  const includeBom = options?.includeBom ?? true;

  const { metadata, statistics, expectancy, drawdown, propFirmStatus } = data;
  const acc = metadata.account;
  const netPnL = acc.balance - acc.initialCapital;
  const netPnLPercent = acc.initialCapital > 0 ? (netPnL / acc.initialCapital) * 100 : 0;

  const rows: string[] = [];

  const addSection = (title: string) => {
    rows.push('');
    rows.push(escapeCsvCell(`=== ${title} ===`, delim));
  };

  const addPair = (key: string, val: unknown) => {
    rows.push(`${escapeCsvCell(key, delim)}${delim}${escapeCsvCell(val, delim)}`);
  };

  // Header
  rows.push(escapeCsvCell(isEs ? 'TRADERISK MANAGER — INFORME CUANTITATIVO AUDITADO' : 'TRADERISK MANAGER — AUDITED QUANTITATIVE REPORT', delim));
  addPair(isEs ? 'Fecha de Emisión' : 'Generated Date', metadata.generatedAt);
  addPair(isEs ? 'Cuenta' : 'Account Name', acc.name);
  addPair(isEs ? 'Tipo de Cuenta' : 'Account Type', acc.type);
  addPair(isEs ? 'Moneda' : 'Currency', acc.currency);
  addPair(isEs ? 'Capital Inicial' : 'Initial Capital', fmtNum(acc.initialCapital, 2));
  addPair(isEs ? 'Balance Actual' : 'Current Balance', fmtNum(acc.balance, 2));
  addPair(isEs ? 'Equidad Actual' : 'Current Equity', fmtNum(acc.equity, 2));
  addPair(isEs ? 'PnL Neto Total ($)' : 'Total Net PnL ($)', fmtNum(netPnL, 2));
  addPair(isEs ? 'PnL Neto Total (%)' : 'Total Net PnL (%)', `${fmtNum(netPnLPercent, 2)}%`);

  // Section: Core Performance
  addSection(isEs ? 'RENDIMIENTO DE TRADING Y ESTADÍSTICAS' : 'TRADING PERFORMANCE & STATISTICS');
  addPair(isEs ? 'Total Operaciones' : 'Total Trades', statistics.totalTrades);
  addPair(isEs ? 'Operaciones Ganadoras' : 'Winning Trades', statistics.winningTrades);
  addPair(isEs ? 'Operaciones Perdedoras' : 'Losing Trades', statistics.losingTrades);
  addPair(isEs ? 'Tasa de Acierto (Win Rate)' : 'Win Rate', `${fmtNum(statistics.winRate, 2)}%`);
  addPair(isEs ? 'Factor de Beneficio (Profit Factor)' : 'Profit Factor', statistics.profitFactor === Infinity ? 'Infinity' : fmtNum(statistics.profitFactor, 2));
  addPair(isEs ? 'Beneficio Neto ($)' : 'Net Profit ($)', fmtNum(statistics.netProfit, 2));
  addPair(isEs ? 'Beneficio Bruto ($)' : 'Gross Profit ($)', fmtNum(expectancy.grossProfit, 2));
  addPair(isEs ? 'Pérdida Bruta ($)' : 'Gross Loss ($)', fmtNum(expectancy.grossLoss, 2));
  addPair(isEs ? 'Comisiones Totales ($)' : 'Total Commissions ($)', fmtNum(expectancy.totalCommissions, 2));
  addPair(isEs ? 'Ganancia Media ($)' : 'Average Win ($)', fmtNum(statistics.averageWin, 2));
  addPair(isEs ? 'Pérdida Media ($)' : 'Average Loss ($)', fmtNum(statistics.averageLoss, 2));
  addPair(isEs ? 'Mejor Operación ($)' : 'Best Trade ($)', fmtNum(statistics.bestTrade, 2));
  addPair(isEs ? 'Peor Operación ($)' : 'Worst Trade ($)', fmtNum(statistics.worstTrade, 2));
  addPair(isEs ? 'Racha Máxima Ganadora' : 'Max Win Streak', statistics.maxWinStreak);
  addPair(isEs ? 'Racha Máxima Perdedora' : 'Max Loss Streak', statistics.maxLossStreak);

  // Section: Mathematical Expectancy
  addSection(isEs ? 'EXPECTATIVA MATEMÁTICA Y CONSISTENCIA' : 'MATHEMATICAL EXPECTANCY & CONSISTENCY');
  addPair(isEs ? 'Expectativa Monetaria ($ / trade)' : 'Expectancy ($ / trade)', fmtNum(expectancy.expectancy, 2));
  addPair(isEs ? 'Expectativa (R-Multiple)' : 'Expectancy (R-Multiple)', `${expectancy.expectancyR >= 0 ? '+' : ''}${fmtNum(expectancy.expectancyR, 2)} R`);
  addPair(isEs ? 'Ratio Beneficio / Pérdida' : 'Win / Loss Ratio', fmtNum(expectancy.winLossRatio, 2));
  addPair(isEs ? 'Operaciones Breakeven' : 'Breakeven Trades', `${expectancy.breakevenTrades} (${fmtNum(expectancy.breakevenRate, 1)}%)`);
  addPair(isEs ? 'Evaluación de Muestra' : 'Sample Size Evaluation', expectancy.isSampleSizeAdequate ? (isEs ? 'Muestra estadísticamente adecuada' : 'Statistically adequate sample') : (isEs ? 'Muestra insuficiente' : 'Small sample size'));

  // Section: Drawdown & Recovery
  addSection(isEs ? 'PRESERVACIÓN DE CAPITAL Y DRAWDOWN' : 'CAPITAL PRESERVATION & DRAWDOWN');
  const hwm = drawdown.drawdownSeries.length > 0 ? Math.max(...drawdown.drawdownSeries.map((s) => s.peak)) : acc.initialCapital;
  addPair(isEs ? 'High-Water Mark (Pico Histórico)' : 'High-Water Mark (Peak)', fmtNum(hwm, 2));
  addPair(isEs ? 'Drawdown Máximo ($)' : 'Max Drawdown ($)', fmtNum(drawdown.maxDrawdownAmount, 2));
  addPair(isEs ? 'Drawdown Máximo (%)' : 'Max Drawdown (%)', `${fmtNum(drawdown.maxDrawdownPercent, 2)}%`);
  addPair(isEs ? 'Drawdown Actual ($)' : 'Current Drawdown ($)', fmtNum(drawdown.currentDrawdownAmount, 2));
  addPair(isEs ? 'Drawdown Actual (%)' : 'Current Drawdown (%)', `${fmtNum(drawdown.currentDrawdownPercent, 2)}%`);
  addPair(isEs ? 'Factor de Recuperación' : 'Recovery Factor', drawdown.recoveryFactor === Infinity ? 'Infinity' : fmtNum(drawdown.recoveryFactor, 2));
  addPair(isEs ? 'Trades Máximos Bajo Agua (Recuperación)' : 'Max Underwater Recovery Trades', drawdown.recoveryTrades);

  // Section: Prop Firm Rules (if applicable)
  if (propFirmStatus) {
    addSection(isEs ? 'REGLAS PROP FIRM Y CONTROL DE LÍMITES' : 'PROP FIRM CHALLENGE & RISK LIMITS');
    addPair(isEs ? 'Modelo de Drawdown' : 'Drawdown Model', propFirmStatus.drawdownResult.drawdownType.toUpperCase());
    addPair(isEs ? 'Piso de Drawdown (Floor)' : 'Drawdown Floor', fmtNum(propFirmStatus.drawdownResult.floor, 2));
    addPair(isEs ? 'Distancia al Piso ($)' : 'Distance to Floor ($)', fmtNum(propFirmStatus.drawdownResult.remainingDrawdownAmount, 2));
    addPair(isEs ? 'Límite de Pérdida Diaria ($)' : 'Daily Loss Limit ($)', fmtNum(propFirmStatus.dailyLossResult.dailyLimitAmount, 2));
    addPair(isEs ? 'Pérdida Neta Hoy ($)' : 'Net Loss Today ($)', fmtNum(propFirmStatus.dailyLossResult.totalLossToday, 2));
    addPair(isEs ? 'Pérdida Diaria Restante ($)' : 'Remaining Daily Loss ($)', fmtNum(propFirmStatus.dailyLossResult.remainingDailyLossAmount, 2));
    addPair(isEs ? 'Objetivo de Ganancia ($)' : 'Profit Target ($)', fmtNum(propFirmStatus.profitTargetResult.targetProfitAmount, 2));
    addPair(isEs ? 'Progreso hacia el Objetivo' : 'Profit Target Progress', `${fmtNum(propFirmStatus.profitTargetResult.progressPercent, 2)}%`);
    addPair(isEs ? 'Estado de Infracción' : 'Breach Status', propFirmStatus.drawdownResult.isBreached || propFirmStatus.dailyLossResult.isBreached ? (isEs ? 'REGLA INCUMPLIDA' : 'RULE BREACHED') : (isEs ? 'EN CUMPLIMIENTO' : 'IN COMPLIANCE'));
  }

  const csvContent = rows.join('\r\n');
  return includeBom ? `\uFEFF${csvContent}` : csvContent;
}

/**
 * Triggers a client-side file download for the CSV string in the browser.
 */
export function downloadCsvFile(content: string, filename: string): void {
  if (typeof window === 'undefined') return;

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
