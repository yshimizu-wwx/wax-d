# ドローンあいのり予約システム v3 (Next.js版)

GAS版からNext.js + Supabaseへの完全移植プロジェクト

## 📋 プロジェクト概要

ドローン防除の「あいのり（共同実施）」を促進するプラットフォーム。業者が案件を作成し、農家が申し込むことで、申込面積に応じて単価が変動する**逆オークション方式**を実現。

### 主要な機能
- **業者（Provider）**: 案件作成・作業依頼受付・実績報告・請求管理
- **農家（Farmer）**: 案件申込・畑（圃場）管理・作業依頼送信
- **管理者（Admin）**: 業者承認・手数料管理・請求発行

## 🛠️ 技術スタック

### フロントエンド
- Next.js 14+ (App Router)
- TypeScript
- TailwindCSS
- React Leaflet (地図表示)
- Turf.js (面積計算)

### バックエンド
- Supabase (PostgreSQL + PostGIS + Auth + Storage)
- Prisma (ORM)

### インフラ
- Vercel (ホスティング)
- Supabase Cloud (データベース)

## 📁 ディレクトリ構造

```
v3/
├── src/
│   ├── lib/
│   │   ├── calculator/
│   │   │   ├── types.ts              # 型定義
│   │   │   ├── priceCalculator.ts    # 逆オークション計算ロジック ✅
│   │   │   └── priceCalculator.test.ts # テスト (33件成功) ✅
│   │   ├── geo/
│   │   │   ├── areaCalculator.ts     # 面積計算ロジック ✅
│   │   │   └── areaCalculator.test.ts # テスト (19件成功) ✅
│   │   ├── application/
│   │   ├── db/
│   │   └── utils/
│   ├── components/
│   │   ├── campaign/
│   │   ├── map/
│   │   ├── ui/
│   │   └── layout/
│   └── types/
├── supabase/
│   ├── functions/
│   │   ├── create_application_with_lock.sql # 申込作成（排他制御付き） ✅
│   │   └── close_campaign.sql               # 募集締切関数 ✅
│   ├── migrations/
│   └── seed.sql
├── tests/
│   ├── unit/
│   └── integration/
├── schema.sql                  # データベーススキーマ定義 ✅
├── implementation_plan.md      # 実装計画書 ✅
├── current_system_spec.md      # 現行システム仕様書 ✅
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## 🚀 セットアップ

### 前提条件
- Node.js 18.0.0以上
- npm 9.0.0以上
- Supabaseアカウント

### インストール

```bash
# 依存パッケージのインストール
npm install

# テストの実行
npm test

