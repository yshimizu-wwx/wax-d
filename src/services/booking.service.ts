/**
 * Booking (application) business logic and DB operations.
 * Ported from GAS Application.js: submitApplication, isCampaignClosed, area validation.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Project } from '@/types/database';
import { geoJSONToWKT } from '@/lib/geo/areaCalculator';
import { validateApplicationArea } from '@/lib/calculator/priceCalculator';
import type { Polygon } from 'geojson';
import { fetchCampaignTotalArea } from './campaign.service';

export interface FarmerBookingItem {
  id: string;
  campaign_id: string;
  area_10r: number;
  status: string;
  work_status?: string;
  locked_price?: number;
  created_at?: string;
  field_id?: string | null;
  project?: Pick<
    Project,
    'id' | 'location' | 'campaign_title' | 'start_date' | 'end_date' | 'status' | 'is_closed'
  >;
}

export interface BookingCreateInput {
  campaign_id: string;
  farmer_id?: string | null;
  farmer_name: string;
  phone: string;
  email: string;
  desired_start_date?: string | null;
  desired_end_date?: string | null;
  /** 畑選択で申し込む場合は field_id と area_10r を指定。このとき field_polygon は省略可。 */
  field_id?: string | null;
  field_polygon?: Polygon | null;
  area_10r: number;
  locked_price: number;
}

export interface BookingCreateResult {
  success: boolean;
  error?: string;
  bookingId?: string;
}

/**
 * GAS Application.js isCampaignClosed: 募集終了かどうか。
 * status/end_date/is_closed で判定（ロジック変更なし）。
 */
export function isCampaignClosed(project: {
  is_closed?: boolean;
  status?: string;
  end_date?: string | null;
}): boolean {
  const todayStr = new Date().toISOString().slice(0, 10);
  return (
    project.is_closed === true ||
    String(project.status) === 'closed' ||
    String(project.status) === 'completed' ||
    String(project.status) === 'unformed' ||
    !!(project.end_date && String(project.end_date).slice(0, 10) < todayStr)
  );
}

/**
 * Fetches bookings for a farmer with project summary attached.
 */
export async function fetchBookingsByFarmer(
  supabase: SupabaseClient,
  farmerId: string
): Promise<FarmerBookingItem[]> {
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, campaign_id, area_10r, status, work_status, locked_price, created_at, field_id')
    .eq('farmer_id', farmerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching farmer bookings:', error);
    return [];
  }

  const list = (bookings ?? []) as Array<{
    id: string;
    campaign_id: string;
    area_10r?: number;
    status?: string;
    work_status?: string;
    locked_price?: number;
    created_at?: string;
    field_id?: string | null;
  }>;
  if (list.length === 0) return [];

  const campaignIds = [...new Set(list.map((b) => b.campaign_id))];
  const { data: projects } = await supabase
    .from('campaigns')
    .select('id, location, campaign_title, start_date, end_date, status, is_closed')
    .in('id', campaignIds);

  const projectMap = new Map<string, FarmerBookingItem['project']>();
  (projects ?? []).forEach((p) => {
    projectMap.set(p.id, {
      id: p.id,
      location: p.location ?? '',
      campaign_title: p.campaign_title,
      start_date: p.start_date,
      end_date: p.end_date,
      status: p.status,
      is_closed: p.is_closed,
    });
  });

  return list.map((row) => ({
    id: row.id,
    campaign_id: row.campaign_id,
    area_10r: Number(row.area_10r) || 0,
    status: (row.status as string) ?? '',
    work_status: row.work_status,
    locked_price: row.locked_price != null ? Number(row.locked_price) : undefined,
    created_at: row.created_at,
    field_id: row.field_id ?? undefined,
    project: projectMap.get(row.campaign_id),
  }));
}

/**
 * Creates a new booking. Validates campaign exists, not closed, and area within remaining.
 * GAS submitApplication に準拠（計算・検証ロジック変更なし）。
 */
export async function createBooking(
  supabase: SupabaseClient,
  input: BookingCreateInput
): Promise<BookingCreateResult> {
  try {
    const { data: project, error: projectError } = await supabase
      .from('campaigns')
      .select('id, is_closed, status, end_date, max_target_area_10r, target_area_10r')
      .eq('id', input.campaign_id)
      .single();

    if (projectError || !project) {
      return { success: false, error: '案件が見つかりません' };
    }

    const projectTyped = project as {
      is_closed?: boolean;
      status?: string;
      end_date?: string | null;
      max_target_area_10r?: number;
      target_area_10r?: number;
    };
    if (isCampaignClosed(projectTyped)) {
      return { success: false, error: 'この案件は募集終了しています' };
    }

    const currentTotal = await fetchCampaignTotalArea(supabase, input.campaign_id);
    const maxAreaNum =
      Number(projectTyped.max_target_area_10r) > 0
        ? Number(projectTyped.max_target_area_10r)
        : Number(projectTyped.target_area_10r) || 1;
    const validation = validateApplicationArea(input.area_10r, currentTotal, maxAreaNum);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.errorMessage ?? '申込面積が上限を超えています',
      };
    }

    const hasPolygon = input.field_polygon && Object.keys(input.field_polygon).length > 0;
    const polygonWKT = hasPolygon ? geoJSONToWKT(input.field_polygon!) : null;

    // id は DB の UUID デフォルトに任せる（bookings.id は uuid 型）
    const insertPayload: Record<string, unknown> = {
      campaign_id: input.campaign_id,
      farmer_name: input.farmer_name,
      phone: input.phone,
      email: input.email,
      desired_start_date: input.desired_start_date?.trim() || null,
      desired_end_date: input.desired_end_date?.trim() || null,
      area_10r: input.area_10r,
      locked_price: input.locked_price,
      status: 'confirmed',
      work_status: 'pending',
      invoice_status: 'unbilled',
      applied_at: new Date().toISOString(),
    };
    if (polygonWKT != null) {
      insertPayload.field_polygon = polygonWKT;
    }
    if (input.field_id != null && input.field_id !== '') {
      insertPayload.field_id = input.field_id;
    }
    if (input.farmer_id != null && input.farmer_id !== '') {
      insertPayload.farmer_id = input.farmer_id;
    }

    const { data, error } = await supabase
      .from('bookings')
      .insert(insertPayload)
      .select('id')
      .single();

    if (error) {
      console.error('Error creating booking:', error);
      return { success: false, error: error.message };
    }
    return { success: true, bookingId: data?.id ?? '' };
  } catch (e) {
    console.error('Unexpected error creating booking:', e);
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Unknown error occurred',
    };
  }
}

/**
 * キャンセル依頼（いきなりキャンセルせず業者に連絡が入る想定）。
 * status を 'cancel_requested' に更新する。
 */
export async function requestCancelBooking(
  supabase: SupabaseClient,
  bookingId: string,
  farmerId: string
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'cancel_requested' })
    .eq('id', bookingId)
    .eq('farmer_id', farmerId)
    .in('status', ['confirmed', 'pending'])
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Error requesting cancel:', error);
    return { success: false, error: error.message };
  }
  if (!data) {
    return { success: false, error: '申込が見つからないか、キャンセル依頼できない状態です' };
  }
  return { success: true };
}
