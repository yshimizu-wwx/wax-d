/**
 * Work request (作業依頼) CRUD operations.
 * Ported from GAS: 農家→業者 依頼データの作成・一覧取得.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { WorkRequest } from '@/types/database';

export interface WorkRequestCreateInput {
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

export interface WorkRequestCreateResult {
  success: boolean;
  error?: string;
  requestId?: string;
}

/**
 * Creates a new work request. ID generated with prefix WR_ (GAS-style).
 */
export async function createWorkRequest(
  supabase: SupabaseClient,
  input: WorkRequestCreateInput
): Promise<WorkRequestCreateResult> {
  try {
    const id = `WR_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const insertRow: Record<string, unknown> = {
      id,
      farmer_id: input.farmer_id,
      provider_id: input.provider_id,
      location: input.location ?? null,
      crop_name: input.crop_name ?? null,
      task_category_name: input.task_category_name ?? null,
      task_detail_name: input.task_detail_name ?? null,
      crop_name_free_text: input.crop_name_free_text ?? null,
      task_category_free_text: input.task_category_free_text ?? null,
      task_detail_free_text: input.task_detail_free_text ?? null,
      desired_start_date: input.desired_start_date ?? null,
      desired_end_date: input.desired_end_date ?? null,
      estimated_area_10r: input.estimated_area_10r ?? null,
      notes: input.notes ?? null,
      status: 'pending',
    };
    if (input.field_ids?.length) insertRow.field_ids = input.field_ids;

    const { data: row, error } = await supabase
      .from('work_requests')
      .insert(insertRow)
      .select('id')
      .single();

    if (error) {
      console.error('Error creating work request:', error);
      return { success: false, error: error.message };
    }
    return { success: true, requestId: row?.id ?? id };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Unknown error',
    };
  }
}

/**
 * Fetches all work requests for a farmer, ordered by created_at desc.
 */
export async function fetchWorkRequestsByFarmer(
  supabase: SupabaseClient,
  farmerId: string
): Promise<WorkRequest[]> {
  const { data, error } = await supabase
    .from('work_requests')
    .select('*')
    .eq('farmer_id', farmerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching work requests:', error);
    return [];
  }
  return data ?? [];
}
