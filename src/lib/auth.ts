import { supabase } from './supabase';
import { linkFarmerToProvider as linkFarmerToProviderService } from '@/services/auth.service';
import type { UserRow } from '@/types/database';

/** Current user shape for UI (subset of UserRow) */
export interface User {
    id: string;
    email: string;
    role: 'admin' | 'provider' | 'farmer';
    name: string;
    phone: string;
    status: string;
    address?: string | null;
    lat?: number | null;
    lng?: number | null;
    associated_provider_id?: string | null;
    invitation_code?: string | null;
}

/**
 * Get the currently logged-in user
 */
export async function getCurrentUser(): Promise<User | null> {
    try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            return null;
        }

        const { data: userData, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', session.user.email)
            .single();

        if (error || !userData) {
            return null;
        }

        const row = userData as UserRow;
        return {
            id: row.id,
            email: row.email ?? '',
            role: row.role,
            name: row.name ?? '',
            phone: row.phone ?? '',
            status: row.status ?? '',
            address: row.address ?? undefined,
            lat: row.lat ?? undefined,
            lng: row.lng ?? undefined,
            associated_provider_id: row.associated_provider_id ?? undefined,
            invitation_code: row.invitation_code ?? undefined,
        } as User;
    } catch (error) {
        console.error('Error getting current user:', error);
        return null;
    }
}

/**
 * Sign out the current user
 */
export async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/login';
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
}

/**
 * Link a farmer to a provider (invitation code or invite link).
 * Enforces max FARMER_PROVIDERS_MAX links per farmer. Delegates to auth.service.
 */
export async function linkFarmerToProvider(farmerId: string, providerId: string): Promise<{ success: boolean; error?: string }> {
    return linkFarmerToProviderService(supabase, farmerId, providerId);
}

/**
 * Update current user profile (name, phone, address) in public.users
 */
export async function updateUserProfile(updates: {
    name?: string;
    phone?: string;
    address?: string;
}): Promise<{ success: boolean; error?: string }> {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.email) {
            return { success: false, error: 'ログインしていません' };
        }
        const { error } = await supabase
            .from('users')
            .update({
                ...(updates.name !== undefined && { name: updates.name }),
                ...(updates.phone !== undefined && { phone: updates.phone }),
                ...(updates.address !== undefined && { address: updates.address }),
            })
            .eq('email', session.user.email);
        if (error) {
            return { success: false, error: error.message };
        }
        return { success: true };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        return { success: false, error: msg };
    }
}

/**
 * Update password via Supabase Auth
 */
export async function updatePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) {
            return { success: false, error: error.message };
        }
        return { success: true };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        return { success: false, error: msg };
    }
}

/**
 * Generate or get invitation code for a provider
 */
export async function getInvitationCode(providerId: string): Promise<string | null> {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('invitation_code')
            .eq('id', providerId)
            .single();

        if (error || !data) {
            return null;
        }

        // If no invitation code exists, generate one
        if (!data.invitation_code) {
            const newCode = `INV_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

            await supabase
                .from('users')
                .update({ invitation_code: newCode })
                .eq('id', providerId);

            return newCode;
        }

        return data.invitation_code;
    } catch (error) {
        console.error('Error getting invitation code:', error);
        return null;
    }
}
