'use client';

import React from 'react';
import { AlertTriangle, Play, CheckCircle } from 'lucide-react';

interface IncompleteSetsModalProps {
  incompleteCount: number;
  totalCount: number;
  onContinueWorkout: () => void;
  onConfirmPartial: () => void;
  onClose: () => void;
}

export function IncompleteSetsModal({
  incompleteCount,
  totalCount,
  onContinueWorkout,
  onConfirmPartial,
  onClose,
}: IncompleteSetsModalProps) {
  const completedCount = totalCount - incompleteCount;
  const percent = Math.round((completedCount / Math.max(1, totalCount)) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-left">
        <div className="flex items-center gap-3 text-amber-400">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Còn hiệp chưa nhập kết quả</h3>
            <p className="text-xs text-slate-400">Hoàn thành một phần buổi tập</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2">
          <div className="flex justify-between text-xs font-medium">
            <span className="text-slate-300">Tiến độ hiện tại:</span>
            <span className="text-emerald-400">{completedCount} / {totalCount} hiệp ({percent}%)</span>
          </div>
          <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 pt-1">
            Bạn còn <strong className="text-amber-300">{incompleteCount} hiệp</strong> chưa nhập kết quả thực tế.
          </p>
        </div>

        <div className="text-xs text-slate-300 leading-relaxed bg-amber-950/20 border border-amber-900/40 p-3 rounded-xl space-y-1">
          <strong className="text-amber-300 flex items-center gap-1.5">
            <span>🛡️ Nguyên tắc minh bạch dữ liệu:</span>
          </strong>
          <p>
            Các hiệp chưa tập sẽ được ghi nhận là <em>&quot;Bỏ qua&quot;</em>. Hệ thống{' '}
            <strong className="text-white">tuyệt đối không tự điền số 0 hay mục tiêu thay bạn</strong>, bảo đảm tính xác thực của lịch sử rèn luyện.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <button
            type="button"
            onClick={onContinueWorkout}
            className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-900/20"
          >
            <Play className="w-4 h-4" />
            <span>Tiếp tục tập nốt</span>
          </button>

          <button
            type="button"
            onClick={onConfirmPartial}
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-sm font-medium flex items-center justify-center gap-2 transition"
          >
            <CheckCircle className="w-4 h-4 text-slate-400" />
            <span>Hoàn thành một phần</span>
          </button>
        </div>
      </div>
    </div>
  );
}
