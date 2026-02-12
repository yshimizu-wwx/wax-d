# Next.js 移植実装計画書

**作成日**: 2026-02-12
**対象**: ドローンあいのり予約システム（GAS → Next.js + Supabase 移行）
**参照**: `current_system_spec.md`

---

## 目次
1. [逆オークション計算ロジックの再現計画](#1-逆オークション計算ロジックの再現計画)
2. [地図・面積計算の再現計画](#2-地図面積計算の再現計画)
3. [データの保存フロー](#3-データの保存フロー)
4. [技術スタック選定理由](#4-技術スタック選定理由)
5. [ファイル構成案](#5-ファイル構成案)
6. [段階的な移行戦略](#6-段階的な移行戦略)

---

## 1. 逆オークション計算ロジックの再現計画

### 1.1 現行システムの仕様分析

**参照**: `current_system_spec.md:295-358` (`Calculator.js:23` - `calculateCurrentUnitPrice`)

現行システムは以下の2パターンをサポート：

#### パターンA: 最低成立面積がある場合 (`min_target_area_10r` > 0)

```
最低成立面積未達（totalArea < min_target_area_10r）:
  → 単価表示なし（currentPrice = null）
  → 進捗率 = totalArea / min_target_area_10r
  → isUnformed = true

満額ライン達成（totalArea >= max_target_area_10r）:
  → 単価 = min_price（最低単価）
  → 進捗率 = 1.0（100%）

最低成立〜満額ラインの間:
  → 進捗率 = (totalArea - min_target_area_10r) / (max_target_area_10r - min_target_area_10r)
  → 単価 = execution_price + (min_price - execution_price) × 進捗率
```

#### パターンB: 最低成立面積がない場合（従来の線形方式）

```
進捗率 = min(totalArea / target_area_10r, 1.0)
単価 = base_price - (base_price - min_price) × 進捗率
```

### 1.2 TypeScript 実装計画

#### ファイル配置
```
src/lib/calculator/
  ├── priceCalculator.ts      # 単価計算のコアロジック
  ├── priceCalculator.test.ts # 単体テスト
  └── types.ts                # 型定義
```

#### 型定義（`types.ts`）

```typescript
/**
 * 案件の価格設定情報
 */
export interface CampaignPricing {
  base_price: number;              // 開始単価（円/10R）
  min_price: number;               // 目標単価（円/10R）
  target_area_10r: number;         // 目標面積（10R）
  min_target_area_10r?: number;    // 最低成立面積（10R）
  max_target_area_10r?: number;    // 満額ライン面積（10R）
  execution_price?: number;        // 成立時単価（円/10R）
}

/**
 * 単価計算結果
 */
export interface PriceCalculationResult {
  currentPrice: number | null;     // 現在単価（不成立時はnull）
  progress: number;                // 進捗率（0〜1）
  isUnformed: boolean;             // 不成立フラグ
  priceReduction: number;          // 値引き額（開始単価からの減額）
  remainingArea: number;           // 満額ラインまでの残り面積
}
```

#### コアロジック（`priceCalculator.ts`）

```typescript
/**
 * 逆オークション方式の単価を計算
 *
 * @param pricing - 案件の価格設定
 * @param totalArea10r - 現在の申込合計面積（10R単位）
 * @returns 計算結果
 */
export function calculateCurrentUnitPrice(
  pricing: CampaignPricing,
  totalArea10r: number
): PriceCalculationResult {
  const {
    base_price,
    min_price,
    target_area_10r,
    min_target_area_10r = 0,
    max_target_area_10r,
    execution_price
  } = pricing;

  // パターンA: 最低成立面積がある場合
  if (min_target_area_10r > 0 && max_target_area_10r && execution_price) {
    // ケース1: 最低成立面積未達
    if (totalArea10r < min_target_area_10r) {
      return {
        currentPrice: null,
        progress: totalArea10r / min_target_area_10r,
        isUnformed: true,
        priceReduction: 0,
        remainingArea: min_target_area_10r - totalArea10r
      };
    }

    // ケース2: 満額ライン達成
    if (totalArea10r >= max_target_area_10r) {
      return {
        currentPrice: min_price,
        progress: 1.0,
        isUnformed: false,
        priceReduction: base_price - min_price,
        remainingArea: 0
      };
    }

    // ケース3: 最低成立〜満額ラインの間（線形変動）
    const progress =
      (totalArea10r - min_target_area_10r) /
      (max_target_area_10r - min_target_area_10r);

    const currentPrice =
      execution_price + (min_price - execution_price) * progress;

    return {
      currentPrice: Math.round(currentPrice), // 円単位で四捨五入
      progress,
      isUnformed: false,
      priceReduction: base_price - currentPrice,
      remainingArea: max_target_area_10r - totalArea10r
    };
  }

  // パターンB: 従来の線形方式
  const progress = Math.min(totalArea10r / target_area_10r, 1.0);
  const currentPrice = base_price - (base_price - min_price) * progress;

  return {
    currentPrice: Math.round(currentPrice),
    progress,
    isUnformed: false,
    priceReduction: base_price - currentPrice,
    remainingArea: Math.max(0, target_area_10r - totalArea10r)
  };
}
```

### 1.3 具体例による検証

**設定値**:
- `base_price`: 20,000円/10R
- `min_price`: 15,000円/10R
- `min_target_area_10r`: 30 (10R)
- `max_target_area_10r`: 50 (10R)
- `execution_price`: 18,000円/10R

| 申込合計面積 | 状態 | 単価 | 進捗率 | 計算式 |
|------------|------|------|--------|--------|
| 20 (10R) | 不成立 | `null` | 66.7% | `20 / 30 = 0.667` |
| 30 (10R) | 成立（最低） | ¥18,000 | 0% | `execution_price` |
| 40 (10R) | 成立 | ¥16,500 | 50% | `18000 + (15000-18000) × 0.5` |
| 50 (10R) | 目標達成 | ¥15,000 | 100% | `min_price` |
| 60 (10R) | 目標超過 | ¥15,000 | 100% | `min_price` |

### 1.4 テスト計画

```typescript
describe('calculateCurrentUnitPrice', () => {
  // パターンA: 最低成立面積ありのテスト
  describe('最低成立面積がある場合', () => {
    test('最低成立面積未達の場合、単価はnullで不成立フラグがtrue', () => {
      // ...
    });

    test('最低成立面積ちょうどの場合、成立時単価が適用される', () => {
      // ...
    });

    test('最低成立〜満額ラインの間は線形変動する', () => {
      // ...
    });

    test('満額ライン達成時は最低単価が適用される', () => {
      // ...
    });

    test('満額ライン超過時も最低単価が維持される', () => {
      // ...
    });
  });

  // パターンB: 従来の線形方式のテスト
  describe('最低成立面積がない場合', () => {
    test('目標面積0%の場合、開始単価が適用される', () => {
      // ...
    });

    test('目標面積50%の場合、中間単価が適用される', () => {
      // ...
    });

    test('目標面積100%の場合、最低単価が適用される', () => {
      // ...
    });
  });
});
```

### 1.5 フロントエンドでの表示計画

#### リアルタイム単価表示（案件詳細画面）

```typescript
// components/campaign/CampaignPriceDisplay.tsx
function CampaignPriceDisplay({ campaign, applications }) {
  const totalArea = applications.reduce((sum, app) => sum + app.area_10r, 0);
  const result = calculateCurrentUnitPrice(campaign, totalArea);

  if (result.isUnformed) {
    return (
      <div className="text-red-600">
        ⚠️ 最低成立面積未達（あと{result.remainingArea}反必要）
        <ProgressBar progress={result.progress} />
      </div>
    );
  }

  return (
    <div>
      現在の単価: <span className="text-2xl font-bold">
        ¥{result.currentPrice?.toLocaleString()}/反
      </span>
      <PriceChart pricing={campaign} currentArea={totalArea} />
    </div>
  );
}
```

---

## 2. 地図・面積計算の再現計画

### 2.1 現行システムの仕様分析

**参照**: `current_system_spec.md:62-63` (`js_polygon_map.html`)

- **地図ライブラリ**: Leaflet.js 1.9.4
- **描画機能**: Leaflet.draw 1.0.4
- **保存形式**: ポリゴン座標をJSON文字列として保存（`area_coordinates`, `target_area_polygon`）
- **面積計算**: 詳細不明（推測：緯度経度からヘロンの公式または測地線計算）

### 2.2 技術選定

#### 地図ライブラリの選定

**選定案**: **React Leaflet** + **Leaflet.draw**

**理由**:
1. **互換性**: 現行システムと同じLeaflet.jsを使用 → UIの一貫性を保てる
2. **React統合**: `react-leaflet`で宣言的にマップコンポーネントを実装可能
3. **実績**: 広く使われており、ドキュメントが豊富
4. **軽量**: Mapbox GLやGoogle Mapsと比べて軽量で高速
5. **オフライン対応**: タイル地図をキャッシュ可能

**代替案との比較**:

| ライブラリ | メリット | デメリット | 採用可否 |
|----------|---------|-----------|---------|
| React Leaflet | 現行システムと同じ、軽量 | 3D表示不可 | ✅ 採用 |
| Mapbox GL JS | 高機能、3D対応 | 高コスト、オーバースペック | ❌ 不要 |
| Google Maps API | 高精度 | 高コスト、ベンダーロックイン | ❌ 不要 |

#### 面積計算ライブラリの選定

**選定案**: **Turf.js**

**理由**:
1. **高精度**: 測地線（Geodesic）計算に対応
2. **標準化**: GeoJSON形式をネイティブサポート
3. **豊富な機能**: 面積計算以外にも、距離計算、ポリゴン操作など多機能
4. **軽量**: 必要な機能だけをTree-shakingで最適化可能
5. **PostGISとの互換性**: GeoJSONを使うため、DBとの連携がスムーズ

**計算式**:

```typescript
import * as turf from '@turf/turf';

/**
 * ポリゴンの面積を「反（10R）」単位で計算
 *
 * @param coordinates - GeoJSON形式のポリゴン座標 [[lng, lat], ...]
 * @returns 面積（10R単位）
 */
function calculateArea10r(coordinates: number[][][]): number {
  // GeoJSONポリゴンオブジェクトを作成
  const polygon = turf.polygon(coordinates);

  // 面積を平方メートルで計算（測地線計算）
  const areaInSquareMeters = turf.area(polygon);

  // 1反 = 10R = 991.7355㎡ で換算
  const area10r = areaInSquareMeters / 991.7355;

  return Math.round(area10r * 100) / 100; // 小数点第2位で四捨五入
}
```

**GAS版との互換性**:

現行システムはポリゴン座標をJSON文字列として保存している可能性が高い。
Next.js版では以下のようにGeoJSON標準形式で保存：

```json
{
  "type": "Polygon",
  "coordinates": [
    [
      [139.6917, 35.6895], // [経度, 緯度]
      [139.7017, 35.6895],
      [139.7017, 35.6995],
      [139.6917, 35.6995],
      [139.6917, 35.6895]  // 始点と終点を一致させる
    ]
  ]
}
```

Supabaseには `GEOMETRY(POLYGON, 4326)` 型として保存し、PostGISで直接面積計算も可能：

```sql
-- PostGIS側で面積計算（バリデーション用）
SELECT ST_Area(target_area_polygon::geography) / 991.7355 AS area_10r
FROM campaigns
WHERE id = '...';
```

### 2.3 実装計画

#### ファイル配置

```
src/components/map/
  ├── LeafletMap.tsx           # 地図表示コンポーネント
  ├── PolygonDrawer.tsx        # ポリゴン描画コンポーネント
  ├── FieldSelector.tsx        # 既存畑選択UI
  └── hooks/
      ├── useLeafletDraw.ts    # Leaflet.draw統合フック
      └── useGeocoding.ts      # 逆ジオコーディングフック

src/lib/geo/
  ├── areaCalculator.ts        # 面積計算ロジック
  ├── geoJsonUtils.ts          # GeoJSON変換ユーティリティ
  └── areaCalculator.test.ts   # テスト
```

#### コアロジック（`areaCalculator.ts`）

```typescript
import * as turf from '@turf/turf';
import { Polygon } from 'geojson';

/**
 * ポリゴンの面積を「反（10R）」単位で計算
 */
export function calculatePolygonArea10r(polygon: Polygon): number {
  const areaInSquareMeters = turf.area(polygon);
  const TSUBO_TO_SQUARE_METER = 3.305785; // 1坪 = 3.305785㎡
  const TAN_TO_TSUBO = 300; // 1反 = 300坪
  const TAN_TO_SQUARE_METER = TSUBO_TO_SQUARE_METER * TAN_TO_TSUBO; // 991.7355㎡

  return areaInSquareMeters / TAN_TO_SQUARE_METER;
}

/**
 * Leaflet.drawのレイヤーからGeoJSON Polygonを生成
 */
export function leafletLayerToGeoJSON(layer: any): Polygon {
  const latLngs = layer.getLatLngs()[0]; // 外周のみ取得

  const coordinates = latLngs.map((latLng: any) => [
    latLng.lng,
    latLng.lat
  ]);

  // 始点と終点を一致させる
  if (
    coordinates[0][0] !== coordinates[coordinates.length - 1][0] ||
    coordinates[0][1] !== coordinates[coordinates.length - 1][1]
  ) {
    coordinates.push(coordinates[0]);
  }

  return {
    type: 'Polygon',
    coordinates: [coordinates]
  };
}

/**
 * PostGISのWKT形式に変換（データベース保存用）
 */
export function geoJSONToWKT(polygon: Polygon): string {
  const coords = polygon.coordinates[0]
    .map(([lng, lat]) => `${lng} ${lat}`)
    .join(', ');

  return `POLYGON((${coords}))`;
}
```

#### Reactコンポーネント（`PolygonDrawer.tsx`）

```typescript
'use client';

import { MapContainer, TileLayer, FeatureGroup } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import { useState } from 'react';
import { calculatePolygonArea10r, leafletLayerToGeoJSON } from '@/lib/geo/areaCalculator';

interface PolygonDrawerProps {
  onPolygonComplete: (polygon: Polygon, area10r: number) => void;
  initialCenter?: [number, number];
  initialZoom?: number;
}

export function PolygonDrawer({
  onPolygonComplete,
  initialCenter = [35.6895, 139.6917], // 東京
  initialZoom = 13
}: PolygonDrawerProps) {
  const [drawnPolygon, setDrawnPolygon] = useState<Polygon | null>(null);
  const [calculatedArea, setCalculatedArea] = useState<number>(0);

  const handleCreated = (e: any) => {
    const layer = e.layer;
    const polygon = leafletLayerToGeoJSON(layer);
    const area10r = calculatePolygonArea10r(polygon);

    setDrawnPolygon(polygon);
    setCalculatedArea(area10r);
    onPolygonComplete(polygon, area10r);
  };

  return (
    <div className="relative">
      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        className="h-96 w-full rounded-lg"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        <FeatureGroup>
          <EditControl
            position="topright"
            onCreated={handleCreated}
            draw={{
              rectangle: false,
              circle: false,
              circlemarker: false,
              marker: false,
              polyline: false,
              polygon: {
                allowIntersection: false,
                showArea: true,
                metric: ['km', 'm']
              }
            }}
          />
        </FeatureGroup>
      </MapContainer>

      {calculatedArea > 0 && (
        <div className="absolute top-4 left-4 bg-white p-4 rounded shadow-lg">
          <p className="text-sm text-gray-600">描画面積</p>
          <p className="text-2xl font-bold">
            {calculatedArea.toFixed(2)} 反
          </p>
        </div>
      )}
    </div>
  );
}
```

### 2.4 PostGISとの連携

#### データベース保存時

```typescript
// API Route: /api/campaigns/create
import { geoJSONToWKT } from '@/lib/geo/areaCalculator';

const polygon = /* フロントから受け取ったGeoJSON Polygon */;
const wkt = geoJSONToWKT(polygon);

await supabase
  .from('campaigns')
  .insert({
    target_area_polygon: wkt, // WKT形式で保存
    // ...
  });
```

#### データベース読み込み時

```typescript
// PostGISからGeoJSON形式で取得
const { data } = await supabase
  .from('campaigns')
  .select('id, ST_AsGeoJSON(target_area_polygon) as polygon_geojson')
  .eq('id', campaignId)
  .single();

const polygon = JSON.parse(data.polygon_geojson);
```

---

## 3. データの保存フロー

### 3.1 現行システムの仕様分析

**参照**: `current_system_spec.md:360-435` (申込処理ロジック - `Application.js:56`)

現行システムの申込フローは以下の通り：

```
1. ロック取得（LockService.getScriptLock()）
   ↓
2. ユーザー認証
   ↓
3. 案件バリデーション（募集終了チェック、業者-農家紐付けチェック）
   ↓
4. 残り面積チェック（満額ライン超過防止）
   ↓
5. 畑（Field）の処理
   ↓
6. applicationsシートに行を追加
   ↓
7. 面積到達時の自動トリガー（closeCampaign）
   ↓
8. メール通知
   ↓
9. ロック解放
```

**重要な要素**:
- **排他制御**: `LockService`で最大30秒ロック（同時申込の競合を防止）
- **残り面積チェック**: 満額ライン（`max_target_area_10r`）を超えないようにバリデーション
- **自動トリガー**: 目標面積達成時に自動で募集締切

### 3.2 Next.js + Supabase での実装方針

#### 3.2.1 排他制御の実現方法

**選定案**: **PostgreSQLのトランザクション + 行ロック（SELECT ... FOR UPDATE）**

**理由**:
1. **データベースレベルでの保証**: アプリケーション層の実装ミスによる競合を防止
2. **Supabaseネイティブ**: 追加のサービス（Redisなど）が不要
3. **デッドロック検出**: PostgreSQLが自動でデッドロックを検出・解決
4. **シンプル**: GASのLockServiceと同等の機能を実現

**代替案との比較**:

| 方式 | メリット | デメリット | 採用可否 |
|-----|---------|-----------|---------|
| PostgreSQL行ロック | DB保証、追加サービス不要 | 長時間ロックに注意 | ✅ 採用 |
| Redis分散ロック | 高速、TTL設定可能 | 追加インフラ、複雑化 | ❌ オーバースペック |
| 楽観的ロック | 実装簡単 | 競合時にリトライ必要 | ❌ UX悪化 |

#### 3.2.2 実装計画

##### ファイル配置

```
src/app/api/applications/
  ├── create/
  │   └── route.ts              # 申込作成API
  └── [id]/
      ├── update-field/route.ts # 畑紐付け更新API
      └── confirm-date/route.ts # 日程確定API

src/lib/application/
  ├── applicationService.ts     # 申込ビジネスロジック
  ├── validators.ts             # バリデーション関数
  └── mailers.ts                # メール送信関数

src/lib/db/
  ├── supabaseClient.ts         # Supabaseクライアント
  └── transactions.ts           # トランザクションヘルパー
```

##### コアロジック（`applicationService.ts`）

```typescript
import { createClient } from '@/lib/db/supabaseClient';
import { calculateCurrentUnitPrice } from '@/lib/calculator/priceCalculator';

/**
 * 申込作成（排他制御付き）
 */
export async function createApplication(params: {
  campaignId: string;
  farmerId: string;
  area10r: number;
  preferredDates?: string[];
  fieldId?: string;
  newFieldData?: FieldData;
}) {
  const supabase = createClient();

  // トランザクション開始 + 行ロック
  const { data, error } = await supabase.rpc('create_application_with_lock', {
    p_campaign_id: params.campaignId,
    p_farmer_id: params.farmerId,
    p_area_10r: params.area10r,
    p_field_id: params.fieldId,
    // ...
  });

  if (error) throw error;

  return data;
}
```

##### PostgreSQL関数（ストアドプロシージャ）

```sql
-- create_application_with_lock
CREATE OR REPLACE FUNCTION create_application_with_lock(
  p_campaign_id UUID,
  p_farmer_id UUID,
  p_area_10r NUMERIC,
  p_field_id UUID DEFAULT NULL,
  p_preferred_dates TEXT[] DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_campaign RECORD;
  v_current_total NUMERIC;
  v_remaining NUMERIC;
  v_max_area NUMERIC;
  v_application_id UUID;
  v_result JSON;
BEGIN
  -- 1. 案件を行ロック（FOR UPDATE）
  SELECT * INTO v_campaign
  FROM campaigns
  WHERE id = p_campaign_id
  FOR UPDATE; -- 他のトランザクションがこの行を更新できないようにロック

  -- 2. バリデーション：募集終了チェック
  IF v_campaign.is_closed OR v_campaign.status IN ('closed', 'completed', 'unformed') THEN
    RAISE EXCEPTION '募集は終了しています';
  END IF;

  -- 3. 現在の申込合計を計算
  SELECT COALESCE(SUM(area_10r), 0) INTO v_current_total
  FROM applications
  WHERE campaign_id = p_campaign_id
    AND status = 'confirmed';

  -- 4. 残り面積チェック
  v_max_area := COALESCE(v_campaign.max_target_area_10r, v_campaign.target_area_10r);
  v_remaining := v_max_area - v_current_total;

  IF p_area_10r > v_remaining THEN
    RAISE EXCEPTION '申し込み面積が上限を超えています。残り % 反まで予約可能です。', v_remaining;
  END IF;

  -- 5. 申込を作成
  INSERT INTO applications (
    campaign_id,
    farmer_id,
    area_10r,
    field_id,
    preferred_dates,
    status,
    work_status,
    invoice_status
  ) VALUES (
    p_campaign_id,
    p_farmer_id,
    p_area_10r,
    p_field_id,
    array_to_string(p_preferred_dates, ','),
    'confirmed',
    'pending',
    'unbilled'
  )
  RETURNING id INTO v_application_id;

  -- 6. 目標面積達成チェック（自動締切トリガー）
  IF (v_current_total + p_area_10r) >= v_campaign.target_area_10r THEN
    -- 募集締切処理を実行
    PERFORM close_campaign(p_campaign_id);
  END IF;

  -- 7. 結果を返す
  v_result := json_build_object(
    'success', true,
    'application_id', v_application_id,
    'total_area', v_current_total + p_area_10r
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- エラー時はロールバック（自動）
    RAISE;
END;
$$ LANGUAGE plpgsql;
```

#### 3.2.3 フロー図

```
[フロントエンド]
      ↓
[POST /api/applications/create]
      ↓
[Supabase RPC: create_application_with_lock]
      ↓
┌─────────────────────────────────────┐
│ BEGIN TRANSACTION                    │
│                                     │
│ 1. SELECT ... FOR UPDATE (行ロック) │ ← 他のトランザクションは待機
│ 2. バリデーション                    │
│ 3. 残り面積チェック                   │
│ 4. INSERT INTO applications         │
│ 5. 目標面積達成チェック               │
│ 6. （必要なら）close_campaign()      │
│                                     │
│ COMMIT                               │
└─────────────────────────────────────┘
      ↓
[メール通知（非同期）]
      ↓
[フロントエンドにレスポンス]
```

### 3.3 RLS（Row Level Security）ポリシー

開発用の全アクセス許可ポリシーから、本番用の厳密なポリシーに置き換える計画：

```sql
-- 開発用ポリシーを削除
DROP POLICY "開発用: 全ユーザーアクセス許可" ON applications;

-- 本番用ポリシー
-- 1. 自分の申込のみ閲覧可能
CREATE POLICY "農家は自分の申込のみ閲覧可能"
  ON applications FOR SELECT
  USING (
    auth.uid() = farmer_id
    OR
    auth.uid() IN (
      SELECT provider_id FROM campaigns WHERE id = campaign_id
    )
  );

-- 2. 農家のみ申込作成可能
CREATE POLICY "農家のみ申込作成可能"
  ON applications FOR INSERT
  WITH CHECK (
    auth.uid() = farmer_id
    AND
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
        AND role = 'farmer'
        AND status = 'active'
    )
  );

-- 3. 業者は自分の案件に紐づく申込を更新可能
CREATE POLICY "業者は自分の案件の申込を更新可能"
  ON applications FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT provider_id FROM campaigns WHERE id = campaign_id
    )
  );
```

### 3.4 エラーハンドリング

```typescript
// API Route: /api/applications/create/route.ts
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // バリデーション
    const validated = applicationSchema.parse(body);

    // 申込作成
    const result = await createApplication(validated);

    // メール通知（非同期）
    queueEmail({
      to: result.farmerEmail,
      template: 'application_confirmed',
      data: result
    });

    return Response.json(result);

  } catch (error) {
    // PostgreSQLのエラーメッセージをパース
    if (error.message.includes('残り')) {
      return Response.json(
        { error: error.message },
        { status: 400 } // Bad Request
      );
    }

    if (error.message.includes('募集は終了')) {
      return Response.json(
        { error: error.message },
        { status: 410 } // Gone
      );
    }

    // その他のエラー
    return Response.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
```

---

## 4. 技術スタック選定理由

### 4.1 フロントエンド

| 技術 | 選定理由 |
|-----|---------|
| **Next.js 15 (App Router)** | RSC（React Server Components）でSEO最適化、API Routesで統合開発 |
| **TypeScript** | 型安全性、開発効率向上、GASのJavaScriptから段階的に移行可能 |
| **TailwindCSS** | 現行システムと同じ、スタイルの一貫性を保てる |
| **React Leaflet** | 現行システムと同じLeaflet.js、UIの一貫性を保てる |
| **Turf.js** | 面積計算・地理空間処理の標準ライブラリ |
| **Zod** | API入力のバリデーション、型安全性 |
| **React Hook Form** | フォーム管理、バリデーション |
| **FullCalendar** | 現行システムと同じ、カレンダーUI |

### 4.2 バックエンド

| 技術 | 選定理由 |
|-----|---------|
| **Supabase** | PostgreSQL + PostGIS、認証、ストレージが統合されている |
| **PostgreSQL + PostGIS** | 地理空間データの高速処理、標準SQL |
| **Prisma** | 型安全なORM、マイグレーション管理 |
| **tRPC**（オプション） | End-to-endの型安全性、API開発の効率化 |

### 4.3 インフラ

| 技術 | 選定理由 |
|-----|---------|
| **Vercel** | Next.js開発元、自動デプロイ、高速CDN |
| **Supabase Cloud** | マネージドサービス、スケーラブル |
| **Resend**（メール） | 開発者フレンドリーなメールAPI |
| **Vercel Blob**（ストレージ） | 画像アップロード（作業完了写真） |

---

## 5. ファイル構成案

```
v3-nextjs/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── admin/
│   │   │   │   ├── providers/page.tsx
│   │   │   │   ├── campaigns/page.tsx
│   │   │   │   └── billings/page.tsx
│   │   │   ├── provider/
│   │   │   │   ├── campaigns/page.tsx
│   │   │   │   ├── applications/page.tsx
│   │   │   │   ├── work-reports/page.tsx
│   │   │   │   └── invoices/page.tsx
│   │   │   └── farmer/
│   │   │       ├── campaigns/page.tsx
│   │   │       ├── applications/page.tsx
│   │   │       ├── fields/page.tsx
│   │   │       └── work-requests/page.tsx
│   │   ├── api/
│   │   │   ├── applications/
│   │   │   │   └── create/route.ts
│   │   │   ├── campaigns/
│   │   │   │   ├── create/route.ts
│   │   │   │   └── [id]/
│   │   │   │       ├── close/route.ts
│   │   │   │       └── route.ts
│   │   │   ├── fields/
│   │   │   │   └── create/route.ts
│   │   │   └── work-requests/
│   │   │       └── create/route.ts
│   │   └── layout.tsx
│   ├── components/
│   │   ├── campaign/
│   │   │   ├── CampaignCard.tsx
│   │   │   ├── CampaignPriceDisplay.tsx
│   │   │   └── CampaignForm.tsx
│   │   ├── map/
│   │   │   ├── LeafletMap.tsx
│   │   │   ├── PolygonDrawer.tsx
│   │   │   └── FieldSelector.tsx
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   └── Modal.tsx
│   │   └── layout/
│   │       ├── Header.tsx
│   │       └── Sidebar.tsx
│   ├── lib/
│   │   ├── calculator/
│   │   │   ├── priceCalculator.ts
│   │   │   └── types.ts
│   │   ├── geo/
│   │   │   ├── areaCalculator.ts
│   │   │   └── geoJsonUtils.ts
│   │   ├── application/
│   │   │   ├── applicationService.ts
│   │   │   └── validators.ts
│   │   ├── db/
│   │   │   ├── supabaseClient.ts
│   │   │   └── transactions.ts
│   │   └── utils/
│   │       └── formatters.ts
│   └── types/
│       ├── campaign.ts
│       ├── application.ts
│       └── user.ts
├── supabase/
│   ├── migrations/
│   │   └── 20260212000000_initial_schema.sql
│   ├── functions/
│   │   ├── create_application_with_lock.sql
│   │   └── close_campaign.sql
│   └── seed.sql
├── tests/
│   ├── unit/
│   │   ├── priceCalculator.test.ts
│   │   └── areaCalculator.test.ts
│   └── integration/
│       └── application.test.ts
├── public/
│   └── images/
├── .env.local
├── next.config.js
├── package.json
├── tsconfig.json
└── README.md
```

---

## 6. 段階的な移行戦略

### フェーズ1: 基盤構築（Week 1-2）

- [x] データベーススキーマ作成（`schema.sql`）
- [ ] Supabase認証の設定
- [ ] Next.jsプロジェクトセットアップ
- [ ] 基本的なレイアウト・ルーティング

### フェーズ2: コアロジック実装（Week 3-4）

- [ ] 逆オークション計算ロジック実装 + テスト
- [ ] 地図・面積計算機能実装 + テスト
- [ ] 申込処理（排他制御付き）実装 + テスト

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

---

## 7. リスクと対策

### リスク1: 同時申込の競合

**リスク**: 複数ユーザーが同時に申し込んだ際、満額ラインを超える可能性

**対策**:
- PostgreSQLの行ロック（SELECT ... FOR UPDATE）で排他制御
- ロードテストで検証

### リスク2: 面積計算の精度

**リスク**: GAS版とNext.js版で計算結果が異なる可能性

**対策**:
- Turf.jsは測地線計算を使用（高精度）
- PostGISでも同様の計算が可能（検証用）
- GAS版のテストデータで検証

### リスク3: 地図表示のパフォーマンス

**リスク**: 大量のポリゴンを表示すると重くなる

**対策**:
- LazyLoad（画面に表示されるものだけレンダリング）
- ポリゴンの簡略化（PostGISの `ST_Simplify`）

### リスク4: データ移行

**リスク**: GASのスプレッドシートからSupabaseへのデータ移行で損失

**対策**:
- 移行スクリプトの段階的テスト
- ロールバック計画の策定
- 移行前のバックアップ

---

## 8. 次のステップ

この実装計画が承認されたら、以下の順序で実装を進めます：

1. **逆オークション計算ロジック**の実装（`src/lib/calculator/priceCalculator.ts`）
2. **地図・面積計算**の実装（`src/lib/geo/areaCalculator.ts`、`src/components/map/PolygonDrawer.tsx`）
3. **申込処理**の実装（`supabase/functions/create_application_with_lock.sql`、`src/app/api/applications/create/route.ts`）

各実装には必ず単体テストを追加し、品質を担保します。

---

**作成者**: Claude Code (Sonnet 4.5)
**レビュワー**: （承認待ち）
