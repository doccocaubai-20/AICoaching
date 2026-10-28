'use client';

import React, { useState, useEffect } from 'react';
import { History, Copy, AlertCircle, Check } from 'lucide-react';
import { PreviousExerciseComparison } from '../contracts/workout.contract';
import { getPreviousExerciseRecordAction } from '../server/workout-actions';

interface PreviousRecordBadgeProps {
  exerciseName: string;
  variant?: string | null;
  unit?: string;
  assistance?: string | null;
  onApplyPreviousSets?: (
    sets: Array<{
      set_order: number;
      actual_reps: number | null;
      actual_load: number | null;
      actual_duration_seconds: number | null;
      actual_unit: string;
      actual_assistance: string | null;
    }>
  ) => void;
}

export function PreviousRecordBadge({
  exerciseName,
  variant,
  unit,
  assistance,
  onApplyPreviousSets,
}: PreviousRecordBadgeProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [comparison, setComparison] = useState<PreviousExerciseComparison | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    setLoading(true);

    getPreviousExerciseRecordAction({
      exerciseName,
      variant: variant || undefined,
      unit: unit || undefined,
      assistance: assistance || undefined,
    }).then((res) => {
      if (!active) return;
      setLoading(false);
      if (res.success && res.data) {
        setComparison(res.data);
      } else {
        setComparison({ hasComparison: false, reason: 'no_previous_record' });
      }
    });

    return () => {
      active = false;
    };
  }, [exerciseName, variant, unit, assistance]);

  if (loading) {
    return (
      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 py-1">
        <span className="w-2 h-2 rounded-full border border-slate-400 border-t-transparent animate-spin" />
        <span>Đang tra cứu thành tích lần trước...</span>
      </div>
    );
  }

  if (!comparison || !comparison.hasComparison) {
    let reasonText = 'Chưa có kết quả so sánh từ lần trước';
    if (comparison?.reason === 'unmapped_variant') {
      reasonText = 'Chưa có kết quả cho đúng biến thể này';
    } else if (comparison?.reason === 'demo_program_data_excluded') {
      reasonText = 'Chưa có kết quả do người dùng thực sự tập';
    }

    return (
      <div className="text-[11px] text-slate-400/80 flex items-center gap-1.5 py-1">
        <History className="w-3.5 h-3.5 text-slate-500" />
        <span>{reasonText}</span>
      </div>
    );
  }

  const handleConfirmCopy = () => {
    if (comparison.exactSets && onApplyPreviousSets) {
      onApplyPreviousSets(comparison.exactSets);
    }
    setShowConfirmModal(false);
  };

  return (
    <div className="py-1">
      <div className="inline-flex flex-wrap items-center gap-2 text-xs bg-slate-800/80 border border-slate-700/60 rounded-lg px-2.5 py-1.5 text-slate-300">
        <History className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span>
          Lần trước: <strong className="text-white font-medium">{comparison.summaryText}</strong>
        </span>

        {onApplyPreviousSets && comparison.exactSets && (
          <button
            type="button"
            onClick={() => setShowConfirmModal(true)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[11px] font-medium transition"
            title="Sao chép kết quả lần trước vào các hiệp"
          >
            <Copy className="w-3 h-3" />
            <span>Sao chép</span>
          </button>
        )}
      </div>

      {/* Modal xác nhận sao chép - TUÂN THỦ SPEC D3 MỤC 4: CẦN NGƯỜI DÙNG XÁC NHẬN */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-5 shadow-2xl text-left space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-white">Xác nhận sao chép lần trước</h3>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              Bạn có muốn điền kết quả lần trước (
              <strong className="text-white">{comparison.summaryText}</strong>) vào các hiệp thực tế của bài tập{' '}
              <strong className="text-emerald-400">{exerciseName}</strong> không?
            </p>

            <div className="text-xs text-slate-400 bg-slate-800/60 p-3 rounded-lg border border-slate-700/50">
              💡 <strong>Lưu ý:</strong> Dữ liệu chỉ được điền nháp để bạn kiểm tra và điều chỉnh. Hệ thống không coi mục tiêu hay dữ liệu sao chép là thành tích khi chưa lưu.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmCopy}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center gap-1.5 transition"
              >
                <Check className="w-4 h-4" />
                <span>Xác nhận sao chép</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
