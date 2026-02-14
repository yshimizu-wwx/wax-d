import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * 農家が自分の畑1件を取得する。farmer_id が自分の場合のみ返す。
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
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: '未ログインです' }, { status: 401 });
  }

  const { data: userRow } = await supabase
    .from('users')
    .select('id, role')
    .eq('email', user.email)
    .single();

  if (!userRow || (userRow as { role: string }).role !== 'farmer') {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  const farmerId = (userRow as { id: string }).id;

  const { data: field, error } = await supabase
    .from('fields')
    .select('id, name, lat, lng, address, area_size, area_coordinates')
    .eq('id', fieldId)
    .eq('farmer_id', farmerId)
    .single();

  if (error || !field) {
    return NextResponse.json({ error: '畑が見つかりません' }, { status: 404 });
  }

  return NextResponse.json(field);
}
