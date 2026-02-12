import { supabase } from './supabase';

export interface User {
    id: string;
    email: string;
    role: 'admin' | 'provider' | 'farmer';
    name: string;
    phone: string;
    status: string;
    associated_provider_id?: string;
    invitation_code?: string;
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

        return userData as User;
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
 * Link a farmer to a provider via invitation code
 */
export async function linkFarmerToProvider(farmerId: string, providerId: string): Promise<{ success: boolean; error?: string }> {
    try {
        // Check if already linked
        const { data: existing } = await supabase
            .from('farmer_providers')
            .select('*')
            .eq('farmer_id', farmerId)
            .eq('provider_id', providerId)
            .eq('status', 'active')
            .single();

        if (existing) {
            return { success: true }; // Already linked
        }

        // Insert new link
        const { error } = await supabase
            .from('farmer_providers')
            .insert({
                farmer_id: farmerId,
                provider_id: providerId,
                status: 'active',
                created_at: new Date().toISOString(),
            });

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
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
