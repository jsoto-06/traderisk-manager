// =============================================================================
// TradeRisk Manager — Instrument Classification & Financial Catalog (Paso 8.2.1)
// =============================================================================

import type { MarketPriceQuote } from '../market-data/types';

/** Standard classified instrument models supported by the valuation engine */
export type ClassifiedInstrumentType =
  | 'spot'
  | 'usdm'
  | 'coinm'
  | 'forex'
  | 'futures'
  | 'stocks'
  | 'unknown';

/** ISO-4217 standard fiat currency codes */
export const ISO_FIAT_CURRENCIES = new Set([
  'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD',
  'SEK', 'NOK', 'DKK', 'SGD', 'HKD', 'TRY', 'MXN', 'ZAR',
  'PLN', 'HUF', 'CZK', 'ILS', 'THB', 'CNH', 'CNY', 'KRW',
]);

/** Crypto stablecoins typically pegged to fiat */
export const STABLECOINS = new Set([
  'USDT', 'USDC', 'BUSD', 'DAI', 'FDUSD', 'TUSD', 'USDD', 'USDP', 'EURC', 'PYUSD',
]);

/** Prominent cryptocurrency base asset symbols */
export const KNOWN_CRYPTO_ASSETS = new Set([
  'BTC', 'ETH', 'SOL', 'ADA', 'XRP', 'BNB', 'DOGE', 'DOT',
  'LINK', 'AVAX', 'MATIC', 'POL', 'LTC', 'NEAR', 'ATOM', 'UNI',
  'APT', 'ARB', 'OP', 'SUI', 'PEPE', 'SHIB', 'FTM', 'ICP',
  'RENDER', 'TAO', 'INJ', 'FIL', 'TRX', 'XLM', 'HBAR', 'KAS',
]);

/** Known traditional futures contract point multipliers */
export const FUTURES_MULTIPLIERS: Record<string, number> = {
  ES: 50,    // E-mini S&P 500
  MES: 5,    // Micro E-mini S&P 500
  NQ: 20,    // E-mini Nasdaq 100
  MNQ: 2,    // Micro E-mini Nasdaq 100
  YM: 5,     // E-mini Dow Jones
  MYM: 0.5,  // Micro E-mini Dow Jones
  RTY: 50,   // E-mini Russell 2000
  M2K: 5,    // Micro E-mini Russell 2000
  CL: 1000,  // Crude Oil
  MCL: 100,  // Micro Crude Oil
  NG: 10000, // Natural Gas
  MNG: 1000, // Micro Natural Gas
  GC: 100,   // Gold
  MGC: 10,   // Micro Gold
  SI: 5000,  // Silver
  SIL: 1000, // Micro Silver
  HG: 25000, // Copper
  ZB: 1000,  // 30-Year Treasury Bond
  ZN: 1000,  // 10-Year Treasury Note
  ZF: 1000,  // 5-Year Treasury Note
  ZT: 2000,  // 2-Year Treasury Note
};

/**
 * Returns the point multiplier for traditional futures, defaulting to 1 if unknown.
 */
export function inferFuturesMultiplier(asset: string): number {
  const clean = asset.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  // Match prefix like 'ES', 'MES', etc.
  for (const [symbol, mult] of Object.entries(FUTURES_MULTIPLIERS)) {
    if (clean === symbol || clean.startsWith(symbol)) {
      return mult;
    }
  }
  return 1;
}

/**
 * Classifies an asset into its appropriate financial instrument model.
 * 
 * Priority order:
 * 1. Explicit validated instrumentType.
 * 2. Quote metadata (provider, contractType, st universe).
 * 3. Exact symbol structure & catalog matching.
 * 4. Fallback to 'unknown' if evidence is insufficient.
 */
