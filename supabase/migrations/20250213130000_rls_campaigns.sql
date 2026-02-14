-- RLS for public.campaigns: 業者が自分の案件を公開・編集できるようにする。
-- Fixes "permission denied for table campaigns" when publishing a campaign.

-- authenticated に campaigns の select, insert, update を付与（RLS の前に必要）
grant select, insert, update on public.campaigns to authenticated;

alter table public.campaigns enable row level security;

-- 1. SELECT ポリシー
drop policy if exists "campaigns_select_own_or_open" on public.campaigns;
create policy "campaigns_select_own_or_open"
  on public.campaigns for select
  to authenticated
  using (
    provider_id = (select id from public.users where email = auth.jwt() ->> 'email' limit 1)
    or (status = 'open' and (is_closed is null or is_closed = false))
    or (select role from public.users where email = auth.jwt() ->> 'email' limit 1) = 'admin'
  );

-- 2. INSERT ポリシー
drop policy if exists "campaigns_insert_own" on public.campaigns;
create policy "campaigns_insert_own"
  on public.campaigns for insert
  to authenticated
  with check (
    provider_id = (select id from public.users where email = auth.jwt() ->> 'email' limit 1)
    or (select role from public.users where email = auth.jwt() ->> 'email' limit 1) = 'admin'
  );

-- 3. UPDATE ポリシー
drop policy if exists "campaigns_update_own" on public.campaigns;
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