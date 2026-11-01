// =============================================================================
// TradeRisk Manager — Institutional Quantitative Report Export Modal
// =============================================================================

'use client';

import React, { useState } from 'react';
import {
  FileText,
  FileSpreadsheet,
  Download,
  CheckCircle2,
} from 'lucide-react';
import { useLocale } from '@/lib/i18n/useLocale';
import { useStorage } from '@/hooks/useStorage';
import { calculateStatistics } from '@/lib/statistics';
import { calculateExpectancy } from '@/lib/analytics/expectancy';
import { calculateDrawdownMetrics } from '@/lib/analytics/drawdown';
import { calculateDrawdown, calculateDailyLoss, calculateProfitTarget } from '@/lib/prop-firm';
import {
  generateTradeLedgerCsv,
  generateExecutiveSummaryCsv,
  downloadCsvFile,
  downloadPdfReport,
} from '@/lib/reports';
import type { ReportQuantitativeData } from '@/lib/reports/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';

export interface ExportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultAccountId?: string;
}

export function ExportReportModal({
  isOpen,
  onClose,
  defaultAccountId,
}: ExportReportModalProps) {
  const { locale } = useLocale();
  const isEs = locale === 'es';
  const { accounts, activeAccount, trades } = useStorage();

  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    defaultAccountId || activeAccount?.id || accounts[0]?.id || '',
  );
  const [reportType, setReportType] = useState<'pdf' | 'csv_summary' | 'csv_trades'>('pdf');
  const [includeTradeLog, setIncludeTradeLog] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const targetAccount = accounts.find((a) => a.id === selectedAccountId) || activeAccount || accounts[0];

  const handleExport = () => {
    if (!targetAccount) return;
    setIsExporting(true);

    try {
      const accountTrades = trades.filter((t) => t.accountId === targetAccount.id);
      const dateStr = new Date().toISOString().slice(0, 10);
      const safeAccName = targetAccount.name.toLowerCase().replace(/[^a-z0-9]/g, '-');

      if (reportType === 'csv_trades') {
        const csv = generateTradeLedgerCsv(accountTrades, { locale });
        downloadCsvFile(csv, `traderisk-ledger-${safeAccName}-${dateStr}.csv`);
        setSuccessToast(isEs ? 'Libro mayor CSV exportado con éxito' : 'Trade Ledger CSV exported successfully');
      } else {
        // Compile full quantitative dataset
        const stats = calculateStatistics(accountTrades, targetAccount.initialCapital);
        const expectancy = calculateExpectancy(accountTrades);
        const drawdown = calculateDrawdownMetrics(accountTrades, targetAccount.initialCapital);
        const ddResult = calculateDrawdown(targetAccount);
        const dlResult = calculateDailyLoss(targetAccount, accountTrades, 0);
        const ptResult = calculateProfitTarget(targetAccount);

        const reportData: ReportQuantitativeData = {
          metadata: {
            title: isEs ? 'Informe Cuantitativo de Gestión de Riesgo' : 'Quantitative Risk Management Report',
            generatedAt: new Date().toISOString(),
            locale,
            account: targetAccount,
            version: '1.0.0',
            author: 'TradeRisk Manager',
          },
          statistics: stats,
          expectancy,
          drawdown,
          propFirmStatus: {
            drawdownResult: ddResult,
            dailyLossResult: dlResult,
            profitTargetResult: ptResult,
          },
          trades: accountTrades,
        };

        if (reportType === 'pdf') {
          downloadPdfReport(reportData, `traderisk-report-${safeAccName}-${dateStr}.pdf`, {
            locale,
            includeTradeLog,
          });
          setSuccessToast(isEs ? 'Informe PDF generado y descargado con éxito' : 'PDF Report generated and downloaded successfully');
        } else if (reportType === 'csv_summary') {
          const csv = generateExecutiveSummaryCsv(reportData, { locale });
          downloadCsvFile(csv, `traderisk-summary-${safeAccName}-${dateStr}.csv`);
          setSuccessToast(isEs ? 'Resumen Ejecutivo CSV exportado con éxito' : 'Executive Summary CSV exported successfully');
        }
      }

      setTimeout(() => {
        setIsExporting(false);
        setSuccessToast(null);
        onClose();
      }, 1500);
    } catch (e) {
      setIsExporting(false);
      alert(isEs ? `Error al generar el informe: ${e instanceof Error ? e.message : 'Error desconocido'}` : `Error generating report: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEs ? 'Exportar Informe Cuantitativo' : 'Export Quantitative Report'}
      subtitle={
        isEs
          ? 'Genera informes institucionales auditados en formato PDF o CSV para auditorías de riesgo y prop firms'
          : 'Generate audited institutional reports in PDF or CSV format for risk audits and prop firm verification'
      }
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isExporting}>
            {isEs ? 'Cancelar' : 'Cancel'}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleExport}
            disabled={isExporting}
            leftIcon={<Download className="w-4 h-4" />}
          >
            {isExporting ? (isEs ? 'Generando...' : 'Generating...') : isEs ? 'Descargar Informe' : 'Download Report'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Account Selector */}
        <div>
          <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
            {isEs ? 'Cuenta a Auditar' : 'Account to Audit'}
          </label>
          <Select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="w-full text-xs"
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name} ({acc.type} · {acc.currency} · Saldo: ${acc.balance.toLocaleString()})
              </option>
            ))}
          </Select>
        </div>

        {/* Format Selector Cards */}
        <div>
          <label className="block text-xs font-medium text-[#94A3B8] mb-2">
            {isEs ? 'Formato de Exportación' : 'Export Format'}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Option 1: PDF */}
            <button
              type="button"
              onClick={() => setReportType('pdf')}
              className={`p-3 rounded-xl border text-left transition-all ${
                reportType === 'pdf'
                  ? 'bg-[#00F0FF]/10 border-[#00F0FF] shadow-lg shadow-[#00F0FF]/5'
                  : 'bg-[#0A1128] border-[#1E2D4A] hover:border-[#00F0FF]/30'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <FileText className={`w-4 h-4 ${reportType === 'pdf' ? 'text-[#00F0FF]' : 'text-[#94A3B8]'}`} />
                <span className="text-xs font-bold text-[#F5F7FA]">PDF Institucional</span>
              </div>
              <p className="text-[11px] text-[#8899A6] leading-relaxed">
                {isEs ? 'Informe visual con tarjetas KPI, expectativas y libro mayor.' : 'Executive visual report with KPIs and trade log.'}
              </p>
            </button>

            {/* Option 2: CSV Summary */}
            <button
              type="button"
              onClick={() => setReportType('csv_summary')}
              className={`p-3 rounded-xl border text-left transition-all ${
                reportType === 'csv_summary'
                  ? 'bg-[#00F0FF]/10 border-[#00F0FF] shadow-lg shadow-[#00F0FF]/5'
                  : 'bg-[#0A1128] border-[#1E2D4A] hover:border-[#00F0FF]/30'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <FileSpreadsheet className={`w-4 h-4 ${reportType === 'csv_summary' ? 'text-[#00F0FF]' : 'text-[#94A3B8]'}`} />
                <span className="text-xs font-bold text-[#F5F7FA]">CSV Resumen</span>
              </div>
              <p className="text-[11px] text-[#8899A6] leading-relaxed">
                {isEs ? 'Métricas cuantitativas y reglas prop firm multisección.' : 'Multi-section quant metrics and prop firm rules.'}
              </p>
            </button>

            {/* Option 3: CSV Ledger */}
            <button
              type="button"
              onClick={() => setReportType('csv_trades')}
              className={`p-3 rounded-xl border text-left transition-all ${
                reportType === 'csv_trades'
                  ? 'bg-[#00F0FF]/10 border-[#00F0FF] shadow-lg shadow-[#00F0FF]/5'
                  : 'bg-[#0A1128] border-[#1E2D4A] hover:border-[#00F0FF]/30'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <FileSpreadsheet className={`w-4 h-4 ${reportType === 'csv_trades' ? 'text-[#00F0FF]' : 'text-[#94A3B8]'}`} />
                <span className="text-xs font-bold text-[#F5F7FA]">CSV Libro Mayor</span>
              </div>
              <p className="text-[11px] text-[#8899A6] leading-relaxed">
                {isEs ? 'Histórico completo de trades con entradas, salidas y comisiones.' : 'Full trade log with entries, exits, fees and net PnL.'}
              </p>
            </button>
          </div>
        </div>

        {/* PDF Extra Option */}
        {reportType === 'pdf' && (
          <div className="p-3 bg-[#0A1128] border border-[#1E2D4A] rounded-xl flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-medium text-[#F5F7FA]">
                {isEs ? 'Incluir Libro Mayor de Operaciones (Pág. 2)' : 'Include Trade Ledger Audit Trail (Page 2)'}
              </span>
              <p className="text-[11px] text-[#8899A6]">
                {isEs ? 'Agrega la tabla detallada con los últimos trades cerrados' : 'Appends detailed table with closed trades'}
              </p>
            </div>
            <input
              type="checkbox"
              checked={includeTradeLog}
              onChange={(e) => setIncludeTradeLog(e.target.checked)}
              className="w-4 h-4 rounded border-[#1E2D4A] text-[#00F0FF] focus:ring-[#00F0FF]"
            />
          </div>
        )}

        {/* Success Alert */}
        {successToast && (
          <div className="p-3 rounded-xl bg-[#10B981]/15 border border-[#10B981]/30 flex items-center gap-2 text-xs text-[#10B981]">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
