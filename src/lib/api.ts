/**
 * Client-facing API: delegates to services with browser Supabase client.
 * UI components and client pages use these functions; business logic lives in src/services/.
 */

import { supabase } from '@/lib/supabase';
import type { Project, WorkRequest, Field } from '@/types/database';
import type { Polygon } from 'geojson';
import * as campaignService from '@/services/campaign.service';
import * as bookingService from '@/services/booking.service';
import * as fieldService from '@/services/field.service';
import * as workRequestService from '@/services/work-request.service';

export async function fetchProjects(): Promise<Project[]> {
  return campaignService.fetchOpenCampaigns(supabase);
}

export async function fetchActiveProject(): Promise<Project | null> {
  return campaignService.fetchActiveProject(supabase);
}

export async function fetchOpenCampaigns(): Promise<Project[]> {
  return campaignService.fetchOpenCampaigns(supabase);
}

export type { CampaignStatusFilter, FetchCampaignsOptions } from '@/services/campaign.service';

export async function fetchCampaigns(
  options: campaignService.FetchCampaignsOptions = {}
): Promise<Project[]> {
  return campaignService.fetchCampaigns(supabase, options);
}

export async function fetchCampaignById(
  campaignId: string,
  providerId?: string
): Promise<Project | null> {
  return campaignService.fetchCampaignById(supabase, campaignId, providerId);
}

export type { FarmerBookingItem } from '@/services/booking.service';

export async function fetchBookingsByFarmer(farmerId: string): Promise<bookingService.FarmerBookingItem[]> {
  return bookingService.fetchBookingsByFarmer(supabase, farmerId);
}

export async function requestCancelBooking(
  bookingId: string,
  farmerId: string
): Promise<{ success: boolean; error?: string }> {
  return bookingService.requestCancelBooking(supabase, bookingId, farmerId);
}

export async function fetchCampaignTotalArea(campaignId: string): Promise<number> {
  return campaignService.fetchCampaignTotalArea(supabase, campaignId);
}

export type { CampaignBookingSummary, CampaignBookingSummaryItem } from '@/services/campaign.service';

/** 業者案件一覧用: 複数案件の申込サマリ（件数・面積・金額・農家別一覧）を一括取得 */
export async function fetchBookingSummariesForCampaigns(campaignIds: string[]) {
  return campaignService.fetchBookingSummariesForCampaigns(supabase, campaignIds);
}

export interface BookingData {
  campaign_id: string;
  farmer_id?: string | null;
  farmer_name: string;
  phone: string;
  email: string;
  desired_start_date?: string;
  desired_end_date?: string;
  /** 畑選択で申し込む場合は指定。このとき field_polygon は省略可。 */
  field_id?: string | null;
  field_polygon?: Polygon | null;
  area_10r: number;
  locked_price: number;
}

export async function createBooking(
  bookingData: BookingData
): Promise<{ success: boolean; error?: string; bookingId?: string }> {
  return bookingService.createBooking(supabase, {
    campaign_id: bookingData.campaign_id,
    farmer_id: bookingData.farmer_id,
    farmer_name: bookingData.farmer_name,
    phone: bookingData.phone,
    email: bookingData.email,
    desired_start_date: bookingData.desired_start_date,
    desired_end_date: bookingData.desired_end_date,
    field_id: bookingData.field_id,
    field_polygon: bookingData.field_polygon ?? undefined,
    area_10r: bookingData.area_10r,
    locked_price: bookingData.locked_price,
  });
}

