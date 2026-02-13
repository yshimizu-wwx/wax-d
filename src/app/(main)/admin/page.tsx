'use client';

import { useState, useEffect, useMemo } from 'react';
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
  CalendarRange,
  FolderKanban,
  ListTodo,
  Receipt,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import AppLoader from '@/components/AppLoader';
import { getCurrentUser, type User } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { closeCampaign } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  getReportDeadlineAlert,
  getRecruitmentDeadlineAlert,
} from '@/lib/statusHelper';
import { cn } from '@/lib/utils';

/** 集客セクション用: 募集中の案件＋応募状況 */
interface RecruitmentItem {
  id: string;
  campaign_title: string | null;
  location: string;
  status: string;
  final_date: string | null;
  end_date: string | null;
  start_date: string | null;
  is_closed: boolean | null;
  application_count: number;
  total_area_10r: number;
}

/** 作業・報告セクション用: 未報告の予約（作業日確定済み） */
interface OperationItem {
  id: string;
  campaign_id: string;
  campaign_title: string | null;
  location: string;
  farmer_name: string | null;
  area_10r: number;
  work_status: string | null;
  confirmed_date: string | null;
}

/** 請求・完了セクション用: 報告済み案件の請求状況 */
interface BillingItem {
  campaign_id: string;
  campaign_title: string | null;
  location: string | null;
  completed_count: number;
  total_amount: number;
  invoice_status: 'unbilled' | 'sent' | 'processed' | 'invoiced';
  has_unbilled: boolean;
}

