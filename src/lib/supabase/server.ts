import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server-side Supabase client for Route Handlers, Server Components, Server Actions.
 * Uses next/headers cookies so session is persisted correctly (e.g. after auth callback).
 */
export async function createClient() {
    const cookieStore = await cookies();

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            if (value) {
                                cookieStore.set(name, value, options);
                            } else {
                                cookieStore.delete(name);
                            }
                        });
                    } catch {
                        // setAll can be ignored in Server Component tree (e.g. during render)
                    }
                },
            },
        }
    );
}
