'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Play, Pause, Flame, Clock, Trash2, ArrowRight, AlertTriangle } from 'lucide-react';
import { WorkoutRunEntity, formatWorkoutTime, calculateElapsedSeconds } from '../contracts/workout.contract';
import { abandonWorkoutRunAction } from '../server/workout-actions';

interface ResumeWorkoutCardProps {
  run: WorkoutRunEntity;
  onRunAbandoned?: () => void;
}

export function ResumeWorkoutCard({ run, onRunAbandoned }: ResumeWorkoutCardProps) {
  const [isAbandoning, setIsAbandoning] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [abandonError, setAbandonError] = useState<string | null>(null);

  const isPaused = run.status === 'paused';
  const elapsedSecs = calculateElapsedSeconds(
    run.started_at,
    run.paused_at,
    run.total_paused_duration_seconds
  );
  const timeFormatted = formatWorkoutTime(elapsedSecs);

  const handleConfirmAbandon = async () => {
    setIsAbandoning(true);
    setAbandonError(null);
    try {
      const res = await abandonWorkoutRunAction(run.id);
      if (res.success) {
        setShowConfirmModal(false);
        if (onRunAbandoned) {
          onRunAbandoned();
        } else {
          window.location.reload();
        }
      } else {
        setAbandonError(res.message || 'Lỗi khi hủy phiên tập.');
        setIsAbandoning(false);
      }
    } catch (err) {
      setAbandonError(err instanceof Error ? err.message : 'Lỗi kết nối.');
      setIsAbandoning(false);
    }
  };

  return (
    <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-500/30 shadow-xl space-y-4">
      {/* 1. Header & Status */}
      <div className="flex items-center justify-between">
        <span
          className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${
            isPaused
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'
            }`}
          />
          <span>{isPaused ? 'Đã tạm dừng' : 'Đang tập dở dang'}</span>
        </span>

        <div className="flex items-center gap-1 text-xs text-slate-400 font-mono">
          <Clock className="w-3.5 h-3.5 text-emerald-400" />
          <span>{timeFormatted}</span>
        </div>
      </div>

      {/* 2. Session Info */}
      <div>
        <h2 className="text-base font-bold text-white tracking-tight">{run.session_title}</h2>
        <p className="text-xs text-slate-400 mt-1">
          Phiên bản bài tập được cố định lúc bắt đầu (bảo toàn khi tải lại hoặc chương trình thay đổi).
        </p>
      </div>

      {/* 3. Actions - DUY NHẤT MỘT CTA CHÍNH THEO TRẠNG THÁI (SPEC D3 MỤC 1) */}
      <div className="flex items-center gap-2 pt-1">
        <Link
          href={`/workout/${run.id}`}
          className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-900/30"
        >
          <Play className="w-4 h-4 fill-white" />
          <span>Tiếp tục buổi tập dở dang</span>
          <ArrowRight className="w-4 h-4 ml-1 opacity-70" />
        </Link>

        <button
          type="button"
          onClick={() => setShowConfirmModal(true)}
          className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700/60 hover:border-rose-900/50 transition"
          title="Hủy bỏ lượt tập này"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Modal xác nhận hủy bỏ buổi tập */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-5 shadow-2xl text-left space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-white">Hủy bỏ buổi tập dở dang?</h3>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              Bạn có chắc chắn muốn hủy lượt tập{' '}
              <strong className="text-white">{run.session_title}</strong> không?
            </p>

            <div className="text-xs text-slate-400 bg-slate-800/60 p-3 rounded-lg border border-slate-700/50">
              🛡️ Lượt tập chưa hoàn thành sẽ được đánh dấu <em>bỏ qua (abandoned)</em>. Hệ thống sẽ KHÔNG ghi nhận thành tích hay sinh hoạt động giả vào hồ sơ.
            </div>

            {abandonError && (
              <div className="text-xs text-rose-400 p-2 bg-rose-950/20 rounded border border-rose-900/30">
                {abandonError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isAbandoning}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
              >
                Giữ lại
              </button>
              <button
                type="button"
                onClick={handleConfirmAbandon}
                disabled={isAbandoning}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition"
              >
                {isAbandoning ? 'Đang hủy...' : 'Xác nhận hủy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
