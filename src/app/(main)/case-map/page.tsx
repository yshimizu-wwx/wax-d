'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { getCurrentUser } from '@/lib/auth';
import AppLoader from '@/components/AppLoader';

const CaseMapFinder = dynamic(() => import('@/components/CaseMapFinder'), {
  ssr: false,
  loading: () => (
    <main className="min-h-full flex items-center justify-center">
      <AppLoader message="読み込み中..." />
    </main>
  ),
});

export default function CaseMapPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser().then((user) => {
      if (!user) {
        router.replace('/login');
        return;
      }
      if (user.role !== 'farmer') {
        router.replace('/');
        return;
      }
      setLoading(false);
    });
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-full flex items-center justify-center">
        <AppLoader message="リダイレクト中..." />
      </main>
    );
  }

  return <CaseMapFinder />;
}