export default function AdminDashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [openCampaignsCount, setOpenCampaignsCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [recruitmentList, setRecruitmentList] = useState<RecruitmentItem[]>([]);
  const [operationList, setOperationList] = useState<OperationItem[]>([]);
  const [billingList, setBillingList] = useState<BillingItem[]>([]);

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
        .from('campaigns')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'open')
        .then(({ count }) => setOpenCampaignsCount(count ?? 0));
    }

    if (user.role === 'provider') {
      (async () => {
        const { data: campaigns } = await supabase
          .from('campaigns')
          .select('id, campaign_title, location, final_date, start_date, end_date, status, is_closed')
          .eq('provider_id', user.id)
          .in('status', ['open', 'applied', 'closed', 'completed', 'archived'])
          .order('start_date', { ascending: true });

        const list = (campaigns ?? []) as Array<{
          id: string;
          campaign_title: string | null;
          location: string;
          final_date: string | null;
          start_date: string | null;
          end_date: string | null;
          status: string;
          is_closed: boolean | null;
        }>;
        if (list.length === 0) {
          setRecruitmentList([]);
          setOperationList([]);
          setBillingList([]);
          return;
        }
        const campaignIds = list.map((c) => c.id);
        const { data: bookings } = await supabase
          .from('bookings')
          .select('id, campaign_id, farmer_id, farmer_name, area_10r, work_status, confirmed_date, final_amount, invoice_status')
          .in('campaign_id', campaignIds)
          .neq('status', 'canceled');

        const bookingsList = (bookings ?? []) as Array<{
          id: string;
          campaign_id: string;
          farmer_name: string | null;
          area_10r: number;
          work_status: string | null;
          confirmed_date: string | null;
          final_amount: number | null;
          invoice_status: string | null;
        }>;
        const campaignMap = new Map(list.map((c) => [c.id, c]));

        const recruitment: RecruitmentItem[] = list
          .filter((c) => c.status === 'open' || c.status === 'applied')
          .map((c) => {
            const forCampaign = bookingsList.filter((b) => b.campaign_id === c.id);
            return {
              id: c.id,
              campaign_title: c.campaign_title,
              location: c.location,
              status: c.status,
              final_date: c.final_date,
              end_date: c.end_date,
              start_date: c.start_date,
              is_closed: c.is_closed,
              application_count: forCampaign.length,
              total_area_10r: forCampaign.reduce((s, b) => s + (Number(b.area_10r) || 0), 0),
            };
          });

        const closedCampaignIds = new Set(
          list.filter((c) => ['closed', 'completed', 'archived'].includes(c.status)).map((c) => c.id)
        );
        const operation: OperationItem[] = bookingsList
          .filter((b) => b.work_status !== 'completed' && closedCampaignIds.has(b.campaign_id))
          .map((b) => {
            const camp = campaignMap.get(b.campaign_id);
            return {
              id: b.id,
              campaign_id: b.campaign_id,
              campaign_title: camp?.campaign_title ?? null,
              location: camp?.location ?? '',
              farmer_name: b.farmer_name,
              area_10r: b.area_10r,
              work_status: b.work_status,
              confirmed_date: b.confirmed_date,
            };
          });

        const completedByCampaign = new Map<
          string,
          { count: number; total: number; unbilled: number; statuses: Set<string> }
        >();
        bookingsList
          .filter((b) => b.work_status === 'completed')
          .forEach((b) => {
            const prev = completedByCampaign.get(b.campaign_id) ?? {
              count: 0,
              total: 0,
              unbilled: 0,
              statuses: new Set<string>(),
            };
            prev.count += 1;
            prev.total += Number(b.final_amount) || 0;
            if (b.invoice_status === 'unbilled') prev.unbilled += 1;
            if (b.invoice_status) prev.statuses.add(b.invoice_status);
            completedByCampaign.set(b.campaign_id, prev);
          });
        const billing: BillingItem[] = Array.from(completedByCampaign.entries()).map(
          ([campaign_id, agg]) => {
            const camp = campaignMap.get(campaign_id);
            const has_unbilled = agg.unbilled > 0;
            let invoice_status: BillingItem['invoice_status'] = 'invoiced';
            if (agg.statuses.has('unbilled')) invoice_status = 'unbilled';
            else if (agg.statuses.has('sent') || agg.statuses.has('processed')) invoice_status = 'sent';
            else if (agg.statuses.has('invoiced')) invoice_status = 'invoiced';
            return {
              campaign_id,
              campaign_title: camp?.campaign_title ?? null,
              location: camp?.location ?? null,
              completed_count: agg.count,
              total_amount: agg.total,
              invoice_status,
              has_unbilled: has_unbilled,
            };
          }
        );

        setRecruitmentList(recruitment);
        setOperationList(operation);
        setBillingList(billing);
      })();
    }
  }, [user, refreshKey]);

  const recruitmentSorted = useMemo(() => {
    return [...recruitmentList].sort((a, b) => {
      const deadlineA = a.final_date || a.end_date || a.start_date || '';
      const deadlineB = b.final_date || b.end_date || b.start_date || '';
      const alertA = getRecruitmentDeadlineAlert(deadlineA);
      const alertB = getRecruitmentDeadlineAlert(deadlineB);
      if (alertA === 'overdue' && alertB !== 'overdue') return -1;
      if (alertA !== 'overdue' && alertB === 'overdue') return 1;
      if (alertA === 'soon' && alertB !== 'soon') return -1;
      if (alertA !== 'soon' && alertB === 'soon') return 1;
      return (deadlineA || '9999').localeCompare(deadlineB || '9999');
    });
  }, [recruitmentList]);

  const operationSorted = useMemo(() => {
    return [...operationList].sort((a, b) => {
      const alertA = getReportDeadlineAlert(a.confirmed_date);
      const alertB = getReportDeadlineAlert(b.confirmed_date);
      if (alertA === 'overdue' && alertB !== 'overdue') return -1;
      if (alertA !== 'overdue' && alertB === 'overdue') return 1;
      if (alertA === 'soon' && alertB !== 'soon') return -1;
      if (alertA !== 'soon' && alertB === 'soon') return 1;
      const dA = a.confirmed_date ? new Date(a.confirmed_date).getTime() : 0;
      const dB = b.confirmed_date ? new Date(b.confirmed_date).getTime() : 0;
      return dA - dB;
    });
  }, [operationList]);

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

        {/* 上段: 集客・案件管理 */}
        <section className="mb-8">
          <h2 className="text-base font-bold text-dashboard-text flex items-center gap-2 mb-4">
            <FolderKanban className="w-5 h-5 text-agrix-forest" />
            集客・案件管理
          </h2>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">募集中の案件</CardTitle>
              <CardDescription>応募状況の確認・募集締切</CardDescription>
            </CardHeader>
            <CardContent>
              {recruitmentSorted.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-dashboard-muted font-medium mb-3">募集中の案件はありません</p>
                  <Link href="/admin/campaigns/new">
                    <Button className="gap-2 bg-agrix-forest hover:bg-agrix-forest-dark">
                      <PlusCircle className="w-4 h-4" />
                      案件を作成
                    </Button>
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-dashboard-border">
                  {recruitmentSorted.map((c) => {
                    const deadline = c.final_date || c.end_date || c.start_date;
                    const deadlineAlert = getRecruitmentDeadlineAlert(deadline);
                    return (
                      <li
                        key={c.id}
                        className={cn(
                          'p-4 flex flex-wrap items-center justify-between gap-3 rounded-xl -mx-1 transition-colors',
                          deadlineAlert === 'overdue' && 'bg-red-500/10 border border-red-500/30',
                          deadlineAlert === 'soon' && 'bg-amber-500/10 border border-amber-500/30'
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-dashboard-text">
                              {c.campaign_title || c.location || '（無題）'}
                            </p>
                            {deadlineAlert === 'overdue' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                締切超過
                              </span>
                            )}
                            {deadlineAlert === 'soon' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-bold">
                                <Clock className="w-3.5 h-3.5" />
                                締切が近い
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-dashboard-muted mt-0.5">
                            応募 {c.application_count} 件 · 合計 {c.total_area_10r.toFixed(1)} 反
                            {deadline
                              ? ` · 締切 ${new Date(deadline).toLocaleDateString('ja-JP')}`
                              : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-agrix-gold/50 text-agrix-gold-dark hover:bg-agrix-gold/20"
                            onClick={async () => {
                              const res = await closeCampaign(c.id);
                              if (res.success) {
                                toast.success('募集を締め切りました');
                                setRefreshKey((k) => k + 1);
                              } else {
                                toast.error(res.error ?? '締切に失敗しました');
                              }
                            }}
                          >
                            募集締切
                          </Button>
                          <Link
                            href="/provider/projects"
                            className="inline-flex items-center gap-1 text-sm font-bold text-agrix-forest hover:underline"
                          >
                            案件 <ArrowRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>

        {/* 中段: 作業実績・報告 */}
        <section className="mb-8">
          <h2 className="text-base font-bold text-dashboard-text flex items-center gap-2 mb-4">
            <ListTodo className="w-5 h-5 text-agrix-forest" />
            作業実績・報告
          </h2>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">作業日確定済み・未報告</CardTitle>
              <CardDescription>実績報告が必要な予約</CardDescription>
            </CardHeader>
            <CardContent>
              {operationSorted.length === 0 ? (
                <div className="py-10 text-center text-dashboard-muted">
                  <p className="font-medium mb-1">未報告の作業はありません</p>
                  <p className="text-sm">
                    案件を「日付確定」まで進めると、ここに表示されます。
                  </p>
                  <Link href="/provider/projects" className="inline-block mt-3">
                    <Button variant="outline" size="sm">
                      案件一覧へ
                    </Button>
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-dashboard-border">
                  {operationSorted.map((b) => {
                    const reportAlert = getReportDeadlineAlert(b.confirmed_date);
                    return (
                      <li
                        key={b.id}
                        className={cn(
                          'p-4 flex flex-wrap items-center justify-between gap-3 rounded-xl -mx-1 transition-colors',
                          reportAlert === 'overdue' && 'bg-red-500/10 border border-red-500/30',
                          reportAlert === 'soon' && 'bg-amber-500/10 border border-amber-500/30'
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-dashboard-text">
                              {b.campaign_title || b.location || '案件'}
                            </p>
                            {reportAlert === 'overdue' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                報告期限切れ
                              </span>
                            )}
                            {reportAlert === 'soon' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-bold">
                                <Clock className="w-3.5 h-3.5" />
                                期日が近い
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-dashboard-muted mt-0.5">
                            {b.farmer_name || '農家'}
                            {' · '}
                            {b.confirmed_date
                              ? new Date(b.confirmed_date).toLocaleDateString('ja-JP')
                              : '日付未定'}
                            {' · '}
                            {b.area_10r} 反
                          </p>
                        </div>
                        <Link href="/provider/reports/new">
                          <Button size="sm" className="gap-1 bg-agrix-forest hover:bg-agrix-forest-dark">
                            <FileText className="w-4 h-4" />
                            実績報告
                          </Button>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>

        {/* 下段: 請求・完了 */}
        <section className="mb-8">
          <h2 className="text-base font-bold text-dashboard-text flex items-center gap-2 mb-4">
            <Receipt className="w-5 h-5 text-agrix-forest" />
            請求・完了
          </h2>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">報告済み・請求状況</CardTitle>
              <CardDescription>請求待ち・送付済・完了案件</CardDescription>
            </CardHeader>
            <CardContent>
              {billingList.length === 0 ? (
                <div className="py-10 text-center text-dashboard-muted">
                  <p className="font-medium">報告済みの案件はまだありません</p>
                  <Link href="/provider/reports/new" className="inline-block mt-3">
                    <Button variant="outline" size="sm" className="gap-2">
                      <FileText className="w-4 h-4" />
                      実績報告をする
                    </Button>
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-dashboard-border">
                  {billingList.map((item) => (
                    <li key={item.campaign_id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-dashboard-text">
                          {item.campaign_title || item.location || '（無題）'}
                        </p>
                        <p className="text-sm text-dashboard-muted mt-0.5">
                          報告済み {item.completed_count} 件
                          {item.total_amount > 0 && ` · 合計 ¥${item.total_amount.toLocaleString()}`}
                          {' · '}
                          {item.invoice_status === 'unbilled' && '請求待ち'}
                          {(item.invoice_status === 'sent' || item.invoice_status === 'processed') && '送付済'}
                          {item.invoice_status === 'invoiced' && '完了'}
                        </p>
                      </div>
                      <Link
                        href="/provider/billings"
                        className="inline-flex items-center gap-1 text-sm font-bold text-agrix-forest hover:underline"
                      >
                        請求 <ArrowRight className="w-4 h-4" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>

        {/* メニュー */}
        <section>
          <h2 className="text-base font-bold text-dashboard-text flex items-center gap-2 mb-4">メニュー</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            <Link
              href="/provider/projects"
              className="flex items-center gap-4 p-4 rounded-2xl border border-dashboard-border bg-dashboard-card shadow-sm hover:shadow-md hover:border-agrix-forest/30 transition-all"
            >
              <div className="p-3 rounded-xl bg-agrix-forest/10">
                <PlusCircle className="w-6 h-6 text-agrix-forest" />
              </div>
              <div>
                <p className="font-bold text-dashboard-text">案件</p>
                <p className="text-sm text-dashboard-muted">作成・募集・締切・確定</p>
              </div>
              <ArrowRight className="w-5 h-5 text-dashboard-muted ml-auto" />
            </Link>
            <Link
              href="/provider/tasks"
              className="flex items-center gap-4 p-4 rounded-2xl border border-dashboard-border bg-dashboard-card shadow-sm hover:shadow-md hover:border-agrix-forest/30 transition-all"
            >
              <div className="p-3 rounded-xl bg-agrix-forest/10">
                <Calendar className="w-6 h-6 text-agrix-forest" />
              </div>
              <div>
                <p className="font-bold text-dashboard-text">作業</p>
                <p className="text-sm text-dashboard-muted">予定・完了・実績報告</p>
              </div>
              <ArrowRight className="w-5 h-5 text-dashboard-muted ml-auto" />
            </Link>
            <Link
              href="/provider/billings"
              className="flex items-center gap-4 p-4 rounded-2xl border border-dashboard-border bg-dashboard-card shadow-sm hover:shadow-md hover:border-agrix-forest/30 transition-all"
            >
              <div className="p-3 rounded-xl bg-agrix-gold/20">
                <FileText className="w-6 h-6 text-agrix-gold" />
              </div>
              <div>
                <p className="font-bold text-dashboard-text">請求</p>
                <p className="text-sm text-dashboard-muted">請求管理・印刷</p>
              </div>
              <ArrowRight className="w-5 h-5 text-dashboard-muted ml-auto" />
            </Link>
            <Link
              href="/provider/settings"
              className="flex items-center gap-4 p-4 rounded-2xl border border-dashboard-border bg-dashboard-card shadow-sm hover:shadow-md hover:border-agrix-forest/30 transition-all"
            >
              <div className="p-3 rounded-xl bg-dashboard-muted/20">
                <Package className="w-6 h-6 text-agrix-slate" />
              </div>
              <div>
                <p className="font-bold text-dashboard-text">設定</p>
                <p className="text-sm text-dashboard-muted">農家・マスタ・自社情報</p>
              </div>
              <ArrowRight className="w-5 h-5 text-dashboard-muted ml-auto" />
            </Link>
            <Link
              href="/provider/calendar"
              className="flex items-center gap-4 p-4 rounded-2xl border border-dashboard-border bg-dashboard-card shadow-sm hover:shadow-md hover:border-agrix-forest/30 transition-all"
            >
              <div className="p-3 rounded-xl bg-agrix-forest/10">
                <CalendarRange className="w-6 h-6 text-agrix-forest" />
              </div>
              <div>
                <p className="font-bold text-dashboard-text">カレンダー</p>
                <p className="text-sm text-dashboard-muted">予定の確認</p>
              </div>
              <ArrowRight className="w-5 h-5 text-dashboard-muted ml-auto" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
