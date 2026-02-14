-- 既に Auth に登録されている 3 ユーザーを public.users に 1 回だけ投入する SQL
-- Supabase Dashboard > SQL Editor で実行するか、psql で実行してください。
--
-- ※ Auth の User UID は Dashboard > Authentication > Users で確認し、
--    違う場合は以下の id を差し替えてください。

INSERT INTO public.users (id, email, role, name, phone, status, associated_provider_id, invitation_code)
VALUES
  (
    '7dfe1e4b-3ad8-43fc-8f40-e9abdd30ad80',
    'shimizu.g.eggs@gmail.com',
    'farmer',
    'テスト農家',
    '',
    'active',
    NULL,
    NULL
  ),
  (
    'f8d9df81-aa16-49f8-8417-341c963ca9d6',
    'yshimizu@wayfinderworx.com',
    'admin',
    'テスト管理者',
    '',
    'active',
    NULL,
    NULL
  ),
  (
    '494ea1c2-34f6-40c6-88b1-9140b05be24a',
    'yusuke.shimizu.work.0509@gmail.com',
    'provider',
    'テスト業者',
    '',
    'active',
    NULL,
    NULL
  )
ON CONFLICT (email)
DO UPDATE SET
  id = EXCLUDED.id,
  role = EXCLUDED.role,
  name = EXCLUDED.name,
  status = EXCLUDED.status;
