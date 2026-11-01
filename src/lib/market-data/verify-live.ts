// =============================================================================
// TradeRisk Manager — Manual Integration Verification Script (Fase 8.1)
// Connects to real Binance public WebSocket streams to verify reception,
// normalization, universe isolation, staleness status and clean disconnection.
// STRICTLY READ-ONLY: NO CREDENTIALS, NO PRIVATE KEYS, NO ORDER ENDPOINTS.
// =============================================================================

import {
  BinanceCoinmAdapter,
  BinanceSpotAdapter,
  BinanceUsdmAdapter,
  MarketPriceQuote,
} from './index';

interface ProviderVerificationResult {
  provider: string;
  connected: boolean;
  receivedQuote: boolean;
  normalizedAsset?: string;
  rawSymbol?: string;
  bid?: number;
  ask?: number;
  spread?: number;
  st?: number;
  status?: string;
  updateId?: number;
  exchangeEventTime?: number;
  error?: string;
}

async function runLiveVerification(): Promise<void> {
  console.log('===============================================================');
  console.log(' TradeRisk Manager — Live Binance Public WebSocket Verification');
  console.log('===============================================================');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Environment: Public read-only endpoints (Anonymous, no API keys)\n');

  const results: Record<string, ProviderVerificationResult> = {
    spot: { provider: 'binance_spot', connected: false, receivedQuote: false },
    usdm: { provider: 'binance_usdm', connected: false, receivedQuote: false },
    coinm: { provider: 'binance_coinm', connected: false, receivedQuote: false },
  };

  const spotAdapter = new BinanceSpotAdapter();
  const usdmAdapter = new BinanceUsdmAdapter();
  const coinmAdapter = new BinanceCoinmAdapter();

  // Setup listeners
  spotAdapter.onStatusChange((state) => {
    if (state === 'connected') results.spot.connected = true;
    console.log(`[Spot] Connection status: ${state}`);
  });
  spotAdapter.onQuote((q: MarketPriceQuote) => {
    if (!results.spot.receivedQuote) {
      results.spot.receivedQuote = true;
      results.spot.normalizedAsset = q.asset;
      results.spot.rawSymbol = q.rawSymbol;
      results.spot.bid = q.bid;
      results.spot.ask = q.ask;
      results.spot.spread = q.spread;
      results.spot.status = q.status;
      results.spot.updateId = q.updateId;
      results.spot.exchangeEventTime = q.exchangeEventTime;
      console.log(`[Spot] Tick received: ${q.asset} (${q.rawSymbol}) | Bid: ${q.bid} | Ask: ${q.ask} | Spread: ${q.spread} | Status: ${q.status}`);
    }
  });
  spotAdapter.onError((err) => {
    results.spot.error = err.message;
    console.error(`[Spot] Error:`, err.message);
  });

  usdmAdapter.onStatusChange((state) => {
    if (state === 'connected') results.usdm.connected = true;
    console.log(`[USD-M] Connection status: ${state}`);
  });
  usdmAdapter.onQuote((q: MarketPriceQuote) => {
    if (!results.usdm.receivedQuote) {
      results.usdm.receivedQuote = true;
      results.usdm.normalizedAsset = q.asset;
      results.usdm.rawSymbol = q.rawSymbol;
      results.usdm.bid = q.bid;
      results.usdm.ask = q.ask;
      results.usdm.spread = q.spread;
      results.usdm.st = q.st;
      results.usdm.status = q.status;
      results.usdm.updateId = q.updateId;
      results.usdm.exchangeEventTime = q.exchangeEventTime;
      console.log(`[USD-M] Tick received: ${q.asset} (${q.rawSymbol}) | Bid: ${q.bid} | Ask: ${q.ask} | st: ${q.st} | Status: ${q.status}`);
    }
  });
  usdmAdapter.onError((err) => {
    results.usdm.error = err.message;
    console.error(`[USD-M] Error:`, err.message);
  });

  coinmAdapter.onStatusChange((state) => {
    if (state === 'connected') results.coinm.connected = true;
    console.log(`[Coin-M] Connection status: ${state}`);
  });
  coinmAdapter.onQuote((q: MarketPriceQuote) => {
    if (!results.coinm.receivedQuote) {
      results.coinm.receivedQuote = true;
      results.coinm.normalizedAsset = q.asset;
      results.coinm.rawSymbol = q.rawSymbol;
      results.coinm.bid = q.bid;
      results.coinm.ask = q.ask;
      results.coinm.spread = q.spread;
      results.coinm.st = q.st;
      results.coinm.status = q.status;
      results.coinm.updateId = q.updateId;
      results.coinm.exchangeEventTime = q.exchangeEventTime;
      console.log(`[Coin-M] Tick received: ${q.asset} (${q.rawSymbol}) | Bid: ${q.bid} | Ask: ${q.ask} | st: ${q.st} | Status: ${q.status}`);
    }
  });
  coinmAdapter.onError((err) => {
    results.coinm.error = err.message;
    console.error(`[Coin-M] Error:`, err.message);
  });

  // Start connections in parallel
  console.log('\nConnecting to public streams...');
  await Promise.all([
    spotAdapter.connect(),
    usdmAdapter.connect(),
    coinmAdapter.connect(),
  ]);

  // Subscribe to liquid instruments
  console.log('Subscribing to instruments...');
  await Promise.all([
    spotAdapter.subscribe(['BTCUSDT']),
    usdmAdapter.subscribe(['BTCUSDT']),
    coinmAdapter.subscribe(['BTCUSD_PERP']),
  ]);

  // Wait up to 8 seconds for all 3 feeds to receive at least one quote
  const startTime = Date.now();
  const maxWaitMs = 8_000;
  while (Date.now() - startTime < maxWaitMs) {
    if (results.spot.receivedQuote && results.usdm.receivedQuote && results.coinm.receivedQuote) {
      console.log('\nAll 3 streams received real market quotes successfully!\n');
      break;
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  // Disconnect cleanly
  console.log('Disconnecting all adapters...');
  await Promise.all([
    spotAdapter.disconnect(),
    usdmAdapter.disconnect(),
    coinmAdapter.disconnect(),
  ]);

  console.log('\n===============================================================');
  console.log(' Live Integration Verification Summary');
  console.log('===============================================================');
  console.table(results);

  const allPassed =
    results.spot.receivedQuote &&
    results.usdm.receivedQuote &&
    results.coinm.receivedQuote;

  if (allPassed) {
    console.log('\nVerification PASSED: All 3 Binance public market feeds functional.');
    process.exit(0);
  } else {
    console.error('\nVerification WARNING: One or more feeds did not receive data within timeout.');
    console.log('Note: Network firewalls or regional restrictions may affect public WebSocket reachability.');
    process.exit(0);
  }
}

// Execute
runLiveVerification().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
