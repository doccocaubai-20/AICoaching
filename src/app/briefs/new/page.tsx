'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FileText,
  ArrowLeft,
  Calendar,
  Dumbbell,
  Stethoscope,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  Moon,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { getLocalDateString, getPastLocalDateString } from '@/lib/date-utils';
import {
  generateBriefPreviewAction,
  saveBriefSnapshotAction,
} from '@/features/briefs/server/briefs-actions';
import {
  BriefType,
  BriefSnapshotPayload,
  CreateBriefSnapshotInput,
} from '@/features/briefs/contracts/briefs.contract';

export default function NewBriefPage() {
  const router = useRouter();

  // Step 1: Chọn mẫu & ngày
  const [briefType, setBriefType] = useState<BriefType>('workout');
  const [title, setTitle] = useState('Tóm tắt quá trình tập luyện 2 tuần qua');
  const [dateRangeOption, setDateRangeOption] = useState<'7' | '14' | '30' | 'custom'>('14');

  const todayStr = getLocalDateString();
  const [startDate, setStartDate] = useState(getPastLocalDateString(14));
  const [endDate, setEndDate] = useState(todayStr);

  // Mẫu medical: Cho phép tick chọn danh mục
  const [includeConditions, setIncludeConditions] = useState(true);
  const [includeMedications, setIncludeMedications] = useState(false);
  const [includeAllergies, setIncludeAllergies] = useState(false);

  // Ghi chú của người dùng
  const [userNotes, setUserNotes] = useState('');

  // Step 2: Preview state
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewPayload, setPreviewPayload] = useState<BriefSnapshotPayload | null>(null);

  // Step 3: Save snapshot state
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleRangeOptionChange = (option: '7' | '14' | '30' | 'custom') => {
    setDateRangeOption(option);
    if (option === '7') {
      setStartDate(getPastLocalDateString(7));
      setEndDate(todayStr);
    } else if (option === '14') {
      setStartDate(getPastLocalDateString(14));
      setEndDate(todayStr);
    } else if (option === '30') {
      setStartDate(getPastLocalDateString(30));
      setEndDate(todayStr);
    }
  };

  const handleBriefTypeChange = (type: BriefType) => {
    setBriefType(type);
    if (type === 'workout') {
      setTitle('Tóm tắt quá trình tập luyện 2 tuần qua');
    } else {
      setTitle('Bản chuẩn bị thông tin sức khỏe đi khám');
    }
    setPreviewPayload(null);
  };

  const handleGeneratePreview = async () => {
    setIsPreviewing(true);
    setPreviewError(null);
    setSaveError(null);

    const categories: string[] = ['activities', 'daily_checkins', 'observations'];
    if (briefType === 'medical') {
      if (includeConditions) categories.push('conditions');
      if (includeMedications) categories.push('medications');
      if (includeAllergies) categories.push('allergies');
    }

    const input: CreateBriefSnapshotInput = {
      briefType,
      title: title.trim() || (briefType === 'workout' ? 'Tóm tắt tập luyện' : 'Chuẩn bị đi khám'),
      dateRangeStart: startDate,
      dateRangeEnd: endDate,
      includedCategories: categories,
      userNotes: userNotes.trim() || undefined,
      enableAISummary: false,
    };

    const res = await generateBriefPreviewAction(input);
    setIsPreviewing(false);

    if (!res.success || !res.data) {
      setPreviewError(res.error?.message || 'Không thể tạo bản xem trước.');
      return;
    }

    setPreviewPayload(res.data);
  };

  const handleSaveSnapshot = async () => {
    if (!previewPayload || isSaving) return;

    setIsSaving(true);
    setSaveError(null);

    const categories: string[] = ['activities', 'daily_checkins', 'observations'];
    if (briefType === 'medical') {
      if (includeConditions) categories.push('conditions');
      if (includeMedications) categories.push('medications');
      if (includeAllergies) categories.push('allergies');
    }

    const input: CreateBriefSnapshotInput = {
      briefType,
      title: title.trim() || (briefType === 'workout' ? 'Tóm tắt tập luyện' : 'Chuẩn bị đi khám'),
      dateRangeStart: startDate,
      dateRangeEnd: endDate,
      includedCategories: categories,
      userNotes: userNotes.trim() || undefined,
      enableAISummary: false,
    };

    const res = await saveBriefSnapshotAction(input, previewPayload);
    setIsSaving(false);

    if (!res.success || !res.data) {
      setSaveError(res.error?.message || 'Có lỗi khi lưu bản tóm tắt.');
      return;
    }

    // Chuyển hướng tới chi tiết brief vừa tạo
    router.push(`/briefs/${res.data.briefId}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Link
            href="/briefs"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại Danh sách tóm tắt</span>
          </Link>
          <span className="px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 rounded-full">
            D2 — Tạo mới
          </span>
        </div>

        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            <span>Tạo bản tóm tắt hồ sơ</span>
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Chọn mẫu trao đổi, khoảng thời gian và xem trước bản tổng hợp deterministic trước khi lưu snapshot bất biến.
          </p>
        </div>

        {/* BƯỚC 1: CẤU HÌNH BẢN TÓM TẮT */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-2">
            1. Chọn mẫu trao đổi & Mục đích
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Mẫu Tập Luyện */}
            <button
              type="button"
              onClick={() => handleBriefTypeChange('workout')}
              className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between space-y-2 ${
                briefType === 'workout'
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-1 ring-emerald-500'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 rounded-lg">
                  <Dumbbell className="w-4 h-4" />
                </div>
                <div className="font-bold text-sm text-slate-900 dark:text-white">Trao đổi tập luyện</div>
              </div>
              <p className="text-xs text-slate-500">
                Gồm các buổi tập, tổng thời lượng, PR/kết quả, giấc ngủ và khó khăn tự ghi. Mặc định <strong>không</strong> gồm thuốc hay bệnh sử.
              </p>
            </button>

            {/* Mẫu Đi Khám */}
            <button
              type="button"
              onClick={() => handleBriefTypeChange('medical')}
              className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between space-y-2 ${
                briefType === 'medical'
                  ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/30 ring-1 ring-purple-500'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/60 text-purple-600 rounded-lg">
                  <Stethoscope className="w-4 h-4" />
                </div>
                <div className="font-bold text-sm text-slate-900 dark:text-white">Chuẩn bị đi khám</div>
              </div>
              <p className="text-xs text-slate-500">
                Bản chuẩn bị thông tin tự khai (triệu chứng, chỉ số đo, thuốc/dị ứng nếu chọn) để trao đổi với nhân viên y tế.
              </p>
            </button>
          </div>

          {/* Tiêu đề Brief */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              Tiêu đề bản tóm tắt:
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
            />
          </div>

          {/* Khoảng thời gian */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              Khoảng thời gian:
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleRangeOptionChange('7')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                  dateRangeOption === '7'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                7 ngày qua
              </button>
              <button
                type="button"
                onClick={() => handleRangeOptionChange('14')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                  dateRangeOption === '14'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                14 ngày qua
              </button>
              <button
                type="button"
                onClick={() => handleRangeOptionChange('30')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                  dateRangeOption === '30'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                30 ngày qua
              </button>
              <button
                type="button"
                onClick={() => handleRangeOptionChange('custom')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                  dateRangeOption === 'custom'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                Tùy chỉnh
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <span className="text-[11px] text-slate-500 block">Từ ngày:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setDateRangeOption('custom');
                  }}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 text-xs border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Đến ngày:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setDateRangeOption('custom');
                  }}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 text-xs border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Tùy chọn y tế (chỉ khi chọn mẫu medical) */}
          {briefType === 'medical' && (
            <div className="p-4 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-xl space-y-2">
              <span className="text-xs font-bold text-purple-900 dark:text-purple-200 block">
                Nhóm dữ liệu y tế chủ động chọn (mặc định chỉ lấy phần bạn cho phép):
              </span>
              <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeConditions}
                    onChange={(e) => setIncludeConditions(e.target.checked)}
                    className="rounded text-purple-600"
                  />
                  <span>Tình trạng sức khỏe & Triệu chứng tự ghi</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeMedications}
                    onChange={(e) => setIncludeMedications(e.target.checked)}
                    className="rounded text-purple-600"
                  />
                  <span>Thuốc đang dùng tự khai</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeAllergies}
                    onChange={(e) => setIncludeAllergies(e.target.checked)}
                    className="rounded text-purple-600"
                  />
                  <span>Dị ứng & Phản ứng tự khai</span>
                </label>
              </div>
            </div>
          )}

          {/* Ghi chú thêm */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              Ghi chú thêm cho người nhận (HLV / Bác sĩ):
            </label>
            <textarea
              rows={2}
              value={userNotes}
              onChange={(e) => setUserNotes(e.target.value)}
              placeholder="Ví dụ: Giai đoạn này cổ tay hơi mỏi khi tập dips, cần điều chỉnh giáo án..."
              className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
            />
          </div>

          {previewError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{previewError}</span>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="button"
              disabled={isPreviewing}
              onClick={handleGeneratePreview}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-sm transition-all"
            >
              {isPreviewing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Đang tổng hợp dữ liệu...</span>
                </>
              ) : (
                <>
                  <span>Xem trước bản tóm tắt</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* BƯỚC 2: PREVIEW BẢN TỔNG HỢP DETERMINISTIC */}
        {previewPayload && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Bản xem trước tóm tắt (Deterministic Snapshot)</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Dữ liệu được tổng hợp trực tiếp từ hồ sơ gốc kèm SourceRef.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-slate-400">
                {previewPayload.sourceRefs.length} bản ghi nguồn
              </span>
            </div>

            {/* Disclaimer */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-600 dark:text-slate-300 italic">
              &ldquo;{previewPayload.meta.disclaimer}&rdquo;
            </div>

            {/* Chỉ số tổng quan Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900">
                <div className="text-xl font-black text-blue-700 dark:text-blue-300">
                  {previewPayload.overview.activitySessionCount}
                </div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase mt-0.5">Số buổi tập</div>
              </div>

              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-900">
                <div className="text-xl font-black text-emerald-700 dark:text-emerald-300">
                  {previewPayload.overview.totalActivityMinutes}
                </div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase mt-0.5">Tổng phút tập</div>
              </div>

              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900">
                <div className="text-xl font-black text-indigo-700 dark:text-indigo-300">
                  {previewPayload.overview.averageSleepMinutes
                    ? `${(previewPayload.overview.averageSleepMinutes / 60).toFixed(1)}h`
                    : 'N/A'}
                </div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase mt-0.5">Ngủ TB/đêm</div>
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-100 dark:border-amber-900">
                <div className="text-xl font-black text-amber-700 dark:text-amber-300">
                  {previewPayload.overview.missingDaysCount}
                </div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase mt-0.5">Ngày thiếu dữ liệu</div>
              </div>
            </div>

            {/* Missing Data Notes */}
            {previewPayload.missingDataNotes.length > 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl space-y-1">
                {previewPayload.missingDataNotes.map((note, idx) => (
                  <div key={idx} className="text-xs text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{note}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Chi tiết các buổi tập */}
            {previewPayload.workoutDetails && (
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Danh sách các buổi tập trong kỳ ({previewPayload.workoutDetails.sessions.length}):
                </div>
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {previewPayload.workoutDetails.sessions.map((s, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{s.date}:</span>
                        <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[11px] font-medium">
                          {s.activityType}
                        </span>
                        <span className="text-slate-500">{s.durationMinutes} phút</span>
                      </div>
                      {s.fatigueLevel && (
                        <span className="text-[11px] text-slate-500">RPE: {s.fatigueLevel}/10</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Danh sách SourceRef */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Nguồn dữ liệu xác thực (SourceRefs):
              </div>
              <div className="flex flex-wrap gap-1.5">
                {previewPayload.sourceRefs.slice(0, 10).map((ref, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-400 rounded border border-slate-200 dark:border-slate-700"
                  >
                    {ref.sourceType} #{ref.sourceId.slice(0, 6)} ({ref.fingerprint.slice(0, 8)})
                  </span>
                ))}
                {previewPayload.sourceRefs.length > 10 && (
                  <span className="text-[10px] text-slate-400 self-center">
                    + {previewPayload.sourceRefs.length - 10} nguồn khác
                  </span>
                )}
              </div>
            </div>

            {saveError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{saveError}</span>
              </div>
            )}

            {/* Nút Xác nhận lưu Snapshot */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveSnapshot}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-md transition-all"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang lưu snapshot bất biến...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Xác nhận & Lưu bản tóm tắt</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
