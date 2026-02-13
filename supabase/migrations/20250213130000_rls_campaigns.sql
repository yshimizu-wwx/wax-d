-- RLS for public.campaigns: 業者が自分の案件を公開・編集できるようにする。
-- Fixes "permission denied for table campaigns" when publishing a campaign.

-- authenticated に campaigns の select, insert, update を付与（RLS の前に必要）
grant select, insert, update on public.campaigns to authenticated;

alter table public.campaigns enable row level security;

-- 自分の案件 (provider_id = ログインユーザー) または 公開中の案件 または 管理者は全件 を SELECT 可能
create policy "campaigns_select_own_or_open"
  on public.campaigns for select
  to authenticated
  using (
    provider_id = (select id from public.users where email = auth.jwt() ->> 'email' limit 1)
    or (status = 'open' and (is_closed is null or is_closed = false))
    or (select role from public.users where email = auth.jwt() ->> 'email' limit 1) = 'admin'
  );

-- 自分の provider_id で案件を INSERT 可能（案件公開）。管理者は任意の provider_id で INSERT 可能。
create policy "campaigns_insert_own"
  on public.campaigns for insert
  to authenticated
  with check (
    provider_id = (select id from public.users where email = auth.jwt() ->> 'email' limit 1)
    or (select role from public.users where email = auth.jwt() ->> 'email' limit 1) = 'admin'
  );

-- 自分の案件のみ UPDATE 可能（管理者は全件更新可）
create policy "campaigns_update_own"
  on public.campaigns for update
  to authenticated
  using (
    provider_id = (select id from public.users where email = auth.jwt() ->> 'email' limit 1)
    or (select role from public.users where email = auth.jwt() ->> 'email' limit 1) = 'admin'
  )
  with check (
    provider_id = (select id from public.users where email = auth.jwt() ->> 'email' limit 1)
    or (select role from public.users where email = auth.jwt() ->> 'email' limit 1) = 'admin'
  );
