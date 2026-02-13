/**
 * クライアント用: サーバー API 経由でジオコーディング
 * （キー制限・CORS を避け、サーバー側で Google / Nominatim を実行）
 */

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName?: string;
}

export async function geocodeAddressViaApi(address: string): Promise<GeocodeResult | null> {
  const trimmed = address?.trim();
  if (!trimmed) return null;

  const res = await fetch(`/api/geocode?address=${encodeURIComponent(trimmed)}`);
  if (res.status === 404 || !res.ok) return null;

  const data = await res.json();
  if (typeof data?.lat !== 'number' || typeof data?.lng !== 'number') return null;

  return {
    lat: data.lat,
    lng: data.lng,
    displayName: data.displayName,
  };
}

/** 同一セッション内で逆ジオコード結果をキャッシュ（API呼び出し回数削減） */
const reverseGeocodeCache = new Map<string, GeocodeResult>();

function reverseGeocodeCacheKey(lat: number, lng: number): string {
  return `${Math.round(lat * 1e5)},${Math.round(lng * 1e5)}`;
}

/**
 * 逆ジオコーディング（緯度・経度 → 住所）
 * サーバー API 経由で実行。同一座標はセッション内キャッシュを返す。
 */
export async function reverseGeocodeViaApi(lat: number, lng: number): Promise<GeocodeResult | null> {
  if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) return null;

  const key = reverseGeocodeCacheKey(lat, lng);
  const cached = reverseGeocodeCache.get(key);
  if (cached) return cached;

  const res = await fetch(`/api/geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`);
  if (res.status === 404 || !res.ok) return null;

  const data = await res.json();
  if (typeof data?.lat !== 'number' || typeof data?.lng !== 'number') return null;

  const result: GeocodeResult = {
    lat: data.lat,
    lng: data.lng,
    displayName: data.displayName,
  };
  reverseGeocodeCache.set(key, result);
  return result;
}
