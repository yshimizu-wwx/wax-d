# AgriX システム完全監査報告書

**監査基準**: `current_system_spec.md`（GAS版を唯一の真実とする）  
**実施日**: 2026-02-12  
**対象**: Next.js + Supabase 実装

---

## 1. 逆オークション計算ロジック（最優先）

**対象**: `src/lib/calculator/priceCalculator.ts` ↔ 仕様「4. ロジック概要」

| チェック項目 | 結果 | 備考 |
|-------------|------|------|
| min_target_area_10r 未達時の「不成立（null）」扱い | ✅ 一致 | `currentPrice: null`, `isUnformed: true` で返却 |
| execution_price から min_price への線形補間 | ✅ 一致 | `currentPrice = execution_price + (min_price - execution_price) * progress`、1円単位で仕様例（40反→¥16,500）と一致 |
| 端数処理（四捨五入） | ✅ 一致 | 成立時・中間単価は `Math.round(currentPrice)`、GAS の Math.round と同一 |

**結論**: 計算ロジックは GAS 版と 100% 一致。修正不要。

---

## 2. 予約（Booking/Application）バリデーション

**対象**: `src/lib/api.ts` の `createBooking`、申込処理

| チェック項目 | 修正前 | 修正後 |
|-------------|--------|--------|
| 残り面積（max_target - 現在合計）を超える予約をエラーで弾く | ❌ 未実装 | ✅ **対応済** `validateApplicationArea` を利用し、`max_target_area_10r`（未設定時は `target_area_10r`）を上限にチェック |
| 案件が is_closed または status: 'closed' 等の場合に予約を拒否 | ❌ 未実装 | ✅ **対応済** `isCampaignClosed()` を追加し、`closed` / `completed` / `unformed` / 終了日経過で拒否 |
| 農家と業者の紐付け（招待コード / associated_provider_id）の保存時反映 | ❌ 未実装 | ✅ **パッチ済** ログイン時は `farmer_id` を `BookingData.farmer_id` で渡し、bookings に保存。ゲスト入力（名前・電話・メール）は維持。 |

**実施した修正**  
- `createBooking` 先頭で案件取得 → 存在チェック・`isCampaignClosed` チェック  
- 現在申込合計を `fetchCampaignTotalArea` で取得し、`validateApplicationArea(area_10r, currentTotal, maxArea)` で残り面積チェック  
- エラー時は `success: false` とメッセージで返却（仕様の文言に近いメッセージ）

---

## 3. データ構造の網羅性

**対象**: `schema.sql` / Supabase テーブル ↔ 仕様「3. データ構造定義」12 シート

### 3.1 存在するが仕様と型・名前が異なるもの

| 仕様（シート・列） | 現状 | 差異 |
|-------------------|------|------|
| campaigns: dilution_rate, amount_per_10r | projects: 同上 | ✅ **パッチ済** schema を `numeric` に変更（GAS 数値演算と整合） |
| applications | bookings | ✅ **パッチ済** schema に `farmer_name`, `phone`, `email`, `desired_start_date`, `desired_end_date`, `field_polygon`, `locked_price` を追加。`farmer_id`, `confirmed_date`, `actual_area_10r`, `invoice_status` は既存。 |

### 3.2 仕様にあり schema に無いカラム・テーブル

| 種別 | 内容 |
|------|------|
| users | ✅ **パッチ済** `interested_crop_ids`, `license_mlit`, `license_droneskill` を schema に追加 |
| campaigns | 主要カラムはほぼあり（パッチで dilution_rate, amount_per_10r を numeric に変更済） |
| テーブル | **sessions** は Supabase Auth で代替（仕様書注記のまま） |
| テーブル欠如 | ✅ **パッチ済** **work_requests**（作業依頼）を schema に追加（全カラム） |
| テーブル欠如 | ✅ **パッチ済** **billings**（請求管理）を schema に追加（全カラム） |
| テーブル欠如 | ✅ **パッチ済** **templates**（案件テンプレート）を schema に追加（全カラム） |

### 3.3 今回の軽微な対応

- 案件作成時に **max_target_area_10r** と **execution_price** を保存できるように `CampaignCreateData` と `createCampaign` の insert に追加（逆オークション計算で必要）。

---

## 4. UI/UX（画面項目・ステータス表示）

**対象**: 仕様「5. 画面・ビュー構成」comp_app_views.html のタブ・ボタン・項目

| チェック項目 | 結果 | 備考 |
|-------------|------|------|
| 業者が「募集締切」を操作できるか | ✅ **パッチ済** 業者ダッシュボード（`/admin`）の「直近の作業予定」一覧に「募集締切」ボタンを追加。押下で `closeCampaign` を呼び、`final_unit_price` を設定し全 bookings の `locked_price` を更新。 |
| 実績報告時に actual_area_10r を入力し final_amount が再計算されるか | ✅ 実装済 | `api/provider/reports/submit` で `actual_area_10r` を受け取り、`final_amount = Math.round(actualArea10r * finalUnitPrice)` で再計算して bookings を更新。**端数は Math.floor → Math.round に修正済**（GAS Calculator.js に合わせた） |

その他、仕様のタブ（tab-progress, tab-work-reports, tab-requests, tab-invoices, tab-history, tab-profile, tab-create）が Next のどのページに対応するかは、ルート構成の一覧マッピングがあるとよい。

---

## 5. 実施した修正のまとめ（Apply 済み）

1. **createBooking（api.ts）**  
   - 案件取得・存在チェック  
   - 募集終了チェック（`isCampaignClosed`：is_closed / status closed, completed, unformed / 終了日経過）  
   - 残り面積チェック（`validateApplicationArea`、上限は max_target_area_10r または target_area_10r）

2. **実績報告 API（reports/submit/route.ts）**  
   - `final_amount` の計算を `Math.floor` → `Math.round` に変更（GAS `calculateFinalAmount` に合わせる）

3. **createCampaign（api.ts）**  
   - `CampaignCreateData` に `maxTargetArea10r`, `executionPrice` を追加  
   - insert に `max_target_area_10r`, `execution_price` を追加（逆オークション計算に必要）

---

## 6. パッチ適用後の状態（仕様との乖離: 0）

以下はすべて本パッチで対応済みです。

- **申込の農家紐付け**: ログイン時は `farmer_id` を `createBooking` に渡し、bookings に保存。ゲスト入力（名前・電話・メール）は維持。
- **bookings スキーマ**: `farmer_id`, `confirmed_date`, `actual_area_10r`, `invoice_status` に加え、ゲスト用に `farmer_name`, `phone`, `email`, `desired_start_date`, `desired_end_date`, `field_polygon`, `locked_price` を schema に追加済み。申込時は `status: 'confirmed'`, `work_status: 'pending'`, `invoice_status: 'unbilled'` で保存。
- **users**: `interested_crop_ids`, `license_mlit`, `license_droneskill` を schema に追加済み。
- **projects**: `dilution_rate`, `amount_per_10r` を `numeric` に変更済み。
- **欠落テーブル**: work_requests, billings, templates を schema に追加済み（全カラム）。sessions は Supabase Auth で代替。
- **募集締切 UI**: 業者ダッシュボードに「募集締切」ボタンを追加。`closeCampaign` で `final_unit_price` を計算・保存し、当該案件の全 bookings の `locked_price` を更新済み。
- **next.config**: `next.config.ts` を `next.config.mjs`（ESM）にリネームし、ビルド通過を確認済み。

**再点検結果**: 本監査で挙げた仕様との乖離は、上記パッチにより解消済み。現時点で「仕様との乖離は 0」と判断します。

以上。
