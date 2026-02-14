import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/server-service';

/**
 * 業者が「自分あての依頼」に紐づく畑一覧を取得する。
 * 農家が依頼時に登録した畑の枠（area_coordinates）を GeoJSON で返し、地図に正しく表示する。
 * RPC get_work_request_fields_geojson があればそれを使用（ST_AsGeoJSON で確実に GeoJSON 化）、なければ従来クエリにフォールバック。
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workRequestId } = await params;
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

  const { data: wrCheck, error: wrCheckError } = await supabase
    .from('work_requests')
    .select('id')
    .eq('id', workRequestId)
    .eq('provider_id', user.id)
    .single();

  if (wrCheckError || !wrCheck) {
    return NextResponse.json({ error: '依頼が見つかりません' }, { status: 404 });
  }

  const service = createServiceRoleClient();

  const { data: rpcData, error: rpcError } = await (service.rpc as (name: string, args: Record<string, unknown>) => ReturnType<typeof service.rpc>)(
    'get_work_request_fields_geojson',
    { p_wr_id: workRequestId, p_provider_id: user.id }
  );

  if (!rpcError && Array.isArray(rpcData)) {
    const rows = rpcData as Array<{
      id: string;
      name?: string | null;
      lat?: number | null;
      lng?: number | null;
      address?: string | null;
      area_coordinates?: unknown;
    }>;
    return NextResponse.json(rows);
  }

  if (rpcError && !rpcError.message?.includes('Could not find the function')) {
    console.error('get_work_request_fields_geojson RPC error:', rpcError);
    return NextResponse.json({ error: '畑の取得に失敗しました' }, { status: 500 });
  }

  const { data: wr, error: wrError } = await service
    .from('work_requests')
    .select('id, provider_id, field_ids')
    .eq('id', workRequestId)
    .eq('provider_id', user.id)
    .single();

  if (wrError || !wr) {
    return NextResponse.json({ error: '依頼が見つかりません' }, { status: 404 });
  }

  const fieldIds = wr.field_ids;
  if (!Array.isArray(fieldIds) || fieldIds.length === 0) {
    return NextResponse.json([]);
  }

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
