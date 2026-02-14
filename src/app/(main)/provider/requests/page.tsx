'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Send, ArrowRightCircle } from 'lucide-react';
import { getCurrentUser, type User } from '@/lib/auth';
import { fetchWorkRequestsByProvider } from '@/lib/api';
import type { WorkRequest } from '@/types/database';
import AppLoader from '@/components/AppLoader';
import { formatDateWithWeekday, formatDateTimeWithWeekday } from '@/lib/dateFormat';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const statusLabel: Record<string, string> = {
  pending: '依頼中',
  converted: '案件化済み',
  rejected: 'お断り',
};

export default function ProviderRequestsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<WorkRequest[]>([]);

  useEffect(() => {
    getCurrentUser().then((u) => {
      setUser(u ?? null);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user || user.role !== 'provider') return;
    fetchWorkRequestsByProvider(user.id).then(setRequests);
  }, [user]);

  useEffect(() => {
    if (loading || !user) return;
    if (user.role !== 'provider') {
      router.replace('/');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <main className="min-h-full flex items-center justify-center">
        <AppLoader message="読み込み中..." />
      </main>
    );
  }

  if (!user || user.role !== 'provider') {
    return null;
  }

  return (
    <main className="min-h-full bg-dashboard-bg">
      <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
        <div className="mb-6">
          <h1 className="text-xl md:text-2xl font-bold text-dashboard-text flex items-center gap-2">
            <Send className="w-6 h-6 text-agrix-forest" />
            受信した依頼
          </h1>
          <p className="text-sm text-dashboard-muted mt-1">
            農家から届いた作業依頼です。内容を確認し「案件化」で募集案件を作成できます。マスタにない品目・作業種別は案件化時に新規登録できます。
          </p>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">依頼一覧</CardTitle>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <div className="py-12 text-center text-dashboard-muted">
                <p className="font-medium">まだ依頼は届いていません</p>
                <p className="text-sm mt-1">農家が貴社と紐づくと、ここに依頼が表示されます。</p>
              </div>
            ) : (
              <ul className="divide-y divide-dashboard-border">
                {requests.map((r) => (
                  <li key={r.id} className="py-4 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-dashboard-text">
                        {r.crop_name_free_text || r.crop_name || '（作物未指定）'}
                        {(r.task_category_free_text || r.task_category_name) && (
                          <span className="font-normal text-dashboard-muted">
                            {' · '}
                            {r.task_category_free_text || r.task_category_name}
                          </span>
                        )}
                        {(r.task_detail_free_text || r.task_detail_name) && (
                          <span className="text-dashboard-muted">
                            {' · '}
                            {r.task_detail_free_text || r.task_detail_name}
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-dashboard-muted mt-0.5">
                        {r.location && `${r.location} · `}
                        希望: {formatDateWithWeekday(r.desired_start_date, '未定')} ～ {formatDateWithWeekday(r.desired_end_date, '未定')}
                        {r.estimated_area_10r != null && ` · ${r.estimated_area_10r} 反`}
                      </p>
                      {r.notes && (
                        <p className="text-xs text-dashboard-muted mt-1">備考: {r.notes}</p>
                      )}
                      <p className="text-xs text-dashboard-muted mt-1">
                        {r.created_at && formatDateTimeWithWeekday(r.created_at)}
                        {' · '}
                        <span
                          className={
                            r.status === 'converted'
                              ? 'text-agrix-forest font-medium'
                              : r.status === 'rejected'
                                ? 'text-red-600'
                                : ''
                          }
                        >
                          {statusLabel[r.status] || r.status}
                        </span>
                      </p>
                    </div>
                    {r.status === 'pending' && (
                      <Link href={`/admin/campaigns/new?fromWorkRequest=${encodeURIComponent(r.id)}`}>
                        <Button size="sm" className="gap-2 bg-agrix-forest hover:bg-agrix-forest-dark">
                          <ArrowRightCircle className="w-4 h-4" />
                          この依頼を案件化
                        </Button>
                      </Link>
                    )}
                    {r.status === 'converted' && r.converted_campaign_id && (
                      <Link href={`/admin?highlight=${r.converted_campaign_id}`}>
                        <Button size="sm" variant="outline" className="gap-2">
                          案件を見る
                        </Button>
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
