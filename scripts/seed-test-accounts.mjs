/**
 * テスト用アカウントを Supabase Auth と public.users に作成するスクリプト
 * 実行: npm run seed:test-accounts または node scripts/seed-test-accounts.mjs
 *
 * 必要: .env.local に
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - NEXT_SUPABASE_SERVICE_ROLE_KEY（または SUPABASE_SERVICE_ROLE_KEY）
 *
 * 重要: RLS をバイパスするには「Legacy」の service_role キー（eyJ... で始まる JWT）が必要です。
 * Supabase ダッシュボード > Project Settings > API で
 * 「Legacy anon, service_role API keys」を開き、service_role をコピーして使用してください。
 * 新しい UI の "Secret key" (sb_secret_...) では public.users への書き込みで permission denied になります。
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// .env.local を読み込む
function loadEnvLocal() {
    const paths = [join(rootDir, '.env.local'), join(process.cwd(), '.env.local')];
    for (const path of paths) {
        if (!existsSync(path)) continue;
        const content = readFileSync(path, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
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
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('エラー: .env.local に NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY（または NEXT_SUPABASE_SERVICE_ROLE_KEY）を設定してください。');
    console.error('サービスロールキーは Supabase ダッシュボード > Project Settings > API の "service_role" です。');
    process.exit(1);
}

// 新しい UI の "Secret key" (sb_secret_...) では RLS をバイパスできません。Legacy の JWT (eyJ...) が必要です。
if (SUPABASE_SERVICE_ROLE_KEY.startsWith('sb_secret_')) {
    console.error('エラー: 現在のキーは "Secret key" (sb_secret_...) 形式です。');
    console.error('RLS をバイパスするには、Supabase ダッシュボードの Project Settings > API で');
    console.error('「Legacy anon, service_role API keys」をクリックし、表示される service_role キー（eyJ... で始まる JWT）を');
    console.error('.env.local の NEXT_SUPABASE_SERVICE_ROLE_KEY に設定してください。');
    process.exit(1);
}

const PASSWORD = '11111111';

const TEST_ACCOUNTS = [
    { email: 'shimizu.g.eggs@gmail.com', role: 'farmer', name: 'テスト農家', idPrefix: 'F' },
    { email: 'yusuke.shimizu.work.0509@gmail.com', role: 'provider', name: 'テスト業者', idPrefix: 'P' },
    { email: 'yshimizu@wayfinderworx.com', role: 'admin', name: 'テスト管理者', idPrefix: 'A' },
];

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
    console.log('テストアカウントを作成します...\n');

    for (const account of TEST_ACCOUNTS) {
        const userId = `${account.idPrefix}${Date.now()}`;

        try {
            // 1) Supabase Auth にユーザー作成（メール確認済み）
            const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
                email: account.email,
                password: PASSWORD,
                email_confirm: true,
            });

            if (authError) {
                if (authError.message && authError.message.includes('already been registered')) {
                    console.log(`[${account.name}] ${account.email} は既に Auth に存在します。public.users を更新します。`);
                } else {
                    console.error(`[${account.name}] Auth 作成失敗:`, authError.message);
                    continue;
                }
            } else {
                console.log(`[${account.name}] Auth ユーザー作成: ${account.email}`);
            }

            // 2) public.users に登録（既存なら更新、なければ挿入）
            const { data: existing } = await supabase.from('users').select('id').eq('email', account.email).single();

            if (existing) {
                const { error: updateError } = await supabase
                    .from('users')
                    .update({
                        role: account.role,
                        name: account.name,
                        status: 'active',
                    })
                    .eq('email', account.email);
                if (updateError) {
                    console.error(`[${account.name}] public.users 更新失敗:`, updateError.message);
                } else {
                    console.log(`[${account.name}] public.users 更新: ${account.email}`);
                }
            } else {
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
                }
            }
        } catch (err) {
            console.error(`[${account.name}] エラー:`, err.message);
        }

        console.log('');
    }

    console.log('完了。ログイン情報:');
    console.log('  パスワード（共通）: ' + PASSWORD);
    TEST_ACCOUNTS.forEach((a) => console.log(`  ${a.name}: ${a.email}`));
}

main();
