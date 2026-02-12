'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { getCurrentUser, type User } from '@/lib/auth';
import { createCampaign } from '@/lib/api';
import { fetchMasters } from '@/lib/masters';
import type { Master } from '@/types/database';
import type { Polygon } from 'geojson';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

// Dynamically import PolygonMap to avoid SSR issues
const PolygonMap = dynamic(() => import('@/components/PolygonMap'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full bg-dashboard-card animate-pulse rounded-2xl flex items-center justify-center text-dashboard-muted">
            地図を読み込み中...
        </div>
    )
});

interface CampaignFormData {
    // Category
    cropId: string;
    categoryId: string;
    detailId: string;

    // Location & Schedule
    location: string;
    startDate: string;
    endDate: string;

    // Pesticide info
    pesticide: string;
    dilutionRate: string;
    amountPer10r: string;

    // Pricing
    basePrice: number;
    minPrice: number;

    // Area
    minTargetArea10r: number;
    targetArea10r: number;

    // Optional
    confirmationDeadlineDays: number;
}

export default function CampaignCreatePage() {
    const [user, setUser] = useState<User | null>(null);
    const [providerId, setProviderId] = useState<string | null>(null);
    const [polygon, setPolygon] = useState<Polygon | null>(null);
    const [coords, setCoords] = useState<{ lat: number; lng: number }[] | null>(null);
    const [area10r, setArea10r] = useState<number>(0);
    const [step, setStep] = useState<1 | 2>(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [crops, setCrops] = useState<Master[]>([]);
    const [taskCategories, setTaskCategories] = useState<Master[]>([]);
    const [taskDetails, setTaskDetails] = useState<Master[]>([]);
    const [mastersLoading, setMastersLoading] = useState(true);

    useEffect(() => {
        getCurrentUser().then((u) => {
            setUser(u);
            if (u?.role === 'provider' && u?.id) setProviderId(u.id);
        });
    }, []);

    const masterProviderId = user?.role === 'provider' ? user?.id ?? null : null;
    useEffect(() => {
        if (!user) return;
        let cancelled = false;
        setMastersLoading(true);
        Promise.all([
            fetchMasters('crop', masterProviderId),
            fetchMasters('task_category', masterProviderId),
            fetchMasters('task_detail', masterProviderId),
        ]).then(([c, tc, td]) => {
            if (!cancelled) {
                setCrops(c.filter((m) => m.status === 'active'));
                setTaskCategories(tc.filter((m) => m.status === 'active'));
                setTaskDetails(td);
                setMastersLoading(false);
            }
        });
        return () => { cancelled = true; };
    }, [user, masterProviderId]);

    const [formData, setFormData] = useState<CampaignFormData>({
        cropId: '',
        categoryId: '',
        detailId: '',
        location: '',
        startDate: '',
        endDate: '',
        pesticide: '',
        dilutionRate: '',
        amountPer10r: '',
        basePrice: 0,
        minPrice: 0,
        minTargetArea10r: 0,
        targetArea10r: 0,
        confirmationDeadlineDays: 0,
    });

    const handlePolygonComplete = (
        newCoords: { lat: number; lng: number }[] | null,
        newArea10r: number,
        newPolygon: Polygon | null
    ) => {
        setCoords(newCoords);
        setArea10r(newArea10r);
        setPolygon(newPolygon);

        // Enable step 2 when polygon is drawn
        if (newPolygon && step === 1) {
            setStep(2);
        }
    };

    const detailOptions = useMemo(() => {
        if (!formData.categoryId) return [];
        return taskDetails.filter(
            (d) => d.status === 'active' && d.parent_id === formData.categoryId
        );
    }, [formData.categoryId, taskDetails]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!polygon) {
            toast.error('対象エリアを地図で描画してください');
            return;
        }
        if (!formData.cropId?.trim()) {
            toast.error('品目を選択してください');
            return;
        }
        if (!formData.categoryId?.trim()) {
            toast.error('作業種別を選択してください');
            return;
        }
        if (!formData.detailId?.trim()) {
            toast.error('作業詳細を選択してください');
            return;
        }
        const targetArea = Number(formData.targetArea10r);
        if (!Number.isFinite(targetArea) || targetArea <= 0) {
            toast.error('目標面積には0より大きい数値を入力してください');
            return;
        }

        setIsSubmitting(true);

        try {
            const result = await createCampaign(
                {
                    ...formData,
                    targetAreaPolygon: polygon,
                },
                providerId || undefined
            );

            if (result.success) {
                toast.success('案件を作成しました');
                window.location.href = '/admin';
            } else {
                toast.error(result.error || '案件の作成に失敗しました');
            }
        } catch (error) {
            console.error('Campaign creation error:', error);
            toast.error('案件の作成に失敗しました');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="min-h-full">
            {/* Header */}
            <header className="bg-dashboard-card border-b border-dashboard-border sticky top-0 z-[1000] shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black text-dashboard-text tracking-tight">
                                <span className="text-agrix-forest mr-2">🌾</span>新規案件作成
                            </h1>
                            <p className="text-dashboard-muted text-sm font-medium mt-1">業者用 - 募集案件を作成</p>
                        </div>
                        <button
                            onClick={() => window.history.back()}
                            className="text-dashboard-muted hover:text-dashboard-text font-bold text-sm"
                        >
                            ← 戻る
                        </button>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
                {/* Wizard Steps */}
                <Card className="flex items-center gap-2 mb-8 p-4">
                    <div className={`flex items-center gap-2 flex-1 ${step === 1 ? '' : 'opacity-100'}`}>
                        <span className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-black shrink-0 ${step >= 1 ? 'bg-agrix-forest text-white' : 'bg-dashboard-border text-dashboard-muted'}`}>
                            1
                        </span>
                        <span className={`text-sm font-bold ${step >= 1 ? 'text-dashboard-text' : 'text-dashboard-muted'}`}>
                            エリア描画
                        </span>
                    </div>
                    <div className="w-6 h-0.5 bg-dashboard-border shrink-0" aria-hidden="true"></div>
                    <div className={`flex items-center gap-2 flex-1 ${step === 2 ? '' : 'opacity-60'}`}>
                        <span className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-black shrink-0 ${step === 2 ? 'bg-agrix-forest text-white' : 'bg-dashboard-border text-dashboard-muted'}`}>
                            2
                        </span>
                        <span className={`text-sm font-bold ${step === 2 ? 'text-dashboard-text' : 'text-dashboard-muted'}`}>
                            詳細入力
                        </span>
                    </div>
                </Card>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Step 1: Map */}
                    <Card>
                        <CardContent className="p-6">
                        <label className="block text-xs font-bold text-dashboard-text uppercase mb-2">
                            Step 1: 対象エリアを描画 <span className="text-destructive text-xs font-bold px-2 py-0.5 rounded bg-destructive/10 border border-destructive/30 ml-1">必須</span>
                        </label>
                        <p className="text-xs text-dashboard-muted mb-4">
                            地図で案件の対象エリアを囲んでください。描画したエリアの地名が自動的に「表示用地区名」に反映されます。
                        </p>

                        <div className="w-full h-[500px] rounded-xl overflow-hidden border border-dashboard-border">
                            <PolygonMap
                                onPolygonComplete={handlePolygonComplete}
                                initialPolygon={coords || undefined}
                            />
                        </div>

                        {polygon && (
                            <div className="mt-3 p-3 bg-agrix-forest/10 rounded-xl border border-agrix-forest/30">
                                <div className="text-sm font-bold text-agrix-forest mb-1">
                                    <i className="fas fa-check-circle mr-1"></i>エリアが登録されました
                                </div>
                                <div className="text-xs text-agrix-forest">
                                    面積: {area10r.toFixed(2)} 反
                                </div>
                            </div>
                        )}
                        </CardContent>
                    </Card>

                    {/* Step 2: Form Fields */}
                    <div className={`space-y-6 transition-all duration-500 ${step === 2 ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                        <Card>
                            <CardContent className="p-6">
                            <label className="block text-xs font-bold text-dashboard-text uppercase mb-4">
                                Step 2: 詳細入力
                            </label>
                            <p className="text-sm text-dashboard-muted mb-6">
                                面積の単位は 10R（10R＝1反）です。10R単位で入力し、小数点も利用できます。
                            </p>

                            {/* 基本情報: 品目・作業種別・作業詳細（最上部に配置） */}
                            <div className="space-y-4 mb-6">
                                <h4 className="text-xs font-bold text-dashboard-muted uppercase tracking-wide pb-2 border-b border-dashboard-border">
                                    基本情報（何をする案件か）
                                </h4>
                                {mastersLoading ? (
                                    <div className="flex items-center gap-2 py-4 text-dashboard-muted text-sm">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        マスタを読み込み中...
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-dashboard-text mb-1">
                                                品目 <span className="text-destructive text-xs font-bold px-2 py-0.5 rounded bg-destructive/10 border border-destructive/30 ml-1">必須</span>
                                            </label>
                                            <select
                                                value={formData.cropId}
                                                onChange={(e) => setFormData({ ...formData, cropId: e.target.value })}
                                                className="w-full p-4 bg-dashboard-bg rounded-2xl border border-dashboard-border outline-none focus:ring-2 focus:ring-agrix-forest text-dashboard-text"
                                                required
                                            >
                                                <option value="">選択してください</option>
                                                {crops.map((m) => (
                                                    <option key={m.id} value={m.id}>{m.name}</option>
                                                ))}
                                            </select>
                                            {crops.length === 0 && (
                                                <p className="text-xs text-destructive mt-1">品目が未登録です。マスタ画面で追加してください。</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-dashboard-text mb-1">
                                                作業種別 <span className="text-destructive text-xs font-bold px-2 py-0.5 rounded bg-destructive/10 border border-destructive/30 ml-1">必須</span>
                                            </label>
                                            <select
                                                value={formData.categoryId}
                                                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value, detailId: '' })}
                                                className="w-full p-4 bg-dashboard-bg rounded-2xl border border-dashboard-border outline-none focus:ring-2 focus:ring-agrix-forest text-dashboard-text"
                                                required
                                            >
                                                <option value="">選択してください</option>
                                                {taskCategories.map((m) => (
                                                    <option key={m.id} value={m.id}>{m.name}</option>
                                                ))}
                                            </select>
                                            {taskCategories.length === 0 && (
                                                <p className="text-xs text-destructive mt-1">作業種別が未登録です。マスタ画面で追加してください。</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-dashboard-text mb-1">
                                                作業詳細 <span className="text-destructive text-xs font-bold px-2 py-0.5 rounded bg-destructive/10 border border-destructive/30 ml-1">必須</span>
                                            </label>
                                            <select
                                                value={formData.detailId}
                                                onChange={(e) => setFormData({ ...formData, detailId: e.target.value })}
                                                className="w-full p-4 bg-dashboard-bg rounded-2xl border border-dashboard-border outline-none focus:ring-2 focus:ring-agrix-forest text-dashboard-text"
                                                required
                                                disabled={!formData.categoryId}
                                            >
                                                <option value="">{formData.categoryId ? '選択してください' : '先に作業種別を選択'}</option>
                                                {detailOptions.map((m) => (
                                                    <option key={m.id} value={m.id}>{m.name}</option>
                                                ))}
                                            </select>
                                            {formData.categoryId && detailOptions.length === 0 && (
                                                <p className="text-xs text-destructive mt-1">この作業種別に紐づく作業詳細がありません。マスタ画面で追加してください。</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 場所・スケジュール */}
                            <div className="space-y-4 mb-6">
                                <h4 className="text-xs font-bold text-dashboard-muted uppercase tracking-wide pb-2 border-b border-dashboard-border">
                                    場所・スケジュール
                                </h4>

                                <div>
                                    <label className="block text-sm font-bold text-dashboard-text mb-1">
                                        表示用地区名 <span className="text-destructive text-xs font-bold px-2 py-0.5 rounded bg-destructive/10 border border-destructive/30 ml-1">必須</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.location}
                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                        placeholder="例: 山内地区"
                                        className="w-full p-4 bg-dashboard-bg rounded-2xl border border-dashboard-border outline-none focus:ring-2 focus:ring-agrix-forest"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-bold text-dashboard-text mb-1">
                                            実施予定期間：開始日 <span className="text-destructive text-xs font-bold px-2 py-0.5 rounded bg-destructive/10 border border-destructive/30 ml-1">必須</span>
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.startDate}
                                            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                            className="w-full p-4 bg-dashboard-bg rounded-2xl border border-dashboard-border outline-none focus:ring-2 focus:ring-agrix-forest"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-dashboard-text mb-1">
                                            実施予定期間：終了日 <span className="text-destructive text-xs font-bold px-2 py-0.5 rounded bg-destructive/10 border border-destructive/30 ml-1">必須</span>
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.endDate}
                                            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                            className="w-full p-4 bg-dashboard-bg rounded-2xl border border-dashboard-border outline-none focus:ring-2 focus:ring-agrix-forest"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Pricing */}
                            <div className="p-3 bg-agrix-gold/10 rounded-xl border border-agrix-gold/30 mb-6">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-bold text-dashboard-text mb-1">
                                            開始単価（円/10R） <span className="text-destructive text-xs font-bold px-2 py-0.5 rounded bg-destructive/10 border border-destructive/30 ml-1">必須</span>
                                        </label>
                                        <p className="text-xs text-dashboard-muted mb-2">
                                            申込が少ないときの単価。申込が増えるとこの価格から下がっていきます。
                                        </p>
                                        <div className="flex items-center bg-dashboard-card rounded-2xl border border-dashboard-border focus-within:ring-2 focus-within:ring-agrix-forest">
                                            <input
                                                type="number"
                                                value={formData.basePrice || ''}
                                                onChange={(e) => setFormData({ ...formData, basePrice: Number(e.target.value) })}
                                                placeholder="例: 20000"
                                                className="flex-1 p-4 text-sm font-bold outline-none rounded-l-2xl"
                                                required
                                            />
                                            <span className="px-3 text-sm text-dashboard-muted font-bold">¥/10R</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-dashboard-text mb-1">
                                            目標単価（円/10R） <span className="text-destructive text-xs font-bold px-2 py-0.5 rounded bg-destructive/10 border border-destructive/30 ml-1">必須</span>
                                        </label>
                                        <p className="text-xs text-dashboard-muted mb-2">
                                            目標面積に達したときの単価（一番安くなる価格）。
                                        </p>
                                        <div className="flex items-center bg-dashboard-card rounded-2xl border border-dashboard-border focus-within:ring-2 focus-within:ring-agrix-forest">
                                            <input
                                                type="number"
                                                value={formData.minPrice || ''}
                                                onChange={(e) => setFormData({ ...formData, minPrice: Number(e.target.value) })}
                                                placeholder="例: 15000"
                                                className="flex-1 p-4 text-sm font-bold outline-none rounded-l-2xl"
                                                required
                                            />
                                            <span className="px-3 text-sm text-dashboard-muted font-bold">¥/10R</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Area（単位: 10R＝1反で統一、小数点入力可） */}
                            <div className="p-3 bg-agrix-forest/10 rounded-xl border border-agrix-forest/30 mb-6">
                                <label className="block text-sm font-bold text-dashboard-text mb-1">
                                    最低成立面積 <span className="text-dashboard-muted text-xs font-bold px-2 py-0.5 rounded bg-dashboard-bg border border-dashboard-border ml-1">任意</span>
                                </label>
                                <p className="text-xs text-dashboard-muted mb-2">
                                    この面積に達しないと成立しません。空欄の場合は従来どおり目標面積に達したら成立します。単位は10R（10R＝1反）。
                                </p>
                                <div className="flex items-center bg-dashboard-card rounded-2xl border border-dashboard-border focus-within:ring-2 focus-within:ring-agrix-forest mb-4">
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        value={formData.minTargetArea10r || ''}
                                        onChange={(e) => setFormData({ ...formData, minTargetArea10r: Number(e.target.value) || 0 })}
                                        placeholder="例: 30（空欄可）"
                                        className="flex-1 p-4 text-sm outline-none rounded-l-2xl"
                                    />
                                    <span className="px-3 text-sm text-dashboard-muted font-bold">10R</span>
                                </div>

                                <label className="block text-sm font-bold text-dashboard-text mb-1">
                                    目標面積 <span className="text-destructive text-xs font-bold px-2 py-0.5 rounded bg-destructive/10 border border-destructive/30 ml-1">必須</span>
                                </label>
                                <p className="text-xs text-dashboard-muted mb-2">
                                    この案件で集めたい総面積（10R単位）。申込が増えると単価が目標単価まで下がります。
                                </p>
                                <div className="flex items-center bg-dashboard-card rounded-2xl border border-dashboard-border focus-within:ring-2 focus-within:ring-agrix-forest">
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0.1"
                                        value={formData.targetArea10r || ''}
                                        onChange={(e) => setFormData({ ...formData, targetArea10r: Number(e.target.value) })}
                                        placeholder="例: 50"
                                        className="flex-1 p-4 text-sm outline-none rounded-l-2xl"
                                        required
                                    />
                                    <span className="px-3 text-sm text-dashboard-muted font-bold">10R</span>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={!polygon || isSubmitting || mastersLoading || !formData.cropId || !formData.categoryId || !formData.detailId}
                                className="w-full bg-agrix-forest text-white py-5 rounded-2xl font-black shadow-lg hover:bg-agrix-forest-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? (
                                    <>
                                        <i className="fas fa-spinner fa-spin mr-2"></i>作成中...
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-paper-plane mr-2"></i>案件を公開する
                                    </>
                                )}
                            </button>
                            </CardContent>
                        </Card>
                    </div>
                </form>
            </div>
        </main>
    );
}
