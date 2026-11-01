// =============================================================================
// TradeRisk Manager — Binance Base Market Data Adapter (Fase 8.1)
// =============================================================================

import {
  ConnectionState,
  IClock,
  IWebSocket,
  MarketDataProvider,
  MarketPriceQuote,
  ProviderId,
  SpikeDetectionConfig,
  StalenessConfig,
  WebSocketFactory,
} from '../types';
import {
  DEFAULT_SPIKE_CONFIG,
  DEFAULT_STALENESS_CONFIG,
  evaluateFeedStaleness,
  SpikeDetector,
} from '../validation';

export interface BinanceAdapterConfig {
  baseUrl: string;
  maxUpstreamMsgsPerSec: number;
  reconnectBaseDelayMs?: number;
  reconnectMaxDelayMs?: number;
  maxConnectionAgeMs?: number;
  spikeConfig?: Partial<SpikeDetectionConfig>;
  stalenessConfig?: Partial<StalenessConfig>;
  wsFactory?: WebSocketFactory;
  clock?: IClock;
}

const defaultClock: IClock = {
  now: () => Date.now(),
  monotonicNow: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
  setTimeout: (fn, ms) => setTimeout(fn, ms) as unknown as number,
  clearTimeout: (id) => clearTimeout(id as unknown as NodeJS.Timeout),
};

const defaultWsFactory: WebSocketFactory = (url: string) => {
  if (typeof WebSocket === 'undefined') {
    throw new Error('WebSocket is not available in the current environment');
  }
  return new WebSocket(url) as unknown as IWebSocket;
};

/**
 * Base abstract adapter for Binance WebSocket feeds.
 * - Handles connection lifecycle, reconnect backoff with jitter, and pre-emptive 24h cycle.
 * - Enforces client-to-server (upstream) application rate limits.
 * - Tracks instrument-level quotes, staleness, and reliable values.
 */
export abstract class BinanceBaseAdapter implements MarketDataProvider {
  abstract readonly id: ProviderId;

  protected connectionStateInternal: ConnectionState = 'disconnected';
  protected readonly config: BinanceAdapterConfig;
  protected readonly wsFactory: WebSocketFactory;
  protected readonly clock: IClock;
  protected readonly stalenessConfig: StalenessConfig;
  protected readonly spikeConfig: SpikeDetectionConfig;

  protected socket: IWebSocket | null = null;
  protected readonly subscribedSymbols = new Set<string>();
  protected readonly latestQuotes = new Map<string, MarketPriceQuote>();
  protected readonly lastReliableQuotes = new Map<string, MarketPriceQuote>();
  protected readonly spikeDetectors = new Map<string, SpikeDetector>();
  protected readonly lastProcessedUpdateIds = new Map<string, number>();
  protected readonly lastProcessedExchangeTimes = new Map<string, number>();

  // Upstream message rate limiter and queue
  protected readonly upstreamMessageLog: number[] = [];
  protected readonly messageQueue: object[] = [];
  protected drainTimerId: number | null = null;

  // Connection management
  protected reconnectAttempts = 0;
  protected reconnectTimerId: number | null = null;
  protected maxAgeTimerId: number | null = null;
  protected isIntentionallyClosed = false;
  protected nextRequestId = 1;

  // Event handlers
  protected readonly quoteListeners = new Set<(quote: MarketPriceQuote) => void>();
  protected readonly statusListeners = new Set<(state: ConnectionState, reason?: string) => void>();
  protected readonly errorListeners = new Set<(error: Error) => void>();

  constructor(config: BinanceAdapterConfig) {
    this.config = config;
    this.wsFactory = config.wsFactory ?? defaultWsFactory;
    this.clock = config.clock ?? defaultClock;
    this.stalenessConfig = { ...DEFAULT_STALENESS_CONFIG, ...config.stalenessConfig };
    this.spikeConfig = { ...DEFAULT_SPIKE_CONFIG, ...config.spikeConfig };
  }

  get connectionState(): ConnectionState {
    return this.connectionStateInternal;
  }

  /**
   * Connects to the Binance public WebSocket stream.
   */
  async connect(): Promise<void> {
    if (this.connectionStateInternal === 'connected' || this.connectionStateInternal === 'connecting') {
      return;
    }

    this.isIntentionallyClosed = false;
    this.clearTimers();
    this.setConnectionState('connecting');

    try {
      this.socket = this.wsFactory(this.config.baseUrl);
      this.attachSocketListeners(this.socket);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.notifyError(error);
      this.scheduleReconnect('Socket initialization failed');
    }
  }

