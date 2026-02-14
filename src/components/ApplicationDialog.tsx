'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { calculateCurrentUnitPrice } from '@/lib/calculator/priceCalculator';
import type { CampaignPricing } from '@/lib/calculator/types';
import type { CampaignWithArea } from '@/components/CampaignTimelineCard';
import type { FarmerBookingItem } from '@/services/booking.service';
import type { Field } from '@/types/database';
import type { User } from '@/lib/auth';
import { Sprout, Calendar } from 'lucide-react';
import { DateInputWithWeekday } from '@/components/ui/date-input-with-weekday';

export interface ApplicationFormSelection {
  fieldId: string;
  area10r: number;
}

export interface ApplicationFormData {
  /** 申し込み対象の畑と面積の一覧（複数可） */
  selections: ApplicationFormSelection[];
  /** 希望作業日（任意・1日のみ。未入力可） */
  desiredDate?: string;
}

interface ApplicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: CampaignWithArea | null;
  user: User | null;
  farmerBookings: FarmerBookingItem[];
  fields: Field[];
  onSubmit: (data: ApplicationFormData) => Promise<void>;
}

/** この案件で既に申し込んでいる畑ID（キャンセル済み・キャンセル依頼中を除く） */
function getAppliedFieldIds(bookings: FarmerBookingItem[], campaignId: string): Set<string> {
  return new Set(
    bookings
      .filter(
        (b) =>
          b.campaign_id === campaignId &&
          b.status !== 'canceled' &&
          b.status !== 'cancel_requested'
      )
      .map((b) => b.field_id)
      .filter((id): id is string => Boolean(id))
  );
}

