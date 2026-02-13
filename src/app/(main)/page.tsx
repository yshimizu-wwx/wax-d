'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  MapPin,
  Calendar,
  FileText,
  Sprout,
  ArrowRight,
  LogIn,
} from 'lucide-react';
import { toast } from 'sonner';
import { calculateCurrentUnitPrice } from '@/lib/calculator/priceCalculator';
import {
  fetchOpenCampaigns,
  fetchCampaignTotalArea,
  fetchBookingsByFarmer,
  createBooking,
  type BookingData,
  type FarmerBookingItem,
} from '@/lib/api';
import { getCurrentUser, type User } from '@/lib/auth';
import { Project } from '@/types/database';
import type { Polygon } from 'geojson';
import type { FarmerFormData } from '@/components/CampaignForm';
import CampaignTimelineCard, { type CampaignWithArea } from '@/components/CampaignTimelineCard';
import AppLoader from '@/components/AppLoader';
import { Card, CardContent } from '@/components/ui/card';

const PolygonMap = dynamic(() => import('@/components/PolygonMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-dashboard-card animate-pulse rounded-2xl flex items-center justify-center text-dashboard-muted">
      地図を読み込み中...
    </div>
  ),
});

const CampaignForm = dynamic(() => import('@/components/CampaignForm'), {
  ssr: false,
});

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userLoading, setUserLoading] = useState(true);

  const [openCampaigns, setOpenCampaigns] = useState<Project[]>([]);
  const [openCampaignsWithArea, setOpenCampaignsWithArea] = useState<CampaignWithArea[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignWithArea | null>(null);
  const [loading, setLoading] = useState(true);
  const [area10r, setArea10r] = useState<number>(0);
  const [polygon, setPolygon] = useState<Polygon | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number }[] | null>(null);
  const [farmerBookings, setFarmerBookings] = useState<FarmerBookingItem[]>([]);

  useEffect(() => {
    getCurrentUser().then((u) => {
      setUser(u ?? null);
      setUserLoading(false);
    });
  }, []);

  // 業者・管理者は /admin へリダイレクト
  useEffect(() => {
    if (userLoading || !user) return;
    if (user.role === 'admin' || user.role === 'provider') {
      router.replace('/admin');
      return;
    }
  }, [user, userLoading, router]);

  // 未ログイン: 公開案件一覧
  useEffect(() => {
    if (userLoading || user) return;
    fetchOpenCampaigns().then(setOpenCampaigns).finally(() => setLoading(false));
  }, [userLoading, user]);

  // 農家: 公開案件一覧（合計面積付き）+ 申込履歴 → タイムライン表示用
  useEffect(() => {
    if (userLoading || !user || user.role !== 'farmer') return;
    let cancelled = false;
    setLoading(true);
    fetchOpenCampaigns()
      .then((campaigns) => {
        if (cancelled) return;
        return Promise.all(
          campaigns.map((c) =>
            fetchCampaignTotalArea(c.id).then((total) => ({ ...c, totalArea10r: total }))
          )
        );
      })
      .then((withArea) => {
        if (cancelled || !withArea) return;
        setOpenCampaignsWithArea(withArea);
        setSelectedCampaign((prev) => {
          const first = withArea[0] ?? null;
          if (!prev) return first;
          const still = withArea.find((c) => c.id === prev.id);
          return still ?? first;
        });
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    if (user.id) {
      fetchBookingsByFarmer(user.id).then((bookings) => {
        if (!cancelled) setFarmerBookings(bookings);
      });
    }
    return () => { cancelled = true; };
  }, [userLoading, user]);

  const handlePolygonComplete = (
    newCoords: { lat: number; lng: number }[] | null,
    newArea10r: number,
    newPolygon: Polygon | null
  ) => {
    setCoords(newCoords);
    setArea10r(newArea10r);
    setPolygon(newPolygon);
  };

  const totalCampaignArea = selectedCampaign?.totalArea10r ?? 0;

  const handleFormSubmit = async (formData: FarmerFormData) => {
    if (!selectedCampaign || !polygon) {
      toast.error('案件情報または圃場データが不足しています');
      return;
    }
    const pricing = {
      base_price: selectedCampaign.base_price || 0,
      min_price: selectedCampaign.min_price || 0,
      target_area_10r: selectedCampaign.target_area_10r || 0,
      min_target_area_10r: selectedCampaign.min_target_area_10r ?? undefined,
      max_target_area_10r: selectedCampaign.max_target_area_10r ?? undefined,
      execution_price: selectedCampaign.execution_price ?? undefined,
    };
    const simulatedTotalArea = totalCampaignArea + area10r;
    const validation = calculateCurrentUnitPrice(pricing, simulatedTotalArea);
    const lockedPrice = validation.currentPrice ?? selectedCampaign.base_price ?? 0;
    const bookingData: BookingData = {
      campaign_id: selectedCampaign.id,
      farmer_id: user?.role === 'farmer' && user?.id ? user.id : undefined,
      farmer_name: formData.farmerName,
      phone: formData.phone,
      email: formData.email,
      desired_start_date: formData.desiredStartDate,
      desired_end_date: formData.desiredEndDate,
      field_polygon: polygon,
      area_10r: area10r,
      locked_price: lockedPrice,
    };
    const result = await createBooking(bookingData);
    if (result.success) {
      toast.success(`予約が完了しました。予約ID: ${result.bookingId}`);
      setArea10r(0);
      setPolygon(null);
      setCoords(null);
      if (user?.id) fetchBookingsByFarmer(user.id).then(setFarmerBookings);
      setOpenCampaignsWithArea((prev) =>
        prev.map((c) =>
          c.id === selectedCampaign.id
            ? { ...c, totalArea10r: (c.totalArea10r ?? 0) + area10r }
            : c
        )
      );
      setSelectedCampaign((prev) =>
        prev?.id === selectedCampaign.id
          ? { ...prev, totalArea10r: (prev.totalArea10r ?? 0) + area10r }
          : prev
      );
    } else {
      toast.error(result.error || '予約に失敗しました');
    }
  };

  if (userLoading) {
    return (
      <main className="min-h-full flex items-center justify-center">
        <AppLoader message="読み込み中..." />
      </main>
    );
  }

  if (user && (user.role === 'admin' || user.role === 'provider')) {
    return (
      <main className="min-h-full flex items-center justify-center">
        <AppLoader message="ダッシュボードへ移動中..." />
      </main>
    );
  }

  // 未ログイン: サービス紹介 + 公開案件一覧
  if (!user) {
    return (
      <main className="min-h-full">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
          <section className="text-center mb-10">
            <h1 className="text-2xl md:text-3xl font-black text-dashboard-text mb-2">
              <span className="text-agrix-forest">Wayfinder AgriX Drone</span>
            </h1>
            <p className="text-dashboard-muted font-medium max-w-xl mx-auto text-base">
              農家と業者をつなぐドローン農作業予約プラットフォーム。圃場を指定して簡単に申し込みできます。
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 mt-6 bg-agrix-forest text-white px-6 py-3 rounded-2xl font-bold shadow-sm hover:bg-agrix-forest-light transition-colors"
            >
              <LogIn className="w-5 h-5" />
              ログイン / 新規登録
            </Link>
          </section>

          <section id="campaigns">
            <h2 className="text-lg font-bold text-dashboard-text mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-agrix-forest" />
              公開案件一覧
            </h2>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 text-dashboard-muted animate-spin" />
              </div>
            ) : openCampaigns.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-dashboard-muted">
                  現在募集中の案件はありません。
                </CardContent>
              </Card>
            ) : (
              <ul className="space-y-3">
                {openCampaigns.map((c) => (
                  <li key={c.id}>
                    <Card>
                      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <p className="font-bold text-dashboard-text">
                            {(c as Project & { campaign_title?: string }).campaign_title || c.location}
                          </p>
                          <p className="text-sm text-dashboard-muted">
                            {c.start_date && c.end_date
                              ? `${c.start_date} ～ ${c.end_date}`
                              : c.location}
                          </p>
                        </div>
                        <Link
                          href="/login"
                          className="inline-flex items-center gap-1 text-sm font-bold text-agrix-forest hover:underline shrink-0"
                        >
                          申し込む <ArrowRight className="w-4 h-4" />
                        </Link>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    );
  }

  // 農家: 予約募集 + 申込履歴 + My畑
  if (user.role !== 'farmer') {
    return null;
  }

  if (loading && openCampaignsWithArea.length === 0 && user?.role === 'farmer') {
    return (
      <main className="min-h-full flex items-center justify-center">
        <AppLoader message="読み込み中..." />
      </main>
    );
  }

  const statusLabel: Record<string, string> = {
    confirmed: '確定',
    pending: '確認待ち',
    completed: '完了',
    canceled: 'キャンセル',
  };

  return (
    <main className="min-h-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        {user?.role === 'farmer' && (
          <section className="mb-8">
            <h2 className="text-lg font-bold text-dashboard-text mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-agrix-forest" />
              予約募集一覧
            </h2>
            {openCampaignsWithArea.length === 0 ? (
              <Card className="mb-8">
                <CardContent className="p-10 flex flex-col items-center justify-center text-center">
                  <div className="rounded-full bg-dashboard-muted/20 p-6 mb-4">
                    <MapPin className="w-12 h-12 text-dashboard-muted" />
                  </div>
                  <p className="font-bold text-dashboard-text mb-1">現在募集中の案件はありません</p>
                  <p className="text-sm text-dashboard-muted">新しい案件が公開されるとここに表示されます。</p>
                </CardContent>
              </Card>
            ) : (
              <ul className="space-y-4">
                {openCampaignsWithArea.map((campaign) => (
                  <li key={campaign.id}>
                    <CampaignTimelineCard
                      campaign={campaign}
                      onSelect={(c) => setSelectedCampaign(c)}
                      isSelected={selectedCampaign?.id === campaign.id}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* 選択した案件: 地図 + 申込フォーム */}
        {user?.role === 'farmer' && selectedCampaign && (
          <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
              <p className="text-dashboard-text font-bold text-sm">
                申し込む案件: {(selectedCampaign as { campaign_title?: string }).campaign_title || selectedCampaign.location}
              </p>
              <div className="flex items-center gap-2 bg-agrix-forest/10 text-agrix-forest px-3 py-1.5 rounded-lg border border-agrix-forest/30">
                <span className="text-xs font-bold">累計</span>
                <span className="font-black">{(selectedCampaign.totalArea10r ?? 0).toFixed(1)} 反</span>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
              <section className="order-2 lg:order-1">
                <Card className="p-4 h-[500px] lg:h-[700px] relative overflow-hidden">
                  <div className="absolute top-4 left-4 z-[1000] bg-dashboard-card/95 backdrop-blur px-4 py-2 rounded-xl shadow-md border border-dashboard-border flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-agrix-forest" />
                    <div>
                      <h2 className="text-sm font-bold text-dashboard-text">圃場を描画</h2>
                      <p className="text-xs text-dashboard-muted">地図上でクリックして圃場の範囲を指定</p>
                    </div>
                  </div>
                  {area10r > 0 && (
                    <div className="absolute top-4 right-4 z-[1000] bg-agrix-forest text-white px-5 py-3 rounded-xl shadow-sm border-2 border-agrix-gold/50 min-w-[180px]">
                      <div className="text-xs font-bold uppercase tracking-wider mb-1 opacity-90">選択面積</div>
                      <div className="text-2xl font-black">
                        {area10r.toFixed(2)} <span className="text-sm font-normal opacity-90">反</span>
                      </div>
                    </div>
                  )}
                  <div className="w-full h-full rounded-xl overflow-hidden absolute inset-0 p-4 pt-14">
                    <PolygonMap
                      onPolygonComplete={handlePolygonComplete}
                      initialPolygon={coords || undefined}
                    />
                  </div>
                </Card>
              </section>
              <section className="order-1 lg:order-2">
                <Card>
                  <CardContent className="p-6">
                    <CampaignForm
                      project={selectedCampaign}
                      area10r={area10r}
                      totalCampaignArea={totalCampaignArea}
                      onSubmit={handleFormSubmit}
                      initialFormData={
                        user?.role === 'farmer' && user
                          ? {
                              farmerName: user.name ?? '',
                              phone: user.phone ?? '',
                              email: user.email ?? '',
                            }
                          : undefined
                      }
                    />
                  </CardContent>
                </Card>
              </section>
            </div>
          </>
        )}

        <section id="applications" className="mb-8">
          <h2 className="text-lg font-bold text-dashboard-text mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-agrix-forest" />
            申込履歴
          </h2>
          <Card className="overflow-hidden">
            {farmerBookings.length === 0 ? (
              <CardContent className="p-10 flex flex-col items-center justify-center text-center">
                <div className="rounded-full bg-dashboard-muted/20 p-6 mb-4">
                  <FileText className="w-12 h-12 text-dashboard-muted" />
                </div>
                <p className="font-bold text-dashboard-text mb-1">まだ申込がありません</p>
                <p className="text-sm text-dashboard-muted">案件を選択して申し込むと、ここに履歴が表示されます。</p>
              </CardContent>
            ) : (
              <ul className="divide-y divide-dashboard-border">
                {farmerBookings.map((b) => (
                  <li key={b.id} className="p-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-bold text-dashboard-text">
                        {b.project?.campaign_title || b.project?.location || b.campaign_id}
                      </p>
                      <p className="text-sm text-dashboard-muted">
                        {b.area_10r} 反
                        {b.locked_price != null && ` · ¥${(b.area_10r * b.locked_price).toLocaleString()}`}
                        {' · '}
                        {statusLabel[b.status] || b.status}
                        {b.created_at &&
                          ` · ${new Date(b.created_at).toLocaleDateString('ja-JP')}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        <section id="my-field">
          <h2 className="text-lg font-bold text-dashboard-text mb-4 flex items-center gap-2">
            <Sprout className="w-5 h-5 text-agrix-forest" />
            My畑管理
          </h2>
          <Card>
            <CardContent className="p-10 flex flex-col items-center justify-center text-center">
              <div className="rounded-full bg-agrix-forest/10 p-6 mb-4">
                <Sprout className="w-12 h-12 text-agrix-forest" />
              </div>
              <p className="font-bold text-dashboard-text mb-1">圃場情報の登録・管理</p>
              <p className="text-sm text-dashboard-muted mb-4">畑を登録すると、作業依頼や申込時に選択できます。</p>
              <Link
                href="/my-fields"
                className="inline-flex items-center gap-2 bg-agrix-forest text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-agrix-forest-dark transition-colors"
              >
                <Sprout className="w-4 h-4" />
                マイ畑を管理する
              </Link>
            </CardContent>
          </Card>
        </section>

        <footer className="mt-8 text-center text-sm text-dashboard-muted">
          <p>ご不明な点がございましたら、お気軽にお問い合わせください。</p>
          <p className="mt-2">
            © 2026{' '}
            <a
              href="https://wayfinderworx.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-dashboard-text hover:text-agrix-forest underline underline-offset-2"
            >
              Wayfinder WorX
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}
