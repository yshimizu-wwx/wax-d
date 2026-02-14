import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * 業者が自分の案件に紐づく畑の情報（枠＝area_coordinates 含む）を取得する。
 * 権限: その field_id を持つ booking が、自分の campaign に属している場合のみ取得可。
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { fieldId: string } }
) {
  const fieldId = params?.fieldId;
  if (!fieldId) {
    return NextResponse.json({ error: 'fieldId が必要です' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.email) {
    return NextResponse.json({ error: '未ログインです' }, { status: 401 });
  }

  const userRow = await supabase
    .from('users')
    .select('id, role')
    .eq('email', authUser.email)
    .single();

  if (!userRow.data) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  const row = userRow.data as { id: string; role: string };
  if (row.role !== 'provider') {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id')
    .eq('provider_id', row.id);
  const campaignIds = (campaigns ?? []).map((c) => (c as { id: string }).id);
  if (campaignIds.length === 0) {
    return NextResponse.json({ error: '畑の情報を取得できませんでした' }, { status: 404 });
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select('id')
    .eq('field_id', fieldId)
    .in('campaign_id', campaignIds)
    .limit(1)
    .maybeSingle();

  if (!booking) {
    return NextResponse.json({ error: '畑の情報を取得できませんでした' }, { status: 404 });
  }

  const { data: field, error } = await supabase
    .from('fields')
    .select('id, name, lat, lng, address, area_coordinates')
    .eq('id', fieldId)
    .single();

  if (error || !field) {
    return NextResponse.json({ error: '畑の情報を取得できませんでした' }, { status: 404 });
  }

  return NextResponse.json(field);
}