  /**
   * Disconnects cleanly and terminates any active timers or sockets.
   */
  async disconnect(): Promise<void> {
    this.isIntentionallyClosed = true;
    this.clearTimers();

    if (this.socket) {
      try {
        this.socket.close(1000, 'Normal manual closure');
      } catch {
        // Socket may already be closed
      }
      this.socket = null;
    }

    this.setConnectionState('disconnected', 'Manual disconnect requested');
  }

  /**
   * Subscribes to market data for an array of symbols (e.g. ["BTCUSDT", "ETHUSDT"]).
   * Chunks large symbol batches into groups of 50 to prevent burst frames.
   */
  async subscribe(symbols: string[]): Promise<void> {
    const newSymbols = symbols.filter((s) => !this.subscribedSymbols.has(s));
    if (newSymbols.length === 0) return;

    for (const sym of newSymbols) {
      this.subscribedSymbols.add(sym);
    }

    if (this.connectionStateInternal === 'connected' && this.socket) {
      const chunkSize = 50;
      for (let i = 0; i < newSymbols.length; i += chunkSize) {
        const chunk = newSymbols.slice(i, i + chunkSize);
        const streamParams = chunk.map((s) => this.formatStreamName(s));
        this.sendAppMessage({
          method: 'SUBSCRIBE',
          params: streamParams,
          id: this.nextRequestId++,
        });
      }
    }
  }

  /**
   * Unsubscribes from market data for the specified symbols.
   */
  async unsubscribe(symbols: string[]): Promise<void> {
    const toRemove = symbols.filter((s) => this.subscribedSymbols.has(s));
    if (toRemove.length === 0) return;

    for (const sym of toRemove) {
      this.subscribedSymbols.delete(sym);
    }

    if (this.connectionStateInternal === 'connected' && this.socket) {
      const chunkSize = 50;
      for (let i = 0; i < toRemove.length; i += chunkSize) {
        const chunk = toRemove.slice(i, i + chunkSize);
        const streamParams = chunk.map((s) => this.formatStreamName(s));
        this.sendAppMessage({
          method: 'UNSUBSCRIBE',
          params: streamParams,
          id: this.nextRequestId++,
        });
      }
    }
  }

  onQuote(handler: (quote: MarketPriceQuote) => void): () => void {
    this.quoteListeners.add(handler);
    return () => this.quoteListeners.delete(handler);
  }

  onStatusChange(handler: (state: ConnectionState, reason?: string) => void): () => void {
    this.statusListeners.add(handler);
    return () => this.statusListeners.delete(handler);
  }

  onError(handler: (error: Error) => void): () => void {
    this.errorListeners.add(handler);
    return () => this.errorListeners.delete(handler);
  }

  getLatestQuote(asset: string): MarketPriceQuote | null {
    const quote = this.latestQuotes.get(asset);
    if (!quote) return null;

    // Dynamically update status based on elapsed monotonic time
    const currentMonotonic = this.clock.monotonicNow();
    const currentStatus = evaluateFeedStaleness(
      quote.monotonicReceivedAt,
      currentMonotonic,
      this.stalenessConfig
    );

    return { ...quote, status: currentStatus };
  }

  getLastReliableQuote(asset: string): MarketPriceQuote | null {
    return this.lastReliableQuotes.get(asset) ?? null;
  }

  /** Formats the exchange stream name for a symbol (e.g. btcusdt@bookTicker) */
  protected abstract formatStreamName(symbol: string): string;

  /** Parses a raw incoming WebSocket text message into a quote or null */
  protected abstract parseRawMessage(data: string): MarketPriceQuote | null;

  /**
   * Sends or enqueues an application-level message upstream adhering strictly to the rate limiter.
   * If rate limit is reached, queues the message and flushes it as soon as the sliding window allows,
   * completely preventing burst violations against exchange limits.
   */
  protected sendAppMessage(payload: object): boolean {
    if (!this.socket || this.connectionStateInternal !== 'connected') {
      return false;
    }

    this.messageQueue.push(payload);
    this.drainMessageQueue();
    return true;
  }

  protected drainMessageQueue(): void {
    if (!this.socket || this.connectionStateInternal !== 'connected') {
      return;
    }

    const now = this.clock.now();
    // Prune entries older than 1,000 ms
    const windowStart = now - 1000;
    while (this.upstreamMessageLog.length > 0 && this.upstreamMessageLog[0] <= windowStart) {
      this.upstreamMessageLog.shift();
    }

    while (
      this.messageQueue.length > 0 &&
      this.upstreamMessageLog.length < this.config.maxUpstreamMsgsPerSec
    ) {
      const payload = this.messageQueue.shift()!;
      this.upstreamMessageLog.push(this.clock.now());
      this.socket.send(JSON.stringify(payload));
    }

    if (this.messageQueue.length > 0 && this.drainTimerId === null) {
      const oldest = this.upstreamMessageLog[0] ?? now;
      const waitMs = Math.max(20, oldest + 1005 - now);
      this.drainTimerId = this.clock.setTimeout(() => {
        this.drainTimerId = null;
        this.drainMessageQueue();
      }, waitMs);
    }
  }

