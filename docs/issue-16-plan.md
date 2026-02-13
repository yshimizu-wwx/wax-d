# Issue #16 農家サイド：圃場登録および作業依頼フローの改善 — 実装プラン

## 概要

GitHub Issue [#16](https://github.com/yshimizu-wwx/wax-d/issues/16) の4項目を、以下の関連ファイルを修正して実装する。

---

## 1. [Field] 圃場登録時のジオコーディング不具合修正と入力補助（v0.1 Hotfix）

### 修正内容
- **逆ジオコーディング**: ポリゴン描画完了時に中心座標から住所を取得し「所在地」に自動入力
- **デフォルト名称**: 「所在地＋畑」を「畑の名前」の初期値にセット（編集可）
- **面積表示**: 小数点第1位まで（XX.X 反）に統一

### 関連ファイル
| ファイル | 変更内容 |
|----------|----------|
| `src/lib/google-maps.ts` | 逆ジオコード `reverseGeocodeWithGoogle(lat, lng)` を追加 |
| `src/lib/geo/geocode.ts` | `reverseGeocodeAddress(lat, lng)` を追加（API経由はクライアントで呼ぶ想定） |
| `src/app/api/geocode/route.ts` | GET で `lat` & `lng` のとき逆ジオコードを返す |
| `src/lib/geo/geocodeClient.ts` | `reverseGeocodeViaApi(lat, lng)` を追加 |
| `src/lib/geo/areaCalculator.ts` | `calculatePolygonArea10r` の戻りを小数点第1位に（`Math.round(area10r * 10) / 10`） |
| `src/app/(main)/my-fields/page.tsx` | ポリゴン完了時に逆ジオコードで住所セット、名称を「住所＋畑」に、面積は1桁表示 |

### 受入基準
- [ ] 住所検索で正しい位置に地図が移動する（既存の flyTo を維持）
- [ ] ポリゴン描画完了時に面積が「XX.X 反」で表示される
- [ ] ポリゴン描画完了時に住所欄・名称欄が自動で埋まる

---

## 2. [Request] 作業申込時の「圃場選択」UI と自動計算（v0.2）

### 修正内容
- **前提条件**: 圃場未登録の場合は「まずは圃場を登録してください」と誘導（モーダル or 表示＋リンク）
- **圃場選択**: 複数圃場を選択可能（チェックボックス等）
- **合計面積**: 選択した圃場の面積合計を「想定面積」に自動セット（読取専用）

### 関連ファイル
| ファイル | 変更内容 |
|----------|----------|
| `supabase/migrations/` | `work_requests` に `field_ids uuid[]` を追加（複数圃場紐付け） |
| `src/types/database.types.ts` | 手動で `field_ids` を追加するか、マイグレーション後に再生成 |
| `src/types/database.ts` | `WorkRequest` に `field_ids` を追加 |
| `src/services/work-request.service.ts` | `field_ids` を insert に含める |
| `src/lib/api.ts` | `WorkRequestData` に `field_ids?: string[]` を追加 |
| `src/app/(main)/requests/page.tsx` | 圃場一覧取得、0件時は誘導表示してフォームは出さない |
| `src/components/WorkRequestForm.tsx` | 圃場マルチ選択UI、合計面積を読取専用で表示 |

### 受入基準
- [ ] 圃場未登録では作業依頼画面で警告が出て、フォームに進めない or 誘導される
- [ ] 複数圃場選択時に合計面積がフォームに正しく反映される

---

## 3. [Request] 作業依頼フォームのマスターデータ連携とバリデーション（v0.2）

### 修正内容
- **業者選択**: 紐付き業者（`farmer_providers`）のみ表示し、選択必須
- **マスター連携**: 選択業者の品目・作業種別・作業詳細をマスターから取得しセレクトで表示（自由入力廃止）
- **希望予算**: 入力欄を削除
- **想定面積**: 圃場選択の合計のみ（読取専用）
- **日付バリデーション**: 希望開始日 ≤ 希望終了日

### 関連ファイル
| ファイル | 変更内容 |
|----------|----------|
| `src/lib/api.ts` | 紐付き業者取得 `fetchLinkedProvidersByFarmer(farmerId)` を追加（farmer_providers + users） |
| `src/components/WorkRequestForm.tsx` | 業者セレクト、マスター（crop/task_category/task_detail）セレクト、希望予算削除、面積読取専用、日付バリデーション |
| `src/services/work-request.service.ts` | `provider_id` 必須で insert、`crop_name` / `task_category_name` / `task_detail_name` をマスターから設定 |

### 受入基準
- [ ] 品目・作業はマスターの選択肢のみ（テキスト入力不可）
- [ ] 開始日より前の終了日は設定できない
- [ ] 希望予算欄が無い

---

## 4. [Account] ユーザー情報の自動入力と業者紐付け（v0.2）

### 修正内容
- **申込フォーム初期値**: 農家が案件に申し込むとき、ログインユーザーの名前・電話・メールをプリセット（編集可 or 確認のみは要検討）
- **業者紐付け**: 作業依頼では `farmer_providers` で紐付いている業者のみ表示（上記 3 で対応）

### 関連ファイル
| ファイル | 変更内容 |
|----------|----------|
| `src/app/(main)/page.tsx` | 農家用の申込時、`getCurrentUser()` で名前・電話・メールを取得し CampaignForm に初期値として渡す |
| `src/components/CampaignForm.tsx` | `initialFormData?: Partial<FarmerFormData>` を受け取り、初期 state に反映 |

### 受入基準
- [ ] 申込画面を開いた時点で個人情報が入力済みである
- [ ] 作業依頼では紐付き業者のみ表示される（上記 3 で担保）

---

## 実装順序

1. **Phase 1**: 圃場登録改善（逆ジオコード、面積1桁、デフォルト名称）
2. **Phase 2**: 作業依頼の圃場選択（マイグレーション、API、requests ページ・WorkRequestForm）
3. **Phase 3**: 作業依頼のマスター連携・バリデーション・希望予算削除
4. **Phase 4**: 申込フォームのユーザー情報プリセット
