'use client';

import React, { useState } from 'react';
import { X, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import type { SkillMilestone, SourceRef } from '../contracts/skills.contract';
import { recordJourneyAttemptAction } from '../server/skills-actions';
import { EvidencePicker } from './EvidencePicker';
import { VideoUploadDropzone } from '../../media/components/VideoUploadDropzone';

interface AttemptRecordModalProps {
  milestone: SkillMilestone;
  initialSource?: SourceRef | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AttemptRecordModal({
  milestone, initialSource,
  isOpen,
  onClose,
  onSuccess,
}: AttemptRecordModalProps) {
  // F2: Actual để trống ban đầu, KHÔNG gán mặc định bằng target (Thành tích thực khác mục tiêu)
  const [actualReps, setActualReps] = useState<string>('');
  const [actualDuration, setActualDuration] = useState<string>('');
  const [assistance, setAssistance] = useState<string>(milestone.assistance || 'bodyweight');
  const [notes, setNotes] = useState<string>('');
  const [isAchievedSelfReported, setIsAchievedSelfReported] = useState<boolean>(false);
  const [selectedSource, setSelectedSource] = useState<SourceRef | null>(initialSource || null);
  const [uploadedVideoId, setUploadedVideoId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Khóa idempotency key duy nhất cho phiên mở modal này
  const [idempotencyKey] = useState<string>(() => `attempt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const repsNum = actualReps.trim() !== '' ? parseInt(actualReps.trim(), 10) : null;
    const durNum = actualDuration.trim() !== '' ? parseInt(actualDuration.trim(), 10) : null;

    if (repsNum === null && durNum === null) {
      setErrorMessage('Vui lòng nhập số lần (reps) hoặc thời gian thực hiện (giây).');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await recordJourneyAttemptAction({
        journeyId: milestone.journeyId,
        milestoneId: milestone.id,
        exerciseId: milestone.exerciseId,
        variantId: milestone.variantId,
        assistance,
        actualReps: repsNum,
        actualDurationSeconds: durNum,
        notes: notes.trim().length > 0 ? notes.trim() : null,
        isAchievedSelfReported,
        sourceRef: selectedSource,
        videoId: uploadedVideoId,
        idempotencyKey,
      });

      if (!res.success) {
        setErrorMessage(res.message || 'Không thể lưu lần thử.');
        setIsSubmitting(false);
        return;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage('Lỗi hệ thống: ' + (err?.message || String(err)));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Ghi Lần Thử Kỹ Năng
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {milestone.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
          {/* Thông tin bài tập & Mục tiêu mốc */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Bài tập / Biến thể:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{milestone.exerciseId} ({milestone.variantId})</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Mục tiêu mốc chuẩn:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {milestone.targetReps ? `${milestone.targetReps} reps` : ''}
                {milestone.targetDurationSeconds ? ` ${milestone.targetDurationSeconds}s` : ''}
                {!milestone.targetReps && !milestone.targetDurationSeconds ? 'Tự ghi nhận' : ''}
              </span>
            </div>
          </div>

          {/* Mức hỗ trợ (Assistance) */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Mức hỗ trợ (Assistance):
            </label>
            <select
              value={assistance}
              onChange={(e) => setAssistance(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
            >
              <option value="bodyweight">Trọng lượng cơ thể (Bodyweight)</option>
              <option value="resistance_band_15kg">Dây kháng lực 15kg (Band 15kg)</option>
              <option value="resistance_band_25kg">Dây kháng lực 25kg (Band 25kg)</option>
              <option value="foot_supported">Chân chạm đất hỗ trợ (Foot supported)</option>
              <option value="eccentric_only">Chỉ pha hạ chậm (Eccentric only)</option>
            </select>
          </div>

          {/* Số lần hoặc Thời lượng */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Số lần thực hiện (reps):
              </label>
              <input
                type="number"
                min="0"
                max="1000"
                value={actualReps}
                onChange={(e) => setActualReps(e.target.value)}
                placeholder="VD: 5"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Thời gian giữ (giây):
              </label>
              <input
                type="number"
                min="0"
                max="86400"
                value={actualDuration}
                onChange={(e) => setActualDuration(e.target.value)}
                placeholder="VD: 30"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
              />
            </div>
          </div>

          {/* Ghi chú */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Ghi chú cảm nhận form:
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="VD: Cùi chỏ khép tốt, rep cuối cằm hơi với..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs resize-none"
            />
          </div>

          {/* Tự nhận định đạt tiêu chí */}
          <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-xl space-y-1.5">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isAchievedSelfReported}
                onChange={(e) => setIsAchievedSelfReported(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 mt-0.5"
              />
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Tôi tự nhận định lần thử này đã đạt chuẩn tiêu chí của mốc ({milestone.targetReps ? `${milestone.targetReps} reps` : ''} {milestone.targetDurationSeconds ? `${milestone.targetDurationSeconds}s` : ''})
              </span>
            </label>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-6 leading-relaxed">
              * Đây là tự đánh giá trung thực để theo dõi tiến trình cá nhân. Đánh dấu chưa đạt vẫn được lưu đầy đủ vào lịch sử để đối chiếu.
            </p>
          </div>

          {/* Gắn nguồn nền có sẵn (EvidencePicker) */}
          <EvidencePicker
            selectedSource={selectedSource}
            onSelectSource={setSelectedSource}
            exerciseId={milestone.exerciseId} variantId={milestone.variantId} assistance={assistance}
          />

          {/* Tải clip đối chiếu (VideoUploadDropzone) */}
          <VideoUploadDropzone
            exerciseId={milestone.exerciseId}
            variantId={milestone.variantId || 'standard'}
            onUploadSuccess={(vidId) => setUploadedVideoId(vidId)}
            onClear={() => setUploadedVideoId(null)}
          />

          {errorMessage && (
            <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Nút Submit */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors disabled:opacity-50 shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Đang lưu...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Lưu Lần Thử
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
