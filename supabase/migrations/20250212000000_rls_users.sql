-- RLS for public.users: allow authenticated users to read/insert/update their own row (by email).
-- Fixes "permission denied for table users" on login/signup.

-- ログイン済みユーザー(authenticated)に権限を付与（RLS の前に必要）
grant select, insert, update on public.users to authenticated;

alter table public.users enable row level security;

-- ログイン時: 自分の行を SELECT 可能
create policy "users_select_own"
  on public.users for select
  to authenticated
  using ( (auth.jwt() ->> 'email') = email );

-- 新規登録時: 自分のメールの行を INSERT 可能
create policy "users_insert_own"
  on public.users for insert
  to authenticated
  with check ( (auth.jwt() ->> 'email') = email );

-- メール認証コールバック時: 自分の行の status を UPDATE 可能
create policy "users_update_own"
  on public.users for update
  to authenticated
  using ( (auth.jwt() ->> 'email') = email )
  with check ( (auth.jwt() ->> 'email') = email );
