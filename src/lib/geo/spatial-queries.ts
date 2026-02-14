/**
 * 空間クエリ: 畑と案件ポリゴンの重なり・包含判定
 * 農家が「自分の畑が含まれる案件」を地図上で探すために使用
 */

import * as turf from '@turf/turf';
import type { Polygon } from 'geojson';
import { wktToGeoJSON, polygonsOverlap } from '@/lib/geo/areaCalculator';

/**
 * 案件のポリゴン（WKT または GeoJSON）を GeoJSON Polygon に正規化する
 */
export function parseCampaignPolygon(
  raw: string | null | undefined | unknown
): Polygon | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (trimmed.toUpperCase().startsWith('POLYGON')) {
      try {
        return wktToGeoJSON(trimmed);
      } catch {
        return null;
      }
    }
    // DBが GeoJSON を文字列で返す場合（例: Supabase の geometry 出力）
    if (trimmed.startsWith('{')) {
      try {
        const obj = JSON.parse(trimmed) as { type?: string; coordinates?: unknown };
        if (obj?.type === 'Polygon' && Array.isArray(obj?.coordinates)) {
          return obj as Polygon;
        }
      } catch {
        /* ignore */
      }
    }
    return null;
  }
  if (typeof raw === 'object' && raw !== null && 'type' in raw && 'coordinates' in raw) {
    const obj = raw as { type: string; coordinates: unknown };
    if (obj.type === 'Polygon' && Array.isArray(obj.coordinates)) {
      return obj as Polygon;
    }
  }
  return null;
}

/**
 * 畑の位置（緯度・経度）が案件ポリゴン内にあるか判定（点とポリゴン）
 */
export function isPointInCampaignPolygon(
  lat: number,
  lng: number,
  polygonWktOrGeoJSON: string | Polygon | null | undefined
): boolean {
  const polygon = typeof polygonWktOrGeoJSON === 'string' || polygonWktOrGeoJSON == null
    ? parseCampaignPolygon(polygonWktOrGeoJSON)
    : polygonWktOrGeoJSON;
  if (!polygon) return false;
  const pt = turf.point([lng, lat]);
  const poly = turf.polygon(polygon.coordinates);
  return Boolean(turf.booleanPointInPolygon(pt, poly));
}

/**
 * 畑が案件エリアと重なるか判定
 * - 畑に lat/lng のみある場合は点とポリゴンの包含
 * - 畑に area_coordinates（ポリゴン）がある場合はポリゴン同士の重なり
 */
export function isFieldInCampaignArea(
  field: { lat?: number | null; lng?: number | null; area_coordinates?: string | null | unknown },
  campaignPolygon: Polygon | string | null | undefined
): boolean {
  const polygon = typeof campaignPolygon === 'string' || campaignPolygon == null
    ? parseCampaignPolygon(campaignPolygon)
    : campaignPolygon;
  if (!polygon) return false;

  const lat = field.lat != null ? Number(field.lat) : null;
  const lng = field.lng != null ? Number(field.lng) : null;

  if (lat != null && lng != null) {
    return isPointInCampaignPolygon(lat, lng, polygon);
  }

  if (field.area_coordinates) {
    try {
      const fieldPoly = parseCampaignPolygon(field.area_coordinates);
      if (fieldPoly) return polygonsOverlap(fieldPoly, polygon);
    } catch {
      // ignore
    }
  }
  return false;
}
