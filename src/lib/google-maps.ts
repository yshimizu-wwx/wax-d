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

/** 日本住所らしいか（郡・町・市・区など含む） */
function isLikelyJapaneseAddress(q: string): boolean {
  return /[一-龥ぁ-んァ-ン]/.test(q) || /県|府|都|道|郡|町|村|市|区/.test(q);
}

/** 番地の区切りを ASCII ハイフンに統一（2307ー3 → 2307-3）。呼び出し元で未適用の場合に備える */
function normalizeAddressHyphens(s: string): string {
  return s.replace(/(\d)\s*[－ー]\s*(\d)/g, '$1-$2');
}

/** 末尾の番地（数字・ハイフン）を除いた地域名を返す */
function stripBanchi(addr: string): string {
  return addr.replace(/\s*[\d０-９\-－ー]+\s*$/, '').trim();
}

function parseGoogleGeocodeResponse(data: {
  status?: string;
  results?: Array<{ geometry?: { location?: { lat: number; lng: number } }; formatted_address?: string }>;
}): GeocodeResult | null {
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') return null;
  if (!data.results?.length) return null;
  const first = data.results[0];
  const loc = first.geometry?.location;
  if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return null;
  return { lat: loc.lat, lng: loc.lng, displayName: first.formatted_address };
}

/**
 * Google Geocoding API で住所をジオコーディングする。
 * 日本国内に特化するため region=jp, language=ja を指定。
 * ヒットしない場合は「, 日本」を付けて再試行する。
 */
export async function geocodeWithGoogle(address: string): Promise<GeocodeResult | null> {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key?.trim()) return null;

  const trimmed = address?.trim();
  if (!trimmed) return null;

  const normalized = normalizeAddressHyphens(trimmed);

  const tryRequest = async (addr: string): Promise<GeocodeResult | null> => {
    try {
      const params = new URLSearchParams({
        address: addr,
        key,
        region: 'jp',
        language: 'ja',
      });
      const res = await fetch(`${GEOCODE_URL}?${params.toString()}`);
      if (!res.ok) return null;
      const data = await res.json();
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/18abc857-b9fe-472f-879d-ab424fec0177', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'google-maps.ts', message: 'Google geocode response', data: { status: data?.status, resultsCount: data?.results?.length ?? 0 }, timestamp: Date.now(), hypothesisId: 'H6_google_response' }) }).catch(() => {});
      // #endregion
      if (data?.status === 'REQUEST_DENIED') {
        throw new Error('GOOGLE_REQUEST_DENIED');
      }
      return parseGoogleGeocodeResponse(data);
    } catch (e) {
      if ((e as Error)?.message === 'GOOGLE_REQUEST_DENIED') throw e;
      return null;
    }
  };

  try {
    let result = await tryRequest(normalized);

    if (!result && isLikelyJapaneseAddress(normalized) && !/日本|Japan/i.test(normalized)) {
      result = await tryRequest(`${normalized}, 日本`);
    }

    if (!result && /^利根郡/.test(normalized)) {
      result = await tryRequest(`群馬県${normalized}`);
      if (!result) result = await tryRequest(`群馬県${normalized}, 日本`);
    }

    if (!result) {
      const withoutBanchi = stripBanchi(normalized);
      if (withoutBanchi.length >= 2 && withoutBanchi !== normalized) {
        result = await tryRequest(withoutBanchi);
        if (!result && !/日本|Japan/i.test(withoutBanchi)) {
          result = await tryRequest(`${withoutBanchi}, 日本`);
        }
      }
    }

    return result;
  } catch (e) {
    if ((e as Error)?.message === 'GOOGLE_REQUEST_DENIED') return null;
    throw e;
  }
}

/**
 * 緯度・経度から住所を取得（逆ジオコーディング）
 * 環境変数 NEXT_PUBLIC_GOOGLE_MAPS_API_KEY が設定されている場合に利用可能
 */
export async function reverseGeocodeWithGoogle(lat: number, lng: number): Promise<GeocodeResult | null> {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key?.trim()) return null;

  try {
    const params = new URLSearchParams({
      latlng: `${lat},${lng}`,
      key,
      language: 'ja',
    });
    const res = await fetch(`${GEOCODE_URL}?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    return parseGoogleGeocodeResponse(data);
  } catch {
    return null;
  }
}
