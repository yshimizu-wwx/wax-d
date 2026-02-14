import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/server-service';

/**
 * 業者が「自分あての依頼」に紐づく畑一覧（id, name, lat, lng, address, area_coordinates）を取得する。
 * 依頼の field_ids に含まれる畑を RLS をバイパスして返す。
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const workRequestId = params?.id;
  if (!workRequestId) {
    return NextResponse.json({ error: '依頼IDが必要です' }, { status: 400 });
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

  const user = userRow.data as { id: string; role: string };
  if (user.role !== 'provider') {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  const { data: wr, error: wrError } = await supabase
    .from('work_requests')
    .select('id, provider_id, field_ids')
    .eq('id', workRequestId)
    .eq('provider_id', user.id)
    .single();

  if (wrError || !wr) {
    return NextResponse.json({ error: '依頼が見つかりません' }, { status: 404 });
  }

  const fieldIds = (wr as { field_ids?: string[] | null }).field_ids;
  if (!Array.isArray(fieldIds) || fieldIds.length === 0) {
    return NextResponse.json([]);
  }

  const service = createServiceRoleClient();
  const { data: fields, error: fieldsError } = await service
    .from('fields')
    .select('id, name, lat, lng, address, area_coordinates')
    .in('id', fieldIds);

  if (fieldsError) {
    console.error('Error fetching work request fields:', fieldsError);
    return NextResponse.json({ error: '畑の取得に失敗しました' }, { status: 500 });
  }

  return NextResponse.json(fields ?? []);
}
