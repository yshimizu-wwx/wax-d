'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Project } from '@/types/database';
import { calculateCurrentUnitPrice, calculateFinalAmount, calculateTax } from '@/lib/calculator/priceCalculator';
import type { CampaignPricing } from '@/lib/calculator/types';
import { ArrowRight, ArrowLeft, Check } from 'lucide-react';

interface CampaignFormProps {
    project: Project;
    area10r: number;
    totalCampaignArea: number;
    onSubmit: (formData: FarmerFormData) => Promise<void>;
}

export interface FarmerFormData {
    farmerName: string;
    phone: string;
    email: string;
    desiredStartDate: string;
    desiredEndDate: string;
}

const WIZARD_STEPS = 3;

export default function CampaignForm({ project, area10r, totalCampaignArea, onSubmit }: CampaignFormProps) {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [formData, setFormData] = useState<FarmerFormData>({
        farmerName: '',
        phone: '',
        email: '',
        desiredStartDate: '',
        desiredEndDate: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<Partial<Record<keyof FarmerFormData, string>>>({});

    // Build pricing object from project
    const pricing: CampaignPricing = {
        base_price: project.base_price || 0,
        min_price: project.min_price || 0,
        target_area_10r: project.target_area_10r || 0,
        min_target_area_10r: project.min_target_area_10r ?? undefined,
        max_target_area_10r: project.max_target_area_10r ?? undefined,
        execution_price: project.execution_price ?? undefined,
    };

    // Calculate pricing in real-time using TOTAL campaign area (existing + new)
    const simulatedTotalArea = totalCampaignArea + area10r;
    const validation = calculateCurrentUnitPrice(pricing, simulatedTotalArea);
    const currentPrice = validation.currentPrice ?? project.base_price ?? 0;
    const finalAmountExTax = calculateFinalAmount(currentPrice, area10r);
    const tax = calculateTax(finalAmountExTax);

    const handleChange = (field: keyof FarmerFormData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        // Clear error when user starts typing
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: undefined }));
        }
    };

    const validateStep1 = (): boolean => {
        const newErrors: Partial<Record<keyof FarmerFormData, string>> = {};
        if (!formData.farmerName.trim()) newErrors.farmerName = 'お名前を入力しましょう';
        if (!formData.phone.trim()) newErrors.phone = '電話番号を入力しましょう';
        else if (!/^[\d-]+$/.test(formData.phone)) newErrors.phone = '有効な電話番号を入力してください';
        if (!formData.email.trim()) newErrors.email = 'メールアドレスを入力しましょう';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = '有効なメールアドレスを入力してください';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const validateStep2 = (): boolean => {
        const newErrors: Partial<Record<keyof FarmerFormData, string>> = {};
        if (!formData.desiredStartDate) newErrors.desiredStartDate = '開始日を選びましょう';
        if (!formData.desiredEndDate) newErrors.desiredEndDate = '終了日を選びましょう';
        if (formData.desiredStartDate && formData.desiredEndDate && formData.desiredStartDate > formData.desiredEndDate) {
            newErrors.desiredEndDate = '終了日は開始日以降にしてください';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const validateForm = (): boolean => {
        return validateStep1() && validateStep2();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (step !== 3) return;
        if (!validateStep1()) {
            setStep(1);
            return;
        }
        if (!validateStep2()) {
            setStep(2);
            return;
        }
        if (area10r <= 0) {
            toast.error('地図上で圃場を描画してください');
            return;
        }
        setIsSubmitting(true);
        try {
            await onSubmit(formData);
        } catch (error) {
            console.error('Submission error:', error);
            toast.error('予約の送信に失敗しました。もう一度お試しください。');
        } finally {
            setIsSubmitting(false);
        }
    };

    const stepContent = (
        step === 1 ? '農家情報' : step === 2 ? '希望作業日' : '確認'
    );

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* プログレスバー */}
            <div className="space-y-2">
                <p className="text-sm font-medium text-slate-500">Step {step}/{WIZARD_STEPS}</p>
                <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                        className="h-full rounded-full bg-green-500 transition-all duration-300 ease-out"
                        style={{ width: `${(step / WIZARD_STEPS) * 100}%` }}
                    />
                </div>
            </div>

            {/* Campaign Info（常に表示） */}
            <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-2xl border border-green-200">
                <h2 className="text-xl font-bold text-slate-800 mb-2 flex items-center">
                    <span className="w-1 h-6 bg-green-500 rounded-full mr-3 block" />
                    {project.campaign_title || project.title || '案件情報'}
                </h2>
                <div className="grid grid-cols-2 gap-3 text-sm mt-4">
                    <div>
                        <div className="text-slate-500 mb-1">場所</div>
                        <div className="font-bold text-slate-800">{project.location}</div>
                    </div>
                    <div>
                        <div className="text-slate-500 mb-1">作業期間</div>
                        <div className="font-bold text-slate-800">
                            {project.start_date && project.end_date
                                ? `${project.start_date} 〜 ${project.end_date}`
                                : '未定'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Step 1: 農家情報 */}
            <div
                className={`overflow-hidden transition-all duration-300 ease-out ${
                    step === 1 ? 'opacity-100 max-h-[9999px]' : 'opacity-0 max-h-0 pointer-events-none'
                }`}
            >
                <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide pb-2 border-b border-slate-200">
                        {stepContent}
                    </h3>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">農家名 <span className="text-red-600 text-xs ml-1">必須</span></label>
                        <input
                            type="text"
                            value={formData.farmerName}
                            onChange={(e) => handleChange('farmerName', e.target.value)}
                            placeholder="農園名やお名前を教えてください"
                            className={`w-full p-4 bg-slate-50 rounded-xl border outline-none focus:ring-2 focus:ring-green-500 ${errors.farmerName ? 'border-red-500' : 'border-slate-200'}`}
                        />
                        {errors.farmerName && <p className="text-red-600 text-xs mt-1">{errors.farmerName}</p>}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">電話番号 <span className="text-red-600 text-xs ml-1">必須</span></label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => handleChange('phone', e.target.value)}
                                placeholder="連絡のつく番号を入力しましょう"
                                className={`w-full p-4 bg-slate-50 rounded-xl border outline-none focus:ring-2 focus:ring-green-500 ${errors.phone ? 'border-red-500' : 'border-slate-200'}`}
                            />
                            <p className="text-xs text-slate-500 mt-1">作業のご連絡に使います</p>
                            {errors.phone && <p className="text-red-600 text-xs mt-1">{errors.phone}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">メールアドレス <span className="text-red-600 text-xs ml-1">必須</span></label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => handleChange('email', e.target.value)}
                                placeholder="ログインに使うメールアドレスは？"
                                className={`w-full p-4 bg-slate-50 rounded-xl border outline-none focus:ring-2 focus:ring-green-500 ${errors.email ? 'border-red-500' : 'border-slate-200'}`}
                            />
                            {errors.email && <p className="text-red-600 text-xs mt-1">{errors.email}</p>}
                        </div>
                    </div>
                    <div className="flex justify-end pt-2">
                        <button
                            type="button"
                            onClick={() => validateStep1() && setStep(2)}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-500 text-white font-bold hover:bg-green-600 transition-all duration-200 hover:shadow-lg"
                        >
                            次へ進む <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Step 2: 希望作業日 */}
            <div
                className={`overflow-hidden transition-all duration-300 ease-out ${
                    step === 2 ? 'opacity-100 max-h-[9999px]' : 'opacity-0 max-h-0 pointer-events-none'
                }`}
            >
                <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide">{stepContent}</h3>
                        <button type="button" onClick={() => setStep(1)} className="text-sm text-slate-500 hover:text-slate-700 inline-flex items-center gap-1">
                            <ArrowLeft className="w-4 h-4" /> 戻る
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">開始日 <span className="text-red-600 text-xs ml-1">必須</span></label>
                            <input
                                type="date"
                                value={formData.desiredStartDate}
                                onChange={(e) => handleChange('desiredStartDate', e.target.value)}
                                className={`w-full p-4 bg-slate-50 rounded-xl border outline-none focus:ring-2 focus:ring-green-500 ${errors.desiredStartDate ? 'border-red-500' : 'border-slate-200'}`}
                            />
                            {errors.desiredStartDate && <p className="text-red-600 text-xs mt-1">{errors.desiredStartDate}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">終了日 <span className="text-red-600 text-xs ml-1">必須</span></label>
                            <input
                                type="date"
                                value={formData.desiredEndDate}
                                onChange={(e) => handleChange('desiredEndDate', e.target.value)}
                                className={`w-full p-4 bg-slate-50 rounded-xl border outline-none focus:ring-2 focus:ring-green-500 ${errors.desiredEndDate ? 'border-red-500' : 'border-slate-200'}`}
                            />
                            <p className="text-xs text-slate-500 mt-1">案件の期間内で選んでください</p>
                            {errors.desiredEndDate && <p className="text-red-600 text-xs mt-1">{errors.desiredEndDate}</p>}
                        </div>
                    </div>
                    <div className="flex justify-end pt-2">
                        <button
                            type="button"
                            onClick={() => validateStep2() && setStep(3)}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-500 text-white font-bold hover:bg-green-600 transition-all duration-200 hover:shadow-lg"
                        >
                            次へ進む <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Step 3: 確認・送信 */}
            <div
                className={`overflow-hidden transition-all duration-300 ease-out ${
                    step === 3 ? 'opacity-100 max-h-[9999px]' : 'opacity-0 max-h-0 pointer-events-none'
                }`}
            >
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide">{stepContent}</h3>
                        <button type="button" onClick={() => setStep(2)} className="text-sm text-slate-500 hover:text-slate-700 inline-flex items-center gap-1">
                            <ArrowLeft className="w-4 h-4" /> 戻る
                        </button>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-sm">
                        <p><span className="text-slate-500">お名前</span> {formData.farmerName}</p>
                        <p><span className="text-slate-500">電話</span> {formData.phone}</p>
                        <p><span className="text-slate-500">メール</span> {formData.email}</p>
                        <p><span className="text-slate-500">希望期間</span> {formData.desiredStartDate} 〜 {formData.desiredEndDate}</p>
                    </div>

                    <div className="bg-green-50 p-6 rounded-2xl border border-green-200">
                        <div className="text-center">
                            <div className="text-4xl font-black text-green-600">
                                {area10r.toFixed(2)} <span className="text-lg font-normal text-green-500">反 (10a)</span>
                            </div>
                            {area10r === 0 && <p className="text-sm text-slate-500 mt-2">地図上で圃場を描画してください</p>}
                        </div>
                    </div>

                    <div className="bg-slate-900 rounded-2xl p-6 text-white space-y-4">
                        <div className="text-center">
                            <div className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">現在の単価</div>
                            <div key={currentPrice} className="text-4xl font-black text-yellow-400 flex justify-center items-baseline gap-1 animate-price-pulse">
                                <span className="text-2xl">¥</span>
                                {currentPrice?.toLocaleString()}
                                <span className="text-sm font-normal text-slate-400 ml-1">/ 10a</span>
                            </div>
                            {validation.isUnformed && (
                                <div className="text-red-400 text-xs font-bold mt-2">⚠️ 最低成立面積に達していません</div>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-4 border-t border-slate-700 pt-4">
                            <div>
                                <div className="text-slate-400 text-xs">合計（税抜）</div>
                                <div className="font-bold text-lg">¥{finalAmountExTax.toLocaleString()}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-slate-400 text-xs">合計（税込）</div>
                                <div className="font-bold text-xl text-yellow-400">¥{tax.amountInclusive.toLocaleString()}</div>
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting || area10r <= 0}
                        className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white font-bold py-5 px-8 rounded-2xl hover:from-green-600 hover:to-green-700 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl text-lg inline-flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                送信中...
                            </>
                        ) : (
                            <>
                                <Check className="w-5 h-5" /> 申し込みを完了する
                            </>
                        )}
                    </button>
                </div>
            </div>
        </form>
    );
}
