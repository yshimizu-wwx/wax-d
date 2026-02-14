/**
 * 地図・面積計算ロジック
 *
 * Turf.jsを使用してポリゴンの面積を「反（10R）」単位で計算
 */

import * as turf from '@turf/turf';
import type { Polygon, Position } from 'geojson';

/**
 * 面積単位の定数
 */
export const AREA_CONSTANTS = {
  /** 1坪 = 3.305785㎡ */
  TSUBO_TO_SQUARE_METER: 3.305785,

  /** 1反 = 300坪 */
  TAN_TO_TSUBO: 300,

  /** 1反 = 991.7355㎡ */
  TAN_TO_SQUARE_METER: 991.7355,

  /** 1ヘクタール = 10反 */
  HECTARE_TO_TAN: 10,
} as const;

/**
 * ポリゴンの面積を「反（10R）」単位で計算
 *
 * @param polygon - GeoJSON形式のポリゴン
 * @returns 面積（反単位、小数点第2位まで）
 *
 * @example
 * const polygon = {
 *   type: 'Polygon',
 *   coordinates: [[
 *     [139.6917, 35.6895],
 *     [139.7017, 35.6895],
 *     [139.7017, 35.6995],
 *     [139.6917, 35.6995],
 *     [139.6917, 35.6895]
 *   ]]
 * };
 * const area = calculatePolygonArea10r(polygon);
 * // => 約100.5（反）
 */
export function calculatePolygonArea10r(polygon: Polygon): number {
  // Turf.jsで面積を平方メートルで計算（測地線計算）
  const areaInSquareMeters = turf.area(polygon) as number;

  // 1反 = 991.7355㎡ で換算
  const area10r = areaInSquareMeters / AREA_CONSTANTS.TAN_TO_SQUARE_METER;

  // 小数点第1位で四捨五入（Issue #16: UX のため細かすぎる表示を避ける）
  return Math.round(area10r * 10) / 10;
}

/**
 * 座標配列からGeoJSON Polygonを生成
 *
 * @param coordinates - 座標配列 [[lng, lat], ...]
 * @returns GeoJSON Polygon
 *
 * @example
 * const coords = [
 *   [139.6917, 35.6895],
 *   [139.7017, 35.6895],
 *   [139.7017, 35.6995],
 *   [139.6917, 35.6995]
 * ];
 * const polygon = coordinatesToPolygon(coords);
 */
export function coordinatesToPolygon(coordinates: Position[]): Polygon {
  // 始点と終点を一致させる（GeoJSON仕様）
  const coords = [...coordinates];

  // 既に閉じている場合はそのまま返す
  const isClosed =
    coords.length >= 4 &&
    coords[0][0] === coords[coords.length - 1][0] &&
    coords[0][1] === coords[coords.length - 1][1];

  if (!isClosed) {
    coords.push(coords[0]);
  }

  return {
    type: 'Polygon',
    coordinates: [coords],
  };
}

/**
 * Leaflet.drawのレイヤーからGeoJSON Polygonを生成
 *
 * @param layer - Leaflet.drawのレイヤーオブジェクト
 * @returns GeoJSON Polygon
 *
 * @example
 * // Leaflet.drawのcreatedイベントで取得したレイヤー
 * const layer = e.layer;
 * const polygon = leafletLayerToGeoJSON(layer);
 */
interface LeafletLatLng {
  lat: number;
  lng: number;
}
/** Leaflet.draw の CREATED イベントで取得できるレイヤー形状（getLatLngs を持つ） */
export interface LeafletDrawLayer {
  getLatLngs(): LeafletLatLng[][];
}
export function leafletLayerToGeoJSON(layer: LeafletDrawLayer): Polygon {
  // Leafletのレイヤーから座標を取得
  const latLngs = layer.getLatLngs()[0]; // 外周のみ取得

  // [lng, lat]形式に変換
  const coordinates: Position[] = latLngs.map((latLng: LeafletLatLng) => [
    latLng.lng,
    latLng.lat,
  ]);

  return coordinatesToPolygon(coordinates);
}

/**
 * PostGISのWKT（Well-Known Text）形式に変換
 *
 * @param polygon - GeoJSON Polygon
 * @returns WKT形式の文字列
 *
 * @example
 * const wkt = geoJSONToWKT(polygon);
 * // => "POLYGON((139.6917 35.6895, 139.7017 35.6895, ...))"
 */
export function geoJSONToWKT(polygon: Polygon): string {
  const coords = polygon.coordinates[0]
    .map(([lng, lat]) => `${lng} ${lat}`)
    .join(', ');

  return `POLYGON((${coords}))`;
}

