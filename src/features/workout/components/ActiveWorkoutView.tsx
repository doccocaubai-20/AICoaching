'use client';
import {hasWorkoutSetActual,isWorkoutSetIncomplete} from '../contracts/workout.contract';

import React, { useState, useCallback, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Play,
  Pause,
  CheckCircle2,
  X,
  Volume2,
  VolumeX,
  RotateCcw,
  Clock,
  Sparkles,
  AlertTriangle,
  ChevronRight,
  Flame,
  Check,
} from 'lucide-react';
import {
  WorkoutRunEntity,
  WorkoutSetEntity,
  WorkoutSetSyncState,
  formatWorkoutTime,
  ExerciseItemSnapshot,
} from '../contracts/workout.contract';
import { useWorkoutTimer } from '../hooks/useWorkoutTimer';
import { useWorkoutOutbox } from '../hooks/useWorkoutOutbox';
import { ExerciseSetRow } from './ExerciseSetRow';
import { PreviousRecordBadge } from './PreviousRecordBadge';
import { IncompleteSetsModal } from './IncompleteSetsModal';
import { WorkoutResultSummary } from './WorkoutResultSummary';
import { workoutSound } from '@/lib/sound/workout-sound';
import {
  pauseWorkoutRunAction,
  resumeWorkoutRunAction,
  finalizeWorkoutRunAction,
  abandonWorkoutRunAction,
} from '../server/workout-actions';

interface ActiveWorkoutViewProps {
  initialRun: WorkoutRunEntity;
  initialSets: WorkoutSetEntity[];
}

