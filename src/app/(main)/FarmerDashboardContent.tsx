'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { MapPin, Calendar, FileText, Sprout, ArrowRight, Filter } from 'lucide-react';
import CampaignTimelineCard, { type CampaignWithArea } from '@/components/CampaignTimelineCard';
import ApplicationDialog, { type ApplicationFormData } from '@/components/ApplicationDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { User } from '@/lib/auth';
import type { Field } from '@/types/database';
import type { FarmerBookingItem, LinkedProvider } from '@/lib/api';
import type { Polygon } from 'geojson';
import type { FarmerFormData } from '@/components/CampaignForm';

const PolygonMap = dynamic(() => import('@/components/PolygonMap'), { ssr: false });
const CampaignForm = dynamic(() => import('@/components/CampaignForm'), { ssr: false });

const STATUS_LABEL: Record<string, string> = {
  confirmed: '確定',
  pending: '確認待ち',
  completed: '完了',
  canceled: 'キャンセル',
  cancel_requested: 'キャンセル依頼中',
};

export type FarmerDashboardContentProps = {
  user: User | null;
  linkedProviders: LinkedProvider[];
  selectedProviderId: string | null;
  setSelectedProviderId: (id: string | null) => void;
  openCampaignsWithArea: CampaignWithArea[];
  selectedCampaign: CampaignWithArea | null;
  setSelectedCampaign: (c: CampaignWithArea | null) => void;
  applicationDialogOpen: boolean;
  setApplicationDialogOpen: (open: boolean) => void;
  applicationCampaign: CampaignWithArea | null;
  setApplicationCampaign: (c: CampaignWithArea | null) => void;
  farmerBookings: FarmerBookingItem[];
  farmerFields: Field[];
  onApplicationDialogSubmit: (data: ApplicationFormData) => Promise<void>;
  applySectionRef: React.RefObject<HTMLDivElement | null>;
  area10r: number;
  coords: { lat: number; lng: number }[] | null;
  onPolygonComplete: (
    coords: { lat: number; lng: number }[] | null,
    area10r: number,
    polygon: Polygon | null
  ) => void;
  totalCampaignArea: number;
  onFormSubmit: (formData: FarmerFormData) => Promise<void>;
  onRequestCancel: (bookingId: string) => Promise<void>;
  filterByMyFields: boolean;
  setFilterByMyFields: (v: boolean) => void;
  filterByMyCrops: boolean;
  setFilterByMyCrops: (v: boolean) => void;
  filterStatus: 'all' | 'open' | 'past';
  setFilterStatus: (v: 'all' | 'open' | 'past') => void;
  filterDateFrom: string;
  setFilterDateFrom: (v: string) => void;
  filterDateTo: string;
  setFilterDateTo: (v: string) => void;
};

