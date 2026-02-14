"use client";

import { Calendar, MapPin, TrendingDown, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import AuctionProgressBar from "@/components/AuctionProgressBar";
import { calculateCurrentUnitPrice } from "@/lib/calculator/priceCalculator";
import type { CampaignPricing } from "@/lib/calculator/types";
import { Project } from "@/types/database";
import { cn } from "@/lib/utils";
import { formatDateWithWeekday } from "@/lib/dateFormat";

export interface CampaignWithArea extends Project {
  totalArea10r?: number;
}

/** 案件の表示用ステータス */
export function campaignStatusLabel(campaign: { is_closed?: boolean | null; status?: string | null }): string {
  if (campaign.is_closed === true || ['closed', 'completed', 'unformed'].includes(String(campaign.status ?? ''))) {
    return '募集終了';
  }
  return '募集中';
}

interface CampaignTimelineCardProps {
  campaign: CampaignWithArea;
  onSelect: (campaign: CampaignWithArea) => void;
  isSelected?: boolean;
  /** この案件に既に申し込んでいる場合「追加で申し込む」表示用 */
  hasExistingApplication?: boolean;
  className?: string;
}

export default function CampaignTimelineCard({
  campaign,
  onSelect,
  isSelected,
  hasExistingApplication,
  className,
}: CampaignTimelineCardProps) {
  const totalArea10r = campaign.totalArea10r ?? 0;
  const pricing: CampaignPricing = {
    base_price: campaign.base_price || 0,
    min_price: campaign.min_price || 0,
    target_area_10r: campaign.target_area_10r || 0,
    min_target_area_10r: campaign.min_target_area_10r ?? undefined,
    max_target_area_10r: campaign.max_target_area_10r ?? undefined,
    execution_price: campaign.execution_price ?? undefined,
  };
  const result = calculateCurrentUnitPrice(pricing, totalArea10r);
  const maxArea = campaign.max_target_area_10r || campaign.target_area_10r || 1;
  const remaining = Math.max(0, maxArea - totalArea10r);
  const isClosed = campaign.is_closed === true || ['closed', 'completed', 'unformed'].includes(String(campaign.status ?? ''));
  const minTarget = campaign.min_target_area_10r ?? 0;

  // あともう少しで成立（最低成立面積に近いが未達）
  const almostFormed = result.isUnformed && minTarget > 0 && totalArea10r >= minTarget * 0.7;
  // あともう少し集まれば単価が安くなる（成立済みで満額未達）
  const almostCheaper = !result.isUnformed && result.remainingArea > 0 && result.remainingArea <= 10;

  return (
    <Card
      className={cn(
        "transition-all border-2",
        isSelected ? "border-agrix-forest ring-2 ring-agrix-forest/20" : "hover:border-agrix-forest/50",
        className
      )}
    >
      <CardContent className="p-5">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-bold text-dashboard-text text-base leading-tight">
                {(campaign as { campaign_title?: string }).campaign_title || campaign.location || "案件"}
              </h3>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-dashboard-muted">
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-agrix-forest" />
                  {campaign.location}
                </span>
                {campaign.start_date && campaign.end_date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4 text-agrix-forest" />
                    {formatDateWithWeekday(campaign.start_date)} ～ {formatDateWithWeekday(campaign.end_date)}
                  </span>
                )}
              </div>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold",
                isClosed
                  ? "bg-dashboard-muted/30 text-dashboard-muted"
                  : "bg-agrix-forest/15 text-agrix-forest"
              )}
            >
              {campaignStatusLabel(campaign)}
            </span>
          </div>

          {/* 単価・面積サマリ（見やすく） */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-xl bg-dashboard-muted/10 p-3 text-sm">
            <div>
              <span className="text-dashboard-muted text-xs block">現在の単価</span>
              <span className="font-bold text-dashboard-text tabular-nums">
                {result.currentPrice != null ? `¥${result.currentPrice.toLocaleString()}/10a` : '—'}
              </span>
            </div>
            {minTarget > 0 && (
              <div>
                <span className="text-dashboard-muted text-xs block">最低成立面積</span>
                <span className="font-bold text-dashboard-text">{minTarget} 反</span>
              </div>
            )}
            <div>
              <span className="text-dashboard-muted text-xs block">目標面積</span>
              <span className="font-bold text-dashboard-text">{maxArea} 反</span>
            </div>
            <div>
              <span className="text-dashboard-muted text-xs block">最低単価</span>
              <span className="font-bold text-dashboard-text">¥{(campaign.min_price ?? 0).toLocaleString()}/10a</span>
            </div>
          </div>

          {almostFormed && (
            <p className="flex items-center gap-2 text-sm font-medium text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-800">
              <Target className="h-4 w-4 shrink-0" />
              あともう少しで成立します
            </p>
          )}
          {almostCheaper && (
            <p className="flex items-center gap-2 text-sm font-medium text-agrix-forest bg-agrix-forest/10 px-3 py-2 rounded-xl border border-agrix-forest/30">
              <TrendingDown className="h-4 w-4 shrink-0" />
              あともう少し集まれば単価が安くなります
            </p>
          )}

          <AuctionProgressBar
            result={result}
            currentPrice={result.currentPrice}
            detail={
              result.remainingArea > 0
                ? `残り ${result.remainingArea.toFixed(1)} 反で目標`
                : "目標達成"
            }
          />

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-dashboard-muted">
              申込合計: {totalArea10r.toFixed(1)} 反
            </span>
            {!isClosed && (
              <Button
                size="sm"
                onClick={() => onSelect(campaign)}
                className="shrink-0"
              >
                {hasExistingApplication ? '追加で申し込む' : '申し込む'}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
