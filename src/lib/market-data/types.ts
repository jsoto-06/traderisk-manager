// =============================================================================
// TradeRisk Manager — Real-Time Market Data Contracts (Fase 8.1)
// =============================================================================

/** Health status of market data for a given instrument */
export type FeedStatus = 'live' | 'stale' | 'offline' | 'manual';

/** Connection lifecycle state of the underlying transport */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

/** Supported public market data providers */
export type ProviderId = 'binance_spot' | 'binance_usdm' | 'binance_coinm';

/** Classification of financial derivatives contracts */
export type ContractType = 'spot' | 'perpetual' | 'delivery';

/**
 * Normalized market quote representing a bid/ask snapshot for an instrument.
 * Purely read-only; no private credentials or order routing.
 */
export interface MarketPriceQuote {
  /** Normalized display symbol, e.g. "BTC/USDT", "BTC/USD:PERP", "BTC/USD:260327" */
  asset: string;
  /** Raw exchange symbol, e.g. "BTCUSDT", "BTCUSD_PERP", "BTCUSD_260327" */
  rawSymbol: string;
  /** Originating market data adapter */
  provider: ProviderId;
  /** Financial contract category */
  contractType: ContractType;
  /** Best bid price */
  bid: number;
  /** Volume available at best bid */
  bidQty?: number;
  /** Best ask price */
  ask: number;
  /** Volume available at best ask */
  askQty?: number;
  /** Arithmetic mid price: (bid + ask) / 2 */
  mid: number;
  /** Spread: ask - bid (always >= 0 in valid markets) */
  spread: number;
  /** Sequential order book update identifier (u field in Binance bookTicker) */
  updateId: number;
  /** Exchange-reported event timestamp in ms UTC (absent in Spot bookTicker) */
  exchangeEventTime?: number;
  /** Transaction execution timestamp in ms UTC (T field in Futures) */
  transactionTime?: number;
  /** Local system timestamp when the event was received: Date.now() */
  localReceivedAt: number;
  /** Monotonic elapsed timestamp: performance.now() for jitter and stale calculations */
  monotonicReceivedAt: number;
  /** Health status of this quote */
  status: FeedStatus;
  /** True if this tick was flagged by the spike detection heuristic */
  isSpike?: boolean;
  /** Explanation if flagged as suspect spike */
  spikeReason?: string;
  /** The last confirmed reliable quote, retained for critical risk/margin calculations */
  lastReliableQuote?: Omit<MarketPriceQuote, 'lastReliableQuote'>;
  /** Binance universe/margin asset identifier: 1 = USDS-M, 2 = COIN-M */
  st?: number;
  /** Underlying pair symbol when reported (ps field in Coin-M, e.g. "BTCUSD") */
  pairSymbol?: string;
  /** Formatted delivery expiration date for delivery contracts, e.g. "2026-03-27" */
  deliveryDate?: string;
}

/** Error codes for market data validation */
export type ValidationErrorCode =
  | 'INVALID_NUMERIC'
  | 'CROSSED_BOOK'
  | 'UPDATE_ID_OUT_OF_ORDER'
  | 'TIMESTAMP_OUT_OF_ORDER'
  | 'FUTURE_TIMESTAMP_EXCEEDED'
  | 'SUSPECT_SPIKE';

/** Result of validating a price structure or temporal sequence */
export interface ValidationResult {
  isValid: boolean;
  errorCode?: ValidationErrorCode;
  reason?: string;
}

/** Configuration options for the spike detection heuristic */
export interface SpikeDetectionConfig {
  /** Maximum allowed percentage jump from last reliable mid price (default 10%) */
  thresholdPercent: number;
  /** Number of consecutive consistent ticks required to confirm a new price level (default 3) */
  confirmationTicksRequired: number;
  /** Percentage tolerance allowed between consecutive confirmation ticks (default 2%) */
  confirmationTolerancePercent: number;
}

/** Configuration options for feed staleness watchdog */
export interface StalenessConfig {
  /** Milliseconds without a quote before state transitions to STALE (default 5,000 ms) */
  staleThresholdMs: number;
  /** Milliseconds without a quote before state transitions to OFFLINE (default 30,000 ms) */
  offlineThresholdMs: number;
}

export interface WebSocketMessageEvent {
  data: unknown;
}

export interface WebSocketCloseEvent {
  code: number;
  reason: string;
}

/** WebSocket interface abstraction for dependency injection in unit tests */
export interface IWebSocket {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: 'open', listener: (event: unknown) => void): void;
  addEventListener(type: 'message', listener: (event: WebSocketMessageEvent) => void): void;
  addEventListener(type: 'close', listener: (event: WebSocketCloseEvent) => void): void;
  addEventListener(type: 'error', listener: (event: unknown) => void): void;
  addEventListener(type: string, listener: (event: unknown) => void): void;
  removeEventListener(type: string, listener: (event: unknown) => void): void;
}

/** Factory for creating WebSocket instances */
export type WebSocketFactory = (url: string) => IWebSocket;

/** Clock abstraction for deterministic time testing */
export interface IClock {
  now(): number;
  monotonicNow(): number;
  setTimeout(handler: () => void, timeoutMs: number): number;
  clearTimeout(id: number): void;
}

/** Common interface for all market data providers */
export interface MarketDataProvider {
  readonly id: ProviderId;
  readonly connectionState: ConnectionState;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  subscribe(symbols: string[]): Promise<void>;
  unsubscribe(symbols: string[]): Promise<void>;
  onQuote(handler: (quote: MarketPriceQuote) => void): () => void;
  onStatusChange(handler: (state: ConnectionState, reason?: string) => void): () => void;
  onError(handler: (error: Error) => void): () => void;
  getLatestQuote(asset: string): MarketPriceQuote | null;
  getLastReliableQuote(asset: string): MarketPriceQuote | null;
}
