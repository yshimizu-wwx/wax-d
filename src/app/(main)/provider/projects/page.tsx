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
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  CalendarRange,
  CalendarDays,
  User as UserIcon,
  Users,
  LayoutGrid,
  Banknote,
  Map as MapIcon,
  FileCheck,
} from 'lucide-react';
import { getCurrentUser, type User } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import {
  closeCampaign,
  setWorkConfirmBulk,
  setWorkConfirmIndividual,
  fetchBookingsWithFieldsForRoute,
  fetchBookingSummariesForCampaigns,
  type BookingForRoute,
  type CampaignBookingSummary,
} from '@/lib/api';
import { toast } from 'sonner';
import { formatDateWithWeekday } from '@/lib/dateFormat';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { calculateCurrentUnitPrice } from '@/lib/calculator/priceCalculator';
import type { FieldPoint } from '@/lib/geo/routeOptimizer';
import { optimizeRouteOrder, buildGoogleMapsDirectionsUrl } from '@/lib/geo/routeOptimizer';
import RouteStepsView from '@/components/RouteStepsView';

type StepKey = 'recruiting' | 'closed' | 'confirmed';

const STEPS: { key: StepKey; label: string; statuses: string[]; icon: React.ComponentType<{ className?: string }> }[] = [
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
  target_area_10r: number | null;
  max_target_area_10r: number | null;
  base_price: number | null;
  min_price: number | null;
  min_target_area_10r: number | null;
  execution_price: number | null;
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
  const [summaries, setSummaries] = useState<Map<string, CampaignBookingSummary>>(new Map());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<StepKey>('recruiting');
  const [actingId, setActingId] = useState<string | null>(null);

  // 作業確定ダイアログ
  const [confirmCampaignId, setConfirmCampaignId] = useState<string | null>(null);
  const [confirmCampaignTitle, setConfirmCampaignTitle] = useState('');
  const [confirmCampaignStart, setConfirmCampaignStart] = useState<string | null>(null);
  const [confirmCampaignEnd, setConfirmCampaignEnd] = useState<string | null>(null);
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
        .select('id, campaign_title, location, status, final_date, start_date, end_date, is_closed, target_area_10r, max_target_area_10r, base_price, min_price, min_target_area_10r, execution_price')
        .eq('provider_id', u.id)
        .order('created_at', { ascending: false });

      if (error) {
        toast.error('案件一覧の取得に失敗しました');
        setLoading(false);
        return;
      }
      const list = (data as CampaignRow[]) ?? [];
      setCampaigns(list);

      if (list.length > 0) {
        const sumList = await fetchBookingSummariesForCampaigns(list.map((c) => c.id));
        setSummaries(new Map(sumList.map((s) => [s.campaignId, s])));
      }
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
    setConfirmCampaignStart(c.start_date ?? null);
    setConfirmCampaignEnd(c.end_date ?? null);
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
    setConfirmCampaignStart(null);
    setConfirmCampaignEnd(null);
    setConfirmBookings([]);
    setConfirmMode(null);
    setRouteResultDate(null);
  };

  /** 期間の中央日を YYYY-MM-DD で返す。希望がなければこの日をデフォルトに使う */
  const middleOfPeriod = (start: string | null, end: string | null): string | null => {
    if (!start || !end) return start ?? end ?? null;
    const a = new Date(start).getTime();
    const b = new Date(end).getTime();
    if (Number.isNaN(a) || Number.isNaN(b)) return start;
    const mid = new Date((a + b) / 2);
    return mid.toISOString().slice(0, 10);
  };

  /** 個別モードのデフォルト日付: 申込希望日があればそれ、なければ案件期間の中央 */
  const getDefaultIndividualDates = (
    bookings: BookingForRoute[],
    periodStart: string | null,
    periodEnd: string | null
  ): Record<string, string> => {
    const mid = middleOfPeriod(periodStart, periodEnd) ?? '';
    const out: Record<string, string> = {};
    for (const b of bookings) {
      const d = b.desired_start_date ?? b.desired_end_date ?? mid;
      out[b.id] = d ?? '';
    }
    return out;
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
                const Icon = step?.icon ?? Clock;
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
                {activeStep === 'recruiting' && (
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
                {list.map((c) => {
                  const summary = summaries.get(c.id);
                  const targetArea = Number(c.max_target_area_10r ?? c.target_area_10r) || 0;
                  const appliedArea = summary?.totalArea10r ?? 0;
                  const areaProgress = targetArea > 0 ? Math.min(100, (appliedArea / targetArea) * 100) : 0;
                  const isExpanded = expandedId === c.id;

                  // 申込状況に応じた変動単価（逆オークション計算）。申し込み時の金額ではなく現在単価×面積で表示
                  const basePrice = Number(c.base_price) || 0;
                  const minPrice = Number(c.min_price) || 0;
                  const targetArea10r = Number(c.target_area_10r) || 1;
                  const hasPricing = basePrice > 0 || minPrice > 0;
                  let priceResult: { currentPrice: number | null } | null = null;
                  if (hasPricing) {
                    try {
                      priceResult = calculateCurrentUnitPrice(
                        {
                          base_price: basePrice || minPrice,
                          min_price: minPrice || basePrice,
                          target_area_10r: targetArea10r,
                          min_target_area_10r: c.min_target_area_10r ?? undefined,
                          max_target_area_10r: c.max_target_area_10r ?? undefined,
                          execution_price: c.execution_price ?? undefined,
                        },
                        appliedArea
                      );
                    } catch {
                      priceResult = null;
                    }
                  }
                  const currentUnitPrice = priceResult?.currentPrice ?? null;
                  const calculatedTotal =
                    summary && currentUnitPrice != null
                      ? summary.bookings.reduce(
                          (sum, b) => sum + Math.round(b.area_10r * currentUnitPrice),
                          0
                        )
                      : 0;

                  return (
                    <li key={c.id} className="py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-dashboard-text">
                            {c.campaign_title || c.location || '（無題）'}
                          </p>
                          <p className="text-sm text-dashboard-muted mt-0.5">
                            {c.start_date && c.end_date ? (
                              <>
                                <span className="opacity-90">募集期間</span>{' '}
                                {formatDateWithWeekday(c.start_date)} ～ {formatDateWithWeekday(c.end_date)}
                              </>
                            ) : c.start_date || c.end_date ? (
                              <>
                                <span className="opacity-90">期間</span>{' '}
                                {c.start_date
                                  ? formatDateWithWeekday(c.start_date)
                                  : formatDateWithWeekday(c.end_date!)}
                              </>
                            ) : c.final_date ? (
                              <>作業予定日 {formatDateWithWeekday(c.final_date)}</>
                            ) : (
                              '日付未定'
                            )}
                            {' · '}
                            {c.location}
                          </p>
                          {/* 進捗サマリ: 申込数・面積・現在単価・合計金額（面積×変動単価） */}
                          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                            <span className="inline-flex items-center gap-1.5 text-dashboard-muted">
                              <Users className="w-4 h-4 text-agrix-forest/70" />
                              <strong className="text-dashboard-text tabular-nums">{summary?.count ?? 0}</strong> 件の申込
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-dashboard-muted">
                              <LayoutGrid className="w-4 h-4 text-agrix-forest/70" />
                              <strong className="text-dashboard-text tabular-nums">{appliedArea.toFixed(1)}</strong> 反
                              {targetArea > 0 && (
                                <span className="opacity-80"> / 目標 {targetArea} 反</span>
                              )}
                            </span>
                            {currentUnitPrice != null && (
                              <span className="inline-flex items-center gap-1.5 text-dashboard-muted" title="申込状況により変動します">
                                <span className="opacity-80">現在単価</span>
                                <strong className="text-dashboard-text tabular-nums">{currentUnitPrice.toLocaleString()}</strong> 円/反
                              </span>
                            )}
                            {calculatedTotal > 0 && (
                              <span className="inline-flex items-center gap-1.5 text-dashboard-muted">
                                <Banknote className="w-4 h-4 text-agrix-forest/70" />
                                <strong className="text-dashboard-text tabular-nums">
                                  {calculatedTotal.toLocaleString()}
                                </strong> 円
                                <span className="opacity-70 text-xs">（面積×単価）</span>
                              </span>
                            )}
                          </div>
                          {targetArea > 0 && (
                            <div className="mt-2 w-full max-w-xs">
                              <Progress value={areaProgress} className="h-2" />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
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
                          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                            {activeStep === 'confirmed' && (
                              <Link href="/provider/tasks">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1.5 border-agrix-forest/50 text-agrix-forest hover:bg-agrix-forest/10"
                                >
                                  <FileCheck className="w-4 h-4" />
                                  作業実績報告へ
                                </Button>
                              </Link>
                            )}
                            <Link
                              href="/provider/calendar"
                              className="inline-flex items-center gap-1 text-sm font-bold text-agrix-forest hover:underline"
                            >
                              カレンダー <ChevronRight className="w-4 h-4" />
                            </Link>
                          </div>
                        </div>
                      </div>
                      {/* 農家別申込一覧（展開） */}
                      {(summary?.bookings?.length ?? 0) > 0 && (
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : c.id)}
                            className="flex items-center gap-2 text-sm font-medium text-agrix-forest hover:underline"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            農家別申込一覧（{summary!.bookings.length}件）
                          </button>
                          {isExpanded && summary && (
                            <div className="mt-2 rounded-xl border border-dashboard-border overflow-hidden">
                              {currentUnitPrice != null && (
                                <p className="text-xs text-dashboard-muted px-3 py-2 border-b border-dashboard-border bg-dashboard-card/50">
                                  金額は「面積 × 現在単価（{currentUnitPrice.toLocaleString()} 円/反）」で算出しています。単価は申込状況により変動します。
                                </p>
                              )}
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-dashboard-card border-b border-dashboard-border">
                                    <th className="text-left py-2 px-3 font-semibold text-dashboard-text">農家名</th>
                                    <th className="text-right py-2 px-3 font-semibold text-dashboard-text">面積（反）</th>
                                    <th className="text-right py-2 px-3 font-semibold text-dashboard-text">単価（円/反）</th>
                                    <th className="text-right py-2 px-3 font-semibold text-dashboard-text">金額（円）</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {summary.bookings.map((b) => {
                                    const amount =
                                      currentUnitPrice != null
                                        ? Math.round(b.area_10r * currentUnitPrice)
                                        : null;
                                    return (
                                      <tr key={b.id} className="border-b border-dashboard-border last:border-0">
                                        <td className="py-2 px-3 text-dashboard-text">{b.farmer_name ?? '—'}</td>
                                        <td className="py-2 px-3 text-right tabular-nums text-dashboard-text">{b.area_10r.toFixed(1)}</td>
                                        <td className="py-2 px-3 text-right tabular-nums text-dashboard-muted">
                                          {currentUnitPrice != null ? currentUnitPrice.toLocaleString() : '—'}
                                        </td>
                                        <td className="py-2 px-3 text-right tabular-nums text-dashboard-text font-medium">
                                          {amount != null ? amount.toLocaleString() : '—'}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
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

      {/* 作業確定ダイアログ（白背景のため明示的にダークテキスト指定） */}
      <Dialog open={!!confirmCampaignId} onOpenChange={(open) => !open && closeConfirmDialog()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-white text-slate-900">
          <DialogHeader>
            <DialogTitle>作業確定 — {confirmCampaignTitle}</DialogTitle>
          </DialogHeader>
          {confirmLoading ? (
            <div className="py-8 text-center text-slate-600">申込一覧を読み込み中...</div>
          ) : confirmBookings.length === 0 ? (
            <div className="py-6 text-center text-slate-600">
              <p>この案件に申込がありません。作業確定は申込がある場合にのみ行えます。</p>
              <Button variant="outline" className="mt-4" onClick={closeConfirmDialog}>
                閉じる
              </Button>
            </div>
          ) : routeResultDate ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                一斉に作業日を通知しました。業者拠点から効率的に回る1日のルート案です。
              </p>
              <p className="text-xs text-slate-500">
                ルートは各畑の中心（緯度経度）への経路です。畑名をクリックすると地図で範囲を確認できます。
              </p>
              {optimizedRoute.length > 0 ? (
                <>
                  <RouteStepsView route={optimizedRoute} workDate={routeResultDate} />
                  <a
                    href={buildGoogleMapsDirectionsUrl(optimizedRoute, {
                      originLat: user?.lat ?? undefined,
                      originLng: user?.lng ?? undefined,
                      travelMode: 'driving',
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-agrix-forest/30 bg-agrix-forest/10 px-4 py-3 text-sm font-medium text-agrix-forest transition-colors hover:bg-agrix-forest/20"
                  >
                    <MapIcon className="h-4 w-4 shrink-0" />
                    Googleマップでルートを開く（車でナビ）
                  </a>
                </>
              ) : (
                <p className="text-sm text-slate-600">
                  畑の位置情報がある申込のみルートに含まれます。拠点の緯度・経度を設定すると最適順が表示されます。
                </p>
              )}
              <Button className="w-full" onClick={closeConfirmDialog}>
                閉じる
              </Button>
            </div>
          ) : confirmMode === null ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                締め切った案件に作業日を設定し、申込農家に通知します。
              </p>
              <div className="grid gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmMode('bulk')}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-left hover:bg-slate-100 transition-colors"
                >
                  <CalendarDays className="w-5 h-5 text-agrix-forest shrink-0" />
                  <div>
                    <p className="font-bold text-slate-900">一斉に日付を通知</p>
                    <p className="text-xs text-slate-600">同じ作業日を全員に通知。日付のみ。ルート案を表示します。</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmMode('individual');
                    setIndividualDates(
                      getDefaultIndividualDates(confirmBookings, confirmCampaignStart, confirmCampaignEnd)
                    );
                  }}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-left hover:bg-slate-100 transition-colors"
                >
                  <UserIcon className="w-5 h-5 text-agrix-forest shrink-0" />
                  <div>
                    <p className="font-bold text-slate-900">個別に日付を通知</p>
                    <p className="text-xs text-slate-600">申込ごとに日付（と時間）を設定して通知します。</p>
                  </div>
                </button>
              </div>
            </div>
          ) : confirmMode === 'bulk' ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">全申込に同じ作業日を通知します（日付のみ）。申込期間内の日付から選べます。</p>
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1">作業日</label>
                <input
                  type="date"
                  value={bulkDate}
                  onChange={(e) => setBulkDate(e.target.value)}
                  min={confirmCampaignStart ?? undefined}
                  max={confirmCampaignEnd ?? undefined}
                  className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900"
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
              <p className="text-sm text-slate-600">各申込に作業日を入力してください。申込時の希望期間内の日付から選べます。</p>
              <ul className="space-y-3 max-h-60 overflow-y-auto">
                {confirmBookings.map((b) => (
                  <li key={b.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900 truncate">{b.farmer_name || '農家'}</p>
                      <p className="text-xs text-slate-600">{b.area_10r} 反</p>
                    </div>
                    <input
                      type="date"
                      value={individualDates[b.id] ?? ''}
                      onChange={(e) => setIndividualDates((prev) => ({ ...prev, [b.id]: e.target.value }))}
                      min={b.desired_start_date ?? confirmCampaignStart ?? undefined}
                      max={b.desired_end_date ?? confirmCampaignEnd ?? undefined}
                      className="w-36 shrink-0 p-2 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm"
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
