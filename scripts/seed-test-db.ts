/**
 * テスト用DBをクリーンな状態にリセットし、必須マスタ＋テストユーザーを投入するスクリプト (#21)
 *
 * - 既存データを全削除（TRUNCATE 用 RPC 呼び出し）
 * - Auth のテスト用ユーザーを削除してから再作成
 * - 必須マスタ（crop / task_category / task_detail）を 1 件ずつ投入
 *
 * 実行: npm run test:seed
 * 必要: .env.local に NEXT_PUBLIC_SUPABASE_URL と NEXT_SUPABASE_SERVICE_ROLE_KEY（Legacy JWT 形式）
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

function loadEnvLocal(): void {
  const paths = [join(rootDir, '.env.local'), join(process.cwd(), '.env.local')];
  for (const p of paths) {
    if (!existsSync(p)) continue;
    const content = readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    for (const line of content.split('\n')) {
      const m = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m) {
        const key = m[1];
        const value = m[2].replace(/^["']|["']$/g, '').trim();
        if (!process.env[key]) process.env[key] = value;
      }
    }
    return;
  }
}

loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'エラー: .env.local に NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY（または NEXT_SUPABASE_SERVICE_ROLE_KEY）を設定してください。'
  );
  process.exit(1);
}

if (SUPABASE_SERVICE_ROLE_KEY.startsWith('sb_secret_')) {
  console.error(
    'エラー: RLS をバイパスするには Legacy の service_role キー（eyJ... で始まる JWT）を .env.local に設定してください。'
  );
  process.exit(1);
}

const PASSWORD = '11111111';

const TEST_ACCOUNTS = [
  { email: 'shimizu.g.eggs@gmail.com', role: 'farmer' as const, name: 'テスト農家', idPrefix: 'F' },
  { email: 'yusuke.shimizu.work.0509@gmail.com', role: 'provider' as const, name: 'テスト業者', idPrefix: 'P' },
  { email: 'yshimizu@wayfinderworx.com', role: 'admin' as const, name: 'テスト管理者', idPrefix: 'A' },
];

const TEST_MASTERS = [
  { type: 'crop' as const, name: 'テスト作物' },
  { type: 'task_category' as const, name: 'テスト作業カテゴリ' },
  { type: 'task_detail' as const, name: 'テスト作業詳細' },
];

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function deleteAuthTestUsers(): Promise<void> {
  const emails = TEST_ACCOUNTS.map((a) => a.email);
  let page = 1;
  const perPage = 50;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.warn('Auth ユーザー一覧取得の警告:', error.message);
      break;
    }
    if (!data?.users?.length) break;
    for (const user of data.users) {
      if (user.email && emails.includes(user.email)) {
        const { error: delErr } = await supabase.auth.admin.deleteUser(user.id);
        if (delErr) console.warn(`Auth 削除失敗 ${user.email}:`, delErr.message);
        else console.log(`Auth 削除: ${user.email}`);
      }
    }
    if (data.users.length < perPage) break;
    page++;
  }
}

async function resetPublicData(): Promise<void> {
  const { error } = await supabase.rpc('reset_test_data');
  if (error) {
    if (error.message?.includes('Could not find the function')) {
      console.error(
        'reset_test_data が見つかりません。先にマイグレーションを適用してください: npx supabase db push'
      );
    }
    throw new Error(`reset_test_data RPC 失敗: ${error.message}`);
  }
  console.log('public テーブルをリセットしました。');
}

async function seedTestAccounts(): Promise<string | null> {
  let providerId: string | null = null;
  for (const account of TEST_ACCOUNTS) {
    const userId = `${account.idPrefix}-${uuid().slice(0, 8)}`;
    try {
      const { error: authError } = await supabase.auth.admin.createUser({
        email: account.email,
        password: PASSWORD,
        email_confirm: true,
      });
      if (authError && !authError.message?.includes('already been registered')) {
        console.error(`[${account.name}] Auth 作成失敗:`, authError.message);
        continue;
      }
      if (!authError) console.log(`[${account.name}] Auth 作成: ${account.email}`);

      const { data: existing } = await supabase.from('users').select('id').eq('email', account.email).single();
      if (existing) {
        await supabase
          .from('users')
          .update({ role: account.role, name: account.name, status: 'active' })
          .eq('email', account.email);
        console.log(`[${account.name}] public.users 更新: ${account.email}`);
        if (account.role === 'provider') providerId = existing.id;
        continue;
      }

      const { error: insertError } = await supabase.from('users').insert({
        id: userId,
        email: account.email,
        role: account.role,
        name: account.name,
        phone: '',
        status: 'active',
        associated_provider_id: null,
        invitation_code: null,
      });
      if (insertError) {
        console.error(`[${account.name}] public.users 挿入失敗:`, insertError.message);
      } else {
        console.log(`[${account.name}] public.users 挿入: ${account.email}`);
        if (account.role === 'provider') providerId = userId;
      }
    } catch (err) {
      console.error(`[${account.name}] エラー:`, err instanceof Error ? err.message : err);
    }
  }
  return providerId;
}

async function seedMasters(providerId: string): Promise<void> {
  for (const m of TEST_MASTERS) {
    const id = uuid();
    const { error } = await supabase.from('masters').insert({
      id,
      provider_id: providerId,
      type: m.type,
      name: m.name,
      parent_id: null,
      status: 'active',
    });
    if (error) console.warn(`マスタ挿入失敗 ${m.type}:`, error.message);
    else console.log(`マスタ挿入: ${m.type} - ${m.name}`);
  }
}

async function main(): Promise<void> {
  console.log('--- test:seed (#21) 開始 ---\n');

  await resetPublicData();
  await deleteAuthTestUsers();
  const providerId = await seedTestAccounts();
  if (providerId) await seedMasters(providerId);

  console.log('\n--- 完了 ---');
  console.log('パスワード（共通）:', PASSWORD);
  TEST_ACCOUNTS.forEach((a) => console.log(`  ${a.name}: ${a.email}`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
