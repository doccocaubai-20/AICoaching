'use client';

import React, { useState, useEffect, useTransition } from 'react';
import {
  X,
  PlayCircle,
  AlertCircle,
  CheckCircle2,
  Clock,
  Flame,
  FileText,
  Calendar,
  Dumbbell,
} from 'lucide-react';
import { SessionEntity, newIdempotencyKey } from '@/contracts';
import { recordSessionResultAction, ActionResult } from '@/app/programs/actions';
import { parseExercises } from './program-utils';
import {
  localDatetimeToIso,
  getVietnamNowDatetimeLocal,
} from '@/components/activities/activity-utils';

interface SessionResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: SessionEntity | null;
  isConfigured: boolean;
  onSuccess?: () => void;
}

interface ExerciseInputState {
  exercise_name: string;
  actual_sets: string;
  actual_reps: string;
}

export function SessionResultModal({
  isOpen,
  onClose,
  session,
  isConfigured,
  onSuccess,
}: SessionResultModalProps) {
  const [completedAtLocal, setCompletedAtLocal] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('35');
  const [perceivedExertion, setPerceivedExertion] = useState('');
  const [notes, setNotes] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [exerciseInputs, setExerciseInputs] = useState<ExerciseInputState[]>([]);

  const [isPending, startTransition] = useTransition();
  const [actionResult, setActionResult] = useState<ActionResult | null>(null);

  // Sinh idempotency_key MỘT LẦN khi mở form ghi kết quả
  useEffect(() => {
    if (!isOpen || !session) return;

    setActionResult(null);
    setCompletedAtLocal(getVietnamNowDatetimeLocal());
    setDurationMinutes('35');
    setPerceivedExertion('');
    setNotes('');
    setIdempotencyKey(newIdempotencyKey());

    // Khởi tạo các ô nhập cho từng động tác trong buổi tập
    const parsed = parseExercises(session.exercises);
    setExerciseInputs(
      parsed.map((ex) => ({
        exercise_name: ex.name,
        actual_sets: String(ex.sets),
        actual_reps: ex.target_reps,
      }))
    );
  }, [isOpen, session]);

  if (!isOpen || !session) return null;

  const handleExerciseChange = (
    index: number,
    field: 'actual_sets' | 'actual_reps',
    val: string
  ) => {
    setExerciseInputs((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: val };
      return updated;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActionResult(null);

    // Chuyển đổi sang ISO ngay tại trình duyệt
    const isoCompletedAt = localDatetimeToIso(completedAtLocal);
    if (!isoCompletedAt) {
      setActionResult({
        success: false,
        message: 'Vui lòng chọn thời gian hoàn thành hợp lệ.',
      });
      return;
    }

    const dur = parseInt(durationMinutes, 10);
    if (isNaN(dur) || dur <= 0 || dur > 1440) {
      setActionResult({
        success: false,
        message: 'Thời lượng buổi tập phải từ 1 đến 1440 phút.',
      });
      return;
    }

    const formData = new FormData();
    formData.set('session_id', session.id);
    formData.set('completed_at', isoCompletedAt);
    formData.set('duration_minutes', String(dur));
    if (perceivedExertion && perceivedExertion.trim() !== '') {
      formData.set('perceived_exertion', perceivedExertion.trim());
    }
    if (notes && notes.trim() !== '') {
      formData.set('notes', notes.trim());
    }
    formData.set('idempotency_key', idempotencyKey);
    formData.set('completed_exercises', JSON.stringify(exerciseInputs));

    startTransition(async () => {
      const res = await recordSessionResultAction(null, formData);
      setActionResult(res);

      if (res.success) {
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 600);
      }
      // Giữ form khi có lỗi để người dùng sửa lại hoặc gửi lại cùng khóa
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-session-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Dumbbell className="w-4 h-4" />
            </div>
            <div>
              <h2 id="modal-session-title" className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Ghi nhận kết quả buổi tập
              </h2>
              <p className="text-[11px] text-slate-500 line-clamp-1">{session.title}</p>
            </div>
          </div>
          <button
            type="button"
            disabled={isPending}
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition"
            aria-label="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
          {actionResult && (
            <div
              className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                actionResult.success
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200'
              }`}
            >
              {actionResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span>{actionResult.message}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 1. Danh sách động tác tự khai số hiệp & số lần */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                Kết quả thực tế từng động tác (Tùy chọn)
              </label>
              <p className="text-[10px] text-slate-400 leading-normal">
                Động tác nào không thực hiện, vui lòng bỏ trống hoặc xóa số (hệ thống sẽ bỏ qua, không ghi nhận là 0).
              </p>

              <div className="space-y-2 pt-1">
                {exerciseInputs.map((ex, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-2"
                  >
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                      {idx + 1}. {ex.exercise_name}
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-500 block mb-0.5">Số hiệp đạt</span>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={ex.actual_sets}
                          onChange={(e) =>
                            handleExerciseChange(idx, 'actual_sets', e.target.value)
                          }
                          disabled={isPending || !isConfigured}
                          placeholder="Số hiệp"
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block mb-0.5">Số lần/thời gian</span>
                        <input
                          type="text"
                          value={ex.actual_reps}
                          onChange={(e) =>
                            handleExerciseChange(idx, 'actual_reps', e.target.value)
                          }
                          disabled={isPending || !isConfigured}
                          placeholder="VD: 8 lần hoặc 30s"
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Thời điểm hoàn thành & Thời lượng */}
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Thời điểm hoàn thành (Giờ Việt Nam) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={completedAtLocal}
                  onChange={(e) => setCompletedAtLocal(e.target.value)}
                  disabled={isPending || !isConfigured}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tổng thời lượng (phút) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    step="1"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    disabled={isPending || !isConfigured}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mức gắng sức (1-10)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    step="1"
                    value={perceivedExertion}
                    onChange={(e) => setPerceivedExertion(e.target.value)}
                    disabled={isPending || !isConfigured}
                    placeholder="Tùy chọn"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Cảm nhận & Ghi chú (Tùy chọn)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isPending || !isConfigured}
                  placeholder="VD: Cảm thấy cơ vai căng tốt, hiệp cuối hơi mỏi..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={isPending}
                onClick={onClose}
                className="px-3.5 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isPending || !isConfigured}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl transition disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
              >
                {isPending ? 'Đang lưu kết quả...' : 'Lưu kết quả & Đồng bộ'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
