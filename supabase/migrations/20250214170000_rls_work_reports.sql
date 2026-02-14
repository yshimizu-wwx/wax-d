-- RLS for public.work_reports: 業者が自案件の申込に対して実績報告を保存できるようにする。
-- Fixes "permission denied for table work_reports" when provider submits work report.

grant select, insert on public.work_reports to authenticated;

alter table public.work_reports enable row level security;

-- SELECT: 業者は自案件の報告、農家は自申込の報告、admin は全て
drop policy if exists "work_reports_select_policy" on public.work_reports;
create policy "work_reports_select_policy"
  on public.work_reports for select to authenticated
  using (
    reporter_id = (select id from public.users where email = auth.jwt() ->> 'email' limit 1)
    or exists (
      select 1 from public.campaigns c
      where c.id = work_reports.campaign_id
        and c.provider_id = (select id from public.users where email = auth.jwt() ->> 'email' limit 1)
    )
    or exists (
      select 1 from public.bookings b
      where b.id = work_reports.application_id
        and b.farmer_id = (select id from public.users where email = auth.jwt() ->> 'email' limit 1)
    )
    or (select role from public.users where email = auth.jwt() ->> 'email' limit 1) = 'admin'
  );

-- INSERT: 業者が自案件の申込に対して報告する場合のみ（reporter_id = 自分 かつ 案件の提供者 = 自分）
drop policy if exists "work_reports_insert_policy" on public.work_reports;
create policy "work_reports_insert_policy"
  on public.work_reports for insert to authenticated
  with check (
    reporter_id = (select id from public.users where email = auth.jwt() ->> 'email' limit 1)
    and exists (
      select 1 from public.campaigns c
      where c.id = work_reports.campaign_id
        and c.provider_id = (select id from public.users where email = auth.jwt() ->> 'email' limit 1)
    )
    or (select role from public.users where email = auth.jwt() ->> 'email' limit 1) = 'admin'
  );
