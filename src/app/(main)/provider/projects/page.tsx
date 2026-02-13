'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FolderKanban,
  PlusCircle,
  Calendar,
  ChevronRight,
  FileCheck,
  Clock,
  CheckCircle2,
  CalendarRange,
} from 'lucide-react';
import { getCurrentUser, type User } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { closeCampaign, setCampaignCompleted } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type StepKey = 'draft' | 'recruiting' | 'closed' | 'confirmed';

const STEPS: { key: StepKey; label: string; statuses: string[]; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'draft', label: '作成', statuses: ['unformed'], icon: FileCheck },
  { key: 'recruiting', label: '募集', statuses: ['open', 'applied'], icon: Clock },
  { key: 'closed', label: '締切', statuses: ['closed'], icon: Calendar },
  { key: 'confirmed', label: '確定', statuses: ['completed', 'archived'], icon: CheckCircle2 },
];

interface CampaignRow {
  id: string;
  campaign_title: string | null;
  location: string;
  status: string;
  final_date: string | null;
  start_date: string | null;
  end_date: string | null;
  is_closed: boolean | null;
}

export default function ProviderProjectsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [activeStep, setActiveStep] = useState<StepKey>('recruiting');
  const [actingId, setActingId] = useState<string | null>(null);

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
        .select('id, campaign_title, location, status, final_date, start_date, end_date, is_closed')
        .eq('provider_id', u.id)
        .order('created_at', { ascending: false });

      if (error) {
        toast.error('案件一覧の取得に失敗しました');
        setLoading(false);
        return;
      }
      setCampaigns((data as CampaignRow[]) ?? []);
      setLoading(false);
    })();
  }, [router]);

  const getCampaignsForStep = (stepKey: StepKey) => {
    const step = STEPS.find((s) => s.key === stepKey);
    if (!step) return [];
    return campaigns.filter((c) => step.statuses.includes(c.status));
  };

  const handleCloseCampaign = async (id: string) => {
    setActingId(id);
    const res = await closeCampaign(id);
    setActingId(null);
    if (res.success) {
      toast.success('募集を締め切りました');
      setCampaigns((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'closed' as const, is_closed: true } : c))
      );
    } else {
      toast.error(res.error ?? '締切に失敗しました');
    }
  };

  const handleConfirmCampaign = async (id: string) => {
    setActingId(id);
    const res = await setCampaignCompleted(id);
    setActingId(null);
    if (res.success) {
      toast.success('日付を確定しました');
      setCampaigns((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'completed' as const } : c))
      );
    } else {
      toast.error(res.error ?? '確定に失敗しました');
    }
  };

  if (loading || !user) {
    return (
      <main className="min-h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-agrix-forest" />
      </main>
    );
  }

  const list = getCampaignsForStep(activeStep);

  return (
    <main className="min-h-full">
      <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
        <div className="flex items-center justify-between gap-4 mb-6">
          <h1 className="text-xl md:text-2xl font-bold text-dashboard-text flex items-center gap-2">
            <FolderKanban className="w-6 h-6 text-agrix-forest" />
            案件
          </h1>
          <Link href="/admin/campaigns/new">
            <Button className="gap-2 bg-agrix-forest hover:bg-agrix-forest-dark">
              <PlusCircle className="w-4 h-4" />
              新規作成
            </Button>
          </Link>
        </div>

        {/* 4ステップタブ */}
        <div className="flex border-b border-dashboard-border mb-6 overflow-x-auto">
          {STEPS.map((step) => {
            const Icon = step.icon;
            const count = getCampaignsForStep(step.key).length;
            return (
              <button
                key={step.key}
                type="button"
                onClick={() => setActiveStep(step.key)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors',
                  activeStep === step.key
                    ? 'border-agrix-forest text-agrix-forest'
                    : 'border-transparent text-dashboard-muted hover:text-dashboard-text'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {step.label}
                <span className="tabular-nums text-xs font-normal opacity-80">({count})</span>
              </button>
            );
          })}
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              {(() => {
                const step = STEPS.find((s) => s.key === activeStep);
                const Icon = step?.icon ?? FileCheck;
                return (
                  <>
                    <Icon className="w-5 h-5 text-agrix-forest" />
                    {step?.label ?? activeStep}
                  </>
                );
              })()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {list.length === 0 ? (
              <div className="py-12 text-center text-dashboard-muted">
                <p className="font-medium mb-1">このステップの案件はありません</p>
                {activeStep === 'draft' && (
                  <Link href="/admin/campaigns/new">
                    <Button variant="outline" size="sm" className="mt-2 gap-2">
                      <PlusCircle className="w-4 h-4" />
                      案件を作成
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-dashboard-border">
                {list.map((c) => (
                  <li
                    key={c.id}
                    className="py-4 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-dashboard-text">
                        {c.campaign_title || c.location || '（無題）'}
                      </p>
                      <p className="text-sm text-dashboard-muted mt-0.5">
                        {c.final_date || c.start_date || c.end_date
                          ? new Date(c.final_date || c.start_date || c.end_date || '').toLocaleDateString('ja-JP')
                          : '日付未定'}
                        {' · '}
                        {c.location}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {activeStep === 'recruiting' && (c.status === 'open' || c.status === 'applied') && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-agrix-gold/50 text-agrix-gold-dark hover:bg-agrix-gold/20"
                          disabled={!!actingId}
                          onClick={() => handleCloseCampaign(c.id)}
                        >
                          {actingId === c.id ? '処理中...' : '募集締切'}
                        </Button>
                      )}
                      {activeStep === 'closed' && c.status === 'closed' && (
                        <Button
                          size="sm"
                          className="bg-agrix-forest hover:bg-agrix-forest-dark"
                          disabled={!!actingId}
                          onClick={() => handleConfirmCampaign(c.id)}
                        >
                          {actingId === c.id ? '処理中...' : '日付確定'}
                        </Button>
                      )}
                      <Link
                        href="/provider/calendar"
                        className="inline-flex items-center gap-1 text-sm font-bold text-agrix-forest hover:underline"
                      >
                        カレンダー <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm font-medium text-dashboard-muted hover:text-dashboard-text"
          >
            <CalendarRange className="w-4 h-4" />
            ダッシュボードへ
          </Link>
        </div>
      </div>
    </main>
  );
}
