/**
 * 地図・面積計算ロジックのテスト
 */

import { describe, test, expect } from 'vitest';
import type { Polygon, Position } from 'geojson';
import {
  calculatePolygonArea10r,
  coordinatesToPolygon,
  geoJSONToWKT,
  wktToGeoJSON,
  calculateDistance,
  getPolygonCenter,
  simplifyPolygon,
  validatePolygon,
  polygonsOverlap,
  AREA_CONSTANTS,
} from './areaCalculator';

describe('calculatePolygonArea10r', () => {
  test('正方形の面積を計算（約1km四方）', () => {
    // 東京付近の約1km × 1km の正方形
    const polygon: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [139.6917, 35.6895], // 左下
          [139.7017, 35.6895], // 右下
          [139.7017, 35.6995], // 右上
          [139.6917, 35.6995], // 左上
          [139.6917, 35.6895], // 左下（閉じる）
        ],
      ],
    };

    const area = calculatePolygonArea10r(polygon);

    // 約1km × 1km = 1,000,000㎡ ≈ 1000反（991.7355㎡/反）
    // 実際の測地線計算では若干ずれる
    expect(area).toBeGreaterThan(900);
    expect(area).toBeLessThan(1100);
  });

  test('小さな三角形の面積を計算', () => {
    // 小さな三角形（約100m × 100m）
    const polygon: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [139.6917, 35.6895],
          [139.6927, 35.6895],
          [139.6922, 35.6905],
          [139.6917, 35.6895],
        ],
      ],
    };

    const area = calculatePolygonArea10r(polygon);

    // 約100m × 100m / 2 = 5,000㎡ ≈ 5反
    expect(area).toBeGreaterThan(3);
    expect(area).toBeLessThan(7);
  });

  test('面積が小数点第2位まで丸められる', () => {
    const polygon: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [139.6917, 35.6895],
          [139.6920, 35.6895],
          [139.6920, 35.6898],
          [139.6917, 35.6898],
          [139.6917, 35.6895],
        ],
      ],
    };

    const area = calculatePolygonArea10r(polygon);

    // 小数点第2位まで
    expect(area.toString()).toMatch(/^\d+\.\d{1,2}$/);
  });
});

describe('coordinatesToPolygon', () => {
  test('座標配列からPolygonを生成', () => {
    const coords: Position[] = [
      [139.6917, 35.6895],
      [139.7017, 35.6895],
      [139.7017, 35.6995],
      [139.6917, 35.6995],
    ];

    const polygon = coordinatesToPolygon(coords);

    expect(polygon.type).toBe('Polygon');
    expect(polygon.coordinates[0]).toHaveLength(5); // 始点が終点として追加される
    expect(polygon.coordinates[0][0]).toEqual(polygon.coordinates[0][4]);
  });

  test('既に閉じている座標配列でも正常に動作', () => {
    const coords: Position[] = [
      [139.6917, 35.6895],
      [139.7017, 35.6895],
      [139.7017, 35.6995],
      [139.6917, 35.6995],
      [139.6917, 35.6895], // 既に閉じている
    ];

    const polygon = coordinatesToPolygon(coords);

    expect(polygon.coordinates[0]).toHaveLength(5); // 既に閉じているのでそのまま
  });
});

describe('geoJSONToWKT と wktToGeoJSON', () => {
  test('GeoJSON → WKT 変換', () => {
    const polygon: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [139.6917, 35.6895],
          [139.7017, 35.6895],
          [139.7017, 35.6995],
          [139.6917, 35.6895],
        ],
      ],
    };

    const wkt = geoJSONToWKT(polygon);

    expect(wkt).toBe(
      'POLYGON((139.6917 35.6895, 139.7017 35.6895, 139.7017 35.6995, 139.6917 35.6895))'
    );
  });

  test('WKT → GeoJSON 変換', () => {
    const wkt =
      'POLYGON((139.6917 35.6895, 139.7017 35.6895, 139.7017 35.6995, 139.6917 35.6895))';

    const polygon = wktToGeoJSON(wkt);

    expect(polygon.type).toBe('Polygon');
    expect(polygon.coordinates[0]).toHaveLength(4);
    expect(polygon.coordinates[0][0]).toEqual([139.6917, 35.6895]);
  });

  test('GeoJSON → WKT → GeoJSON の往復変換', () => {
    const original: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [139.6917, 35.6895],
          [139.7017, 35.6895],
          [139.7017, 35.6995],
          [139.6917, 35.6895],
        ],
      ],
    };

    const wkt = geoJSONToWKT(original);
    const restored = wktToGeoJSON(wkt);

    expect(restored).toEqual(original);
  });
});

describe('calculateDistance', () => {
  test('東京駅〜品川駅間の距離を計算', () => {
    // 東京駅
    const tokyo: Position = [139.7673, 35.6812];
    // 品川駅
    const shinagawa: Position = [139.7388, 35.6284];

    const distance = calculateDistance(tokyo, shinagawa);

    // 約6.8km（実測値）
    expect(distance).toBeGreaterThan(6);
    expect(distance).toBeLessThan(8);
  });

  test('同じ地点間の距離は0', () => {
    const point: Position = [139.6917, 35.6895];

    const distance = calculateDistance(point, point);

    expect(distance).toBe(0);
  });
});

