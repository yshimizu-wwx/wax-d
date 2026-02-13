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

export type { FarmerBookingItem } from '@/services/booking.service';

export async function fetchBookingsByFarmer(farmerId: string): Promise<bookingService.FarmerBookingItem[]> {
  return bookingService.fetchBookingsByFarmer(supabase, farmerId);
}

export async function fetchCampaignTotalArea(campaignId: string): Promise<number> {
  return campaignService.fetchCampaignTotalArea(supabase, campaignId);
}

export interface BookingData {
  campaign_id: string;
  farmer_id?: string | null;
  farmer_name: string;
  phone: string;
  email: string;
  desired_start_date: string;
  desired_end_date: string;
  field_polygon: Polygon;
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
    field_polygon: bookingData.field_polygon,
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

/** 農家が紐付いている業者一覧（作業依頼で選択可能） */
export async function fetchLinkedProvidersForFarmer(farmerId: string): Promise<LinkedProvider[]> {
  const { data: links } = await supabase
    .from('farmer_providers')
    .select('provider_id')
    .eq('farmer_id', farmerId)
    .eq('status', 'active');
  const ids = links?.map((l) => l.provider_id).filter(Boolean) ?? [];
  if (ids.length === 0) return [];
  const { data: users } = await supabase.from('users').select('id, name').in('id', ids);
  const nameMap = new Map((users ?? []).map((u) => [u.id, u.name ?? u.id]));
  return ids.map((id) => ({ id, name: nameMap.get(id) ?? '業者' }));
}

export async function createWorkRequest(
  data: WorkRequestData
): Promise<{ success: boolean; error?: string; requestId?: string }> {
  return workRequestService.createWorkRequest(supabase, data);
}

export async function fetchWorkRequestsByFarmer(farmerId: string): Promise<WorkRequest[]> {
  return workRequestService.fetchWorkRequestsByFarmer(supabase, farmerId);
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
}

export async function createField(
  data: FieldData
): Promise<{ success: boolean; error?: string; fieldId?: string }> {
  return fieldService.createField(supabase, data);
}

export async function updateField(
  fieldId: string,
  data: Partial<Omit<FieldData, 'farmer_id'>>
): Promise<{ success: boolean; error?: string }> {
  return fieldService.updateField(supabase, fieldId, data);
}

export async function deleteField(fieldId: string): Promise<{ success: boolean; error?: string }> {
  return fieldService.deleteField(supabase, fieldId);
}
