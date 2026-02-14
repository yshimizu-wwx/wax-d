'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StepIndicator } from '@/components/ui/step-indicator';
import { fetchMasters } from '@/lib/masters';
import { stripJapanFromDisplayAddress } from '@/lib/geo/addressFormat';
import { DateInputWithWeekday } from '@/components/ui/date-input-with-weekday';
import type { Master } from '@/types/database';
import type { Field } from '@/types/database';
import type { WorkRequestData, LinkedProvider } from '@/lib/api';
import type { WorkRequest } from '@/types/database';
import { ArrowRight, ArrowLeft, Check, Copy } from 'lucide-react';

export interface WorkRequestFormProps {
  farmerId: string;
  fields: Field[];
  linkedProviders: LinkedProvider[];
  onSubmit: (data: WorkRequestData) => Promise<void>;
  onCancel?: () => void;
  /** 紐付き業者一覧を再取得する（マイページで紐づけしたあとに呼ぶ） */
  onRefetchRequested?: () => void;
  /** 前回の内容をコピーする元（直近の依頼）。指定時は「前回の内容をコピー」ボタンを表示 */
  lastRequest?: WorkRequest | null;
}

const WIZARD_STEPS = 4;
const STEP_LABELS = ['基本情報', '作業内容', '希望日・備考', '確認'] as const;
type Step = 1 | 2 | 3 | 4;

