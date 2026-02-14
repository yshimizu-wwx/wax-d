'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Sprout, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { getCurrentUser, updateFarmerProductionCrops, type User } from '@/lib/auth';
import { fetchMasters } from '@/lib/masters';
import type { Master } from '@/types/database';

function parseInterestedCropIds(raw: string | null | undefined): string[] {
  if (raw == null || raw === '') return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
      return parsed as string[];
    }
  } catch {
    // カンマ区切りのフォールバック
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export default function ProductionCropsSection() {
  const [user, setUser] = useState<User | null>(null);
  const [crops, setCrops] = useState<Master[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getCurrentUser().then((u) => {
      if (u?.role === 'farmer') {
        setUser(u);
        setSelectedIds(new Set(parseInterestedCropIds(u.interested_crop_ids ?? undefined)));
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (user?.role !== 'farmer') return;
    fetchMasters('crop', null).then((list) => setCrops(list));
  }, [user?.role]);

  const handleToggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.role !== 'farmer') return;
    setSubmitting(true);
    try {
      const result = await updateFarmerProductionCrops(Array.from(selectedIds));
      if (result.success) {
        setUser((prev) =>
          prev ? { ...prev, interested_crop_ids: JSON.stringify(Array.from(selectedIds)) } : null
        );
        toast.success('生産品目を保存しました');
      } else {
        toast.error(result.error || '保存に失敗しました');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user || user.role !== 'farmer') {
    return null;
  }

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="text-lg font-bold dark:text-white text-zinc-900 mb-1 flex items-center gap-2">
          <Sprout className="w-5 h-5 text-agrix-forest" />
          生産品目
        </h2>
        <p className="text-sm dark:text-zinc-400 text-zinc-500 mb-4">
          作っている品目を登録すると、案件一覧で「自分の品目」の案件を優先して表示できます。
        </p>
        {crops.length === 0 ? (
          <p className="text-sm text-dashboard-muted">品目マスタがまだ登録されていません。</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="dark:text-white text-zinc-900">登録する品目（複数選択可）</Label>
              <ul className="border border-dashboard-border rounded-xl p-4 max-h-48 overflow-y-auto space-y-2 bg-dashboard-card/50">
                {crops.map((m) => (
                  <li key={m.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`crop-${m.id}`}
                      checked={selectedIds.has(m.id)}
                      onChange={() => handleToggle(m.id)}
                      className="rounded border-dashboard-border text-agrix-forest focus:ring-agrix-forest"
                    />
                    <label
                      htmlFor={`crop-${m.id}`}
                      className="text-sm font-medium text-dashboard-text cursor-pointer select-none"
                    >
                      {m.name}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-agrix-forest hover:bg-agrix-forest-dark"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                '保存'
              )}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
