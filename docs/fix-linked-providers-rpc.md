# 作業依頼で「紐付き業者が表示されない」場合の対処

## 原因

ブラウザのコンソールに次のようなエラーが出ている場合:

```
Could not find the function public.get_linked_providers_for_current_farmer without parameters in the schema cache
```

接続している Supabase プロジェクトに、RPC `get_linked_providers_for_current_farmer` が存在しません。  
紐づけ（`link_farmer_by_invitation_code`）は別のマイグレーションで作成されているため成功しますが、一覧取得用のこの関数が未適用だと作業依頼画面で依頼先が表示されません。

## 対処手順

1. [Supabase Dashboard](https://supabase.com/dashboard) で該当プロジェクトを開く。
2. 左メニュー **SQL Editor** を開く。
3. 次の SQL を貼り付けて **Run** で実行する。

```sql
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
```

4. 実行後、作業依頼ページを再読み込みするか「最新の状態を確認」を押す。依頼先の業者が表示されるようになります。

## 参照

- マイグレーション元: `supabase/migrations/20250213180000_get_linked_providers_for_farmer.sql`
- 本番などで Supabase CLI を使っている場合は `supabase db push` で一括適用も可能です。