export default function FarmerDashboardContent(props: FarmerDashboardContentProps) {
  const {
    user,
    linkedProviders,
    selectedProviderId,
    setSelectedProviderId,
    openCampaignsWithArea,
    selectedCampaign,
    setSelectedCampaign,
    applicationDialogOpen,
    setApplicationDialogOpen,
    applicationCampaign,
    setApplicationCampaign,
    farmerBookings,
    farmerFields,
    onApplicationDialogSubmit,
    applySectionRef,
    area10r,
    coords,
    onPolygonComplete,
    totalCampaignArea,
    onFormSubmit,
    onRequestCancel,
    filterByMyFields,
    setFilterByMyFields,
    filterByMyCrops,
    setFilterByMyCrops,
    filterStatus,
    setFilterStatus,
    filterDateFrom,
    setFilterDateFrom,
    filterDateTo,
    setFilterDateTo,
  } = props;

  return (
    <main className="min-h-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        {user?.role === 'farmer' && (
          <section className="mb-8">
            <h2 className="text-lg font-bold text-dashboard-text mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-agrix-forest" />
              予約募集一覧
            </h2>

            <Card className="mb-6 p-4 border-dashboard-border bg-dashboard-card/50">
              <p className="text-sm font-medium text-dashboard-text mb-3">どの業者の案件を見ますか？</p>
              {linkedProviders.length === 0 ? (
                <>
                  <p className="text-sm text-dashboard-muted">
                    紐付いている業者がいません。マイページで招待コードを入力するか、業者から招待リンクで紐づけましょう。
                  </p>
                  <Link
                    href="/mypage"
                    className="inline-flex items-center gap-1.5 mt-3 text-sm font-bold text-agrix-forest hover:underline"
                  >
                    マイページで業者を紐づける <ArrowRight className="w-4 h-4" />
                  </Link>
                </>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {linkedProviders.map((p) => (
                      <Button
                        key={p.id}
                        type="button"
                        variant={selectedProviderId === p.id ? 'default' : 'outline'}
                        size="sm"
                        className={
                          selectedProviderId === p.id
                            ? 'bg-agrix-forest text-white border-agrix-forest'
                            : 'border-dashboard-border text-dashboard-text hover:bg-dashboard-muted/20'
                        }
                        onClick={() => setSelectedProviderId(p.id)}
                      >
                        {p.name}
                      </Button>
                    ))}
                    {selectedProviderId && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-dashboard-muted hover:text-dashboard-text"
                        onClick={() => {
                          setSelectedProviderId(null);
                          setSelectedCampaign(null);
                        }}
                      >
                        選択を解除
                      </Button>
                    )}
                </div>
              )}
            </Card>

            {selectedProviderId && (
              <>
                <p className="text-sm text-dashboard-muted mb-3">
                  {linkedProviders.find((p) => p.id === selectedProviderId)?.name ?? '業者'}の案件一覧です。申し込みたい案件を選んでください。
                </p>
                <Card className="mb-4 p-4 border-dashboard-border bg-dashboard-card/50">
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-dashboard-text">
                      <Filter className="w-4 h-4 text-agrix-forest" />
                      フィルタ
                    </span>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filterByMyFields}
                        onChange={(e) => setFilterByMyFields(e.target.checked)}
                        className="rounded border-dashboard-border text-agrix-forest focus:ring-agrix-forest"
                      />
                      <span className="text-sm text-dashboard-text">自分の畑のエリア内のみ</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filterByMyCrops}
                        onChange={(e) => setFilterByMyCrops(e.target.checked)}
                        className="rounded border-dashboard-border text-agrix-forest focus:ring-agrix-forest"
                      />
                      <span className="text-sm text-dashboard-text">自分の品目のみ</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="filter-status" className="text-sm text-dashboard-muted shrink-0">表示</Label>
                      <select
                        id="filter-status"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as 'all' | 'open' | 'past')}
                        className="rounded-lg border border-dashboard-border bg-dashboard-card text-dashboard-text text-sm px-3 py-1.5"
                      >
                        <option value="all">すべて</option>
                        <option value="open">募集中のみ</option>
                        <option value="past">過去の案件</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="filter-date-from" className="text-sm text-dashboard-muted shrink-0">期間</Label>
                      <Input
                        id="filter-date-from"
                        type="date"
                        value={filterDateFrom}
                        onChange={(e) => setFilterDateFrom(e.target.value)}
                        className="w-36 h-8 text-sm"
                      />
                      <span className="text-dashboard-muted">～</span>
                      <Input
                        id="filter-date-to"
                        type="date"
                        value={filterDateTo}
                        onChange={(e) => setFilterDateTo(e.target.value)}
                        className="w-36 h-8 text-sm"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-dashboard-muted mt-2">
                    自分の畑の周辺や登録した品目に合う案件が上位に表示されます。
                  </p>
                </Card>
                {openCampaignsWithArea.length === 0 ? (
                  <Card className="mb-8">
                    <CardContent className="p-10 flex flex-col items-center justify-center text-center">
                      <div className="rounded-full bg-dashboard-muted/20 p-6 mb-4">
                        <MapPin className="w-12 h-12 text-dashboard-muted" />
                      </div>
                      <p className="font-bold text-dashboard-text mb-1">この業者には現在募集中の案件はありません</p>
                      <p className="text-sm text-dashboard-muted">別の業者を選ぶか、新しい案件の公開をお待ちください。</p>
                    </CardContent>
                  </Card>
                ) : (
                  <ul className="space-y-4">
                    {openCampaignsWithArea.map((campaign) => (
                      <li key={campaign.id}>
                        <CampaignTimelineCard
                          campaign={campaign}
                          onSelect={(c) => {
                            setApplicationCampaign(c);
                            setApplicationDialogOpen(true);
                          }}
                          isSelected={selectedCampaign?.id === campaign.id}
                          hasExistingApplication={farmerBookings.some(
                            (b) =>
                              b.campaign_id === campaign.id &&
                              b.status !== 'canceled' &&
                              b.status !== 'cancel_requested'
                          )}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
            <ApplicationDialog
              open={applicationDialogOpen}
              onOpenChange={setApplicationDialogOpen}
              campaign={applicationCampaign}
              user={user?.role === 'farmer' ? user : null}
              farmerBookings={farmerBookings}
              fields={farmerFields}
              onSubmit={onApplicationDialogSubmit}
            />
          </section>
        )}

        {user?.role === 'farmer' && selectedCampaign && (
          <div ref={applySectionRef as React.RefObject<HTMLDivElement>} id="apply-section" className="scroll-mt-4">
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
                      onPolygonComplete={onPolygonComplete}
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
                      onSubmit={onFormSubmit}
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
          </div>
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
                        {STATUS_LABEL[b.status] || b.status}
                        {b.status === 'cancel_requested' && (
                          <span className="block text-xs text-amber-600 mt-1">
                            業者に連絡が入ります。いきなりキャンセルにはなりません。
                          </span>
                        )}
                        {b.created_at &&
                          ` · ${new Date(b.created_at).toLocaleDateString('ja-JP')}`}
                      </p>
                    </div>
                    {(b.status === 'confirmed' || b.status === 'pending') && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 text-dashboard-muted border-dashboard-border hover:bg-dashboard-muted/20"
                        onClick={() => onRequestCancel(b.id)}
                      >
                        キャンセル依頼
                      </Button>
                    )}
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
              <div className="rounded-full bg-dashboard-muted/20 p-6 mb-4">
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
