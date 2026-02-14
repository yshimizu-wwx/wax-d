-- RLS for public.work_requests: 農家は自分の依頼のみ、業者は自分あての依頼のみ参照可能。

grant select, insert, update on public.work_requests to authenticated;

alter table public.work_requests enable row level security;

-- 農家: 自分の依頼のみ INSERT
drop policy if exists "work_requests_farmer_insert" on public.work_requests;
create policy "work_requests_farmer_insert"
  on public.work_requests for insert to authenticated
  with check (
    farmer_id = (select id from public.users where email = auth.jwt() ->> 'email' limit 1)
  );

-- SELECT: 農家は自分の依頼、業者は自分あての依頼を参照可能（同一行が双方に見える）
drop policy if exists "work_requests_select_own_or_provider" on public.work_requests;
create policy "work_requests_select_own_or_provider"
  on public.work_requests for select to authenticated
  using (
    farmer_id = (select id from public.users where email = auth.jwt() ->> 'email' limit 1)
    or provider_id = (select id from public.users where email = auth.jwt() ->> 'email' limit 1)
  );

-- 業者: 自分あての依頼のみ UPDATE（案件化時に converted_campaign_id を更新するため）

drop policy if exists "work_requests_provider_update" on public.work_requests;
create policy "work_requests_provider_update"
  on public.work_requests for update to authenticated
  using (
    provider_id = (select id from public.users where email = auth.jwt() ->> 'email' limit 1)
  )
  with check (
    provider_id = (select id from public.users where email = auth.jwt() ->> 'email' limit 1)
  );
