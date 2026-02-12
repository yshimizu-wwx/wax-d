'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Camera, MapPin, FileCheck, ChevronLeft } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

interface Project {
  id: string;
  campaign_title?: string;
  location: string;
  final_unit_price?: number;
  base_price?: number;
}

interface Booking {
  id: string;
  campaign_id: string;
  farmer_id: string | null;
  area_10r: number;
  work_status: string;
  projects?: Project;
}

export default function ProviderReportsNewPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [bookingId, setBookingId] = useState('');
  const [actualArea10r, setActualArea10r] = useState<number>(0);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u || u.role !== 'provider') {
        router.replace('/login');
        return;
      }
      setUser(u as { id: string });

      const { data: projects } = await supabase
        .from('projects')
        .select('id')
        .eq('provider_id', u.id);
      const projectIds = (projects || []).map((p) => p.id);
      if (projectIds.length === 0) {
        setLoading(false);
        return;
      }

      const { data: pendingBookings, error: e } = await supabase
        .from('bookings')
        .select('id, campaign_id, farmer_id, area_10r, work_status')
        .in('campaign_id', projectIds)
        .eq('work_status', 'pending')
        .neq('status', 'canceled');

      if (e) {
        setError('申込一覧の取得に失敗しました');
        setLoading(false);
        return;
      }
      const list = (pendingBookings || []) as Booking[];
      if (list.length > 0) {
        const { data: projs } = await supabase.from('projects').select('id, campaign_title, location, final_unit_price, base_price').in('id', [...new Set(list.map((b) => b.campaign_id))]);
        const projMap = new Map((projs || []).map((p) => [p.id, p]));
        list.forEach((b) => {
          (b as Booking & { projects?: Project }).projects = projMap.get(b.campaign_id);
        });
      }
      setBookings(list);
      if (list.length > 0 && !bookingId) {
        setBookingId(list[0].id);
        setActualArea10r(Number(list[0].area_10r) || 0);
      }
      setLoading(false);
    })();
  }, [router]);

  const captureGps = () => {
    if (!navigator.geolocation) {
      setError('お使いの環境ではGPSを利用できません');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setError('位置情報の取得に失敗しました')
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!bookingId || actualArea10r <= 0) {
      setError('申込を選択し、実績面積を入力してください');
      return;
    }
    setSubmitting(true);
    try {
      let imageBase64: string | undefined;
      let mimeType: string | undefined;
      if (photoFile) {
        mimeType = photoFile.type || 'image/jpeg';
        imageBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.indexOf(',') >= 0 ? dataUrl.split(',')[1] : dataUrl;
            resolve(base64 || '');
          };
          reader.onerror = reject;
          reader.readAsDataURL(photoFile);
        });
      }
      const res = await fetch('/api/provider/reports/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          actualArea10r: Number(actualArea10r),
          imageBase64,
          mimeType,
          gps: gps ?? undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message || '登録に失敗しました');
        return;
      }
      setSuccess(`実績を報告しました。確定金額: ¥${(json.finalAmount ?? 0).toLocaleString()}`);
      setBookings((prev) => prev.filter((b) => b.id !== bookingId));
      setBookingId('');
      setActualArea10r(0);
      setPhotoFile(null);
      setGps(null);
    } catch (err) {
      setError('送信に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/admin/campaigns"
            className="p-2 rounded-lg border border-slate-200 hover:bg-white flex items-center gap-2 text-slate-600"
          >
            <ChevronLeft className="w-5 h-5" />
            戻る
          </Link>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FileCheck className="w-7 h-7 text-green-600" />
            実績報告
          </h1>
        </div>

        {bookings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-600">
            <p>報告可能な申込（作業未完了）がありません。</p>
            <Link href="/admin/campaigns" className="mt-4 inline-block text-green-600 font-medium hover:underline">
              案件一覧へ
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium">
                  {error}
                </div>
              )}
              {success && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-medium">
                  {success}
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">対象申込</label>
                <select
                  value={bookingId}
                  onChange={(e) => {
                    setBookingId(e.target.value);
                    const b = bookings.find((x) => x.id === e.target.value);
                    if (b) setActualArea10r(Number(b.area_10r) || 0);
                  }}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500"
                  required
                >
                  <option value="">選択してください</option>
                  {bookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {(b as Booking & { projects?: Project }).projects?.location ?? b.campaign_id} — 申込ID: {b.id}（{b.area_10r} 反）
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">実績面積（反）</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={actualArea10r || ''}
                  onChange={(e) => setActualArea10r(Number(e.target.value) || 0)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  証跡写真（任意）
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-green-50 file:text-green-700"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  GPS（任意）
                </label>
                <button
                  type="button"
                  onClick={captureGps}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-slate-700"
                >
                  現在地を取得
                </button>
                {gps && (
                  <p className="mt-2 text-xs text-slate-500">
                    {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)}
                  </p>
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? '送信中...' : '実績を報告する'}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
