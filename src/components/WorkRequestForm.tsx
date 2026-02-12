'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { WorkRequestData } from '@/lib/api';

export interface WorkRequestFormProps {
  farmerId: string;
  onSubmit: (data: WorkRequestData) => Promise<void>;
  onCancel?: () => void;
}

export default function WorkRequestForm({ farmerId, onSubmit, onCancel }: WorkRequestFormProps) {
  const [location, setLocation] = useState('');
  const [cropName, setCropName] = useState('');
  const [taskCategory, setTaskCategory] = useState('');
  const [taskDetail, setTaskDetail] = useState('');
  const [desiredStartDate, setDesiredStartDate] = useState('');
  const [desiredEndDate, setDesiredEndDate] = useState('');
  const [estimatedArea10r, setEstimatedArea10r] = useState<string>('');
  const [desiredPrice, setDesiredPrice] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        farmer_id: farmerId,
        location: location || undefined,
        crop_name_free_text: cropName || undefined,
        task_category_free_text: taskCategory || undefined,
        task_detail_free_text: taskDetail || undefined,
        desired_start_date: desiredStartDate || undefined,
        desired_end_date: desiredEndDate || undefined,
        estimated_area_10r: estimatedArea10r ? Number(estimatedArea10r) : undefined,
        desired_price: desiredPrice ? Number(desiredPrice) : undefined,
        notes: notes || undefined,
      });
      setLocation('');
      setCropName('');
      setTaskCategory('');
      setTaskDetail('');
      setDesiredStartDate('');
      setDesiredEndDate('');
      setEstimatedArea10r('');
      setDesiredPrice('');
      setNotes('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="location">依頼場所・地域</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="例: 〇〇県〇〇市"
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="crop">作物名</Label>
              <Input
                id="crop"
                value={cropName}
                onChange={(e) => setCropName(e.target.value)}
                placeholder="例: 水稲"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="taskCategory">作業カテゴリ</Label>
              <Input
                id="taskCategory"
                value={taskCategory}
                onChange={(e) => setTaskCategory(e.target.value)}
                placeholder="例: 防除"
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="taskDetail">作業内容（詳細）</Label>
            <Input
              id="taskDetail"
              value={taskDetail}
              onChange={(e) => setTaskDetail(e.target.value)}
              placeholder="例: ドローン散布"
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="desiredStartDate">希望開始日</Label>
              <Input
                id="desiredStartDate"
                type="date"
                value={desiredStartDate}
                onChange={(e) => setDesiredStartDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="desiredEndDate">希望終了日</Label>
              <Input
                id="desiredEndDate"
                type="date"
                value={desiredEndDate}
                onChange={(e) => setDesiredEndDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="estimatedArea">想定面積（反）</Label>
              <Input
                id="estimatedArea"
                type="number"
                min="0"
                step="0.1"
                value={estimatedArea10r}
                onChange={(e) => setEstimatedArea10r(e.target.value)}
                placeholder="例: 10"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="desiredPrice">希望予算（円）</Label>
              <Input
                id="desiredPrice"
                type="number"
                min="0"
                value={desiredPrice}
                onChange={(e) => setDesiredPrice(e.target.value)}
                placeholder="例: 150000"
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="notes">備考</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="業者への連絡事項など"
              className="mt-1 w-full min-h-[80px] rounded-lg border border-dashboard-border bg-dashboard-card px-3 py-2 text-sm text-dashboard-text focus:outline-none focus:ring-2 focus:ring-agrix-forest"
            />
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="submit" disabled={submitting} className="bg-agrix-forest hover:bg-agrix-forest-dark">
              {submitting ? '送信中...' : '作業を依頼する'}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                キャンセル
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
