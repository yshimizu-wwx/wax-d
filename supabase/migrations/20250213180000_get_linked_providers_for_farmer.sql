-- 現在ログイン中の農家が紐付いている業者一覧を返す（作業依頼の依頼先選択用）
-- SECURITY DEFINER で users を読むため、農家が他業者の名前を取得できる
create or replace function public.get_linked_providers_for_current_farmer()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_farmer_id uuid;
  v_result jsonb;
begin
  select id into v_farmer_id
  from public.users
  where email = (auth.jwt() ->> 'email')
    and role = 'farmer'
  limit 1;

  if v_farmer_id is null then
    return '[]'::jsonb;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', u.id,
        'name', coalesce(u.name, '業者')
      )
      order by u.name nulls last
    ),
    '[]'::jsonb
  ) into v_result
  from public.farmer_providers fp
  join public.users u on u.id = fp.provider_id
  where fp.farmer_id = v_farmer_id
    and fp.status = 'active';

  return v_result;
end;
$$;

grant execute on function public.get_linked_providers_for_current_farmer() to authenticated;
