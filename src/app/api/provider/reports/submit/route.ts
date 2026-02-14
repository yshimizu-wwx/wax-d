import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { submitWorkReport } from '@/services/report.service';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser?.email) {
      return NextResponse.json({ success: false, message: '未ログインです' }, { status: 401 });
    }

    const userRow = await supabase
      .from('users')
      .select('id, role')
      .eq('email', authUser.email)
      .single();

    if (!userRow.data) {
      return NextResponse.json({ success: false, message: '権限がありません' }, { status: 403 });
    }

    const row = userRow.data as { id: string; role: string };
    if (row.role !== 'provider') {
      return NextResponse.json({ success: false, message: '権限がありません' }, { status: 403 });
    }

    const body = await request.json();
    const result = await submitWorkReport(supabase, body, row.id);

    if (!result.success) {
      const status =
        result.message === '申込が見つかりません' || result.message === '案件が見つからないか、権限がありません'
          ? 404
          : result.message === '申込IDと実績面積は必須です' ||
              result.message === 'この申込は既に実績報告済みです（1農家1報告）'
            ? 400
            : 500;
      return NextResponse.json({ success: false, message: result.message }, { status });
    }

    return NextResponse.json({
      success: true,
      reportId: result.reportId,
      finalAmount: result.finalAmount,
    });
  } catch (e) {
    console.error('Report submit error:', e);
    return NextResponse.json({ success: false, message: 'サーバーエラー' }, { status: 500 });
  }
}
