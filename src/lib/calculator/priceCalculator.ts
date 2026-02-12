/**
 * 逆オークション方式の単価計算ロジック
 *
 * GAS版の Calculator.js:23 - calculateCurrentUnitPrice の完全移植
 * 参照: current_system_spec.md:295-358
 */

import type {
  CampaignPricing,
  PriceCalculationResult,
  AmountCalculation,
  ApplicationAreaValidation,
} from './types';

/**
 * 逆オークション方式の単価を計算
 *
 * @param pricing - 案件の価格設定
 * @param totalArea10r - 現在の申込合計面積（10R単位）
 * @returns 計算結果
 *
 * @example
 * // パターンA: 最低成立面積がある場合
 * const result = calculateCurrentUnitPrice(
 *   {
 *     base_price: 20000,
 *     min_price: 15000,
 *     target_area_10r: 50,
 *     min_target_area_10r: 30,
 *     max_target_area_10r: 50,
 *     execution_price: 18000
 *   },
 *   40
 * );
 * // => { currentPrice: 16500, progress: 0.5, isUnformed: false, ... }
 *
 * @example
 * // パターンB: 従来の線形方式
 * const result = calculateCurrentUnitPrice(
 *   {
 *     base_price: 20000,
 *     min_price: 15000,
 *     target_area_10r: 50
 *   },
 *   25
 * );
 * // => { currentPrice: 17500, progress: 0.5, isUnformed: false, ... }
 */
export function calculateCurrentUnitPrice(
  pricing: CampaignPricing,
  totalArea10r: number
): PriceCalculationResult {
  const {
    base_price,
    min_price,
    target_area_10r,
    min_target_area_10r = 0,
    max_target_area_10r,
    execution_price,
  } = pricing;

  // 入力値の検証
  if (base_price < min_price) {
    throw new Error('開始単価は目標単価以上である必要があります');
  }

  if (totalArea10r < 0) {
    throw new Error('申込合計面積は0以上である必要があります');
  }

  // パターンA: 最低成立面積がある場合
  if (
    min_target_area_10r > 0 &&
    max_target_area_10r &&
    max_target_area_10r > 0 &&
    execution_price
  ) {
    return calculateWithMinimumArea(
      pricing as Required<CampaignPricing>,
      totalArea10r
    );
  }

  // パターンB: 従来の線形方式
  return calculateLinearPrice(pricing, totalArea10r);
}

/**
 * パターンA: 最低成立面積がある場合の計算
 * @private
 */
function calculateWithMinimumArea(
  pricing: Required<CampaignPricing>,
  totalArea10r: number
): PriceCalculationResult {
  const {
    base_price,
    min_price,
    min_target_area_10r,
    max_target_area_10r,
    execution_price,
  } = pricing;

  // ケース1: 最低成立面積未達
  if (totalArea10r < min_target_area_10r) {
    const progress = totalArea10r / min_target_area_10r;
    const remainingArea = min_target_area_10r - totalArea10r;

    return {
      currentPrice: null,
      progress,
      isUnformed: true,
      priceReduction: 0,
      remainingArea,
      nextMilestoneArea: remainingArea, // 最低成立までの残り面積
    };
  }

  // ケース2: 満額ライン達成
  if (totalArea10r >= max_target_area_10r) {
    return {
      currentPrice: Math.round(min_price),
      progress: 1.0,
      isUnformed: false,
      priceReduction: base_price - min_price,
      remainingArea: 0,
      nextMilestoneArea: 0,
    };
  }

  // ケース3: 最低成立〜満額ラインの間（線形変動）
  const progressRange = max_target_area_10r - min_target_area_10r;
  const currentRange = totalArea10r - min_target_area_10r;
  const progress = currentRange / progressRange;

  const priceRange = min_price - execution_price;
  const currentPrice = execution_price + priceRange * progress;
  const remainingArea = max_target_area_10r - totalArea10r;

  return {
    currentPrice: Math.round(currentPrice),
    progress,
    isUnformed: false,
    priceReduction: base_price - currentPrice,
    remainingArea,
    nextMilestoneArea: remainingArea, // 満額ラインまでの残り面積
  };
}

/**
 * パターンB: 従来の線形方式の計算
 * @private
 */
function calculateLinearPrice(
  pricing: CampaignPricing,
  totalArea10r: number
): PriceCalculationResult {
  const { base_price, min_price, target_area_10r } = pricing;

  const progress = Math.min(totalArea10r / target_area_10r, 1.0);
  const priceRange = base_price - min_price;
  const currentPrice = base_price - priceRange * progress;
  const remainingArea = Math.max(0, target_area_10r - totalArea10r);

  return {
    currentPrice: Math.round(currentPrice),
    progress,
    isUnformed: false,
    priceReduction: base_price - currentPrice,
    remainingArea,
    nextMilestoneArea: remainingArea > 0 ? remainingArea : undefined,
  };
}

