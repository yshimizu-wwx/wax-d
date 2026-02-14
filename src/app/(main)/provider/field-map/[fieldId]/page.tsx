'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';
import { MapPin, ArrowLeft, ExternalLink, Navigation } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { parseCampaignPolygon } from '@/lib/geo/spatial-queries';
import { getPolygonCenter } from '@/lib/geo/areaCalculator';
import type { Polygon } from 'geojson';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface FieldData {
  id: string;
  name: string | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  area_coordinates: unknown;
}

declare global {
  interface Window {
    google?: {
      maps: {
        Map: new (el: HTMLElement, opts?: object) => {
          fitBounds: (bounds: unknown, padding?: number) => void;
        };
        LatLngBounds: new () => {
          extend: (p: { lat: number; lng: number }) => void;
        };
        SymbolPath: { CIRCLE: unknown };
        Marker: new (opts: {
          position: { lat: number; lng: number };
          map?: unknown;
          label?: { text: string; color?: string; fontWeight?: string; fontSize?: string };
          icon?: unknown;
        }) => { setMap: (map: unknown) => void };
        Polygon: new (opts: {
          paths: { lat: number; lng: number }[];
          strokeColor?: string;
          strokeOpacity?: number;
          strokeWeight?: number;
          fillColor?: string;
          fillOpacity?: number;
          map?: unknown;
        }) => { setMap: (map: unknown) => void };
        event: {
          trigger: (instance: unknown, eventName: string) => void;
          addListener: (instance: unknown, eventName: string, fn: () => void) => { remove: () => void };
          addListenerOnce: (instance: unknown, eventName: string, fn: () => void) => { remove: () => void };
        };
      };
    };
  }
}

/** GeoJSON Polygon [lng, lat][] を Google Maps LatLngLiteral に変換 */
function polygonToGooglePath(polygon: Polygon): { lat: number; lng: number }[] {
  return (polygon.coordinates[0] || []).map(([lng, lat]) => ({ lat, lng }));
}

