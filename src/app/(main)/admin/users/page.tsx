'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  Loader2,
  Building2,
} from 'lucide-react';
import { getCurrentUser, type User } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import AppLoader from '@/components/AppLoader';
import { Card, CardContent } from '@/components/ui/card';

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

  const pendingColumns = useMemo<ColumnDef<PendingUser>[]>(
    () => [
      { id: 'name', header: '名前', accessorFn: (r) => r.name ?? '—', enableSorting: true },
      { id: 'email', header: 'メール', accessorFn: (r) => r.email, enableSorting: true },
      { id: 'role', header: 'ロール', accessorFn: (r) => r.role, enableSorting: true },
      { id: 'status', header: 'ステータス', accessorFn: (r) => r.status },
      {
        id: 'created_at',
        header: '登録日',
        accessorFn: (r) => r.created_at ? new Date(r.created_at).toLocaleDateString('ja-JP') : '—',
        enableSorting: true,
      },
      {
        id: 'actions',
        header: '操作',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              disabled={!!actingId}
              onClick={() => updateUserStatus(row.original.id, 'active')}
            >
              {actingId === row.original.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
              承認
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!!actingId}
              onClick={() => updateUserStatus(row.original.id, 'rejected')}
            >
              {actingId === row.original.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4" />}
              却下
            </Button>
          </div>
        ),
      },
    ],
    [actingId]
  );

  const linkedColumns = useMemo<ColumnDef<LinkedFarmer>[]>(
    () => [
      { id: 'name', header: '名前', accessorFn: (r) => r.name, enableSorting: true },
      { id: 'email', header: 'メール', accessorFn: (r) => r.email, enableSorting: true },
      {
        id: 'created_at',
        header: '紐付け日',
        accessorFn: (r) => (r.created_at ? new Date(r.created_at).toLocaleDateString('ja-JP') : '—'),
        enableSorting: true,
      },
    ],
    []
  );

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
      <main className="min-h-full">
        <AppLoader message="読み込み中..." />
      </main>
    );
  }

  if (!user || (user.role !== 'admin' && user.role !== 'provider')) {
    return (
      <main className="min-h-full flex items-center justify-center p-4">
        <Card>
          <CardContent className="p-8 text-center text-dashboard-muted">
            この画面を利用する権限がありません。
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-full">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-black text-dashboard-text flex items-center gap-2 mb-6">
          <Users className="w-7 h-7 text-agrix-forest" />
          {user.role === 'admin' ? 'ユーザー承認管理' : '紐付き農家一覧'}
        </h1>

        {user.role === 'admin' && (
          <Card className="overflow-hidden">
            <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-dashboard-text flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-agrix-gold" />
                承認待ちユーザー（status: pending）
              </h2>
              {refreshing && <Loader2 className="w-5 h-5 text-dashboard-muted animate-spin" />}
            </div>
            <DataTable
              columns={pendingColumns}
              data={pendingUsers}
              filterColumnId="email"
              filterPlaceholder="メールで検索..."
            />
            </CardContent>
          </Card>
        )}

        {user.role === 'provider' && (
          <Card className="overflow-hidden">
            <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-dashboard-text flex items-center gap-2">
                <Building2 className="w-5 h-5 text-agrix-forest" />
                自分に紐付いている農家
              </h2>
              {refreshing && <Loader2 className="w-5 h-5 text-dashboard-muted animate-spin" />}
            </div>
            <DataTable
              columns={linkedColumns}
              data={linkedFarmers}
              filterColumnId="name"
              filterPlaceholder="名前で検索..."
            />
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
