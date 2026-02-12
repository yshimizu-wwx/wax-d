import { supabase } from '@/lib/supabase';
import type { Master, MasterType } from '@/types/database';

/**
 * Fetch masters for a provider (or all for admin when providerId is null).
 * Provider sees only their own (provider_id = providerId or provider_id is null for system defaults).
 */
export async function fetchMasters(
  type: MasterType,
  providerId: string | null
): Promise<Master[]> {
  let query = supabase
    .from('masters')
    .select('*')
    .eq('type', type)
    .order('name', { ascending: true });

  if (providerId) {
    query = query.or(`provider_id.eq.${providerId},provider_id.is.null`);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching masters:', error);
    return [];
  }
  return (data as Master[]) || [];
}

/**
 * Create a new master row.
 */
export async function createMaster(
  type: MasterType,
  name: string,
  providerId: string | null,
  parentId?: string | null
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const id = `M_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const { error } = await supabase.from('masters').insert({
      id,
      provider_id: providerId,
      type,
      name: name.trim(),
      parent_id: parentId || null,
      status: 'active',
    });
    if (error) return { success: false, error: error.message };
    return { success: true, id };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

/**
 * Update master name or status.
 */
export async function updateMaster(
  id: string,
  updates: { name?: string; status?: 'active' | 'inactive' }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('masters')
      .update(updates)
      .eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

/**
 * Soft delete: set status to inactive.
 */
export async function setMasterInactive(id: string): Promise<{ success: boolean; error?: string }> {
  return updateMaster(id, { status: 'inactive' });
}

/**
 * Restore: set status to active.
 */
export async function setMasterActive(id: string): Promise<{ success: boolean; error?: string }> {
  return updateMaster(id, { status: 'active' });
}