/**
 * 確定金額を計算（税抜）
 *
 * @param unitPrice - 単価（円/10R）
 * @param actualArea10r - 実績面積（10R単位）
 * @returns 確定金額（円、税抜）
 *
 * @example
 * calculateFinalAmount(15000, 5); // => 75000
 */
export function calculateFinalAmount(
  unitPrice: number,
  actualArea10r: number
): number {
  if (unitPrice < 0 || actualArea10r < 0) {
    throw new Error('単価と実績面積は0以上である必要があります');
  }

  return Math.round(unitPrice * actualArea10r);
}

/**
 * 消費税を計算
 *
 * @param amountExTax - 税抜金額（円）
 * @param taxRate - 消費税率（%、デフォルト10%）
 * @returns 税計算結果
 *
 * @example
 * calculateTax(10000); // => { amountExTax: 10000, taxAmount: 1000, amountInclusive: 11000, taxRate: 10 }
 */
export function calculateTax(
  amountExTax: number,
  taxRate: number = 10
): AmountCalculation {
  if (amountExTax < 0) {
    throw new Error('税抜金額は0以上である必要があります');
  }

  if (taxRate < 0 || taxRate > 100) {
    throw new Error('消費税率は0〜100%の範囲である必要があります');
  }

  const taxAmount = Math.round(amountExTax * (taxRate / 100));
  const amountInclusive = amountExTax + taxAmount;

  return {
    amountExTax,
    taxAmount,
    amountInclusive,
    taxRate,
  };
}

/**
 * 申込面積が残り面積内に収まるか検証
 *
 * @param requestedArea10r - 申込希望面積（10R単位）
 * @param currentTotalArea10r - 現在の申込合計面積（10R単位）
 * @param maxArea10r - 満額ライン面積（10R単位）
 * @returns 検証結果
 *
 * @example
 * validateApplicationArea(10, 40, 50);
 * // => { isValid: true, currentTotalArea: 40, remainingArea: 10, maxArea: 50 }
 *
 * validateApplicationArea(20, 40, 50);
 * // => { isValid: false, errorMessage: '申し込み面積が上限を超えています...', ... }
 */
export function validateApplicationArea(
  requestedArea10r: number,
  currentTotalArea10r: number,
  maxArea10r: number
): ApplicationAreaValidation {
  if (requestedArea10r <= 0) {
    return {
      isValid: false,
      errorMessage: '申込面積は1反以上である必要があります',
      currentTotalArea: currentTotalArea10r,
      remainingArea: maxArea10r - currentTotalArea10r,
      maxArea: maxArea10r,
    };
  }

  const remainingArea = maxArea10r - currentTotalArea10r;

  if (requestedArea10r > remainingArea) {
    return {
      isValid: false,
      errorMessage: `申し込み面積が上限を超えています。残り ${remainingArea.toFixed(
        1
      )} 反まで予約可能です。`,
      currentTotalArea: currentTotalArea10r,
      remainingArea,
      maxArea: maxArea10r,
    };
  }

  return {
    isValid: true,
    currentTotalArea: currentTotalArea10r,
    remainingArea,
    maxArea: maxArea10r,
  };
}

/**
 * 次の単価変動マイルストーンまでの情報を取得
 *
 * @param pricing - 案件の価格設定
 * @param totalArea10r - 現在の申込合計面積（10R単位）
 * @returns マイルストーン情報
 */
export function getNextPriceMilestone(
  pricing: CampaignPricing,
  totalArea10r: number
): {
  nextMilestoneArea: number | null;
  nextPrice: number | null;
  description: string;
} {
  const {
    min_price,
    min_target_area_10r = 0,
    max_target_area_10r,
    execution_price,
  } = pricing;

  // パターンA: 最低成立面積がある場合
  if (
    min_target_area_10r > 0 &&
    max_target_area_10r &&
    execution_price
  ) {
    if (totalArea10r < min_target_area_10r) {
      return {
        nextMilestoneArea: min_target_area_10r,
        nextPrice: execution_price,
        description: '最低成立面積達成で成立時単価が適用されます',
      };
    }

    if (totalArea10r < max_target_area_10r) {
      return {
        nextMilestoneArea: max_target_area_10r,
        nextPrice: min_price,
        description: '満額ライン達成で目標単価が適用されます',
      };
    }

    return {
      nextMilestoneArea: null,
      nextPrice: null,
      description: '満額ライン達成済み',
    };
  }

  // パターンB: 従来の線形方式
  const { target_area_10r } = pricing;

  if (totalArea10r < target_area_10r) {
    return {
      nextMilestoneArea: target_area_10r,
      nextPrice: min_price,
      description: '目標面積達成で目標単価が適用されます',
    };
  }

  return {
    nextMilestoneArea: null,
    nextPrice: null,
    description: '目標面積達成済み',
  };
}