export function classifyInstrument(
  asset: string,
  quote?: MarketPriceQuote,
  explicitType?: string
): ClassifiedInstrumentType {
  // 1. Explicit type check
  if (explicitType) {
    const norm = explicitType.trim().toLowerCase();
    if (norm === 'spot') return 'spot';
    if (norm === 'usdm' || norm === 'perpetual') return 'usdm';
    if (norm === 'coinm' || norm === 'coinm_inverse') return 'coinm';
    if (norm === 'forex' || norm === 'forex_lot') return 'forex';
    if (norm === 'futures') return 'futures';
    if (norm === 'stocks' || norm === 'stock' || norm === 'cfd') return 'stocks';
  }

  // 2. Quote metadata check (futures specific universe tags)
  if (quote) {
    if (quote.provider === 'binance_coinm' || quote.st === 2) return 'coinm';
    if (quote.provider === 'binance_usdm' || (quote.contractType === 'perpetual' && quote.st === 1)) return 'usdm';
  }

  const normalized = asset.trim().toUpperCase();

  // 3. Perpetuals & Inverses pattern check
  if (normalized.includes('_PERP') || normalized.includes(':PERP')) {
    // Linear perpetuals quoted in stablecoins (USDT, USDC, etc.)
    if (
      normalized.includes('USDT') ||
      normalized.includes('USDC') ||
      normalized.includes('FDUSD') ||
      normalized.includes('BUSD')
    ) {
      return 'usdm';
    }
    // Inverse perpetuals quoted against USD (e.g. BTCUSD_PERP, BTC/USD:PERP, ETHUSD_PERP)
    if (normalized.includes('USD')) {
      return 'coinm';
    }
    return 'usdm';
  }

  // 4. Futures contracts check
  for (const sym of Object.keys(FUTURES_MULTIPLIERS)) {
    if (normalized === sym || normalized.startsWith(sym + '!') || normalized.startsWith(sym + '1!') || normalized.startsWith(sym + '2!')) {
      return 'futures';
    }
  }

  // 5. Slash pair separation (e.g. 'EUR/USD', 'BTC/USDT', 'AUD/CAD')
  if (normalized.includes('/')) {
    const [base, quoteCurrency] = normalized.split('/').map((s) => s.trim());
    if (base && quoteCurrency) {
      // Rule: Both base and quote are ISO fiat -> FOREX (covers AUD/CAD, NZD/CHF, CAD/CHF, EUR/USD, etc.)
      if (ISO_FIAT_CURRENCIES.has(base) && ISO_FIAT_CURRENCIES.has(quoteCurrency)) {
        return 'forex';
      }

      // Rule: Quote is stablecoin -> SPOT (or USD-M if marked as perp)
      // Never classify ADA/USDT, XRP/USDT, BNB/USDT as Forex!
      if (STABLECOINS.has(quoteCurrency)) {
        return 'spot';
      }

      // Rule: Base or Quote is known crypto -> SPOT
      if (KNOWN_CRYPTO_ASSETS.has(base) || KNOWN_CRYPTO_ASSETS.has(quoteCurrency)) {
        return 'spot';
      }
    }
  }

  // 6. Unslashed 6-character standard forex pairs (e.g. 'EURUSD', 'USDJPY', 'AUDCAD', 'GBPCHF')
  if (normalized.length === 6) {
    const b = normalized.slice(0, 3);
    const q = normalized.slice(3, 6);
    if (ISO_FIAT_CURRENCIES.has(b) && ISO_FIAT_CURRENCIES.has(q)) {
      return 'forex';
    }
  }

  // 7. Common crypto tickers without slash (e.g. 'BTCUSDT', 'ETHUSDT', 'ADAUSDT')
  for (const stable of STABLECOINS) {
    if (normalized.endsWith(stable)) {
      return 'spot';
    }
  }

  // 8. Common major stock tickers or explicit symbols
  if (/^[A-Z]{1,5}$/.test(normalized) && !ISO_FIAT_CURRENCIES.has(normalized) && !KNOWN_CRYPTO_ASSETS.has(normalized)) {
    return 'stocks';
  }

  return 'unknown';
}
