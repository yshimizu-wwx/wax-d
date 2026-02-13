'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Sprout, Plus, Pencil, Trash2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { getCurrentUser, type User } from '@/lib/auth';
import {
  fetchFieldsByFarmer,
  createField,
  updateField,
  deleteField,
  type FieldData,
} from '@/lib/api';
import type { Field } from '@/types/database';
import { getPolygonCenter } from '@/lib/geo/areaCalculator';
import { reverseGeocodeViaApi } from '@/lib/geo/geocodeClient';
import AppLoader from '@/components/AppLoader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

const PolygonMap = dynamic(() => import('@/components/PolygonMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full min-h-[280px] bg-dashboard-card animate-pulse rounded-lg flex items-center justify-center text-dashboard-muted text-sm">
      地図を読み込み中...
    </div>
  ),
});

export default function MyFieldsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [fields, setFields] = useState<Field[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formAreaSize, setFormAreaSize] = useState<string>('');
  const [formLat, setFormLat] = useState<number | null>(null);
  const [formLng, setFormLng] = useState<number | null>(null);
  const [addressFromMap, setAddressFromMap] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUser().then((u) => {
      setUser(u ?? null);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user || user.role !== 'farmer') return;
    fetchFieldsByFarmer(user.id).then(setFields);
  }, [user]);

  useEffect(() => {
    if (loading || !user) return;
    if (user.role !== 'farmer') {
      router.replace('/');
    }
  }, [user, loading, router]);

  const openAdd = () => {
    setEditingId(null);
    setFormName('');
    setFormAddress('');
    setFormAreaSize('');
    setFormLat(null);
    setFormLng(null);
    setAddressFromMap(false);
    setShowForm(true);
  };

  const openEdit = (f: Field) => {
    setEditingId(f.id);
    setFormName(f.name || '');
    setFormAddress(f.address || '');
    setFormAreaSize(f.area_size != null ? String(f.area_size) : '');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
  };

  const handlePolygonComplete = useCallback(
    async (coords: { lat: number; lng: number }[] | null, area10r: number, polygon: import('geojson').Polygon | null) => {
      if (polygon && area10r > 0) {
        // 面積は小数点第1位まで（Issue #16）
        const areaRounded = Math.round(area10r * 10) / 10;
        setFormAreaSize(String(areaRounded));
        const [lng, lat] = getPolygonCenter(polygon);
        setFormLat(lat);
        setFormLng(lng);
        // 逆ジオコードで住所・デフォルト名称をセット（Issue #16）。失敗時はメッセージ表示せず空のまま
        const rev = await reverseGeocodeViaApi(lat, lng);
        if (rev?.displayName) {
          setFormAddress(rev.displayName);
          setFormName(`${rev.displayName} 畑`);
          setAddressFromMap(true);
        }
      } else {
        setFormAreaSize('');
        setFormLat(null);
        setFormLng(null);
      }
    },
    []
  );

  const handleAddressSearchResult = useCallback((address: string | undefined, lat: number, lng: number) => {
    if (address) setFormAddress(address);
    setFormLat(lat);
    setFormLng(lng);
    setAddressFromMap(!!address);
  }, []);

  const handleFetchAddressFromMap = useCallback(async () => {
    if (formLat == null || formLng == null) return;
    const rev = await reverseGeocodeViaApi(formLat, formLng);
    if (rev?.displayName) {
      setFormAddress(rev.displayName);
      setAddressFromMap(true);
    }
  }, [formLat, formLng]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.role !== 'farmer') return;
    if (!editingId && !formName.trim()) {
      toast.error('畑の名前を入力してください');
      return;
    }
    setSubmitting(true);
    try {
      if (editingId) {
        const result = await updateField(editingId, {
          name: formName || undefined,
          address: formAddress || undefined,
          area_size: formAreaSize ? Number(formAreaSize) : undefined,
        });
        if (result.success) {
          toast.success('畑を更新しました');
          fetchFieldsByFarmer(user.id).then(setFields);
          closeForm();
        } else {
          toast.error(result.error);
        }
      } else {
        const data: FieldData = {
          farmer_id: user.id,
          name: formName.trim() || undefined,
          address: formAddress || undefined,
          area_size: formAreaSize ? Number(formAreaSize) : undefined,
          lat: formLat ?? undefined,
          lng: formLng ?? undefined,
        };
        const result = await createField(data);
        if (result.success) {
          toast.success('畑を登録しました');
          fetchFieldsByFarmer(user.id).then(setFields);
          closeForm();
        } else {
          toast.error(result.error);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (fieldId: string) => {
    const result = await deleteField(fieldId);
    if (result.success) {
      toast.success('畑を削除しました');
      setFields((prev) => prev.filter((f) => f.id !== fieldId));
      setDeleteConfirmId(null);
    } else {
      toast.error(result.error);
    }
  };

  if (loading) {
    return (
      <main className="min-h-full flex items-center justify-center">
        <AppLoader message="読み込み中..." />
      </main>
    );
  }

  if (!user || user.role !== 'farmer') {
    return (
      <main className="min-h-full flex items-center justify-center">
        <AppLoader message="リダイレクト中..." />
      </main>
    );
  }

  return (
    <main className="min-h-full">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <h1 className="text-xl font-bold text-dashboard-text mb-2 flex items-center gap-2">
          <Sprout className="w-6 h-6 text-agrix-forest" />
          マイ畑管理
        </h1>
        <p className="text-sm text-dashboard-muted mb-6">
          登録した畑は、作業依頼や案件申込時に選択できます。
        </p>

        <div className="mb-6">
          <Button onClick={openAdd} className="bg-agrix-forest hover:bg-agrix-forest-dark">
            <Plus className="w-4 h-4 mr-2" />
            畑を登録
          </Button>
        </div>

        <Card className="overflow-hidden">
          {fields.length === 0 ? (
            <CardContent className="p-10 flex flex-col items-center justify-center text-center">
              <div className="rounded-full bg-agrix-forest/10 p-6 mb-4">
                <Sprout className="w-12 h-12 text-agrix-forest" />
              </div>
              <p className="font-bold text-dashboard-text mb-1">登録された畑はありません</p>
              <p className="text-sm text-dashboard-muted mb-4">「畑を登録」から追加してください。</p>
              <Button onClick={openAdd} variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                畑を登録
              </Button>
            </CardContent>
          ) : (
            <ul className="divide-y divide-dashboard-border">
              {fields.map((f) => (
                <li key={f.id} className="p-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-dashboard-text">{f.name || '（名称未設定）'}</p>
                    <p className="text-sm text-dashboard-muted">
                      {f.address && `${f.address} · `}
                      {f.area_size != null && `${f.area_size} 反`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(f)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => setDeleteConfirmId(f.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Dialog open={showForm} onOpenChange={(open) => !open && closeForm()}>
          <DialogContent className={!editingId ? 'max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0' : ''}>
            <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
              <DialogTitle>{editingId ? '畑を編集' : '畑を登録'}</DialogTitle>
              <DialogDescription className="sr-only">
                {editingId ? '畑の情報を編集します。' : '地図で範囲を選択し、畑の名前と住所を入力して登録します。'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 flex overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto px-6 space-y-4">
                {!editingId && (
                  <div className="space-y-1 shrink-0">
                    <Label>地図で範囲を選択</Label>
                    <p className="text-xs text-dashboard-muted">地図上でポリゴン（多角形）を描くと面積が自動計算されます。</p>
                    <div className="w-full min-h-[280px] rounded-lg overflow-hidden border border-dashboard-border">
                      <PolygonMap
                        onPolygonComplete={handlePolygonComplete}
                        onAddressSearchResult={handleAddressSearchResult}
                        initialCenter={
                          user && user.lat != null && user.lng != null
                            ? [user.lat, user.lng]
                            : undefined
                        }
                        initialAddress={
                          user && (user.lat == null || user.lng == null) && user.address
                            ? user.address
                            : undefined
                        }
                        showAddressSearch
                      />
                    </div>
                  </div>
                )}
                <div>
                  <Label htmlFor="fieldName">畑の名前</Label>
                  <Input
                    id="fieldName"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="例: 北側水田"
                    className="mt-1 bg-white text-slate-900 border-slate-200 placeholder:text-slate-500 focus-visible:ring-agrix-forest"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <Label htmlFor="fieldAddress" className="shrink-0">住所・場所</Label>
                    {!editingId && formLat != null && formLng != null && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleFetchAddressFromMap}
                        className="shrink-0 text-agrix-forest hover:text-agrix-forest-dark hover:bg-agrix-forest/10 h-8 text-xs"
                      >
                        <MapPin className="w-3.5 h-3.5 mr-1" />
                        地図から取得
                      </Button>
                    )}
                  </div>
                  <Input
                    id="fieldAddress"
                    value={formAddress}
                    onChange={(e) => {
                      setFormAddress(e.target.value);
                      setAddressFromMap(false);
                    }}
                    placeholder="例: 〇〇県〇〇市..."
                    className={`mt-1 transition-all duration-200 bg-white text-slate-900 border-slate-200 placeholder:text-slate-500 focus-visible:ring-agrix-forest focus-visible:border-slate-300 ${addressFromMap ? 'ring-1 ring-agrix-forest/50 bg-agrix-forest/10 border-agrix-forest/30' : ''}`}
                  />
                  {addressFromMap && (
                    <p className="mt-1 text-xs text-agrix-forest">地図から取得済み。必要に応じて編集できます。</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="fieldArea">面積（反）</Label>
                  <Input
                    id="fieldArea"
                    type="number"
                    min="0"
                    step="0.1"
                    value={formAreaSize}
                    onChange={(e) => setFormAreaSize(e.target.value)}
                    placeholder={editingId ? '例: 5.5' : '地図で描画すると自動入力'}
                    className="mt-1 bg-white text-slate-900 border-slate-200 placeholder:text-slate-500 focus-visible:ring-agrix-forest"
                  />
                </div>
              </div>
              <DialogFooter className="shrink-0 px-6 py-4 border-t border-dashboard-border bg-dashboard-card/50">
                <Button type="button" variant="outline" onClick={closeForm}>
                  キャンセル
                </Button>
                <Button type="submit" disabled={submitting} className="bg-agrix-forest hover:bg-agrix-forest-dark">
                  {submitting ? '保存中...' : editingId ? '更新' : '登録'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>畑を削除しますか？</DialogTitle>
              <DialogDescription>この操作は取り消せません。</DialogDescription>
            </DialogHeader>
            <p className="text-sm text-dashboard-muted">この操作は取り消せません。</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
                キャンセル
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700"
                onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              >
                削除
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}
