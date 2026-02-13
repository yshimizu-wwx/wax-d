'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Settings, Key, Link2 } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import AppLoader from '@/components/AppLoader';
import ProfileSettings from '@/components/ProfileSettings';
import PasswordChangeForm from '@/components/PasswordChangeForm';
import FarmerLinkProviderSection from '@/components/FarmerLinkProviderSection';

export default function MypagePage() {
  const [user, setUser] = useState<Awaited<ReturnType<typeof getCurrentUser>>>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    getCurrentUser().then((u) => {
      setUser(u ?? null);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <main className="min-h-full flex items-center justify-center">
        <AppLoader message="読み込み中..." />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-full flex items-center justify-center">
        <AppLoader message="リダイレクト中..." />
      </main>
    );
  }

  return (
    <main className="min-h-full">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <h1 className="text-xl font-bold dark:text-white text-zinc-900 mb-2 flex items-center gap-2">
          <User className="w-6 h-6 text-agrix-forest" />
          マイページ
        </h1>
        <p className="text-sm dark:text-zinc-400 text-zinc-500 mb-6">
          プロフィールと認証情報を管理できます。
        </p>

        <section className="mb-8">
          <h2 className="text-base font-bold dark:text-white text-zinc-900 mb-3 flex items-center gap-2">
            <Settings className="w-4 h-4 text-agrix-forest" />
            プロフィール
          </h2>
          <ProfileSettings />
        </section>

        {user.role === 'farmer' && (
          <section className="mb-8">
            <h2 className="text-base font-bold dark:text-white text-zinc-900 mb-3 flex items-center gap-2">
              <Link2 className="w-4 h-4 text-agrix-forest" />
              業者と紐づける
            </h2>
            <p className="text-sm dark:text-zinc-400 text-zinc-500 mb-3">
              作業を依頼したい業者から招待コードを受け取り、紐づけると「作業依頼」からその業者を依頼先として選べます。
            </p>
            <FarmerLinkProviderSection />
          </section>
        )}

        <section>
          <h2 className="text-base font-bold dark:text-white text-zinc-900 mb-3 flex items-center gap-2">
            <Key className="w-4 h-4 text-agrix-forest" />
            パスワード変更
          </h2>
          <PasswordChangeForm />
        </section>
      </div>
    </main>
  );
}
