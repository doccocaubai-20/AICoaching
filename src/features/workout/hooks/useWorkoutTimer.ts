'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { calculateElapsedSeconds } from '../contracts/workout.contract';
import { workoutSound } from '@/lib/sound/workout-sound';

interface UseWorkoutTimerOptions {
  startedAt: string;
  pausedAt: string | null;
  totalPausedDurationSeconds: number;
  status: 'in_progress' | 'paused' | 'completed' | 'abandoned';
  soundEnabled?: boolean;
}

export function useWorkoutTimer({
  startedAt,
  pausedAt,
  totalPausedDurationSeconds,
  status,
  soundEnabled = true,
}: UseWorkoutTimerOptions) {
  // Clock state để vẽ lại UI mỗi giây
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Rest Timer state
  const [restSecondsLeft, setRestSecondsLeft] = useState<number>(0);
  const [initialRestSeconds, setInitialRestSeconds] = useState<number>(0);
  const [isResting, setIsResting] = useState<boolean>(false);

  // Tính số giây đã tập (active elapsed seconds)
  const elapsedSeconds = calculateElapsedSeconds(
    startedAt,
    pausedAt,
    totalPausedDurationSeconds,
    nowMs
  );

  // Interval chạy cập nhật UI khi active
  useEffect(() => {
    if (status !== 'in_progress') return;

    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  // Rest Timer countdown
  useEffect(() => {
    if (!isResting || restSecondsLeft <= 0) return;

    const timer = setInterval(() => {
      setRestSecondsLeft((prev) => {
        const next = prev - 1;
        if (next <= 3 && next > 0 && soundEnabled) {
          try {
            workoutSound.playCountdownBeep(500, 0.1);
          } catch {
            // bỏ qua
          }
        }
        if (next <= 0) {
          if (soundEnabled) {
            try {
              workoutSound.playRestOverAlarm();
            } catch {
              // bỏ qua
            }
          }
          setIsResting(false);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isResting, restSecondsLeft, soundEnabled]);

  const startRest = useCallback((seconds: number = 60) => {
    setInitialRestSeconds(seconds);
    setRestSecondsLeft(seconds);
    setIsResting(true);
  }, []);

  const skipRest = useCallback(() => {
    setRestSecondsLeft(0);
    setIsResting(false);
  }, []);

  return {
    elapsedSeconds,
    isResting,
    restSecondsLeft,
    initialRestSeconds,
    startRest,
    skipRest,
  };
}
