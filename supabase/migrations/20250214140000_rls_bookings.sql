-- RLS for public.bookings: 農家の申し込みを可能にし、農家は自分の申し込み・業者は自案件の申し込みを参照可能に。
-- Fixes "permission denied for table bookings" when farmer submits application.

grant select, insert, update on public.bookings to authenticated;

alter table public.bookings enable row level security;

-- SELECT: 農家は自分の申し込み、業者は自案件への申し込み、admin は全て
drop policy if exists "bookings_select_policy" on public.bookings;
create policy "bookings_select_policy"
  on public.bookings for select to authenticated
  using (
    farmer_id = (select id from public.users where email = auth.jwt() ->> 'email' limit 1)
    or exists (
      select 1 from public.campaigns c
      where c.id = bookings.campaign_id
        and c.provider_id = (select id from public.users where email = auth.jwt() ->> 'email' limit 1)
    )
    or (select role from public.users where email = auth.jwt() ->> 'email' limit 1) = 'admin'
  );

-- INSERT: 農家が自分の farmer_id で申し込む場合のみ許可（未ログイン申し込みは farmer_id なしも許可）
drop policy if exists "bookings_insert_policy" on public.bookings;
create policy "bookings_insert_policy"
  on public.bookings for insert to authenticated
  with check (
    farmer_id is null
    or farmer_id = (select id from public.users where email = auth.jwt() ->> 'email' limit 1)
  );

-- UPDATE: 業者は自案件の申し込みのステータス更新、農家は自分の申し込みのキャンセル依頼など
drop policy if exists "bookings_update_policy" on public.bookings;
create policy "bookings_update_policy"
  on public.bookings for update to authenticated
  using (
    farmer_id = (select id from public.users where email = auth.jwt() ->> 'email' limit 1)
    or exists (
      select 1 from public.campaigns c
      where c.id = bookings.campaign_id
        and c.provider_id = (select id from public.users where email = auth.jwt() ->> 'email' limit 1)
    )
    or (select role from public.users where email = auth.jwt() ->> 'email' limit 1) = 'admin'
  )
  with check (
    farmer_id = (select id from public.users where email = auth.jwt() ->> 'email' limit 1)
    or exists (
      select 1 from public.campaigns c
      where c.id = bookings.campaign_id
        and c.provider_id = (select id from public.users where email = auth.jwt() ->> 'email' limit 1)
    )
    or (select role from public.users where email = auth.jwt() ->> 'email' limit 1) = 'admin'
  );
