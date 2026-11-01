// =============================================================================
// TradeRisk Manager — Quantitative Reporting Engine Tests (PDF & CSV)
// =============================================================================

import { describe, it, expect } from 'vitest';
import type { Account, Trade } from '@/lib/types';
import { calculateStatistics } from '@/lib/statistics';
import { calculateExpectancy } from '@/lib/analytics/expectancy';
import { calculateDrawdownMetrics } from '@/lib/analytics/drawdown';
import { calculateDrawdown, calculateDailyLoss, calculateProfitTarget } from '@/lib/prop-firm';
import {
  escapeCsvCell,
  generateTradeLedgerCsv,
  generateExecutiveSummaryCsv,
} from '@/lib/reports/csv-exporter';
import {
  generateQuantitativePdfReport,
} from '@/lib/reports/pdf-generator';
import type { ReportQuantitativeData } from '@/lib/reports/types';

describe('FASE 7 — Quantitative Reporting Engine (PDF & CSV Audit)', () => {
  const sampleAccount: Account = {
    id: 'acc-rep-1',
    name: 'Apex Prop Challenge 100K',
    type: 'PropFirm',
    initialCapital: 100000,
    balance: 102450,
    equity: 102450,
    currency: 'USD',
    profitTarget: 10, // 10% ($10,000)
    dailyLossLimit: 4, // 4% ($4,000)
    maxDrawdown: 6, // 6% ($6,000)
    drawdownType: 'static',
    timezone: 'UTC',
    dailyResetHour: 0,
    riskPerTrade: 1,
    leverage: 10,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-02T15:00:00Z',
  };

  const sampleTrades: Trade[] = [
    {
      id: 'trade-rep-1',
      accountId: sampleAccount.id,
      asset: 'BTC/USDT',
      direction: 'long',
      entryPrice: 80000,
      exitPrice: 83000,
      stopLoss: 78500,
      takeProfit: 84500,
      size: 1,
      status: 'closed',
      result: 3000,
      commissions: 50, // Net +2950
      openDate: '2026-10-01T10:00:00Z',
      closeDate: '2026-10-01T14:00:00Z',
      strategy: 'Breakout "Vol"',
      timeframe: '1h',
      notes: 'Clean trade, target hit',
    },
    {
      id: 'trade-rep-2',
      accountId: sampleAccount.id,
      asset: 'ETH/USDT',
      direction: 'short',
      entryPrice: 3200,
      exitPrice: 3240,
      stopLoss: 3250,
      takeProfit: 3050,
      size: 10,
      status: 'closed',
      result: -400,
      commissions: 100, // Net -500
      openDate: '2026-10-02T10:00:00Z',
      closeDate: '2026-10-02T11:30:00Z',
      strategy: 'Fade, Mean Reversion',
      timeframe: '15m',
      notes: 'Stopped out near high\nRe-evaluating',
    },
  ];

  const prepareReportData = (locale: 'es' | 'en' = 'es'): ReportQuantitativeData => {
    const stats = calculateStatistics(sampleTrades, sampleAccount.initialCapital);
    const expectancy = calculateExpectancy(sampleTrades);
    const drawdown = calculateDrawdownMetrics(sampleTrades, sampleAccount.initialCapital);
    const ddResult = calculateDrawdown(sampleAccount);
    const dlResult = calculateDailyLoss(sampleAccount, sampleTrades, 0);
    const ptResult = calculateProfitTarget(sampleAccount);

    return {
      metadata: {
        title: 'Institutional Risk & Performance Audit',
        generatedAt: '2026-11-01T16:00:00.000Z',
        locale,
        account: sampleAccount,
        version: '1.0.0',
        author: 'Chief Risk Officer',
      },
      statistics: stats,
      expectancy,
      drawdown,
      propFirmStatus: {
        drawdownResult: ddResult,
        dailyLossResult: dlResult,
        profitTargetResult: ptResult,
      },
      trades: sampleTrades,
    };
  };

  describe('1. CSV Exporter Formatting & RFC 4180 Compliance', () => {
    it('escapes cells containing commas, quotes, and newlines properly', () => {
      expect(escapeCsvCell('Simple text')).toBe('Simple text');
      expect(escapeCsvCell('Text, with comma')).toBe('"Text, with comma"');
      expect(escapeCsvCell('Text with "quotes"')).toBe('"Text with ""quotes"""');
      expect(escapeCsvCell('Line1\nLine2')).toBe('"Line1\nLine2"');
    });

    it('generates a valid Trade Ledger CSV with UTF-8 BOM and correct net results', () => {
      const csv = generateTradeLedgerCsv(sampleTrades, { locale: 'es' });

      // Verifies UTF-8 BOM
      expect(csv.startsWith('\uFEFF')).toBe(true);

      // Verifies headers in Spanish
      expect(csv).toContain('ID Operación,Fecha Apertura,Fecha Cierre,Activo');
      expect(csv).toContain('Resultado Bruto,Comisiones,Resultado Neto');

      // Verifies Trade 1 row
      expect(csv).toContain('trade-rep-1');
      expect(csv).toContain('BTC/USDT');
      expect(csv).toContain('3000.00'); // Gross
      expect(csv).toContain('50.00'); // Commissions
      expect(csv).toContain('2950.00'); // Net

      // Verifies escaping of strategy with quotes
      expect(csv).toContain('"Breakout ""Vol"""');

      // Verifies Trade 2 row with escaped newline and comma
      expect(csv).toContain('trade-rep-2');
      expect(csv).toContain('-400.00'); // Gross
      expect(csv).toContain('100.00'); // Commissions
      expect(csv).toContain('-500.00'); // Net
      expect(csv).toContain('"Fade, Mean Reversion"');
    });

    it('generates Trade Ledger CSV with English headers when requested', () => {
      const csv = generateTradeLedgerCsv(sampleTrades, { locale: 'en' });
      expect(csv).toContain('Trade ID,Open Date,Close Date,Asset,Direction');
      expect(csv).toContain('Gross PnL,Commissions,Net PnL');
    });

    it('generates an institutional multi-section Executive Summary CSV', () => {
      const reportData = prepareReportData('es');
      const csv = generateExecutiveSummaryCsv(reportData, { locale: 'es' });

      // Header section
      expect(csv).toContain('TRADERISK MANAGER — INFORME CUANTITATIVO AUDITADO');
      expect(csv).toContain('Apex Prop Challenge 100K');
      expect(csv).toContain('Capital Inicial,100000.00');
      expect(csv).toContain('Balance Actual,102450.00');

      // Core performance section
      expect(csv).toContain('=== RENDIMIENTO DE TRADING Y ESTADÍSTICAS ===');
      expect(csv).toContain('Total Operaciones,2');
      expect(csv).toContain('Operaciones Ganadoras,1');
      expect(csv).toContain('Operaciones Perdedoras,1');
      expect(csv).toContain('Tasa de Acierto (Win Rate),50.00%');
      expect(csv).toContain('Beneficio Neto ($),2450.00');
      expect(csv).toContain('Comisiones Totales ($),150.00');

      // Expectancy section
      expect(csv).toContain('=== EXPECTATIVA MATEMÁTICA Y CONSISTENCIA ===');
      expect(csv).toContain('Expectativa Monetaria ($ / trade),1225.00');

      // Drawdown section
      expect(csv).toContain('=== PRESERVACIÓN DE CAPITAL Y DRAWDOWN ===');
      expect(csv).toContain('High-Water Mark (Pico Histórico)');

      // Prop firm section
      expect(csv).toContain('=== REGLAS PROP FIRM Y CONTROL DE LÍMITES ===');
      expect(csv).toContain('Piso de Drawdown (Floor),94000.00');
      expect(csv).toContain('Distancia al Piso ($),8450.00');
    });
  });

  describe('2. PDF Generator (jsPDF)', () => {
    it('generates a valid institutional PDF document with executive cards and tables', () => {
      const reportData = prepareReportData('es');
      const doc = generateQuantitativePdfReport(reportData, {
        locale: 'es',
        includeTradeLog: true,
      });

      expect(doc).toBeDefined();

      // Has 2 pages (Page 1 Executive Summary, Page 2 Trade Ledger)
      expect(doc.getNumberOfPages()).toBe(2);

      // Verify PDF binary header
      const dataUri = doc.output('datauristring');
      expect(dataUri).toContain('data:application/pdf');

      const rawPdf = doc.output();
      expect(rawPdf.startsWith('%PDF-')).toBe(true);
    });

    it('generates a single page report when trade ledger is excluded', () => {
      const reportData = prepareReportData('en');
      const doc = generateQuantitativePdfReport(reportData, {
        locale: 'en',
        includeTradeLog: false,
      });

      expect(doc.getNumberOfPages()).toBe(1);
      const rawPdf = doc.output();
      expect(rawPdf.startsWith('%PDF-')).toBe(true);
    });

    it('handles empty trades list gracefully in PDF report', () => {
      const emptyData: ReportQuantitativeData = {
        metadata: {
          title: 'Empty Account Report',
          generatedAt: '2026-11-01T16:00:00Z',
          locale: 'es',
          account: sampleAccount,
          version: '1.0.0',
        },
        statistics: calculateStatistics([], sampleAccount.initialCapital),
        expectancy: calculateExpectancy([]),
        drawdown: calculateDrawdownMetrics([], sampleAccount.initialCapital),
        trades: [],
      };

      const doc = generateQuantitativePdfReport(emptyData, { locale: 'es' });
      expect(doc.getNumberOfPages()).toBe(1);
      expect(doc.output().startsWith('%PDF-')).toBe(true);
    });
  });
});
