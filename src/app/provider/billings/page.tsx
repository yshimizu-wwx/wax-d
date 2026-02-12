'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FileText, ChevronLeft, Printer } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

interface ProjectRow {
  id: string;
  campaign_title?: string | null;
  location?: string | null;
  final_date?: string | null;
  status?: string | null;
}

interface BookingRow {
  id: string;
  campaign_id: string;
  farmer_id: string | null;
  area_10r: number;
  actual_area_10r: number | null;
  work_status: string;
  final_amount: number | null;
  invoice_status: string | null;
}

interface FarmerRow {
  id: string;
  name: string | null;
}

interface BillingProject {
  project: ProjectRow;
  bookings: (BookingRow & { farmer?: FarmerRow })[];
  totalAmount: number;
}

export default function ProviderBillingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [data, setData] = useState<BillingProject[]>([]);
  const [loading, setLoading] = useState(true);

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
        .select('id, campaign_title, location, final_date, status')
        .eq('provider_id', u.id);
      if (!projects?.length) {
        setLoading(false);
        return;
      }

      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, campaign_id, farmer_id, area_10r, actual_area_10r, work_status, final_amount, invoice_status')
        .in('campaign_id', projects.map((p) => p.id))
        .eq('work_status', 'completed');
      const list = bookings || [];
      const farmerIds = [...new Set(list.map((b) => b.farmer_id).filter(Boolean))] as string[];
      let farmerMap = new Map<string, FarmerRow>();
      if (farmerIds.length > 0) {
        const { data: users } = await supabase.from('users').select('id, name').in('id', farmerIds);
        farmerMap = new Map((users || []).map((u) => [u.id, u]));
      }

      const byProject = new Map<string, BillingProject>();
      projects.forEach((p) => {
        byProject.set(p.id, { project: p, bookings: [], totalAmount: 0 });
      });
      list.forEach((b) => {
        const row = byProject.get(b.campaign_id);
        if (!row) return;
        const farmer = b.farmer_id ? farmerMap.get(b.farmer_id) : undefined;
        const amount = Number(b.final_amount) || 0;
        row.bookings.push({ ...b, farmer });
        row.totalAmount += amount;
      });

      setData(Array.from(byProject.values()).filter((r) => r.bookings.length > 0));
      setLoading(false);
    })();
  }, [router]);

  const handlePrint = () => {
    window.print();
  };

  if (loading || !user) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 print:bg-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between gap-4 mb-6 print:mb-4">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/campaigns"
              className="p-2 rounded-lg border border-slate-200 hover:bg-white flex items-center gap-2 text-slate-600 print:hidden"
            >
              <ChevronLeft className="w-5 h-5" />
              戻る
            </Link>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-7 h-7 text-green-600" />
              請求管理
            </h1>
          </div>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 print:hidden"
          >
            <Printer className="w-4 h-4" />
            印刷 / PDF
          </button>
        </div>

        {data.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-600">
            <p>作業完了済みの申込がありません。</p>
            <Link href="/admin/campaigns" className="mt-4 inline-block text-green-600 font-medium hover:underline">
              案件一覧へ
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {data.map(({ project, bookings: rows, totalAmount }) => (
              <section
                key={project.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:break-inside-avoid"
              >
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                  <h2 className="font-bold text-slate-800">
                    {project.campaign_title || project.location || project.id}
                  </h2>
                  <p className="text-sm text-slate-500">
                    確定日: {project.final_date || '-'} ・ 完了申込 {rows.length} 件
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/50">
                        <th className="text-left py-3 px-4 font-bold text-slate-700">農家</th>
                        <th className="text-right py-3 px-4 font-bold text-slate-700">実績面積（反）</th>
                        <th className="text-right py-3 px-4 font-bold text-slate-700">確定金額</th>
                        <th className="text-left py-3 px-4 font-bold text-slate-700">請求状況</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((b) => (
                        <tr key={b.id} className="border-b border-slate-100">
                          <td className="py-3 px-4 text-slate-800">{b.farmer?.name ?? '—'}</td>
                          <td className="py-3 px-4 text-right text-slate-700">
                            {(b.actual_area_10r ?? b.area_10r) ?? '-'}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-slate-800">
                            ¥{(Number(b.final_amount) || 0).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {b.invoice_status === 'sent' || b.invoice_status === 'processed' || b.invoice_status === 'invoiced'
                              ? '請求済'
                              : '未請求'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 font-bold">
                        <td className="py-3 px-4" colSpan={2}>
                          合計
                        </td>
                        <td className="py-3 px-4 text-right text-slate-800">
                          ¥{totalAmount.toLocaleString()}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
