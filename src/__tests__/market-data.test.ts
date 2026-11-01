// =============================================================================
// TradeRisk Manager — Market Data Infrastructure Tests (Fase 8.1)
// =============================================================================

import { describe, expect, it } from 'vitest';
import {
  BinanceCoinmAdapter,
  BinanceSpotAdapter,
  BinanceUsdmAdapter,
  createBinanceAdapter,
  evaluateFeedStaleness,
  IClock,
  IWebSocket,
  MarketPriceQuote,
  normalizeSpotSymbol,
  normalizeUsdmSymbol,
  parseCoinmSymbol,
  SpikeDetector,
  validatePriceStructure,
  validateTemporalOrdering,
  WebSocketCloseEvent,
  WebSocketMessageEvent,
} from '../lib/market-data';

// -----------------------------------------------------------------------------
// Test Doubles: MockWebSocket & MockClock
// -----------------------------------------------------------------------------

class MockWebSocket implements IWebSocket {
  readyState = 0; // 0: CONNECTING, 1: OPEN, 2: CLOSING, 3: CLOSED
  sentMessages: string[] = [];
  closeCalls: Array<{ code?: number; reason?: string }> = [];

  private listeners: Record<string, Array<(event: unknown) => void>> = {
    open: [],
    message: [],
    close: [],
    error: [],
  };

  constructor(public url: string) {}

  send(data: string): void {
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string): void {
    this.readyState = 3;
    this.closeCalls.push({ code, reason });
    this.triggerClose(code ?? 1000, reason ?? 'Closed normally');
  }

  addEventListener(type: 'open', listener: (event: unknown) => void): void;
  addEventListener(type: 'message', listener: (event: WebSocketMessageEvent) => void): void;
  addEventListener(type: 'close', listener: (event: WebSocketCloseEvent) => void): void;
  addEventListener(type: 'error', listener: (event: unknown) => void): void;
  addEventListener(type: string, listener: (event: never) => void): void {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(listener as (event: unknown) => void);
  }

  removeEventListener(type: string, listener: (event: unknown) => void): void {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter((l) => l !== listener);
  }

  triggerOpen(): void {
    this.readyState = 1;
    for (const l of this.listeners.open || []) l({});
  }

  triggerMessage(data: string | object): void {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    for (const l of this.listeners.message || []) l({ data: payload });
  }

  triggerClose(code = 1000, reason = 'Normal'): void {
    this.readyState = 3;
    for (const l of this.listeners.close || []) l({ code, reason });
  }

  triggerError(error: unknown): void {
    for (const l of this.listeners.error || []) l(error);
  }
}

class MockClock implements IClock {
  currentNow = 1_700_000_000_000;
  currentMonotonic = 10_000;
  private nextTimerId = 1;
  private activeTimers = new Map<number, { handler: () => void; dueAt: number }>();

  now(): number {
    return this.currentNow;
  }

  monotonicNow(): number {
    return this.currentMonotonic;
  }

  setTimeout(handler: () => void, timeoutMs: number): number {
    const id = this.nextTimerId++;
    this.activeTimers.set(id, { handler, dueAt: this.currentMonotonic + timeoutMs });
    return id;
  }

  clearTimeout(id: number): void {
    this.activeTimers.delete(id);
  }

  advance(ms: number): void {
    this.currentNow += ms;
    this.currentMonotonic += ms;

    const due: Array<() => void> = [];
    for (const [id, timer] of Array.from(this.activeTimers.entries())) {
      if (this.currentMonotonic >= timer.dueAt) {
        due.push(timer.handler);
        this.activeTimers.delete(id);
      }
    }
    for (const fn of due) fn();
  }
}

// =============================================================================
// Test Suites
// =============================================================================