export function ActiveWorkoutView({ initialRun, initialSets }: ActiveWorkoutViewProps) {
  const router = useRouter();
  const [run, setRun] = useState<WorkoutRunEntity>(initialRun);
  const [sets, setSets] = useState<WorkoutSetEntity[]>(initialSets);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Sync state cho từng set: key là idempotency_key hoặc set.id
  const [syncStates, setSyncStates] = useState<
    Record<string, { state: WorkoutSetSyncState; error?: string }>
  >({});

  // Modals & Finalize State
  const [showIncompleteModal, setShowIncompleteModal] = useState<boolean>(false);
  const [showFinalizeModal, setShowFinalizeModal] = useState<boolean>(false);
  const [allowPartial, setAllowPartial] = useState<boolean>(false);
  const [exertion, setExertion] = useState<number>(7);
  const [finishNotes, setFinishNotes] = useState<string>('');
  const [isFinalizing, setIsFinalizing] = useState<boolean>(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  // Outbox hook cho offline retry
  const { isOnline, isSyncing, saveSetWithOutbox, triggerSyncOutbox } = useWorkoutOutbox(run.user_id);

  // Timer hook
  const {
    elapsedSeconds,
    isResting,
    restSecondsLeft,
    initialRestSeconds,
    startRest,
    skipRest,
  } = useWorkoutTimer({
    startedAt: run.started_at,
    pausedAt: run.paused_at,
    totalPausedDurationSeconds: run.total_paused_duration_seconds,
    status: run.status,
    soundEnabled,
  });

  const isPaused = run.status === 'paused';
  const isCompleted = run.status === 'completed';

  // Nhóm các hiệp theo từng bài tập dựa trên exercises_snapshot bất biến
  const exercisesSnapshot: ExerciseItemSnapshot[] = Array.isArray(run.exercises_snapshot)
    ? run.exercises_snapshot
    : [];

  // Xử lý Tạm dừng / Tiếp tục
  const handleTogglePause = async () => {
    try {
      if (isPaused) {
        const res = await resumeWorkoutRunAction(run.id, run.version);
        if (res.success && res.data) {
          setRun((prev) => ({
            ...prev,
            status: 'in_progress',
            paused_at: null,
            version: res.data?.version || prev.version + 1,
          }));
        }
      } else {
        const res = await pauseWorkoutRunAction(run.id, run.version);
        if (res.success && res.data) {
          setRun((prev) => ({
            ...prev,
            status: 'paused',
            paused_at: new Date().toISOString(),
            version: res.data?.version || prev.version + 1,
          }));
        }
      }
    } catch (err) {
      console.error('Lỗi toggle pause:', err);
    }
  };

  // Xử lý lưu từng hiệp
  const handleSaveSet = async (
    targetSet: WorkoutSetEntity,
    data: {
      actualReps: number | null;
      actualLoad: number | null;
      actualDurationSeconds?: number | null;
      status: 'completed' | 'skipped' | 'pending';
    }
  ) => {
    // 1. Cập nhật state lạc quan ngay lập tức
    setSets((prev) =>
      prev.map((s) =>
        s.id === targetSet.id
          ? {
              ...s,
              actual_reps: data.actualReps,
              actual_duration_seconds: data.actualDurationSeconds ?? null,
              actual_load: data.actualLoad,
              status: data.status,
              completed_at: data.status === 'completed' ? new Date().toISOString() : null,
            }
          : s
      )
    );

    setSyncStates((prev) => ({
      ...prev,
      [targetSet.idempotency_key]: { state: 'pending' },
    }));

    if (data.status === 'completed' && soundEnabled) {
      try {
        workoutSound.playSetCompleteDing();
      } catch {
        // Safe
      }
      // Bật đồng hồ nghỉ
      const currentEx = exercisesSnapshot[targetSet.exercise_index];
      const restTime = currentEx?.rest_seconds || 60;
      startRest(restTime);
    }

    // 2. Gửi lưu server qua outbox hook
    const result = await saveSetWithOutbox({
      idempotencyKey: targetSet.idempotency_key,
      runId: run.id,
      exerciseIndex: targetSet.exercise_index,
      exerciseName: targetSet.exercise_name,
      exerciseVariant: targetSet.exercise_variant,
      setOrder: targetSet.set_order,
      targetReps: targetSet.target_reps,
      targetLoad: targetSet.target_load,
      targetDurationSeconds: targetSet.target_duration_seconds,
      targetAssistance: targetSet.target_assistance,
      targetUnit: targetSet.target_unit,
      actualReps: data.actualReps,
      actualLoad: data.actualLoad,
      actualDurationSeconds: data.actualDurationSeconds ?? null,
      actualUnit: targetSet.target_unit || 'reps',
      actualAssistance: targetSet.target_assistance,
      status: data.status,
      timestamp: Date.now(),
    });

    setSyncStates((prev) => ({
      ...prev,
      [targetSet.idempotency_key]: {
        state: result.syncState,
        error: result.message,
      },
    }));
  };

  // Sao chép kết quả lần trước vào các hiệp của 1 bài tập
  const handleApplyPreviousSets = (
    exIndex: number,
    prevSets: Array<{
      set_order: number;
      actual_reps: number | null;
      actual_load: number | null;
      actual_duration_seconds: number | null;
      actual_unit: string;
      actual_assistance: string | null;
    }>
  ) => {
    setSets((currentSets) => {
      return currentSets.map((s) => {
        if (s.exercise_index !== exIndex) return s;
        const matchingPrev = prevSets.find((p) => p.set_order === s.set_order);
        if (matchingPrev && (matchingPrev.actual_unit === 'seconds' ? matchingPrev.actual_duration_seconds !== null : matchingPrev.actual_reps !== null)) {
          return {
            ...s,
            actual_reps: matchingPrev.actual_reps,
            actual_duration_seconds: matchingPrev.actual_duration_seconds,
            actual_unit: matchingPrev.actual_unit,
            actual_load: matchingPrev.actual_load,
            actual_assistance: matchingPrev.actual_assistance,
          };
        }
        return s;
      });
    });
  };

  // Kiểm tra khi bấm nút Hoàn thành
  const handleInitiateFinish = () => {
    const incompleteCount = sets.filter(
      isWorkoutSetIncomplete
    ).length;

    if (incompleteCount > 0) {
      setShowIncompleteModal(true);
    } else {
      setAllowPartial(false);
      setShowFinalizeModal(true);
    }
  };

  // Xác nhận hoàn thành một phần từ modal
  const handleConfirmPartial = () => {
    setShowIncompleteModal(false);
    setAllowPartial(true);
    setShowFinalizeModal(true);
  };

  // Submit Finalize RPC
  const handleSubmitFinalize = async () => {
    setIsFinalizing(true);
    setFinalizeError(null);

    const idempotencyKey = `fin_${run.id}_${Date.now()}`;

    try {
      const res = await finalizeWorkoutRunAction({
        run_id: run.id,
        expected_version: run.version,
        perceived_exertion: exertion,
        notes: finishNotes.trim() || null,
        idempotency_key: idempotencyKey,
        allow_partial: allowPartial,
      });

      if (!res.success) {
        setFinalizeError(res.message || 'Lỗi khi hoàn tất buổi tập.');
        setIsFinalizing(false);
        return;
      }

      if (soundEnabled) {
        try {
          workoutSound.playWorkoutFinishedFanfare();
        } catch {
          // safe
        }
      }

      // Cập nhật trạng thái run sang completed và render trực tiếp kết quả
      setRun((prev) => ({
        ...prev,
        status: 'completed',
        completed_at: new Date().toISOString(),
        duration_seconds: elapsedSeconds,
        perceived_exertion_1_10: exertion,
        notes: finishNotes.trim() || null,
      }));

      setShowFinalizeModal(false);
    } catch (err) {
      setFinalizeError(err instanceof Error ? err.message : 'Lỗi kết nối.');
      setIsFinalizing(false);
    }
  };

  // Nếu buổi tập đã completed -> hiển thị Result Summary
  if (isCompleted) {
    return <WorkoutResultSummary run={run} sets={sets} />;
  }

  const timeFormatted = formatWorkoutTime(elapsedSeconds);
  const completedSetsCount = sets.filter((s) => s.status === 'completed' && hasWorkoutSetActual(s)).length;
  const totalSetsCount = sets.length;

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-20 animate-fadeIn">
      {/* 1. Thanh điều khiển trên cùng (Toolbar) */}
      <div className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md p-4 rounded-2xl border border-slate-800 shadow-xl flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'
              }`}
            />
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-300">
              {isPaused ? 'Đang tạm dừng' : 'Đang tập trực tiếp'}
            </span>
          </div>
          <h1 className="text-sm font-bold text-white truncate max-w-[200px] sm:max-w-xs">
            {run.session_title}
          </h1>
        </div>

        {/* Stopwatch & Action buttons */}
        <div className="flex items-center gap-2">
          {/* Mute button */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
            title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500" />
            )}
          </button>

          {/* Pause / Resume Button */}
          <button
            type="button"
            onClick={handleTogglePause}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition ${
              isPaused
                ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700'
            }`}
          >
            {isPaused ? (
              <>
                <Play className="w-3.5 h-3.5 fill-amber-300" />
                <span>Tiếp tục</span>
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Tạm dừng</span>
              </>
            )}
          </button>

          {/* Stopwatch display */}
          <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 font-mono text-sm font-bold text-white flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span>{timeFormatted}</span>
          </div>
        </div>
      </div>

      {/* Cảnh báo offline / outbox nếu có */}
      {!isOnline && (
        <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-900/40 text-xs text-amber-300 flex items-center justify-between">
          <span>⚠️ Mất kết nối internet. Dữ liệu sẽ lưu cục bộ và gửi lại khi online.</span>
          <button
            type="button"
            onClick={triggerSyncOutbox}
            disabled={isSyncing}
            className="text-[11px] underline font-medium hover:text-white"
          >
            {isSyncing ? 'Đang đồng bộ...' : 'Thử lại'}
          </button>
        </div>
      )}

      {/* 2. Banner Bộ đếm thời gian nghỉ (Rest Timer) */}
      {isResting && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/50 via-slate-900 to-emerald-950/50 border border-emerald-500/30 shadow-lg flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 flex items-center justify-center">
              <svg className="w-12 h-12 -rotate-90">
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-slate-800"
                  fill="transparent"
                />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-emerald-400 transition-all duration-1000"
                  fill="transparent"
                  strokeDasharray={125.6}
                  strokeDashoffset={125.6 * (1 - restSecondsLeft / Math.max(1, initialRestSeconds))}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute text-sm font-mono font-bold text-emerald-400">
                {restSecondsLeft}s
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-400">
                Thời gian nghỉ giữa hiệp
              </span>
              <p className="text-xs text-slate-300">Thả lỏng cơ và hít thở sâu chuẩn bị hiệp tới</p>
            </div>
          </div>

          <button
            type="button"
            onClick={skipRest}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
          >
            Bỏ qua nghỉ
          </button>
        </div>
      )}

      {/* 3. Danh sách các bài tập & hiệp */}
      <div className="space-y-6">
        {exercisesSnapshot.map((ex, exIndex) => {
          const exerciseSets = sets.filter((s) => s.exercise_index === exIndex);

          return (
            <div
              key={`${ex.name}_${exIndex}`}
              className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3 shadow-md"
            >
              <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">
                      {exIndex + 1}
                    </span>
                    <span>{ex.name}</span>
                  </h3>
                  {ex.note && <p className="text-[11px] text-slate-400 mt-0.5">{ex.note}</p>}
                </div>

                <span className="text-[11px] text-slate-400 shrink-0 font-medium bg-slate-800 px-2 py-0.5 rounded-md">
                  {ex.sets} hiệp • Nghỉ {ex.rest_seconds || 60}s
                </span>
              </div>

              {/* Huy hiệu thành tích lần trước + Nút sao chép */}
              <PreviousRecordBadge
                exerciseName={ex.name}
                variant={ex.variant}
                unit={ex.unit}
                assistance={ex.assistance}
                onApplyPreviousSets={(prevSets) => handleApplyPreviousSets(exIndex, prevSets)}
              />

              {/* Danh sách từng hiệp của bài tập này */}
              <div className="space-y-2 pt-1">
                {exerciseSets.map((s) => (
                  <ExerciseSetRow
                    key={s.id}
                    set={s}
                    syncState={syncStates[s.idempotency_key]?.state || 'draft'}
                    syncError={syncStates[s.idempotency_key]?.error || null}
                    disabled={isPaused}
                    onSaveSet={(data) => handleSaveSet(s, data)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Nút bấm Hoàn thành buổi tập ở chân trang */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4">
        <div>
          <span className="text-xs text-slate-400">Tiến độ buổi tập</span>
          <div className="text-sm font-bold text-white">
            Đã tập {completedSetsCount} / {totalSetsCount} hiệp
          </div>
        </div>

        <button
          type="button"
          onClick={handleInitiateFinish}
          className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center gap-2 transition shadow-lg shadow-emerald-900/30"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Hoàn thành buổi tập</span>
        </button>
      </div>

      {/* Modal còn hiệp chưa nhập */}
      {showIncompleteModal && (
        <IncompleteSetsModal
          incompleteCount={sets.filter(isWorkoutSetIncomplete).length}
          totalCount={sets.length}
          onContinueWorkout={() => setShowIncompleteModal(false)}
          onConfirmPartial={handleConfirmPartial}
          onClose={() => setShowIncompleteModal(false)}
        />
      )}

      {/* Modal Finalize (Mức mệt RPE & Ghi chú) */}
      {showFinalizeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <span>Hoàn tất ghi nhận buổi tập</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowFinalizeModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {allowPartial && (
              <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-900/40 text-xs text-amber-300">
                ⚠️ Buổi tập sẽ được ghi nhận <strong>Hoàn thành một phần</strong>. Các hiệp chưa tập được đánh dấu &apos;Bỏ qua&apos; và không ghi đè số 0.
              </div>
            )}

            {/* Slider RPE 1-10 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-300 flex items-center gap-1">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span>Mức mệt mỏi gắng sức (RPE 1 - 10):</span>
                </span>
                <span className="text-emerald-400 font-bold text-sm">{exertion}/10</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={exertion}
                onChange={(e) => setExertion(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-500 bg-slate-800 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 px-1">
                <span>1 (Rất nhẹ)</span>
                <span>5 (Vừa sức)</span>
                <span>10 (Kiệt sức)</span>
              </div>
            </div>

            {/* Ghi chú */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Ghi chú cá nhân (tùy chọn):</label>
              <textarea
                rows={3}
                placeholder="Cảm giác hôm nay, nhóm cơ bị mỏi, tiến bộ..."
                value={finishNotes}
                onChange={(e) => setFinishNotes(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {finalizeError && (
              <div className="p-2.5 rounded-xl bg-rose-950/30 border border-rose-900/40 text-xs text-rose-300">
                {finalizeError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowFinalizeModal(false)}
                disabled={isFinalizing}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
              >
                Hủy bỏ
              </button>

              <button
                type="button"
                onClick={handleSubmitFinalize}
                disabled={isFinalizing}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-emerald-900/30"
              >
                {isFinalizing ? (
                  <span>Đang lưu giao dịch...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Xác nhận hoàn thành</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
