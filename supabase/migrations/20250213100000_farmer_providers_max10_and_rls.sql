-- 1. 農家あたり最大10業者までの制約（farmer_providers）
create or replace function check_farmer_providers_max10()
returns trigger as $$
begin
  if (select count(*) from public.farmer_providers where farmer_id = NEW.farmer_id and status = 'active') >= 10 then
    raise exception '1人の農家が紐付けできる業者は最大10件までです';
  end if;
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_farmer_providers_max10 on public.farmer_providers;
create trigger trg_farmer_providers_max10
  before insert on public.farmer_providers
  for each row execute function check_farmer_providers_max10();

-- 2. farmer_providers の権限と RLS
grant select, insert on public.farmer_providers to authenticated;
alter table public.farmer_providers enable row level security;

-- 業者: 自社の行を SELECT / INSERT（招待時に自社を追加）
create policy "farmer_providers_provider_select"
  on public.farmer_providers for select to authenticated
  using (
    provider_id = (select id from public.users where email = auth.jwt() ->> 'email' limit 1)
  );

create policy "farmer_providers_provider_insert"
  on public.farmer_providers for insert to authenticated
  with check (
    provider_id = (select id from public.users where email = auth.jwt() ->> 'email' limit 1)
  );

-- 農家: 自分の行を SELECT のみ
create policy "farmer_providers_farmer_select"
  on public.farmer_providers for select to authenticated
  using (
    farmer_id = (select id from public.users where email = auth.jwt() ->> 'email' limit 1)
  );

-- 3. projects の農家用 RLS（紐付き業者の案件のみ閲覧）
alter table public.projects enable row level security;
grant select on public.projects to authenticated;

create policy "projects_provider_full"
  on public.projects for all to authenticated
  using (
    provider_id = (select id from public.users where email = auth.jwt() ->> 'email' limit 1)
    or (select role from public.users where email = auth.jwt() ->> 'email' limit 1) = 'admin'
  )
  with check (
    provider_id = (select id from public.users where email = auth.jwt() ->> 'email' limit 1)
    or (select role from public.users where email = auth.jwt() ->> 'email' limit 1) = 'admin'
  );

create policy "projects_farmer_select"
  on public.projects for select to authenticated
  using (
    (select role from public.users where email = auth.jwt() ->> 'email' limit 1) = 'farmer'
    and provider_id in (
      select fp.provider_id from public.farmer_providers fp
      where fp.farmer_id = (select id from public.users where email = auth.jwt() ->> 'email' limit 1)
        and fp.status = 'active'
    )
  );

-- 4. masters の農家用 SELECT（紐付き業者＋共通のみ）
create policy "masters_farmer_select"
  on public.masters for select to authenticated
  using (
    (select role from public.users where email = auth.jwt() ->> 'email' limit 1) = 'farmer'
    and (
      provider_id is null
      or provider_id in (
        select fp.provider_id from public.farmer_providers fp
        where fp.farmer_id = (select id from public.users where email = auth.jwt() ->> 'email' limit 1)
          and fp.status = 'active'
      )
    )
  );
