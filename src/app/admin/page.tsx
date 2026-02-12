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
  Loader2,
  ArrowRight,
  UserCheck,
  Building2,
} from 'lucide-react';
import { getCurrentUser, type User } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { closeCampaign } from '@/lib/api';
import { toast } from 'sonner';

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
        .select('id, campaign_title, location, final_date, status, is_closed')
        .eq('provider_id', user.id)
        .in('status', ['open', 'closed', 'applied'])
        .order('start_date', { ascending: true })
        .limit(10)
        .then(({ data: projs }) => {
          if (!projs?.length) {
            setUpcomingWork([]);
            return;
          }
          const ids = projs.map((p) => p.id);
          supabase
            .from('bookings')
            .select('campaign_id, confirmed_date')
            .in('campaign_id', ids)
            .neq('status', 'canceled')
            .then(({ data: bookings }) => {
              const byCampaign = new Map<string, { confirmed_date: string; count: number }>();
              (bookings || []).forEach((b) => {
                const key = b.campaign_id;
                const prev = byCampaign.get(key) || { confirmed_date: '', count: 0 };
                prev.count += 1;
                if ((b as any).confirmed_date) prev.confirmed_date = (b as any).confirmed_date;
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
            });
        });
    }
  }, [user, refreshKey]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
          <p className="text-slate-600 font-medium">読み込み中...</p>
        </div>
      </main>
    );
  }

  if (!user || (user.role !== 'admin' && user.role !== 'provider')) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow border border-slate-200 text-center">
          <p className="text-slate-600">この画面を利用する権限がありません。</p>
        </div>
      </main>
    );
  }

  if (user.role === 'admin') {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2 mb-6">
            <LayoutDashboard className="w-7 h-7 text-green-600" />
            Platform Admin
          </h1>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <Link
              href="/admin/users"
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md hover:border-green-200 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-amber-50">
                  <UserCheck className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-500">承認待ちユーザー</p>
                  <p className="text-2xl font-black text-slate-800">{pendingCount}</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-green-600" />
            </Link>
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-green-50">
                  <FileText className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-500">募集中案件数</p>
                  <p className="text-2xl font-black text-slate-800">{openCampaignsCount}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-slate-500" />
              <h2 className="font-bold text-slate-700">クイックリンク</h2>
            </div>
            <ul className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <li>
                <Link
                  href="/admin/users"
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 hover:border-green-200 transition-colors"
                >
                  <UserCheck className="w-5 h-5 text-amber-600" />
                  <span className="font-bold text-slate-700">ユーザー承認管理</span>
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </main>
    );
  }

  // Provider dashboard: 直近の作業予定 + クイックリンク
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2 mb-6">
          <LayoutDashboard className="w-7 h-7 text-green-600" />
          ダッシュボード
        </h1>

        <section className="mb-8">
          <h2 className="font-bold text-slate-700 flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-green-600" />
            直近の作業予定
          </h2>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {upcomingWork.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                直近の案件はありません。新規案件を作成してください。
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {upcomingWork.map((w) => (
                  <li key={w.id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-800">{w.campaign_title || w.location}</p>
                      <p className="text-sm text-slate-500">
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
                          className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 text-sm font-bold hover:bg-amber-200 border border-amber-300"
                        >
                          募集締切
                        </button>
                      )}
                      <Link
                        href="/provider/calendar"
                        className="text-sm font-bold text-green-600 hover:underline flex items-center gap-1"
                      >
                        カレンダー <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section>
          <h2 className="font-bold text-slate-700 flex items-center gap-2 mb-4">メニュー</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href="/admin/campaigns/new"
              className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-green-200 transition-all"
            >
              <div className="p-3 rounded-xl bg-green-50">
                <PlusCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="font-bold text-slate-800">案件を作成</p>
                <p className="text-sm text-slate-500">新規募集を開始</p>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-300 ml-auto" />
            </Link>
            <Link
              href="/provider/calendar"
              className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-green-200 transition-all"
            >
              <div className="p-3 rounded-xl bg-blue-50">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="font-bold text-slate-800">作業カレンダー</p>
                <p className="text-sm text-slate-500">予定の確認・管理</p>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-300 ml-auto" />
            </Link>
            <Link
              href="/admin/masters"
              className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-green-200 transition-all"
            >
              <div className="p-3 rounded-xl bg-slate-100">
                <Package className="w-6 h-6 text-slate-600" />
              </div>
              <div>
                <p className="font-bold text-slate-800">マスタ管理</p>
                <p className="text-sm text-slate-500">品目・作業種別・農薬</p>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-300 ml-auto" />
            </Link>
            <Link
              href="/admin/users"
              className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-green-200 transition-all"
            >
              <div className="p-3 rounded-xl bg-amber-50">
                <Building2 className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="font-bold text-slate-800">紐付き農家一覧</p>
                <p className="text-sm text-slate-500">自分に紐付いている農家</p>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-300 ml-auto" />
            </Link>
            <Link
              href="/provider/reports/new"
              className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-green-200 transition-all"
            >
              <div className="p-3 rounded-xl bg-purple-50">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="font-bold text-slate-800">実績報告</p>
                <p className="text-sm text-slate-500">作業完了の報告</p>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-300 ml-auto" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
