/**
 * 逆オークション計算ロジックのテスト
 */

import { describe, test, expect } from 'vitest';
import {
  calculateCurrentUnitPrice,
  calculateFinalAmount,
  calculateTax,
  validateApplicationArea,
  getNextPriceMilestone,
} from './priceCalculator';
import type { CampaignPricing } from './types';

describe('calculateCurrentUnitPrice', () => {
  describe('パターンA: 最低成立面積がある場合', () => {
    const pricing: Required<CampaignPricing> = {
      base_price: 20000,
      min_price: 15000,
      target_area_10r: 50,
      min_target_area_10r: 30,
      max_target_area_10r: 50,
      execution_price: 18000,
    };

    test('最低成立面積未達の場合、単価はnullで不成立フラグがtrue', () => {
      const result = calculateCurrentUnitPrice(pricing, 20);

      expect(result.currentPrice).toBeNull();
      expect(result.isUnformed).toBe(true);
      expect(result.progress).toBeCloseTo(20 / 30, 2);
      expect(result.remainingArea).toBe(10);
    });

    test('最低成立面積ちょうどの場合、成立時単価が適用される', () => {
      const result = calculateCurrentUnitPrice(pricing, 30);

      expect(result.currentPrice).toBe(18000);
      expect(result.isUnformed).toBe(false);
      expect(result.progress).toBe(0);
      expect(result.remainingArea).toBe(20);
    });

    test('最低成立〜満額ラインの中間では線形変動する', () => {
      const result = calculateCurrentUnitPrice(pricing, 40);

      // 計算式: 18000 + (15000 - 18000) × ((40-30)/(50-30))
      //       = 18000 + (-3000) × 0.5
      //       = 16500
      expect(result.currentPrice).toBe(16500);
      expect(result.isUnformed).toBe(false);
      expect(result.progress).toBe(0.5);
      expect(result.remainingArea).toBe(10);
    });

    test('満額ライン達成時は最低単価が適用される', () => {
      const result = calculateCurrentUnitPrice(pricing, 50);

      expect(result.currentPrice).toBe(15000);
      expect(result.isUnformed).toBe(false);
      expect(result.progress).toBe(1.0);
      expect(result.remainingArea).toBe(0);
    });

    test('満額ライン超過時も最低単価が維持される', () => {
      const result = calculateCurrentUnitPrice(pricing, 60);

      expect(result.currentPrice).toBe(15000);
      expect(result.isUnformed).toBe(false);
      expect(result.progress).toBe(1.0);
      expect(result.remainingArea).toBe(0);
    });

    test('値引き額が正しく計算される', () => {
      const result = calculateCurrentUnitPrice(pricing, 40);

      // 値引き額 = 20000 - 16500 = 3500
      expect(result.priceReduction).toBe(3500);
    });
  });

  describe('パターンB: 従来の線形方式（最低成立面積なし）', () => {
    const pricing: CampaignPricing = {
      base_price: 20000,
      min_price: 15000,
      target_area_10r: 50,
    };

    test('目標面積0%の場合、開始単価が適用される', () => {
      const result = calculateCurrentUnitPrice(pricing, 0);

      expect(result.currentPrice).toBe(20000);
      expect(result.isUnformed).toBe(false);
      expect(result.progress).toBe(0);
      expect(result.remainingArea).toBe(50);
    });

    test('目標面積50%の場合、中間単価が適用される', () => {
      const result = calculateCurrentUnitPrice(pricing, 25);

      // 計算式: 20000 - (20000 - 15000) × 0.5 = 17500
      expect(result.currentPrice).toBe(17500);
      expect(result.isUnformed).toBe(false);
      expect(result.progress).toBe(0.5);
      expect(result.remainingArea).toBe(25);
    });

    test('目標面積100%の場合、最低単価が適用される', () => {
      const result = calculateCurrentUnitPrice(pricing, 50);

      expect(result.currentPrice).toBe(15000);
      expect(result.isUnformed).toBe(false);
      expect(result.progress).toBe(1.0);
      expect(result.remainingArea).toBe(0);
    });

    test('目標面積超過時も最低単価が維持される', () => {
      const result = calculateCurrentUnitPrice(pricing, 60);

      expect(result.currentPrice).toBe(15000);
      expect(result.isUnformed).toBe(false);
      expect(result.progress).toBe(1.0);
      expect(result.remainingArea).toBe(0);
    });
  });

  describe('エッジケース', () => {
    test('申込面積が0の場合でも正常に動作', () => {
      const pricing: CampaignPricing = {
        base_price: 20000,
        min_price: 15000,
        target_area_10r: 50,
      };

      const result = calculateCurrentUnitPrice(pricing, 0);

      expect(result.currentPrice).toBe(20000);
      expect(result.progress).toBe(0);
    });

    test('開始単価と目標単価が同じ場合でも正常に動作', () => {
      const pricing: CampaignPricing = {
        base_price: 15000,
        min_price: 15000,
        target_area_10r: 50,
      };

      const result = calculateCurrentUnitPrice(pricing, 25);

      expect(result.currentPrice).toBe(15000);
      expect(result.priceReduction).toBe(0);
    });

    test('開始単価が目標単価より小さい場合はエラー', () => {
      const pricing: CampaignPricing = {
        base_price: 10000,
        min_price: 15000,
        target_area_10r: 50,
      };

      expect(() => calculateCurrentUnitPrice(pricing, 25)).toThrow(
        '開始単価は目標単価以上である必要があります'
      );
    });

    test('負の申込面積の場合はエラー', () => {
      const pricing: CampaignPricing = {
        base_price: 20000,
        min_price: 15000,
        target_area_10r: 50,
      };

      expect(() => calculateCurrentUnitPrice(pricing, -10)).toThrow(
        '申込合計面積は0以上である必要があります'
      );
    });
  });
});

