// =============================================================================
// TradeRisk Manager — Binance Spot Market Data Adapter (Fase 8.1)
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

export type BinanceSpotAdapterOptions = Partial<BinanceAdapterConfig>;

/**
 * Normalizes Binance Spot symbol to standard pair format (e.g. "BTCUSDT" -> "BTC/USDT").
 */
export function normalizeSpotSymbol(rawSymbol: string): string {
  const upper = rawSymbol.toUpperCase();
  if (upper.includes('/')) return upper;

  // Common quote currencies in Binance Spot
  const quotes = ['USDT', 'USDC', 'FDUSD', 'TUSD', 'BUSD', 'EUR', 'BTC', 'ETH', 'BNB'];
  for (const q of quotes) {
    if (upper.endsWith(q) && upper.length > q.length) {
      const base = upper.slice(0, -q.length);
      return `${base}/${q}`;
    }
  }
  return upper;
}

/**
 * Adapter for public Binance Spot WebSocket streams (stream.binance.com:9443).
 * - Upstream limit: 5 messages/second.
 * - Spot bookTicker payloads do not contain exchange event timestamps (E field);
 *   ordering is strictly verified via monotonic updateId (u field).
 */
export class BinanceSpotAdapter extends BinanceBaseAdapter {
  readonly id: ProviderId = 'binance_spot';

  constructor(options: BinanceSpotAdapterOptions = {}) {
    super({
      baseUrl: 'wss://stream.binance.com:9443/ws',
      maxUpstreamMsgsPerSec: 4, // Safe margin (4 msgs/s) below Binance Spot hard limit (5 msgs/s)
      ...options,
    });
  }

  protected formatStreamName(symbol: string): string {
    const clean = symbol.replace(/[/_]/g, '').toLowerCase();
    return `${clean}@bookTicker`;
  }

  protected parseRawMessage(rawText: string): MarketPriceQuote | null {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawText);
    } catch {
      return null;
    }

    // Ignore subscription response acknowledgements (e.g. {"result": null, "id": 1})
    if ('result' in payload && payload.result === null) {
      return null;
    }

    // Handle both direct stream and combined stream wrapping ({stream: "...", data: {...}})
    const data = (payload.data && typeof payload.data === 'object' ? payload.data : payload) as Record<string, unknown>;

    // Verify required Spot bookTicker fields
    if (
      typeof data.s !== 'string' ||
      typeof data.b !== 'string' ||
      typeof data.a !== 'string' ||
      typeof data.u !== 'number'
    ) {
      return null;
    }

    const rawSymbol = data.s.toUpperCase();
    const normalizedAsset = normalizeSpotSymbol(rawSymbol);
    const bid = parseFloat(data.b);
    const ask = parseFloat(data.a);
    const bidQty = typeof data.B === 'string' ? parseFloat(data.B) : undefined;
    const askQty = typeof data.A === 'string' ? parseFloat(data.A) : undefined;
    const updateId = data.u;

    // 1. Structural validation: finite positive numbers, spread >= 0, crossed book rejected
    const priceValidation = validatePriceStructure(bid, ask);
    if (!priceValidation.isValid) {
      this.notifyError(
        new Error(`[${this.id}] ${rawSymbol} price validation failed: ${priceValidation.reason}`)
      );
      return null;
    }

    // 2. Temporal validation: verify monotonic updateId
    const localNow = this.clock.now();
    const monotonicNow = this.clock.monotonicNow();
    const lastUpdateId = this.lastProcessedUpdateIds.get(rawSymbol);

    const temporalValidation = validateTemporalOrdering({
      updateId,
      lastUpdateId,
      localReceivedAt: localNow,
    });

    if (!temporalValidation.isValid) {
      this.notifyError(
        new Error(`[${this.id}] ${rawSymbol} temporal validation failed: ${temporalValidation.reason}`)
      );
      return null;
    }

    this.lastProcessedUpdateIds.set(rawSymbol, updateId);

    // 3. Spike detection heuristic:
    const mid = (bid + ask) / 2;
    const spread = ask - bid;

    let detector = this.spikeDetectors.get(rawSymbol);
    if (!detector) {
      detector = new SpikeDetector(this.spikeConfig);
      this.spikeDetectors.set(rawSymbol, detector);
    }

    const spikeResult = detector.evaluate(mid, updateId);
    const lastReliable = this.lastReliableQuotes.get(normalizedAsset);

    const quote: MarketPriceQuote = {
      asset: normalizedAsset,
      rawSymbol,
      provider: this.id,
      contractType: 'spot',
      bid,
      bidQty,
      ask,
      askQty,
      mid,
      spread,
      updateId,
      exchangeEventTime: undefined, // Explicitly absent in Binance Spot bookTicker
      localReceivedAt: localNow,
      monotonicReceivedAt: monotonicNow,
      status: 'live',
      isSpike: spikeResult.isSpike,
      spikeReason: spikeResult.reason,
      lastReliableQuote: lastReliable ? { ...lastReliable } : undefined,
    };

    return quote;
  }
}
