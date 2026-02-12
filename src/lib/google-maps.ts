/**
 * Google Maps Geocoding API を用いた住所→座標変換
 * 環境変数 NEXT_PUBLIC_GOOGLE_MAPS_API_KEY が設定されている場合に利用可能
 */

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName?: string;
}

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

/**
 * Google Geocoding API で住所をジオコーディングする。
 * 日本国内に特化するため region=jp, language=ja を指定。
 * 複数結果の場合は先頭（関連度が高い）を使用する。
 */
export async function geocodeWithGoogle(address: string): Promise<GeocodeResult | null> {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key?.trim()) return null;

  const trimmed = address?.trim();
  if (!trimmed) return null;

  const params = new URLSearchParams({
    address: trimmed,
    key,
    region: 'jp',
    language: 'ja',
  });

  const res = await fetch(`${GEOCODE_URL}?${params.toString()}`);
  if (!res.ok) return null;

  const data = await res.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') return null;
  if (!data.results?.length) return null;

  const first = data.results[0];
  const loc = first.geometry?.location;
  if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return null;

  return {
    lat: loc.lat,
    lng: loc.lng,
    displayName: first.formatted_address,
  };
}
