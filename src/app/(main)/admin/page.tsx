'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  Package,
  Calendar,
  FileText,
  PlusCircle,
  ArrowRight,
  UserCheck,
  Building2,
  Landmark,
  CircleDollarSign,
  CalendarRange,
} from 'lucide-react';
import AppLoader from '@/components/AppLoader';
import { getCurrentUser, type User } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { closeCampaign, fetchCampaignTotalArea } from '@/lib/api';
import { calculateCurrentUnitPrice } from '@/lib/calculator/priceCalculator';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface UpcomingWork {
  id: string;
  campaign_title: string;
  location: string;
  confirmed_date: string;
  final_date: string;
  booking_count: number;
  status: string;
  is_closed: boolean;
}

export default function AdminDashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [upcomingWork, setUpcomingWork] = useState<UpcomingWork[]>([]);
  const [openCampaignsCount, setOpenCampaignsCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [providerKpi, setProviderKpi] = useState<{ totalArea10r: number; currentUnitPrice: number | null }>({ totalArea10r: 0, currentUnitPrice: null });
  const [kpiTotalArea, setKpiTotalArea] = useState<number>(0);
  const [kpiCurrentUnitPrice, setKpiCurrentUnitPrice] = useState<number | null>(null);

  useEffect(() => {
    getCurrentUser().then((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) return;

    if (user.role === 'admin') {
      supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .then(({ count }) => setPendingCount(count ?? 0));
      supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'open')
        .then(({ count }) => setOpenCampaignsCount(count ?? 0));
    }

    if (user.role === 'provider') {
      supabase
        .from('projects')
        .select('id, campaign_title, location, final_date, status, is_closed, base_price, min_price, target_area_10r, min_target_area_10r, max_target_area_10r, execution_price')
        .eq('provider_id', user.id)
        .in('status', ['open', 'closed', 'applied'])
        .order('start_date', { ascending: true })
        .limit(10)
        .then(({ data: projs }) => {
          if (!projs?.length) {
            setUpcomingWork([]);
            setProviderKpi({ totalArea10r: 0, currentUnitPrice: null });
            return;
          }
          const ids = projs.map((p) => p.id);
          Promise.all([
            supabase.from('bookings').select('campaign_id, confirmed_date, area_10r').in('campaign_id', ids).neq('status', 'canceled'),
            ...ids.map((id) => fetchCampaignTotalArea(id)),
          ]).then(([bookingsRes, ...totals]) => {
            const bookings = ((bookingsRes as { data: unknown[] }).data || []) as Array<{ campaign_id: string; confirmed_date?: string; area_10r?: number }>;
            const byCampaign = new Map<string, { confirmed_date: string; count: number }>();
            bookings.forEach((b) => {
              const key = b.campaign_id;
              const prev = byCampaign.get(key) || { confirmed_date: '', count: 0 };
              prev.count += 1;
              if (b.confirmed_date) prev.confirmed_date = b.confirmed_date;
              byCampaign.set(key, prev);
            });
            const list: UpcomingWork[] = projs.map((p) => {
              const info = byCampaign.get(p.id) || { confirmed_date: '', count: 0 };
              return {
                id: p.id,
                campaign_title: (p as any).campaign_title || p.location || '案件',
                location: (p as any).location || '',
                confirmed_date: info.confirmed_date,
                final_date: (p as any).final_date || '',
                booking_count: info.count,
                status: (p as any).status ?? '',
                is_closed: (p as any).is_closed ?? false,
              };
            });
            setUpcomingWork(list.slice(0, 5));

            const totalArea10r = (totals as number[]).reduce((a, b) => a + b, 0);
            const openProj = projs.find((p: { is_closed?: boolean; status?: string }) => !p.is_closed && (p.status === 'open' || p.status === 'applied'));
            let currentUnitPrice: number | null = null;
            if (openProj && openProj.id) {
              const idx = ids.indexOf(openProj.id);
              const total = idx >= 0 ? (totals as number[])[idx] ?? 0 : 0;
              const res = calculateCurrentUnitPrice(
                {
                  base_price: (openProj as any).base_price || 0,
                  min_price: (openProj as any).min_price || 0,
                  target_area_10r: (openProj as any).target_area_10r || 0,
                  min_target_area_10r: (openProj as any).min_target_area_10r,
                  max_target_area_10r: (openProj as any).max_target_area_10r,
                  execution_price: (openProj as any).execution_price,
                },
                total
              );
              currentUnitPrice = res.currentPrice;
            }
            setProviderKpi({ totalArea10r, currentUnitPrice });
          });
        });
    }
  }, [user, refreshKey]);

  if (loading) {
    return (
      <main className="min-h-full flex items-center justify-center">
        <AppLoader message="読み込み中..." />
      </main>
    );
  }

  if (!user || (user.role !== 'admin' && user.role !== 'provider')) {
    return (
      <main className="min-h-full flex items-center justify-center p-4">
        <Card>
          <CardContent className="p-8 text-center text-dashboard-muted">
            この画面を利用する権限がありません。
          </CardContent>
        </Card>
      </main>
    );
  }

  if (user.role === 'admin') {
    return (
      <main className="min-h-full">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 md:py-8">
          <h1 className="text-xl md:text-2xl font-black text-dashboard-text flex items-center gap-2 mb-6">
            <LayoutDashboard className="w-6 h-6 text-agrix-forest" />
            Platform Admin
          </h1>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6">
            <Link href="/admin/users" className="block group">
              <Card className="h-full transition-all hover:shadow-md hover:border-agrix-forest/30">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-agrix-gold/20">
                      <UserCheck className="w-6 h-6 text-agrix-gold" />
                    </div>
                    <div>
                      <CardTitle className="text-base">承認待ちユーザー</CardTitle>
                      <CardDescription>未承認の申請</CardDescription>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-dashboard-muted group-hover:text-agrix-forest transition-colors" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl md:text-3xl font-black text-dashboard-text tabular-nums">{pendingCount}</p>
                  <span className="text-sm text-dashboard-muted">件</span>
                </CardContent>
              </Card>
            </Link>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-agrix-forest/10">
                    <FileText className="w-6 h-6 text-agrix-forest" />
                  </div>
                  <div>
                    <CardTitle className="text-base">募集中案件数</CardTitle>
                    <CardDescription>オープンな案件</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl md:text-3xl font-black text-dashboard-text tabular-nums">{openCampaignsCount}</p>
                <span className="text-sm text-dashboard-muted">件</span>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-agrix-forest" />
                <CardTitle className="text-base">クイックリンク</CardTitle>
              </div>
              <CardDescription>管理メニューへすばやくアクセス</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <li>
                  <Link
                    href="/admin/users"
                    className="flex items-center gap-3 p-4 rounded-xl border border-dashboard-border hover:bg-dashboard-bg hover:border-agrix-forest/20 transition-colors"
                  >
                    <UserCheck className="w-5 h-5 text-agrix-gold shrink-0" />
                    <span className="font-bold text-dashboard-text">ユーザー承認管理</span>
                  </Link>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-full">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 md:py-8">
        <h1 className="text-xl md:text-2xl font-black text-dashboard-text flex items-center gap-2 mb-6">
          <LayoutDashboard className="w-6 h-6 text-agrix-forest" />
          ダッシュボード
        </h1>

        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-agrix-forest/10">
                  <Landmark className="w-6 h-6 text-agrix-forest" />
                </div>
                <div>
                  <CardTitle className="text-base">合計面積</CardTitle>
                  <CardDescription>直近案件の申込合計</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl md:text-3xl font-black text-agrix-forest tabular-nums">
                {providerKpi.totalArea10r.toFixed(1)}
                <span className="text-base font-medium text-dashboard-muted ml-1">反</span>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-agrix-gold/20">
                  <CircleDollarSign className="w-6 h-6 text-agrix-gold" />
                </div>
                <div>
                  <CardTitle className="text-base">現在の単価</CardTitle>
                  <CardDescription>募集中案件の暫定単価</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl md:text-3xl font-black tabular-nums">
                {providerKpi.currentUnitPrice != null ? (
                  <>
                    <span className="text-agrix-gold">¥{providerKpi.currentUnitPrice.toLocaleString()}</span>
                    <span className="text-base font-medium text-dashboard-muted ml-1">/10a</span>
                  </>
                ) : (
                  <span className="text-dashboard-muted font-medium text-xl">—</span>
                )}
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="mb-6">
          <h2 className="text-base font-bold text-dashboard-text flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-agrix-forest" />
            直近の作業予定
          </h2>
          <Card>
            {upcomingWork.length === 0 ? (
              <CardContent className="p-10 flex flex-col items-center justify-center text-center">
                <div className="rounded-full bg-dashboard-muted/20 p-6 mb-4">
                  <CalendarRange className="w-12 h-12 text-dashboard-muted" />
                </div>
                <p className="font-bold text-dashboard-text mb-1">現在予定はありません</p>
                <p className="text-sm text-dashboard-muted mb-6 max-w-sm">
                  新規案件を作成すると、ここに直近の作業予定が表示されます。
                </p>
                <Link
                  href="/admin/campaigns/new"
                  className="inline-flex items-center gap-2 rounded-xl bg-agrix-forest text-white px-5 py-2.5 text-sm font-bold hover:bg-agrix-forest-dark transition-colors"
                >
                  <PlusCircle className="w-4 h-4" />
                  案件を作成
                </Link>
              </CardContent>
            ) : (
              <ul className="divide-y divide-dashboard-border">
                {upcomingWork.map((w) => (
                  <li key={w.id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-dashboard-text">{w.campaign_title || w.location}</p>
                      <p className="text-sm text-dashboard-muted">
                        {w.confirmed_date || w.final_date
                          ? new Date(w.confirmed_date || w.final_date).toLocaleDateString('ja-JP')
                          : '日付未確定'}
                        {' · '}
                        申込 {w.booking_count} 件
                        {w.is_closed || w.status === 'closed' ? ' · 締切済' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!w.is_closed && (w.status === 'open' || w.status === 'applied') && (
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await closeCampaign(w.id);
                            if (res.success) {
                              toast.success('募集を締め切りました');
                              setRefreshKey((k) => k + 1);
                            } else {
                              toast.error(res.error ?? '締切に失敗しました');
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-agrix-gold/20 text-agrix-gold-dark text-sm font-bold hover:bg-agrix-gold/30 border border-agrix-gold/50"
                        >
                          募集締切
                        </button>
                      )}
                      <Link
                        href="/provider/calendar"
                        className="text-sm font-bold text-agrix-forest hover:underline flex items-center gap-1"
                      >
                        カレンダー <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        <section>
          <h2 className="text-base font-bold text-dashboard-text flex items-center gap-2 mb-4">メニュー</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            <Link
              href="/admin/campaigns/new"
              className="flex items-center gap-4 p-4 rounded-2xl border border-dashboard-border bg-dashboard-card shadow-sm hover:shadow-md hover:border-agrix-forest/30 transition-all"
            >
              <div className="p-3 rounded-xl bg-agrix-forest/10">
                <PlusCircle className="w-6 h-6 text-agrix-forest" />
              </div>
              <div>
                <p className="font-bold text-dashboard-text">案件を作成</p>
                <p className="text-sm text-dashboard-muted">新規募集を開始</p>
              </div>
              <ArrowRight className="w-5 h-5 text-dashboard-muted ml-auto" />
            </Link>
            <Link
              href="/provider/calendar"
              className="flex items-center gap-4 p-4 rounded-2xl border border-dashboard-border bg-dashboard-card shadow-sm hover:shadow-md hover:border-agrix-forest/30 transition-all"
            >
              <div className="p-3 rounded-xl bg-agrix-forest/10">
                <Calendar className="w-6 h-6 text-agrix-forest" />
              </div>
              <div>
                <p className="font-bold text-dashboard-text">作業カレンダー</p>
                <p className="text-sm text-dashboard-muted">予定の確認・管理</p>
              </div>
              <ArrowRight className="w-5 h-5 text-dashboard-muted ml-auto" />
            </Link>
            <Link
              href="/admin/masters"
              className="flex items-center gap-4 p-4 rounded-2xl border border-dashboard-border bg-dashboard-card shadow-sm hover:shadow-md hover:border-agrix-forest/30 transition-all"
            >
              <div className="p-3 rounded-xl bg-dashboard-muted/20">
                <Package className="w-6 h-6 text-agrix-slate" />
              </div>
              <div>
                <p className="font-bold text-dashboard-text">マスタ管理</p>
                <p className="text-sm text-dashboard-muted">品目・作業種別・農薬</p>
              </div>
              <ArrowRight className="w-5 h-5 text-dashboard-muted ml-auto" />
            </Link>
            <Link
              href="/admin/users"
              className="flex items-center gap-4 p-4 rounded-2xl border border-dashboard-border bg-dashboard-card shadow-sm hover:shadow-md hover:border-agrix-forest/30 transition-all"
            >
              <div className="p-3 rounded-xl bg-agrix-gold/20">
                <Building2 className="w-6 h-6 text-agrix-gold" />
              </div>
              <div>
                <p className="font-bold text-dashboard-text">紐付き農家一覧</p>
                <p className="text-sm text-dashboard-muted">自分に紐付いている農家</p>
              </div>
              <ArrowRight className="w-5 h-5 text-dashboard-muted ml-auto" />
            </Link>
            <Link
              href="/provider/reports/new"
              className="flex items-center gap-4 p-4 rounded-2xl border border-dashboard-border bg-dashboard-card shadow-sm hover:shadow-md hover:border-agrix-forest/30 transition-all"
            >
              <div className="p-3 rounded-xl bg-agrix-gold/20">
                <FileText className="w-6 h-6 text-agrix-gold" />
              </div>
              <div>
                <p className="font-bold text-dashboard-text">実績報告</p>
                <p className="text-sm text-dashboard-muted">作業完了の報告</p>
              </div>
              <ArrowRight className="w-5 h-5 text-dashboard-muted ml-auto" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
