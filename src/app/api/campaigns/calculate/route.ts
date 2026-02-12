import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateCampaignPrice } from '@/lib/calculator/campaignCalculator';
import type { CampaignPricing } from '@/lib/calculator/types';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: '未ログインです' }, { status: 401 });
    }

    const body = await request.json();
    const {
      base_price,
      min_price,
      target_area_10r,
      min_target_area_10r,
      max_target_area_10r,
      execution_price,
      totalArea10r,
      appliedArea10r,
    } = body as CampaignPricing & { totalArea10r: number; appliedArea10r?: number };

    if (
      typeof base_price !== 'number' ||
      typeof min_price !== 'number' ||
      typeof target_area_10r !== 'number' ||
      typeof totalArea10r !== 'number' ||
      totalArea10r < 0
    ) {
      return NextResponse.json(
        { success: false, message: 'base_price, min_price, target_area_10r, totalArea10r は数値で必須です' },
        { status: 400 }
      );
    }

    const pricing: CampaignPricing = {
      base_price,
      min_price,
      target_area_10r,
      min_target_area_10r,
      max_target_area_10r,
      execution_price,
    };

    const result = calculateCampaignPrice({
      pricing,
      totalArea10r,
      appliedArea10r,
    });

    return NextResponse.json({ success: true, result });
  } catch (e) {
    const message = e instanceof Error ? e.message : '計算エラー';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
