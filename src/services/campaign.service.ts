/**
 * Campaign (project) business logic and DB operations.
 * Ported from GAS: campaign CRUD, status flow, area totals.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Project } from '@/types/database';
import { geoJSONToWKT } from '@/lib/geo/areaCalculator';
import { calculateCurrentUnitPrice } from '@/lib/calculator/priceCalculator';
import type { Polygon } from 'geojson';

export interface CampaignCreateInput {
  cropId: string;
  categoryId: string;
  detailId: string;
  location: string;
  startDate: string;
  endDate: string;
  pesticide: string;
  dilutionRate: string;
  amountPer10r: string;
  basePrice: number;
  minPrice: number;
  minTargetArea10r: number;
  targetArea10r: number;
  maxTargetArea10r?: number;
  executionPrice?: number;
  confirmationDeadlineDays: number;
  targetAreaPolygon: Polygon;
}

export interface CampaignCreateResult {
  success: boolean;
  error?: string;
  campaignId?: string;
}

/**
 * Fetches open campaigns (status=open, is_closed=false) for public list.
 */
export async function fetchOpenCampaigns(supabase: SupabaseClient): Promise<Project[]> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('status', 'open')
    .eq('is_closed', false)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching open campaigns:', error);
    return [];
  }
  return data ?? [];
}

export type CampaignStatusFilter = 'open' | 'closed' | 'completed' | 'past' | 'all';

export interface FetchCampaignsOptions {
  /** open=募集中のみ, closed=募集終了, completed=完了, past=過去(closed+completed), all=すべて */
  status?: CampaignStatusFilter;
  /** 作業開始日の下限（YYYY-MM-DD）。指定時は start_date >= dateFrom の案件のみ */
  dateFrom?: string;
  /** 作業終了日の上限（YYYY-MM-DD）。指定時は end_date <= dateTo の案件のみ */
  dateTo?: string;
  /** 指定時はその業者の案件のみ取得（農家が業者を選んだとき用） */
  providerId?: string;
}

/**
 * 案件一覧用: ステータス・日付でフィルタ可能に取得。
 */
export async function fetchCampaigns(
  supabase: SupabaseClient,
  options: FetchCampaignsOptions = {}
): Promise<Project[]> {
  const { status = 'all', dateFrom, dateTo, providerId } = options;
  let query = supabase.from('campaigns').select('*');

  if (providerId) {
    query = query.eq('provider_id', providerId);
  }

  if (status !== 'all') {
    if (status === 'open') {
      query = query.eq('status', 'open').eq('is_closed', false);
    } else if (status === 'past') {
      query = query.in('status', ['closed', 'completed']);
    } else {
      query = query.eq('status', status);
    }
  }

  if (dateFrom) {
    query = query.gte('start_date', dateFrom);
  }
  if (dateTo) {
    query = query.lte('end_date', dateTo);
  }

  query = query.order('created_at', { ascending: false });
  const { data, error } = await query;
  if (error) {
    console.error('Error fetching campaigns:', error);
    return [];
  }
  return data ?? [];
}

/**
 * Fetches a single campaign by ID. If providerId is set, only returns the campaign if it belongs to that provider.
 */
export async function fetchCampaignById(
  supabase: SupabaseClient,
  campaignId: string,
  providerId?: string
): Promise<Project | null> {
  let query = supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId);
  if (providerId) {
    query = query.eq('provider_id', providerId);
  }
  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  return data as Project;
}

/**
 * Fetches the single active project (open, not closed). Returns null if none.
 */
export async function fetchActiveProject(supabase: SupabaseClient): Promise<Project | null> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('status', 'open')
    .eq('is_closed', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching active project:', error);
    return null;
  }
  return data;
}

/**
 * Fetches total applied area (10R) for a campaign, excluding canceled bookings.
 */
export async function fetchCampaignTotalArea(
  supabase: SupabaseClient,
  campaignId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('bookings')
    .select('area_10r')
    .eq('campaign_id', campaignId)
    .neq('status', 'canceled');

  if (error) {
    console.error('Error fetching campaign total area:', error);
    return 0;
  }
  return (data ?? []).reduce((sum, row) => sum + (Number(row?.area_10r) || 0), 0);
}

/**
 * Creates a new campaign (provider-facing). ID is UUID (DB campaigns.id is uuid type).
 *
 * @param supabase - Supabase client
 * @param input - Form data and polygon
 * @param providerId - Current provider user id (optional)
 */
export async function createCampaign(
  supabase: SupabaseClient,
  input: CampaignCreateInput,
  providerId?: string
): Promise<CampaignCreateResult> {
  try {
    const polygonWKT = geoJSONToWKT(input.targetAreaPolygon);
    const campaignId = crypto.randomUUID();

    const { data, error } = await supabase
      .from('campaigns')
      .insert({
        id: campaignId,
        provider_id: providerId ?? null,
        location: input.location,
        start_date: input.startDate,
        end_date: input.endDate,
        target_crop_id: input.cropId || null,
        task_category_id: input.categoryId || null,
        task_detail_id: input.detailId || null,
        pesticide_name: input.pesticide || null,
        dilution_rate: input.dilutionRate ? parseFloat(input.dilutionRate) : null,
        amount_per_10r: input.amountPer10r ? parseFloat(input.amountPer10r) : null,
        base_price: input.basePrice,
        min_price: input.minPrice,
        min_target_area_10r: input.minTargetArea10r || null,
        target_area_10r: input.targetArea10r,
        max_target_area_10r: input.maxTargetArea10r ?? input.targetArea10r ?? null,
        execution_price: input.executionPrice ?? null,
        confirmation_deadline_days: input.confirmationDeadlineDays || null,
        target_area_polygon: polygonWKT,
        status: 'open',
        is_closed: false,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating campaign:', error);
      return { success: false, error: error.message };
    }
    return { success: true, campaignId: data?.id ?? campaignId };
  } catch (e) {
    console.error('Unexpected error creating campaign:', e);
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Unknown error occurred',
    };
  }
}

