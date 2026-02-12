/**
 * Work report (作業実績報告) submission.
 * Ported from GAS WorkReport.js / Calculator.js calculateFinalAmount:
 * finalAmount = Math.round(unitPrice * actualArea10r).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateFinalAmount } from '@/lib/calculator/priceCalculator';

const EVIDENCE_BUCKET = 'evidence';

export interface SubmitWorkReportInput {
  bookingId: string;
  actualArea10r: number;
  imageBase64?: string;
  mimeType?: string;
  gps?: { lat: number; lng: number };
}

export interface SubmitWorkReportResult {
  success: boolean;
  message?: string;
  reportId?: string;
  finalAmount?: number;
}

/**
 * Submits a work report for a booking: validates provider ownership, uploads evidence image,
 * updates booking (actual_area_10r, work_status, final_amount, evidence_image_url),
 * and inserts a work_reports row. One report per application (1農家1報告).
 *
 * Final amount formula (GAS Calculator.js): Math.round(unitPrice * actualArea10r).
 * Unit price: project.final_unit_price or project.base_price.
 *
 * @param supabase - Server Supabase client (with session)
 * @param input - bookingId, actualArea10r, optional image and GPS
 * @param providerId - Current user id (must be provider, already validated by caller)
 */
export async function submitWorkReport(
  supabase: SupabaseClient,
  input: SubmitWorkReportInput,
  providerId: string
): Promise<SubmitWorkReportResult> {
  try {
    if (!input.bookingId || input.actualArea10r == null || input.actualArea10r < 0) {
      return {
        success: false,
        message: '申込IDと実績面積は必須です',
      };
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, campaign_id, farmer_id, area_10r')
      .eq('id', input.bookingId)
      .single();

    if (bookingError || !booking) {
      return { success: false, message: '申込が見つかりません' };
    }

    const { data: project, error: projectError } = await supabase
      .from('campaigns')
      .select('id, provider_id, final_unit_price, base_price, dilution_rate, amount_per_10r')
      .eq('id', booking.campaign_id)
      .single();

    if (projectError || !project) {
      return { success: false, message: '案件が見つからないか、権限がありません' };
    }

    const projectRow = project as {
      provider_id: string | null;
      final_unit_price: number | null;
      base_price: number | null;
      dilution_rate: string | number | null;
      amount_per_10r: string | number | null;
    };
    if (projectRow.provider_id !== providerId) {
      return { success: false, message: '案件が見つからないか、権限がありません' };
    }

    const { data: existingReport } = await supabase
      .from('work_reports')
      .select('id')
      .eq('application_id', input.bookingId)
      .maybeSingle();

    if (existingReport) {
      return {
        success: false,
        message: 'この申込は既に実績報告済みです（1農家1報告）',
      };
    }

    const finalUnitPrice =
      Number(projectRow.final_unit_price) ||
      Number(projectRow.base_price) ||
      0;
    const finalAmount = calculateFinalAmount(finalUnitPrice, input.actualArea10r);

    let imageUrl = '';
    if (input.imageBase64 && input.mimeType) {
      const ext = input.mimeType.split('/')[1] || 'jpg';
      const fileName = `work_${input.bookingId}_${Date.now()}.${ext}`;
      const path = `${providerId}/${fileName}`;
      const buf = Buffer.from(input.imageBase64, 'base64');
      const { error: uploadError } = await supabase.storage
        .from(EVIDENCE_BUCKET)
        .upload(path, buf, { contentType: input.mimeType, upsert: false });
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from(EVIDENCE_BUCKET).getPublicUrl(path);
        imageUrl = urlData?.publicUrl ?? '';
      }
    }

    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        actual_area_10r: input.actualArea10r,
        work_status: 'completed',
        final_amount: finalAmount,
        ...(imageUrl && { evidence_image_url: imageUrl }),
      })
      .eq('id', input.bookingId);

    if (updateError) {
      return {
        success: false,
        message: '申込の更新に失敗しました: ' + updateError.message,
      };
    }

    const reportId = 'WRP_' + Date.now();
    const projectRowForReport = project as {
      dilution_rate: string | number | null;
      amount_per_10r: string | number | null;
    };
    const { error: insertError } = await supabase.from('work_reports').insert({
      id: reportId,
      application_id: input.bookingId,
      campaign_id: booking.campaign_id,
      dilution_rate_actual: String(projectRowForReport.dilution_rate ?? ''),
      amount_actual_per_10r: String(projectRowForReport.amount_per_10r ?? ''),
      photo_urls_json: imageUrl ? JSON.stringify([imageUrl]) : '',
      reported_at: new Date().toISOString(),
      reporter_id: providerId,
      gps_lat: input.gps?.lat ?? null,
      gps_lng: input.gps?.lng ?? null,
      reported_at_iso: new Date().toISOString(),
    });

    if (insertError) {
      return {
        success: false,
        message: '実績報告の保存に失敗しました: ' + insertError.message,
      };
    }

    return { success: true, reportId, finalAmount };
  } catch (e) {
    console.error('Report submit error:', e);
    return { success: false, message: 'サーバーエラー' };
  }
}
