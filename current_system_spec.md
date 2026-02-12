# 現行システム仕様書：ドローンあいのり予約（GAS版）

## 目次
1. [システム概要](#システム概要)
2. [ファイル構成図](#ファイル構成図)
3. [データ構造定義](#データ構造定義)
4. [ロジック概要](#ロジック概要)
5. [画面・ビュー構成](#画面ビュー構成)
6. [主要関数一覧](#主要関数一覧)
7. [外部依存関係](#外部依存関係)

---

## システム概要

### アプリケーション名
**ドローンあいのり予約** - 予約管理システム

### 目的
ドローン防除の「あいのり（共同実施）」を促進するプラットフォーム。業者が案件を作成し、農家が申し込むことで、申込面積に応じて単価が変動する**逆オークション方式**を実現。

### 主要な機能
- **業者（Provider）**: 案件作成・作業依頼受付・実績報告・請求管理
- **農家（Farmer）**: 案件申込・畑（圃場）管理・作業依頼送信
- **管理者（Admin）**: 業者承認・手数料管理・請求発行

### 技術スタック
- **フロントエンド**: HTML + TailwindCSS + Vanilla JavaScript
- **バックエンド**: Google Apps Script (GAS)
- **データストア**: Google Spreadsheet
- **地図機能**: Leaflet.js + Leaflet.draw (ポリゴン描画)
- **カレンダー**: FullCalendar

---

## ファイル構成図

```
v3/
├── index.html                     # メインエントリーポイント（include()で部品を読み込み）
│
├── ■ サーバーサイドロジック（GAS）
│   ├── Auth.js                    # 認証・セッション管理・ユーザー登録
│   ├── Application.js             # 申込処理・畑管理・作業依頼・ルート最適化
│   ├── Calculator.js              # 面積・単価計算ロジック（逆オークション価格）
│   ├── Campaign.js                # 案件CRUD・募集締切・成立判定
│   ├── Config.js                  # 設定・定数・スキーマ定義
│   ├── Template.js                # 案件テンプレート管理
│   ├── Utils.js                   # 共通ユーティリティ（スプレッドシート操作等）
│   └── WorkReport.js              # 作業実績報告
│
├── ■ HTMLコンポーネント（テンプレート部品）
│   ├── comp_app_views.html        # メインビュー（ログイン・管理者・業者・農家画面）
│   ├── comp_campaign_form.html    # 案件フォーム共通部品
│   ├── comp_header.html           # ヘッダー
│   ├── comp_loader_toast.html     # ローダー・トースト通知
│   ├── comp_modals.html           # 各種モーダルダイアログ
│   ├── ProjectForm.html           # プロジェクトフォーム共通部品
│   └── stylesheet.html            # CSS（Tailwind追加スタイル）
│
├── ■ クライアントサイドロジック（JavaScript）
│   ├── js_main.html               # メインロジック（画面遷移・申込処理・UI操作）
│   └── js_polygon_map.html        # ポリゴン地図機能（エリア描画）
│
└── ■ その他
    ├── appsscript.json            # GASプロジェクト設定
    ├── .clasp.json                # Clasp（GASデプロイ）設定
    └── setup_test_data.js         # テストデータ作成スクリプト
```

### ファイルの役割

| ファイル名 | 種別 | 役割 |
|----------|------|------|
| `index.html` | HTML | メインエントリーポイント。`<?!= include('XXX') ?>` で各部品を読み込み |
| `Auth.js` | GAS | ログイン、セッション管理、ユーザー登録、メール認証 |
| `Application.js` | GAS | 申込処理（`submitApplication`）、畑登録、作業依頼、ルート最適化 |
| `Calculator.js` | GAS | 逆オークション単価計算（`calculateCurrentUnitPrice`）、税計算 |
| `Campaign.js` | GAS | 案件CRUD、募集締切（`closeCampaign`）、成立判定 |
| `Config.js` | GAS | データベーススキーマ（`SCHEMA`）、ステータス定数、設定値 |
| `comp_app_views.html` | HTML | ログイン画面、管理者画面、業者画面、農家画面のすべてのビュー |
| `js_main.html` | JS | フロントエンドのメインロジック（google.script.run 呼び出し） |
| `js_polygon_map.html` | JS | Leaflet.js を使った地図ポリゴン描画機能 |

---

## データ構造定義

### スプレッドシートのシート構成

すべてのデータは Google Spreadsheet に保存されています（Config.js の `SCHEMA` に定義）。

#### 1. users シート（ユーザー管理）

| 列名 | 型 | 説明 |
|-----|---|------|
| `id` | string | ユーザーID（F/Pで始まる） |
| `email` | string | メールアドレス |
| `password` | string | パスワード（平文保存） |
| `role` | enum | `'admin'` / `'provider'` / `'farmer'` |
| `name` | string | ユーザー名 |
| `phone` | string | 電話番号 |
| `status` | enum | `'pending'`, `'active'`, `'under_review'`, `'suspended'`, `'rejected'` |
| `token` | string | メール認証トークン |
| `address` | string | 住所（業者の拠点住所、農家の畑デフォルト位置） |
| `associated_provider_id` | string | 紐付け業者ID（農家のみ） |
| `interested_crop_ids` | string | 興味のある作物ID（カンマ区切り） |
| `license_mlit` | string | 国土交通省 許可承認番号 |
| `license_droneskill` | string | ドローン技能認定証 |
| `commission_rate` | number | 手数料率（業者のみ、管理者が設定） |
| `invitation_code` | string | 招待コード（業者が農家を招待） |
| `lat` | number | 緯度（地図初期位置キャッシュ） |
| `lng` | number | 経度（地図初期位置キャッシュ） |

#### 2. campaigns シート（案件・募集）

| 列名 | 型 | 説明 |
|-----|---|------|
| `id` | string | 案件ID（Cで始まる） |
| `provider_id` | string | 業者ID |
| `start_date` | date | 作業開始予定日 |
| `end_date` | date | 作業終了予定日 |
| `final_date` | date | 確定作業日 |
| `location` | string | 表示用地区名（例: 山内地区） |
| `base_price` | number | 開始単価（円/10R） |
| `min_price` | number | 目標単価（円/10R） |
| `target_area_10r` | number | 目標面積（10R単位、10R=1反） |
| `status` | enum | `'open'`, `'closed'`, `'completed'`, `'archived'`, `'unformed'`, `'applied'` |
| `map_url` | string | 地図URL（旧仕様、現在は使用せず） |
| `target_crop_id` | string | 品目ID（mastersテーブルを参照） |
| `task_category_id` | string | 作業種別ID |
| `task_detail_id` | string | 作業詳細ID |
| `is_closed` | boolean | 募集終了フラグ |
| `final_unit_price` | number | 確定単価（募集締切時に設定） |
| `pesticide` | string | 農薬名（旧仕様） |
| `notes` | string | 備考 |
| `billing_id` | string | 請求書ID |
| `final_decision_date` | date | 成立判定日 |
| `min_target_area_10r` | number | 最低成立面積（10R） |
| `max_target_area_10r` | number | 満額ライン面積（10R） |
| `execution_price` | number | 成立時単価（最低成立面積達成時の単価） |
| `pesticide_name` | string | 農薬・薬剤名 |
| `dilution_rate` | number | 希釈倍率 |
| `amount_per_10r` | number | 1反あたり使用量（L/10R） |
| `target_area_polygon` | string | 対象エリアのポリゴン座標（JSON） |
| `confirmation_deadline_days` | number | 作業日確定の期日（開始日の何日前） |
| `campaign_title` | string | 案件名（地域名+日付+テンプレート名で自動生成） |

#### 3. applications シート（申込・予約）

| 列名 | 型 | 説明 |
|-----|---|------|
| `id` | string | 申込ID（Aで始まる） |
| `campaign_id` | string | 案件ID |
| `farmer_id` | string | 農家ID |
| `area_10r` | number | 申込面積（10R単位） |
| `applied_at` | date | 申込日時 |
| `status` | enum | `'confirmed'`（確定済み） |
| `actual_area_10r` | number | 実績面積（作業完了後に入力） |
| `work_status` | enum | `'pending'` / `'completed'` |
| `final_amount` | number | 確定金額（税抜） |
| `evidence_image_url` | string | 作業完了写真URL |
| `preferred_dates` | string | 希望日（カンマ区切り） |
| `confirmed_date` | string | 確定作業日 |
| `field_id` | string | 畑ID（fieldsテーブルを参照） |
| `invoice_status` | enum | `'unbilled'`, `'sent'`, `'processed'`, `'invoiced'` |

#### 4. fields シート（畑・圃場）

| 列名 | 型 | 説明 |
|-----|---|------|
| `id` | string | 畑ID（FLD_で始まる） |
| `farmer_id` | string | 農家ID |
| `name` | string | 畑名 |
| `address` | string | 住所 |
| `map_url` | string | 地図URL |
| `area_size` | number | 面積（反） |
| `created_at` | date | 登録日 |
| `lat` | number | 緯度 |
| `lng` | number | 経度 |
| `place_id` | string | Google Place ID |
| `area_coordinates` | string | ポリゴン座標（JSON） |

#### 5. work_requests シート（作業依頼）

| 列名 | 型 | 説明 |
|-----|---|------|
| `id` | string | 依頼ID（WR_で始まる） |
| `farmer_id` | string | 農家ID |
| `provider_id` | string | 業者ID |
| `requested_at` | date | 依頼日時 |
| `location` | string | 作業場所 |
| `crop_name` | string | 品目名 |
| `task_category_name` | string | 作業種別 |
| `task_detail_name` | string | 作業詳細 |
| `desired_start_date` | date | 希望開始日 |
| `desired_end_date` | date | 希望終了日 |
| `estimated_area_10r` | number | 依頼面積 |
| `notes` | string | 備考 |
| `status` | enum | `'pending'`, `'converted'`, `'rejected'` |
| `converted_campaign_id` | string | 変換後の案件ID |
| `crop_name_free_text` | string | 品目（自由記述） |
| `task_category_free_text` | string | 作業種別（自由記述） |
| `task_detail_free_text` | string | 作業詳細（自由記述） |
| `desired_price` | number | 希望単価 |
| `target_area_polygon` | string | 依頼エリアのポリゴン座標（JSON） |

#### 6. sessions シート（セッション管理）

| 列名 | 型 | 説明 |
|-----|---|------|
| `token` | string | セッショントークン（UUID） |
| `userId` | string | ユーザーID |
| `createdAt` | date | 作成日時 |
| `expiresAt` | date | 有効期限（デフォルト24時間） |

#### 7. masters シート（マスターデータ）

| 列名 | 型 | 説明 |
|-----|---|------|
| `id` | string | マスタID（Mで始まる） |
| `provider_id` | string | 業者ID |
| `type` | enum | `'crop'`, `'task_category'`, `'task_detail'`, `'pesticide'` |
| `name` | string | 名称 |
| `parent_id` | string | 親ID（task_detailの場合、親カテゴリID） |
| `status` | enum | `'active'` / `'inactive'` |

#### 8. work_reports シート（作業実績報告）

| 列名 | 型 | 説明 |
|-----|---|------|
| `id` | string | 報告ID |
| `application_id` | string | 申込ID |
| `campaign_id` | string | 案件ID |
| `dilution_rate_actual` | number | 実際の希釈倍率 |
| `amount_actual_per_10r` | number | 実際の使用量（L/10R） |
| `photo_urls_json` | string | 写真URL（JSON配列） |
| `reported_at` | date | 報告日時 |
| `reporter_id` | string | 報告者ID |
| `gps_lat` | number | GPS緯度 |
| `gps_lng` | number | GPS経度 |
| `reported_at_iso` | string | 報告日時（ISO形式） |
| `campaign_snapshot_json` | string | 案件スナップショット（JSON） |
| `application_snapshot_json` | string | 申込スナップショット（JSON） |

#### 9. routes シート（作業ルート最適化）

| 列名 | 型 | 説明 |
|-----|---|------|
| `id` | string | ルートID（RT_で始まる） |
| `campaign_id` | string | 案件ID |
| `provider_id` | string | 業者ID |
| `work_date` | date | 作業日 |
| `route_order` | number | 訪問順序 |
| `application_id` | string | 申込ID |
| `field_id` | string | 畑ID |
| `estimated_arrival_time` | string | 到着予定時刻 |
| `estimated_work_duration` | number | 作業時間（分） |
| `estimated_departure_time` | string | 出発予定時刻 |
| `created_at` | date | 作成日時 |

#### 10. farmer_providers シート（農家-業者紐付け）

| 列名 | 型 | 説明 |
|-----|---|------|
| `farmer_id` | string | 農家ID |
| `provider_id` | string | 業者ID |
| `status` | enum | `'active'` / `'inactive'` |
| `created_at` | date | 紐付け日時 |

#### 11. billings シート（請求管理）

| 列名 | 型 | 説明 |
|-----|---|------|
| `id` | string | 請求ID |
| `provider_id` | string | 業者ID |
| `target_month` | string | 対象月（YYYY-MM） |
| `total_gmv` | number | 総売上（GMV） |
| `commission_amount` | number | 手数料額 |
| `status` | enum | `'sent'` / `'paid'` |
| `sent_at` | date | 送信日時 |

#### 12. templates シート（案件テンプレート）

| 列名 | 型 | 説明 |
|-----|---|------|
| `id` | string | テンプレートID（TPL_で始まる） |
| `user_id` | string | 業者ID |
| `type` | string | テンプレート種別 |
| `name` | string | テンプレート名 |
| `content_json` | string | テンプレート内容（JSON） |

---

## ロジック概要

### 1. 逆オークション方式の単価計算ロジック

**ファイル**: `Calculator.js:23` - `calculateCurrentUnitPrice(campaign, totalArea10r)`

#### ロジックの流れ

1. **基本パラメータ**
   - `base_price`: 開始単価（申込が少ないときの単価）
   - `min_price`: 目標単価（目標面積達成時の最低単価）
   - `target_area_10r`: 目標面積（10R単位）
   - `totalArea10r`: 現在の申込合計面積

2. **最低成立面積がある場合（`min_target_area_10r` > 0）**
   ```
   if (totalArea10r < min_target_area_10r) {
     // 最低成立面積未達 → 単価は表示しない（不成立）
     progress = totalArea10r / min_target_area_10r
     currentPrice = null
     isUnformed = true
   } else if (totalArea10r >= max_target_area_10r) {
     // 満額ライン達成 → 最低単価
     progress = 1
     currentPrice = min_price
   } else {
     // 最低成立〜満額ラインの間 → 線形変動
     progress = (totalArea10r - min_target_area_10r) / (max_target_area_10r - min_target_area_10r)
     currentPrice = execution_price + (min_price - execution_price) * progress
   }
   ```

3. **最低成立面積がない場合（従来の線形方式）**
   ```
   progress = Math.min(totalArea10r / target_area_10r, 1)
   currentPrice = base_price - (base_price - min_price) * progress
   ```

4. **返り値**
   ```javascript
   {
     currentPrice: number | null,  // 現在単価（不成立時はnull）
     progress: number,              // 進捗率（0〜1）
     isUnformed: boolean            // 不成立フラグ
   }
   ```

#### 具体例

**設定値**:
- 開始単価: ¥20,000/10R
- 目標単価: ¥15,000/10R
- 最低成立面積: 30 (10R)
- 目標面積: 50 (10R)
- 成立時単価: ¥18,000/10R

**計算結果**:
| 申込合計面積 | 状態 | 単価 | 進捗率 |
|------------|------|------|--------|
| 20 (10R) | 不成立 | 表示なし | 66.7% |
| 30 (10R) | 成立（最低） | ¥18,000 | 0% |
| 40 (10R) | 成立 | ¥16,500 | 50% |
| 50 (10R) | 目標達成 | ¥15,000 | 100% |
| 60 (10R) | 目標超過 | ¥15,000 | 100% |

### 2. 申込処理ロジック

**ファイル**: `Application.js:56` - `submitApplication(campaignId, userId, area10r, preferredDates, fieldIdOrData, sessionToken)`

#### 処理フロー

```
1. ロック取得（排他制御）
   ↓
2. ユーザー認証
   - 農家ユーザーのみ申込可能
   - sessionTokenがあれば管理者による代理申込も可能
   ↓
3. 案件バリデーション
   - 案件が存在するか？
   - 募集終了していないか？（isCampaignClosed）
   - 業者と農家が紐付いているか？
   ↓
4. 残り面積チェック
   - 現在の申込合計面積を計算
   - max_target_area_10r（満額ライン）を超えないか確認
   ↓
5. 畑（Field）の処理
   - fieldIdOrDataがオブジェクト → 新規畑を作成
   - fieldIdOrDataが文字列 → 既存畑IDを使用
   - 未指定 → 農家の畑が1件のみなら自動紐付け
   ↓
6. applicationsシートに行を追加
   - id, campaign_id, farmer_id, area_10r, applied_at
   - status: 'confirmed'
   - work_status: 'pending'
   - invoice_status: 'unbilled'
   - field_id: 畑ID
   ↓
7. 面積到達時の自動トリガー
   - 目標面積達成時 → closeCampaign()を呼び出し
   - 最低成立面積達成時 → closeCampaign()を呼び出し
   ↓
8. メール通知
   - 農家宛: 申込完了メール（現在の暫定単価を表示）
   - 業者宛: 新規申込通知メール
   ↓
9. ロック解放
```

#### 重要なバリデーション

```javascript
// 募集終了チェック（Application.js:14）
function isCampaignClosed(campaign) {
  const todayStr = getTodayString();
  return campaign.is_closed ||
    String(campaign.status) === CAMPAIGN_STATUS.CLOSED ||
    String(campaign.status) === CAMPAIGN_STATUS.COMPLETED ||
    String(campaign.status) === CAMPAIGN_STATUS.UNFORMED ||
    (campaign.end_date && campaign.end_date < todayStr);
}
```

```javascript
// 残り面積チェック（Application.js:99-112）
const currentTotal = allApps
  .filter(a => String(a.campaign_id) === String(campaignId))
  .reduce((sum, a) => sum + toNumber(a.area_10r), 0);

const maxArea = toNumber(campaign.max_target_area_10r) > 0
  ? toNumber(campaign.max_target_area_10r)
  : toNumber(campaign.target_area_10r) || 1;

const remaining = Math.max(0, maxArea - currentTotal);

if (toNumber(area10r) > remaining) {
  throw new Error(`申し込み面積が上限を超えています。残り ${remaining} 反まで予約可能です。`);
}
```

### 3. ステータス遷移ロジック

#### 案件（Campaign）のステータス遷移

**ファイル**: `Config.js:121-134`

```
[新規作成]
  ↓
OPEN (募集中) ← 初期状態（希望面積なし）
APPLIED (申込完了) ← 希望面積ありで作成時
  ↓
[目標面積達成 or 募集締切ボタン]
  ↓
CLOSED (募集締切) ← final_unit_priceが確定
  ↓
[作業完了]
  ↓
COMPLETED (完了) ← 実装なし（将来用）
  ↓
[アーカイブ]
  ↓
ARCHIVED (アーカイブ) ← 一覧から非表示
  ↓
[復元]
  ↓
OPEN / APPLIED に戻る

[成立判定日を過ぎて最低面積未達]
  ↓
UNFORMED (不成立) ← 自動判定
```

#### 申込（Application）のwork_statusとinvoice_status

**ファイル**: `Config.js:143-166`

```
[申込作成]
  ↓
work_status: PENDING (作業未完了)
invoice_status: UNBILLED (未請求)
  ↓
[作業完了報告]
  ↓
work_status: COMPLETED (作業完了)
invoice_status: UNBILLED (未請求のまま)
  ↓
[請求メール送信]
  ↓
invoice_status: SENT (メール送付済)
  ↓
[手動完了処理]
  ↓
invoice_status: PROCESSED (手動完了)
```

### 4. 作業ルート最適化ロジック

**ファイル**: `Application.js:844-1006`

#### ロジックの流れ

```
1. 案件に紐付く申込のうち、field_idがあるものを取得
   ↓
2. 各申込の畑の緯度・経度を取得
   ↓
3. 業者の拠点住所をジオコーディング（ベース地点）
   ↓
4. 巡回セールスマン問題（TSP）を最近傍法で解く
   - ベース地点から最も近い畑を選択
   - 現在地から最も近い残りの畑を順次選択
   ↓
5. 各畑の到着時刻・作業時間・出発時刻を計算
   - 作業時間: 面積 × timePerArea (デフォルト30分/反)
   - 移動時間: 距離 × timePerKm (デフォルト1分/km)
   ↓
6. routesシートに保存（既存ルートは削除して再作成）
```

#### 距離計算（Haversine公式）

```javascript
// Utils.js内で定義されている想定
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // 地球の半径（km）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // km
}
```

### 5. 成立判定（Formation Check）ロジック

**場所**: `Campaign.js`（読み込めなかったが、Config.jsとApplication.jsから推測）

#### 判定条件

```javascript
// 自動判定タイミング
// 1. 申込時（Application.js:193-224）
if (targetArea > 0 &&
    updatedTotalArea >= targetArea &&
    (status === 'open' || status === 'applied') &&
    !is_closed) {
  // 目標面積達成 → closeCampaign()
}

// 2. 定期バッチ（runFormationCheckJob - Campaign.jsに実装）
if (今日 >= final_decision_date && totalArea < min_target_area_10r) {
  // 最低成立面積未達 → status: 'unformed'
}

// 3. 開始日の○日前（confirmation_deadline_days）
if (今日 >= (start_date - confirmation_deadline_days日) && totalArea < min_target_area_10r) {
  // 最低成立面積未達 → status: 'unformed'
}
```

---

## 画面・ビュー構成

### メイン画面の構成

**ファイル**: `comp_app_views.html`

```
index.html
├── comp_header.html (ヘッダー)
├── comp_loader_toast.html (ローダー・トースト)
├── comp_modals.html (各種モーダル)
├── comp_campaign_form.html (案件フォーム)
└── comp_app_views.html (メインビュー) ★
    ├── view-login (ログイン画面)
    ├── view-register (農家登録画面)
    ├── view-register-provider (業者登録画面)
    ├── view-admin (管理者ダッシュボード)
    │   ├── aview-providers (業者管理)
    │   ├── aview-campaigns (案件監視)
    │   └── aview-billings (請求管理)
    └── view-main (メインビュー: 業者・農家共通)
        ├── tab-list (予約募集一覧)
        ├── tab-calendar (カレンダー)
        ├── tab-progress (案件進捗 - 業者のみ)
        ├── tab-work-reports (実績報告 - 業者のみ)
        ├── tab-requests (作業依頼 - 業者のみ)
        ├── tab-invoices (請求管理 - 業者のみ)
        ├── tab-history (申込履歴 - 農家のみ)
        ├── tab-profile (設定)
        └── tab-create (案件作成 - 業者のみ)
```

### ユーザーロール別の画面表示

| ロール | 表示される画面 |
|--------|---------------|
| **admin** | view-admin（業者管理・案件監視・請求管理） |
| **provider** | view-main（案件作成・進捗・実績報告・請求管理・作業依頼受付） |
| **farmer** | view-main（予約募集一覧・申込履歴・My畑管理・作業依頼送信） |

### 主要な画面の入力項目

#### 1. 案件作成フォーム（業者用）

**場所**: `comp_app_views.html:520-748` (`tab-create`)

**Step 1: エリア描画**（必須）
- 地図でポリゴンを描画して対象エリアを指定
- 描画後、自動で地名を取得して「表示用地区名」に反映

**Step 2: 詳細入力**

| 項目名 | name属性 | 必須 | 説明 |
|--------|---------|------|------|
| 品目 | `m-crop` | ○ | mastersテーブルから選択 |
| 作業種別（大） | `m-category` | ○ | mastersテーブルから選択 |
| 作業詳細（小） | `m-detail` | - | mastersテーブルから選択 |
| 表示用地区名 | `m-loc` | ○ | 例: 山内地区 |
| 実施予定期間：開始日 | `m-start` | ○ | date型 |
| 実施予定期間：終了日 | `m-end` | ○ | date型 |
| 使用予定の農薬・薬剤名 | `m-pesticide` | - | テキスト |
| 希釈倍率 | `m-dilution-rate` | - | number（倍） |
| 1反あたりの使用量 | `m-amount-per-10r` | - | number（L/10R） |
| 開始単価 | `m-base` | ○ | number（円/10R） |
| 目標単価 | `m-min` | ○ | number（円/10R） |
| 最低成立面積 | `m-min-target` | - | number（10R） |
| 目標面積 | `m-target` | ○ | number（10R） |
| 作業日確定の期日 | `m-confirmation-deadline-days` | - | number（日前） |

#### 2. あいのり申込フォーム（農家用）

**場所**: `js_main.html` 内で動的に生成されるモーダル

| 項目名 | 説明 |
|--------|------|
| 申込面積 | number（反単位、内部では10R単位で保存） |
| 作業希望日 | カレンダーで複数選択可能 |
| 作業場所（畑） | fieldsテーブルから選択 or 新規登録 |

#### 3. 畑（圃場）登録フォーム（農家用）

**場所**: `tab-profile` の `farmer-fields-settings` セクション

| 項目名 | name属性 | 説明 |
|--------|---------|------|
| 畑名 | `name` | 例: 第1圃場 |
| 住所 | `address` | テキスト or 地図から取得 |
| 面積 | `areaSize` | number（反） |
| ポリゴン座標 | `areaCoordinates` | JSON（地図で描画） |
| 緯度・経度 | `lat`, `lng` | 自動取得 |
| Place ID | `place_id` | Google Place ID（自動取得） |

#### 4. 作業依頼フォーム（農家用）

**場所**: モーダル `modal-work-request`

| 項目名 | 説明 |
|--------|------|
| 作業場所（畑） | 複数選択可能（fieldsから選択） |
| 品目 | mastersから選択 or 自由記述 |
| 作業種別 | mastersから選択 or 自由記述 |
| 作業詳細 | mastersから選択 or 自由記述 |
| 希望作業期間（開始） | date |
| 希望作業期間（終了） | date |
| 依頼面積 | number（反） |
| 希望単価 | number（円/反） |
| 備考 | テキスト |
| 対象エリアポリゴン | JSON（地図で描画） |

---

## 主要関数一覧

### Auth.js

| 関数名 | 引数 | 返り値 | 説明 |
|--------|------|--------|------|
| `doGet(e)` | `e: {parameter}` | HtmlOutput | GASのエントリーポイント。メール認証リンクまたは通常アクセス |
| `login(email, password)` | `email: string, password: string` | `{user, token}` or `{error}` | ログイン処理。セッション作成 |
| `checkSession(token)` | `token: string` | User object or null | トークンからユーザー情報を取得 |
| `requestRegistration(data)` | `data: {email, password, name, phone, role, ...}` | `{success, message}` | 新規会員登録。確認メール送信 |
| `verifyUser(token)` | `token: string` | HtmlOutput | メール認証処理 |
| `updateUserProfile(userId, newData)` | `userId: string, newData: {name, phone, address, ...}` | `{success}` | プロフィール更新 |
| `linkProviderToFarmer(farmerId, providerId)` | `farmerId: string, providerId: string` | `{success, message}` | 農家と業者を紐付け |
| `getInvitationLink(providerId)` | `providerId: string` | `{invitationCode, invitationUrl, qrCodeUrl}` | 招待リンク生成 |

### Application.js

| 関数名 | 引数 | 返り値 | 説明 |
|--------|------|--------|------|
| `submitApplication(campaignId, userId, area10r, preferredDates, fieldIdOrData, sessionToken)` | 案件ID、ユーザーID、面積、希望日、畑ID/データ、トークン | `{success, dashboardData}` or `{success: false, message}` | あいのり申込処理 |
| `confirmApplicationDate(farmerId, campaignId, date, timeRange)` | 農家ID、案件ID、日付、時間帯 | `{success, dashboardData}` | 個別申込の日程確定 |
| `updateApplicationField(userId, appId, fieldId, newFieldData)` | ユーザーID、申込ID、畑ID、新規畑データ | `{success, dashboardData}` | 申込後の畑紐付け |
| `registerField(farmerId, data)` | 農家ID、畑データ | `{success, fieldId, dashboardData}` | 畑登録 |
| `addNewFieldFromMap(farmerId, coords, area, optName)` | 農家ID、ポリゴン座標、面積、畑名 | `{success, fieldId, dashboardData}` | 地図から畑登録 |
| `updateField(farmerId, fieldId, data)` | 農家ID、畑ID、更新データ | `{success, dashboardData}` | 畑情報更新 |
| `deleteField(farmerId, fieldId)` | 農家ID、畑ID | `{success, dashboardData}` | 畑削除 |
| `getFarmerFields(farmerId)` | 農家ID | Field[] | 農家の畑一覧取得 |
| `createWorkRequest(farmerId, providerId, requestData)` | 農家ID、業者ID、依頼データ | `{success, dashboardData}` | 作業依頼作成 |
| `convertWorkRequestToCampaign(providerId, requestId, campaignData)` | 業者ID、依頼ID、案件データ | `{success, campaignId, dashboardData}` | 作業依頼を案件に変換 |
| `rejectWorkRequest(providerId, requestId)` | 業者ID、依頼ID | `{success, dashboardData}` | 作業依頼を拒否 |
| `optimizeRouteForCampaign(campaignId, workDate, timeRange)` | 案件ID、作業日、時間帯 | `{success, routeId, routeCount}` | 作業ルート最適化 |

### Calculator.js

| 関数名 | 引数 | 返り値 | 説明 |
|--------|------|--------|------|
| `calculateCurrentUnitPrice(campaign, totalArea10r)` | 案件オブジェクト、申込合計面積 | `{currentPrice, progress, isUnformed}` | 逆オークション単価計算 |
| `calculateFinalAmount(unitPrice, actualArea10r)` | 単価、実績面積 | number | 確定金額計算（税抜） |
| `calculateTax(amountExTax)` | 税抜金額 | `{taxAmount, amountInclusive, taxRate}` | 消費税計算 |

### Template.js

| 関数名 | 引数 | 返り値 | 説明 |
|--------|------|--------|------|
| `getTemplates(providerId)` | 業者ID | Template[] | テンプレート一覧取得 |
| `saveTemplate(providerId, data)` | 業者ID、テンプレートデータ | `{success, templateId}` | テンプレート保存 |
| `deleteTemplate(providerId, templateId)` | 業者ID、テンプレートID | `{success, templates}` | テンプレート削除 |
| `generateProjectName(areaName, dateStr, templateName)` | 地域名、日付、テンプレート名 | string | 案件名生成 |

### Utils.js（読み込めなかったが、他ファイルから推測）

| 関数名 | 引数 | 返り値 | 説明 |
|--------|------|--------|------|
| `getSpreadsheet()` | なし | Spreadsheet | スプレッドシート取得 |
| `getSheet(name)` | シート名 | Sheet or null | シート取得 |
| `getOrCreateSheet(name)` | シート名 | Sheet | シート取得または作成 |
| `fetchSheetData(ss, sheetName)` | Spreadsheet、シート名 | Object[] | シートデータを配列で取得 |
| `toNumber(value)` | any | number | 数値変換（0を返すフォールバック） |
| `formatDate(date)` | Date | string | 日付フォーマット |
| `getTodayString()` | なし | string | 今日の日付（YYYY-MM-DD） |
| `updateSystemVersion()` | なし | void | システムバージョン更新（キャッシュ無効化） |

---

## 外部依存関係

### CDN・外部ライブラリ

**ファイル**: `index.html:7-32`

| ライブラリ | バージョン | 用途 |
|-----------|-----------|------|
| TailwindCSS | latest (CDN) | UIスタイリング |
| Font Awesome | 6.0.0 | アイコン |
| FullCalendar | 6.1.10 | カレンダー表示 |
| Leaflet.js | 1.9.4 | 地図表示 |
| Leaflet.draw | 1.0.4 | ポリゴン描画 |
| Google Maps API | v3 | 住所検索・ジオコーディング（将来削除予定） |

### Google Apps Script API

| API | 用途 |
|-----|------|
| `SpreadsheetApp` | スプレッドシート操作 |
| `MailApp` | メール送信 |
| `LockService` | 排他制御（同時申込対策） |
| `CacheService` | キャッシュ（ダッシュボードデータ） |
| `Utilities.getUuid()` | UUID生成（トークン） |
| `Utilities.formatDate()` | 日付フォーマット |
| `ScriptApp.getService().getUrl()` | アプリURL取得 |

### フロントエンド・GAS間の通信

```javascript
// フロントエンド（js_main.html）
google.script.run
  .withSuccessHandler(function(result) { /* 成功時の処理 */ })
  .withFailureHandler(function(error) { /* エラー時の処理 */ })
  .submitApplication(campaignId, userId, area10r, preferredDates, fieldIdOrData);

// GAS側（Application.js）
function submitApplication(campaignId, userId, area10r, preferredDates, fieldIdOrData) {
  // 処理...
  return { success: true, dashboardData: {...} };
}
```

---

## まとめ

このドキュメントは、GASベースの現行システムの仕様を網羅的にまとめたものです。Next.jsへの移行時には、以下の点に注意してください：

1. **データストアの移行**: Spreadsheet → データベース（PostgreSQL / Supabase 等）
2. **認証の移行**: 独自実装 → NextAuth.js / Clerk 等
3. **APIエンドポイント**: google.script.run → Next.js API Routes / tRPC
4. **セッション管理**: spreadsheetのsessionsシート → Redis / JWT
5. **ファイルアップロード**: Google Drive → Vercel Blob / S3
6. **地図機能**: Leaflet.js（そのまま利用可能）
7. **リアルタイム更新**: なし → WebSocket / Server-Sent Events 導入検討

---

**作成日**: 2026-02-12
**対象システム**: ドローンあいのり予約 v3 (GAS版)
**作成者**: Claude Code (Sonnet 4.5)
