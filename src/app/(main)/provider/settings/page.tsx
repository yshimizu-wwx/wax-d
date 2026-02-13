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
} from 'lucide-react';
import { getCurrentUser, type User } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ProviderSettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
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
