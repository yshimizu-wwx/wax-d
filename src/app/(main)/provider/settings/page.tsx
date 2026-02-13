'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Settings,
  Building2,
  Package,
  ChevronRight,
  Landmark,
  Link2,
  Copy,
} from 'lucide-react';
import { getCurrentUser, getInvitationCode, type User } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function ProviderSettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [invitationCode, setInvitationCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser().then((u) => {
      if (u && u.role !== 'provider') {
        router.replace('/login');
        return;
      }
      setUser(u ?? null);
      setLoading(false);
    });
  }, [router]);

  useEffect(() => {
    if (!user?.id) return;
    getInvitationCode(user.id).then((code) => setInvitationCode(code ?? null));
  }, [user?.id]);

  if (loading) {
    return (
      <main className="min-h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-agrix-forest" />
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="min-h-full">
      <div className="max-w-2xl mx-auto px-4 py-6 md:py-8">
        <h1 className="text-xl md:text-2xl font-bold text-dashboard-text flex items-center gap-2 mb-6">
          <Settings className="w-6 h-6 text-agrix-forest" />
          設定
        </h1>

        <div className="space-y-4">
          <Link href="/admin/users" className="block">
            <Card className="transition-all hover:shadow-md hover:border-agrix-forest/30">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-agrix-gold/20">
                    <Building2 className="w-6 h-6 text-agrix-gold" />
                  </div>
                  <div>
                    <CardTitle className="text-base">紐付き農家</CardTitle>
                    <CardDescription>自分に紐付いている農家の一覧・管理</CardDescription>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-dashboard-muted shrink-0" />
              </CardHeader>
            </Card>
          </Link>

          <Card className="transition-all">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Link2 className="w-5 h-5 text-agrix-forest" />
                <CardTitle className="text-base">農家招待</CardTitle>
              </div>
              <CardDescription>
                リンクまたは招待コードを農家に共有すると、貴社と紐付いて作業依頼を送れます（1農家あたり最大10業者まで）。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-medium text-dashboard-muted mb-1.5">招待コード</p>
                <p className="text-xs text-dashboard-muted mb-1">
                  農家はマイページの「業者と紐づける」でこのコードを入力して紐付けできます。
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="flex-1 min-w-0 text-sm md:text-base font-mono bg-dashboard-bg border border-dashboard-border rounded-lg px-3 py-2 break-all text-dashboard-text">
                    {invitationCode ?? '取得中...'}
                  </code>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="shrink-0"
                    disabled={!invitationCode}
                    onClick={() => {
                      if (invitationCode && navigator.clipboard?.writeText) {
                        navigator.clipboard.writeText(invitationCode);
                        toast.success('招待コードをコピーしました');
                      } else if (invitationCode) {
                        toast.error('コピーに失敗しました');
                      }
                    }}
                  >
                    <Copy className="w-4 h-4 mr-1" /> コピー
                  </Button>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-dashboard-muted mb-1.5">招待リンク（新規登録用）</p>
                <p className="text-xs text-dashboard-muted mb-1">
                  このリンクから新規登録すると、登録完了時に自動で貴社と紐付きます。
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="flex-1 min-w-0 text-xs md:text-sm bg-dashboard-bg border border-dashboard-border rounded-lg px-3 py-2 break-all text-dashboard-text">
                    {typeof window !== 'undefined' && user
                      ? `${window.location.origin}/login?signup=1&provider_id=${user.id}`
                      : user?.id ?? ''}
                  </code>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="shrink-0"
                    onClick={() => {
                      const url =
                        typeof window !== 'undefined' && user
                          ? `${window.location.origin}/login?signup=1&provider_id=${user.id}`
                          : '';
                      if (url && navigator.clipboard?.writeText) {
                        navigator.clipboard.writeText(url);
                        toast.success('リンクをコピーしました');
                      } else {
                        toast.error('コピーに失敗しました');
                      }
                    }}
                  >
                    <Copy className="w-4 h-4 mr-1" /> コピー
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Link href="/admin/masters" className="block">
            <Card className="transition-all hover:shadow-md hover:border-agrix-forest/30">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-dashboard-muted/20">
                    <Package className="w-6 h-6 text-agrix-slate" />
                  </div>
                  <div>
                    <CardTitle className="text-base">マスタ管理</CardTitle>
                    <CardDescription>品目・作業種別・作業内容・農薬などのマスタ</CardDescription>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-dashboard-muted shrink-0" />
              </CardHeader>
            </Card>
          </Link>

          <Card className="opacity-90">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-dashboard-muted/20">
                  <Landmark className="w-6 h-6 text-dashboard-muted" />
                </div>
                <div>
                  <CardTitle className="text-base">自社情報</CardTitle>
                  <CardDescription>
                    屋号・住所・インボイス番号など（準備中）
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-dashboard-muted">
                請求書発行に必要な自社情報の編集は、v0.2 で提供予定です。
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
