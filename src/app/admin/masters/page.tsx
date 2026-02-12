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

  const currentTabMeta = TABS.find((t) => t.key === activeTab);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Package className="w-7 h-7 text-green-600" />
            マスタ管理
          </h1>
          {user.role === 'provider' && (
            <p className="text-sm text-slate-500">自社マスタ＋共通マスタを表示</p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex border-b border-slate-200 overflow-x-auto">
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
                    ? 'text-green-600 border-b-2 border-green-600 bg-green-50/50'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-4">
            {refreshing ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-slate-700 flex items-center gap-2">
                    {currentTabMeta?.icon}
                    {currentTabMeta?.label}一覧
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowAdd(true)}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-green-500 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    追加
                  </button>
                </div>

                {showAdd && (
                  <div className="flex gap-2 mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="名称を入力"
                      className="flex-1 px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                    <button
                      type="button"
                      onClick={handleAdd}
                      disabled={submitting}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-green-500 disabled:opacity-50 flex items-center gap-2"
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      登録
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAdd(false); setNewName(''); }}
                      className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-100"
                    >
                      キャンセル
                    </button>
                  </div>
                )}

                <ul className="divide-y divide-slate-100">
                  {items.length === 0 ? (
                    <li className="py-8 text-center text-slate-500 text-sm">
                      データがありません。追加ボタンで登録してください。
                    </li>
                  ) : (
                    items.map((m) => (
                      <li
                        key={m.id}
                        className={`flex items-center justify-between py-3 px-2 rounded-lg ${
                          m.status === 'inactive' ? 'bg-slate-50 text-slate-400' : ''
                        }`}
                      >
                        {editingId === m.id ? (
                          <div className="flex-1 flex gap-2">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-green-500"
                            />
                            <button
                              type="button"
                              onClick={handleSaveEdit}
                              disabled={submitting}
                              className="text-green-600 font-bold text-sm hover:underline disabled:opacity-50 flex items-center gap-1"
                            >
                              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                              保存
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="text-slate-500 text-sm hover:underline"
                            >
                              キャンセル
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="font-medium">{m.name}</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleStartEdit(m)}
                                className="p-2 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
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
                                  <Ban className="w-4 h-4 text-amber-600 hover:bg-amber-50" />
                                ) : (
                                  <CheckCircle className="w-4 h-4 text-green-600 hover:bg-green-50" />
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
          </div>
        </div>
      </div>
    </main>
  );
}
