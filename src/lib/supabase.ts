import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Browser Supabase client (uses cookies so session is shared with server/middleware). */
export const supabase = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
