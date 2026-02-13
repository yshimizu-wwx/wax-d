import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
    let res = NextResponse.next({
        request: {
            headers: req.headers,
        },
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return req.cookies.get(name)?.value;
                },
                set(name: string, value: string, options: any) {
                    req.cookies.set({
                        name,
                        value,
                        ...options,
                    });
                    res = NextResponse.next({
                        request: {
                            headers: req.headers,
                        },
                    });
                    res.cookies.set({
                        name,
                        value,
                        ...options,
                    });
                },
                remove(name: string, options: any) {
                    req.cookies.set({
                        name,
                        value: '',
                        ...options,
                    });
                    res = NextResponse.next({
                        request: {
                            headers: req.headers,
                        },
                    });
                    res.cookies.set({
                        name,
                        value: '',
                        ...options,
                    });
                },
            },
        }
    );

    const {
        data: { session },
    } = await supabase.auth.getSession();

    // #region agent log
    if (req.nextUrl.pathname.startsWith('/api')) {
        fetch('http://127.0.0.1:7245/ingest/18abc857-b9fe-472f-879d-ab424fec0177', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'middleware.ts', message: 'api request', data: { pathname: req.nextUrl.pathname, hasSession: !!session }, timestamp: Date.now(), hypothesisId: 'H1_middleware' }) }).catch(() => {});
    }
    // #endregion

    // Public routes that don't require authentication
    const publicRoutes = ['/login', '/auth/callback', '/auth/verified', '/auth/pending-approval'];
    const isPublicRoute = publicRoutes.some(route => req.nextUrl.pathname.startsWith(route));

    if (!session) {
        if (isPublicRoute) return res;
        // #region agent log
        if (req.nextUrl.pathname.startsWith('/api')) {
            fetch('http://127.0.0.1:7245/ingest/18abc857-b9fe-472f-879d-ab424fec0177', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'middleware.ts', message: 'redirect to login (no session)', data: { pathname: req.nextUrl.pathname }, timestamp: Date.now(), hypothesisId: 'H1_middleware' }) }).catch(() => {});
        }
        // #endregion
        return NextResponse.redirect(new URL('/login', req.url));
    }

    // Fetch user data once for role/status checks
    const { data: userData } = await supabase
        .from('users')
        .select('role, status')
        .eq('email', session.user.email)
        .single();

    // Logged-in user on login page -> redirect to role-based dashboard or pending
    if (req.nextUrl.pathname === '/login') {
        if (!userData) return res; // allow login page if user row missing (edge case)
        if (userData.status === 'pending') return NextResponse.redirect(new URL('/auth/pending-approval', req.url));
        if (userData.role === 'provider' && userData.status === 'under_review') return NextResponse.redirect(new URL('/auth/pending-approval', req.url));
        if (userData.status !== 'suspended' && userData.status !== 'rejected') {
            const roleHome = userData.role === 'admin' ? '/admin' : userData.role === 'provider' ? '/admin' : '/';
            return NextResponse.redirect(new URL(roleHome, req.url));
        }
        return res;
    }

    if (isPublicRoute) return res;

    if (!userData) {
        // User not found in public.users, redirect to login
        const redirectUrl = new URL('/login', req.url);
        return NextResponse.redirect(redirectUrl);
    }

    // Check if user status is active (or under_review for providers accessing their own pages)
    if (userData.status === 'pending') {
        const redirectUrl = new URL('/auth/pending-approval', req.url);
        return NextResponse.redirect(redirectUrl);
    }

    if (userData.status === 'suspended' || userData.status === 'rejected') {
        await supabase.auth.signOut();
        const redirectUrl = new URL('/login', req.url);
        return NextResponse.redirect(redirectUrl);
    }

    // Role-based access control
    const pathname = req.nextUrl.pathname;

    // Admin routes
    if (pathname.startsWith('/admin')) {
        if (userData.role !== 'admin' && userData.role !== 'provider') {
            // Only admin and provider can access /admin routes
            const redirectUrl = new URL('/', req.url);
            return NextResponse.redirect(redirectUrl);
        }
    }

    // Provider-specific routes (if we create them later)
    if (pathname.startsWith('/provider')) {
        if (userData.role !== 'provider') {
            const redirectUrl = new URL('/', req.url);
            return NextResponse.redirect(redirectUrl);
        }
    }

    return res;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public files (public folder)
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
