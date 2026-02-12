'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Send } from 'lucide-react';
import { toast } from 'sonner';
import { getCurrentUser, type User } from '@/lib/auth';
import { createWorkRequest, fetchWorkRequestsByFarmer, type WorkRequestData } from '@/lib/api';
import type { WorkRequest } from '@/types/database';
import AppLoader from '@/components/AppLoader';
import WorkRequestForm from '@/components/WorkRequestForm';
import { Card, CardContent } from '@/components/ui/card';

const statusLabel: Record<string, string> = {
  pending: '依頼中',
  converted: '案件化済み',
  rejected: 'お断り',
};

export default function RequestsPage() {
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
    if (!user || user.role !== 'farmer') return;
    fetchWorkRequestsByFarmer(user.id).then(setRequests);
  }, [user]);

  useEffect(() => {
    if (loading || !user) return;
    if (user.role !== 'farmer') {
      router.replace('/');
    }
  }, [user, loading, router]);

  const handleSubmit = async (data: WorkRequestData) => {
    if (!user || user.role !== 'farmer') return;
    const result = await createWorkRequest(data);
    if (result.success) {
      toast.success('作業依頼を送信しました');
      fetchWorkRequestsByFarmer(user.id).then(setRequests);
    } else {
      toast.error(result.error || '送信に失敗しました');
      throw new Error(result.error);
    }
  };

  if (loading) {
    return (
      <main className="min-h-full flex items-center justify-center">
        <AppLoader message="読み込み中..." />
      </main>
    );
  }

  if (!user || user.role !== 'farmer') {
    return (
      <main className="min-h-full flex items-center justify-center">
        <AppLoader message="リダイレクト中..." />
      </main>
    );
  }

  return (
    <main className="min-h-full">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <h1 className="text-xl font-bold text-dashboard-text mb-2 flex items-center gap-2">
          <Send className="w-6 h-6 text-agrix-forest" />
          作業依頼
        </h1>
        <p className="text-sm text-dashboard-muted mb-6">
          業者に作業を依頼し、案件として募集してもらうための依頼を送信できます。
        </p>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-dashboard-text mb-4">新規依頼</h2>
          <WorkRequestForm farmerId={user.id} onSubmit={handleSubmit} />
        </section>

        <section>
          <h2 className="text-lg font-bold text-dashboard-text mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-agrix-forest" />
            依頼一覧
          </h2>
          <Card className="overflow-hidden">
            {requests.length === 0 ? (
              <CardContent className="p-10 text-center text-dashboard-muted">
                まだ依頼がありません。上記フォームから依頼を送信してください。
              </CardContent>
            ) : (
              <ul className="divide-y divide-dashboard-border">
                {requests.map((r) => (
                  <li key={r.id} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-dashboard-text">
                          {r.crop_name_free_text || r.crop_name || '（作物未指定）'}
                          {r.task_detail_free_text || r.task_detail_name ? ` · ${r.task_detail_free_text || r.task_detail_name}` : ''}
                        </p>
                        <p className="text-sm text-dashboard-muted">
                          {r.location && `${r.location} · `}
                          希望: {r.desired_start_date || '未定'} ～ {r.desired_end_date || '未定'}
                          {r.estimated_area_10r != null && ` · ${r.estimated_area_10r} 反`}
                          {r.desired_price != null && ` · ¥${Number(r.desired_price).toLocaleString()}`}
                        </p>
                        <p className="text-xs text-dashboard-muted mt-1">
                          {r.created_at && new Date(r.created_at).toLocaleString('ja-JP')}
                          {' · '}
                          <span className={r.status === 'converted' ? 'text-agrix-forest font-medium' : r.status === 'rejected' ? 'text-red-600' : ''}>
                            {statusLabel[r.status] || r.status}
                          </span>
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </div>
    </main>
  );
}
