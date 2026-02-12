/**
 * 案件価格計算の集約ロジック（単価＋見積金額）
 */

import type { CampaignPricing, CampaignCalculationResult } from '@/lib/calculator/types';
import { calculateCurrentUnitPrice } from '@/lib/calculator/priceCalculator';
import { calculateFinalAmount, calculateTax } from '@/lib/calculator/priceCalculator';

export interface CampaignCalculateInput {
  /** 案件の価格設定 */
  pricing: CampaignPricing;
  /** 現在の申込合計面積（10R単位） */
  totalArea10r: number;
  /** 見積対象面積（10R単位）- 指定時のみ amountExTax / taxAmount / amountInclusive を算出 */
  appliedArea10r?: number;
}

/**
 * 案件の単価と見積金額を一括計算する
 */
export function calculateCampaignPrice(input: CampaignCalculateInput): CampaignCalculationResult {
  const { pricing, totalArea10r, appliedArea10r } = input;

  const unitResult = calculateCurrentUnitPrice(pricing, totalArea10r);

  const result: CampaignCalculationResult = {
    currentPrice: unitResult.currentPrice,
    progress: unitResult.progress,
    isUnformed: unitResult.isUnformed,
    remainingArea: unitResult.remainingArea,
    priceReduction: unitResult.priceReduction,
  };

  const effectivePrice = unitResult.currentPrice ?? pricing.base_price;
  if (appliedArea10r != null && appliedArea10r > 0) {
    const amountExTax = calculateFinalAmount(effectivePrice, appliedArea10r);
    const taxResult = calculateTax(amountExTax);
    result.amountExTax = amountExTax;
    result.taxAmount = taxResult.taxAmount;
    result.amountInclusive = taxResult.amountInclusive;
    result.taxRate = taxResult.taxRate;
  }

  return result;
}
