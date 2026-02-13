/**
 * 住所 → 緯度・経度のジオコーディング
 * - NEXT_PUBLIC_GOOGLE_MAPS_API_KEY が設定されていれば Google Geocoding API を優先
 * - 未設定時は OpenStreetMap Nominatim を使用
 * Nominatim 利用ポリシー: https://operations.osmfoundation.org/policies/nominatim/
 */

import { geocodeWithGoogle } from '@/lib/google-maps';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'WayfinderAgriX/1.0 (Agricultural field mapping)';

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName?: string;
}

/** 日本国内の住所と判断するか（日本語含む、または Japan/日本 が無い） */
function isLikelyJapaneseAddress(q: string): boolean {
  const s = q.trim();
  if (/日本|Japan|にほん|ニホン/i.test(s)) return true;
  // 都道府県・郡・町・村・市・区 などが含まれる、または非ASCII（日本語）が含まれる
  if (/[一-龥ぁ-んァ-ン]/.test(s)) return true;
  if (/県|府|都|道|郡|町|村|市|区|丁目|番地/.test(s)) return true;
  return false;
}

/** クエリをNominatimでヒットしやすくする（日本に限定して補正） */
function normalizeQueryForJapan(q: string): string {
  const s = q.trim();
  if (!isLikelyJapaneseAddress(s)) return s;
  if (/日本|Japan/i.test(s)) return s;
  return `${s}, Japan`;
}

/**
 * 住所文字列をジオコーディングし、緯度・経度を返す。
 * 見つからない場合は null。
 * Google API キーがあれば Google を優先（日本向け region=jp）。なければ Nominatim。
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const trimmed = address?.trim();
  if (!trimmed) return null;

  if (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    try {
      const googleResult = await geocodeWithGoogle(trimmed);
      if (googleResult) return { lat: googleResult.lat, lng: googleResult.lng, displayName: googleResult.displayName };
    } catch {
      /* フォールバックで Nominatim を試す */
    }
  }

  const query = normalizeQueryForJapan(trimmed);
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '1',
    addressdetails: '0',
  });
  // 日本国内に限定して検索精度を上げる
  params.set('countrycodes', 'jp');

  const doRequest = async (): Promise<GeocodeResult | null> => {
    const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const first = data[0];
    const lat = parseFloat(first.lat);
    const lng = parseFloat(first.lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return {
      lat,
      lng,
      displayName: first.display_name,
    };
  };

  let result = await doRequest();
  // 補正クエリでヒットしなかった場合、元の文字列のみで再試行（countrycodes=jp は維持）
  if (!result && query !== trimmed) {
    params.set('q', trimmed);
    await new Promise((r) => setTimeout(r, 1100)); // Nominatim 1req/sec を考慮
    result = await doRequest();
  }
  // まだヒットしない場合：番地を除いた地域名で再検索
  if (!result && isLikelyJapaneseAddress(trimmed)) {
    const withoutNumber = trimmed.replace(/\s*[\d０-９\-－ー]+\s*$/, '').trim();
    if (withoutNumber && withoutNumber.length >= 2) {
      params.set('q', normalizeQueryForJapan(withoutNumber));
      await new Promise((r) => setTimeout(r, 1100));
      result = await doRequest();
    }
  }
  // 利根郡は群馬県なので、県名を付けて再試行
  if (!result && /^利根郡/.test(trimmed)) {
    params.set('q', normalizeQueryForJapan(`群馬県${trimmed}`));
    await new Promise((r) => setTimeout(r, 1100));
    result = await doRequest();
    if (!result) {
      const withoutNumber = trimmed.replace(/\s*[\d０-９\-－ー]+\s*$/, '').trim();
      if (withoutNumber.length >= 2) {
        params.set('q', normalizeQueryForJapan(`群馬県${withoutNumber}`));
        await new Promise((r) => setTimeout(r, 1100));
        result = await doRequest();
      }
    }
  }
  return result;
}

/**
 * 緯度・経度から住所を取得（逆ジオコーディング）
 * サーバー側で Google を使用（キー設定時）。クライアントは /api/geocode?lat=&lng= 経由で利用
 */
export async function reverseGeocodeAddress(lat: number, lng: number): Promise<GeocodeResult | null> {
  if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) return null;

  if (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    try {
      const { reverseGeocodeWithGoogle } = await import('@/lib/google-maps');
      return reverseGeocodeWithGoogle(lat, lng);
    } catch {
      /* フォールバックなし（Nominatim 逆ジオコードは別実装可） */
    }
  }
  return null;
}
