/**
 * Auth & user post-login business logic (server-side).
 * Ported from GAS: post-verification status update and farmer-provider linking.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { FARMER_PROVIDERS_MAX } from '@/types/database';

export interface AuthCallbackSession {
  user: { email?: string | null; id?: string; user_metadata?: { provider_id?: string } };
}

export interface AuthCallbackResult {
  redirectPath: string;
}

/**
 * Links a farmer to a provider (invitation code or invite link).
 * Enforces max FARMER_PROVIDERS_MAX links per farmer.
 * Used by auth callback and by client-side invitation flow.
 *
 * @param supabase - Supabase client (server or browser)
 * @param farmerId - Farmer user id
 * @param providerId - Provider user id
 * @returns success and optional error message
 */
export async function linkFarmerToProvider(
  supabase: SupabaseClient,
  farmerId: string,
  providerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: existing } = await supabase
      .from('farmer_providers')
      .select('provider_id')
      .eq('farmer_id', farmerId)
      .eq('provider_id', providerId)
      .eq('status', 'active')
      .maybeSingle();

    if (existing) {
      return { success: true };
    }

    const { count, error: countError } = await supabase
      .from('farmer_providers')
      .select('*', { count: 'exact', head: true })
      .eq('farmer_id', farmerId)
      .eq('status', 'active');

    if (countError || (count ?? 0) >= FARMER_PROVIDERS_MAX) {
      return {
        success: false,
        error: `紐付けできる業者は最大${FARMER_PROVIDERS_MAX}件までです。`,
      };
    }

    const { error } = await supabase.from('farmer_providers').insert({
      farmer_id: farmerId,
      provider_id: providerId,
      status: 'active',
      created_at: new Date().toISOString(),
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Unknown error',
    };
  }
}

interface UserRowForCallback {
  role: string;
  id: string;
  invitation_code: string | null;
}

/**
 * Handles post-auth callback: update user status, link farmer to provider if applicable.
 * GAS: 認証後ユーザー状態を 'under_review' (業者) または 'active' (農家) に更新し、
 * 農家の場合は招待リンク/招待コードから業者紐付けを行う。
 *
 * @param supabase - Server Supabase client (with session cookies)
 * @param session - Session after exchangeCodeForSession
 * @param origin - Request origin for redirect URL
 * @returns Redirect path (e.g. '/auth/pending-approval' or '/auth/verified' or '/login' on error)
 */
export async function handleAuthCallback(
  supabase: SupabaseClient,
  session: AuthCallbackSession,
  origin: string
): Promise<AuthCallbackResult> {
  const email = session.user?.email;
  if (!email) {
    return { redirectPath: '/login' };
  }

  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('role, id, invitation_code, associated_provider_id')
    .eq('email', email)
    .single();

  if (userError || !userData) {
    return { redirectPath: '/login' };
  }

  const user = userData as UserRowForCallback;
  const newStatus = user.role === 'provider' ? 'under_review' : 'active';

  await supabase.from('users').update({ status: newStatus }).eq('email', email);

  if (user.role === 'farmer') {
    let providerIdFromInvite: string | null =
      (session.user?.user_metadata?.provider_id as string) || null;
    if (!providerIdFromInvite && user.invitation_code) {
      const { data: providerByCode } = await supabase
        .from('users')
        .select('id')
        .eq('invitation_code', user.invitation_code)
        .eq('role', 'provider')
        .single();
      providerIdFromInvite = providerByCode?.id ?? null;
    }

    if (providerIdFromInvite) {
      const { data: alreadyLinked } = await supabase
        .from('farmer_providers')
        .select('provider_id')
        .eq('farmer_id', user.id)
        .eq('provider_id', providerIdFromInvite)
        .eq('status', 'active')
        .maybeSingle();

      const { count } = await supabase
        .from('farmer_providers')
        .select('*', { count: 'exact', head: true })
        .eq('farmer_id', user.id)
        .eq('status', 'active');

      if (!alreadyLinked && (count ?? 0) < FARMER_PROVIDERS_MAX) {
        await supabase.from('farmer_providers').insert({
          farmer_id: user.id,
          provider_id: providerIdFromInvite,
          status: 'active',
          created_at: new Date().toISOString(),
        });
      }
    }
  }

  if (user.role === 'provider') {
    return { redirectPath: '/auth/pending-approval' };
  }
  return { redirectPath: '/auth/verified' };
}
