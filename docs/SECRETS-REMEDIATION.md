# シークレット漏洩の対処（GitGuardian 検知）

## 実施済み

- **`.env.local` を Git の追跡対象から除外**  
  リポジトリには今後コミットされません。ローカルの `.env.local` ファイルはそのまま残しています。
- **`.gitignore` を修正**  
  `.env` / `.env.local` / `.env.*.local` を無視するようにしました。
- **`.env.example` を追加**  
  必要な環境変数名だけを記載したテンプレートです。実際の値は入れていません。

## あなたが行う必要があること

### 1. Supabase で Service Role キーをローテーションする（必須）

漏洩したキーは **Git の履歴に残っている** ため、そのままでは無効化できません。Supabase ダッシュボードで新しいキーに差し替えてください。

1. [Supabase Dashboard](https://supabase.com/dashboard) でプロジェクトを開く
2. **Project Settings** → **API** を開く
3. **Project API keys** の **service_role** の「Reveal」で表示し、**Regenerate**（または「Rotate」）を実行
4. 表示された **新しい** Service Role key（JWT）をコピー

### 2. Google API キーを無効化し、必要なら再発行する（必須・GitGuardian で検知された場合）

同じ `.env.local` に **Google Maps API キー**（`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`）も含まれていたため、こちらも漏洩しています。

1. [Google Cloud Console](https://console.cloud.google.com/) で該当プロジェクトを開く
2. **API とサービス** → **認証情報** を開く
3. 漏洩した API キーを特定し、**削除**するか **キーを制限** してから **再生成** する  
   - 再生成する場合: キーを選択 → **キーを再生成** で新しいキーを発行
   - 制限をかける場合: **アプリケーションの制限** で HTTP リファラー（本番・開発の URL）のみ許可すると安全です
4. 新しいキーを `.env.local` の `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` に設定する（再生成した場合）

### 3. ローカルの `.env.local` を更新する

- `NEXT_SUPABASE_SERVICE_ROLE_KEY` を、Supabase で取得した**新しい**キーに書き換える
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` を、上記で再発行したキーに書き換える（再発行した場合）

### 4. この変更をコミットしてプッシュする

```bash
git add .gitignore .env.example docs/SECRETS-REMEDIATION.md
git status
# .env.local が "deleted" としてステージされていることを確認（ファイル削除ではなく追跡解除）
git commit -m "security: .env.local を追跡解除しシークレット漏洩を対処"
git push
```

### 5. （任意）Git 履歴からシークレットを削除する

漏洩したキーはすでにローテーションするので必須ではありませんが、履歴からも消したい場合は以下を検討してください。

- GitHub の **Secret scanning** の警告は、キーをローテーションしてから「Resolve」すると解消されます。
- 履歴改変（`git filter-repo` や BFG Repo-Cleaner）は、フォースプッシュが必要になり共同開発者に影響するため、必要に応じて実施してください。

## 今後の注意

- **`.env.local` や `.env` には絶対に本物のキーをコミットしない**
- 新しい環境変数を追加するときは、値の代わりに `your-xxx` のようなプレースホルダーを `.env.example` に追記する
