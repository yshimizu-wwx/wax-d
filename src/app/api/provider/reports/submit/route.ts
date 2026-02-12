import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const EVIDENCE_BUCKET = 'evidence';

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.email) {
            return NextResponse.json({ success: false, message: '未ログインです' }, { status: 401 });
        }

        const userRow = await supabase
            .from('users')
            .select('id, role')
            .eq('email', session.user.email)
            .single();
        if (!userRow.data || (userRow.data as { role: string }).role !== 'provider') {
            return NextResponse.json({ success: false, message: '権限がありません' }, { status: 403 });
        }
        const providerId = (userRow.data as { id: string }).id;

        const body = await request.json();
        const { bookingId, actualArea10r, imageBase64, mimeType, gps } = body as {
            bookingId: string;
            actualArea10r: number;
            imageBase64?: string;
            mimeType?: string;
            gps?: { lat: number; lng: number };
        };

        if (!bookingId || actualArea10r == null || actualArea10r < 0) {
            return NextResponse.json({ success: false, message: '申込IDと実績面積は必須です' }, { status: 400 });
        }

        const { data: booking, error: bookingError } = await supabase
            .from('bookings')
            .select('id, campaign_id, farmer_id, area_10r')
            .eq('id', bookingId)
            .single();
        if (bookingError || !booking) {
            return NextResponse.json({ success: false, message: '申込が見つかりません' }, { status: 404 });
        }

        const { data: project, error: projectError } = await supabase
            .from('projects')
            .select('id, provider_id, final_unit_price, base_price, dilution_rate, amount_per_10r')
            .eq('id', booking.campaign_id)
            .single();
        if (projectError || !project || (project as { provider_id: string }).provider_id !== providerId) {
            return NextResponse.json({ success: false, message: '案件が見つからないか、権限がありません' }, { status: 404 });
        }

        const { data: existingReport } = await supabase
            .from('work_reports')
            .select('id')
            .eq('application_id', bookingId)
            .maybeSingle();
        if (existingReport) {
            return NextResponse.json({ success: false, message: 'この申込は既に実績報告済みです（1農家1報告）' }, { status: 400 });
        }

        // GAS Calculator.js calculateFinalAmount: Math.round(unitPrice * actualArea10r)
        const finalUnitPrice =
            Number((project as { final_unit_price?: number }).final_unit_price) ||
            Number((project as { base_price?: number }).base_price) ||
            0;
        const finalAmount = Math.round(actualArea10r * finalUnitPrice);

        let imageUrl = '';
        if (imageBase64 && mimeType) {
            const ext = mimeType.split('/')[1] || 'jpg';
            const fileName = `work_${bookingId}_${Date.now()}.${ext}`;
            const path = `${providerId}/${fileName}`;
            const buf = Buffer.from(imageBase64, 'base64');
            const { error: uploadError } = await supabase.storage
                .from(EVIDENCE_BUCKET)
                .upload(path, buf, { contentType: mimeType, upsert: false });
            if (!uploadError) {
                const { data: urlData } = supabase.storage.from(EVIDENCE_BUCKET).getPublicUrl(path);
                imageUrl = urlData?.publicUrl ?? '';
            }
        }

        const { error: updateError } = await supabase
            .from('bookings')
            .update({
                actual_area_10r: actualArea10r,
                work_status: 'completed',
                final_amount: finalAmount,
                ...(imageUrl && { evidence_image_url: imageUrl }),
            })
            .eq('id', bookingId);
        if (updateError) {
            return NextResponse.json({ success: false, message: '申込の更新に失敗しました: ' + updateError.message }, { status: 500 });
        }

        const reportId = 'WRP_' + Date.now();
        const { error: insertError } = await supabase.from('work_reports').insert({
            id: reportId,
            application_id: bookingId,
            campaign_id: booking.campaign_id,
            dilution_rate_actual: (project as { dilution_rate?: string }).dilution_rate ?? '',
            amount_actual_per_10r: (project as { amount_per_10r?: string }).amount_per_10r ?? '',
            photo_urls_json: imageUrl ? JSON.stringify([imageUrl]) : '',
            reported_at: new Date().toISOString(),
            reporter_id: providerId,
            gps_lat: gps?.lat ?? null,
            gps_lng: gps?.lng ?? null,
            reported_at_iso: new Date().toISOString(),
        });
        if (insertError) {
            return NextResponse.json({ success: false, message: '実績報告の保存に失敗しました: ' + insertError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, reportId, finalAmount });
    } catch (e) {
        console.error('Report submit error:', e);
        return NextResponse.json({ success: false, message: 'サーバーエラー' }, { status: 500 });
    }
}
