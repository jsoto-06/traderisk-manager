// =============================================================================
// TradeRisk Manager — Market Data Validation Engine (Fase 8.1)
// =============================================================================

import {
  FeedStatus,
  SpikeDetectionConfig,
  StalenessConfig,
  ValidationResult,
} from './types';

export const DEFAULT_STALENESS_CONFIG: StalenessConfig = {
  staleThresholdMs: 5_000,
  offlineThresholdMs: 30_000,
};

export const DEFAULT_SPIKE_CONFIG: SpikeDetectionConfig = {
  thresholdPercent: 10.0,
  confirmationTicksRequired: 3,
  confirmationTolerancePercent: 2.0,
};

/**
 * Validates the structural integrity of bid and ask prices.
 * - Enforces positive, finite numeric types.
 * - Explicitly permits zero spread (ask === bid) for zero-fee or stablecoin pairs.
 * - Strictly rejects crossed book conditions (bid > ask).
 */
export function validatePriceStructure(bid: number, ask: number): ValidationResult {
  if (
    typeof bid !== 'number' ||
    typeof ask !== 'number' ||
    !Number.isFinite(bid) ||
    !Number.isFinite(ask) ||
    bid <= 0 ||
    ask <= 0
  ) {
    return {
      isValid: false,
      errorCode: 'INVALID_NUMERIC',
      reason: `Prices must be strictly positive finite numbers. Received bid=${bid}, ask=${ask}`,
    };
  }

  if (bid > ask) {
    return {
      isValid: false,
      errorCode: 'CROSSED_BOOK',
      reason: `Crossed order book detected: bid (${bid}) is strictly greater than ask (${ask})`,
    };
  }

  return { isValid: true };
}

/**
 * Validates the temporal ordering and freshness of incoming ticks.
 * - Preserves equal exchange timestamps (exchangeEventTime === lastExchangeEventTime) for high-frequency events.
 * - Strictly rejects backwards/out-of-order timestamps when reported by the exchange.
 * - Verifies monotonic updateId ordering when provided.
 * - Rejects timestamps that claim to be in the far future relative to local clock.
 */
export function validateTemporalOrdering(params: {
  updateId: number;
  lastUpdateId?: number;
  exchangeEventTime?: number;
  lastExchangeEventTime?: number;
  localReceivedAt: number;
  maxFutureToleranceMs?: number;
}): ValidationResult {
  const {
    updateId,
    lastUpdateId,
    exchangeEventTime,
    lastExchangeEventTime,
    localReceivedAt,
    maxFutureToleranceMs = 2_000,
  } = params;

  // 1. Validate updateId monotonicity if provided
  if (lastUpdateId !== undefined && updateId < lastUpdateId) {
    return {
      isValid: false,
      errorCode: 'UPDATE_ID_OUT_OF_ORDER',
      reason: `Order book updateId ${updateId} is older than last processed updateId ${lastUpdateId}`,
    };
  }

  // 2. Validate exchange timestamp if provided (USD-M, Coin-M)
  if (exchangeEventTime !== undefined) {
    if (!Number.isFinite(exchangeEventTime) || exchangeEventTime <= 0) {
      return {
        isValid: false,
        errorCode: 'INVALID_NUMERIC',
        reason: `Exchange event time must be a positive finite integer. Received ${exchangeEventTime}`,
      };
    }

    // Out of order: earlier than previously processed timestamp
    if (lastExchangeEventTime !== undefined && exchangeEventTime < lastExchangeEventTime) {
      return {
        isValid: false,
        errorCode: 'TIMESTAMP_OUT_OF_ORDER',
        reason: `Exchange event time ${exchangeEventTime} is strictly earlier than last processed ${lastExchangeEventTime}`,
      };
    }

    // Future timestamp check: cannot exceed local clock + tolerance
    if (exchangeEventTime > localReceivedAt + maxFutureToleranceMs) {
      return {
        isValid: false,
        errorCode: 'FUTURE_TIMESTAMP_EXCEEDED',
        reason: `Exchange event time ${exchangeEventTime} exceeds local receipt time ${localReceivedAt} by more than ${maxFutureToleranceMs}ms`,
      };
    }
  }

  return { isValid: true };
}

/**
 * Evaluates the freshness status of an instrument quote based on elapsed monotonic time.
 */
