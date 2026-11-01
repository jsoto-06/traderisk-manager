// =============================================================================
// TradeRisk Manager — Binance Coin-M Futures Market Data Adapter (Fase 8.1)
// =============================================================================

import {
  ContractType,
  MarketPriceQuote,
  ProviderId,
} from '../types';
import {
  SpikeDetector,
  validatePriceStructure,
  validateTemporalOrdering,
} from '../validation';
import { BinanceAdapterConfig, BinanceBaseAdapter } from './base-adapter';

export type BinanceCoinmAdapterOptions = Partial<BinanceAdapterConfig>;

/**
 * Parses a raw Coin-M symbol into contract metadata and normalized display name.
 * Differentiates perpetual inverse contracts (e.g. "BTCUSD_PERP") from delivery contracts (e.g. "BTCUSD_260327").
 */
export function parseCoinmSymbol(rawSymbol: string): {
  normalizedAsset: string;
  contractType: ContractType;
  deliveryDate?: string;
  pairSymbol: string;
} {
  const upper = rawSymbol.toUpperCase();

  // 1. Perpetual inverse contracts (e.g. BTCUSD_PERP, ETHUSD_PERP)
  if (upper.endsWith('_PERP')) {
    const pair = upper.slice(0, -5); // "BTCUSD"
    const base = pair.slice(0, 3);   // "BTC"
    const quote = pair.slice(3);     // "USD"
    return {
      normalizedAsset: `${base}/${quote}:PERP`,
      contractType: 'perpetual',
      pairSymbol: pair,
    };
  }

  // 2. Delivery / Quarterly expiring contracts (e.g. BTCUSD_260327, ETHUSD_260626)
  const deliveryMatch = upper.match(/^([A-Z0-9]+)_(\d{2})(\d{2})(\d{2})$/);
  if (deliveryMatch) {
    const [, pair, yy, mm, dd] = deliveryMatch;
    const base = pair.slice(0, 3);
    const quote = pair.slice(3);
    const isoDate = `20${yy}-${mm}-${dd}`;
    return {
      normalizedAsset: `${base}/${quote}:${yy}${mm}${dd}`,
      contractType: 'delivery',
      deliveryDate: isoDate,
      pairSymbol: pair,
    };
  }

  // Fallback
  return {
    normalizedAsset: upper,
    contractType: 'perpetual',
    pairSymbol: upper,
  };
}

/**
 * Adapter for public Binance Coin-M Futures WebSocket streams (dstream.binance.com).
 * - Base public endpoint: wss://dstream.binance.com/ws (or /stream).
 * - Upstream limit: 10 messages/second (verified in official Binance Delivery documentation).
 * - Captures universe identifier (st field, where 2 = COIN-M) and pair symbol (ps field).
 * - Preserves contract expiry identity and distinguishes perpetual vs delivery.
 */
export class BinanceCoinmAdapter extends BinanceBaseAdapter {
  readonly id: ProviderId = 'binance_coinm';

  constructor(options: BinanceCoinmAdapterOptions = {}) {
    super({
      baseUrl: 'wss://dstream.binance.com/ws',
      maxUpstreamMsgsPerSec: 10, // Verified official Binance Delivery limit
      ...options,
    });
  }

  protected formatStreamName(symbol: string): string {
    const clean = symbol.replace(/[/:]/g, '').toLowerCase();
    return `${clean}@bookTicker`;
  }

  protected parseRawMessage(rawText: string): MarketPriceQuote | null {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawText);
    } catch {
      return null;
    }

    if ('result' in payload && payload.result === null) {
      return null;
    }

    const data = (payload.data && typeof payload.data === 'object' ? payload.data : payload) as Record<string, unknown>;

    if (
      typeof data.s !== 'string' ||
      typeof data.b !== 'string' ||
      typeof data.a !== 'string' ||
      typeof data.u !== 'number'
    ) {
      return null;
    }

    const rawSymbol = data.s.toUpperCase();
    const symbolDetails = parseCoinmSymbol(rawSymbol);
    const bid = parseFloat(data.b);
    const ask = parseFloat(data.a);
    const bidQty = typeof data.B === 'string' ? parseFloat(data.B) : undefined;
    const askQty = typeof data.A === 'string' ? parseFloat(data.A) : undefined;
    const updateId = data.u;
    const exchangeEventTime = typeof data.E === 'number' ? data.E : undefined;
    const transactionTime = typeof data.T === 'number' ? data.T : undefined;
    const st = typeof data.st === 'number' ? data.st : 2; // Universe 2 for COIN-M
    const reportedPair = typeof data.ps === 'string' ? data.ps.toUpperCase() : symbolDetails.pairSymbol;

    // 1. Structural validation
    const priceValidation = validatePriceStructure(bid, ask);
    if (!priceValidation.isValid) {
      this.notifyError(
        new Error(`[${this.id}] ${rawSymbol} price validation failed: ${priceValidation.reason}`)
      );
      return null;
    }

    // 2. Temporal validation
    const localNow = this.clock.now();
    const monotonicNow = this.clock.monotonicNow();
    const lastUpdateId = this.lastProcessedUpdateIds.get(rawSymbol);
    const lastExchangeTime = this.lastProcessedExchangeTimes.get(rawSymbol);

    const temporalValidation = validateTemporalOrdering({
      updateId,
      lastUpdateId,
      exchangeEventTime,
      lastExchangeEventTime: lastExchangeTime,
      localReceivedAt: localNow,
    });

    if (!temporalValidation.isValid) {
      this.notifyError(
        new Error(`[${this.id}] ${rawSymbol} temporal validation failed: ${temporalValidation.reason}`)
      );
      return null;
    }

    this.lastProcessedUpdateIds.set(rawSymbol, updateId);
    if (exchangeEventTime !== undefined) {
      this.lastProcessedExchangeTimes.set(rawSymbol, exchangeEventTime);
    }

    // 3. Spike detection heuristic
    const mid = (bid + ask) / 2;
    const spread = ask - bid;

    let detector = this.spikeDetectors.get(rawSymbol);
    if (!detector) {
      detector = new SpikeDetector(this.spikeConfig);
      this.spikeDetectors.set(rawSymbol, detector);
    }

    const spikeResult = detector.evaluate(mid);
    const lastReliable = this.lastReliableQuotes.get(symbolDetails.normalizedAsset);

    const quote: MarketPriceQuote = {
      asset: symbolDetails.normalizedAsset,
      rawSymbol,
      provider: this.id,
      contractType: symbolDetails.contractType,
      deliveryDate: symbolDetails.deliveryDate,
      bid,
      bidQty,
      ask,
      askQty,
      mid,
      spread,
      updateId,
      exchangeEventTime,
      transactionTime,
      localReceivedAt: localNow,
      monotonicReceivedAt: monotonicNow,
      status: 'live',
      isSpike: spikeResult.isSpike,
      spikeReason: spikeResult.reason,
      lastReliableQuote: lastReliable ? { ...lastReliable } : undefined,
      st,
      pairSymbol: reportedPair,
    };

    return quote;
  }
}
