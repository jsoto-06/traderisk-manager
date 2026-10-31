// =============================================================================
// TradeRisk Manager — Comprehensive Risk Engine Audit Tests
// =============================================================================

import { describe, it, expect } from 'vitest';
import { calculateRisk } from '@/lib/risk-engine';
import { InstrumentType } from '@/lib/types';

describe('Risk Engine — Mathematical & Functional Audit', () => {
  describe('Long Positions & Position Sizing', () => {
    it('calculates correct position size for BTC Long with riskPercent', () => {
      // Account: 5000 USD, Risk: 0.40% ($20), Entry: 80000, SL: 79000, TP: 83000
      // SL distance = 1000
      // Position size = 20 / 1000 = 0.02 BTC
      const result = calculateRisk({
        accountBalance: 5000,
        riskPercent: 0.4,
        entryPrice: 80000,
        stopLoss: 79000,
        takeProfit: 83000,
        direction: 'long',
        instrumentType: InstrumentType.Spot,
      });

      expect(result.riskAmount).toBeCloseTo(20, 2);
      expect(result.riskPercent).toBeCloseTo(0.4, 2);
      expect(result.stopLossDistance).toBe(1000);
      expect(result.stopLossPercent).toBeCloseTo(1.25, 2); // 1000 / 80000 = 1.25%
      expect(result.positionSize).toBeCloseTo(0.02, 4);
      expect(result.notionalValue).toBeCloseTo(1600, 2); // 0.02 * 80000 = 1600
      expect(result.potentialProfit).toBeCloseTo(60, 2); // 0.02 * 3000 = 60
      expect(result.potentialLoss).toBeCloseTo(20, 2); // 0.02 * 1000 = 20
      expect(result.riskRewardRatio).toBeCloseTo(3, 2); // 3000 / 1000 = 3.0
    });

    it('calculates correct position size with fixed riskAmount', () => {
      // Account: 10000 USD, fixed risk: 150 USD, Entry: 100, SL: 95
      // SL distance = 5
      // Position size = 150 / 5 = 30 units
      const result = calculateRisk({
        accountBalance: 10000,
        riskAmount: 150,
        entryPrice: 100,
        stopLoss: 95,
        direction: 'long',
        instrumentType: InstrumentType.Spot,
      });

      expect(result.riskAmount).toBe(150);
      expect(result.riskPercent).toBeCloseTo(1.5, 2);
      expect(result.positionSize).toBe(30);
      expect(result.notionalValue).toBe(3000);
    });
  });

  describe('Short Positions & Symmetry', () => {
    it('calculates correct position size for ETH Short', () => {
      // Account: 10000 USD, Risk: 1% ($100), Entry: 3000, SL: 3100, TP: 2700
      // SL distance = 100
      // Position size = 100 / 100 = 1.0 ETH
      const result = calculateRisk({
        accountBalance: 10000,
        riskPercent: 1.0,
        entryPrice: 3000,
        stopLoss: 3100,
        takeProfit: 2700,
        direction: 'short',
        instrumentType: InstrumentType.Spot,
      });

      expect(result.riskAmount).toBe(100);
      expect(result.stopLossDistance).toBe(100);
      expect(result.positionSize).toBe(1);
      expect(result.potentialProfit).toBe(300);
      expect(result.potentialLoss).toBe(100);
      expect(result.riskRewardRatio).toBe(3);
    });
  });

  describe('Leverage vs Notional vs Margin Invariance', () => {
    it('proves that leverage ONLY scales estimated margin and DOES NOT alter potential loss or position size', () => {
      const baseInput = {
        accountBalance: 10000,
        riskAmount: 100,
        entryPrice: 50,
        stopLoss: 45,
        takeProfit: 65,
        direction: 'long' as const,
        instrumentType: InstrumentType.Spot,
      };

      const result1x = calculateRisk({ ...baseInput, leverage: 1 });
      const result5x = calculateRisk({ ...baseInput, leverage: 5 });
      const result20x = calculateRisk({ ...baseInput, leverage: 20 });
      const result50x = calculateRisk({ ...baseInput, leverage: 50 });

      // Position size and potential loss MUST remain identical regardless of leverage
      expect(result1x.positionSize).toBe(20);
      expect(result5x.positionSize).toBe(20);
      expect(result20x.positionSize).toBe(20);
      expect(result50x.positionSize).toBe(20);

      expect(result1x.potentialLoss).toBe(100);
      expect(result5x.potentialLoss).toBe(100);
      expect(result20x.potentialLoss).toBe(100);
      expect(result50x.potentialLoss).toBe(100);

      expect(result1x.notionalValue).toBe(1000); // 20 * 50 = 1000
      expect(result5x.notionalValue).toBe(1000);
      expect(result20x.notionalValue).toBe(1000);

      // Estimated margin MUST scale strictly as notionalValue / leverage
      expect(result1x.estimatedMargin).toBe(1000); // 1000 / 1
      expect(result5x.estimatedMargin).toBe(200);  // 1000 / 5
      expect(result20x.estimatedMargin).toBe(50);  // 1000 / 20
      expect(result50x.estimatedMargin).toBe(20);  // 1000 / 50
    });
  });

  describe('Commissions & Net Expectations', () => {
    it('accurately computes opening and closing commissions for profit and loss exits', () => {
      // Entry: 100, SL: 90, TP: 120, Size: 10
      // Notional open = 10 * 100 = 1000
      // Notional TP exit = 10 * 120 = 1200
      // Commission rate = 0.1% (0.001)
      // Open comm = 1000 * 0.001 = 1.0
      // TP close comm = 1200 * 0.001 = 1.2
      // Total comm for profit = 2.2
      // Gross profit = 10 * 20 = 200 => Net profit = 200 - 2.2 = 197.8
      const result = calculateRisk({
        accountBalance: 5000,
        riskAmount: 100,
        entryPrice: 100,
        stopLoss: 90,
        takeProfit: 120,
        direction: 'long',
        commission: 0.1,
        instrumentType: InstrumentType.Spot,
      });

      expect(result.estimatedCommissions).toBeCloseTo(2.2, 4);
      expect(result.netProfit).toBeCloseTo(197.8, 4);

      // Loss exit notional = 10 * 90 = 900
      // Loss close comm = 900 * 0.001 = 0.9
      // Total loss with comm = -(100 + 1.0 + 0.9) = -101.9
      expect(result.netLoss).toBeCloseTo(-101.9, 4);
    });
  });

  describe('Extreme & Micro Edge Cases', () => {
    it('handles micro positions with high precision (e.g., penny stock or small crypto)', () => {
      const result = calculateRisk({
        accountBalance: 100,
        riskAmount: 0.5, // 50 cents
        entryPrice: 0.0045,
        stopLoss: 0.0040,
        direction: 'long',
        instrumentType: InstrumentType.Spot,
      });

      expect(result.positionSize).toBeCloseTo(1000, 2); // 0.5 / 0.0005 = 1000 units
      expect(result.notionalValue).toBeCloseTo(4.5, 2);
    });

    it('handles high value assets with tight stops without precision loss', () => {
      const result = calculateRisk({
        accountBalance: 1000000,
        riskPercent: 0.25, // $2,500
        entryPrice: 95000,
        stopLoss: 94750, // 250 point SL
        direction: 'long',
        instrumentType: InstrumentType.Spot,
      });

      expect(result.riskAmount).toBe(2500);
      expect(result.positionSize).toBe(10); // 2500 / 250 = 10 BTC
      expect(result.notionalValue).toBe(950000);
    });

    it('handles trade without take profit gracefully', () => {
      const result = calculateRisk({
        accountBalance: 5000,
        riskAmount: 50,
        entryPrice: 100,
        stopLoss: 95,
        direction: 'long',
        instrumentType: InstrumentType.Spot,
      });

      expect(result.potentialProfit).toBe(0);
      expect(result.riskRewardRatio).toBe(0);
      expect(result.positionSize).toBe(10);
    });
  });

  describe('Validation & Error Handling', () => {
    it('throws when neither riskPercent nor riskAmount is provided', () => {
      expect(() =>
        calculateRisk({
          accountBalance: 5000,
          entryPrice: 100,
          stopLoss: 90,
          direction: 'long',
          instrumentType: InstrumentType.Spot,
        }),
      ).toThrow(/Either riskPercent or riskAmount/i);
    });

    it('throws for Long if Stop Loss is equal to or greater than Entry', () => {
      expect(() =>
        calculateRisk({
          accountBalance: 5000,
          riskAmount: 50,
          entryPrice: 100,
          stopLoss: 100,
          direction: 'long',
          instrumentType: InstrumentType.Spot,
        }),
      ).toThrow(/stopLoss.*must be below entryPrice/i);
    });

    it('throws for Short if Stop Loss is equal to or lower than Entry', () => {
      expect(() =>
        calculateRisk({
          accountBalance: 5000,
          riskAmount: 50,
          entryPrice: 100,
          stopLoss: 100,
          direction: 'short',
          instrumentType: InstrumentType.Spot,
        }),
      ).toThrow(/stopLoss.*must be above entryPrice/i);
    });

    it('throws for Long if Take Profit is below or equal to Entry', () => {
      expect(() =>
        calculateRisk({
          accountBalance: 5000,
          riskAmount: 50,
          entryPrice: 100,
          stopLoss: 90,
          takeProfit: 95,
          direction: 'long',
          instrumentType: InstrumentType.Spot,
        }),
      ).toThrow(/takeProfit.*must be above entryPrice/i);
    });

    it('throws for Short if Take Profit is above or equal to Entry', () => {
      expect(() =>
        calculateRisk({
          accountBalance: 5000,
          riskAmount: 50,
          entryPrice: 100,
          stopLoss: 110,
          takeProfit: 105,
          direction: 'short',
          instrumentType: InstrumentType.Spot,
        }),
      ).toThrow(/takeProfit.*must be below entryPrice/i);
    });

    it('throws for non-supported instrument types', () => {
      expect(() =>
        calculateRisk({
          accountBalance: 5000,
          riskAmount: 50,
          entryPrice: 100,
          stopLoss: 90,
          direction: 'long',
          instrumentType: InstrumentType.Multiplier,
        }),
      ).toThrow(/not yet implemented/i);
    });
  });
});
