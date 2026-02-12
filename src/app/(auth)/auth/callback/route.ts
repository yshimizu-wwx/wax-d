import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { handleAuthCallback } from '@/services/auth.service';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/login', requestUrl.origin));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(new URL('/login', requestUrl.origin));
  }

  const result = await handleAuthCallback(supabase, { user: data.user }, requestUrl.origin);
  return NextResponse.redirect(new URL(result.redirectPath, requestUrl.origin));
}
