# Issue #14 (technical_debt_issues) 今後の進め方

## 1. 手動キャストの削除（型付きクライアント）

### 現状（2025年2月 選択肢A 実施済み）
- **生成型を採用**: `src/types/database.types.ts` の `Database` をクライアントに適用済み。
- **テーブル名を campaigns に統一**: `.from('projects')` をすべて `.from('campaigns')` に変更済み。
- **型付きクライアント**: `createBrowserClient<Database>()` / `createServerClient<Database>()` で `@/types/database.types` の `Database` を使用。
- **Project 型**: `database.ts` で `Database['public']['Tables']['campaigns']['Row'] & { title?, current_price? }` として re-export。
- サービス層の `as` は campaign / booking / field / work-request で削除済み。masters のみ `created_at` の null 互換のため `as Master[]` を継続使用。

### やること（参考: 選択肢B は未実施）

#### 選択肢 A: 生成型をそのまま使う（推奨）

リモート DB のテーブル名が **campaigns** の場合は、アプリ側を **campaigns** に合わせる。

1. **型は生成ファイルのみ使う**
   - `src/lib/supabase.ts` で:
     ```ts
     import type { Database } from '@/types/database.types';
     export const supabase = createBrowserClient<Database>(...);
     ```
   - `src/lib/supabase/server.ts` も同様に `Database` を `database.types.ts` から import。

2. **テーブル名をコード全体で campaigns に統一**
   - `.from('projects')` → `.from('campaigns')` に一括置換。
   - `src/types/database.ts` の `Project` は、必要なら `Database['public']['Tables']['campaigns']['Row']` のエイリアスに変更可能。

3. **ビルド**
   - `npm run build` で型エラーが解消しているか確認。

#### 選択肢 B: 現在の「projects」のまま型付きクライアントを通す

DB のテーブル名が **projects** のままなら、手書きの `Database` 型で型付きクライアントを通す。

1. **Relationships は済**
   - 各テーブルに `Relationships: []` を入れた状態になっている。

2. **Enums を足す**
   - postgrest の型が `Database['public']['Enums']` を参照している可能性があるため、`database.ts` の `Enums` を空オブジェクトではなく、必要な列挙だけ定義する。
   - 例: `user_role`, `user_status` など、実際に DB で使っている enum を `Enums: { user_role: 'admin' | 'provider' | 'farmer'; user_status: 'pending' | ... }` のように定義。

3. **型付きクライアントを有効化**
   - `src/lib/supabase.ts` で `createBrowserClient<Database>(...)` に戻す。
   - `src/lib/supabase/server.ts` も `createServerClient<Database>(...)` に戻す。

4. **まだ `data` が never になる場合**
   - 該当箇所（例: ログインページの `.select('id, name').single().then(({ data }) => ...)`）で、コールバックの引数にだけ明示型を付ける:
     ```ts
     .then(({ data }: { data: { id: string; name: string | null } | null }) => {
       if (data?.name) setInviteProviderName(data.name);
     })
     ```
   - 型付きクライアントは有効なまま、その箇所だけ型を補う形にする。

5. **キャスト削除**
   - ビルドが通ったら、サービス層の `(data as Project[])` 等を順に削除し、戻り値の型が推論されるか確認。

### 型定義の更新フロー
- DB スキーマを変えたら:
  ```bash
  npm run gen:types
  ```
- リモートの project-id を変えた場合は、`package.json` の `gen:types` スクリプト内の `--project-id` を変更する。

---

## 2. API レイヤー分割
**対応済み**。`src/lib/api.ts` は薄いラッパーで、実処理は `src/services/*` に委譲されている。

---

## 3. Zod / UUID / テスト
別 Issue または別 PR で対応する想定（優先度・マイルストーンは Issue #14 の子タスクに従う）。

---

## 参考: Database 型の要件（Supabase / postgrest-js）

- `Database` は少なくとも:
  - `__InternalSupabase: { PostgrestVersion: string }`
  - `public: { Tables; Views; Functions; Enums }`
- 各テーブルは `GenericTable` に合わせる:
  - `Row`, `Insert`, `Update`: それぞれ `Record<string, unknown>` と互換
  - **`Relationships: GenericRelationship[]`**（空でよい）が必須。これがないと `Schema` が `never` になり、`.single()` の `data` が `never` になる。
