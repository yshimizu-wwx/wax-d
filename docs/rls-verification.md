# Supabase RLS 検証手順（v0.2 Quality Assurance）

権限のないユーザーがデータにアクセスできないことを、ポリシーレビューと（任意で）テストで確認する手順です。

## 1. 静的レビュー（チェックリスト）

マイグレーション適用後、以下の表を埋めて権限漏れがないか確認してください。

| テーブル | RLS 有効 | SELECT ポリシー | INSERT ポリシー | UPDATE ポリシー | DELETE ポリシー | 備考 |
|----------|----------|----------------|----------------|----------------|----------------|------|
| users | ✅ | 自レコードのみ (email) | 自レコードのみ | 自レコードのみ | - | ログイン/登録用 |
| fields | ✅ | farmer_id = 自分 | farmer_id = 自分 | farmer_id = 自分 | farmer_id = 自分 | 農家の畑のみ |
| campaigns | ✅ | 自案件 or open or admin | 自 provider_id or admin | 自案件 or admin | - | 業者・管理者 |
| masters | ✅ | 自 provider または null | 自 provider or admin | 同左 | - | マスタ |
| bookings | ✅ | 関係者のみ | 要確認 | 関係者のみ | - | 案件・農家 |
| work_requests | ✅ | farmer/provider 本人 | - | - | - | 依頼 |
| farmer_providers | ✅ | 本人 or 管理者 | 管理者等 | - | - | 紐付け |
| work_reports | ✅ | 関係者のみ | 業者 | - | - | 報告 |
| routes | ✅ | 関係者のみ | - | - | - | ルート |
| billings | ✅ | provider 本人 | - | - | - | 請求 |
| templates | ✅ | 本人 | 本人 | 本人 | - | テンプレート |

**確認方法**

- `supabase/migrations/*.sql` で各テーブルに `enable row level security` と `create policy` が存在するか確認する。
- ポリシー名は `*_select_*`, `*_insert_*`, `*_update_*`, `*_delete_*` で意図した操作が制限されているか確認する。

## 2. 動作確認（手動）

1. **未ログイン（anon）**  
   Supabase ダッシュボードの SQL Editor で `role` を `anon` にし、`select * from public.users` 等を実行 → 0 件または permission denied であること。

2. **他ユーザーのデータ**  
   農家 A でログインした状態で、農家 B の `fields` が取得できないこと（アプリ上で確認）。

3. **業者・管理者**  
   業者は自分の `campaigns` / `masters` のみ編集可能で、他業者のデータは見えないこと。

## 3. テストコードでの検証（任意）

- `test:seed` で投入したテストアカウントを使い、**anon** クライアントで `users` / `fields` 等を SELECT し、0 件またはエラーになることを Vitest で assert する。
- 必要なら `scripts/` に `rls-check.mjs` を追加し、`SUPABASE_ANON_KEY` で取得した結果が空であることを確認する。

## 4. マイグレーション一覧（RLS 関連）

- `20250212000000_rls_users.sql`
- `20250213000000_rls_masters.sql`
- `20250213100000_farmer_providers_max10_and_rls.sql`
- `20250213120000_rls_fields.sql`
- `20250213130000_rls_campaigns.sql`

新規テーブル追加時は、上記チェックリストに 1 行追加し、対応する RLS マイグレーションを用意してください。

---

## 5. 非同期・Lint の追加検討

- **no-floating-promises**: `@typescript-eslint/no-floating-promises` を有効にすると、未処理の Promise を検出できる。`@typescript-eslint/eslint-plugin` を導入したうえでルール追加を検討する。
- **型チェック**: `npm run type-check`（`tsc --noEmit`）で型整合性を CI に含める。
