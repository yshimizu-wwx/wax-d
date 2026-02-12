"use client";

import { Calendar, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import AuctionProgressBar from "@/components/AuctionProgressBar";
import { calculateCurrentUnitPrice } from "@/lib/calculator/priceCalculator";
import type { CampaignPricing } from "@/lib/calculator/types";
import { Project } from "@/types/database";
import { cn } from "@/lib/utils";

export interface CampaignWithArea extends Project {
  totalArea10r?: number;
}

interface CampaignTimelineCardProps {
  campaign: CampaignWithArea;
  onSelect: (campaign: CampaignWithArea) => void;
  isSelected?: boolean;
  className?: string;
}

export default function CampaignTimelineCard({
  campaign,
  onSelect,
  isSelected,
  className,
}: CampaignTimelineCardProps) {
  const totalArea10r = campaign.totalArea10r ?? 0;
  const pricing: CampaignPricing = {
    base_price: campaign.base_price || 0,
    min_price: campaign.min_price || 0,
    target_area_10r: campaign.target_area_10r || 0,
    min_target_area_10r: campaign.min_target_area_10r,
    max_target_area_10r: campaign.max_target_area_10r,
    execution_price: campaign.execution_price,
  };
  const result = calculateCurrentUnitPrice(pricing, totalArea10r);
  const maxArea = campaign.max_target_area_10r || campaign.target_area_10r || 1;
  const remaining = Math.max(0, maxArea - totalArea10r);

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
                  {campaign.start_date} ～ {campaign.end_date}
                </span>
              )}
            </div>
          </div>

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
            <Button
              size="sm"
              onClick={() => onSelect(campaign)}
              className="shrink-0"
            >
              申し込む
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