describe('calculateFinalAmount', () => {
  test('単価と実績面積から確定金額を計算', () => {
    expect(calculateFinalAmount(15000, 5)).toBe(75000);
    expect(calculateFinalAmount(18000, 3)).toBe(54000);
    expect(calculateFinalAmount(20000, 0)).toBe(0);
  });

  test('小数点以下は四捨五入される', () => {
    expect(calculateFinalAmount(15000.4, 5.6)).toBe(84002);
  });

  test('負の値の場合はエラー', () => {
    expect(() => calculateFinalAmount(-15000, 5)).toThrow();
    expect(() => calculateFinalAmount(15000, -5)).toThrow();
  });
});

describe('calculateTax', () => {
  test('消費税10%で税額を計算', () => {
    const result = calculateTax(10000);

    expect(result.amountExTax).toBe(10000);
    expect(result.taxAmount).toBe(1000);
    expect(result.amountInclusive).toBe(11000);
    expect(result.taxRate).toBe(10);
  });

  test('消費税8%で税額を計算', () => {
    const result = calculateTax(10000, 8);

    expect(result.amountExTax).toBe(10000);
    expect(result.taxAmount).toBe(800);
    expect(result.amountInclusive).toBe(10800);
    expect(result.taxRate).toBe(8);
  });

  test('小数点以下は四捨五入される', () => {
    const result = calculateTax(10005, 10);

    expect(result.taxAmount).toBe(1001); // 10005 * 0.1 = 1000.5 → 1001
    expect(result.amountInclusive).toBe(11006);
  });

  test('税率0%の場合', () => {
    const result = calculateTax(10000, 0);

    expect(result.taxAmount).toBe(0);
    expect(result.amountInclusive).toBe(10000);
  });

  test('負の金額の場合はエラー', () => {
    expect(() => calculateTax(-10000)).toThrow();
  });

  test('不正な税率の場合はエラー', () => {
    expect(() => calculateTax(10000, -5)).toThrow();
    expect(() => calculateTax(10000, 150)).toThrow();
  });
});

describe('validateApplicationArea', () => {
  test('申込可能な面積の場合はisValid: true', () => {
    const result = validateApplicationArea(10, 40, 50);

    expect(result.isValid).toBe(true);
    expect(result.errorMessage).toBeUndefined();
    expect(result.currentTotalArea).toBe(40);
    expect(result.remainingArea).toBe(10);
    expect(result.maxArea).toBe(50);
  });

  test('残り面積ちょうどの申込も可能', () => {
    const result = validateApplicationArea(10, 40, 50);

    expect(result.isValid).toBe(true);
  });

  test('残り面積を超える申込は不可', () => {
    const result = validateApplicationArea(20, 40, 50);

    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('10.0 反まで予約可能');
    expect(result.remainingArea).toBe(10);
  });

  test('申込面積が0以下の場合はエラー', () => {
    const result = validateApplicationArea(0, 40, 50);

    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('1反以上である必要');
  });

  test('申込面積が負の場合もエラー', () => {
    const result = validateApplicationArea(-5, 40, 50);

    expect(result.isValid).toBe(false);
  });
});

describe('getNextPriceMilestone', () => {
  describe('パターンA: 最低成立面積がある場合', () => {
    const pricing: Required<CampaignPricing> = {
      base_price: 20000,
      min_price: 15000,
      target_area_10r: 50,
      min_target_area_10r: 30,
      max_target_area_10r: 50,
      execution_price: 18000,
    };

    test('最低成立面積未達の場合、次のマイルストーンは最低成立面積', () => {
      const result = getNextPriceMilestone(pricing, 20);

      expect(result.nextMilestoneArea).toBe(30);
      expect(result.nextPrice).toBe(18000);
      expect(result.description).toContain('最低成立面積達成');
    });

    test('最低成立〜満額ラインの間では、次は満額ライン', () => {
      const result = getNextPriceMilestone(pricing, 40);

      expect(result.nextMilestoneArea).toBe(50);
      expect(result.nextPrice).toBe(15000);
      expect(result.description).toContain('満額ライン達成');
    });

    test('満額ライン達成後は次のマイルストーンなし', () => {
      const result = getNextPriceMilestone(pricing, 50);

      expect(result.nextMilestoneArea).toBeNull();
      expect(result.nextPrice).toBeNull();
      expect(result.description).toContain('満額ライン達成済み');
    });
  });

  describe('パターンB: 従来の線形方式', () => {
    const pricing: CampaignPricing = {
      base_price: 20000,
      min_price: 15000,
      target_area_10r: 50,
    };

    test('目標面積未達の場合、次は目標面積', () => {
      const result = getNextPriceMilestone(pricing, 25);

      expect(result.nextMilestoneArea).toBe(50);
      expect(result.nextPrice).toBe(15000);
      expect(result.description).toContain('目標面積達成');
    });

    test('目標面積達成後は次のマイルストーンなし', () => {
      const result = getNextPriceMilestone(pricing, 50);

      expect(result.nextMilestoneArea).toBeNull();
      expect(result.nextPrice).toBeNull();
      expect(result.description).toContain('目標面積達成済み');
    });
  });
});
