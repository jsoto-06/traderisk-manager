// =============================================================================
// TradeRisk Manager — Binance USD-M Futures Market Data Adapter (Fase 8.1)
// =============================================================================

import {
  MarketPriceQuote,
  ProviderId,
} from '../types';
import {
  SpikeDetector,
  validatePriceStructure,
  validateTemporalOrdering,
} from '../validation';
import { BinanceAdapterConfig, BinanceBaseAdapter } from './base-adapter';

export type BinanceUsdmAdapterOptions = Partial<BinanceAdapterConfig>;

/**
 * Normalizes Binance USDS-M symbol to standard format (e.g. "BTCUSDT" -> "BTC/USDT:USDM").
 */
export function normalizeUsdmSymbol(rawSymbol: string): string {
  const upper = rawSymbol.toUpperCase();
  if (upper.includes('/')) return upper;

  const quotes = ['USDT', 'USDC'];
  for (const q of quotes) {
    if (upper.endsWith(q) && upper.length > q.length) {
      const base = upper.slice(0, -q.length);
      return `${base}/${q}:USDM`;
    }
  }
  return `${upper}:USDM`;
}

/**
 * Adapter for public Binance USDS-M Futures WebSocket streams.
 * - Base public endpoint: wss://fstream.binance.com/public/stream (or fallback /ws).
 * - Upstream limit: 10 messages/second (verified in official Binance Futures documentation).
 * - Includes exchange event timestamps (E field) and transaction time (T field).
 * - Supports capturing universe identifier (st field, where 1 = USDS-M).
 */
export class BinanceUsdmAdapter extends BinanceBaseAdapter {
  readonly id: ProviderId = 'binance_usdm';

  constructor(options: BinanceUsdmAdapterOptions = {}) {
    super({
      baseUrl: 'wss://fstream.binance.com/public/stream',
      maxUpstreamMsgsPerSec: 10, // Verified official Binance Futures limit
      ...options,
    });
  }

  protected formatStreamName(symbol: string): string {
    const clean = symbol.replace(/[/_:]/g, '').replace(/USDM$/i, '').toLowerCase();
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
    const normalizedAsset = normalizeUsdmSymbol(rawSymbol);
    const bid = parseFloat(data.b);
    const ask = parseFloat(data.a);
    const bidQty = typeof data.B === 'string' ? parseFloat(data.B) : undefined;
    const askQty = typeof data.A === 'string' ? parseFloat(data.A) : undefined;
    const updateId = data.u;
    const exchangeEventTime = typeof data.E === 'number' ? data.E : undefined;
    const transactionTime = typeof data.T === 'number' ? data.T : undefined;
    const st = typeof data.st === 'number' ? data.st : undefined;

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
    const lastReliable = this.lastReliableQuotes.get(normalizedAsset);

    const quote: MarketPriceQuote = {
      asset: normalizedAsset,
      rawSymbol,
      provider: this.id,
      contractType: 'perpetual',
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
    };

    return quote;
  }
}
