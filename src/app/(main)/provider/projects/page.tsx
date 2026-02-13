'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FolderKanban,
  PlusCircle,
  Copy,
  Calendar,
  ChevronRight,
  FileCheck,
  Clock,
  CheckCircle2,
  CalendarRange,
  CalendarDays,
  User as UserIcon,
} from 'lucide-react';
import { getCurrentUser, type User } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import {
  closeCampaign,
  setWorkConfirmBulk,
  setWorkConfirmIndividual,
  fetchBookingsWithFieldsForRoute,
  type BookingForRoute,
} from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { FieldPoint } from '@/lib/geo/routeOptimizer';
import { optimizeRouteOrder } from '@/lib/geo/routeOptimizer';
import RouteStepsView from '@/components/RouteStepsView';

type StepKey = 'draft' | 'recruiting' | 'closed' | 'confirmed';

const STEPS: { key: StepKey; label: string; statuses: string[]; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'draft', label: '作成', statuses: ['unformed'], icon: FileCheck },
  { key: 'recruiting', label: '募集', statuses: ['open', 'applied'], icon: Clock },
  { key: 'closed', label: '締切', statuses: ['closed'], icon: Calendar },
  { key: 'confirmed', label: '確定', statuses: ['completed', 'archived'], icon: CheckCircle2 },
];

interface CampaignRow {
  id: string;
  campaign_title: string | null;
  location: string;
  status: string;
  final_date: string | null;
  start_date: string | null;
  end_date: string | null;
  is_closed: boolean | null;
}

function bookingsToFieldPoints(bookings: BookingForRoute[]): FieldPoint[] {
  return bookings
    .filter((b) => b.field && b.field.lat != null && b.field.lng != null)
    .map((b) => ({
      appId: b.id,
      fieldId: b.field!.id,
      farmerId: b.farmer_id,
      area10r: b.area_10r,
      lat: b.field!.lat!,
      lng: b.field!.lng!,
      fieldName: b.field!.name ?? '圃場',
      address: b.field!.address ?? '',
      farmerName: b.farmer_name ?? '農家',
    }));
}

