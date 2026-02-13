'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ListTodo,
  FileCheck,
  AlertTriangle,
  Calendar,
  ChevronRight,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { getCurrentUser, type User } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DAYS_NEAR = 3; // この日数以内を「期日が近い」とする

interface CampaignInfo {
  id: string;
  campaign_title: string | null;
  location: string;
  final_date: string | null;
  status: string;
}

interface BookingTask {
  id: string;
  campaign_id: string;
  farmer_id: string | null;
  farmer_name: string | null;
  area_10r: number;
  work_status: string | null;
  confirmed_date: string | null;
  campaign?: CampaignInfo;
}

function getAlertLevel(confirmedDate: string | null): 'overdue' | 'soon' | null {
  if (!confirmedDate) return null;
  const d = new Date(confirmedDate);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return 'overdue';
  if (diffDays <= DAYS_NEAR) return 'soon';
  return null;
}

export default function ProviderTasksPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<BookingTask[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignInfo[]>([]);
  const [tab, setTab] = useState<'pending' | 'completed'>('pending');

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u || u.role !== 'provider') {
        router.replace('/login');
        return;
      }
      setUser(u);

      const { data: campData } = await supabase
        .from('campaigns')
        .select('id, campaign_title, location, final_date, status')
        .eq('provider_id', u.id)
        .in('status', ['closed', 'completed', 'archived']);

      const campList = (campData ?? []) as CampaignInfo[];
      setCampaigns(campList);
      const campaignIds = campList.map((c) => c.id);

      if (campaignIds.length === 0) {
        setBookings([]);
        setLoading(false);
        return;
      }

      const { data: bookData } = await supabase
        .from('bookings')
        .select('id, campaign_id, farmer_id, farmer_name, area_10r, work_status, confirmed_date')
        .in('campaign_id', campaignIds)
        .neq('status', 'canceled');

      const list = (bookData ?? []) as BookingTask[];
      const campMap = new Map(campList.map((c) => [c.id, c]));
      list.forEach((b) => {
        b.campaign = campMap.get(b.campaign_id);
      });
      setBookings(list);
      setLoading(false);
    })();
  }, [router]);

  const pending = useMemo(
    () =>
      [...bookings]
        .filter((b) => b.work_status !== 'completed')
        .sort((a, b) => {
          const ad = a.confirmed_date ? new Date(a.confirmed_date).getTime() : 0;
          const bd = b.confirmed_date ? new Date(b.confirmed_date).getTime() : 0;
          if (ad === 0 && bd === 0) return 0;
          if (ad === 0) return 1;
          if (bd === 0) return -1;
          return ad - bd;
        }),
    [bookings]
  );

  const completed = useMemo(
    () =>
      bookings
        .filter((b) => b.work_status === 'completed')
        .sort((a, b) => {
          const ad = a.confirmed_date ? new Date(a.confirmed_date).getTime() : 0;
          const bd = b.confirmed_date ? new Date(b.confirmed_date).getTime() : 0;
          return bd - ad;
        }),
    [bookings]
  );

  if (loading || !user) {
    return (
      <main className="min-h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-agrix-forest" />
      </main>
    );
  }

  const renderTaskRow = (b: BookingTask, showAlert: boolean) => {
    const alertLevel = showAlert ? getAlertLevel(b.confirmed_date) : null;
    return (
      <li
        key={b.id}
        className={cn(
          'py-4 flex flex-wrap items-center justify-between gap-3 rounded-xl px-3 -mx-3 transition-colors',
          alertLevel === 'overdue' && 'bg-red-500/10 border border-red-500/30',
          alertLevel === 'soon' && 'bg-amber-500/10 border border-amber-500/30'
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-dashboard-text">
              {b.campaign?.campaign_title || b.campaign?.location || '案件'}
            </p>
            {alertLevel === 'overdue' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold">
                <AlertTriangle className="w-3.5 h-3.5" />
                報告期限切れ
              </span>
            )}
            {alertLevel === 'soon' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-bold">
                <Clock className="w-3.5 h-3.5" />
                期日が近い
              </span>
            )}
          </div>
          <p className="text-sm text-dashboard-muted mt-0.5">
            {b.farmer_name || '農家'}
            {' · '}
            {b.confirmed_date
              ? new Date(b.confirmed_date).toLocaleDateString('ja-JP')
              : '日付未定'}
            {' · '}
            {b.area_10r} 反
          </p>
        </div>
        {showAlert && (
          <Link href="/provider/reports/new">
            <Button size="sm" className="gap-1 bg-agrix-forest hover:bg-agrix-forest-dark">
              <FileCheck className="w-4 h-4" />
              実績報告
            </Button>
          </Link>
        )}
      </li>
    );
  };

  return (
    <main className="min-h-full">
      <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
        <h1 className="text-xl md:text-2xl font-bold text-dashboard-text flex items-center gap-2 mb-6">
          <ListTodo className="w-6 h-6 text-agrix-forest" />
          作業
        </h1>

        <div className="flex border-b border-dashboard-border mb-6">
          <button
            type="button"
            onClick={() => setTab('pending')}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors',
              tab === 'pending'
                ? 'border-agrix-forest text-agrix-forest'
                : 'border-transparent text-dashboard-muted hover:text-dashboard-text'
            )}
          >
            <Clock className="w-4 h-4" />
            作業予定（未報告）
            <span className="tabular-nums text-xs font-normal opacity-80">({pending.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('completed')}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors',
              tab === 'completed'
                ? 'border-agrix-forest text-agrix-forest'
                : 'border-transparent text-dashboard-muted hover:text-dashboard-text'
            )}
          >
            <CheckCircle2 className="w-4 h-4" />
            作業完了（済）
            <span className="tabular-nums text-xs font-normal opacity-80">({completed.length})</span>
          </button>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              {tab === 'pending' ? (
                <>
                  <Clock className="w-5 h-5 text-agrix-forest" />
                  作業予定（未報告）
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 text-agrix-forest" />
                  作業完了（報告済）
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tab === 'pending' && pending.length === 0 && (
              <div className="py-12 text-center text-dashboard-muted">
                <p className="font-medium mb-1">未報告の作業はありません</p>
                <p className="text-sm">案件を「日付確定」まで進めると、ここに表示されます。</p>
                <Link href="/provider/projects">
                  <Button variant="outline" size="sm" className="mt-4">
                    案件一覧へ
                  </Button>
                </Link>
              </div>
            )}
            {tab === 'pending' && pending.length > 0 && (
              <ul className="divide-y divide-dashboard-border">
                {pending.map((b) => renderTaskRow(b, true))}
              </ul>
            )}
            {tab === 'completed' && completed.length === 0 && (
              <div className="py-12 text-center text-dashboard-muted">
                <p className="font-medium">報告済みの作業はまだありません</p>
                <Link href="/provider/reports/new">
                  <Button variant="outline" size="sm" className="mt-4 gap-2">
                    <FileCheck className="w-4 h-4" />
                    実績報告をする
                  </Button>
                </Link>
              </div>
            )}
            {tab === 'completed' && completed.length > 0 && (
              <ul className="divide-y divide-dashboard-border">
                {completed.map((b) => renderTaskRow(b, false))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 flex flex-wrap gap-4">
          <Link
            href="/provider/reports/new"
            className="inline-flex items-center gap-2 text-sm font-bold text-agrix-forest hover:underline"
          >
            <FileCheck className="w-4 h-4" />
            実績報告
          </Link>
          <Link
            href="/provider/calendar"
            className="inline-flex items-center gap-2 text-sm font-medium text-dashboard-muted hover:text-dashboard-text"
          >
            <Calendar className="w-4 h-4" />
            カレンダー
          </Link>
        </div>
      </div>
    </main>
  );
}
