-- 農家が招待コードで業者と紐づける RPC（SECURITY DEFINER で招待コード検索と insert を実行）
create or replace function public.link_farmer_by_invitation_code(p_invitation_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_farmer_id uuid;
  v_farmer_role text;
  v_provider_id uuid;
  v_count bigint;
  v_exists boolean;
begin
  v_email := auth.jwt() ->> 'email';
  if v_email is null then
    return jsonb_build_object('success', false, 'error', 'ログインしてください');
  end if;

  select id, role into v_farmer_id, v_farmer_role
  from public.users
  where email = v_email
  limit 1;

  if v_farmer_id is null then
    return jsonb_build_object('success', false, 'error', 'ユーザーが見つかりません');
  end if;

  if v_farmer_role <> 'farmer' then
    return jsonb_build_object('success', false, 'error', '農家のみ利用できます');
  end if;

  if nullif(trim(p_invitation_code), '') is null then
    return jsonb_build_object('success', false, 'error', '招待コードを入力してください');
  end if;

  select id into v_provider_id
  from public.users
  where invitation_code = trim(p_invitation_code)
    and role = 'provider'
  limit 1;

  if v_provider_id is null then
    return jsonb_build_object('success', false, 'error', '招待コードが正しくありません。業者から受け取ったコードをご確認ください。');
  end if;

  select exists(
    select 1 from public.farmer_providers
    where farmer_id = v_farmer_id and provider_id = v_provider_id and status = 'active'
  ) into v_exists;

  if v_exists then
    return jsonb_build_object('success', true);
  end if;

  select count(*) into v_count
  from public.farmer_providers
  where farmer_id = v_farmer_id and status = 'active';

  if v_count >= 10 then
    return jsonb_build_object('success', false, 'error', '紐付けできる業者は最大10件までです');
  end if;

  insert into public.farmer_providers (farmer_id, provider_id, status, created_at)
  values (v_farmer_id, v_provider_id, 'active', now());

  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.link_farmer_by_invitation_code(text) to authenticated;
