// =============================================================================
// TradeRisk Manager — Quantitative Reporting Engine Types
// =============================================================================

import type {
  Account,
  Trade,
  TradeStatistics,
  Locale,
} from '@/lib/types';
import type {
  ExpectancyMetrics,
  DrawdownMetrics,
} from '@/lib/analytics/types';
import type {
  DrawdownResult,
  DailyLossResult,
  ProfitTargetResult,
} from '@/lib/prop-firm';

export interface ReportMetadata {
  title: string;
  generatedAt: string;
  locale: Locale;
  account: Account;
  version: string;
  author?: string;
  dateRange?: {
    startDate?: string;
    endDate?: string;
  };
}

export interface ReportQuantitativeData {
  metadata: ReportMetadata;
  statistics: TradeStatistics;
  expectancy: ExpectancyMetrics;
  drawdown: DrawdownMetrics;
  propFirmStatus?: {
    drawdownResult: DrawdownResult;
    dailyLossResult: DailyLossResult;
    profitTargetResult: ProfitTargetResult;
  };
  trades: Trade[];
}

export interface CsvExportOptions {
  locale?: Locale;
  delimiter?: ',' | ';';
  includeBom?: boolean;
}

export interface PdfExportOptions {
  locale?: Locale;
  includeTradeLog?: boolean;
  maxTradesInLog?: number;
  authorName?: string;
}
