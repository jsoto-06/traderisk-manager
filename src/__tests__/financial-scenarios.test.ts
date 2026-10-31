// =============================================================================
// TradeRisk Manager — Financial Scenarios & Quant Validation Tests
// =============================================================================

import { describe, it, expect } from 'vitest';
import { calculateRisk } from '@/lib/risk-engine';
import { InstrumentType } from '@/lib/types';

describe('Financial Scenarios & Quant Benchmarks Audit', () => {
  // ---------------------------------------------------------------------------
  // 1. BTC / USD High-Value Asset with Fractional Sizing
  // ---------------------------------------------------------------------------
  describe('BTC / USD Benchmark', () => {
    it('matches exact manual quant calculation for BTC Long', () => {
      // Setup:
      // Account Capital: $10,000 USD
      // Risk: 1% ($100.00)
      // Entry: $65,000.00 | Stop Loss: $63,500.00 | Take Profit: $69,500.00
      // Leverage: 10x | Commission: 0.05%
      //
      // Manual Quant Steps:
      // 1. SL Distance = |65000 - 63500| = $1,500.00 (2.3077%)
      // 2. TP Distance = |69500 - 65000| = $4,500.00 (6.9231%)
      // 3. Position Size = 100 / 1500 = 0.0666666667 BTC
      // 4. Notional Value = 0.0666666667 * 65000 = $4,333.3333 USD
      // 5. Margin @ 10x = 4333.3333 / 10 = $433.3333 USD
      // 6. Gross Potential Profit = 0.0666666667 * 4500 = $300.00 USD
      // 7. Gross Potential Loss = 0.0666666667 * 1500 = $100.00 USD
      // 8. Gross R:R = 4500 / 1500 = 3.00
      // 9. Open Commission = 0.0005 * 4333.3333 = $2.1667 USD
      // 10. Close TP Commission = 0.0005 * (0.0666666667 * 69500) = $2.3167 USD
      // 11. Close SL Commission = 0.0005 * (0.0666666667 * 63500) = $2.1167 USD
      // 12. Total TP Commissions = 2.1667 + 2.3167 = $4.4833 USD
      // 13. Total SL Commissions = 2.1667 + 2.1167 = $4.2833 USD
      // 14. Net Profit = 300 - 4.4833 = $295.5167 USD
      // 15. Net Loss = -(100 + 4.2833) = -$104.2833 USD
      // 16. Net Real R:R = 295.5167 / 104.2833 = 2.8338

      const result = calculateRisk({
        accountBalance: 10000,
        riskPercent: 1.0,
        entryPrice: 65000,
        stopLoss: 63500,
        takeProfit: 69500,
        direction: 'long',
        commission: 0.05,
        leverage: 10,
        instrumentType: InstrumentType.Spot,
      });

      expect(result.riskAmount).toBeCloseTo(100.0, 2);
      expect(result.stopLossDistance).toBe(1500.0);
      expect(result.positionSize).toBeCloseTo(0.0666667, 6);
      expect(result.notionalValue).toBeCloseTo(4333.3333, 2);
      expect(result.estimatedMargin).toBeCloseTo(433.3333, 2);
      expect(result.potentialProfit).toBeCloseTo(300.0, 2);
      expect(result.potentialLoss).toBeCloseTo(100.0, 2);
      expect(result.riskRewardRatio).toBeCloseTo(3.0, 2);
      expect(result.estimatedCommissions).toBeCloseTo(4.4833, 3);
      expect(result.lossCommissions).toBeCloseTo(4.2833, 3);
      expect(result.netProfit).toBeCloseTo(295.5167, 2);
      expect(result.netLoss).toBeCloseTo(-104.2833, 2);
      expect(result.netRiskRewardRatio).toBeCloseTo(2.8338, 3);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. ETH / USD Short Position Benchmark
  // ---------------------------------------------------------------------------
  describe('ETH / USD Short Benchmark', () => {
    it('matches exact manual quant calculation for ETH Short', () => {
      // Setup:
      // Capital: $5,000 USD
      // Risk: 0.5% ($25.00)
      // Entry: $3,200.00 | Stop Loss: $3,300.00 | Take Profit: $2,950.00
      // Leverage: 5x | Commission: 0.04%
      //
      // Manual Quant Steps:
      // 1. SL Distance = |3300 - 3200| = $100.00 (3.125%)
      // 2. TP Distance = |3200 - 2950| = $250.00 (7.8125%)
      // 3. Position Size = 25 / 100 = 0.25 ETH
      // 4. Notional Value = 0.25 * 3200 = $800.00 USD
      // 5. Margin @ 5x = 800 / 5 = $160.00 USD
      // 6. Gross Potential Profit = 0.25 * 250 = $62.50 USD
      // 7. Gross Potential Loss = 0.25 * 100 = $25.00 USD
      // 8. Gross R:R = 250 / 100 = 2.50
      // 9. Open Commission = 0.0004 * 800 = $0.32 USD
      // 10. Close TP Commission = 0.0004 * (0.25 * 2950) = $0.295 USD
      // 11. Close SL Commission = 0.0004 * (0.25 * 3300) = $0.33 USD
      // 12. Net Profit = 62.50 - (0.32 + 0.295) = $61.885 USD
      // 13. Net Loss = -(25.00 + 0.32 + 0.33) = -$25.65 USD
      // 14. Net Real R:R = 61.885 / 25.65 = 2.4127

      const result = calculateRisk({
        accountBalance: 5000,
        riskPercent: 0.5,
        entryPrice: 3200,
        stopLoss: 3300,
        takeProfit: 2950,
        direction: 'short',
        commission: 0.04,
        leverage: 5,
        instrumentType: InstrumentType.Spot,
      });

      expect(result.riskAmount).toBe(25.0);
      expect(result.positionSize).toBe(0.25);
      expect(result.notionalValue).toBe(800.0);
      expect(result.estimatedMargin).toBe(160.0);
      expect(result.potentialProfit).toBe(62.5);
      expect(result.potentialLoss).toBe(25.0);
      expect(result.riskRewardRatio).toBe(2.5);
      expect(result.netProfit).toBeCloseTo(61.885, 3);
      expect(result.netLoss).toBeCloseTo(-25.65, 3);
      expect(result.netRiskRewardRatio).toBeCloseTo(2.4127, 3);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Small Decimal Assets (Penny Stocks / Micro Pips / Meme tokens)
  // ---------------------------------------------------------------------------
  describe('Small Decimal Assets Precision', () => {
    it('accurately sizes low-price assets without IEEE-754 precision loss', () => {
      // Entry: 0.00025, SL: 0.00020, TP: 0.00040
      // SL distance = 0.00005
      // Account: 5000 USD, Risk: 2% = 100 USD
      // Position Size = 100 / 0.00005 = 2,000,000 units
      // Notional Value = 2,000,000 * 0.00025 = 500 USD
      // Gross Profit = 2,000,000 * (0.00040 - 0.00025) = 300 USD
      // Gross Loss = 2,000,000 * (0.00025 - 0.00020) = 100 USD

      const result = calculateRisk({
        accountBalance: 5000,
        riskPercent: 2.0,
        entryPrice: 0.00025,
        stopLoss: 0.0002,
        takeProfit: 0.0004,
        direction: 'long',
        instrumentType: InstrumentType.Spot,
      });

      expect(result.stopLossDistance).toBeCloseTo(0.00005, 7);
      expect(result.positionSize).toBeCloseTo(2000000, 0);
      expect(result.notionalValue).toBeCloseTo(500, 2);
      expect(result.potentialProfit).toBeCloseTo(300, 2);
      expect(result.potentialLoss).toBeCloseTo(100, 2);
      expect(result.riskRewardRatio).toBeCloseTo(3.0, 2);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Multiple Capital & Risk Tier Matrix
  // ---------------------------------------------------------------------------
  describe('Account Capital & Risk Tier Matrix', () => {
    const matrix = [
      { balance: 1000, riskPct: 0.25, expectedRisk: 2.5 },
      { balance: 5000, riskPct: 0.5, expectedRisk: 25.0 },
      { balance: 10000, riskPct: 1.0, expectedRisk: 100.0 },
      { balance: 100000, riskPct: 2.0, expectedRisk: 2000.0 },
    ];

    it.each(matrix)(
      'sizes correctly for balance: $balance with risk: $riskPct% -> $expectedRisk',
      ({ balance, riskPct, expectedRisk }) => {
        const result = calculateRisk({
          accountBalance: balance,
          riskPercent: riskPct,
          entryPrice: 100,
          stopLoss: 90, // 10 point distance
          direction: 'long',
          instrumentType: InstrumentType.Spot,
        });

        expect(result.riskAmount).toBeCloseTo(expectedRisk, 2);
        expect(result.positionSize).toBeCloseTo(expectedRisk / 10, 4);
      },
    );
  });

  // ---------------------------------------------------------------------------
  // 5. Leverage Spectrum Matrix (1x, 5x, 10x, 20x, 50x)
  // ---------------------------------------------------------------------------
  describe('Leverage Spectrum Invariance', () => {
    const leverages = [1, 5, 10, 20, 50];

    it.each(leverages)(
      'proves leverage %sx alters only estimatedMargin and preserves potentialLoss',
      (lev) => {
        const result = calculateRisk({
          accountBalance: 10000,
          riskPercent: 1.0, // $100 risk
          entryPrice: 200,
          stopLoss: 195, // 5 point distance
          direction: 'long',
          leverage: lev,
          instrumentType: InstrumentType.Spot,
        });

        // 100 / 5 = 20 units
        expect(result.positionSize).toBe(20);
        // Notional = 20 * 200 = $4,000
        expect(result.notionalValue).toBe(4000);
        // Margin = 4000 / lev
        expect(result.estimatedMargin).toBe(4000 / lev);
        // Potential loss is ALWAYS $100
        expect(result.potentialLoss).toBe(100);
      },
    );
  });

  // ---------------------------------------------------------------------------
  // 6. Insufficient Margin Detection Scenario
  // ---------------------------------------------------------------------------
  describe('Insufficient Margin Detection', () => {
    it('identifies when estimatedMargin exceeds available balance', () => {
      // Balance: $1,000 USD
      // Entry: $100, SL: $99 (1% distance)
      // Risk: 10% ($100 USD)
      // Position size = 100 / 1 = 100 units
      // Notional = 100 * 100 = $10,000 USD
      // Margin @ 1x = $10,000 USD > $1,000 balance!
      const result = calculateRisk({
        accountBalance: 1000,
        riskPercent: 10,
        entryPrice: 100,
        stopLoss: 99,
        direction: 'long',
        leverage: 1,
        instrumentType: InstrumentType.Spot,
      });

      expect(result.estimatedMargin).toBe(10000);
      expect(result.estimatedMargin).toBeGreaterThan(1000);
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Edge Cases: Too Close & Invalid Stop Losses
  // ---------------------------------------------------------------------------
  describe('Stop Loss Edge Validations', () => {
    it('rejects Stop Loss too close to entry (< 1e-8)', () => {
      expect(() =>
        calculateRisk({
          accountBalance: 5000,
          riskPercent: 1.0,
          entryPrice: 100.0,
          stopLoss: 99.99999999999, // distance 1e-11 < 1e-8
          direction: 'long',
          instrumentType: InstrumentType.Spot,
        }),
      ).toThrow(/too close to entry price/i);
    });

    it('rejects invalid Stop Loss on Long (SL >= entry)', () => {
      expect(() =>
        calculateRisk({
          accountBalance: 5000,
          riskPercent: 1.0,
          entryPrice: 100.0,
          stopLoss: 105.0,
          direction: 'long',
          instrumentType: InstrumentType.Spot,
        }),
      ).toThrow(/stopLoss.*must be below entryPrice/i);
    });

    it('rejects invalid Stop Loss on Short (SL <= entry)', () => {
      expect(() =>
        calculateRisk({
          accountBalance: 5000,
          riskPercent: 1.0,
          entryPrice: 100.0,
          stopLoss: 95.0,
          direction: 'short',
          instrumentType: InstrumentType.Spot,
        }),
      ).toThrow(/stopLoss.*must be above entryPrice/i);
    });
  });
});
