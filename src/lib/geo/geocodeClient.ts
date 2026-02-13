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

/**
 * 逆ジオコーディング（緯度・経度 → 住所）
 * サーバー API 経由で実行
 */
export async function reverseGeocodeViaApi(lat: number, lng: number): Promise<GeocodeResult | null> {
  if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) return null;

  const res = await fetch(`/api/geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`);
  if (res.status === 404 || !res.ok) return null;

  const data = await res.json();
  if (typeof data?.lat !== 'number' || typeof data?.lng !== 'number') return null;

  return {
    lat: data.lat,
    lng: data.lng,
    displayName: data.displayName,
  };
}