export default function WorkRequestForm({
  farmerId,
  fields,
  linkedProviders,
  onSubmit,
  onCancel,
  onRefetchRequested,
  lastRequest,
}: WorkRequestFormProps) {
  const [step, setStep] = useState<Step>(1);
  /** 前回コピー適用後、マスタ読込完了時に品目・作業種別をマッピングするための保持 */
  const [copySource, setCopySource] = useState<WorkRequest | null>(null);
  const [providerId, setProviderId] = useState('');
  const [location, setLocation] = useState('');
  const OTHER_VALUE = '__OTHER__';

  const [cropId, setCropId] = useState('');
  const [taskCategoryId, setTaskCategoryId] = useState('');
  const [taskDetailId, setTaskDetailId] = useState('');
  const [cropFreeText, setCropFreeText] = useState('');
  const [taskCategoryFreeText, setTaskCategoryFreeText] = useState('');
  const [taskDetailFreeText, setTaskDetailFreeText] = useState('');
  const [desiredStartDate, setDesiredStartDate] = useState('');
  const [desiredEndDate, setDesiredEndDate] = useState('');
  const [selectedFieldIds, setSelectedFieldIds] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  const [crops, setCrops] = useState<Master[]>([]);
  const [taskCategories, setTaskCategories] = useState<Master[]>([]);
  const [taskDetails, setTaskDetails] = useState<Master[]>([]);

  useEffect(() => {
    if (!providerId) {
      setCrops([]);
      setTaskCategories([]);
      setTaskDetails([]);
      setCropId('');
      setTaskCategoryId('');
      setTaskDetailId('');
      setCropFreeText('');
      setTaskCategoryFreeText('');
      setTaskDetailFreeText('');
      return;
    }
    Promise.all([
      fetchMasters('crop', providerId),
      fetchMasters('task_category', providerId),
      fetchMasters('task_detail', providerId),
    ]).then(([c, tc, td]) => {
      setCrops((c || []).filter((m) => m.status === 'active'));
      setTaskCategories((tc || []).filter((m) => m.status === 'active'));
      setTaskDetails((td || []).filter((m) => m.status === 'active'));
      setCropId('');
      setTaskCategoryId('');
      setTaskDetailId('');
      setCropFreeText('');
      setTaskCategoryFreeText('');
      setTaskDetailFreeText('');
    });
  }, [providerId]);

  /** 前回コピー後、マスタ読込完了時に品目・作業種別・作業内容を名前でマッピング */
  useEffect(() => {
    if (!copySource || providerId !== copySource.provider_id) return;
    if (crops.length === 0 && taskCategories.length === 0) return;

    const cn = copySource.crop_name_free_text?.trim() || copySource.crop_name?.trim();
    if (cn) {
      const found = crops.find((m) => m.name === cn);
      if (found) {
        setCropId(found.id);
        setCropFreeText('');
      } else {
        setCropId(OTHER_VALUE);
        setCropFreeText(cn);
      }
    }

    let appliedTaskCategoryId = '';
    const tcn = copySource.task_category_free_text?.trim() || copySource.task_category_name?.trim();
    if (tcn) {
      const found = taskCategories.find((m) => m.name === tcn);
      if (found) {
        appliedTaskCategoryId = found.id;
        setTaskCategoryId(found.id);
        setTaskCategoryFreeText('');
      } else {
        setTaskCategoryId(OTHER_VALUE);
        setTaskCategoryFreeText(tcn);
      }
    }

    const tdn = copySource.task_detail_free_text?.trim() || copySource.task_detail_name?.trim();
    if (tdn && taskDetails.length > 0) {
      const candidates = appliedTaskCategoryId
        ? taskDetails.filter((d) => d.parent_id === appliedTaskCategoryId)
        : taskDetails;
      const found = candidates.find((m) => m.name === tdn);
      if (found) {
        setTaskDetailId(found.id);
        setTaskDetailFreeText('');
      } else {
        setTaskDetailId(OTHER_VALUE);
        setTaskDetailFreeText(tdn);
      }
    }

    setCopySource(null);
  }, [copySource, providerId, crops, taskCategories, taskDetails]);

  const estimatedArea10r = useMemo(() => {
    return fields
      .filter((f) => selectedFieldIds.has(f.id))
      .reduce((sum, f) => sum + (f.area_size ?? 0), 0);
  }, [fields, selectedFieldIds]);

  const suggestedLocation = useMemo(() => {
    const selected = fields.filter((f) => selectedFieldIds.has(f.id));
    const withAddress = selected.find((f) => f.address?.trim());
    const raw = withAddress?.address?.trim() ?? '';
    return stripJapanFromDisplayAddress(raw);
  }, [fields, selectedFieldIds]);

  useEffect(() => {
    setLocation(suggestedLocation);
  }, [suggestedLocation]);

  const toggleField = (id: string) => {
    setSelectedFieldIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const cropName = cropId === OTHER_VALUE ? cropFreeText.trim() : crops.find((m) => m.id === cropId)?.name;
  const taskCategoryName = taskCategoryId === OTHER_VALUE ? taskCategoryFreeText.trim() : taskCategories.find((m) => m.id === taskCategoryId)?.name;
  const taskDetailName = taskDetailId === OTHER_VALUE ? taskDetailFreeText.trim() : taskDetails.find((m) => m.id === taskDetailId)?.name;

  const validateStep1 = (): boolean => {
    const e: Partial<Record<string, string>> = {};
    if (!providerId) e.providerId = '依頼先の業者を選んでください';
    if (selectedFieldIds.size === 0) e.fields = '対象の畑を1つ以上選んでください';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = (): boolean => {
    const e: Partial<Record<string, string>> = {};
    if (!cropId) e.cropId = '品目を選んでください';
    else if (cropId === OTHER_VALUE && !cropFreeText.trim()) e.cropId = '品目を入力してください';
    if (!taskCategoryId) e.taskCategoryId = '作業種別を選んでください';
    else if (taskCategoryId === OTHER_VALUE && !taskCategoryFreeText.trim()) e.taskCategoryId = '作業種別を入力してください';
    if (!taskDetailId) e.taskDetailId = '作業内容を選んでください';
    else if (taskDetailId === OTHER_VALUE && !taskDetailFreeText.trim()) e.taskDetailId = '作業内容を入力してください';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep3 = (): boolean => {
    const e: Partial<Record<string, string>> = {};
    if (!desiredStartDate) e.desiredStartDate = '希望開始日を選んでください';
    if (!desiredEndDate) e.desiredEndDate = '希望終了日を選んでください';
    if (desiredStartDate && desiredEndDate && desiredStartDate > desiredEndDate) {
      e.desiredEndDate = '終了日は開始日以降にしてください';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
    else if (step === 3 && validateStep3()) setStep(4);
  };

  const handleCopyFromLast = () => {
    if (!lastRequest) return;
    setProviderId(lastRequest.provider_id ?? '');
    setLocation(lastRequest.location ?? '');
    setDesiredStartDate(lastRequest.desired_start_date ?? '');
    setDesiredEndDate(lastRequest.desired_end_date ?? '');
    setNotes(lastRequest.notes ?? '');
    setSelectedFieldIds(new Set(lastRequest.field_ids ?? []));
    setErrors({});
    if (lastRequest.provider_id) {
      setCopySource(lastRequest);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step !== 4) return;
    if (!validateStep1() || !validateStep2() || !validateStep3()) {
      if (!validateStep1()) setStep(1);
      else if (!validateStep2()) setStep(2);
      else setStep(3);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        farmer_id: farmerId,
        provider_id: providerId,
        location: location || undefined,
        crop_name: cropId !== OTHER_VALUE ? cropName : undefined,
        task_category_name: taskCategoryId !== OTHER_VALUE ? taskCategoryName : undefined,
        task_detail_name: taskDetailId !== OTHER_VALUE ? taskDetailName : undefined,
        crop_name_free_text: cropId === OTHER_VALUE ? cropFreeText.trim() || undefined : undefined,
        task_category_free_text: taskCategoryId === OTHER_VALUE ? taskCategoryFreeText.trim() || undefined : undefined,
        task_detail_free_text: taskDetailId === OTHER_VALUE ? taskDetailFreeText.trim() || undefined : undefined,
        desired_start_date: desiredStartDate || undefined,
        desired_end_date: desiredEndDate || undefined,
        estimated_area_10r: estimatedArea10r > 0 ? Math.round(estimatedArea10r * 10) / 10 : undefined,
        field_ids: Array.from(selectedFieldIds),
        notes: notes || undefined,
      });
      setStep(1);
      setProviderId('');
      setLocation('');
      setCropId('');
      setTaskCategoryId('');
      setTaskDetailId('');
      setCropFreeText('');
      setTaskCategoryFreeText('');
      setTaskDetailFreeText('');
      setDesiredStartDate('');
      setDesiredEndDate('');
      setSelectedFieldIds(new Set());
      setNotes('');
      setErrors({});
    } finally {
      setSubmitting(false);
    }
  };

  /** タッチしやすいボタン高さ（44px以上） */
  const btnClass = 'min-h-[44px] px-5 py-3 rounded-xl text-sm font-bold tracking-tight transition-all duration-200';

  if (linkedProviders.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 space-y-4">
          <p className="text-dashboard-muted text-sm">
            依頼先の業者とまだ紐付けされていません。招待コードで業者と紐付けてから作業依頼を送信できます。
          </p>
          <div className="rounded-xl border border-dashboard-border bg-dashboard-bg/50 p-4 text-sm">
            <p className="font-medium text-dashboard-text mb-1">業者との紐づけ方法</p>
            <ol className="list-decimal list-inside space-y-1 text-dashboard-muted">
              <li>作業を依頼したい業者から<strong className="text-dashboard-text">招待コード</strong>を受け取る</li>
              <li>
                <Link href="/mypage" className="text-agrix-forest hover:underline font-medium">
                  マイページ
                </Link>
                の「業者と紐づける」で招待コードを入力して紐づける
              </li>
              <li>紐づけが完了すると、この画面から依頼先として業者を選べるようになります</li>
            </ol>
            <p className="mt-3 text-dashboard-muted text-xs">
              招待コードは業者の担当者にお問い合わせください。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/mypage"
              className="inline-flex items-center justify-center rounded-lg border border-agrix-forest bg-transparent px-5 py-2 text-sm font-bold text-agrix-forest transition-colors hover:bg-agrix-forest/10 focus:outline-none focus:ring-2 focus:ring-agrix-forest min-h-[44px]"
            >
              マイページで招待コードを入力する
            </Link>
            {onRefetchRequested && (
              <Button
                type="button"
                variant="secondary"
                className={btnClass}
                onClick={() => onRefetchRequested()}
              >
                最新の状態を確認
              </Button>
            )}
          </div>
          {onRefetchRequested && (
            <p className="text-xs text-dashboard-muted">
              マイページで紐づけしたあとは「最新の状態を確認」を押すと、依頼先が表示されます。
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <StepIndicator
            currentStep={step}
            totalSteps={WIZARD_STEPS}
            labels={[...STEP_LABELS]}
          />

          {/* Step 1: 基本情報 */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-out ${
              step === 1 ? 'opacity-100 max-h-[9999px]' : 'opacity-0 max-h-0 pointer-events-none absolute invisible'
            }`}
          >
            <div className="space-y-4">
              {lastRequest && (
                <div className="rounded-xl border border-dashboard-border bg-dashboard-bg/50 p-3">
                  <p className="text-xs text-dashboard-muted mb-2">前回の依頼内容をそのまま使えます。確認してから次へ進みましょう。</p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCopyFromLast}
                    className={`${btnClass} w-full sm:w-auto`}
                  >
                    <Copy className="w-4 h-4" /> 前回の内容をコピー
                  </Button>
                </div>
              )}
              <div>
                <Label htmlFor="provider">依頼先の業者</Label>
                <select
                  id="provider"
                  value={providerId}
                  onChange={(e) => setProviderId(e.target.value)}
                  className="mt-1 w-full min-h-[44px] rounded-xl border border-dashboard-border bg-dashboard-card px-3 py-2.5 text-sm text-dashboard-text focus:outline-none focus:ring-2 focus:ring-agrix-forest"
                >
                  <option value="">選択してください</option>
                  {linkedProviders.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {errors.providerId && <p className="text-xs text-red-500 mt-1">{errors.providerId}</p>}
              </div>

              <div>
                <Label>対象の畑（複数選択可）</Label>
                <p className="text-xs text-dashboard-muted mb-2">依頼対象の畑にチェックを入れてください。合計面積は自動計算されます。</p>
                <div className="space-y-2 max-h-48 overflow-y-auto rounded-xl border border-dashboard-border bg-dashboard-card p-3">
                  {fields.map((f) => (
                    <label key={f.id} className="flex items-center gap-3 cursor-pointer min-h-[44px] py-1">
                      <input
                        type="checkbox"
                        checked={selectedFieldIds.has(f.id)}
                        onChange={() => toggleField(f.id)}
                        className="rounded border-dashboard-border text-agrix-forest focus:ring-agrix-forest size-5 shrink-0"
                      />
                      <span className="text-sm text-dashboard-text">
                        {f.name || '（名称未設定）'}
                        {f.area_size != null && ` · ${f.area_size} 反`}
                      </span>
                    </label>
                  ))}
                </div>
                {errors.fields && <p className="text-xs text-red-500 mt-1">{errors.fields}</p>}
                <div className="mt-2">
                  <Label className="text-dashboard-muted font-normal">合計面積（反）</Label>
                  <Input
                    readOnly
                    value={estimatedArea10r > 0 ? String(Math.round(estimatedArea10r * 10) / 10) : ''}
                    placeholder="畑を選択すると自動で計算されます"
                    className="mt-1 bg-dashboard-bg min-h-[44px]"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="location">依頼場所・地域（任意）</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="例: 〇〇県〇〇市"
                  className="mt-1 min-h-[44px] rounded-xl"
                />
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <Button type="button" onClick={handleNext} className={`${btnClass} bg-agrix-forest hover:bg-agrix-forest-dark`}>
                  次へ進む <ArrowRight className="w-4 h-4" />
                </Button>
                {onCancel && (
                  <Button type="button" variant="outline" onClick={onCancel} className={btnClass}>
                    キャンセル
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Step 2: 作業内容（業者選択後のみ表示可能） */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-out ${
              step === 2 ? 'opacity-100 max-h-[9999px]' : 'opacity-0 max-h-0 pointer-events-none absolute invisible'
            }`}
          >
            <div className="space-y-4">
              {providerId && (
                <>
                  <div>
                    <Label htmlFor="crop">品目</Label>
                    <p className="text-xs text-dashboard-muted mb-1">マスタにない品目は「その他」から自由入力できます。</p>
                    <select
                      id="crop"
                      value={cropId}
                      onChange={(e) => setCropId(e.target.value)}
                      className="mt-1 w-full min-h-[44px] rounded-xl border border-dashboard-border bg-dashboard-card px-3 py-2.5 text-sm text-dashboard-text focus:outline-none focus:ring-2 focus:ring-agrix-forest"
                    >
                      <option value="">選択してください</option>
                      {crops.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                      <option value={OTHER_VALUE}>その他（自由入力）</option>
                    </select>
                    {cropId === OTHER_VALUE && (
                      <Input
                        value={cropFreeText}
                        onChange={(e) => setCropFreeText(e.target.value)}
                        placeholder="例: 桃、ぶどう"
                        className="mt-2 min-h-[44px] rounded-xl"
                      />
                    )}
                    {errors.cropId && <p className="text-xs text-red-500 mt-1">{errors.cropId}</p>}
                  </div>
                  <div>
                    <Label htmlFor="taskCategory">作業種別</Label>
                    <p className="text-xs text-dashboard-muted mb-1">マスタにない作業種別は「その他」から自由入力できます。</p>
                    <select
                      id="taskCategory"
                      value={taskCategoryId}
                      onChange={(e) => {
                        setTaskCategoryId(e.target.value);
                        if (e.target.value !== OTHER_VALUE) setTaskDetailId('');
                      }}
                      className="mt-1 w-full min-h-[44px] rounded-xl border border-dashboard-border bg-dashboard-card px-3 py-2.5 text-sm text-dashboard-text focus:outline-none focus:ring-2 focus:ring-agrix-forest"
                    >
                      <option value="">選択してください</option>
                      {taskCategories.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                      <option value={OTHER_VALUE}>その他（自由入力）</option>
                    </select>
                    {taskCategoryId === OTHER_VALUE && (
                      <Input
                        value={taskCategoryFreeText}
                        onChange={(e) => setTaskCategoryFreeText(e.target.value)}
                        placeholder="例: 防除、収穫"
                        className="mt-2 min-h-[44px] rounded-xl"
                      />
                    )}
                    {errors.taskCategoryId && <p className="text-xs text-red-500 mt-1">{errors.taskCategoryId}</p>}
                  </div>
                  <div>
                    <Label htmlFor="taskDetail">作業内容（詳細）</Label>
                    <p className="text-xs text-dashboard-muted mb-1">マスタにない作業内容は「その他」から自由入力できます。</p>
                    <select
                      id="taskDetail"
                      value={taskDetailId}
                      onChange={(e) => setTaskDetailId(e.target.value)}
                      className="mt-1 w-full min-h-[44px] rounded-xl border border-dashboard-border bg-dashboard-card px-3 py-2.5 text-sm text-dashboard-text focus:outline-none focus:ring-2 focus:ring-agrix-forest disabled:opacity-50"
                      disabled={!taskCategoryId}
                    >
                      <option value="">{taskCategoryId ? '選択してください' : '先に作業種別を選択'}</option>
                      {taskCategoryId && taskCategoryId !== OTHER_VALUE && taskDetails.filter((d) => d.parent_id === taskCategoryId).map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                      {taskCategoryId && <option value={OTHER_VALUE}>その他（自由入力）</option>}
                    </select>
                    {taskDetailId === OTHER_VALUE && (
                      <Input
                        value={taskDetailFreeText}
                        onChange={(e) => setTaskDetailFreeText(e.target.value)}
                        placeholder="例: 散布、摘果"
                        className="mt-2 min-h-[44px] rounded-xl"
                      />
                    )}
                    {errors.taskDetailId && <p className="text-xs text-red-500 mt-1">{errors.taskDetailId}</p>}
                  </div>
                </>
              )}

              <div className="flex flex-wrap gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setStep(1)} className={btnClass}>
                  <ArrowLeft className="w-4 h-4" /> 戻る
                </Button>
                <Button type="button" onClick={handleNext} className={`${btnClass} bg-agrix-forest hover:bg-agrix-forest-dark`}>
                  次へ進む <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Step 3: 希望日・備考 */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-out ${
              step === 3 ? 'opacity-100 max-h-[9999px]' : 'opacity-0 max-h-0 pointer-events-none absolute invisible'
            }`}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="desiredStartDate">希望開始日</Label>
                  <DateInputWithWeekday
                    id="desiredStartDate"
                    value={desiredStartDate}
                    onChange={setDesiredStartDate}
                    placeholder="yyyy/mm/dd（曜日）で選択"
                    wrapperClassName="mt-1 rounded-xl border border-dashboard-border bg-dashboard-card focus-within:ring-2 focus-within:ring-agrix-forest min-h-[44px]"
                  />
                  {errors.desiredStartDate && <p className="text-xs text-red-500 mt-1">{errors.desiredStartDate}</p>}
                </div>
                <div>
                  <Label htmlFor="desiredEndDate">希望終了日</Label>
                  <DateInputWithWeekday
                    id="desiredEndDate"
                    value={desiredEndDate}
                    onChange={setDesiredEndDate}
                    min={desiredStartDate || undefined}
                    placeholder="yyyy/mm/dd（曜日）で選択"
                    wrapperClassName="mt-1 rounded-xl border border-dashboard-border bg-dashboard-card focus-within:ring-2 focus-within:ring-agrix-forest min-h-[44px]"
                  />
                  {errors.desiredEndDate && <p className="text-xs text-red-500 mt-1">{errors.desiredEndDate}</p>}
                </div>
              </div>

              <div>
                <Label htmlFor="notes">備考（任意）</Label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="業者への連絡事項など"
                  className="mt-1 w-full min-h-[88px] rounded-xl border border-dashboard-border bg-dashboard-card px-3 py-2.5 text-sm text-dashboard-text focus:outline-none focus:ring-2 focus:ring-agrix-forest"
                />
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setStep(2)} className={btnClass}>
                  <ArrowLeft className="w-4 h-4" /> 戻る
                </Button>
                <Button type="button" onClick={handleNext} className={`${btnClass} bg-agrix-forest hover:bg-agrix-forest-dark`}>
                  次へ進む <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Step 4: 確認 */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-out ${
              step === 4 ? 'opacity-100 max-h-[9999px]' : 'opacity-0 max-h-0 pointer-events-none absolute invisible'
            }`}
          >
            <div className="space-y-4">
              <div className="rounded-xl border border-dashboard-border bg-dashboard-bg/50 p-4 space-y-2 text-sm">
                <p><span className="text-dashboard-muted">依頼先</span> {linkedProviders.find((p) => p.id === providerId)?.name ?? '—'}</p>
                <p><span className="text-dashboard-muted">対象畑</span> {fields.filter((f) => selectedFieldIds.has(f.id)).map((f) => f.name || '（名称未設定）').join('、') || '—'}</p>
                <p><span className="text-dashboard-muted">合計面積</span> {estimatedArea10r > 0 ? `${Math.round(estimatedArea10r * 10) / 10} 反` : '—'}</p>
                {location && <p><span className="text-dashboard-muted">場所・地域</span> {location}</p>}
                <p><span className="text-dashboard-muted">品目</span> {cropName || '—'}</p>
                <p><span className="text-dashboard-muted">作業種別</span> {taskCategoryName || '—'}</p>
                <p><span className="text-dashboard-muted">作業内容</span> {taskDetailName || '—'}</p>
                <p><span className="text-dashboard-muted">希望期間</span> {desiredStartDate && desiredEndDate ? `${desiredStartDate} 〜 ${desiredEndDate}` : '—'}</p>
                {notes && <p><span className="text-dashboard-muted">備考</span> {notes}</p>}
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setStep(3)} className={btnClass}>
                  <ArrowLeft className="w-4 h-4" /> 戻る
                </Button>
                <Button type="submit" disabled={submitting} className={`${btnClass} bg-agrix-forest hover:bg-agrix-forest-dark`}>
                  {submitting ? '送信中...' : (<><Check className="w-4 h-4" /> 作業を依頼する</>)}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
