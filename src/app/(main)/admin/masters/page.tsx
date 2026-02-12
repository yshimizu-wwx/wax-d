'use client';

import { useState, useEffect } from 'react';
import {
  Package,
  Layers,
  ListTree,
  Droplets,
  Plus,
  Pencil,
  Ban,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { getCurrentUser, type User } from '@/lib/auth';
import {
  fetchMasters,
  createMaster,
  updateMaster,
  setMasterInactive,
  setMasterActive,
} from '@/lib/masters';
import type { Master, MasterType } from '@/types/database';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';

const TABS: { key: MasterType; label: string; icon: React.ReactNode }[] = [
  { key: 'crop', label: '品目', icon: <Package className="w-4 h-4" /> },
  { key: 'task_category', label: '作業種別', icon: <Layers className="w-4 h-4" /> },
  { key: 'task_detail', label: '作業詳細', icon: <ListTree className="w-4 h-4" /> },
  { key: 'pesticide', label: '農薬', icon: <Droplets className="w-4 h-4" /> },
];

export default function MastersPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<MasterType>('crop');
  const [items, setItems] = useState<Master[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const providerId = user?.role === 'provider' ? user.id : user?.role === 'admin' ? null : null;

  const load = async () => {
    if (providerId === undefined) return;
    setRefreshing(true);
    const list = await fetchMasters(activeTab, providerId);
    setItems(list);
    setRefreshing(false);
  };

  useEffect(() => {
    getCurrentUser().then((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, activeTab]);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) {
      toast.error('名称を入力してください');
      return;
    }
    setSubmitting(true);
    const parentId = activeTab === 'task_detail' ? undefined : undefined;
    const res = await createMaster(activeTab, name, providerId ?? null, parentId);
    setSubmitting(false);
    if (res.success) {
      toast.success('追加しました');
      setNewName('');
      setShowAdd(false);
      load();
    } else {
      toast.error(res.error || '追加に失敗しました');
    }
  };

  const handleStartEdit = (m: Master) => {
    setEditingId(m.id);
    setEditName(m.name);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const name = editName.trim();
    if (!name) {
      toast.error('名称を入力してください');
      return;
    }
    setSubmitting(true);
    const res = await updateMaster(editingId, { name });
    setSubmitting(false);
    if (res.success) {
      toast.success('更新しました');
      setEditingId(null);
      load();
    } else {
      toast.error(res.error || '更新に失敗しました');
    }
  };

  const handleToggleStatus = async (m: Master) => {
    setSubmitting(true);
    const res =
      m.status === 'active'
        ? await setMasterInactive(m.id)
        : await setMasterActive(m.id);
    setSubmitting(false);
    if (res.success) {
      toast.success(m.status === 'active' ? '無効にしました' : '有効にしました');
      load();
    } else {
      toast.error(res.error || '操作に失敗しました');
    }
  };

  if (loading) {
    return (
      <main className="min-h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-agrix-forest animate-spin" />
          <p className="text-dashboard-text font-medium">読み込み中...</p>
        </div>
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

  const currentTabMeta = TABS.find((t) => t.key === activeTab);

  return (
    <main className="min-h-full">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-black text-dashboard-text flex items-center gap-2">
            <Package className="w-7 h-7 text-agrix-forest" />
            マスタ管理
          </h1>
          {user.role === 'provider' && (
            <p className="text-sm text-dashboard-muted">自社マスタ＋共通マスタを表示</p>
          )}
        </div>

        <Card className="overflow-hidden">
          <div className="flex border-b border-dashboard-border overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key);
                  setEditingId(null);
                  setShowAdd(false);
                }}
                className={`flex items-center gap-2 px-5 py-4 text-sm font-bold whitespace-nowrap transition-colors ${
                  activeTab === tab.key
                    ? 'text-agrix-forest border-b-2 border-agrix-forest bg-agrix-forest/10'
                    : 'text-dashboard-muted hover:bg-dashboard-bg'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <CardContent className="p-4">
            {refreshing ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-dashboard-muted animate-spin" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-dashboard-text flex items-center gap-2">
                    {currentTabMeta?.icon}
                    {currentTabMeta?.label}一覧
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowAdd(true)}
                    className="flex items-center gap-2 bg-agrix-forest text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-agrix-forest-light transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    追加
                  </button>
                </div>

                {showAdd && (
                  <div className="flex gap-2 mb-4 p-3 bg-dashboard-bg rounded-xl border border-dashboard-border">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="名称を入力"
                      className="flex-1 px-4 py-2 rounded-lg border border-dashboard-border focus:ring-2 focus:ring-agrix-forest"
                    />
                    <button
                      type="button"
                      onClick={handleAdd}
                      disabled={submitting}
                      className="bg-agrix-forest text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-agrix-forest-light disabled:opacity-50 flex items-center gap-2"
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      登録
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAdd(false); setNewName(''); }}
                      className="px-4 py-2 rounded-lg border border-dashboard-border text-dashboard-muted font-bold text-sm hover:bg-dashboard-bg"
                    >
                      キャンセル
                    </button>
                  </div>
                )}

                <ul className="divide-y divide-dashboard-border">
                  {items.length === 0 ? (
                    <li className="py-8 text-center text-dashboard-muted text-sm">
                      データがありません。追加ボタンで登録してください。
                    </li>
                  ) : (
                    items.map((m) => (
                      <li
                        key={m.id}
                        className={`flex items-center justify-between py-3 px-2 rounded-lg ${
                          m.status === 'inactive' ? 'bg-dashboard-bg text-dashboard-muted' : ''
                        }`}
                      >
                        {editingId === m.id ? (
                          <div className="flex-1 flex gap-2">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="flex-1 px-3 py-2 rounded-lg border border-dashboard-border focus:ring-2 focus:ring-agrix-forest"
                            />
                            <button
                              type="button"
                              onClick={handleSaveEdit}
                              disabled={submitting}
                              className="text-agrix-forest font-bold text-sm hover:underline disabled:opacity-50 flex items-center gap-1"
                            >
                              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                              保存
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="text-dashboard-muted text-sm hover:underline"
                            >
                              キャンセル
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="font-medium text-dashboard-text">{m.name}</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleStartEdit(m)}
                                className="p-2 text-dashboard-muted hover:text-agrix-forest hover:bg-agrix-forest/10 rounded-lg transition-colors"
                                title="編集"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(m)}
                                disabled={submitting}
                                className="p-2 rounded-lg transition-colors disabled:opacity-50"
                                title={m.status === 'active' ? '無効にする' : '有効にする'}
                              >
                                {m.status === 'active' ? (
                                  <Ban className="w-4 h-4 text-agrix-gold hover:bg-agrix-gold/20" />
                                ) : (
                                  <CheckCircle className="w-4 h-4 text-agrix-forest hover:bg-agrix-forest/10" />
                                )}
                              </button>
                            </div>
                          </>
                        )}
                      </li>
                    ))
                  )}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
