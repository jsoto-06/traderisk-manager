// =============================================================================
// TradeRisk Manager — Binance Market Data Module Exports (Fase 8.1)
// =============================================================================

export * from './base-adapter';
export * from './spot-adapter';
export * from './usdm-adapter';
export * from './coinm-adapter';

import { ProviderId } from '../types';
import { BinanceBaseAdapter } from './base-adapter';
import { BinanceCoinmAdapter, BinanceCoinmAdapterOptions } from './coinm-adapter';
import { BinanceSpotAdapter, BinanceSpotAdapterOptions } from './spot-adapter';
import { BinanceUsdmAdapter, BinanceUsdmAdapterOptions } from './usdm-adapter';

export type AnyBinanceAdapterOptions =
  | BinanceSpotAdapterOptions
  | BinanceUsdmAdapterOptions
  | BinanceCoinmAdapterOptions;

/**
 * Factory function to instantiate public Binance market data adapters.
 */
export function createBinanceAdapter(
  provider: ProviderId,
  options?: AnyBinanceAdapterOptions
): BinanceBaseAdapter {
  switch (provider) {
    case 'binance_spot':
      return new BinanceSpotAdapter(options as BinanceSpotAdapterOptions);
    case 'binance_usdm':
      return new BinanceUsdmAdapter(options as BinanceUsdmAdapterOptions);
    case 'binance_coinm':
      return new BinanceCoinmAdapter(options as BinanceCoinmAdapterOptions);
    default: {
      const exhaustiveCheck: never = provider;
      throw new Error(`Unsupported Binance provider ID: ${exhaustiveCheck}`);
    }
  }
}
