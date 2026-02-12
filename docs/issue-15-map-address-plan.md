# Issue #15 地図機能および住所検索の改善 — 修正プラン

## Issue 概要（GitHub #15）

1. **[Bug] 住所ジオコーディング精度の向上と検索ロジックの刷新**
   - 住所入力で地図が正しく移動しない／「ラフな住所」で検索失敗する問題の解消
   - Google Maps Geocoding API の利用、日本国内特化、表記揺れ対応、Places Autocomplete、複数結果時は最確度で遷移

2. **[Bug/UI-UX] 地図カメラ制御の修正**
   - 拠点住所・現在地への移動が正しく動作しない
   - 拠点読み込み時の flyTo/panTo、現在地ボタンと Geolocation エラーハンドリング、移動中ローディング、center と state の不整合解消、ズーム保持

---

## 関連ファイル（現状）

| 役割 | ファイル | 備考 |
|------|----------|------|
| ジオコーディング | `src/lib/geo/geocode.ts` | 現状: Nominatim のみ。Google 対応を追加 |
| 地図＋住所検索UI | `src/components/PolygonMap.tsx` | 住所検索バー・MapController・flyTo あり。拠点初回移動・現在地・ローディングを追加 |
| 案件地図 | `src/components/CampaignMapView.tsx` | FitBounds で表示。今回の変更対象外（拠点詳細ではない） |
| 畑登録で地図利用 | `src/app/(main)/my-fields/page.tsx` | PolygonMap に initialAddress / showAddressSearch を渡している |
| 環境変数 | `.env.local` | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` を追加想定 |

Issue で推測されていた `SearchBar.tsx` / `useGeocoding.ts` / `MapView.tsx` / `locationStore.ts` / `useGeolocation.ts` は現状存在しないため、既存の `PolygonMap` と `geocode` を拡張する形で対応する。

---

## 修正内容

### 1. Google Maps Geocoding API 連携

- **新規**: `src/lib/google-maps.ts`
  - `geocodeWithGoogle(address: string): Promise<GeocodeResult | null>`
  - `region=jp`, `language=ja` でリクエスト
  - 複数結果時は先頭（Google は関連度順）を使用
- **変更**: `src/lib/geo/geocode.ts`
  - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` が設定されていれば Google を優先、未設定なら従来どおり Nominatim
  - 既存の `GeocodeResult` と `geocodeAddress()` のシグネチャは維持（呼び出し側は変更不要）

### 2. 住所検索ロジック・UX

- 検索実行後は既存の `setFlyToTarget` で地図移動（実装済み）。Google 利用時は精度向上で「正しく移動」を満たす。
- 複数結果時は 1 件目（最確度）を使用し、ズーム 15 で flyTo（MapController 側は現状のまま）。
- 住所が特定できない場合は既存の「住所が見つかりませんでした。別のキーワードで試してください。」を継続（必要なら文言微調整）。

### 3. 拠点読み込み時の地図移動

- **原因**: `resolvedInitialCenter` をセットしても `MapContainer` の `center` は初期値のみで、react-leaflet は後から center を更新しない。
- **対応**: 初期住所のジオコード完了時に `setResolvedInitialCenter` に加え `setFlyToTarget([lat, lng])` を実行し、MapController の `flyTo` で確実にその座標へ移動する。

### 4. 現在地へ移動

- **新規**: `src/hooks/useGeolocation.ts`
  - `getCurrentPosition(): Promise<{ lat: number; lng: number }>`
  - 権限拒否・エラー時にメッセージを返し、呼び出し側でトーストやダイアログ表示
- **変更**: `PolygonMap.tsx`
  - 「現在地へ移動」ボタンを追加（`showAddressSearch` 時のみ表示想定）
  - クリックで `getCurrentPosition()` → 取得成功時は `setFlyToTarget` で移動
  - 権限がオフ／エラー時は「位置情報を利用できません。ブラウザの設定で許可するか、住所で検索してください。」等を表示

### 5. 地図移動中のローディングとズーム

- **変更**: `PolygonMap.tsx`
  - `flyToTarget` がセットされている間、地図上に「移動中...」のオーバーレイを表示（0.5s 程度で非表示、または fly 完了に合わせて消す簡易実装可）。
- MapController の `flyTo` は zoom 15 固定のまま（極端な拡大・縮小を避ける）。

### 6. Places Autocomplete（住所補完）

- **方針**: API キー必須かつ Maps JavaScript API の読み込みが必要なため、**オプション**として実装。
- 実装する場合: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` があるとき、住所入力欄に Google Places Autocomplete を付与（`componentRestrictions: { country: 'jp' }`）。スクリプトの動的読み込みと ref で input に Autocomplete を紐付け。
- 未実装でも Issue の「ジオコーディング精度向上」「地図カメラ制御」は達成可能。

---

## 受入基準との対応

| 基準 | 対応 |
|------|------|
| 市区町村以下のラフな住所でも意図した座標が返る | Google Geocoding + region=jp で対応 |
| 検索実行後、地図のズームが適切で該当座標が中央に | flyTo(15) と初回拠点時の flyTo で対応 |
| 住所が特定できない場合に適切なエラーメッセージ | 既存メッセージ＋必要なら文言調整 |
| 拠点詳細を開いた際、その住所が地図中央に表示される | 初期ジオコード完了時に setFlyToTarget で flyTo |
| 現在地ボタンで 3 秒以内にスムーズに移動 | useGeolocation + setFlyToTarget、duration 0.5 |
| GPS オフ時は許可を求めるか代替手段のダイアログ | useGeolocation のエラーをトースト／メッセージで表示 |

---

## 環境変数

- `.env.local` に次を追加すると Google Geocoding が有効になります。未設定の場合は従来どおり Nominatim のみ動作します。
  ```
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=あなたのGoogle Maps APIキー
  ```
- Google Cloud で「Geocoding API」を有効にしたうえで、API キーを発行してください。
