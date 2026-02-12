import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');

    if (code) {
        const supabase = await createClient();

        // Exchange code for session (session is written to cookies via createClient's setAll)
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error && data.user) {
            // Update user status in public.users table
            const { data: userData } = await supabase
                .from('users')
                .select('role, id, invitation_code, associated_provider_id')
                .eq('email', data.user.email)
                .single();

            if (userData) {
                // Provider goes to 'under_review', farmer goes to 'active'
                const newStatus = userData.role === 'provider' ? 'under_review' : 'active';

                await supabase
                    .from('users')
                    .update({ status: newStatus })
                    .eq('email', data.user.email);

                // If farmer with invitation code, link to provider
                if (userData.role === 'farmer' && userData.invitation_code) {
                    const { data: providerData } = await supabase
                        .from('users')
                        .select('id')
                        .eq('invitation_code', userData.invitation_code)
                        .eq('role', 'provider')
                        .single();

                    if (providerData && providerData.id !== userData.associated_provider_id) {
                        // Insert into farmer_providers table
                        await supabase
                            .from('farmer_providers')
                            .insert({
                                farmer_id: userData.id,
                                provider_id: providerData.id,
                                status: 'active',
                                created_at: new Date().toISOString(),
                            });
                    }
                }

                // Redirect based on role
                if (userData.role === 'provider') {
                    return NextResponse.redirect(new URL('/auth/pending-approval', requestUrl.origin));
                } else {
                    return NextResponse.redirect(new URL('/auth/verified', requestUrl.origin));
                }
            }
        }
    }

    // Redirect to login on error
    return NextResponse.redirect(new URL('/login', requestUrl.origin));
}