/**
 * PostGISのWKT形式からGeoJSON Polygonに変換
 *
 * @param wkt - WKT形式の文字列
 * @returns GeoJSON Polygon
 *
 * @example
 * const polygon = wktToGeoJSON("POLYGON((139.6917 35.6895, ...))");
 */
export function wktToGeoJSON(wkt: string): Polygon {
  // "POLYGON((...))" から座標部分を抽出
  const coordsStr = wkt
    .replace(/^POLYGON\(\(/, '')
    .replace(/\)\)$/, '');

  const coordinates: Position[] = coordsStr
    .split(', ')
    .map((pair) => {
      const [lng, lat] = pair.split(' ').map(Number);
      return [lng, lat];
    });

  return {
    type: 'Polygon',
    coordinates: [coordinates],
  };
}

/**
 * 2点間の距離を計算（Haversine公式）
 *
 * @param point1 - 地点1 [lng, lat]
 * @param point2 - 地点2 [lng, lat]
 * @returns 距離（km）
 *
 * @example
 * const distance = calculateDistance(
 *   [139.6917, 35.6895],
 *   [139.7017, 35.6995]
 * );
 * // => 約1.4 (km)
 */
export function calculateDistance(
  point1: Position,
  point2: Position
): number {
  const from = turf.point(point1);
  const to = turf.point(point2);

  // Turf.jsのdistance関数（デフォルトでkm単位）
  return turf.distance(from, to, { units: 'kilometers' }) as number;
}

/**
 * ポリゴンの中心点を計算
 *
 * @param polygon - GeoJSON Polygon
 * @returns 中心点 [lng, lat]
 *
 * @example
 * const center = getPolygonCenter(polygon);
 * // => [139.6967, 35.6945]
 */
export function getPolygonCenter(polygon: Polygon): Position {
  const center = turf.center(polygon) as { geometry: { coordinates: Position } };
  return center.geometry.coordinates;
}

/**
 * ポリゴンを簡略化（頂点数を削減）
 *
 * @param polygon - GeoJSON Polygon
 * @param tolerance - 許容誤差（デフォルト0.0001）
 * @returns 簡略化されたPolygon
 *
 * @example
 * const simplified = simplifyPolygon(polygon, 0.001);
 */
export function simplifyPolygon(
  polygon: Polygon,
  tolerance: number = 0.0001
): Polygon {
  const feature = turf.feature(polygon);
  const simplified = turf.simplify(feature, {
    tolerance,
    highQuality: true,
  }) as { geometry: Polygon };

  return simplified.geometry;
}

/**
 * ポリゴンが有効かどうかを検証
 *
 * @param polygon - GeoJSON Polygon
 * @returns 検証結果
 *
 * @example
 * const validation = validatePolygon(polygon);
 * if (!validation.isValid) {
 *   console.error(validation.error);
 * }
 */
export function validatePolygon(polygon: Polygon): {
  isValid: boolean;
  error?: string;
} {
  try {
    // 最低3点（+ 始点の重複）= 4点必要
    if (polygon.coordinates[0].length < 4) {
      return {
        isValid: false,
        error: 'ポリゴンには最低3点の座標が必要です',
      };
    }

    // 始点と終点が一致しているか
    const first = polygon.coordinates[0][0];
    const last = polygon.coordinates[0][polygon.coordinates[0].length - 1];

    if (first[0] !== last[0] || first[1] !== last[1]) {
      return {
        isValid: false,
        error: '始点と終点が一致していません',
      };
    }

    // 自己交差チェック
    const kinks = turf.kinks(polygon) as { features: unknown[] };
    if (kinks.features.length > 0) {
      return {
        isValid: false,
        error: 'ポリゴンが自己交差しています',
      };
    }

    // 面積が0でないか
    const area = turf.area(polygon) as number;
    if (area === 0) {
      return {
        isValid: false,
        error: 'ポリゴンの面積が0です',
      };
    }

    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : '不明なエラー',
    };
  }
}

/**
 * 複数のポリゴンが重複しているかチェック
 *
 * @param polygon1 - ポリゴン1
 * @param polygon2 - ポリゴン2
 * @returns 重複している場合true
 */
export function polygonsOverlap(
  polygon1: Polygon,
  polygon2: Polygon
): boolean {
  try {
    const feature1 = turf.polygon(polygon1.coordinates);
    const feature2 = turf.polygon(polygon2.coordinates);

    const intersection = turf.intersect(feature1, feature2);

    return intersection !== null && intersection !== undefined;
  } catch {
    return false;
  }
}
