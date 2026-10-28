'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Zap,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Clock,
  Moon,
  Scale,
  ExternalLink,
  Edit2,
  AlertTriangle,
} from 'lucide-react';
import { parseQuickCaptureAction, commitCaptureBatchAction } from '@/features/capture/server/capture-actions';
import {
  CaptureDraft,
  CaptureReceipt,
  ConfirmBatchPayload,
} from '@/features/capture/contracts/capture.contract';

const SAMPLE_PROMPTS = [
  'Hôm nay chạy 25 phút, tối qua ngủ 6 tiếng rưỡi',
  'Sáng nay chống đẩy 30 phút, mệt 7, nặng 68kg',
  'Hôm qua tập calis 45 phút, rpe 8',
];

export default function CapturePage() {
  const [inputText, setInputText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [draft, setDraft] = useState<CaptureDraft | null>(null);
  const [activeDisambiguationIndex, setActiveDisambiguationIndex] = useState(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<CaptureReceipt | null>(null);

  // Sinh và giữ idempotency key cho phiên draft hiện tại
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');

  const handleParse = async (textToParse?: string) => {
    const text = textToParse ?? inputText;
    if (!text.trim()) return;

    setIsParsing(true);
    setParseError(null);
    setSubmitError(null);
    setReceipt(null);

    const result = await parseQuickCaptureAction(text);
    setIsParsing(false);

    if (!result.success || !result.data) {
      setParseError(result.error?.message || 'Không thể phân tích nội dung');
      return;
    }

    setDraft(result.data);
    setIdempotencyKey(crypto.randomUUID());
    setActiveDisambiguationIndex(0);
  };

  const handleDisambiguationChoice = (
    questionId: string,
    targetValue: { activityFatigue?: number; checkinStressOrEnergy?: { stress?: number; energy?: number } }
  ) => {
    if (!draft) return;

    const updatedActivities = [...draft.activities];
    if (targetValue.activityFatigue !== undefined && updatedActivities.length > 0) {
      updatedActivities[0] = {
        ...updatedActivities[0],
        fatigue_level: targetValue.activityFatigue,
      };
    }

    let updatedCheckin = draft.dailyCheckin;
    if (targetValue.checkinStressOrEnergy && updatedCheckin) {
      updatedCheckin = {
        ...updatedCheckin,
        stress_level: targetValue.checkinStressOrEnergy.stress ?? updatedCheckin.stress_level,
        energy_level: targetValue.checkinStressOrEnergy.energy ?? updatedCheckin.energy_level,
      };
    }

    const remainingDisambiguations = draft.disambiguations.filter((q) => q.id !== questionId);

    setDraft({
      ...draft,
      activities: updatedActivities,
      dailyCheckin: updatedCheckin,
      disambiguations: remainingDisambiguations,
      revision: draft.revision + 1,
    });
  };

  const handleConfirmBatch = async () => {
    if (!draft || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const payload: ConfirmBatchPayload = {
      idempotencyKey,
      draftRevision: draft.revision,
      rawInput: draft.rawInput,
      timezone: draft.timezone,
      activities: draft.activities.map((a) => ({
        activity_type: a.activity_type,
        duration_minutes: a.duration_minutes,
        fatigue_level: a.fatigue_level,
        start_at: a.start_at,
        notes: a.notes,
      })),
      dailyCheckin: draft.dailyCheckin
        ? {
            local_date: draft.dailyCheckin.local_date,
            sleep_start: draft.dailyCheckin.sleep_start,
            sleep_end: draft.dailyCheckin.sleep_end,
            sleep_duration_minutes: draft.dailyCheckin.sleep_duration_minutes,
            sleep_quality: draft.dailyCheckin.sleep_quality,
            energy_level: draft.dailyCheckin.energy_level,
            stress_level: draft.dailyCheckin.stress_level,
            notes: draft.dailyCheckin.notes,
            action: draft.dailyCheckin.conflictResolution,
          }
        : null,
      observations: draft.observations.map((o) => ({
        metric_type: o.metric_type,
        metric_value: o.metric_value,
        metric_unit: o.metric_unit,
        observed_at: o.observed_at,
        notes: o.notes,
      })),
    };

    const res = await commitCaptureBatchAction(payload);
    setIsSubmitting(false);

    if (!res.success || !res.data) {
      setSubmitError(res.error?.message || 'Có lỗi khi lưu các bản ghi.');
      return;
    }

    setReceipt(res.data);
    setDraft(null);
  };

  const resetAll = () => {
    setInputText('');
    setDraft(null);
    setReceipt(null);
    setParseError(null);
    setSubmitError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header điều hướng */}
        <div className="flex items-center justify-between">
          <Link
            href="/profile?tab=health"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại Hồ sơ sức khỏe</span>
          </Link>
          <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 rounded-full">
            D1 — Quick Capture
          </span>
        </div>

        {/* Tiêu đề chính */}
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Zap className="w-6 h-6 text-emerald-500" />
            <span>Ghi hồ sơ bằng một câu</span>
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Nhập nhanh một câu tiếng Việt. Hệ thống tự nhận diện buổi tập, thời lượng, giấc ngủ và chỉ số cơ thể trước khi bạn xác nhận lưu.
          </p>
        </div>

        {/* Khối nhập nội dung (khi chưa có receipt) */}
        {!receipt && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="space-y-2">
              <label htmlFor="quick-input" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Nhập câu nhật ký của bạn
              </label>
              <textarea
                id="quick-input"
                rows={3}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ví dụ: Hôm nay chạy 25 phút, tối qua ngủ 6 tiếng rưỡi..."
                className="w-full p-3.5 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all placeholder:text-slate-400"
              />
            </div>

            {/* Gợi ý mẫu */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-500">Ví dụ gợi ý:</div>
              <div className="flex flex-wrap gap-2">
                {SAMPLE_PROMPTS.map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setInputText(sample);
                      handleParse(sample);
                    }}
                    className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
                  >
                    &ldquo;{sample}&rdquo;
                  </button>
                ))}
              </div>
            </div>

            {parseError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{parseError}</span>
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="button"
                disabled={isParsing || !inputText.trim()}
                onClick={() => handleParse()}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-sm transition-all"
              >
                {isParsing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang phân tích...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>Phân tích câu</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Khối câu hỏi làm rõ (Disambiguation) */}
        {draft && draft.disambiguations.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-sm">
              <HelpCircle className="w-5 h-5 text-amber-600" />
              <span>Cần làm rõ thông tin ({draft.disambiguations.length} câu hỏi)</span>
            </div>

            {draft.disambiguations.map((question) => (
              <div key={question.id} className="space-y-3 p-4 bg-white dark:bg-slate-900 rounded-xl border border-amber-200/60 dark:border-amber-900/60">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {question.question}
                </p>
                <div className="space-y-2">
                  {question.options.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleDisambiguationChoice(question.id, opt.targetValue)}
                      className="w-full text-left p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-amber-500 hover:bg-amber-50/50 dark:hover:bg-amber-950/30 transition-all flex items-start justify-between gap-3"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100">{opt.label}</div>
                        <div className="text-[11px] text-slate-500">{opt.description}</div>
                      </div>
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 mt-1 shrink-0">Chọn &rarr;</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Khối xem trước và chỉnh sửa bản nháp (Draft Preview) */}
        {draft && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-emerald-600" />
                  <span>Xem trước bản nháp (Bản #{draft.revision})</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Kiểm tra hoặc điều chỉnh trước khi xác nhận lưu vào hệ thống.
                </p>
              </div>
              <span className="text-[11px] text-slate-400">Múi giờ: {draft.timezone}</span>
            </div>

            {/* Cảnh báo các trường còn thiếu */}
            {draft.missingFields.length > 0 && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl space-y-1">
                {draft.missingFields.map((mf, i) => (
                  <div key={i} className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{mf.message}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Danh sách Activity đã nhận diện */}
            {draft.activities.map((act, index) => (
              <div key={act.tempId} className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Hoạt động #{index + 1}: {act.activity_type}
                    </span>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 rounded">
                    {act.duration_minutes} phút
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">Thời lượng (phút):</label>
                    <input
                      type="number"
                      min={1}
                      max={1440}
                      value={act.duration_minutes}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 1;
                        const updated = [...draft.activities];
                        updated[index] = { ...updated[index], duration_minutes: val };
                        setDraft({ ...draft, activities: updated, revision: draft.revision + 1 });
                      }}
                      className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">Mức mệt/RPE (1-10):</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={act.fatigue_level ?? ''}
                      placeholder="Không bắt buộc"
                      onChange={(e) => {
                        const val = e.target.value ? parseInt(e.target.value, 10) : undefined;
                        const updated = [...draft.activities];
                        updated[index] = { ...updated[index], fatigue_level: val };
                        setDraft({ ...draft, activities: updated, revision: draft.revision + 1 });
                      }}
                      className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* Chi tiết Check-in Giấc ngủ (nếu có) */}
            {draft.dailyCheckin && (
              <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Moon className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Sinh hoạt & Giấc ngủ ({draft.dailyCheckin.local_date})
                    </span>
                  </div>
                  {draft.dailyCheckin.sleep_duration_minutes && (
                    <span className="text-xs font-semibold px-2 py-0.5 bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 rounded">
                      {(draft.dailyCheckin.sleep_duration_minutes / 60).toFixed(1)} giờ
                    </span>
                  )}
                </div>

                {/* Xung đột check-in đã có */}
                {draft.dailyCheckin.existingRecord && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl space-y-2">
                    <div className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-200">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold">Ngày {draft.dailyCheckin.local_date} đã có check-in trước đó:</div>
                        <div className="text-[11px] text-amber-700 dark:text-amber-300">
                          Ngủ: {draft.dailyCheckin.existingRecord.sleep_duration_minutes ? `${draft.dailyCheckin.existingRecord.sleep_duration_minutes} phút` : 'Chưa có'} | Năng lượng: {draft.dailyCheckin.existingRecord.energy_level || 'N/A'}/5
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 pt-1">
                      <label className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                        <input
                          type="radio"
                          name="checkin_conflict"
                          checked={draft.dailyCheckin.conflictResolution === 'update'}
                          onChange={() =>
                            setDraft({
                              ...draft,
                              dailyCheckin: { ...draft.dailyCheckin!, conflictResolution: 'update' },
                              revision: draft.revision + 1,
                            })
                          }
                          className="text-emerald-600"
                        />
                        <span>Cập nhật đè thông tin mới</span>
                      </label>
                      <label className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                        <input
                          type="radio"
                          name="checkin_conflict"
                          checked={draft.dailyCheckin.conflictResolution === 'skip'}
                          onChange={() =>
                            setDraft({
                              ...draft,
                              dailyCheckin: { ...draft.dailyCheckin!, conflictResolution: 'skip' },
                              revision: draft.revision + 1,
                            })
                          }
                          className="text-amber-600"
                        />
                        <span>Bỏ qua (Giữ check-in cũ)</span>
                      </label>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">Thời gian ngủ (phút):</label>
                    <input
                      type="number"
                      min={0}
                      max={1440}
                      value={draft.dailyCheckin.sleep_duration_minutes ?? ''}
                      placeholder="Số phút ngủ"
                      onChange={(e) => {
                        const val = e.target.value ? parseInt(e.target.value, 10) : undefined;
                        setDraft({
                          ...draft,
                          dailyCheckin: { ...draft.dailyCheckin!, sleep_duration_minutes: val },
                          revision: draft.revision + 1,
                        });
                      }}
                      className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">Mức năng lượng (1-5):</label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={draft.dailyCheckin.energy_level ?? ''}
                      placeholder="1 (thấp) - 5 (sung mãn)"
                      onChange={(e) => {
                        const val = e.target.value ? parseInt(e.target.value, 10) : undefined;
                        setDraft({
                          ...draft,
                          dailyCheckin: { ...draft.dailyCheckin!, energy_level: val },
                          revision: draft.revision + 1,
                        });
                      }}
                      className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Danh sách Chỉ số cơ thể (Observations) */}
            {draft.observations.map((obs, idx) => (
              <div key={obs.tempId} className="p-4 bg-teal-50/50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Scale className="w-4 h-4 text-teal-600" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Chỉ số #{idx + 1}: {obs.metric_type === 'weight' ? 'Cân nặng' : obs.metric_type}
                    </span>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200 rounded">
                    {obs.metric_value} {obs.metric_unit}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">Giá trị:</label>
                    <input
                      type="number"
                      step="0.1"
                      min={1}
                      value={obs.metric_value}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        const updated = [...draft.observations];
                        updated[idx] = { ...updated[idx], metric_value: val };
                        setDraft({ ...draft, observations: updated, revision: draft.revision + 1 });
                      }}
                      className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">Đơn vị:</label>
                    <input
                      type="text"
                      disabled
                      value={obs.metric_unit}
                      className="w-full p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            ))}

            {submitError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Các nút hành động */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={resetAll}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
              >
                Hủy bỏ
              </button>

              <button
                type="button"
                disabled={isSubmitting || draft.disambiguations.length > 0}
                onClick={handleConfirmBatch}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-md transition-all"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang lưu nguyên tử...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Xác nhận lưu ({draft.activities.length + (draft.dailyCheckin ? 1 : 0) + draft.observations.length} bản ghi)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Khối Biên nhận thành công (Receipt) */}
        {receipt && (
          <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 rounded-full">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {receipt.status === 'replayed' ? 'Bản ghi đã được lưu trước đó' : 'Đã ghi nhận thành công!'}
                </h3>
                <p className="text-xs text-slate-500">
                  Tổng cộng {receipt.totalRecords} mục dữ liệu đã được lưu nguyên tử vào hồ sơ của bạn.
                </p>
              </div>
            </div>

            {/* Danh sách bản ghi thật có liên kết */}
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Các bản ghi thực tế:
              </div>
              <div className="space-y-2">
                {receipt.records.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100">{rec.label}</div>
                      <div className="text-[11px] text-slate-500">{rec.detail} (ID: {rec.id.slice(0, 8)}...)</div>
                    </div>
                    <Link
                      href={rec.viewUrl}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      <span>Mở xem</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={resetAll}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl text-center shadow-sm transition-all"
              >
                Ghi thêm câu khác
              </button>
              <Link
                href="/dashboard"
                className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl text-center transition-all"
              >
                Về Hôm nay
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