export function evaluateFeedStaleness(
  lastQuoteMonotonicMs: number,
  currentMonotonicMs: number,
  config: StalenessConfig = DEFAULT_STALENESS_CONFIG
): FeedStatus {
  if (!Number.isFinite(lastQuoteMonotonicMs) || lastQuoteMonotonicMs <= 0) {
    return 'offline';
  }

  const elapsedMs = Math.max(0, currentMonotonicMs - lastQuoteMonotonicMs);

  if (elapsedMs <= config.staleThresholdMs) {
    return 'live';
  }

  if (elapsedMs <= config.offlineThresholdMs) {
    return 'stale';
  }

  return 'offline';
}

/**
 * Heuristic State Machine for Suspect Spike Detection and 3-Tick Confirmation.
 * - Detects jumps > thresholdPercent relative to last confirmed reliable mid price.
 * - Does not silently drop suspect ticks; tags them as suspect.
 * - Requires 3 consecutive ticks within confirmationTolerancePercent to adopt the new price level.
 */
export class SpikeDetector {
  private lastReliableMid: number | null = null;
  private pendingConfirmationTicks: number[] = [];
  private readonly config: SpikeDetectionConfig;

  constructor(config: Partial<SpikeDetectionConfig> = {}) {
    this.config = { ...DEFAULT_SPIKE_CONFIG, ...config };
  }

  /** Gets the last verified reliable mid price */
  getLastReliableMid(): number | null {
    return this.lastReliableMid;
  }

  /** Manually resets or seeds the detector with a known price */
  reset(seedPrice?: number): void {
    this.lastReliableMid = seedPrice !== undefined && Number.isFinite(seedPrice) ? seedPrice : null;
    this.pendingConfirmationTicks = [];
  }

  /**
   * Evaluates an incoming mid price tick against the spike heuristic.
   */
  evaluate(currentMid: number): {
    isSpike: boolean;
    confirmedNewReliable: boolean;
    reason?: string;
  } {
    if (!Number.isFinite(currentMid) || currentMid <= 0) {
      return {
        isSpike: true,
        confirmedNewReliable: false,
        reason: 'INVALID_PRICE_NON_POSITIVE',
      };
    }

    // Initial tick: establish baseline
    if (this.lastReliableMid === null) {
      this.lastReliableMid = currentMid;
      this.pendingConfirmationTicks = [];
      return {
        isSpike: false,
        confirmedNewReliable: true,
      };
    }

    // Calculate percentage jump from last reliable mid
    const jumpPercent = (Math.abs(currentMid - this.lastReliableMid) / this.lastReliableMid) * 100;

    // Normal tick within acceptable tolerance:
    if (jumpPercent <= this.config.thresholdPercent) {
      this.lastReliableMid = currentMid;
      this.pendingConfirmationTicks = [];
      return {
        isSpike: false,
        confirmedNewReliable: true,
      };
    }

    // Suspect jump detected:
    // Check if this tick is coherent with pending confirmation buffer
    if (this.pendingConfirmationTicks.length === 0) {
      // First suspect tick: initiate confirmation sequence
      this.pendingConfirmationTicks.push(currentMid);
      return {
        isSpike: true,
        confirmedNewReliable: false,
        reason: `Jump of ${jumpPercent.toFixed(2)}% exceeds threshold ${this.config.thresholdPercent}%. Pending confirmation (1/${this.config.confirmationTicksRequired})`,
      };
    }

    // Compare with the first tick of the suspected plateau
    const anchorTick = this.pendingConfirmationTicks[0];
    const diffFromAnchorPercent = (Math.abs(currentMid - anchorTick) / anchorTick) * 100;

    if (diffFromAnchorPercent <= this.config.confirmationTolerancePercent) {
      // Coherent with the suspected new level
      this.pendingConfirmationTicks.push(currentMid);

      if (this.pendingConfirmationTicks.length >= this.config.confirmationTicksRequired) {
        // Confirmed! 3 consecutive ticks established the new plateau
        this.lastReliableMid = currentMid;
        this.pendingConfirmationTicks = [];
        return {
          isSpike: false,
          confirmedNewReliable: true,
          reason: `Price movement confirmed by ${this.config.confirmationTicksRequired} consecutive coherent ticks`,
        };
      }

      return {
        isSpike: true,
        confirmedNewReliable: false,
        reason: `Suspect tick coherent with new level. Pending confirmation (${this.pendingConfirmationTicks.length}/${this.config.confirmationTicksRequired})`,
      };
    }

    // Incoherent fluctuation: reset confirmation buffer to this new tick
    this.pendingConfirmationTicks = [currentMid];
    return {
      isSpike: true,
      confirmedNewReliable: false,
      reason: `Suspect tick fluctuated by ${diffFromAnchorPercent.toFixed(2)}% > tolerance ${this.config.confirmationTolerancePercent}%. Confirmation buffer reset (1/${this.config.confirmationTicksRequired})`,
    };
  }
}
