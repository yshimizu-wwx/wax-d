/**
 * 逆オークション計算ロジックの型定義
 */

/**
 * 案件の価格設定情報
 */
export interface CampaignPricing {
  /** 開始単価（円/10R） */
  base_price: number;

  /** 目標単価（円/10R） */
  min_price: number;

  /** 目標面積（10R単位、10R=1反） */
  target_area_10r: number;

  /** 最低成立面積（10R単位）- オプション */
  min_target_area_10r?: number;

  /** 満額ライン面積（10R単位）- オプション */
  max_target_area_10r?: number;

  /** 成立時単価（円/10R）- 最低成立面積達成時の単価 */
  execution_price?: number;
}

/**
 * 単価計算結果
 */
export interface PriceCalculationResult {
  /** 現在単価（円/10R）- 不成立時はnull */
  currentPrice: number | null;

  /** 進捗率（0〜1） */
  progress: number;

  /** 不成立フラグ - 最低成立面積未達の場合true */
  isUnformed: boolean;

  /** 値引き額（円）- 開始単価からの減額 */
  priceReduction: number;

  /** 満額ラインまでの残り面積（10R単位） */
  remainingArea: number;

  /** 次の単価変動までの残り面積（10R単位） */
  nextMilestoneArea?: number;
}

/**
 * 金額計算結果
 */
export interface AmountCalculation {
  /** 税抜金額（円） */
  amountExTax: number;

  /** 消費税額（円） */
  taxAmount: number;

  /** 税込金額（円） */
  amountInclusive: number;

  /** 消費税率（%） */
  taxRate: number;
}

/**
 * 申込面積の検証結果
 */
export interface ApplicationAreaValidation {
  /** 検証成功フラグ */
  isValid: boolean;

  /** エラーメッセージ（検証失敗時） */
  errorMessage?: string;

  /** 現在の申込合計面積（10R単位） */
  currentTotalArea: number;

  /** 申込可能な残り面積（10R単位） */
  remainingArea: number;

  /** 満額ライン面積（10R単位） */
  maxArea: number;
}

/**
 * 案件価格計算の集約結果（単価＋金額見積）
 */
export interface CampaignCalculationResult {
  /** 現在単価（円/10R）- 不成立時はnull */
  currentPrice: number | null;
  /** 進捗率（0〜1） */
  progress: number;
  /** 不成立フラグ */
  isUnformed: boolean;
  /** 満額ラインまでの残り面積（10R単位） */
  remainingArea: number;
  /** 値引き額（円）- 開始単価からの減額 */
  priceReduction: number;
  /** 税抜見積金額（円）- appliedArea10r 指定時のみ */
  amountExTax?: number;
  /** 消費税額（円） */
  taxAmount?: number;
  /** 税込見積金額（円） */
  amountInclusive?: number;
  /** 消費税率（%） */
  taxRate?: number;
}
