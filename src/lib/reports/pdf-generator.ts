// =============================================================================
// TradeRisk Manager — Institutional PDF Report Generator (jsPDF)
// =============================================================================

import { jsPDF } from 'jspdf';
import type {
  ReportQuantitativeData,
  PdfExportOptions,
} from './types';

/**
 * Palette constants matching TradeRisk Manager brand identity.
 */
const PALETTE = {
  headerBg: [10, 17, 40] as [number, number, number], // #0A1128
  accentCyan: [0, 240, 255] as [number, number, number], // #00F0FF
  cardBg: [248, 250, 252] as [number, number, number], // #F8FAFC
  borderDark: [226, 232, 240] as [number, number, number], // #E2E8F0
  textPrimary: [15, 23, 42] as [number, number, number], // #0F172A
  textSecondary: [100, 116, 139] as [number, number, number], // #64748B
  emerald: [16, 185, 129] as [number, number, number], // #10B981
  ruby: [239, 68, 68] as [number, number, number], // #EF4444
};

function fmt(n: number | null | undefined, decimals: number = 2): string {
  if (n == null || isNaN(n)) return '0.00';
  return Number(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtCurr(n: number | null | undefined, currency: string = 'USD'): string {
  const symbol = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
  const prefix = n != null && n < 0 ? '-' : '';
  const abs = n != null ? Math.abs(n) : 0;
  return `${prefix}${symbol}${fmt(abs, 2)}`;
}

/**
 * Generates an institutional-grade PDF document containing full quantitative metrics,
 * drawdown analytics, expectancy metrics, prop firm challenge status, and trade ledger.
 */
export function generateQuantitativePdfReport(
  data: ReportQuantitativeData,
  options?: PdfExportOptions,
): jsPDF {
  const isEs = options?.locale !== 'en';
  const includeTradeLog = options?.includeTradeLog ?? true;
  const maxTrades = options?.maxTradesInLog ?? 50;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4', // 210 x 297 mm
  });

  const { metadata, statistics, expectancy, drawdown, propFirmStatus, trades } = data;
  const acc = metadata.account;
  const currency = acc.currency || 'USD';
  const netPnL = acc.balance - acc.initialCapital;
  const netPnLPercent = acc.initialCapital > 0 ? (netPnL / acc.initialCapital) * 100 : 0;

  // ---------------------------------------------------------------------------
  // Page 1: Header Banner
  // ---------------------------------------------------------------------------
  doc.setFillColor(...PALETTE.headerBg);
  doc.rect(0, 0, 210, 36, 'F');

  // Accent line
  doc.setDrawColor(...PALETTE.accentCyan);
  doc.setLineWidth(0.8);
  doc.line(0, 36, 210, 36);

  // Brand title
  doc.setTextColor(245, 247, 250);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('TRADERISK MANAGER', 14, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 240, 255);
  doc.text(
    isEs
      ? 'INFORME CUANTITATIVO DE GESTIÓN DE RIESGO Y RENDIMIENTO'
      : 'QUANTITATIVE RISK MANAGEMENT & PERFORMANCE REPORT',
    14,
    21,
  );

  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `${isEs ? 'Fecha de Emisión:' : 'Generated:'} ${metadata.generatedAt.slice(0, 19).replace('T', ' ')} UTC  ·  v${metadata.version}`,
    14,
    28,
  );

  // Right side: Account Info
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(245, 247, 250);
  doc.text(acc.name, 196, 15, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `${acc.type}  ·  ${acc.currency}  ·  Lev: ${acc.leverage}x  ·  Risk: ${acc.riskPerTrade}%`,
    196,
    21,
    { align: 'right' },
  );

  doc.text(
    isEs ? 'Auditoría Cuantitativa y Ledger Reconciliado' : 'Reconciled Ledger & Quantitative Audit',
    196,
    28,
    { align: 'right' },
  );

  // ---------------------------------------------------------------------------
  // KPI Cards (4 columns)
  // ---------------------------------------------------------------------------
  const startY = 42;
  const cardW = 43.5;
  const cardH = 22;
  const cardGap = 2.5;

  const drawCard = (x: number, title: string, mainVal: string, subVal: string, isGreen?: boolean, isRed?: boolean) => {
    doc.setFillColor(...PALETTE.cardBg);
    doc.setDrawColor(...PALETTE.borderDark);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, startY, cardW, cardH, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...PALETTE.textSecondary);
    doc.text(title.toUpperCase(), x + 3, startY + 5.5);

    doc.setFontSize(10.5);
    if (isGreen) doc.setTextColor(...PALETTE.emerald);
    else if (isRed) doc.setTextColor(...PALETTE.ruby);
    else doc.setTextColor(...PALETTE.textPrimary);
    doc.text(mainVal, x + 3, startY + 12.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...PALETTE.textSecondary);
    doc.text(subVal, x + 3, startY + 18);
  };

  // Card 1: Balance & Equity
  drawCard(
    14,
    isEs ? 'Balance / PnL Neto' : 'Balance / Net PnL',
    fmtCurr(acc.balance, currency),
    `${netPnL >= 0 ? '+' : ''}${fmtCurr(netPnL, currency)} (${netPnLPercent.toFixed(2)}%)`,
    netPnL >= 0,
    netPnL < 0,
  );

  // Card 2: Win Rate & Profit Factor
  drawCard(
    14 + (cardW + cardGap),
    isEs ? 'Win Rate / Profit Factor' : 'Win Rate / Profit Factor',
    `${statistics.winRate.toFixed(1)}%`,
    `PF: ${statistics.profitFactor === Infinity ? '∞' : fmt(statistics.profitFactor, 2)} (${statistics.winningTrades}W / ${statistics.losingTrades}L)`,
    statistics.winRate >= 50,
    statistics.winRate < 50,
  );

  // Card 3: Expectancy
  drawCard(
    14 + (cardW + cardGap) * 2,
    isEs ? 'Expectativa Matemática' : 'Mathematical Expectancy',
    fmtCurr(expectancy.expectancy, currency),
    `${expectancy.expectancyR >= 0 ? '+' : ''}${fmt(expectancy.expectancyR, 2)} R / trade`,
    expectancy.expectancy >= 0,
    expectancy.expectancy < 0,
  );

  // Card 4: Max Drawdown
  drawCard(
    14 + (cardW + cardGap) * 3,
    isEs ? 'Drawdown Máximo' : 'Max Drawdown',
    `${drawdown.maxDrawdownPercent.toFixed(2)}%`,
    `${fmtCurr(drawdown.maxDrawdownAmount, currency)} (Recov: ${drawdown.recoveryFactor === Infinity ? '∞' : fmt(drawdown.recoveryFactor, 2)})`,
    false,
    drawdown.maxDrawdownPercent > 5,
  );

  // ---------------------------------------------------------------------------
  // Section 1: Rendimiento y Estadísticas Detalladas
  // ---------------------------------------------------------------------------
  let currentY = startY + cardH + 7;

  const drawSectionHeader = (y: number, title: string) => {
    doc.setFillColor(...PALETTE.headerBg);
    doc.rect(14, y, 182, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 240, 255);
    doc.text(title.toUpperCase(), 17, y + 4.2);
    return y + 6;
  };

  currentY = drawSectionHeader(
    currentY,
    isEs ? '1. Rendimiento Global de Trading y Métricas de Libro Mayor' : '1. Trading Performance & Ledger Metrics',
  );

  const drawTableGrid = (y: number, rows: [string, string, string, string][]) => {
    let yPos = y;
    const colW1 = 50;
    const colW2 = 41;
    const rowH = 5.2;

    doc.setFontSize(7);
    for (let i = 0; i < rows.length; i++) {
      const [k1, v1, k2, v2] = rows[i];
      if (i % 2 === 0) {
        doc.setFillColor(250, 250, 252);
        doc.rect(14, yPos, 182, rowH, 'F');
      }
      doc.setDrawColor(...PALETTE.borderDark);
      doc.setLineWidth(0.15);
      doc.line(14, yPos + rowH, 196, yPos + rowH);

      // Col 1
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...PALETTE.textSecondary);
      doc.text(k1, 16, yPos + 3.8);

      // Col 2
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...PALETTE.textPrimary);
      doc.text(v1, 14 + colW1 + colW2 - 3, yPos + 3.8, { align: 'right' });

      // Col 3
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...PALETTE.textSecondary);
      doc.text(k2, 14 + colW1 + colW2 + 3, yPos + 3.8);

      // Col 4
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...PALETTE.textPrimary);
      doc.text(v2, 196 - 3, yPos + 3.8, { align: 'right' });

      yPos += rowH;
    }
    return yPos;
  };

  const performanceRows: [string, string, string, string][] = [
    [
      isEs ? 'Capital Inicial:' : 'Initial Capital:',
      fmtCurr(acc.initialCapital, currency),
      isEs ? 'Beneficio Bruto:' : 'Gross Profit:',
      fmtCurr(expectancy.grossProfit, currency),
    ],
    [
      isEs ? 'Balance Actual:' : 'Current Balance:',
      fmtCurr(acc.balance, currency),
      isEs ? 'Pérdida Bruta:' : 'Gross Loss:',
      fmtCurr(expectancy.grossLoss, currency),
    ],
    [
      isEs ? 'PnL Neto Realizado:' : 'Net Realized PnL:',
      fmtCurr(netPnL, currency),
      isEs ? 'Comisiones Totales:' : 'Total Commissions:',
      fmtCurr(expectancy.totalCommissions, currency),
    ],
    [
      isEs ? 'Total Operaciones:' : 'Total Trades:',
      String(statistics.totalTrades),
      isEs ? 'Ganancia Media:' : 'Average Win:',
      fmtCurr(statistics.averageWin, currency),
    ],
    [
      isEs ? 'Operaciones Ganadoras:' : 'Winning Trades:',
      `${statistics.winningTrades} (${statistics.winRate.toFixed(1)}%)`,
      isEs ? 'Pérdida Media:' : 'Average Loss:',
      fmtCurr(statistics.averageLoss, currency),
    ],
    [
      isEs ? 'Operaciones Perdedoras:' : 'Losing Trades:',
      `${statistics.losingTrades} (${statistics.totalTrades > 0 ? (statistics.losingTrades / statistics.totalTrades * 100).toFixed(1) : 0}%)`,
      isEs ? 'Ratio Win / Loss:' : 'Win / Loss Ratio:',
      fmt(expectancy.winLossRatio, 2),
    ],
    [
      isEs ? 'Mejor Operación (Neto):' : 'Best Trade (Net):',
      fmtCurr(statistics.bestTrade, currency),
      isEs ? 'Racha Máx. Ganadora:' : 'Max Win Streak:',
      `${statistics.maxWinStreak} trades`,
    ],
    [
      isEs ? 'Peor Operación (Neto):' : 'Worst Trade (Net):',
      fmtCurr(statistics.worstTrade, currency),
      isEs ? 'Racha Máx. Perdedora:' : 'Max Loss Streak:',
      `${statistics.maxLossStreak} trades`,
    ],
  ];

  currentY = drawTableGrid(currentY, performanceRows);

  // ---------------------------------------------------------------------------
  // Section 2: Expectativa Cuantitativa y Preservación de Capital
  // ---------------------------------------------------------------------------
  currentY += 4;
  currentY = drawSectionHeader(
    currentY,
    isEs ? '2. Expectativa Cuantitativa, Consistencia y Drawdown Institucional' : '2. Quantitative Expectancy, Consistency & Drawdown',
  );

  const hwm = drawdown.drawdownSeries.length > 0
    ? Math.max(...drawdown.drawdownSeries.map((s) => s.peak))
    : acc.initialCapital;

  const quantRows: [string, string, string, string][] = [
    [
      isEs ? 'Expectativa Monetaria:' : 'Expectancy ($ / trade):',
      `${fmtCurr(expectancy.expectancy, currency)} / trade`,
      isEs ? 'High-Water Mark (Pico):' : 'High-Water Mark (Peak):',
      fmtCurr(hwm, currency),
    ],
    [
      isEs ? 'Expectativa en R-Multiples:' : 'Expectancy in R-Multiples:',
      `${expectancy.expectancyR >= 0 ? '+' : ''}${fmt(expectancy.expectancyR, 2)} R`,
      isEs ? 'Drawdown Máximo:' : 'Max Drawdown:',
      `${drawdown.maxDrawdownPercent.toFixed(2)}% (${fmtCurr(drawdown.maxDrawdownAmount, currency)})`,
    ],
    [
      isEs ? 'Operaciones Breakeven:' : 'Breakeven Trades:',
      `${expectancy.breakevenTrades} (${expectancy.breakevenRate.toFixed(1)}%)`,
      isEs ? 'Drawdown Actual:' : 'Current Drawdown:',
      `${drawdown.currentDrawdownPercent.toFixed(2)}% (${fmtCurr(drawdown.currentDrawdownAmount, currency)})`,
    ],
    [
      isEs ? 'Suficiencia de Muestra:' : 'Sample Size Evaluation:',
      expectancy.isSampleSizeAdequate ? (isEs ? 'Muestra Adecuada (>=10)' : 'Adequate (>=10)') : (isEs ? 'Muestra Insuficiente (<10)' : 'Small sample (<10)'),
      isEs ? 'Factor de Recuperación:' : 'Recovery Factor:',
      drawdown.recoveryFactor === Infinity ? 'Infinity' : fmt(drawdown.recoveryFactor, 2),
    ],
  ];

  currentY = drawTableGrid(currentY, quantRows);

  // ---------------------------------------------------------------------------
  // Section 3: Reglas Prop Firm y Control de Límites
  // ---------------------------------------------------------------------------
  if (propFirmStatus) {
    currentY += 4;
    currentY = drawSectionHeader(
      currentY,
      isEs ? '3. Control de Reglas Institucionales y Desafío Prop Firm' : '3. Prop Firm Challenge & Capital Rules Compliance',
    );

    const propRows: [string, string, string, string][] = [
      [
        isEs ? 'Modelo de Drawdown:' : 'Drawdown Model:',
        propFirmStatus.drawdownResult.drawdownType.toUpperCase(),
        isEs ? 'Límite Pérdida Diaria:' : 'Daily Loss Limit:',
        `${acc.dailyLossLimit}% (${fmtCurr(propFirmStatus.dailyLossResult.dailyLimitAmount, currency)})`,
      ],
      [
        isEs ? 'Piso de Drawdown (Floor):' : 'Drawdown Floor:',
        fmtCurr(propFirmStatus.drawdownResult.floor, currency),
        isEs ? 'Pérdida Neta Hoy:' : 'Today Net Loss:',
        fmtCurr(propFirmStatus.dailyLossResult.totalLossToday, currency),
      ],
      [
        isEs ? 'Distancia al Piso ($):' : 'Distance to Floor ($):',
        fmtCurr(propFirmStatus.drawdownResult.remainingDrawdownAmount, currency),
        isEs ? 'Pérdida Diaria Restante:' : 'Remaining Daily Loss:',
        fmtCurr(propFirmStatus.dailyLossResult.remainingDailyLossAmount, currency),
      ],
      [
        isEs ? 'Objetivo de Ganancia:' : 'Profit Target:',
        `${acc.profitTarget}% (${fmtCurr(propFirmStatus.profitTargetResult.targetProfitAmount, currency)})`,
        isEs ? 'Progreso hacia el Objetivo:' : 'Profit Target Progress:',
        `${propFirmStatus.profitTargetResult.progressPercent.toFixed(1)}% (${fmtCurr(propFirmStatus.profitTargetResult.currentProfitAmount, currency)})`,
      ],
      [
        isEs ? 'Estado de Regla Drawdown:' : 'Drawdown Rule Status:',
        propFirmStatus.drawdownResult.isBreached ? (isEs ? 'INCUMPLIDA' : 'BREACHED') : (isEs ? 'EN CUMPLIMIENTO' : 'IN COMPLIANCE'),
        isEs ? 'Estado de Pérdida Diaria:' : 'Daily Loss Rule Status:',
        propFirmStatus.dailyLossResult.isBreached ? (isEs ? 'INCUMPLIDA' : 'BREACHED') : (isEs ? 'EN CUMPLIMIENTO' : 'IN COMPLIANCE'),
      ],
    ];

    drawTableGrid(currentY, propRows);
  }

  // ---------------------------------------------------------------------------
  // Page 1 Footer
  // ---------------------------------------------------------------------------
  const addFooter = (docInstance: jsPDF, pageNum: number, totalPages: number) => {
    docInstance.setDrawColor(...PALETTE.borderDark);
    docInstance.setLineWidth(0.3);
    docInstance.line(14, 285, 196, 285);

    docInstance.setFont('helvetica', 'normal');
    docInstance.setFontSize(6.5);
    docInstance.setTextColor(...PALETTE.textSecondary);
    docInstance.text(
      isEs
        ? 'TradeRisk Manager · Informe Cuantitativo Auditado · Documento Confidencial'
        : 'TradeRisk Manager · Audited Quantitative Report · Confidential Document',
      14,
      289,
    );

    docInstance.text(
      `${isEs ? 'Página' : 'Page'} ${pageNum} ${isEs ? 'de' : 'of'} ${totalPages}`,
      196,
      289,
      { align: 'right' },
    );
  };

  // ---------------------------------------------------------------------------
  // Page 2: Trade Ledger Table (if requested and trades exist)
  // ---------------------------------------------------------------------------
  const closedTrades = trades
    .filter((t) => t.status === 'closed' && t.result != null)
    .sort((a, b) => new Date(b.closeDate || b.openDate).getTime() - new Date(a.closeDate || a.openDate).getTime())
    .slice(0, maxTrades);

  if (includeTradeLog && closedTrades.length > 0) {
    doc.addPage();

    // Page 2 Header Banner (mini)
    doc.setFillColor(...PALETTE.headerBg);
    doc.rect(0, 0, 210, 18, 'F');
    doc.setDrawColor(...PALETTE.accentCyan);
    doc.setLineWidth(0.6);
    doc.line(0, 18, 210, 18);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(245, 247, 250);
    doc.text('TRADERISK MANAGER — AUDIT TRAIL / TRADE LEDGER', 14, 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 240, 255);
    doc.text(
      `${acc.name} (${acc.currency}) · ${isEs ? 'Últimas' : 'Last'} ${closedTrades.length} ${isEs ? 'operaciones cerradas' : 'closed trades'}`,
      196,
      11,
      { align: 'right' },
    );

    let tableY = 24;

    // Table Header
    doc.setFillColor(241, 245, 249);
    doc.rect(14, tableY, 182, 6, 'F');
    doc.setDrawColor(...PALETTE.borderDark);
    doc.setLineWidth(0.2);
    doc.rect(14, tableY, 182, 6, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...PALETTE.textPrimary);

    const colX = {
      date: 16,
      asset: 40,
      dir: 62,
      size: 78,
      entry: 96,
      exit: 116,
      gross: 136,
      fees: 156,
      net: 176,
    };

    doc.text(isEs ? 'Fecha' : 'Date', colX.date, tableY + 4);
    doc.text(isEs ? 'Activo' : 'Asset', colX.asset, tableY + 4);
    doc.text(isEs ? 'Dir.' : 'Dir.', colX.dir, tableY + 4);
    doc.text(isEs ? 'Tamaño' : 'Size', colX.size, tableY + 4);
    doc.text(isEs ? 'Entrada' : 'Entry', colX.entry, tableY + 4);
    doc.text(isEs ? 'Salida' : 'Exit', colX.exit, tableY + 4);
    doc.text(isEs ? 'Bruto ($)' : 'Gross ($)', colX.gross, tableY + 4);
    doc.text(isEs ? 'Com. ($)' : 'Fees ($)', colX.fees, tableY + 4);
    doc.text(isEs ? 'Neto ($)' : 'Net ($)', colX.net, tableY + 4);

    tableY += 6;
    const rowH = 4.8;

    let sumGross = 0;
    let sumFees = 0;
    let sumNet = 0;

    for (let i = 0; i < closedTrades.length; i++) {
      if (tableY + rowH > 275) {
        // Page break if too many trades
        doc.addPage();
        tableY = 20;
      }

      const t = closedTrades[i];
      const rawResult = Number(t.result || 0);
      const comms = Number(t.commissions || 0);
      const net = rawResult - comms;

      sumGross += rawResult;
      sumFees += comms;
      sumNet += net;

      if (i % 2 === 0) {
        doc.setFillColor(252, 253, 254);
        doc.rect(14, tableY, 182, rowH, 'F');
      }
      doc.setDrawColor(...PALETTE.borderDark);
      doc.setLineWidth(0.1);
      doc.line(14, tableY + rowH, 196, tableY + rowH);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...PALETTE.textPrimary);

      const dateStr = (t.closeDate || t.openDate).slice(0, 10);
      doc.text(dateStr, colX.date, tableY + 3.2);
      doc.text(t.asset, colX.asset, tableY + 3.2);

      // Direction badge
      if (t.direction === 'long') {
        doc.setTextColor(...PALETTE.emerald);
        doc.text('LONG', colX.dir, tableY + 3.2);
      } else {
        doc.setTextColor(...PALETTE.ruby);
        doc.text('SHORT', colX.dir, tableY + 3.2);
      }

      doc.setTextColor(...PALETTE.textPrimary);
      doc.text(fmt(t.size, 2), colX.size, tableY + 3.2);
      doc.text(fmt(t.entryPrice, 2), colX.entry, tableY + 3.2);
      doc.text(t.exitPrice != null ? fmt(t.exitPrice, 2) : '-', colX.exit, tableY + 3.2);

      doc.text(fmt(rawResult, 2), colX.gross, tableY + 3.2);
      doc.text(fmt(comms, 2), colX.fees, tableY + 3.2);

      // Net with color
      if (net >= 0) {
        doc.setTextColor(...PALETTE.emerald);
        doc.setFont('helvetica', 'bold');
        doc.text(`+${fmt(net, 2)}`, colX.net, tableY + 3.2);
      } else {
        doc.setTextColor(...PALETTE.ruby);
        doc.setFont('helvetica', 'bold');
        doc.text(fmt(net, 2), colX.net, tableY + 3.2);
      }

      tableY += rowH;
    }

    // Totals row
    tableY += 1.5;
    doc.setFillColor(...PALETTE.cardBg);
    doc.rect(14, tableY, 182, 6, 'F');
    doc.setDrawColor(...PALETTE.borderDark);
    doc.setLineWidth(0.2);
    doc.rect(14, tableY, 182, 6, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...PALETTE.textPrimary);
    doc.text(isEs ? 'TOTALES' : 'TOTALS', colX.date, tableY + 4);

    doc.text(fmt(sumGross, 2), colX.gross, tableY + 4);
    doc.text(fmt(sumFees, 2), colX.fees, tableY + 4);

    if (sumNet >= 0) {
      doc.setTextColor(...PALETTE.emerald);
      doc.text(`+${fmt(sumNet, 2)}`, colX.net, tableY + 4);
    } else {
      doc.setTextColor(...PALETTE.ruby);
      doc.text(fmt(sumNet, 2), colX.net, tableY + 4);
    }
  }

  // Stamp footers on all pages
  const actualPages = doc.getNumberOfPages();
  for (let p = 1; p <= actualPages; p++) {
    doc.setPage(p);
    addFooter(doc, p, actualPages);
  }

  return doc;
}

/**
 * Triggers a client-side download of the generated PDF report in the browser.
 */
export function downloadPdfReport(
  data: ReportQuantitativeData,
  filename?: string,
  options?: PdfExportOptions,
): void {
  if (typeof window === 'undefined') return;

  const doc = generateQuantitativePdfReport(data, options);
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const safeFilename = filename || `traderisk-report-${data.metadata.account.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${dateStr}.pdf`;

  doc.save(safeFilename.endsWith('.pdf') ? safeFilename : `${safeFilename}.pdf`);
}
