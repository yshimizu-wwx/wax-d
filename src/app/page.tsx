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
  fetchActiveProject,
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

const PolygonMap = dynamic(() => import('@/components/PolygonMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-100 animate-pulse rounded-2xl flex items-center justify-center text-slate-400">
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

  const [project, setProject] = useState<Project | null>(null);
  const [openCampaigns, setOpenCampaigns] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [area10r, setArea10r] = useState<number>(0);
  const [polygon, setPolygon] = useState<Polygon | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number }[] | null>(null);
  const [totalCampaignArea, setTotalCampaignArea] = useState<number>(0);
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

  // 農家: アクティブ案件 + 申込履歴
  useEffect(() => {
    if (userLoading || !user || user.role !== 'farmer') return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchActiveProject(),
      user.id ? fetchBookingsByFarmer(user.id) : Promise.resolve([]),
    ]).then(([activeProject, bookings]) => {
      if (cancelled) return;
      setProject(activeProject);
      setFarmerBookings(bookings);
      if (activeProject) {
        fetchCampaignTotalArea(activeProject.id).then((total) => {
          if (!cancelled) setTotalCampaignArea(total);
        });
      }
      setLoading(false);
    });
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

  const handleFormSubmit = async (formData: FarmerFormData) => {
    if (!project || !polygon) {
      toast.error('案件情報または圃場データが不足しています');
      return;
    }
    const pricing = {
      base_price: project.base_price || 0,
      min_price: project.min_price || 0,
      target_area_10r: project.target_area_10r || 0,
      min_target_area_10r: project.min_target_area_10r,
      max_target_area_10r: project.max_target_area_10r,
      execution_price: project.execution_price,
    };
    const simulatedTotalArea = totalCampaignArea + area10r;
    const validation = calculateCurrentUnitPrice(pricing, simulatedTotalArea);
    const lockedPrice = validation.currentPrice ?? project.base_price ?? 0;
    const bookingData: BookingData = {
      campaign_id: project.id,
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
      window.location.reload();
    } else {
      toast.error(result.error || '予約に失敗しました');
    }
  };

  if (userLoading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
          <p className="text-slate-600 font-medium">読み込み中...</p>
        </div>
      </main>
    );
  }

  if (user && (user.role === 'admin' || user.role === 'provider')) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
          <p className="text-slate-600 font-medium">ダッシュボードへ移動中...</p>
        </div>
      </main>
    );
  }

  // 未ログイン: サービス紹介 + 公開案件一覧
  if (!user) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-green-50/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
          <section className="text-center mb-12">
            <h1 className="text-3xl md:text-4xl font-black text-slate-800 mb-3">
              <span className="text-[#16a34a]">Wayfinder AgriX</span>
            </h1>
            <p className="text-slate-600 font-medium max-w-xl mx-auto">
              農家と業者をつなぐドローン農作業予約プラットフォーム。圃場を指定して簡単に申し込みできます。
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 mt-6 bg-[#16a34a] text-white px-6 py-3 rounded-2xl font-bold shadow-sm hover:opacity-90 transition-opacity"
            >
              <LogIn className="w-5 h-5" />
              ログイン / 新規登録
            </Link>
          </section>

          <section id="campaigns">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#16a34a]" />
              公開案件一覧
            </h2>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
              </div>
            ) : openCampaigns.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center text-slate-500">
                現在募集中の案件はありません。
              </div>
            ) : (
              <ul className="space-y-3">
                {openCampaigns.map((c) => (
                  <li
                    key={c.id}
                    className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-bold text-slate-800">
                        {(c as Project & { campaign_title?: string }).campaign_title || c.location}
                      </p>
                      <p className="text-sm text-slate-500">
                        {c.start_date && c.end_date
                          ? `${c.start_date} ～ ${c.end_date}`
                          : c.location}
                      </p>
                    </div>
                    <Link
                      href="/login"
                      className="inline-flex items-center gap-1 text-sm font-bold text-[#16a34a] hover:underline shrink-0"
                    >
                      申し込む <ArrowRight className="w-4 h-4" />
                    </Link>
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

  if (loading && !project) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
          <p className="text-slate-600 font-medium">読み込み中...</p>
        </div>
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
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-green-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        {/* 農家ダッシュボード: 予約募集 */}
        {project ? (
          <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#16a34a]" />
                <p className="text-slate-700 font-bold">募集中の案件</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 flex items-center gap-1">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <span className="text-blue-700 font-bold text-xs">
                    累計: {totalCampaignArea.toFixed(1)} 反
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-green-50 px-4 py-2 rounded-full border border-green-200">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-green-700 font-bold text-sm">募集中</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
              <section className="order-2 lg:order-1">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 h-[500px] lg:h-[700px] relative">
                  <div className="absolute top-6 left-6 z-[1000] bg-white/95 backdrop-blur px-4 py-2 rounded-xl shadow-md border border-slate-200 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-[#16a34a]" />
                    <div>
                      <h2 className="text-sm font-bold text-slate-600">圃場を描画</h2>
                      <p className="text-xs text-slate-500">地図上でクリックして圃場の範囲を指定</p>
                    </div>
                  </div>
                  {area10r > 0 && (
                    <div className="absolute top-6 right-6 z-[1000] bg-[#16a34a] text-white px-5 py-3 rounded-xl shadow-sm border-2 border-green-500 min-w-[180px]">
                      <div className="text-xs font-bold uppercase tracking-wider mb-1 opacity-90">選択面積</div>
                      <div className="text-3xl font-black">
                        {area10r.toFixed(2)} <span className="text-sm font-normal opacity-90">反</span>
                      </div>
                    </div>
                  )}
                  <div className="w-full h-full rounded-xl overflow-hidden">
                    <PolygonMap
                      onPolygonComplete={handlePolygonComplete}
                      initialPolygon={coords || undefined}
                    />
                  </div>
                </div>
              </section>
              <section className="order-1 lg:order-2">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <CampaignForm
                    project={project}
                    area10r={area10r}
                    totalCampaignArea={totalCampaignArea}
                    onSubmit={handleFormSubmit}
                  />
                </div>
              </section>
            </div>
          </>
        ) : (
          <div className="mb-8 p-6 bg-white rounded-2xl shadow-sm border border-slate-200 text-center">
            <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">現在募集中の案件はありません</p>
          </div>
        )}

        {/* 申込履歴 */}
        <section id="applications" className="mb-10">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#16a34a]" />
            申込履歴
          </h2>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {farmerBookings.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">
                まだ申込がありません。
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {farmerBookings.map((b) => (
                  <li key={b.id} className="p-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-800">
                        {b.project?.campaign_title || b.project?.location || b.campaign_id}
                      </p>
                      <p className="text-sm text-slate-500">
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
          </div>
        </section>

        {/* My畑管理（プレースホルダー） */}
        <section id="my-field">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Sprout className="w-5 h-5 text-[#16a34a]" />
            My畑管理
          </h2>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-center">
            <p className="text-slate-500 text-sm">
              圃場情報の登録・管理は今後提供予定です。
            </p>
          </div>
        </section>

        <footer className="mt-8 text-center text-sm text-slate-500">
          <p>ご不明な点がございましたら、お気軽にお問い合わせください。</p>
        </footer>
      </div>
    </main>
  );
}