export interface CampaignCreateData {
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

export async function createCampaign(
  campaignData: CampaignCreateData,
  providerId?: string
): Promise<{ success: boolean; error?: string; campaignId?: string }> {
  return campaignService.createCampaign(supabase, campaignData, providerId);
}

export async function closeCampaign(campaignId: string): Promise<{ success: boolean; error?: string }> {
  return campaignService.closeCampaign(supabase, campaignId);
}

export async function setCampaignCompleted(campaignId: string): Promise<{ success: boolean; error?: string }> {
  return campaignService.setCampaignCompleted(supabase, campaignId);
}

/** 作業確定（一斉）: 日付1つを全申込に通知。案件 final_date と全 booking の confirmed_date を設定。 */
export async function setWorkConfirmBulk(
  campaignId: string,
  finalDate: string
): Promise<{ success: boolean; error?: string }> {
  return campaignService.setWorkConfirmBulk(supabase, campaignId, finalDate);
}

/** 作業確定（個別）: 各申込に日付を設定。 */
export async function setWorkConfirmIndividual(
  campaignId: string,
  updates: { bookingId: string; confirmedDate: string }[]
): Promise<{ success: boolean; error?: string }> {
  return campaignService.setWorkConfirmIndividual(supabase, campaignId, updates);
}

export type { BookingForRoute } from '@/services/campaign.service';

/** ルート案表示用: 案件の申込一覧（畑情報付き）を取得。 */
export async function fetchBookingsWithFieldsForRoute(campaignId: string) {
  return campaignService.fetchBookingsWithFieldsForRoute(supabase, campaignId);
}

export interface WorkRequestData {
  farmer_id: string;
  provider_id: string;
  location?: string;
  crop_name?: string;
  task_category_name?: string;
  task_detail_name?: string;
  crop_name_free_text?: string;
  task_category_free_text?: string;
  task_detail_free_text?: string;
  desired_start_date?: string;
  desired_end_date?: string;
  estimated_area_10r?: number;
  notes?: string;
  field_ids?: string[];
}

/** 紐付き業者（農家が選択可能な業者） */
export interface LinkedProvider {
  id: string;
  name: string;
}

/** 農家が紐付いている業者一覧（作業依頼で選択可能）。RPC で取得し RLS の影響を受けないようにする。 */
export async function fetchLinkedProvidersForFarmer(_farmerId: string): Promise<LinkedProvider[]> {
  const { data, error } = await supabase.rpc('get_linked_providers_for_current_farmer');
  if (error) {
    console.error('fetchLinkedProvidersForFarmer RPC error:', error);
    if (error.message?.includes('Could not find the function') && error.message?.includes('get_linked_providers_for_current_farmer')) {
      console.info('紐付き業者一覧用の RPC がデータベースに存在しません。Supabase でマイグレーションを適用してください。手順: docs/fix-linked-providers-rpc.md');
    }
    return [];
  }
  const list = (data as Array<{ id: string; name: string }> | null) ?? [];
  return list.map((p) => ({ id: p.id, name: p.name ?? '業者' }));
}

export async function createWorkRequest(
  data: WorkRequestData
): Promise<{ success: boolean; error?: string; requestId?: string }> {
  return workRequestService.createWorkRequest(supabase, data);
}

export async function fetchWorkRequestsByFarmer(farmerId: string): Promise<WorkRequest[]> {
  return workRequestService.fetchWorkRequestsByFarmer(supabase, farmerId);
}

export async function fetchWorkRequestsByProvider(providerId: string): Promise<WorkRequest[]> {
  return workRequestService.fetchWorkRequestsByProvider(supabase, providerId);
}

export async function fetchWorkRequestById(
  workRequestId: string,
  providerId: string
): Promise<WorkRequest | null> {
  return workRequestService.fetchWorkRequestById(supabase, workRequestId, providerId);
}

export async function setWorkRequestConverted(
  workRequestId: string,
  providerId: string,
  campaignId: string
): Promise<{ success: boolean; error?: string }> {
  return workRequestService.setWorkRequestConverted(supabase, workRequestId, providerId, campaignId);
}

export async function fetchFieldsByFarmer(farmerId: string): Promise<Field[]> {
  return fieldService.fetchFieldsByFarmer(supabase, farmerId);
}

export interface FieldData {
  farmer_id: string;
  name?: string;
  address?: string;
  area_size?: number;
  lat?: number;
  lng?: number;
  area_coordinates?: unknown;
}

export async function createField(
  data: FieldData
): Promise<{ success: boolean; error?: string; fieldId?: string }> {
  return fieldService.createField(supabase, data);
}

export async function updateField(
  fieldId: string,
  data: Partial<Omit<FieldData, 'farmer_id'>> & { area_coordinates?: unknown }
): Promise<{ success: boolean; error?: string }> {
  return fieldService.updateField(supabase, fieldId, data);
}

export async function deleteField(fieldId: string): Promise<{ success: boolean; error?: string }> {
  return fieldService.deleteField(supabase, fieldId);
}
