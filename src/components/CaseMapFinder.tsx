'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { MapPin, CheckCircle2, ArrowRight, Loader2, Sprout, Filter } from 'lucide-react';
import {
  fetchCampaigns,
  fetchCampaignTotalArea,
  fetchFieldsByFarmer,
  fetchLinkedProvidersForFarmer,
  type LinkedProvider,
} from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { isoToYyyyMmDd, yyyyMmDdToIso, getDefaultPeriod } from '@/lib/dateFormat';
import { parseCampaignPolygon, isFieldInCampaignArea } from '@/lib/geo/spatial-queries';
import type { Project } from '@/types/database';
import type { Field } from '@/types/database';
import AppLoader from '@/components/AppLoader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import CampaignMapView, { type CampaignWithPolygon } from '@/components/CampaignMapView';
import type { CampaignWithArea } from '@/components/CampaignTimelineCard';

function parseInterestedCropIds(raw: string | null | undefined): string[] {
  if (raw == null || raw === '') return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) return parsed as string[];
  } catch {
    return (raw as string).split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export default function CaseMapFinder() {
  const [campaigns, setCampaigns] = useState<CampaignWithPolygon[]>([]);
  const [campaignsWithArea, setCampaignsWithArea] = useState<CampaignWithArea[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [linkedProviders, setLinkedProviders] = useState<LinkedProvider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [filterByMyFields, setFilterByMyFields] = useState(false);
  const [filterByMyCrops, setFilterByMyCrops] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'past'>('open');
  const [filterDateFrom, setFilterDateFrom] = useState(() => getDefaultPeriod().from);
  const [filterDateTo, setFilterDateTo] = useState(() => getDefaultPeriod().to);
  const [loading, setLoading] = useState(true);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [farmerId, setFarmerId] = useState<string | null>(null);
  const [interestedCropIds, setInterestedCropIds] = useState<string[]>([]);

  // 農家: 紐付き業者・畑・品目を取得
  useEffect(() => {
    getCurrentUser().then((user) => {
      if (!user || user.role !== 'farmer') return;
      setFarmerId(user.id);
      setInterestedCropIds(parseInterestedCropIds(user.interested_crop_ids));
      fetchLinkedProvidersForFarmer(user.id).then(setLinkedProviders);
      fetchFieldsByFarmer(user.id).then(setFields);
    });
  }, []);

  // 案件取得: 業者・表示・期間フィルタに従う（業者未選択時は全業者の案件）
  useEffect(() => {
    getCurrentUser().then((user) => {
      if (!user || user.role !== 'farmer') return;
      setLoading(true);
      const statusForApi = filterStatus === 'all' ? 'all' : filterStatus === 'open' ? 'open' : 'past';
      const promise = fetchCampaigns({
        status: statusForApi,
        providerId: selectedProviderId ?? undefined,
        dateFrom: filterDateFrom || undefined,
        dateTo: filterDateTo || undefined,
      });

      promise
        .then((campaignList) => {
          const withPolygon: CampaignWithPolygon[] = campaignList.map((c) => ({
            ...c,
            polygonGeoJSON: parseCampaignPolygon(c.target_area_polygon) ?? undefined,
          }));
          setCampaigns(withPolygon);
          return Promise.all(
            campaignList.map((c) =>
              fetchCampaignTotalArea(c.id).then((total) => ({ ...c, totalArea10r: total }))
            )
          );
        })
        .then((withArea) => {
          setCampaignsWithArea((withArea ?? []) as CampaignWithArea[]);
        })
        .finally(() => setLoading(false));
    });
  }, [selectedProviderId, filterStatus, filterDateFrom, filterDateTo]);

  const campaignToEligibleFields = useMemo(() => {
    const map = new Map<string, Field[]>();
    campaigns.forEach((c) => {
      const polygon = c.polygonGeoJSON ?? parseCampaignPolygon(c.target_area_polygon);
      const eligible = fields.filter((f) => isFieldInCampaignArea(f, polygon ?? undefined));
      if (eligible.length > 0) map.set(c.id, eligible);
    });
    return map;
  }, [campaigns, fields]);

  // クライアント側フィルタ: 自分の畑エリア内のみ・自分の品目のみ
  const filteredCampaignsWithArea = useMemo(() => {
    let list = campaignsWithArea;
    if (filterByMyFields) {
      list = list.filter((c) => (campaignToEligibleFields.get(c.id) ?? []).length > 0);
    }
    if (filterByMyCrops && interestedCropIds.length > 0) {
      list = list.filter((c) => c.target_crop_id && interestedCropIds.includes(c.target_crop_id));
    }
    return list;
  }, [campaignsWithArea, filterByMyFields, filterByMyCrops, interestedCropIds, campaignToEligibleFields]);

  const filteredCampaignsForMap = useMemo(() => {
    const ids = new Set(filteredCampaignsWithArea.map((c) => c.id));
    return campaigns.filter((c) => ids.has(c.id));
  }, [campaigns, filteredCampaignsWithArea]);

  if (loading) {
    return (
      <main className="min-h-full flex items-center justify-center">
        <AppLoader message="地図を読み込み中..." />
      </main>
    );
  }

  return (
    <main className="min-h-full">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <h1 className="text-xl font-bold text-dashboard-text mb-2 flex items-center gap-2">
          <MapPin className="w-6 h-6 text-agrix-forest" />
          地図で案件を探す
        </h1>
        <p className="text-sm text-dashboard-muted mb-6">
          募集中の案件エリア（緑）とあなたの畑（ピン）を地図で確認できます。畑がエリア内にある案件は「参加可能」と表示されます。
        </p>

        {/* 業者を選ぶ */}
        {farmerId && (
          <Card className="mb-6 p-4 border-dashboard-border bg-dashboard-card/50">
            <p className="text-sm font-medium text-dashboard-text mb-3">どの業者の案件を見ますか？</p>
            {linkedProviders.length === 0 ? (
              <p className="text-sm text-dashboard-muted">
                紐付いている業者がいません。マイページで招待コードを入力するか、業者から招待リンクで紐づけましょう。
              </p>
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
                    onClick={() => setSelectedProviderId(null)}
                  >
                    選択を解除
                  </Button>
                )}
              </div>
            )}
          </Card>
        )}

        {/* 案件一覧と同じフィルタ */}
        {farmerId && (
          <Card className="mb-6 p-4 border-dashboard-border bg-dashboard-card/50">
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
                <Label htmlFor="case-map-filter-status" className="text-sm text-dashboard-muted shrink-0">表示</Label>
                <select
                  id="case-map-filter-status"
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
                <Label htmlFor="case-map-date-from" className="text-sm text-dashboard-muted shrink-0">期間</Label>
                <Input
                  id="case-map-date-from"
                  type="text"
                  placeholder="yyyy/mm/dd"
                  value={isoToYyyyMmDd(filterDateFrom)}
                  onChange={(e) => setFilterDateFrom(yyyyMmDdToIso(e.target.value))}
                  className="w-36 h-8 text-sm"
                />
                <span className="text-dashboard-muted">～</span>
                <Input
                  id="case-map-date-to"
                  type="text"
                  placeholder="yyyy/mm/dd"
                  value={isoToYyyyMmDd(filterDateTo)}
                  onChange={(e) => setFilterDateTo(yyyyMmDdToIso(e.target.value))}
                  className="w-36 h-8 text-sm"
                />
              </div>
            </div>
            <p className="text-xs text-dashboard-muted mt-2">
              自分の畑の周辺や登録した品目に合う案件が絞り込まれます。
            </p>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <Card className="overflow-hidden p-0">
              <div className="h-[480px] w-full">
                <CampaignMapView
                  campaigns={filteredCampaignsForMap}
                  fields={fields}
                  highlightedCampaignId={highlightedId}
                  style={{ height: '100%', minHeight: '480px', borderRadius: 0 }}
                />
              </div>
            </Card>
          </div>
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-dashboard-text flex items-center gap-2">
              <Sprout className="w-4 h-4 text-agrix-forest" />
              {selectedProviderId
                ? `${linkedProviders.find((p) => p.id === selectedProviderId)?.name ?? '業者'}の案件`
                : '募集中の案件'}
            </h2>
            {filteredCampaignsWithArea.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-dashboard-muted text-sm">
                  {campaignsWithArea.length === 0
                    ? '現在募集中の案件はありません。'
                    : 'フィルタに一致する案件はありません。条件を変えてみてください。'}
                </CardContent>
              </Card>
            ) : (
              <ul className="space-y-2">
                {filteredCampaignsWithArea.map((c) => {
                  const eligibleFields = campaignToEligibleFields.get(c.id) ?? [];
                  const isEligible = eligibleFields.length > 0;
                  return (
                    <li key={c.id}>
                      <Card
                        className={`cursor-pointer transition-all border-2 ${
                          highlightedId === c.id ? 'border-agrix-forest ring-2 ring-agrix-forest/20' : 'hover:border-agrix-forest/50'
                        }`}
                        onClick={() => setHighlightedId((prev) => (prev === c.id ? null : c.id))}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-bold text-dashboard-text text-sm leading-tight truncate">
                                {(c as { campaign_title?: string }).campaign_title || c.location}
                              </p>
                              <p className="text-xs text-dashboard-muted mt-0.5">{c.location}</p>
                              {isEligible && (
                                <div className="mt-2 flex items-center gap-1.5 text-agrix-forest text-xs font-bold">
                                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                                  参加可能
                                  {eligibleFields.length > 0 && (
                                    <span className="text-dashboard-muted font-normal">
                                      （{eligibleFields.map((f) => f.name || '畑').join('・')}）
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <Link href="/" onClick={(e) => e.stopPropagation()}>
                              <Button size="sm" className="shrink-0 bg-agrix-forest hover:bg-agrix-forest-dark">
                                <ArrowRight className="w-4 h-4" />
                              </Button>
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {fields.length === 0 && (
          <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
            <CardContent className="p-4 flex items-center gap-3">
              <Sprout className="w-8 h-8 text-amber-600 shrink-0" />
              <div>
                <p className="font-bold text-dashboard-text">畑を登録すると「参加可能」が分かります</p>
                <p className="text-sm text-dashboard-muted">
                  マイ畑で住所や位置を登録すると、地図上に表示され、案件エリア内かどうかが判定されます。
                </p>
                <Link href="/my-fields">
                  <Button variant="outline" size="sm" className="mt-2 border-agrix-forest text-agrix-forest hover:bg-agrix-forest/10">
                マイ畑を登録する
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
