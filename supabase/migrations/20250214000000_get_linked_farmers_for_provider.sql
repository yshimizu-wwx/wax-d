-- 現在ログイン中の業者に紐付いている農家一覧を返す（紐付き農家一覧画面用）
-- SECURITY DEFINER で users を読むため、業者が紐付き農家の名前・メールを取得できる
create or replace function public.get_linked_farmers_for_current_provider()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider_id uuid;
  v_result jsonb;
begin
  select id into v_provider_id
  from public.users
  where email = (auth.jwt() ->> 'email')
    and role = 'provider'
  limit 1;

  if v_provider_id is null then
    return '[]'::jsonb;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'farmer_id', u.id,
        'name', coalesce(u.name, '—'),
        'email', coalesce(u.email, '—'),
        'created_at', fp.created_at
      )
      order by fp.created_at desc nulls last
    ),
    '[]'::jsonb
  ) into v_result
  from public.farmer_providers fp
  join public.users u on u.id = fp.farmer_id
  where fp.provider_id = v_provider_id
    and fp.status = 'active';

  return v_result;
end;
$$;

grant execute on function public.get_linked_farmers_for_current_provider() to authenticated;
