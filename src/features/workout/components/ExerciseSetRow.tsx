'use client';

import React, { useState, useEffect } from 'react';
import { Check, CheckCircle2, Loader2, AlertTriangle, SkipForward, RotateCcw } from 'lucide-react';
import { WorkoutSetEntity, WorkoutSetSyncState } from '../contracts/workout.contract';

interface ExerciseSetRowProps {
  set: WorkoutSetEntity;
  syncState?: WorkoutSetSyncState;
  syncError?: string | null;
  onSaveSet: (data: {
    actualReps: number | null;
    actualLoad: number | null;
    actualDurationSeconds?: number | null;
    status: 'completed' | 'skipped' | 'pending';
  }) => void;
  disabled?: boolean;
}

export function ExerciseSetRow({
  set,
  syncState = 'draft',
  syncError = null,
  onSaveSet,
  disabled = false,
}: ExerciseSetRowProps) {
  const isTimed=set.target_unit === 'seconds';
  const actualValue=isTimed ? set.actual_duration_seconds : set.actual_reps;
  const [repsInput, setRepsInput] = useState<string>(() => {
    return actualValue != null ? String(actualValue) : '';
  });
  const [loadInput, setLoadInput] = useState<string>(() => {
    return set.actual_load !== null && set.actual_load !== undefined ? String(set.actual_load) : '';
  });

  // Đồng bộ khi set từ props thay đổi (ví dụ khi người dùng sao chép lần trước)
  useEffect(() => {
    setRepsInput(actualValue != null ? String(actualValue) : '');
    if (set.actual_load !== null && set.actual_load !== undefined) {
      setLoadInput(String(set.actual_load));
    }
  }, [actualValue, set.actual_load]);

  const handleSave = () => {
    const parsedReps = repsInput.trim() !== '' ? parseInt(repsInput, 10) : null;
    const parsedLoad = loadInput.trim() !== '' ? parseFloat(loadInput) : null;

    onSaveSet({
      actualReps: !isTimed && Number.isFinite(parsedReps) ? parsedReps : null,
      actualDurationSeconds: isTimed && Number.isFinite(parsedReps) ? parsedReps : null,
      actualLoad: Number.isFinite(parsedLoad) ? parsedLoad : null,
      status: 'completed',
    });
  };

  const handleSkip = () => {
    onSaveSet({
      actualReps: null,
      actualLoad: null,
      status: 'skipped',
    });
  };

  const isCompleted = set.status === 'completed';
  const isSkipped = set.status === 'skipped';

  return (
    <div
      className={`p-3 rounded-xl border transition-all ${
        isCompleted
          ? 'bg-emerald-950/20 border-emerald-800/40'
          : isSkipped
          ? 'bg-slate-900/40 border-slate-800/60 opacity-60'
          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Cột 1: Thông tin hiệp & Mục tiêu */}
        <div className="flex items-center gap-3">
          <span
            className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
              isCompleted
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : isSkipped
                ? 'bg-slate-800 text-slate-500'
                : 'bg-slate-800 text-slate-300'
            }`}
          >
            {set.set_order}
          </span>
          <div>
            <div className="text-xs text-slate-400">
              Mục tiêu: <span className="text-white font-medium">{set.target_reps} {set.target_unit || 'reps'}</span>
              {set.target_assistance && (
                <span className="text-slate-400 text-[11px] ml-1">({set.target_assistance})</span>
              )}
            </div>
            {isSkipped && (
              <span className="text-[10px] text-amber-400/90 font-medium tracking-wide">
                [Đã đánh dấu bỏ qua]
              </span>
            )}
          </div>
        </div>

        {/* Cột 2: Ô nhập thực tế (Actual) & Nút hoàn thành */}
        <div className="flex items-center gap-2">
          {!isSkipped && (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="0"
                max="1000"
                placeholder={isTimed ? "Giây" : "Reps"}
                value={repsInput}
                onChange={(e) => setRepsInput(e.target.value)}
                disabled={disabled || syncState === 'pending'}
                className="w-16 px-2 py-1.5 text-center text-sm font-semibold rounded-lg bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-white placeholder-slate-600 disabled:opacity-50"
              />
              <span className="text-xs text-slate-400">{isTimed ? "giây" : "reps"}</span>
            </div>
          )}

          {/* Nút bấm Xong hiệp */}
          {!isSkipped && (
            <button
              type="button"
              onClick={handleSave}
              disabled={disabled || syncState === 'pending' || !(Number(repsInput)>0)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                isCompleted
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-emerald-600/80 hover:bg-emerald-600 text-white disabled:bg-slate-800 disabled:text-slate-500'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isCompleted ? 'Cập nhật' : 'Xong'}</span>
            </button>
          )}

          {/* Nút Bỏ qua hiệp */}
          {!isCompleted && !isSkipped && (
            <button
              type="button"
              onClick={handleSkip}
              disabled={disabled || syncState === 'pending'}
              className="px-2 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              title="Bỏ qua hiệp này"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Phục hồi hiệp nếu đã lỡ bấm bỏ qua */}
          {isSkipped && (
            <button
              type="button"
              onClick={() => {
                setRepsInput('');
                onSaveSet({ actualReps: null, actualLoad: null, status: 'pending' });
              }}
              disabled={disabled}
              className="px-2.5 py-1 rounded-lg text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 flex items-center gap-1 transition"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Tập lại hiệp này</span>
            </button>
          )}
        </div>
      </div>

      {/* Dòng trạng thái đồng bộ: pending / saved / failed */}
      <div className="mt-2 flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/40">
        <div>
          {syncState === 'pending' && (
            <span className="text-amber-400 flex items-center gap-1 font-medium">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Đang lưu lên máy chủ...</span>
            </span>
          )}
          {syncState === 'saved' && (
            <span className="text-emerald-400 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3 h-3" />
              <span>Đã lưu vào máy chủ</span>
            </span>
          )}
          {syncState === 'failed' && (
            <span className="text-rose-400 flex items-center gap-1 font-medium" title={syncError || ''}>
              <AlertTriangle className="w-3 h-3" />
              <span>{syncError || 'Lỗi lưu hiệp'}</span>
            </span>
          )}
          {syncState === 'draft' && !isCompleted && !isSkipped && (
            <span className="text-slate-500">Chưa nhập</span>
          )}
        </div>

        {syncState === 'failed' && (
          <button
            type="button"
            onClick={handleSave}
            className="text-[11px] text-rose-300 hover:text-rose-200 underline font-medium"
          >
            Thử lại
          </button>
        )}
      </div>
    </div>
  );
}