export default function ProviderFieldMapPage() {
  const router = useRouter();
  const params = useParams();
  const fieldId = params?.fieldId as string | undefined;
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const polygonInstanceRef = useRef<{ setMap: (m: unknown) => void } | null>(null);
  const markerInstanceRef = useRef<{ setMap: (m: unknown) => void } | null>(null);

  const [user, setUser] = useState<Awaited<ReturnType<typeof getCurrentUser>>>(null);
  const [field, setField] = useState<FieldData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [scriptError, setScriptError] = useState(false);
  const hasMapKey = typeof process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY === 'string' && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.length > 0;

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u || u.role !== 'provider') {
        router.replace('/login');
        return;
      }
      setUser(u);
    })();
  }, [router]);

  useEffect(() => {
    if (!fieldId || !user) return;
    (async () => {
      const res = await fetch(`/api/provider/field/${fieldId}`);
      if (!res.ok) {
        setError('畑の情報を取得できませんでした。');
        setField(null);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setField(data as FieldData);
      setLoading(false);
    })();
  }, [fieldId, user]);

  useEffect(() => {
    if (!hasMapKey || scriptError || !scriptReady || !field || !mapRef.current || typeof window === 'undefined' || !window.google) return;

    const polygon = parseCampaignPolygon(field.area_coordinates);
    const centerLat = field.lat ?? (polygon ? getPolygonCenter(polygon)[1] : 35.6812);
    const centerLng = field.lng ?? (polygon ? getPolygonCenter(polygon)[0] : 139.7671);

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: centerLat, lng: centerLng },
      zoom: polygon ? 14 : 16,
      mapTypeControl: true,
      fullscreenControl: true,
      zoomControl: true,
    });

    mapInstanceRef.current = map;

    let polygonClickListener: { remove: () => void } | null = null;
    if (polygon) {
      const path = polygonToGooglePath(polygon);
      if (path.length >= 3) {
        const bounds = new window.google.maps.LatLngBounds();
        path.forEach((p) => bounds.extend(p));
        map.fitBounds(bounds, 40);

        const poly = new window.google.maps.Polygon({
          paths: path,
          strokeColor: '#DC2626',
          strokeOpacity: 1,
          strokeWeight: 4,
          fillColor: '#DC2626',
          fillOpacity: 0.45,
          map,
        });
        polygonInstanceRef.current = poly;

        // 畑をクリック → 現在地から車でナビを開く
        const navUrl = `https://www.google.com/maps/dir/?api=1&origin=current+location&destination=${centerLat},${centerLng}&travelmode=driving`;
        polygonClickListener = window.google.maps.event.addListener(poly, 'click', () => {
          window.open(navUrl, '_blank', 'noopener,noreferrer');
        });
      }
    }

    // 範囲が未登録のときは中心にピンを表示（畑の場所が分かるように）
    if (!polygon && centerLat != null && centerLng != null) {
      const marker = new window.google.maps.Marker({
        position: { lat: centerLat, lng: centerLng },
        map,
      });
      markerInstanceRef.current = marker;
    }

    // コンテナのレイアウト確定後に resize を発火してタイルを描画（真っ暗になるのを防ぐ）
    const triggerResize = () => window.google?.maps?.event?.trigger(map, 'resize');
    const raf = requestAnimationFrame(triggerResize);
    const t = window.setTimeout(triggerResize, 150);

    // タイルが一定時間内に読み込まれなければ API キー不備等とみなしフォールバック表示へ
    let cancelled = false;
    const fallbackTimer = window.setTimeout(() => {
      if (!cancelled) setScriptError(true);
    }, 1500);
    const listener = window.google.maps.event.addListenerOnce(map, 'tilesloaded', () => {
      window.clearTimeout(fallbackTimer);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
      listener.remove();
      polygonClickListener?.remove();
      if (markerInstanceRef.current) markerInstanceRef.current.setMap(null);
      markerInstanceRef.current = null;
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
      if (polygonInstanceRef.current) polygonInstanceRef.current.setMap(null);
      mapInstanceRef.current = null;
    };
  }, [hasMapKey, scriptError, scriptReady, field]);

  if (loading || !user) {
    return (
      <main className="min-h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-agrix-forest" />
      </main>
    );
  }

  if (error || !field) {
    return (
      <main className="min-h-full">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Link href="/provider/tasks">
            <Button variant="ghost" size="sm" className="gap-1 mb-4">
              <ArrowLeft className="w-4 h-4" />
              作業一覧へ
            </Button>
          </Link>
          <Card>
            <CardContent className="pt-6">
              <p className="text-dashboard-muted">{error ?? '畑が見つかりませんでした。'}</p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const polygon = parseCampaignPolygon(field.area_coordinates);
  const hasPolygon = polygon && polygon.coordinates[0] && polygon.coordinates[0].length >= 3;
  const centerLat = field.lat ?? (polygon ? getPolygonCenter(polygon)[1] : null);
  const centerLng = field.lng ?? (polygon ? getPolygonCenter(polygon)[0] : null);
  const googleMapUrl =
    centerLat != null && centerLng != null
      ? `https://www.google.com/maps?q=${centerLat},${centerLng}`
      : field.address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(field.address)}`
        : null;
  const navFromCurrentUrl =
    centerLat != null && centerLng != null
      ? `https://www.google.com/maps/dir/?api=1&origin=current+location&destination=${centerLat},${centerLng}&travelmode=driving`
      : field.address
        ? `https://www.google.com/maps/dir/?api=1&origin=current+location&destination=${encodeURIComponent(field.address)}&travelmode=driving`
        : null;

  const showMap = hasMapKey && !scriptError && scriptReady;
  const showFallback = !hasMapKey || scriptError;

  return (
    <main className="min-h-full flex flex-col">
      {hasMapKey && (
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&language=ja&region=JP`}
          strategy="afterInteractive"
          onLoad={() => setScriptReady(true)}
          onError={() => setScriptError(true)}
        />
      )}
      <div className="max-w-4xl mx-auto w-full px-4 py-4 flex flex-col flex-1">
        <div className="flex items-center justify-between gap-4 mb-4">
          <Link href="/provider/tasks">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="w-4 h-4" />
              作業一覧へ
            </Button>
          </Link>
        </div>
        <Card className="flex-1 flex flex-col min-h-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-5 h-5 text-agrix-forest" />
              {field.name || '畑'}
              {hasPolygon && (
                <span className="text-sm font-normal text-dashboard-muted">（枠付き）</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col min-h-[400px] p-0">
            {showMap && (
              <div ref={mapRef} className="w-full h-[360px] min-h-[360px] rounded-b-xl shrink-0" />
            )}
            {hasMapKey && !scriptError && !scriptReady && (
              <div className="flex-1 min-h-[360px] flex items-center justify-center rounded-b-xl bg-dashboard-card border border-dashboard-border">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-agrix-forest border-t-transparent" />
              </div>
            )}
            {showFallback && (
              <div className="flex-1 min-h-[360px] flex flex-col items-center justify-center gap-5 p-8 rounded-b-xl bg-dashboard-card border border-dashboard-border ring-1 ring-dashboard-border ring-inset">
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="rounded-full bg-agrix-forest/20 p-4 ring-2 ring-agrix-forest/30">
                    <MapPin className="w-8 h-8 text-agrix-forest" aria-hidden />
                  </div>
                  {field.address && (
                    <p className="text-base text-dashboard-fg font-medium max-w-md">
                      {field.address}
                    </p>
                  )}
                  <p className="text-sm text-dashboard-muted max-w-sm">
                    {!hasMapKey
                      ? '地図を表示するには、NEXT_PUBLIC_GOOGLE_MAPS_API_KEY を .env.local に設定してください。'
                      : '地図の読み込みに失敗しました。下の「Google Mapsで開く」から場所を確認できます。'}
                  </p>
                </div>
              </div>
            )}
            <div className="p-4 border-t border-dashboard-border flex flex-col gap-2">
              <p className="text-xs text-dashboard-muted">
                {hasPolygon
                  ? '赤い枠が登録された範囲です。ナビ・ルートは畑の中心（緯度経度）への経路です。枠をクリックすると現在地から車でナビを開けます。'
                  : 'この畑には範囲が登録されていません。農家がマイ畑で地図から範囲を登録すると、ここに赤い枠で表示されます。'}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {googleMapUrl && (
                  <a
                    href={googleMapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium text-agrix-forest hover:underline"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Google Mapsで開く
                  </a>
                )}
                {navFromCurrentUrl && (
                  <a
                    href={navFromCurrentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium text-agrix-forest hover:underline"
                  >
                    <Navigation className="w-4 h-4" />
                    現在地から車でナビ
                  </a>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
