import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

/**
 * Server-side Supabase client with service role (bypasses RLS).
 * 依頼に紐づく農家の畑情報など、RLS で通常取得できないデータを API 内でのみ取得するために使用する。
 * 必ずサーバー（API Route / Server Action）内でのみ使用すること。
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL と NEXT_SUPABASE_SERVICE_ROLE_KEY が必要です');
  }
  return createClient<Database>(url, key, { auth: { persistSession: false } });
}