# カバレッジ付きテスト
npm run test:coverage
```

### Supabaseのセットアップ

1. Supabaseダッシュボードで新しいプロジェクトを作成
2. SQL Editorで `schema.sql` を実行してデータベースを構築
3. `supabase/functions/*.sql` のストアドプロシージャを実行
4. `.env.local` ファイルを作成して環境変数を設定

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 🧪 テスト

### 実行コマンド

```bash
# 全テストを実行
npm test

# ウォッチモード
npm run test:watch

# UIモード
npm run test:ui

# カバレッジレポート
npm run test:coverage
```

### テスト結果

✅ **逆オークション計算ロジック**: 33件すべて成功
- パターンA: 最低成立面積ありの計算
- パターンB: 従来の線形方式
- エッジケース対応

✅ **地図・面積計算ロジック**: 19件成功
- ポリゴン面積計算（Turf.js使用）
- GeoJSON ↔ WKT変換
- ポリゴンバリデーション

## 📚 主要なロジック

### 1. 逆オークション計算ロジック

**ファイル**: `src/lib/calculator/priceCalculator.ts`

申込面積に応じて単価が変動する逆オークション方式を実装。

#### パターンA: 最低成立面積がある場合

```typescript
import { calculateCurrentUnitPrice } from '@/lib/calculator/priceCalculator';

const result = calculateCurrentUnitPrice(
  {
    base_price: 20000,              // 開始単価（円/10R）
    min_price: 15000,               // 目標単価（円/10R）
    target_area_10r: 50,            // 目標面積（10R）
    min_target_area_10r: 30,        // 最低成立面積（10R）
    max_target_area_10r: 50,        // 満額ライン面積（10R）
    execution_price: 18000,         // 成立時単価（円/10R）
  },
  40  // 現在の申込合計面積（10R）
);

// => { currentPrice: 16500, progress: 0.5, isUnformed: false, ... }
```

#### 計算結果

| 申込合計 | 状態 | 単価 | 進捗率 |
|---------|------|------|--------|
| 20反 | ❌ 不成立 | `null` | 66.7% |
| 30反 | ✅ 成立 | ¥18,000 | 0% |
| 40反 | ✅ 成立 | ¥16,500 | 50% |
| 50反 | ✅ 目標達成 | ¥15,000 | 100% |

### 2. 面積計算ロジック

**ファイル**: `src/lib/geo/areaCalculator.ts`

Turf.jsを使用してポリゴンの面積を「反（10R）」単位で計算。

```typescript
import { calculatePolygonArea10r } from '@/lib/geo/areaCalculator';

const polygon = {
  type: 'Polygon',
  coordinates: [[
    [139.6917, 35.6895],  // [経度, 緯度]
    [139.7017, 35.6895],
    [139.7017, 35.6995],
    [139.6917, 35.6995],
    [139.6917, 35.6895],  // 始点と終点を一致
  ]]
};

const area = calculatePolygonArea10r(polygon);
// => 約1012.53（反）
```

### 3. 申込処理（排他制御付き）

**ファイル**: `supabase/functions/create_application_with_lock.sql`

PostgreSQLの行ロック（`SELECT ... FOR UPDATE`）で排他制御を実現。

```sql
SELECT create_application_with_lock(
  p_campaign_id := '...',
  p_farmer_id := '...',
  p_area_10r := 10.5,
  p_field_id := '...',
  p_preferred_dates := ARRAY['2026-03-01', '2026-03-02']
);
```

#### 処理フロー

1. 案件を行ロック（`FOR UPDATE`）
2. バリデーション（募集終了・残り面積チェック）
3. 申込を作成
4. 目標面積達成時に自動で募集締切

## 📝 実装状況

### ✅ 完了
- [x] データベーススキーマ定義（`schema.sql`）
- [x] 実装計画書（`implementation_plan.md`）
- [x] 逆オークション計算ロジック + テスト
- [x] 地図・面積計算ロジック + テスト
- [x] 申込処理のストアドプロシージャ
- [x] 募集締切関数

### 🚧 進行中
- [ ] Next.jsプロジェクトのセットアップ
- [ ] Supabase認証の統合
- [ ] 基本的なレイアウト・ルーティング
- [ ] API Routes実装

### 📋 未着手
- [ ] UI実装（案件一覧・詳細画面）
- [ ] 申込フォーム
- [ ] 案件作成フォーム（業者用）
- [ ] 畑管理画面（農家用）
- [ ] 統合テスト
- [ ] デプロイ設定

## 🗺️ ロードマップ

### フェーズ1: 基盤構築（Week 1-2） ✅
- [x] データベーススキーマ作成
- [ ] Supabase認証の設定
- [ ] Next.jsプロジェクトセットアップ
- [ ] 基本的なレイアウト・ルーティング

### フェーズ2: コアロジック実装（Week 3-4） ✅
- [x] 逆オークション計算ロジック実装 + テスト
- [x] 地図・面積計算機能実装 + テスト
- [x] 申込処理（排他制御付き）実装 + テスト

### フェーズ3: UI実装（Week 5-6）
- [ ] 案件一覧・詳細画面
- [ ] 申込フォーム
- [ ] 案件作成フォーム（業者用）
- [ ] 畑管理画面（農家用）

### フェーズ4: テスト・デバッグ（Week 7）
- [ ] 統合テスト
- [ ] ロードテスト（同時申込の競合チェック）
- [ ] ブラウザ互換性テスト

### フェーズ5: デプロイ・移行（Week 8）
- [ ] Vercelへのデプロイ
- [ ] GASからのデータ移行スクリプト
- [ ] 本番環境リリース

## 📖 ドキュメント

- [実装計画書](./implementation_plan.md) - 詳細な実装計画
- [現行システム仕様書](./current_system_spec.md) - GAS版の仕様
- [データベーススキーマ](./schema.sql) - Supabase用のスキーマ定義

## 🤝 開発ガイドライン

### コーディング規約
- TypeScript strict mode を有効化
- ESLint + Prettier でコードフォーマット
- 関数には JSDoc コメントを記述
- テストカバレッジ 80% 以上を維持

### Git ワークフロー
- `main` ブランチは保護
- フィーチャーごとに `feature/xxx` ブランチを作成
- PR にはテスト結果を含める
- コミットメッセージは慣例に従う（Conventional Commits）

## 📄 ライセンス

Private

## 👥 開発者

- Claude Code (Sonnet 4.5) - 初期実装

---

**作成日**: 2026-02-12
**最終更新**: 2026-02-12
