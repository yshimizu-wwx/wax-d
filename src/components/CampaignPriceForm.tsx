'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CampaignCalculationResult } from '@/lib/calculator/types';

const defaultPricing = {
  base_price: 20000,
  min_price: 15000,
  target_area_10r: 50,
  min_target_area_10r: 30,
  max_target_area_10r: 50,
  execution_price: 18000,
};

export default function CampaignPriceForm() {
  const [basePrice, setBasePrice] = useState(String(defaultPricing.base_price));
  const [minPrice, setMinPrice] = useState(String(defaultPricing.min_price));
  const [targetArea10r, setTargetArea10r] = useState(String(defaultPricing.target_area_10r));
  const [totalArea10r, setTotalArea10r] = useState('0');
  const [appliedArea10r, setAppliedArea10r] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CampaignCalculationResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const num = (v: string) => (v === '' ? undefined : Number(v));
      const res = await fetch('/api/campaigns/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_price: Number(basePrice) || 0,
          min_price: Number(minPrice) || 0,
          target_area_10r: Number(targetArea10r) || 0,
          min_target_area_10r: num(defaultPricing.min_target_area_10r.toString()),
          max_target_area_10r: num(defaultPricing.max_target_area_10r.toString()),
          execution_price: num(defaultPricing.execution_price.toString()),
          totalArea10r: Number(totalArea10r) || 0,
          appliedArea10r: appliedArea10r === '' ? undefined : Number(appliedArea10r),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'エラー');
        return;
      }
      setResult(data.result);
    } catch {
      setError('リクエストに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn('flex flex-col gap-4 max-w-sm')}>
      <div className={cn('grid grid-cols-2 gap-2')}>
        <label className={cn('col-span-2 text-sm font-medium text-slate-700')}>開始単価（円/10R）</label>
        <Input
          type="number"
          value={basePrice}
          onChange={(e) => setBasePrice(e.target.value)}
          className={cn('col-span-2')}
        />
        <label className={cn('col-span-2 text-sm font-medium text-slate-700')}>目標単価（円/10R）</label>
        <Input
          type="number"
          value={minPrice}
          onChange={(e) => setMinPrice(e.target.value)}
          className={cn('col-span-2')}
        />
        <label className={cn('col-span-2 text-sm font-medium text-slate-700')}>目標面積（10R）</label>
        <Input
          type="number"
          value={targetArea10r}
          onChange={(e) => setTargetArea10r(e.target.value)}
          className={cn('col-span-2')}
        />
        <label className={cn('col-span-2 text-sm font-medium text-slate-700')}>申込合計面積（10R）</label>
        <Input
          type="number"
          value={totalArea10r}
          onChange={(e) => setTotalArea10r(e.target.value)}
          className={cn('col-span-2')}
        />
        <label className={cn('col-span-2 text-sm font-medium text-slate-700')}>見積面積（10R）任意</label>
        <Input
          type="number"
          placeholder="未入力可"
          value={appliedArea10r}
          onChange={(e) => setAppliedArea10r(e.target.value)}
          className={cn('col-span-2')}
        />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? '計算中…' : '計算'}
      </Button>
      {error && <p className={cn('text-sm text-red-600')}>{error}</p>}
      {result && (
        <div className={cn('rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm')}>
          <p>現在単価: {result.currentPrice != null ? `${result.currentPrice.toLocaleString()} 円/10R` : '不成立'}</p>
          <p>進捗: {(result.progress * 100).toFixed(1)}%</p>
          <p>不成立: {result.isUnformed ? 'はい' : 'いいえ'}</p>
          <p>残り面積: {result.remainingArea.toFixed(1)} 10R</p>
          {result.amountInclusive != null && (
            <>
              <p>税抜: {result.amountExTax?.toLocaleString()} 円</p>
              <p>税込: {result.amountInclusive.toLocaleString()} 円</p>
            </>
          )}
        </div>
      )}
    </form>
  );
}
