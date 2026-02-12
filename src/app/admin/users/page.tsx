'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  Loader2,
  UserCircle,
  Building2,
} from 'lucide-react';
import { getCurrentUser, type User } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface PendingUser {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  created_at?: string;
}

interface LinkedFarmer {
  farmer_id: string;
  name: string;
  email: string;
  created_at: string;
}

export default function AdminUsersPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [linkedFarmers, setLinkedFarmers] = useState<LinkedFarmer[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUser().then(setUser).finally(() => setLoading(false));
  }, []);

  const loadPending = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, role, status, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) {
      console.error(error);
      return;
    }
    setPendingUsers((data as PendingUser[]) || []);
  };

  const loadLinkedFarmers = async (providerId: string) => {
    const { data: links, error: linkError } = await supabase
      .from('farmer_providers')
      .select('farmer_id, created_at')
      .eq('provider_id', providerId)
      .eq('status', 'active');
    if (linkError || !links?.length) {
      setLinkedFarmers([]);
      return;
    }
    const farmerIds = links.map((l) => l.farmer_id);
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, name, email')
      .in('id', farmerIds);
    if (userError) {
      setLinkedFarmers([]);
      return;
    }
    const byId = new Map((users || []).map((u) => [u.id, u]));
    const list: LinkedFarmer[] = links.map((l) => {
      const u = byId.get(l.farmer_id);
      return {
        farmer_id: l.farmer_id,
        name: u?.name ?? '—',
        email: u?.email ?? '—',
        created_at: l.created_at,
      };
    });
    setLinkedFarmers(list);
  };

  useEffect(() => {
    if (!user) return;
    setRefreshing(true);
    if (user.role === 'admin') {
      loadPending().finally(() => setRefreshing(false));
    } else if (user.role === 'provider') {
      loadLinkedFarmers(user.id).finally(() => setRefreshing(false));
    } else {
      setRefreshing(false);
    }
  }, [user]);

  const updateUserStatus = async (userId: string, status: 'active' | 'rejected') => {
    setActingId(userId);
    const { error } = await supabase.from('users').update({ status }).eq('id', userId);
    setActingId(null);
    if (error) {
      toast.error(error.message || '更新に失敗しました');
      return;
    }
    toast.success(status === 'active' ? '承認しました' : '却下しました');
    loadPending();
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
          <p className="text-slate-600 font-medium">読み込み中...</p>
        </div>
      </main>
    );
  }

  if (!user || (user.role !== 'admin' && user.role !== 'provider')) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow border border-slate-200 text-center">
          <p className="text-slate-600">この画面を利用する権限がありません。</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2 mb-6">
          <Users className="w-7 h-7 text-green-600" />
          {user.role === 'admin' ? 'ユーザー承認管理' : '紐付き農家一覧'}
        </h1>

        {user.role === 'admin' && (
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-700 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-amber-600" />
                承認待ちユーザー（status: pending）
              </h2>
              {refreshing && <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />}
            </div>
            <div className="divide-y divide-slate-100">
              {pendingUsers.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-sm">
                  承認待ちのユーザーはいません。
                </div>
              ) : (
                pendingUsers.map((u) => (
                  <div
                    key={u.id}
                    className="p-4 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <UserCircle className="w-10 h-10 text-slate-300" />
                      <div>
                        <p className="font-bold text-slate-800">{u.name || '—'}</p>
                        <p className="text-sm text-slate-500">{u.email}</p>
                        <p className="text-xs text-slate-400">
                          {u.role} · {u.status}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateUserStatus(u.id, 'active')}
                        disabled={!!actingId}
                        className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-green-500 disabled:opacity-50"
                      >
                        {actingId === u.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <UserCheck className="w-4 h-4" />
                        )}
                        承認
                      </button>
                      <button
                        type="button"
                        onClick={() => updateUserStatus(u.id, 'rejected')}
                        disabled={!!actingId}
                        className="flex items-center gap-2 bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-300 disabled:opacity-50"
                      >
                        {actingId === u.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <UserX className="w-4 h-4" />
                        )}
                        却下
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {user.role === 'provider' && (
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-700 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-green-600" />
                自分に紐付いている農家
              </h2>
              {refreshing && <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase">
                  <tr>
                    <th className="p-4">名前</th>
                    <th className="p-4">メール</th>
                    <th className="p-4">紐付け日</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {linkedFarmers.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-slate-500">
                        紐付いている農家はいません。招待リンクで農家を追加できます。
                      </td>
                    </tr>
                  ) : (
                    linkedFarmers.map((f) => (
                      <tr key={f.farmer_id}>
                        <td className="p-4 font-medium">{f.name}</td>
                        <td className="p-4">{f.email}</td>
                        <td className="p-4 text-slate-500">
                          {f.created_at
                            ? new Date(f.created_at).toLocaleDateString('ja-JP')
                            : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
