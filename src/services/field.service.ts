/**
 * Field (圃場) CRUD operations.
 * Ported from GAS: fields sheet / 畑管理.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Field } from '@/types/database';
import { toUserFriendlyError } from '@/lib/errorMessage';

export interface FieldCreateInput {
  farmer_id: string;
  name?: string;
  address?: string;
  area_size?: number;
  lat?: number;
  lng?: number;
  area_coordinates?: unknown;
}

export interface FieldUpdateInput {
  name?: string;
  address?: string;
  area_size?: number;
  lat?: number;
  lng?: number;
  area_coordinates?: unknown;
}

/**
 * Fetches all fields for a farmer, ordered by created_at desc.
 */
export async function fetchFieldsByFarmer(
  supabase: SupabaseClient,
  farmerId: string
): Promise<Field[]> {
  const { data, error } = await supabase
    .from('fields')
    .select('*')
    .eq('farmer_id', farmerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching fields:', error);
    return [];
  }
  return data ?? [];
}

/**
 * Creates a new field. ID は DB の UUID デフォルト（gen_random_uuid()）に任せる。
 */
export async function createField(
  supabase: SupabaseClient,
  input: FieldCreateInput
): Promise<{ success: boolean; error?: string; fieldId?: string }> {
  try {
    const { data: row, error } = await supabase
      .from('fields')
      .insert({
        farmer_id: input.farmer_id,
        name: input.name ?? null,
        address: input.address ?? null,
        area_size: input.area_size ?? null,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
        area_coordinates: input.area_coordinates ?? null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating field:', error);
      return { success: false, error: toUserFriendlyError(error.message) };
    }
    return { success: true, fieldId: row?.id ?? undefined };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('Error creating field:', e);
    return { success: false, error: toUserFriendlyError(message) };
  }
}

/**
 * Updates a field by id. Only provided fields are updated.
 */
export async function updateField(
  supabase: SupabaseClient,
  fieldId: string,
  data: FieldUpdateInput
): Promise<{ success: boolean; error?: string }> {
  const payload: Record<string, unknown> = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.address !== undefined) payload.address = data.address;
  if (data.area_size !== undefined) payload.area_size = data.area_size;
  if (data.lat !== undefined) payload.lat = data.lat;
  if (data.lng !== undefined) payload.lng = data.lng;
  if (data.area_coordinates !== undefined) payload.area_coordinates = data.area_coordinates;

  const { error } = await supabase.from('fields').update(payload).eq('id', fieldId);
  if (error) {
    console.error('Error updating field:', error);
    return { success: false, error: toUserFriendlyError(error.message) };
  }
  return { success: true };
}

/**
 * Deletes a field by id.
 */
export async function deleteField(
  supabase: SupabaseClient,
  fieldId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('fields').delete().eq('id', fieldId);
  if (error) {
    console.error('Error deleting field:', error);
    return { success: false, error: toUserFriendlyError(error.message) };
  }
  return { success: true };
}
