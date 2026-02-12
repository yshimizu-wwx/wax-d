"use client";

import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { PriceCalculationResult } from "@/lib/calculator/types";

interface AuctionProgressBarProps {
  result: PriceCalculationResult;
  currentPrice: number | null;
  /** 表示用ラベル（例: "逆オークション進捗"） */
  label?: string;
  /** 目標面積や「残り○反で成立」などの補足 */
  detail?: string;
  className?: string;
}

export default function AuctionProgressBar({
  result,
  currentPrice,
  label = "逆オークション進捗",
  detail,
  className,
}: AuctionProgressBarProps) {
  const [displayProgress, setDisplayProgress] = useState(result.progress);
  const [priceKey, setPriceKey] = useState(currentPrice);

  useEffect(() => {
    setDisplayProgress(result.progress);
  }, [result.progress]);

  useEffect(() => {
    if (currentPrice !== priceKey) {
      setPriceKey(currentPrice);
    }
  }, [currentPrice, priceKey]);

  const progressPercent = Math.round(displayProgress * 100);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex justify-between text-sm">
        <span className="font-medium text-slate-600">{label}</span>
        {detail && <span className="text-slate-500">{detail}</span>}
      </div>
      <Progress value={progressPercent} className="h-3" />
      <div className="flex justify-between items-baseline">
        <span className="text-xs text-slate-500">{progressPercent}%</span>
        {currentPrice != null && (
          <span
            key={currentPrice}
            className="text-lg font-bold text-agrix-forest animate-price-pulse tabular-nums"
          >
            ¥{currentPrice.toLocaleString()}
            <span className="text-xs font-normal text-slate-500 ml-1">/10a</span>
          </span>
        )}
        {result.isUnformed && (
          <span className="text-xs font-medium text-amber-600">最低成立面積に達していません</span>
        )}
      </div>
    </div>
  );
}
