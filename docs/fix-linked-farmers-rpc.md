# 業者画面で「紐付き農家一覧」に農家が出てこない場合の対処

## 原因

- 紐付き農家一覧は業者が「自分に紐付いている農家」を表示する画面です。
- `users` テーブルは RLS で「自分の行だけ読める」ため、業者が農家の名前・メールを直接 SELECT できません。
- そのため、**RPC `get_linked_farmers_for_current_provider`**（SECURITY DEFINER）で一覧を取得する必要があります。
- 接続している Supabase プロジェクトにこの関数が存在しないと、一覧が空のままになります。

ブラウザのコンソールに次のようなエラーが出ている場合:

```
Could not find the function public.get_linked_farmers_for_current_provider without parameters in the schema cache
```

## 対処手順

1. [Supabase Dashboard](https://supabase.com/dashboard) で該当プロジェクトを開く。
2. 左メニュー **SQL Editor** を開く。
3. 次の SQL を貼り付けて **Run** で実行する。

```sql
-- 現在ログイン中の業者に紐付いている農家一覧を返す（紐付き農家一覧画面用）
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
```

4. 実行後、紐付き農家一覧ページ（設定 → 紐付き農家 または ユーザー管理）を再読み込みする。

## 参照

- マイグレーション: `supabase/migrations/20250214000000_get_linked_farmers_for_provider.sql`
- 本番などで Supabase CLI を使っている場合は `supabase db push` で一括適用も可能です。