  protected attachSocketListeners(socket: IWebSocket): void {
    socket.addEventListener('open', () => {
      this.reconnectAttempts = 0;
      this.setConnectionState('connected');

      // Schedule pre-emptive reconnect before 24h drop (default 23h 50m)
      const maxAgeMs = this.config.maxConnectionAgeMs ?? 23 * 3600 * 1000 + 50 * 60 * 1000;
      this.maxAgeTimerId = this.clock.setTimeout(() => {
        this.rotateConnection('24h maximum connection age pre-emptive rotation');
      }, maxAgeMs);

      // Re-subscribe to all active symbols upon reconnection
      if (this.subscribedSymbols.size > 0) {
        const streamParams = Array.from(this.subscribedSymbols).map((s) => this.formatStreamName(s));
        this.sendAppMessage({
          method: 'SUBSCRIBE',
          params: streamParams,
          id: this.nextRequestId++,
        });
      }
    });

    socket.addEventListener('message', (event) => {
      try {
        const text = typeof event.data === 'string' ? event.data : String(event.data);
        const quote = this.parseRawMessage(text);
        if (quote) {
          this.handleIncomingQuote(quote);
        }
      } catch (err) {
        this.notifyError(err instanceof Error ? err : new Error(String(err)));
      }
    });

    socket.addEventListener('close', (event) => {
      this.clearTimers();
      this.socket = null;

      if (!this.isIntentionallyClosed) {
        this.scheduleReconnect(`Socket closed by server (code ${event.code}: ${event.reason || 'No reason provided'})`);
      } else {
        this.setConnectionState('disconnected', 'Socket closed intentionally');
      }
    });

    socket.addEventListener('error', (event) => {
      const error = new Error(`WebSocket error on ${this.id}: ${JSON.stringify(event)}`);
      this.notifyError(error);
    });
  }

  protected handleIncomingQuote(quote: MarketPriceQuote): void {
    // 1. Store latest quote
    this.latestQuotes.set(quote.asset, quote);

    // 2. Track last reliable quote if not flagged as a spike
    if (!quote.isSpike) {
      this.lastReliableQuotes.set(quote.asset, quote);
    }

    // 3. Notify subscribers
    for (const listener of this.quoteListeners) {
      try {
        listener(quote);
      } catch (err) {
        console.error(`[${this.id}] Error in quote listener:`, err);
      }
    }
  }

  protected scheduleReconnect(reason: string): void {
    if (this.isIntentionallyClosed) return;

    this.reconnectAttempts++;
    this.setConnectionState('reconnecting', reason);

    const baseDelay = this.config.reconnectBaseDelayMs ?? 500;
    const maxDelay = this.config.reconnectMaxDelayMs ?? 10_000;
    // Exponential backoff with random jitter between 100ms and 1000ms
    const exponential = Math.min(maxDelay, baseDelay * Math.pow(1.5, this.reconnectAttempts));
    const jitter = Math.floor(Math.random() * 900) + 100;
    const delay = exponential + jitter;

    this.reconnectTimerId = this.clock.setTimeout(() => {
      this.connect();
    }, delay);
  }

  protected rotateConnection(reason: string): void {
    if (this.socket) {
      try {
        this.socket.close(1000, reason);
      } catch {
        // Ignore
      }
      this.socket = null;
    }
    this.scheduleReconnect(reason);
  }

  protected setConnectionState(state: ConnectionState, reason?: string): void {
    if (this.connectionStateInternal === state) return;
    this.connectionStateInternal = state;
    for (const listener of this.statusListeners) {
      try {
        listener(state, reason);
      } catch (err) {
        console.error(`[${this.id}] Error in status listener:`, err);
      }
    }
  }

  protected notifyError(error: Error): void {
    for (const listener of this.errorListeners) {
      try {
        listener(error);
      } catch (err) {
        console.error(`[${this.id}] Error in error listener:`, err);
      }
    }
  }

  protected clearTimers(): void {
    if (this.reconnectTimerId !== null) {
      this.clock.clearTimeout(this.reconnectTimerId);
      this.reconnectTimerId = null;
    }
    if (this.maxAgeTimerId !== null) {
      this.clock.clearTimeout(this.maxAgeTimerId);
      this.maxAgeTimerId = null;
    }
    if (this.drainTimerId !== null) {
      this.clock.clearTimeout(this.drainTimerId);
      this.drainTimerId = null;
    }
  }
}