/**
 * Closes a campaign: sets status=closed, is_closed=true, computes final_unit_price
 * from current total area and updates all non-canceled bookings' locked_price.
 * GAS: 募集締切処理と同様の計算式を使用。
 */
export async function closeCampaign(
  supabase: SupabaseClient,
  campaignId: string
): Promise<{ success: boolean; error?: string }> {
  const { data: project, error: fetchErr } = await supabase
    .from('campaigns')
    .select('id, base_price, min_price, target_area_10r, min_target_area_10r, max_target_area_10r, execution_price')
    .eq('id', campaignId)
    .single();

  if (fetchErr || !project) {
    return { success: false, error: '案件が見つかりません' };
  }

  const totalArea = await fetchCampaignTotalArea(supabase, campaignId);
  const pricing = {
    base_price: Number(project.base_price) || 0,
    min_price: Number(project.min_price) || 0,
    target_area_10r: Number(project.target_area_10r) || 0,
    min_target_area_10r: project.min_target_area_10r ?? undefined,
    max_target_area_10r: project.max_target_area_10r ?? undefined,
    execution_price: project.execution_price ?? undefined,
  };
  const result = calculateCurrentUnitPrice(pricing, totalArea);
  const finalUnitPrice =
    result.currentPrice ?? pricing.min_price ?? pricing.base_price ?? 0;

  const { error: updateProjectErr } = await supabase
    .from('campaigns')
    .update({
      status: 'closed',
      is_closed: true,
      final_unit_price: finalUnitPrice,
    })
    .eq('id', campaignId);

  if (updateProjectErr) {
    return { success: false, error: updateProjectErr.message };
  }

  const { error: updateBookingsErr } = await supabase
    .from('bookings')
    .update({ locked_price: finalUnitPrice })
    .eq('campaign_id', campaignId)
    .neq('status', 'canceled');

  if (updateBookingsErr) {
    return { success: false, error: updateBookingsErr.message };
  }
  return { success: true };
}

/**
 * Sets campaign status to 'completed'.
 * @deprecated 作業確定は setWorkConfirmBulk / setWorkConfirmIndividual を使用してください。
 */
export async function setCampaignCompleted(
  supabase: SupabaseClient,
  campaignId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('campaigns')
    .update({ status: 'completed' })
    .eq('id', campaignId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * 作業確定（一斉）: 案件に作業日を1日設定し、全申込にその日付を通知する。
 * campaign.final_date と 全 bookings.confirmed_date を設定し、status を completed にする。
 */
export async function setWorkConfirmBulk(
  supabase: SupabaseClient,
  campaignId: string,
  finalDate: string
): Promise<{ success: boolean; error?: string }> {
  const { error: campaignErr } = await supabase
    .from('campaigns')
    .update({ final_date: finalDate, status: 'completed' })
    .eq('id', campaignId);
  if (campaignErr) return { success: false, error: campaignErr.message };

  const { error: bookingsErr } = await supabase
    .from('bookings')
    .update({ confirmed_date: finalDate })
    .eq('campaign_id', campaignId)
    .neq('status', 'canceled');
  if (bookingsErr) return { success: false, error: bookingsErr.message };
  return { success: true };
}

/**
 * 作業確定（個別）: 各申込に日付（と時間）を設定する。
 * updates の bookingId に対応する confirmed_date を更新し、案件 status を completed にする。
 */
export async function setWorkConfirmIndividual(
  supabase: SupabaseClient,
  campaignId: string,
  updates: { bookingId: string; confirmedDate: string }[]
): Promise<{ success: boolean; error?: string }> {
  for (const u of updates) {
    const { error } = await supabase
      .from('bookings')
      .update({ confirmed_date: u.confirmedDate })
      .eq('id', u.bookingId)
      .eq('campaign_id', campaignId);
    if (error) return { success: false, error: error.message };
  }
  const { error } = await supabase
    .from('campaigns')
    .update({ status: 'completed' })
    .eq('id', campaignId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * ルート案表示用: 案件の申込一覧（畑情報付き）を取得。業者拠点からの1日ルート計算に使う。
 */
export interface BookingForRoute {
  id: string;
  farmer_id: string | null;
  farmer_name: string | null;
  area_10r: number;
  field_id: string | null;
  field: { id: string; lat: number | null; lng: number | null; address: string | null; name: string } | null;
}

export async function fetchBookingsWithFieldsForRoute(
  supabase: SupabaseClient,
  campaignId: string
): Promise<BookingForRoute[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, farmer_id, farmer_name, area_10r, field_id, fields(id, lat, lng, address, name)')
    .eq('campaign_id', campaignId)
    .neq('status', 'canceled');

  if (error) {
    console.error('fetchBookingsWithFieldsForRoute:', error);
    return [];
  }

  return (data ?? []).map((row: Record<string, unknown>): BookingForRoute => ({
    id: String(row.id ?? ''),
    farmer_id: (row.farmer_id ?? null) as string | null,
    farmer_name: (row.farmer_name ?? null) as string | null,
    area_10r: Number(row.area_10r) || 0,
    field_id: (row.field_id ?? null) as string | null,
    field: (row.fields ?? null) as BookingForRoute['field'],
  }));
}
