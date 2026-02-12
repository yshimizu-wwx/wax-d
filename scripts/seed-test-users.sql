-- テスト用アカウントを public.users に手動登録する SQL
-- Supabase Dashboard > SQL Editor で実行してください。
-- public.users.id は auth.users(id) を参照しているため、Auth に既に存在するユーザーの id を使います。
-- 先に Authentication > Users で該当メールのユーザーを作成し、パスワードを 11111111 に設定してください。

INSERT INTO public.users (id, email, role, name, phone, status, associated_provider_id, invitation_code)
SELECT id, email, 'farmer'::user_role,  'テスト農家',   '', 'active'::user_status, NULL, NULL FROM auth.users WHERE email = 'shimizu.g.eggs@gmail.com'
UNION ALL
SELECT id, email, 'provider'::user_role, 'テスト業者',   '', 'active'::user_status, NULL, NULL FROM auth.users WHERE email = 'yusuke.shimizu.work.0509@gmail.com'
UNION ALL
SELECT id, email, 'admin'::user_role,  'テスト管理者', '', 'active'::user_status, NULL, NULL FROM auth.users WHERE email = 'yshimizu@wayfinderworx.com'
ON CONFLICT (email)
DO UPDATE SET
  role   = EXCLUDED.role,
  name   = EXCLUDED.name,
  status = EXCLUDED.status;
