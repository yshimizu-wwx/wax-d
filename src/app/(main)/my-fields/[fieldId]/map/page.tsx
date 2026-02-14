'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowLeft, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { getCurrentUser, type User } from '@/lib/auth';
import { updateField } from '@/lib/api';
import { parseCampaignPolygon } from '@/lib/geo/spatial-queries';
import { getPolygonCenter } from '@/lib/geo/areaCalculator';
import { reverseGeocodeViaApi } from '@/lib/geo/geocodeClient';
import type { Polygon } from 'geojson';
import AppLoader from '@/components/AppLoader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const PolygonMap = dynamic(() => import('@/components/PolygonMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full min-h-[360px] bg-dashboard-card animate-pulse rounded-lg flex items-center justify-center text-dashboard-muted text-sm">
      地図を読み込み中...
    </div>
  ),
});

interface FieldData {
  id: string;
  name: string | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  area_size: number | null;
  area_coordinates: unknown;
}

/** GeoJSON Polygon を PolygonMap の initialPolygon 形式に変換 */
function polygonToLatLngArray(polygon: Polygon): { lat: number; lng: number }[] {
  const ring = polygon.coordinates[0];
  if (!ring || !Array.isArray(ring)) return [];
  return ring.map(([lng, lat]) => ({ lat, lng }));
}

export default function MyFieldMapPage() {
  const router = useRouter();
  const params = useParams();
  const fieldId = params?.fieldId as string | undefined;

  const [user, setUser] = useState<User | null>(null);
  const [field, setField] = useState<FieldData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingPolygon, setPendingPolygon] = useState<{
    coords: { lat: number; lng: number }[];
    area10r: number;
    polygon: Polygon;
    address?: string;
  } | null>(null);

  useEffect(() => {
    getCurrentUser().then((u) => setUser(u ?? null));
  }, []);

  useEffect(() => {
    if (!user || user.role !== 'farmer' || !fieldId) return;
    fetch(`/api/my-fields/${fieldId}`)
      .then((res) => {
        if (!res.ok) throw new Error('畑を取得できませんでした');
        return res.json();
      })
      .then((data: FieldData) => setField(data))
      .catch(() => setField(null))
      .finally(() => setLoading(false));
  }, [user, fieldId]);

  useEffect(() => {
    if (loading || !user) return;
    if (user.role !== 'farmer') {
      router.replace('/');
      return;
    }
  }, [user, loading, router]);

  const polygon = field ? parseCampaignPolygon(field.area_coordinates) : null;
  const initialPolygon =
    polygon && polygon.coordinates[0]?.length >= 3
      ? polygonToLatLngArray(polygon)
      : undefined;

  const handlePolygonComplete = useCallback(
    async (
      coords: { lat: number; lng: number }[] | null,
      area10r: number,
      polygonGeo: Polygon | null
    ) => {
      if (!polygonGeo || !coords || coords.length < 3 || area10r <= 0) {
        setPendingPolygon(null);
        return;
      }
      const areaRounded = Math.round(area10r * 10) / 10;
      const [lng, lat] = getPolygonCenter(polygonGeo);
      const rev = await reverseGeocodeViaApi(lat, lng);
      setPendingPolygon({
        coords,
        area10r: areaRounded,
        polygon: polygonGeo,
        address: rev?.displayName,
      });
      if (field) {
        setField((prev) =>
          prev
            ? {
                ...prev,
                address: rev?.displayName ?? prev.address,
                lat,
                lng,
                area_size: areaRounded,
              }
            : null
        );
      }
    },
    [field]
  );

  const handleSave = useCallback(async () => {
    if (!fieldId || !user || user.role !== 'farmer' || !pendingPolygon) {
      toast.error('畑の範囲を地図上で描いてから保存してください');
      return;
    }
    setSaving(true);
    try {
      const [centerLng, centerLat] = getPolygonCenter(pendingPolygon.polygon);
      // 緯度経度から逆ジオコードで取得した正確な住所を反映
      const rev = await reverseGeocodeViaApi(centerLat, centerLng);
      const addressToSave = rev?.displayName ?? field?.address ?? undefined;
      // 範囲を保存するときは中心ピン（緯度経度）も範囲の中心で必ず更新（業者のルート・ナビで使用）
      const result = await updateField(fieldId, {
        area_coordinates: pendingPolygon.polygon,
        area_size: pendingPolygon.area10r,
        lat: centerLat,
        lng: centerLng,
        ...(addressToSave && { address: addressToSave }),
      });
      if (result.success) {
        toast.success('畑の囲いを保存しました');
        setPendingPolygon(null);
        setField((prev) =>
          prev
            ? {
                ...prev,
                area_coordinates: pendingPolygon.polygon,
                area_size: pendingPolygon.area10r,
                lat: centerLat,
                lng: centerLng,
                address: addressToSave ?? prev.address,
              }
            : null
        );
      } else {
        toast.error(result.error);
      }
    } finally {
      setSaving(false);
    }
  }, [fieldId, user, pendingPolygon, field]);

  if (loading) {
    return (
      <main className="min-h-full flex items-center justify-center">
        <AppLoader message="読み込み中..." />
      </main>
    );
  }

  if (!user || user.role !== 'farmer') {
    return (
      <main className="min-h-full flex items-center justify-center">
        <AppLoader message="リダイレクト中..." />
      </main>
    );
  }

  if (!field) {
    return (
      <main className="min-h-full">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Link href="/my-fields">
            <Button variant="ghost" size="sm" className="gap-1 mb-4">
              <ArrowLeft className="w-4 h-4" />
              マイ畑一覧へ
            </Button>
          </Link>
          <Card>
            <CardContent className="pt-6">
              <p className="text-dashboard-muted">畑が見つかりませんでした。</p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-full flex flex-col">
      <div className="max-w-4xl mx-auto w-full px-4 py-4 flex flex-col flex-1">
        <div className="flex items-center justify-between gap-4 mb-4">
          <Link href="/my-fields">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="w-4 h-4" />
              マイ畑一覧へ
            </Button>
          </Link>
        </div>
        <Card className="flex-1 flex flex-col min-h-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-5 h-5 text-agrix-forest" />
              {field.name || '畑'}
            </CardTitle>
            <p className="text-sm text-dashboard-muted mt-1">
              {initialPolygon
                ? '地図上で畑の範囲を描き直せます。新しいポリゴンを描くと面積が自動計算されます。保存で囲い情報を更新します。'
                : '登録した範囲がまだありません。下の地図で範囲を描いて「囲いを保存」すると、次回から範囲が表示されます。'}
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="w-full min-h-[360px] rounded-xl overflow-hidden border border-dashboard-border">
              <PolygonMap
                initialPolygon={initialPolygon}
                initialCenter={
                  field.lat != null && field.lng != null
                    ? [field.lat, field.lng]
                    : undefined
                }
                initialAddress={field.address ?? undefined}
                onPolygonComplete={handlePolygonComplete}
              />
            </div>
            {pendingPolygon && (
              <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-agrix-forest/10 border border-agrix-forest/30">
                <span className="text-sm text-dashboard-fg">
                  面積: {pendingPolygon.area10r} 反
                </span>
                <Button
                  size="sm"
                  className="bg-agrix-forest hover:bg-agrix-forest-dark"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? '保存中...' : '囲いを保存'}
                </Button>
              </div>
            )}
            {field.address && (
              <p className="text-sm text-dashboard-muted">
                住所: {field.address}
                {field.area_size != null && ` ・ ${field.area_size} 反`}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
