-- RLS for public.masters: allow authenticated provider/admin to read/insert/update.
-- Fixes "permission denied for table masters" when registering items (e.g. 品目) from provider screen.

-- Grant table-level permissions to authenticated users (required before RLS)
grant select, insert, update on public.masters to authenticated;

alter table public.masters enable row level security;

-- Helper: current user's id from users table (this project links by email, not auth.uid())
-- We use a subquery (select id from public.users where email = auth.jwt() ->> 'email' limit 1) in each policy.

-- SELECT: provider sees own + common (provider_id = self or null); admin sees all
create policy "masters_select"
  on public.masters for select
  to authenticated
  using (
    provider_id = (select id from public.users where email = auth.jwt() ->> 'email' limit 1)
    or provider_id is null
    or (select role from public.users where email = auth.jwt() ->> 'email' limit 1) = 'admin'
  );

-- INSERT: provider can add own or common (provider_id = self or null); admin can add common (null)
create policy "masters_insert"
  on public.masters for insert
  to authenticated
  with check (
    provider_id = (select id from public.users where email = auth.jwt() ->> 'email' limit 1)
    or provider_id is null
  );

-- UPDATE: same as select — only rows the user is allowed to see
create policy "masters_update"
  on public.masters for update
  to authenticated
  using (
    provider_id = (select id from public.users where email = auth.jwt() ->> 'email' limit 1)
    or provider_id is null
    or (select role from public.users where email = auth.jwt() ->> 'email' limit 1) = 'admin'
  )
  with check (
    provider_id = (select id from public.users where email = auth.jwt() ->> 'email' limit 1)
    or provider_id is null
    or (select role from public.users where email = auth.jwt() ->> 'email' limit 1) = 'admin'
  );