export default function ApplicationDialog({
  open,
  onOpenChange,
  campaign,
  user,
  farmerBookings,
  fields,
  onSubmit,
}: ApplicationDialogProps) {
  /** 選択した畑と面積の一覧（複数選択可） */
  const [selections, setSelections] = useState<ApplicationFormSelection[]>([]);
  /** 希望作業日（任意・1日のみ） */
  const [desiredDate, setDesiredDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const appliedFieldIds = campaign ? getAppliedFieldIds(farmerBookings, campaign.id) : new Set<string>();
  const availableFields = fields.filter((f) => !appliedFieldIds.has(f.id));

  const effectiveArea = selections.reduce((sum, s) => sum + s.area10r, 0);

  const pricing: CampaignPricing | null = campaign
    ? {
        base_price: campaign.base_price || 0,
        min_price: campaign.min_price || 0,
        target_area_10r: campaign.target_area_10r || 0,
        min_target_area_10r: campaign.min_target_area_10r ?? undefined,
        max_target_area_10r: campaign.max_target_area_10r ?? undefined,
        execution_price: campaign.execution_price ?? undefined,
      }
    : null;

  const totalArea = (campaign?.totalArea10r ?? 0) + effectiveArea;
  const result = pricing ? calculateCurrentUnitPrice(pricing, totalArea) : null;
  const lockedPrice = result?.currentPrice ?? campaign?.base_price ?? 0;

  useEffect(() => {
    if (!open) return;
    setSelections([]);
    setDesiredDate('');
  }, [open]);

  /** 面積が登録済みの畑のみ申し込み対象（合計面積は変更不可のため） */
  const availableFieldsWithArea = availableFields.filter(
    (f) => f.area_size != null && f.area_size > 0
  );

  const toggleField = (field: Field) => {
    const area10r = field.area_size!;
    setSelections((prev) => {
      const exists = prev.some((s) => s.fieldId === field.id);
      if (exists) return prev.filter((s) => s.fieldId !== field.id);
      return [...prev, { fieldId: field.id, area10r }];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaign || !user) return;
    if (selections.length === 0) {
      toast.error('申し込みたい畑を1つ以上選んでください');
      return;
    }
    if (effectiveArea < 1) {
      toast.error('申し込みたい畑を1つ以上選んでください');
      return;
    }
    if (campaign.start_date && campaign.end_date && desiredDate) {
      if (desiredDate < campaign.start_date || desiredDate > campaign.end_date) {
        toast.error('案件の作業期間内で希望日を選んでください');
        return;
      }
    }
    setSubmitting(true);
    try {
      await onSubmit({
        selections,
        desiredDate: desiredDate.trim() || undefined,
      });
      onOpenChange(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const isClosed = campaign?.is_closed === true || ['closed', 'completed', 'unformed'].includes(String(campaign?.status ?? ''));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-white text-slate-900">
        <DialogHeader>
          <DialogTitle className="text-slate-900">
            {campaign && farmerBookings.some((b) => b.campaign_id === campaign.id && b.status !== 'canceled' && b.status !== 'cancel_requested')
              ? '追加で申し込む'
              : '申し込み情報'}
          </DialogTitle>
        </DialogHeader>
        {!campaign ? (
          <p className="text-slate-600 text-sm">案件を選択してください。</p>
        ) : isClosed ? (
          <p className="text-slate-600 text-sm">この案件は募集終了のため申し込みできません。</p>
        ) : availableFields.length === 0 ? (
          <div className="space-y-4">
            <p className="text-slate-600 text-sm">
              {appliedFieldIds.size > 0
                ? 'この案件には、登録している畑はすべて申し込み済みです。新しい畑を登録すると追加で申し込めます。'
                : '申し込むには、まずマイ畑を登録してください。'}
            </p>
            <Link href="/my-fields" onClick={() => onOpenChange(false)}>
              <Button type="button" className="w-full gap-2">
                <Sprout className="h-4 w-4" />
                マイ畑を管理する
              </Button>
            </Link>
          </div>
        ) : availableFieldsWithArea.length === 0 ? (
          <div className="space-y-4">
            <p className="text-slate-600 text-sm">
              申し込むには、マイ畑に面積を登録してください。面積が登録されている畑のみ申し込み対象になります。
            </p>
            <Link href="/my-fields" onClick={() => onOpenChange(false)}>
              <Button type="button" className="w-full gap-2">
                <Sprout className="h-4 w-4" />
                マイ畑を管理する
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <p className="text-sm text-slate-600">
              {(campaign as { campaign_title?: string }).campaign_title || campaign.location}
            </p>

            <section className="space-y-2">
              <label className="block text-sm font-semibold text-slate-900">
                申し込みたい畑 <span className="text-red-600 font-normal">必須</span>
              </label>
              <p className="text-xs text-slate-600">複数選べます。選んだ畑の合計面積が申込面積になります（変更できません）。</p>
              <div className="space-y-2 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                {availableFieldsWithArea.map((f) => {
                  const isChecked = selections.some((s) => s.fieldId === f.id);
                  return (
                    <label
                      key={f.id}
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${isChecked ? 'bg-agrix-forest/10 text-slate-900' : 'hover:bg-slate-100 text-slate-900'}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleField(f)}
                        className="rounded border-slate-300 text-agrix-forest focus:ring-agrix-forest"
                      />
                      <span className="flex-1 text-sm text-slate-900">
                        {f.name || f.address || f.id}
                        （{f.area_size} 反）
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>

            <section className="space-y-2">
              <label className="block text-sm font-semibold text-slate-900">
                <Calendar className="inline w-4 h-4 mr-1 align-middle" aria-hidden />
                希望作業日 <span className="text-slate-500 font-normal text-xs">任意</span>
              </label>
              <DateInputWithWeekday
                value={desiredDate}
                onChange={setDesiredDate}
                min={campaign.start_date ?? undefined}
                max={campaign.end_date ?? undefined}
                placeholder="yyyy/mm/dd（曜日）で選択"
                wrapperClassName="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm focus-within:ring-2 focus-within:ring-agrix-forest/50 focus-within:border-agrix-forest"
              />
              <p className="text-xs text-slate-600">1日だけ選べます。未入力でも申し込めます。</p>
            </section>

            {effectiveArea >= 1 && (
              <section className="rounded-xl border border-slate-200 bg-slate-100 p-4 text-sm space-y-2">
                <div className="flex justify-between items-baseline gap-4">
                  <span className="text-slate-600 shrink-0">申込面積（選んだ畑の合計）</span>
                  <span className="font-semibold text-slate-900 tabular-nums">{effectiveArea} 反</span>
                </div>
                <p className="text-xs text-slate-600">畑の選択のみで決まり、数値の変更はできません。</p>
                <div className="flex justify-between items-baseline gap-4 pt-1 border-t border-slate-200">
                  <span className="text-slate-600 shrink-0">現在の単価（目安）</span>
                  <span className="font-semibold text-agrix-forest tabular-nums">¥{lockedPrice.toLocaleString()}/10a</span>
                </div>
              </section>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                キャンセル
              </Button>
              <Button type="submit" disabled={submitting || selections.length === 0 || effectiveArea < 1}>
                {submitting ? '送信中...' : '申し込む'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