describe('Market Data Infrastructure (Fase 8.1)', () => {
  describe('1. Structural Price Validation', () => {
    it('accepts valid bid and ask with positive spread', () => {
      const result = validatePriceStructure(50000, 50001);
      expect(result.isValid).toBe(true);
    });

    it('explicitly accepts zero spread (bid === ask) for stablecoins and zero-fee pairs', () => {
      const result = validatePriceStructure(1.0, 1.0);
      expect(result.isValid).toBe(true);
      expect(result.errorCode).toBeUndefined();
    });

    it('strictly rejects crossed order book (bid > ask)', () => {
      const result = validatePriceStructure(50002, 50000);
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('CROSSED_BOOK');
    });

    it('strictly rejects non-numeric, zero, negative or NaN prices', () => {
      expect(validatePriceStructure(0, 50000).errorCode).toBe('INVALID_NUMERIC');
      expect(validatePriceStructure(50000, -10).errorCode).toBe('INVALID_NUMERIC');
      expect(validatePriceStructure(NaN, 50000).errorCode).toBe('INVALID_NUMERIC');
      expect(validatePriceStructure(50000, Infinity).errorCode).toBe('INVALID_NUMERIC');
    });
  });

  describe('2. Temporal Ordering Validation', () => {
    it('accepts ticks when exchange timestamp is absent (Binance Spot)', () => {
      const result = validateTemporalOrdering({
        updateId: 100,
        lastUpdateId: 99,
        localReceivedAt: 1_700_000_000_000,
      });
      expect(result.isValid).toBe(true);
    });

    it('accepts identical timestamps (exchangeEventTime === lastExchangeEventTime)', () => {
      const result = validateTemporalOrdering({
        updateId: 105,
        lastUpdateId: 104,
        exchangeEventTime: 1_700_000_000_500,
        lastExchangeEventTime: 1_700_000_000_500,
        localReceivedAt: 1_700_000_000_510,
      });
      expect(result.isValid).toBe(true);
    });

    it('strictly rejects out-of-order updateId (updateId < lastUpdateId)', () => {
      const result = validateTemporalOrdering({
        updateId: 90,
        lastUpdateId: 95,
        localReceivedAt: 1_700_000_000_000,
      });
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('UPDATE_ID_OUT_OF_ORDER');
    });

    it('strictly rejects backwards exchange timestamps', () => {
      const result = validateTemporalOrdering({
        updateId: 110,
        lastUpdateId: 109,
        exchangeEventTime: 1_700_000_000_100,
        lastExchangeEventTime: 1_700_000_000_200,
        localReceivedAt: 1_700_000_000_300,
      });
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('TIMESTAMP_OUT_OF_ORDER');
    });

    it('rejects timestamps exceeding local clock by more than 2,000ms', () => {
      const result = validateTemporalOrdering({
        updateId: 120,
        exchangeEventTime: 1_700_000_005_000,
        localReceivedAt: 1_700_000_000_000,
        maxFutureToleranceMs: 2_000,
      });
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('FUTURE_TIMESTAMP_EXCEEDED');
    });
  });

  describe('3. Feed Staleness Evaluation', () => {
    it('returns "live" when elapsed monotonic time is within 5,000ms', () => {
      expect(evaluateFeedStaleness(10_000, 14_999)).toBe('live');
      expect(evaluateFeedStaleness(10_000, 15_000)).toBe('live');
    });

    it('returns "stale" when elapsed monotonic time is between 5,001ms and 30,000ms', () => {
      expect(evaluateFeedStaleness(10_000, 15_001)).toBe('stale');
      expect(evaluateFeedStaleness(10_000, 40_000)).toBe('stale');
    });

    it('returns "offline" when elapsed monotonic time exceeds 30,000ms', () => {
      expect(evaluateFeedStaleness(10_000, 40_001)).toBe('offline');
    });

    it('returns "offline" for invalid or non-positive timestamps', () => {
      expect(evaluateFeedStaleness(0, 10_000)).toBe('offline');
      expect(evaluateFeedStaleness(NaN, 10_000)).toBe('offline');
    });
  });

  describe('4. Spike Detector & 3-Tick Confirmation Heuristic', () => {
    it('seeds baseline with the first valid tick without flagging spike', () => {
      const detector = new SpikeDetector({ thresholdPercent: 10 });
      const result = detector.evaluate(50000);
      expect(result.isSpike).toBe(false);
      expect(result.confirmedNewReliable).toBe(true);
      expect(detector.getLastReliableMid()).toBe(50000);
    });

    it('accepts normal price movement within 10% threshold', () => {
      const detector = new SpikeDetector({ thresholdPercent: 10 });
      detector.evaluate(50000);

      const result = detector.evaluate(52000); // +4%
      expect(result.isSpike).toBe(false);
      expect(result.confirmedNewReliable).toBe(true);
      expect(detector.getLastReliableMid()).toBe(52000);
    });

    it('flags suspect jump > 10% and preserves last reliable price', () => {
      const detector = new SpikeDetector({ thresholdPercent: 10 });
      detector.evaluate(50000);

      const result = detector.evaluate(56000); // +12%
      expect(result.isSpike).toBe(true);
      expect(result.confirmedNewReliable).toBe(false);
      expect(detector.getLastReliableMid()).toBe(50000); // Preserved!
    });

    it('confirms new price plateau after 3 consecutive coherent ticks', () => {
      const detector = new SpikeDetector({
        thresholdPercent: 10,
        confirmationTicksRequired: 3,
        confirmationTolerancePercent: 2,
      });
      detector.evaluate(50000);

      // Tick 1 (suspect spike): 56,000 (+12%)
      const r1 = detector.evaluate(56000);
      expect(r1.isSpike).toBe(true);
      expect(detector.getLastReliableMid()).toBe(50000);

      // Tick 2 (coherent with 56,000 within 2%): 56,200 (+0.35%)
      const r2 = detector.evaluate(56200);
      expect(r2.isSpike).toBe(true);
      expect(detector.getLastReliableMid()).toBe(50000);

      // Tick 3 (coherent with 56,000 within 2%): 56,100 -> CONFIRMED!
      const r3 = detector.evaluate(56100);
      expect(r3.isSpike).toBe(false);
      expect(r3.confirmedNewReliable).toBe(true);
      expect(detector.getLastReliableMid()).toBe(56100); // Updated to new plateau!
    });

    it('resets confirmation buffer if an intermediate tick fluctuates wildly', () => {
      const detector = new SpikeDetector({
        thresholdPercent: 10,
        confirmationTicksRequired: 3,
        confirmationTolerancePercent: 2,
      });
      detector.evaluate(50000);

      // Tick 1: 56,000
      detector.evaluate(56000);
      // Tick 2: 60,000 (>2% diff from 56,000 -> reset anchor)
      const r2 = detector.evaluate(60000);
      expect(r2.isSpike).toBe(true);
      expect(r2.reason).toContain('reset');
      expect(detector.getLastReliableMid()).toBe(50000);
    });
  });

  describe('5. Binance Spot Adapter', () => {
    it('initializes with verified Spot endpoint and 5 msgs/s upstream limit', () => {
      const adapter = new BinanceSpotAdapter();
      expect(adapter.id).toBe('binance_spot');
      expect(adapter.connectionState).toBe('disconnected');
    });

    it('normalizes spot symbols correctly', () => {
      expect(normalizeSpotSymbol('BTCUSDT')).toBe('BTC/USDT');
      expect(normalizeSpotSymbol('ETHUSDC')).toBe('ETH/USDC');
      expect(normalizeSpotSymbol('SOLFDUSD')).toBe('SOL/FDUSD');
      expect(normalizeSpotSymbol('EURUSDT')).toBe('EUR/USDT');
      expect(normalizeSpotSymbol('BTC/USDT')).toBe('BTC/USDT');
    });

    it('connects, subscribes, and processes valid Spot bookTicker payload', async () => {
      let createdSocket: MockWebSocket | undefined;
      const clock = new MockClock();

      const adapter = new BinanceSpotAdapter({
        clock,
        wsFactory: (url) => {
          createdSocket = new MockWebSocket(url);
          return createdSocket;
        },
      });

      const quotesReceived: MarketPriceQuote[] = [];
      adapter.onQuote((q) => quotesReceived.push(q));

      await adapter.connect();
      expect(adapter.connectionState).toBe('connecting');
      expect(createdSocket).toBeDefined();
      expect(createdSocket!.url).toBe('wss://stream.binance.com:9443/ws');

      createdSocket!.triggerOpen();
      expect(adapter.connectionState).toBe('connected');

      // Subscribe to symbol
      await adapter.subscribe(['BTCUSDT']);
      expect(createdSocket!.sentMessages.length).toBe(1);
      const subMsg = JSON.parse(createdSocket!.sentMessages[0]);
      expect(subMsg.method).toBe('SUBSCRIBE');
      expect(subMsg.params).toEqual(['btcusdt@bookTicker']);

      // Emit incoming Spot bookTicker payload (notice absence of E field)
      createdSocket!.triggerMessage({
        u: 400900217,
        s: 'BTCUSDT',
        b: '50000.00',
        B: '1.5',
        a: '50001.00',
        A: '2.0',
      });

      expect(quotesReceived.length).toBe(1);
      const quote = quotesReceived[0];
      expect(quote.asset).toBe('BTC/USDT');
      expect(quote.rawSymbol).toBe('BTCUSDT');
      expect(quote.bid).toBe(50000);
      expect(quote.ask).toBe(50001);
      expect(quote.spread).toBe(1);
      expect(quote.mid).toBe(50000.5);
      expect(quote.contractType).toBe('spot');
      expect(quote.exchangeEventTime).toBeUndefined(); // Verified!
      expect(quote.updateId).toBe(400900217);
      expect(quote.status).toBe('live');

      // Check adapter storage
      expect(adapter.getLatestQuote('BTC/USDT')).not.toBeNull();
      expect(adapter.getLastReliableQuote('BTC/USDT')?.mid).toBe(50000.5);
    });

    it('enforces upstream rate limiter (max 5 msgs/s)', async () => {
      let createdSocket: MockWebSocket | undefined;
      const clock = new MockClock();
      const adapter = new BinanceSpotAdapter({
        clock,
        wsFactory: (url) => {
          createdSocket = new MockWebSocket(url);
          return createdSocket;
        },
      });

      await adapter.connect();
      expect(createdSocket).toBeDefined();
      createdSocket!.triggerOpen();

      const errors: Error[] = [];
      adapter.onError((e) => errors.push(e));

      // Attempt sending 6 subscribe messages in the same second
      for (let i = 1; i <= 6; i++) {
        await adapter.subscribe([`SYM${i}USDT`]);
      }

      // First 5 messages succeed, 6th is rejected by rate limiter
      expect(createdSocket!.sentMessages.length).toBe(5);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain('Upstream rate limit exceeded');
    });

    it('handles unexpected close with reconnection and symbol re-subscription', async () => {
      let socketCount = 0;
      let activeSocket: MockWebSocket | undefined;
      const clock = new MockClock();

      const adapter = new BinanceSpotAdapter({
        clock,
        reconnectBaseDelayMs: 200,
        reconnectMaxDelayMs: 500,
        wsFactory: (url) => {
          socketCount++;
          activeSocket = new MockWebSocket(url);
          return activeSocket;
        },
      });

      await adapter.connect();
      expect(activeSocket).toBeDefined();
      activeSocket!.triggerOpen();
      await adapter.subscribe(['BTCUSDT']);
      expect(activeSocket!.sentMessages.length).toBe(1);

      // Simulate unexpected server disconnect
      activeSocket!.triggerClose(1006, 'Connection reset by peer');
      expect(adapter.connectionState).toBe('reconnecting');

      // Advance clock past backoff delay
      clock.advance(1500);
      expect(socketCount).toBe(2);

      // Reconnect open
      expect(activeSocket).toBeDefined();
      activeSocket!.triggerOpen();
      expect(adapter.connectionState).toBe('connected');

      // Verifies active symbols were automatically re-subscribed!
      expect(activeSocket!.sentMessages.length).toBe(1);
      const resubMsg = JSON.parse(activeSocket!.sentMessages[0]);
      expect(resubMsg.params).toEqual(['btcusdt@bookTicker']);
    });
  });

  describe('6. Binance USD-M Futures Adapter', () => {
    it('initializes with public fstream endpoint and 10 msgs/s upstream limit', () => {
      const adapter = new BinanceUsdmAdapter();
      expect(adapter.id).toBe('binance_usdm');
    });

    it('normalizes USD-M symbols', () => {
      expect(normalizeUsdmSymbol('BTCUSDT')).toBe('BTC/USDT:USDM');
      expect(normalizeUsdmSymbol('ETHUSDC')).toBe('ETH/USDC:USDM');
    });

    it('parses USD-M bookTicker with exchangeEventTime and captures st field', async () => {
      let createdSocket: MockWebSocket | undefined;
      const clock = new MockClock();

      const adapter = new BinanceUsdmAdapter({
        clock,
        wsFactory: (url) => {
          createdSocket = new MockWebSocket(url);
          return createdSocket;
        },
      });

      const quotes: MarketPriceQuote[] = [];
      adapter.onQuote((q) => quotes.push(q));

      await adapter.connect();
      expect(createdSocket).toBeDefined();
      createdSocket!.triggerOpen();

      // Emit incoming USD-M Futures bookTicker
      createdSocket!.triggerMessage({
        e: 'bookTicker',
        u: 17242169,
        s: 'BTCUSDT',
        b: '50100.10',
        B: '10.5',
        a: '50100.20',
        A: '8.2',
        T: 1_700_000_000_100,
        E: 1_700_000_000_105,
        st: 1, // Margin universe 1 = USDS-M
      });

      expect(quotes.length).toBe(1);
      const q = quotes[0];
      expect(q.asset).toBe('BTC/USDT:USDM');
      expect(q.rawSymbol).toBe('BTCUSDT');
      expect(q.provider).toBe('binance_usdm');
      expect(q.contractType).toBe('perpetual');
      expect(q.exchangeEventTime).toBe(1_700_000_000_105);
      expect(q.transactionTime).toBe(1_700_000_000_100);
      expect(q.st).toBe(1);
      expect(q.updateId).toBe(17242169);
    });

    it('allows up to 10 upstream messages per second', async () => {
      let createdSocket: MockWebSocket | undefined;
      const clock = new MockClock();
      const adapter = new BinanceUsdmAdapter({
        clock,
        wsFactory: (url) => {
          createdSocket = new MockWebSocket(url);
          return createdSocket;
        },
      });

      await adapter.connect();
      expect(createdSocket).toBeDefined();
      createdSocket!.triggerOpen();

      // Send 10 messages within 1 second
      for (let i = 1; i <= 10; i++) {
        await adapter.subscribe([`FUT${i}`]);
      }
      expect(createdSocket!.sentMessages.length).toBe(10);
    });
  });

  describe('7. Binance Coin-M Futures Adapter', () => {
    it('initializes with dstream endpoint and 10 msgs/s upstream limit', () => {
      const adapter = new BinanceCoinmAdapter();
      expect(adapter.id).toBe('binance_coinm');
    });

    it('correctly parses perpetual vs quarterly delivery symbols', () => {
      const perp = parseCoinmSymbol('BTCUSD_PERP');
      expect(perp.contractType).toBe('perpetual');
      expect(perp.normalizedAsset).toBe('BTC/USD:PERP');
      expect(perp.pairSymbol).toBe('BTCUSD');
      expect(perp.deliveryDate).toBeUndefined();

      const delivery = parseCoinmSymbol('BTCUSD_260327');
      expect(delivery.contractType).toBe('delivery');
      expect(delivery.normalizedAsset).toBe('BTC/USD:260327');
      expect(delivery.deliveryDate).toBe('2026-03-27');
      expect(delivery.pairSymbol).toBe('BTCUSD');
    });

    it('parses Coin-M bookTicker, preserves rawSymbol, and captures st=2 and ps', async () => {
      let createdSocket: MockWebSocket | undefined;
      const clock = new MockClock();

      const adapter = new BinanceCoinmAdapter({
        clock,
        wsFactory: (url) => {
          createdSocket = new MockWebSocket(url);
          return createdSocket;
        },
      });

      const quotes: MarketPriceQuote[] = [];
      adapter.onQuote((q) => quotes.push(q));

      await adapter.connect();
      expect(createdSocket).toBeDefined();
      createdSocket!.triggerOpen();

      // Emit quarterly delivery contract
      createdSocket!.triggerMessage({
        e: 'bookTicker',
        u: 182910,
        s: 'BTCUSD_260327',
        b: '52000.0',
        B: '50',
        a: '52001.0',
        A: '30',
        T: 1_700_000_000_150,
        E: 1_700_000_000_155,
        ps: 'BTCUSD',
        st: 2, // 2 = COIN-M
      });

      expect(quotes.length).toBe(1);
      const q = quotes[0];
      expect(q.asset).toBe('BTC/USD:260327');
      expect(q.rawSymbol).toBe('BTCUSD_260327'); // Identity preserved!
      expect(q.contractType).toBe('delivery');
      expect(q.deliveryDate).toBe('2026-03-27');
      expect(q.st).toBe(2);
      expect(q.pairSymbol).toBe('BTCUSD');
      expect(q.exchangeEventTime).toBe(1_700_000_000_155);
    });
  });

  describe('8. Factory Function & Safety Invariants', () => {
    it('creates appropriate adapter instance via factory', () => {
      const spot = createBinanceAdapter('binance_spot');
      expect(spot.id).toBe('binance_spot');

      const usdm = createBinanceAdapter('binance_usdm');
      expect(usdm.id).toBe('binance_usdm');

      const coinm = createBinanceAdapter('binance_coinm');
      expect(coinm.id).toBe('binance_coinm');
    });

    it('SAFETY INVARIANT: No adapter exposes order dispatch, trading or private key methods', () => {
      const adapters = [
        new BinanceSpotAdapter(),
        new BinanceUsdmAdapter(),
        new BinanceCoinmAdapter(),
      ];

      for (const adapter of adapters) {
        // Assert no trading execution methods exist on market data adapters
        const raw = adapter as unknown as Record<string, unknown>;
        expect(raw.placeOrder).toBeUndefined();
        expect(raw.cancelOrder).toBeUndefined();
        expect(raw.createOrder).toBeUndefined();
        expect(raw.buy).toBeUndefined();
        expect(raw.sell).toBeUndefined();
        expect(raw.apiKey).toBeUndefined();
        expect(raw.apiSecret).toBeUndefined();
      }
    });
  });
});
