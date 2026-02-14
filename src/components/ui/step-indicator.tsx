'use client';

import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

export interface StepIndicatorProps {
  /** 現在のステップ（1始まり） */
  currentStep: number;
  /** 総ステップ数 */
  totalSteps: number;
  /** 各ステップのラベル（省略時は Step 1/3 のみ表示） */
  labels?: string[];
  className?: string;
}

/**
 * ステップ型フォーム用のプログレス表示。
 * スマホで進捗がひと目で分かるプログレスバー（Issue #23）
 */
export function StepIndicator({
  currentStep,
  totalSteps,
  labels,
  className,
}: StepIndicatorProps) {
  const value = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-sm font-medium text-dashboard-muted tracking-tight">
        Step {currentStep}/{totalSteps}
        {labels?.[currentStep - 1] && (
          <span className="ml-2 text-dashboard-text">{labels[currentStep - 1]}</span>
        )}
      </p>
      <Progress value={value} className="h-1.5" />
    </div>
  );
}
