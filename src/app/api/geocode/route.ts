import { NextRequest, NextResponse } from 'next/server';
import { geocodeAddress, reverseGeocodeAddress } from '@/lib/geo/geocode';

/**
 * ジオコーディング API
 * - GET /api/geocode?address=住所 → 正ジオコード（住所→緯度経度）
 * - GET /api/geocode?lat=35.68&lng=139.76 → 逆ジオコード（緯度経度→住所）
 */
export async function GET(request: NextRequest) {
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

  try {
    const result = await geocodeAddress(address.trim());
    if (!result) {
      return NextResponse.json({ error: '住所が見つかりませんでした' }, { status: 404 });
    }
    return NextResponse.json({
      lat: result.lat,
      lng: result.lng,
      displayName: result.displayName,
    });
  } catch (e) {
    console.error('[geocode]', e);
    return NextResponse.json({ error: '検索に失敗しました' }, { status: 500 });
  }
}
