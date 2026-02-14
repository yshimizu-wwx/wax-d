'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser, type User } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { formatDateWithWeekday } from '@/lib/dateFormat';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, ArrowLeft, Calendar } from 'lucide-react';

interface PastCampaignRow {
  id: string;
  campaign_title: string | null;
  location: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string | null;
}

export default function CampaignCopyPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [campaigns, setCampaigns] = useState<PastCampaignRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u || u.role !== 'provider') {
        router.replace('/login');
        return;
      }
      setUser(u);

      const { data, error } = await supabase
        .from('campaigns')
        .select('id, campaign_title, location, status, start_date, end_date, created_at')
        .eq('provider_id', u.id)
        .in('status', ['closed', 'completed'])
        .order('created_at', { ascending: false });

      if (error) {
        setCampaigns([]);
      } else {
        setCampaigns((data as PastCampaignRow[]) ?? []);
      }
      setLoading(false);
    })();
  }, [router]);

  if (loading || !user) {
    return (
      <main className="min-h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-agrix-forest" />
      </main>
    );
  }

  return (
    <main className="min-h-full">
      <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">
        <div className="flex items-center justify-between gap-4 mb-6">
          <h1 className="text-xl md:text-2xl font-bold text-dashboard-text flex items-center gap-2">
            <Copy className="w-6 h-6 text-agrix-forest" />
            過去の案件をコピー
          </h1>
          <Link href="/provider/projects">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              案件一覧へ
            </Button>
          </Link>
        </div>
        <p className="text-dashboard-muted text-sm mb-6">
          毎年同じような作業の場合は、過去の案件をコピーして日付や細部だけ編集すると便利です。コピー元を選んで「この内容で新規作成」を押してください。
        </p>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">コピー元にする案件を選ぶ</CardTitle>
          </CardHeader>
          <CardContent>
            {campaigns.length === 0 ? (
              <div className="py-12 text-center text-dashboard-muted">
                <p className="font-medium mb-1">過去に確定した案件がありません</p>
                <p className="text-sm mt-1">まずは新規で案件を作成し、募集・締切・確定まで進めると、ここに表示されます。</p>
                <Link href="/admin/campaigns/new">
                  <Button className="mt-4 gap-2">新規作成する</Button>
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-dashboard-border">
                {campaigns.map((c) => (
                  <li key={c.id} className="py-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-dashboard-text">
                        {c.campaign_title || c.location || '（無題）'}
                      </p>
                      <p className="text-sm text-dashboard-muted mt-0.5 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {c.start_date && c.end_date
                          ? `${formatDateWithWeekday(c.start_date)} ～ ${formatDateWithWeekday(c.end_date)}`
                          : '日付なし'}
                        {' · '}
                        {c.location}
                      </p>
                    </div>
                    <Link href={`/admin/campaigns/new?copyFrom=${encodeURIComponent(c.id)}`}>
                      <Button size="sm" className="gap-2 bg-agrix-forest hover:bg-agrix-forest-dark">
                        <Copy className="w-4 h-4" />
                        この内容で新規作成
                      </Button>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <div className="mt-6">
          <Link href="/admin/campaigns/new" className="text-sm text-dashboard-muted hover:text-dashboard-text">
            新規でゼロから作成する
          </Link>
        </div>
      </div>
    </main>
  );
}