export default function ProviderProjectsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [activeStep, setActiveStep] = useState<StepKey>('recruiting');
  const [actingId, setActingId] = useState<string | null>(null);

  // 作業確定ダイアログ
  const [confirmCampaignId, setConfirmCampaignId] = useState<string | null>(null);
  const [confirmCampaignTitle, setConfirmCampaignTitle] = useState('');
  const [confirmBookings, setConfirmBookings] = useState<BookingForRoute[]>([]);
  const [confirmMode, setConfirmMode] = useState<'bulk' | 'individual' | null>(null);
  const [bulkDate, setBulkDate] = useState('');
  const [individualDates, setIndividualDates] = useState<Record<string, string>>({});
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmSaving, setConfirmSaving] = useState(false);
  const [routeResultDate, setRouteResultDate] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u || u.role !== 'provider') {
        router.replace('/login');
        return;
      }
      setUser(u);

      const { data, error } = await supabase
        .from('campaigns')
        .select('id, campaign_title, location, status, final_date, start_date, end_date, is_closed')
        .eq('provider_id', u.id)
        .order('created_at', { ascending: false });

      if (error) {
        toast.error('案件一覧の取得に失敗しました');
        setLoading(false);
        return;
      }
      setCampaigns((data as CampaignRow[]) ?? []);
      setLoading(false);
    })();
  }, [router]);

  const getCampaignsForStep = (stepKey: StepKey) => {
    const step = STEPS.find((s) => s.key === stepKey);
    if (!step) return [];
    return campaigns.filter((c) => step.statuses.includes(c.status));
  };

  const handleCloseCampaign = async (id: string) => {
    setActingId(id);
    const res = await closeCampaign(id);
    setActingId(null);
    if (res.success) {
      toast.success('募集を締め切りました');
      setCampaigns((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'closed' as const, is_closed: true } : c))
      );
    } else {
      toast.error(res.error ?? '締切に失敗しました');
    }
  };

  const openConfirmDialog = async (c: CampaignRow) => {
    setConfirmCampaignId(c.id);
    setConfirmCampaignTitle(c.campaign_title || c.location || '（無題）');
    setConfirmMode(null);
    setBulkDate('');
    setIndividualDates({});
    setRouteResultDate(null);
    setConfirmLoading(true);
    const list = await fetchBookingsWithFieldsForRoute(c.id);
    setConfirmBookings(list);
    setConfirmLoading(false);
  };

  const closeConfirmDialog = () => {
    setConfirmCampaignId(null);
    setConfirmCampaignTitle('');
    setConfirmBookings([]);
    setConfirmMode(null);
    setRouteResultDate(null);
  };

  const handleBulkConfirm = async () => {
    if (!confirmCampaignId || !bulkDate.trim()) {
      toast.error('作業日を選択してください');
      return;
    }
    setConfirmSaving(true);
    const res = await setWorkConfirmBulk(confirmCampaignId, bulkDate.trim());
    setConfirmSaving(false);
    if (res.success) {
      toast.success('一斉に作業日を通知しました');
      setCampaigns((prev) =>
        prev.map((c) =>
          c.id === confirmCampaignId ? { ...c, status: 'completed' as const, final_date: bulkDate.trim() } : c
        )
      );
      setRouteResultDate(bulkDate.trim());
    } else {
      toast.error(res.error ?? '確定に失敗しました');
    }
  };

  const handleIndividualConfirm = async () => {
    if (!confirmCampaignId) return;
    const updates = confirmBookings
      .filter((b) => individualDates[b.id]?.trim())
      .map((b) => ({ bookingId: b.id, confirmedDate: individualDates[b.id].trim() }));
    if (updates.length === 0) {
      toast.error('各申込に作業日を入力してください');
      return;
    }
    setConfirmSaving(true);
    const res = await setWorkConfirmIndividual(confirmCampaignId, updates);
    setConfirmSaving(false);
    if (res.success) {
      toast.success('個別に作業日を通知しました');
      setCampaigns((prev) =>
        prev.map((c) => (c.id === confirmCampaignId ? { ...c, status: 'completed' as const } : c))
      );
      closeConfirmDialog();
    } else {
      toast.error(res.error ?? '確定に失敗しました');
    }
  };

  const optimizedRoute = useMemo(() => {
    if (!routeResultDate || !user || confirmBookings.length === 0) return [];
    const points = bookingsToFieldPoints(confirmBookings);
    const baseLat = user.lat ?? null;
    const baseLng = user.lng ?? null;
    return optimizeRouteOrder(points, baseLat, baseLng);
  }, [routeResultDate, user, confirmBookings]);

  if (loading || !user) {
    return (
      <main className="min-h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-agrix-forest" />
      </main>
    );
  }

  const list = getCampaignsForStep(activeStep);

  return (
    <main className="min-h-full">
      <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
        <div className="flex items-center justify-between gap-4 mb-6">
          <h1 className="text-xl md:text-2xl font-bold text-dashboard-text flex items-center gap-2">
            <FolderKanban className="w-6 h-6 text-agrix-forest" />
            案件
          </h1>
          <div className="flex items-center gap-2">
            <Link href="/admin/campaigns/copy">
              <Button variant="outline" className="gap-2 border-agrix-forest/50 text-agrix-forest hover:bg-agrix-forest/10">
                <Copy className="w-4 h-4" />
                過去からコピー
              </Button>
            </Link>
            <Link href="/admin/campaigns/new">
              <Button className="gap-2 bg-agrix-forest hover:bg-agrix-forest-dark">
                <PlusCircle className="w-4 h-4" />
                新規作成
              </Button>
            </Link>
          </div>
        </div>

        {/* 4ステップタブ */}
        <div className="flex border-b border-dashboard-border mb-6 overflow-x-auto">
          {STEPS.map((step) => {
            const Icon = step.icon;
            const count = getCampaignsForStep(step.key).length;
            return (
              <button
                key={step.key}
                type="button"
                onClick={() => setActiveStep(step.key)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors',
                  activeStep === step.key
                    ? 'border-agrix-forest text-agrix-forest'
                    : 'border-transparent text-dashboard-muted hover:text-dashboard-text'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {step.label}
                <span className="tabular-nums text-xs font-normal opacity-80">({count})</span>
              </button>
            );
          })}
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              {(() => {
                const step = STEPS.find((s) => s.key === activeStep);
                const Icon = step?.icon ?? FileCheck;
                return (
                  <>
                    <Icon className="w-5 h-5 text-agrix-forest" />
                    {step?.label ?? activeStep}
                  </>
                );
              })()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {list.length === 0 ? (
              <div className="py-12 text-center text-dashboard-muted">
                <p className="font-medium mb-1">このステップの案件はありません</p>
                {activeStep === 'draft' && (
                  <Link href="/admin/campaigns/new">
                    <Button variant="outline" size="sm" className="mt-2 gap-2">
                      <PlusCircle className="w-4 h-4" />
                      案件を作成
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-dashboard-border">
                {list.map((c) => (
                  <li
                    key={c.id}
                    className="py-4 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-dashboard-text">
                        {c.campaign_title || c.location || '（無題）'}
                      </p>
                      <p className="text-sm text-dashboard-muted mt-0.5">
                        {c.final_date || c.start_date || c.end_date
                          ? new Date(c.final_date || c.start_date || c.end_date || '').toLocaleDateString('ja-JP')
                          : '日付未定'}
                        {' · '}
                        {c.location}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {activeStep === 'recruiting' && (c.status === 'open' || c.status === 'applied') && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-agrix-gold/50 text-agrix-gold-dark hover:bg-agrix-gold/20"
                          disabled={!!actingId}
                          onClick={() => handleCloseCampaign(c.id)}
                        >
                          {actingId === c.id ? '処理中...' : '募集締切'}
                        </Button>
                      )}
                      {activeStep === 'closed' && c.status === 'closed' && (
                        <Button
                          size="sm"
                          className="bg-agrix-forest hover:bg-agrix-forest-dark"
                          disabled={!!actingId}
                          onClick={() => openConfirmDialog(c)}
                        >
                          作業確定
                        </Button>
                      )}
                      <Link
                        href="/provider/calendar"
                        className="inline-flex items-center gap-1 text-sm font-bold text-agrix-forest hover:underline"
                      >
                        カレンダー <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm font-medium text-dashboard-muted hover:text-dashboard-text"
          >
            <CalendarRange className="w-4 h-4" />
            ダッシュボードへ
          </Link>
        </div>
      </div>

      {/* 作業確定ダイアログ */}
      <Dialog open={!!confirmCampaignId} onOpenChange={(open) => !open && closeConfirmDialog()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>作業確定 — {confirmCampaignTitle}</DialogTitle>
          </DialogHeader>
          {confirmLoading ? (
            <div className="py-8 text-center text-dashboard-muted">申込一覧を読み込み中...</div>
          ) : confirmBookings.length === 0 ? (
            <div className="py-6 text-center text-dashboard-muted">
              <p>この案件に申込がありません。作業確定は申込がある場合にのみ行えます。</p>
              <Button variant="outline" className="mt-4" onClick={closeConfirmDialog}>
                閉じる
              </Button>
            </div>
          ) : routeResultDate ? (
            <div className="space-y-4">
              <p className="text-sm text-dashboard-muted">
                一斉に作業日を通知しました。業者拠点から効率的に回る1日のルート案です。
              </p>
              {optimizedRoute.length > 0 ? (
                <RouteStepsView route={optimizedRoute} workDate={routeResultDate} />
              ) : (
                <p className="text-sm text-dashboard-muted">
                  畑の位置情報がある申込のみルートに含まれます。拠点の緯度・経度を設定すると最適順が表示されます。
                </p>
              )}
              <Button className="w-full" onClick={closeConfirmDialog}>
                閉じる
              </Button>
            </div>
          ) : confirmMode === null ? (
            <div className="space-y-4">
              <p className="text-sm text-dashboard-muted">
                締め切った案件に作業日を設定し、申込農家に通知します。
              </p>
              <div className="grid gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmMode('bulk')}
                  className="flex items-center gap-3 rounded-xl border border-dashboard-border p-4 text-left hover:bg-dashboard-card transition-colors"
                >
                  <CalendarDays className="w-5 h-5 text-agrix-forest shrink-0" />
                  <div>
                    <p className="font-bold text-dashboard-text">一斉に日付を通知</p>
                    <p className="text-xs text-dashboard-muted">同じ作業日を全員に通知。日付のみ。ルート案を表示します。</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmMode('individual')}
                  className="flex items-center gap-3 rounded-xl border border-dashboard-border p-4 text-left hover:bg-dashboard-card transition-colors"
                >
                  <UserIcon className="w-5 h-5 text-agrix-forest shrink-0" />
                  <div>
                    <p className="font-bold text-dashboard-text">個別に日付を通知</p>
                    <p className="text-xs text-dashboard-muted">申込ごとに日付（と時間）を設定して通知します。</p>
                  </div>
                </button>
              </div>
            </div>
          ) : confirmMode === 'bulk' ? (
            <div className="space-y-4">
              <p className="text-sm text-dashboard-muted">全申込に同じ作業日を通知します（日付のみ）。</p>
              <div>
                <label className="block text-sm font-bold text-dashboard-text mb-1">作業日</label>
                <input
                  type="date"
                  value={bulkDate}
                  onChange={(e) => setBulkDate(e.target.value)}
                  className="w-full p-3 rounded-xl border border-dashboard-border bg-dashboard-bg text-dashboard-text"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setConfirmMode(null)} className="flex-1">
                  戻る
                </Button>
                <Button
                  className="flex-1 bg-agrix-forest hover:bg-agrix-forest-dark"
                  disabled={!bulkDate.trim() || confirmSaving}
                  onClick={handleBulkConfirm}
                >
                  {confirmSaving ? '処理中...' : '確定して通知'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-dashboard-muted">各申込に作業日を入力してください。</p>
              <ul className="space-y-3 max-h-60 overflow-y-auto">
                {confirmBookings.map((b) => (
                  <li key={b.id} className="flex items-center gap-3 rounded-lg border border-dashboard-border p-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-dashboard-text truncate">{b.farmer_name || '農家'}</p>
                      <p className="text-xs text-dashboard-muted">{b.area_10r} 反</p>
                    </div>
                    <input
                      type="date"
                      value={individualDates[b.id] ?? ''}
                      onChange={(e) => setIndividualDates((prev) => ({ ...prev, [b.id]: e.target.value }))}
                      className="w-36 shrink-0 p-2 rounded-lg border border-dashboard-border bg-dashboard-bg text-dashboard-text text-sm"
                    />
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setConfirmMode(null)} className="flex-1">
                  戻る
                </Button>
                <Button
                  className="flex-1 bg-agrix-forest hover:bg-agrix-forest-dark"
                  disabled={confirmSaving}
                  onClick={handleIndividualConfirm}
                >
                  {confirmSaving ? '処理中...' : '保存して通知'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
