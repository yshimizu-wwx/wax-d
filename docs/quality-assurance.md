# 品質保証フロー（v0.2 / v0.3）

コードベース全体の健全性を保つためのコマンドと手順です。機能開発の流れは [feature-development-flow.md](./feature-development-flow.md) を参照。

## CI で回すコマンド

| コマンド | 説明 |
|----------|------|
| `npm run type-check` | 型チェック（`tsc --noEmit`）。型整合性の確認。 |
| `npm run lint` | ESLint（Next.js core-web-vitals）。スタイル・バグの検出。 |
| `npm run check` | 上記の両方を順に実行。CI では `npm run check` を推奨。 |

**受入基準**: `npm run lint` および `npm run type-check` がエラーなしで通過すること（警告は許容）。

## RLS 検証

- 手順とチェックリスト: [docs/rls-verification.md](./rls-verification.md)
- テスト: `npm test -- src/lib/__tests__/rls-verification.test.ts`  
  - 環境変数（`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`）が未設定の場合はスキップされる。

## 非同期・エラーハンドリングの Lint（追加検討）

- `@typescript-eslint/no-floating-promises` などで未処理の Promise を検出できる。  
- 導入する場合は `@typescript-eslint/eslint-plugin` を追加し、`.eslintrc.json` の `rules` で有効化する。
