'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FileText, Send, Sprout } from 'lucide-react';
import { toast } from 'sonner';
import { getCurrentUser, type User } from '@/lib/auth';
import {
  createWorkRequest,
  fetchWorkRequestsByFarmer,
  fetchFieldsByFarmer,
  fetchLinkedProvidersForFarmer,
  type WorkRequestData,
} from '@/lib/api';
import type { WorkRequest, Field } from '@/types/database';
import type { LinkedProvider } from '@/lib/api';
import AppLoader from '@/components/AppLoader';
import WorkRequestForm from '@/components/WorkRequestForm';
import { formatDateWithWeekday, formatDateTimeWithWeekday } from '@/lib/dateFormat';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const statusLabel: Record<string, string> = {
  pending: '依頼中',
  converted: '案件化済み',
  rejected: 'お断り',
};

function RequestsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<WorkRequest[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [linkedProviders, setLinkedProviders] = useState<LinkedProvider[]>([]);

  useEffect(() => {
    getCurrentUser().then((u) => {
      setUser(u ?? null);
      setLoading(false);
    });
  }, []);

  const loadData = useCallback(() => {
    if (!user || user.role !== 'farmer') return;
    fetchWorkRequestsByFarmer(user.id).then(setRequests);
    fetchFieldsByFarmer(user.id).then(setFields);
    fetchLinkedProvidersForFarmer(user.id).then(setLinkedProviders);
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // マイページで紐づけした直後に ?linked=1 で遷移してきた場合、紐付き業者を確実に再取得
  useEffect(() => {
    if (!user || user.role !== 'farmer' || searchParams.get('linked') !== '1') return;
    const refetch = () => fetchLinkedProvidersForFarmer(user.id).then(setLinkedProviders);
    refetch();
    const t = window.setTimeout(refetch, 400);
    router.replace('/requests', { scroll: false });
    return () => window.clearTimeout(t);
  }, [user, searchParams, router]);

  // 他タブで紐づけしたあとこのタブに戻ったときに再取得する
  useEffect(() => {
    if (!user || user.role !== 'farmer') return;
    const onFocus = () => fetchLinkedProvidersForFarmer(user.id).then(setLinkedProviders);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
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
          {fields.length === 0 ? (
            <Card>
              <CardContent className="p-8 flex flex-col items-center justify-center text-center">
                <div className="rounded-full bg-amber-500/10 p-4 mb-4">
                  <Sprout className="w-10 h-10 text-amber-600" />
                </div>
                <p className="font-bold text-dashboard-text mb-1">まずは圃場を登録してください</p>
                <p className="text-sm text-dashboard-muted mb-4">
                  作業依頼をするには、依頼対象の畑を登録する必要があります。
                </p>
                <Link href="/my-fields">
                  <Button className="bg-agrix-forest hover:bg-agrix-forest-dark w-full sm:w-auto">
                    畑を登録する
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <WorkRequestForm
              farmerId={user.id}
              fields={fields}
              linkedProviders={linkedProviders}
              onSubmit={handleSubmit}
              onRefetchRequested={async () => {
                const list = await fetchLinkedProvidersForFarmer(user.id);
                setLinkedProviders(list);
                toast.success('確認しました');
                if (list.length === 0) {
                  toast.info('紐付いた業者が表示されません。一度ログアウトして再ログインするか、招待コードをマイページで再度入力してみてください。');
                }
              }}
            />
          )}
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
                          希望: {formatDateWithWeekday(r.desired_start_date, '未定')} ～ {formatDateWithWeekday(r.desired_end_date, '未定')}
                          {r.estimated_area_10r != null && ` · ${r.estimated_area_10r} 反`}
                        </p>
                        <p className="text-xs text-dashboard-muted mt-1">
                          {r.created_at && formatDateTimeWithWeekday(r.created_at)}
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

export default function RequestsPage() {
  return (
    <Suspense fallback={
      <main className="min-h-full flex items-center justify-center">
        <AppLoader message="読み込み中..." />
      </main>
    }>
      <RequestsPageContent />
    </Suspense>
  );
}
