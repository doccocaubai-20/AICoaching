'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
  Sparkles,
  ChevronRight,
  Flame,
} from 'lucide-react';
import { SessionEntity } from '@/contracts';
import { workoutSound } from '@/lib/sound/workout-sound';

interface LiveWorkoutModalProps {
  session: SessionEntity;
  onFinishWorkout: (data: {
    durationMinutes: number;
    perceivedExertion: number;
    notes: string;
    completedExercises: Array<{
      exercise_name: string;
      actual_sets: number;
      actual_reps: string;
    }>;
  }) => Promise<{ success?: boolean; message?: string } | void> | void;
  onClose: () => void;
}

interface ExerciseItem {
  name: string;
  sets: number;
  target_reps: string;
  rest_seconds: number;
  note?: string;
}

export function LiveWorkoutModal({
  session,
  onFinishWorkout,
  onClose,
}: LiveWorkoutModalProps) {
  const exercises: ExerciseItem[] = Array.isArray(session.exercises)
    ? (session.exercises as ExerciseItem[])
    : [];

  // Các giai đoạn: 'ready' (chuẩn bị) -> 'active' (đang tập) -> 'resting' (đang nghỉ giữa set) -> 'finished' (hoàn thành)
  const [phase, setPhase] = useState<'ready' | 'active' | 'resting' | 'finished'>('ready');
  const [currentExIndex, setCurrentExIndex] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Bộ đếm tổng thời gian buổi tập (tính bằng giây)
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [isStopwatchRunning, setIsStopwatchRunning] = useState(false);

  // Bộ đếm nghỉ giữa set (Rest Timer)
  const [restSecondsLeft, setRestSecondsLeft] = useState(60);
  const [initialRestSeconds, setInitialRestSeconds] = useState(60);

  // Countdown đếm ngược chuẩn bị 3 - 2 - 1
  const [readyCountdown, setReadyCountdown] = useState(3);

  // Kết quả sau buổi tập
  const [exertion, setExertion] = useState(7);
  const [finishNotes, setFinishNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Stopwatch effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isStopwatchRunning && phase !== 'finished') {
      interval = setInterval(() => {
        setTotalSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isStopwatchRunning, phase]);

  // Countdown chuẩn bị bắt đầu
  useEffect(() => {
    if (phase === 'ready') {
      if (readyCountdown > 0) {
        if (soundEnabled) workoutSound.playCountdownBeep(500, 0.1);
        const timer = setTimeout(() => {
          setReadyCountdown((prev) => prev - 1);
        }, 1000);
        return () => clearTimeout(timer);
      } else {
        if (soundEnabled) workoutSound.playCountdownBeep(900, 0.25);
        setPhase('active');
        setIsStopwatchRunning(true);
      }
    }
  }, [phase, readyCountdown, soundEnabled]);

  // Rest Timer effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (phase === 'resting') {
      if (restSecondsLeft > 0) {
        if (restSecondsLeft <= 3 && soundEnabled) {
          workoutSound.playCountdownBeep(500, 0.1);
        }
        timer = setTimeout(() => {
          setRestSecondsLeft((prev) => prev - 1);
        }, 1000);
      } else {
        // Hết giờ nghỉ
        if (soundEnabled) workoutSound.playRestOverAlarm();
        handleFinishRest();
      }
    }
    return () => clearTimeout(timer);
  }, [phase, restSecondsLeft, soundEnabled]);

  const currentExercise = exercises[currentExIndex] || {
    name: 'Bài tập',
    sets: 3,
    target_reps: '10',
    rest_seconds: 60,
  };

  const handleCompleteSet = () => {
    if (soundEnabled) workoutSound.playSetCompleteDing();

    const isLastSetOfExercise = currentSet >= currentExercise.sets;
    const isLastExercise = currentExIndex >= exercises.length - 1;

    if (isLastSetOfExercise && isLastExercise) {
      // Đã hoàn thành toàn bộ buổi tập!
      if (soundEnabled) workoutSound.playWorkoutFinishedFanfare();
      setIsStopwatchRunning(false);
      setPhase('finished');
      return;
    }

    // Kích hoạt nghỉ
    const restTime = currentExercise.rest_seconds || 60;
    setInitialRestSeconds(restTime);
    setRestSecondsLeft(restTime);
    setPhase('resting');
  };

  const handleFinishRest = () => {
    const isLastSetOfExercise = currentSet >= currentExercise.sets;

    if (isLastSetOfExercise) {
      setCurrentExIndex((prev) => prev + 1);
      setCurrentSet(1);
    } else {
      setCurrentSet((prev) => prev + 1);
    }

    setPhase('active');
  };

  const handleSkipRest = () => {
    handleFinishRest();
  };

  const handleSaveWorkout = async () => {
    setIsSubmitting(true);
    setSaveError(null);
    try {
      const durationMin = Math.max(1, Math.round(totalSeconds / 60));
      // [E9] Không lưu nguyên dải mục tiêu (ví dụ "8–12") thành actual_reps; trích xuất số reps đơn cụ thể
      const completedList = exercises.map((ex) => {
        let repsVal = '10';
        if (ex.target_reps) {
          const match = String(ex.target_reps).match(/\d+/);
          if (match) repsVal = match[0];
        }
        return {
          exercise_name: ex.name,
          actual_sets: ex.sets,
          actual_reps: (ex as any).actual_reps || repsVal,
        };
      });

      const res = await onFinishWorkout({
        durationMinutes: durationMin,
        perceivedExertion: exertion,
        notes: finishNotes.trim() || 'Hoàn thành qua Chế độ Live Companion ✨',
        completedExercises: completedList,
      });

      // [E8] Nếu lưu thất bại, giữ lại modal và hiển thị lỗi, KHÔNG gọi onClose()
      if (res && typeof res === 'object' && 'success' in res && res.success === false) {
        setSaveError(res.message || 'Lỗi khi lưu kết quả buổi tập. Vui lòng thử lại.');
        setIsSubmitting(false);
        return;
      }

      onClose();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Lỗi kết nối khi lưu kết quả.');
      setIsSubmitting(false);
    }
  };

  // Định dạng mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 text-white flex flex-col justify-between backdrop-blur-md">
      {/* 1. Header Toolbar */}
      <div className="p-4 flex items-center justify-between border-b border-white/10 max-w-lg mx-auto w-full">
        <div>
          <span className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-widest flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Chế Độ Tập Trực Tiếp (Live Workout)</span>
          </span>
          <h2 className="text-sm font-bold truncate max-w-[260px]">{session.title}</h2>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 transition"
            title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-rose-500/30 text-slate-300 hover:text-rose-300 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 2. Main Content View */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto w-full">
        {/* PHASE: READY (Chuẩn bị 3 - 2 - 1) */}
        {phase === 'ready' && (
          <div className="space-y-6 animate-scale-in">
            <div className="w-28 h-28 rounded-full bg-emerald-500/20 border-4 border-emerald-400 flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/30">
              <span className="text-6xl font-black text-emerald-300 animate-ping">
                {readyCountdown}
              </span>
            </div>
            <div>
              <h3 className="text-xl font-black tracking-tight">Sẵn sàng nào!</h3>
              <p className="text-xs text-slate-400 mt-1">
                Chuẩn bị tư thế cho bài: <span className="text-emerald-300 font-bold">{currentExercise.name}</span>
              </p>
            </div>
          </div>
        )}

        {/* PHASE: ACTIVE (Đang thực hiện Set) */}
        {phase === 'active' && (
          <div className="space-y-6 w-full animate-fade-in">
            {/* Thanh tiến độ bài tập */}
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span>
                Bài {currentExIndex + 1}/{exercises.length}
              </span>
              <span className="font-mono text-emerald-400 font-bold">
                ⏱️ Tổng: {formatTime(totalSeconds)}
              </span>
            </div>

            {/* Thẻ Bài Tập Đang Diễn Ra */}
            <div className="bg-gradient-to-br from-slate-900 to-emerald-950/60 border border-emerald-500/30 rounded-3xl p-6 shadow-xl space-y-4">
              <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold">
                HIỆP (SET) {currentSet} / {currentExercise.sets}
              </span>

              <h1 className="text-2xl font-black text-white tracking-tight leading-snug">
                {currentExercise.name}
              </h1>

              <div className="p-4 bg-black/40 rounded-2xl border border-white/10 flex items-center justify-around">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase">Mục tiêu</span>
                  <p className="text-2xl font-black text-amber-300">{currentExercise.target_reps}</p>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div>
                  <span className="text-[10px] text-slate-400 uppercase">Nghỉ sau set</span>
                  <p className="text-2xl font-black text-teal-300">{currentExercise.rest_seconds}s</p>
                </div>
              </div>

              {currentExercise.note && (
                <p className="text-xs text-slate-400 italic">
                  💡 {currentExercise.note}
                </p>
              )}
            </div>

            {/* Nút bấm Hoàn thành Set */}
            <button
              onClick={handleCompleteSet}
              className="w-full py-5 px-6 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-base rounded-2xl flex items-center justify-center gap-3 transition shadow-lg shadow-emerald-500/25 active:scale-95"
            >
              <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
              <span>XONG HIỆP {currentSet} — BẮT ĐẦU NGHỈ 🎯</span>
            </button>
          </div>
        )}

        {/* PHASE: RESTING (Đồng hồ đếm nghỉ có âm thanh) */}
        {phase === 'resting' && (
          <div className="space-y-6 w-full animate-fade-in">
            <span className="text-xs font-bold text-amber-300 uppercase tracking-widest flex items-center justify-center gap-1">
              <Sparkles className="w-4 h-4" />
              <span>Đang nghỉ ngơi phục hồi</span>
            </span>

            {/* Đồng hồ tròn lớn */}
            <div className="relative w-44 h-44 mx-auto flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="88"
                  cy="88"
                  r="78"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-slate-800"
                  fill="transparent"
                />
                <circle
                  cx="88"
                  cy="88"
                  r="78"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-amber-400 transition-all duration-1000 ease-linear"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 78}
                  strokeDashoffset={
                    2 * Math.PI * 78 * (1 - restSecondsLeft / initialRestSeconds)
                  }
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-5xl font-black font-mono text-white">
                  {restSecondsLeft}
                </span>
                <span className="text-[11px] text-slate-400">giây</span>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Uống ngụm nước nhỏ, hít sâu bằng mũi và thả lỏng cơ thể...
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setRestSecondsLeft((prev) => prev + 15)}
                className="flex-1 py-2.5 px-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-semibold text-slate-200 transition"
              >
                +15 Giây Nghỉ
              </button>
              <button
                onClick={handleSkipRest}
                className="flex-1 py-2.5 px-3 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition"
              >
                <span>Bỏ Qua Nghỉ</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* PHASE: FINISHED (Hoàn thành buổi tập) */}
        {phase === 'finished' && (
          <div className="space-y-5 w-full animate-scale-in text-center">
            <div className="w-20 h-20 rounded-full bg-amber-400/20 border-2 border-amber-300 flex items-center justify-center mx-auto text-amber-300 shadow-xl shadow-amber-400/20">
              <Trophy className="w-10 h-10 animate-bounce" />
            </div>

            <div>
              <h1 className="text-2xl font-black text-white">XUẤT SẮC! HOÀN THÀNH BUỔI TẬP 🔥</h1>
              <p className="text-xs text-emerald-400 mt-1 font-semibold">
                Tổng thời lượng: {formatTime(totalSeconds)} | Hoàn thành {exercises.length} bài tập
              </p>
            </div>

            {/* Đánh giá cảm nhận RPE */}
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 text-left space-y-3">
              <div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-200">Mức mệt mỏi cảm nhận (RPE):</span>
                  <span className="font-extrabold text-amber-300">{exertion} / 10</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={exertion}
                  onChange={(e) => setExertion(parseInt(e.target.value, 10))}
                  className="w-full mt-2 accent-amber-400 cursor-pointer"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Ghi chú cảm nhận sau buổi tập:
                </label>
                <input
                  type="text"
                  value={finishNotes}
                  onChange={(e) => setFinishNotes(e.target.value)}
                  placeholder="Ví dụ: Lực kéo hôm nay rất tốt, set cuối hơi đuối vai..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>
            </div>

            {saveError && (
              <div className="p-3 bg-rose-950/80 border border-rose-600 rounded-xl text-rose-200 text-xs text-left">
                <p className="font-bold">⚠️ Không thể lưu kết quả:</p>
                <p className="mt-0.5">{saveError}</p>
                <p className="mt-1 text-[11px] text-rose-300">Dữ liệu của bạn được giữ nguyên. Vui lòng bấm lưu lại để thử lại.</p>
              </div>
            )}

            <button
              onClick={handleSaveWorkout}
              disabled={isSubmitting}
              className="w-full py-4 px-6 bg-gradient-to-r from-amber-400 to-emerald-400 text-slate-950 font-black text-sm rounded-2xl shadow-xl flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-50"
            >
              <Sparkles className="w-5 h-5" />
              <span>{isSubmitting ? 'Đang lưu vào hồ sơ...' : 'Lưu Kết Quả & Nhận XP Kỹ Năng ✨'}</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. Footer Status */}
      <div className="p-3 text-center border-t border-white/5 text-[10px] text-slate-500">
        CalisCoaching Smart Audio Engine • Tự động đếm nghỉ chuẩn hóa
      </div>
    </div>
  );
}
