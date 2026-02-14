/**
 * 依頼から案件化した直後に、依頼した農家を「最初の申込」として1件登録する。
 * 農家が依頼時に選んだ畑・面積がそのまま案件の最初の申込になる。
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/server-service';
import { createBooking } from '@/services/booking.service';
import { setWorkRequestConverted } from '@/services/work-request.service';
import { calculateCurrentUnitPrice } from '@/lib/calculator/priceCalculator';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params;
  const workRequestId = typeof rawId === 'string' ? rawId.trim() : '';
  if (!workRequestId) {
    return NextResponse.json({ success: false, error: '依頼IDが必要です' }, { status: 400 });
  }

  let body: { campaignId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON の形式が不正です' }, { status: 400 });
  }
  const { campaignId } = body;
  if (!campaignId) {
    return NextResponse.json({ success: false, error: 'campaignId が必要です' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.email) {
    return NextResponse.json({ success: false, error: '未ログインです' }, { status: 401 });
  }

  const userRow = await supabase
    .from('users')
    .select('id, role')
    .eq('email', authUser.email)
    .single();
  if (!userRow.data) {
    return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 });
  }
  const provider = userRow.data as { id: string; role: string };
  if (provider.role !== 'provider') {
    return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 });
  }

  // 依頼はユーザーセッション（RLS）で取得。クライアントの fetchWorkRequestById と同じ条件で見えるようにする
  const { data: wr, error: wrError } = await supabase
    .from('work_requests')
    .select('id, farmer_id, field_ids, estimated_area_10r, desired_start_date, desired_end_date, status')
    .eq('id', workRequestId)
    .eq('provider_id', provider.id)
    .single();

  if (wrError || !wr) {
    if (wrError) {
      console.warn('[create-initial-booking] work_requests lookup failed:', { workRequestId, providerId: provider.id, error: wrError.message });
    }
    return NextResponse.json({ success: false, error: '依頼が見つかりません' }, { status: 404 });
  }

  const service = createServiceRoleClient();

  if (wr.status === 'converted') {
    return NextResponse.json({ success: true, bookingId: null, alreadyConverted: true });
  }

  const farmerId = wr.farmer_id;
  const fieldIds = wr.field_ids ?? null;
  const estimatedArea10r = Number(wr.estimated_area_10r) || 0;
  const desiredStart = wr.desired_start_date ?? undefined;
  const desiredEnd = wr.desired_end_date ?? undefined;

  if (estimatedArea10r <= 0) {
    return NextResponse.json(
      { success: false, error: '依頼に面積（estimated_area_10r）が設定されていません' },
      { status: 400 }
    );
  }

  const { data: farmerRow, error: farmerError } = await service
    .from('users')
    .select('id, name, phone, email')
    .eq('id', farmerId)
    .single();

  if (farmerError || !farmerRow) {
    return NextResponse.json({ success: false, error: '依頼者（農家）の情報を取得できませんでした' }, { status: 500 });
  }

  const farmer = farmerRow as { id: string; name?: string | null; phone?: string | null; email?: string | null };

  const { data: campaignRow, error: campaignError } = await service
    .from('campaigns')
    .select('id, base_price, min_price, target_area_10r, min_target_area_10r, max_target_area_10r, execution_price')
    .eq('id', campaignId)
    .eq('provider_id', provider.id)
    .single();

  if (campaignError || !campaignRow) {
    return NextResponse.json({ success: false, error: '案件が見つかりません' }, { status: 404 });
  }

  const c = campaignRow as {
    base_price?: number;
    min_price?: number;
    target_area_10r?: number;
    min_target_area_10r?: number | null;
    max_target_area_10r?: number | null;
    execution_price?: number | null;
  };
  const basePrice = Number(c.base_price) || 0;
  const minPrice = Number(c.min_price) || 0;
  const targetArea10r = Number(c.target_area_10r) || 0;
  const pricing = {
    base_price: basePrice,
    min_price: minPrice,
    target_area_10r: targetArea10r,
    min_target_area_10r: c.min_target_area_10r ?? undefined,
    max_target_area_10r: c.max_target_area_10r ?? undefined,
    execution_price: c.execution_price ?? undefined,
  };

  const priceResult = calculateCurrentUnitPrice(pricing, estimatedArea10r);
  const unitPrice = priceResult.currentPrice ?? basePrice;

  const firstFieldId = Array.isArray(fieldIds) && fieldIds.length > 0 ? fieldIds[0] : null;

  const bookingResult = await createBooking(service, {
    campaign_id: campaignId,
    farmer_id: farmerId,
    farmer_name: (farmer.name ?? '').trim() || '農家',
    phone: (farmer.phone ?? '').trim() || '',
    email: (farmer.email ?? '').trim() || '',
    desired_start_date: desiredStart || undefined,
    desired_end_date: desiredEnd || undefined,
    field_id: firstFieldId ?? undefined,
    area_10r: estimatedArea10r,
    locked_price: unitPrice,
  });

  if (!bookingResult.success) {
    return NextResponse.json(
      { success: false, error: bookingResult.error ?? '最初の申込の登録に失敗しました' },
      { status: 400 }
    );
  }

  const convertResult = await setWorkRequestConverted(
    service,
    workRequestId,
    provider.id,
    campaignId
  );
  if (!convertResult.success) {
    return NextResponse.json(
      { success: false, error: convertResult.error ?? '依頼の状態更新に失敗しました' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    bookingId: bookingResult.bookingId,
  });
}
