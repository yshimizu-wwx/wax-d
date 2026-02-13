'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
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
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import { calculateCurrentUnitPrice } from '@/lib/calculator/priceCalculator';
import {
  fetchCampaigns,
  fetchCampaignTotalArea,
  fetchBookingsByFarmer,
  fetchFieldsByFarmer,
  fetchLinkedProvidersForFarmer,
  createBooking,
  requestCancelBooking,
  type BookingData,
  type FarmerBookingItem,
  type LinkedProvider,
} from '@/lib/api';
import { getCurrentUser, type User } from '@/lib/auth';
import { Project, type Field } from '@/types/database';
import { isFieldInCampaignArea } from '@/lib/geo/spatial-queries';
import type { Polygon } from 'geojson';
import type { FarmerFormData } from '@/components/CampaignForm';
import CampaignTimelineCard, { type CampaignWithArea } from '@/components/CampaignTimelineCard';
import ApplicationDialog, { type ApplicationFormData } from '@/components/ApplicationDialog';
import AppLoader from '@/components/AppLoader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import FarmerDashboardContent from './FarmerDashboardContent';

function parseInterestedCropIds(raw: string | null | undefined): string[] {
  if (raw == null || raw === '') return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) return parsed as string[];
  } catch {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

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
  const [allCampaignsWithArea, setAllCampaignsWithArea] = useState<CampaignWithArea[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignWithArea | null>(null);
  const [loading, setLoading] = useState(true);
  const [area10r, setArea10r] = useState<number>(0);
  const [polygon, setPolygon] = useState<Polygon | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number }[] | null>(null);
  const [farmerBookings, setFarmerBookings] = useState<FarmerBookingItem[]>([]);
  const [farmerFields, setFarmerFields] = useState<Field[]>([]);
  const [linkedProviders, setLinkedProviders] = useState<LinkedProvider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [applicationDialogOpen, setApplicationDialogOpen] = useState(false);
  const [applicationCampaign, setApplicationCampaign] = useState<CampaignWithArea | null>(null);
  const applySectionRef = useRef<HTMLDivElement>(null);

  // 案件一覧フィルタ（農家用）
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'past'>('all');
  const [filterByMyFields, setFilterByMyFields] = useState(false);
  const [filterByMyCrops, setFilterByMyCrops] = useState(false);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

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

  // 未ログイン: 公開案件一覧（募集中のみ）
  useEffect(() => {
    if (userLoading || user) return;
    fetchCampaigns({ status: 'open' }).then(setOpenCampaigns).finally(() => setLoading(false));
  }, [userLoading, user]);

  // 農家: 紐付き業者一覧・申込履歴・畑を取得
  useEffect(() => {
    if (userLoading || !user || user.role !== 'farmer') return;
    setLoading(false); // 業者選択画面ではローダーを出さない
    fetchLinkedProvidersForFarmer(user.id).then(setLinkedProviders);
    fetchBookingsByFarmer(user.id).then(setFarmerBookings);
    fetchFieldsByFarmer(user.id).then(setFarmerFields);
  }, [userLoading, user]);

  // 農家: 選択した業者の案件のみ取得（業者を選んだとき）
  useEffect(() => {
    if (userLoading || !user || user.role !== 'farmer' || !selectedProviderId) {
      if (user?.role === 'farmer' && !selectedProviderId) {
        setAllCampaignsWithArea([]);
        setSelectedCampaign(null);
      }
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchCampaigns({ status: 'all', providerId: selectedProviderId })
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
        setAllCampaignsWithArea(withArea);
        setSelectedCampaign((prev) => {
          const first = withArea[0] ?? null;
          if (!prev) return first;
          const still = withArea.find((c) => c.id === prev.id);
          return still ?? first;
        });
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userLoading, user, selectedProviderId]);

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

  // 農家: 自分の品目ID・畑が案件エリアに入っているか・フィルタ＆ソート済み一覧
  const myCropIds = useMemo(
    () => (user?.role === 'farmer' ? parseInterestedCropIds(user.interested_crop_ids) : []),
    [user]
  );
  const campaignFieldMatch = useMemo(() => {
    const map = new Map<string, boolean>();
    allCampaignsWithArea.forEach((c) => {
      const polygon = (c.target_area_polygon ?? undefined) as string | Polygon | null | undefined;
      const match = farmerFields.some((f) => isFieldInCampaignArea(f, polygon));
      map.set(c.id, match);
    });
    return map;
  }, [allCampaignsWithArea, farmerFields]);
  const campaignCropMatch = useMemo(() => {
    const map = new Map<string, boolean>();
    allCampaignsWithArea.forEach((c) => {
      const match = Boolean(
        c.target_crop_id && myCropIds.length > 0 && myCropIds.includes(c.target_crop_id)
      );
      map.set(c.id, match);
    });
    return map;
  }, [allCampaignsWithArea, myCropIds]);

  const openCampaignsWithArea = useMemo(() => {
    let list = allCampaignsWithArea;
    if (filterStatus === 'open') {
      list = list.filter(
        (c) => c.status === 'open' && c.is_closed !== true
      );
    } else if (filterStatus === 'past') {
      list = list.filter((c) => c.status === 'closed' || c.status === 'completed');
    }
    if (filterDateFrom) {
      list = list.filter((c) => c.start_date && c.start_date >= filterDateFrom);
    }
    if (filterDateTo) {
      list = list.filter((c) => c.end_date && c.end_date <= filterDateTo);
    }
    if (filterByMyFields) {
      list = list.filter((c) => campaignFieldMatch.get(c.id));
    }
    if (filterByMyCrops) {
      list = list.filter((c) => campaignCropMatch.get(c.id));
    }
    // 並び順: 自分の畑エリア＆自分の品目 → 自分の品目 → 自分の畑エリア → その他
    return [...list].sort((a, b) => {
      const aField = campaignFieldMatch.get(a.id) ?? false;
      const aCrop = campaignCropMatch.get(a.id) ?? false;
      const bField = campaignFieldMatch.get(b.id) ?? false;
      const bCrop = campaignCropMatch.get(b.id) ?? false;
      const score = (f: boolean, c: boolean) => (f && c ? 3 : c ? 2 : f ? 1 : 0);
      return score(bField, bCrop) - score(aField, aCrop);
    });
  }, [
    allCampaignsWithArea,
    filterStatus,
    filterDateFrom,
    filterDateTo,
    filterByMyFields,
    filterByMyCrops,
    campaignFieldMatch,
    campaignCropMatch,
  ]);

  // フィルタ結果に選択中案件が含まれない場合は先頭を選択
  useEffect(() => {
    if (user?.role !== 'farmer' || openCampaignsWithArea.length === 0) return;
    const stillInList = selectedCampaign && openCampaignsWithArea.some((c) => c.id === selectedCampaign.id);
    if (!stillInList) {
      setSelectedCampaign(openCampaignsWithArea[0] ?? null);
    }
  }, [user?.role, openCampaignsWithArea, selectedCampaign]);

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
      desired_start_date: formData.desiredStartDate?.trim() || undefined,
      desired_end_date: formData.desiredEndDate?.trim() || undefined,
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
      setAllCampaignsWithArea((prev) =>
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

  const handleApplicationDialogSubmit = async (data: ApplicationFormData) => {
    const campaign = applicationCampaign;
    if (!campaign || !user?.id || user.role !== 'farmer') return;
    const totalNewArea = data.selections.reduce((sum, s) => sum + s.area10r, 0);
    const pricing = {
      base_price: campaign.base_price || 0,
      min_price: campaign.min_price || 0,
      target_area_10r: campaign.target_area_10r || 0,
      min_target_area_10r: campaign.min_target_area_10r ?? undefined,
      max_target_area_10r: campaign.max_target_area_10r ?? undefined,
      execution_price: campaign.execution_price ?? undefined,
    };
    const totalArea = (campaign.totalArea10r ?? 0) + totalNewArea;
    const validation = calculateCurrentUnitPrice(pricing, totalArea);
    const lockedPrice = validation.currentPrice ?? campaign.base_price ?? 0;

    for (const sel of data.selections) {
      const bookingData: BookingData = {
        campaign_id: campaign.id,
        farmer_id: user.id,
        farmer_name: user.name ?? '',
        phone: user.phone ?? '',
        email: user.email ?? '',
        desired_start_date: data.desiredStartDate || undefined,
        desired_end_date: data.desiredEndDate || undefined,
        field_id: sel.fieldId,
        area_10r: sel.area10r,
        locked_price: lockedPrice,
      };
      const result = await createBooking(bookingData);
      if (!result.success) {
        toast.error(result.error || '申し込みに失敗しました');
        throw new Error(result.error);
      }
    }

    const count = data.selections.length;
    toast.success(count > 1 ? `${count}件の申し込みが完了しました` : '申し込みが完了しました');
    fetchBookingsByFarmer(user.id).then(setFarmerBookings);
    setAllCampaignsWithArea((prev) =>
      prev.map((c) =>
        c.id === campaign.id ? { ...c, totalArea10r: (c.totalArea10r ?? 0) + totalNewArea } : c
      )
    );
  };

  const handleRequestCancel = async (bookingId: string) => {
    if (!user?.id || user.role !== 'farmer') return;
    const result = await requestCancelBooking(bookingId, user.id);
    if (result.success) {
      toast.success('キャンセル依頼を送りました。業者に連絡が入ります。');
      fetchBookingsByFarmer(user.id).then(setFarmerBookings);
    } else {
      toast.error(result.error || 'キャンセル依頼に失敗しました');
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

  // 農家で業者を選択済みかつ案件取得中のみローダー表示
  if (user?.role === 'farmer' && selectedProviderId && loading && allCampaignsWithArea.length === 0) {
    return (
      <main className="min-h-full flex items-center justify-center">
        <AppLoader message="案件を読み込み中..." />
      </main>
    );
  }

  return (
    <FarmerDashboardContent
      user={user}
      linkedProviders={linkedProviders}
      selectedProviderId={selectedProviderId}
      setSelectedProviderId={setSelectedProviderId}
      openCampaignsWithArea={openCampaignsWithArea}
      selectedCampaign={selectedCampaign}
      setSelectedCampaign={setSelectedCampaign}
      applicationDialogOpen={applicationDialogOpen}
      setApplicationDialogOpen={setApplicationDialogOpen}
      applicationCampaign={applicationCampaign}
      setApplicationCampaign={setApplicationCampaign}
      farmerBookings={farmerBookings}
      farmerFields={farmerFields}
      onApplicationDialogSubmit={handleApplicationDialogSubmit}
      applySectionRef={applySectionRef}
      area10r={area10r}
      coords={coords}
      onPolygonComplete={handlePolygonComplete}
      totalCampaignArea={totalCampaignArea}
      onFormSubmit={handleFormSubmit}
      onRequestCancel={handleRequestCancel}
      filterByMyFields={filterByMyFields}
      setFilterByMyFields={setFilterByMyFields}
      filterByMyCrops={filterByMyCrops}
      setFilterByMyCrops={setFilterByMyCrops}
      filterStatus={filterStatus}
      setFilterStatus={setFilterStatus}
      filterDateFrom={filterDateFrom}
      setFilterDateFrom={setFilterDateFrom}
      filterDateTo={filterDateTo}
      setFilterDateTo={setFilterDateTo}
    />
  );
}

