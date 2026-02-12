'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import WorkCalendar from '@/components/WorkCalendar';

export default function ProviderCalendarPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u || u.role !== 'provider') {
        router.replace('/login');
        return;
      }
      setUser(u as { id: string });

      const { data: projData } = await supabase
        .from('projects')
        .select('id, start_date, end_date, final_date, campaign_title, location, status')
        .eq('provider_id', u.id);
      setProjects(projData || []);

      const ids = (projData || []).map((p) => p.id);
      if (ids.length > 0) {
        const { data: bookData } = await supabase
          .from('bookings')
          .select('id, campaign_id, confirmed_date, applied_at')
          .in('campaign_id', ids);
        setBookings(bookData || []);
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
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-8">
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/admin"
            className="p-2 rounded-lg border border-dashboard-border hover:bg-dashboard-card flex items-center gap-2 text-dashboard-muted"
          >
            <ChevronLeft className="w-5 h-5" />
            戻る
          </Link>
          <h1 className="text-xl md:text-2xl font-bold text-dashboard-text">作業カレンダー</h1>
        </div>
        <WorkCalendar providerId={user.id} projects={projects} bookings={bookings} height={600} />
      </div>
    </main>
  );
}
