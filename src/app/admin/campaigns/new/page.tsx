'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { createCampaign } from '@/lib/api';
import type { Polygon } from 'geojson';

// Dynamically import PolygonMap to avoid SSR issues
const PolygonMap = dynamic(() => import('@/components/PolygonMap'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full bg-slate-100 animate-pulse rounded-2xl flex items-center justify-center text-slate-400">
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
    const [polygon, setPolygon] = useState<Polygon | null>(null);
    const [coords, setCoords] = useState<{ lat: number; lng: number }[] | null>(null);
    const [area10r, setArea10r] = useState<number>(0);
    const [step, setStep] = useState<1 | 2>(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!polygon) {
            alert('対象エリアを地図で描画してください');
            return;
        }

        setIsSubmitting(true);

        try {
            const result = await createCampaign({
                ...formData,
                targetAreaPolygon: polygon,
            });

            if (result.success) {
                alert('案件を作成しました！');
                // Redirect to campaign list
                window.location.href = '/';
            } else {
                alert(`エラー: ${result.error}`);
            }
        } catch (error) {
            console.error('Campaign creation error:', error);
            alert('案件の作成に失敗しました');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-50 to-green-50/30">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
                                <span className="text-green-600 mr-2">🌾</span>新規案件作成
                            </h1>
                            <p className="text-slate-500 text-sm font-medium mt-1">業者用 - 募集案件を作成</p>
                        </div>
                        <button
                            onClick={() => window.history.back()}
                            className="text-slate-600 hover:text-slate-800 font-bold text-sm"
                        >
                            ← 戻る
                        </button>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
                {/* Wizard Steps */}
                <div className="flex items-center gap-2 mb-8 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                    <div className={`flex items-center gap-2 flex-1 ${step === 1 ? '' : 'opacity-100'}`}>
                        <span className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-black shrink-0 ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-500'}`}>
                            1
                        </span>
                        <span className={`text-sm font-bold ${step >= 1 ? 'text-slate-700' : 'text-slate-500'}`}>
                            エリア描画
                        </span>
                    </div>
                    <div className="w-6 h-0.5 bg-slate-300 shrink-0" aria-hidden="true"></div>
                    <div className={`flex items-center gap-2 flex-1 ${step === 2 ? '' : 'opacity-60'}`}>
                        <span className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-black shrink-0 ${step === 2 ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-500'}`}>
                            2
                        </span>
                        <span className={`text-sm font-bold ${step === 2 ? 'text-slate-700' : 'text-slate-500'}`}>
                            詳細入力
                        </span>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Step 1: Map */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
                            Step 1: 対象エリアを描画 <span className="text-red-600 text-xs font-bold px-2 py-0.5 rounded bg-red-50 border border-red-200 ml-1">必須</span>
                        </label>
                        <p className="text-xs text-slate-500 mb-4">
                            地図で案件の対象エリアを囲んでください。描画したエリアの地名が自動的に「表示用地区名」に反映されます。
                        </p>

                        <div className="w-full h-[500px] rounded-xl overflow-hidden border border-slate-200">
                            <PolygonMap
                                onPolygonComplete={handlePolygonComplete}
                                initialPolygon={coords || undefined}
                            />
                        </div>

                        {polygon && (
                            <div className="mt-3 p-3 bg-blue-50 rounded-xl border border-blue-200">
                                <div className="text-sm font-bold text-blue-700 mb-1">
                                    <i className="fas fa-check-circle mr-1"></i>エリアが登録されました
                                </div>
                                <div className="text-xs text-blue-600">
                                    面積: {area10r.toFixed(2)} 反
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Step 2: Form Fields */}
                    <div className={`space-y-6 transition-all duration-500 ${step === 2 ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <label className="block text-xs font-bold text-slate-600 uppercase mb-4">
                                Step 2: 詳細入力
                            </label>
                            <p className="text-sm text-slate-500 mb-6">
                                単位は 10R＝1反。面積は10R単位で入力してください。
                            </p>

                            {/* Location & Schedule */}
                            <div className="space-y-4 mb-6">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide pb-2 border-b border-slate-200">
                                    場所・スケジュール
                                </h4>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">
                                        表示用地区名 <span className="text-red-600 text-xs font-bold px-2 py-0.5 rounded bg-red-50 border border-red-200 ml-1">必須</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.location}
                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                        placeholder="例: 山内地区"
                                        className="w-full p-4 bg-slate-50 rounded-2xl border outline-none focus:ring-2 focus:ring-green-500"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">
                                            実施予定期間：開始日 <span className="text-red-600 text-xs font-bold px-2 py-0.5 rounded bg-red-50 border border-red-200 ml-1">必須</span>
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.startDate}
                                            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                            className="w-full p-4 bg-slate-50 rounded-2xl border outline-none focus:ring-2 focus:ring-green-500"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">
                                            実施予定期間：終了日 <span className="text-red-600 text-xs font-bold px-2 py-0.5 rounded bg-red-50 border border-red-200 ml-1">必須</span>
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.endDate}
                                            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                            className="w-full p-4 bg-slate-50 rounded-2xl border outline-none focus:ring-2 focus:ring-green-500"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Pricing */}
                            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 mb-6">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">
                                            開始単価（円/10R） <span className="text-red-600 text-xs font-bold px-2 py-0.5 rounded bg-red-50 border border-red-200 ml-1">必須</span>
                                        </label>
                                        <p className="text-xs text-slate-500 mb-2">
                                            申込が少ないときの単価。申込が増えるとこの価格から下がっていきます。
                                        </p>
                                        <div className="flex items-center bg-white rounded-2xl border focus-within:ring-2 focus-within:ring-green-500">
                                            <input
                                                type="number"
                                                value={formData.basePrice || ''}
                                                onChange={(e) => setFormData({ ...formData, basePrice: Number(e.target.value) })}
                                                placeholder="例: 20000"
                                                className="flex-1 p-4 text-sm font-bold outline-none rounded-l-2xl"
                                                required
                                            />
                                            <span className="px-3 text-sm text-slate-500 font-bold">¥/10R</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">
                                            目標単価（円/10R） <span className="text-red-600 text-xs font-bold px-2 py-0.5 rounded bg-red-50 border border-red-200 ml-1">必須</span>
                                        </label>
                                        <p className="text-xs text-slate-500 mb-2">
                                            目標面積に達したときの単価（一番安くなる価格）。
                                        </p>
                                        <div className="flex items-center bg-white rounded-2xl border focus-within:ring-2 focus-within:ring-green-500">
                                            <input
                                                type="number"
                                                value={formData.minPrice || ''}
                                                onChange={(e) => setFormData({ ...formData, minPrice: Number(e.target.value) })}
                                                placeholder="例: 15000"
                                                className="flex-1 p-4 text-sm font-bold outline-none rounded-l-2xl"
                                                required
                                            />
                                            <span className="px-3 text-sm text-slate-500 font-bold">¥/10R</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Area */}
                            <div className="p-3 bg-green-50 rounded-xl border border-green-200 mb-6">
                                <label className="block text-sm font-bold text-slate-700 mb-1">
                                    最低成立面積（10R） <span className="text-slate-500 text-xs font-bold px-2 py-0.5 rounded bg-slate-100 border border-slate-200 ml-1">任意</span>
                                </label>
                                <p className="text-xs text-slate-500 mb-2">
                                    この面積に達しないと成立しません。空欄の場合は従来どおり目標面積に達したら成立します。
                                </p>
                                <div className="flex items-center bg-white rounded-2xl border focus-within:ring-2 focus-within:ring-green-500 mb-4">
                                    <input
                                        type="number"
                                        value={formData.minTargetArea10r || ''}
                                        onChange={(e) => setFormData({ ...formData, minTargetArea10r: Number(e.target.value) })}
                                        placeholder="例: 30（空欄可）"
                                        className="flex-1 p-4 text-sm outline-none rounded-l-2xl"
                                        min="0"
                                    />
                                    <span className="px-3 text-sm text-slate-500 font-bold">10R</span>
                                </div>

                                <label className="block text-sm font-bold text-slate-700 mb-1">
                                    目標面積（10R） <span className="text-red-600 text-xs font-bold px-2 py-0.5 rounded bg-red-50 border border-red-200 ml-1">必須</span>
                                </label>
                                <p className="text-xs text-slate-500 mb-2">
                                    10R＝1反。この案件で集めたい総面積。申込が増えると単価が目標単価まで下がります。
                                </p>
                                <div className="flex items-center bg-white rounded-2xl border focus-within:ring-2 focus-within:ring-green-500">
                                    <input
                                        type="number"
                                        value={formData.targetArea10r || ''}
                                        onChange={(e) => setFormData({ ...formData, targetArea10r: Number(e.target.value) })}
                                        placeholder="例: 50"
                                        className="flex-1 p-4 text-sm outline-none rounded-l-2xl"
                                        required
                                    />
                                    <span className="px-3 text-sm text-slate-500 font-bold">10R</span>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={!polygon || isSubmitting}
                                className="w-full bg-green-600 text-white py-5 rounded-2xl font-black shadow-lg hover:bg-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                        </div>
                    </div>
                </form>
            </div>
        </main>
    );
}
