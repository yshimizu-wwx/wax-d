-- RLS for public.fields: 農家が自分の畑のみ SELECT / INSERT / UPDATE / DELETE 可能にする。
-- Fixes "permission denied for table fields" when registering/editing fields on My畑 screen.

-- authenticated に fields の select, insert, update, delete を付与（RLS の前に必要）
grant select, insert, update, delete on public.fields to authenticated;

alter table public.fields enable row level security;

-- 1. SELECT ポリシー
drop policy if exists "fields_select_own" on public.fields;
create policy "fields_select_own"
  on public.fields for select
  to authenticated
  using (
    farmer_id = (select id from public.users where email = auth.jwt() ->> 'email' limit 1)
  );

-- 2. INSERT ポリシー
drop policy if exists "fields_insert_own" on public.fields;
create policy "fields_insert_own"
  on public.fields for insert
  to authenticated
  with check (
    farmer_id = (select id from public.users where email = auth.jwt() ->> 'email' limit 1)
  );

-- 3. UPDATE ポリシー
drop policy if exists "fields_update_own" on public.fields;
create policy "fields_update_own"
  on public.fields for update
  to authenticated
  using (
    farmer_id = (select id from public.users where email = auth.jwt() ->> 'email' limit 1)
  )
  with check (
    farmer_id = (select id from public.users where email = auth.jwt() ->> 'email' limit 1)
  );

-- 4. DELETE ポリシー
drop policy if exists "fields_delete_own" on public.fields;
create policy "fields_delete_own"
  on public.fields for delete
  to authenticated
  using (
    farmer_id = (select id from public.users where email = auth.jwt() ->> 'email' limit 1)
  );