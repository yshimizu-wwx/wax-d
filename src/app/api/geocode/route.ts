import { NextRequest, NextResponse } from 'next/server';
import { geocodeAddress, reverseGeocodeAddress } from '@/lib/geo/geocode';

/**
 * ジオコーディング API
 * - GET /api/geocode?address=住所 → 正ジオコード（住所→緯度経度）
 * - GET /api/geocode?lat=35.68&lng=139.76 → 逆ジオコード（緯度経度→住所）
 */
export async function GET(request: NextRequest) {
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/18abc857-b9fe-472f-879d-ab424fec0177', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'api/geocode/route.ts', message: 'GET handler entered', data: { pathname: request.nextUrl.pathname }, timestamp: Date.now(), hypothesisId: 'H2_route_hit' }) }).catch(() => {});
  // #endregion
  const address = request.nextUrl.searchParams.get('address');
  const latParam = request.nextUrl.searchParams.get('lat');
  const lngParam = request.nextUrl.searchParams.get('lng');

  // 逆ジオコード
  if (latParam != null && lngParam != null) {
    const lat = parseFloat(latParam);
    const lng = parseFloat(lngParam);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return NextResponse.json({ error: 'lat, lng は数値で指定してください' }, { status: 400 });
    }
    try {
      const result = await reverseGeocodeAddress(lat, lng);
      if (!result) {
        return NextResponse.json({ error: '住所が見つかりませんでした' }, { status: 404 });
      }
      return NextResponse.json({
        lat: result.lat,
        lng: result.lng,
        displayName: result.displayName,
      });
    } catch (e) {
      console.error('[geocode reverse]', e);
      return NextResponse.json({ error: '検索に失敗しました' }, { status: 500 });
    }
  }

  // 正ジオコード
  if (!address?.trim()) {
    return NextResponse.json({ error: 'address を指定するか、lat と lng を指定してください' }, { status: 400 });
  }

  const trimmedAddress = address.trim();
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/18abc857-b9fe-472f-879d-ab424fec0177', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'api/geocode/route.ts', message: 'before geocodeAddress', data: { addressLength: trimmedAddress.length }, timestamp: Date.now(), hypothesisId: 'H3_params' }) }).catch(() => {});
  // #endregion
  try {
    const result = await geocodeAddress(trimmedAddress);
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/18abc857-b9fe-472f-879d-ab424fec0177', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'api/geocode/route.ts', message: 'after geocodeAddress', data: { hasResult: !!result }, timestamp: Date.now(), hypothesisId: 'H3_geocode_result' }) }).catch(() => {});
    // #endregion
    if (!result) {
      return NextResponse.json({ error: '住所が見つかりませんでした' }, { status: 404 });
    }
    return NextResponse.json({
      lat: result.lat,
      lng: result.lng,
      displayName: result.displayName,
    });
  } catch (e) {
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/18abc857-b9fe-472f-879d-ab424fec0177', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'api/geocode/route.ts', message: 'geocodeAddress threw', data: { error: String((e as Error).message) }, timestamp: Date.now(), hypothesisId: 'H4_throw' }) }).catch(() => {});
    // #endregion
    console.error('[geocode]', e);
    return NextResponse.json({ error: '検索に失敗しました' }, { status: 500 });
  }
}
