/**
 * RLS 検証: 認証なし（anon）では public テーブルが空またはエラーになることを確認する。
 * 実行には .env.local の NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY が必要。
 * 未設定時はスキップする。
 *
 * 実行: npm test -- src/lib/__tests__/rls-verification.test.ts
 */

import { createClient } from '@supabase/supabase-js';
import { describe, it, expect, beforeAll } from 'vitest';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

describe('RLS verification (anon)', () => {
  beforeAll(() => {
    if (!url || !anonKey) {
      console.warn('NEXT_PUBLIC_SUPABASE_URL / ANON_KEY が未設定のため RLS 検証をスキップします。');
    }
  });

  it.skipIf(!url || !anonKey)(
    'anon で users を select すると 0 件またはエラーになる',
    async () => {
      const supabase = createClient(url!, anonKey!);
      const { data, error } = await supabase.from('users').select('id').limit(10);
      expect(error != null || (Array.isArray(data) && data.length === 0)).toBe(true);
    },
    10000
  );

  it.skipIf(!url || !anonKey)(
    'anon で fields を select すると 0 件またはエラーになる',
    async () => {
      const supabase = createClient(url!, anonKey!);
      const { data, error } = await supabase.from('fields').select('id').limit(10);
      expect(error != null || (Array.isArray(data) && data.length === 0)).toBe(true);
    },
    10000
  );
});