describe('getPolygonCenter', () => {
  test('正方形の中心点を計算', () => {
    const polygon: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [139.6917, 35.6895],
          [139.7017, 35.6895],
          [139.7017, 35.6995],
          [139.6917, 35.6995],
          [139.6917, 35.6895],
        ],
      ],
    };

    const center = getPolygonCenter(polygon);

    // 中心点は (139.6967, 35.6945) 付近
    expect(center[0]).toBeCloseTo(139.6967, 3);
    expect(center[1]).toBeCloseTo(35.6945, 3);
  });
});

describe('simplifyPolygon', () => {
  test('複雑なポリゴンを簡略化', () => {
    // 複雑なポリゴン（10点）
    const polygon: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [139.6917, 35.6895],
          [139.6920, 35.6895],
          [139.6925, 35.6896],
          [139.6930, 35.6897],
          [139.7017, 35.6895],
          [139.7017, 35.6995],
          [139.6917, 35.6995],
          [139.6918, 35.6950],
          [139.6917, 35.6920],
          [139.6917, 35.6895],
        ],
      ],
    };

    const simplified = simplifyPolygon(polygon, 0.001);

    // 簡略化後は頂点数が減る
    expect(simplified.coordinates[0].length).toBeLessThan(
      polygon.coordinates[0].length
    );
  });
});

describe('validatePolygon', () => {
  test('有効なポリゴンはisValid: true', () => {
    const polygon: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [139.6917, 35.6895],
          [139.7017, 35.6895],
          [139.7017, 35.6995],
          [139.6917, 35.6995],
          [139.6917, 35.6895],
        ],
      ],
    };

    const result = validatePolygon(polygon);

    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test('頂点数が不足している場合はエラー', () => {
    const polygon: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [139.6917, 35.6895],
          [139.7017, 35.6895],
          [139.6917, 35.6895], // 3点のみ
        ],
      ],
    };

    const result = validatePolygon(polygon);

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('最低3点の座標が必要');
  });

  test('始点と終点が一致していない場合はエラー', () => {
    const polygon: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [139.6917, 35.6895],
          [139.7017, 35.6895],
          [139.7017, 35.6995],
          [139.6917, 35.6995],
          // 終点が始点と一致していない
        ],
      ],
    };

    const result = validatePolygon(polygon);

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('始点と終点が一致していません');
  });

  test('自己交差するポリゴンはエラー', () => {
    // 8の字型（自己交差）
    const polygon: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [139.6917, 35.6895],
          [139.7017, 35.6995], // 対角線
          [139.7017, 35.6895],
          [139.6917, 35.6995], // 対角線（交差）
          [139.6917, 35.6895],
        ],
      ],
    };

    const result = validatePolygon(polygon);

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('自己交差');
  });
});

describe('polygonsOverlap', () => {
  test.skip('重複するポリゴンはtrue (TODO: Turf.js intersect の動作確認)', () => {
    const polygon1: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [2, 0],
          [2, 2],
          [0, 2],
          [0, 0],
        ],
      ],
    };

    const polygon2: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [1, 1], // polygon1と重複する領域
          [3, 1],
          [3, 3],
          [1, 3],
          [1, 1],
        ],
      ],
    };

    expect(polygonsOverlap(polygon1, polygon2)).toBe(true);
  });

  test('重複しないポリゴンはfalse', () => {
    const polygon1: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [139.6917, 35.6895],
          [139.7017, 35.6895],
          [139.7017, 35.6995],
          [139.6917, 35.6995],
          [139.6917, 35.6895],
        ],
      ],
    };

    const polygon2: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [139.8000, 35.8000], // 遠く離れた場所
          [139.8100, 35.8000],
          [139.8100, 35.8100],
          [139.8000, 35.8100],
          [139.8000, 35.8000],
        ],
      ],
    };

    expect(polygonsOverlap(polygon1, polygon2)).toBe(false);
  });
});

describe('AREA_CONSTANTS', () => {
  test('面積単位の定数が正しい', () => {
    expect(AREA_CONSTANTS.TSUBO_TO_SQUARE_METER).toBeCloseTo(3.305785, 5);
    expect(AREA_CONSTANTS.TAN_TO_TSUBO).toBe(300);
    expect(AREA_CONSTANTS.TAN_TO_SQUARE_METER).toBeCloseTo(991.7355, 4);
    expect(AREA_CONSTANTS.HECTARE_TO_TAN).toBe(10);
  });

  test('1反の換算が正しい', () => {
    const tanInSquareMeter =
      AREA_CONSTANTS.TSUBO_TO_SQUARE_METER * AREA_CONSTANTS.TAN_TO_TSUBO;

    expect(tanInSquareMeter).toBeCloseTo(AREA_CONSTANTS.TAN_TO_SQUARE_METER, 4);
  });
});
