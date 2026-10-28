'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  WorkoutOutboxItem,
  WorkoutSetSyncState,
} from '../contracts/workout.contract';
import {
  getOutboxForUser,
  saveOutboxForUser,
  addToOutboxForUser,
  removeFromOutboxForUser,
} from './workout-storage';
import { saveWorkoutSetAction } from '../server/workout-actions';

export function useWorkoutOutbox(userId: string) {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const isSyncingRef = useRef(false);

  // Lắng nghe mạng online / offline
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      triggerSyncOutbox();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [userId]);

  // Hàm đồng bộ tất cả các mục còn trong outbox lên server
  const triggerSyncOutbox = useCallback(async () => {
    if (!userId || isSyncingRef.current || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      return;
    }

    const items = getOutboxForUser(userId);
    if (items.length === 0) return;

    isSyncingRef.current = true;
    setIsSyncing(true);

    try {
      for (const item of items) {
        try {
          const res = await saveWorkoutSetAction({
            run_id: item.runId,
            exercise_index: item.exerciseIndex,
            exercise_name: item.exerciseName,
            exercise_variant: item.exerciseVariant || null,
            set_order: item.setOrder,
            target_reps: item.targetReps,
            target_load: item.targetLoad ?? null,
            target_duration_seconds: item.targetDurationSeconds ?? null,
            target_assistance: item.targetAssistance ?? null,
            target_unit: item.targetUnit || 'reps',
            actual_reps: item.actualReps,
            actual_load: item.actualLoad ?? null,
            actual_duration_seconds: item.actualDurationSeconds ?? null,
            actual_unit: item.actualUnit || 'reps',
            actual_assistance: item.actualAssistance ?? null,
            status: item.status,
            idempotency_key: item.idempotencyKey,
          });

          if (res.success) {
            removeFromOutboxForUser(userId, item.idempotencyKey);
          }
        } catch {
          // Gặp lỗi mạng giữa chừng, dừng lại đợi lần reconnect sau
          break;
        }
      }
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [userId]);

  /**
   * Lưu hiệp tập:
   * 1. Thử gửi server ngay
   * 2. Nếu thành công -> trả về saved
   * 3. Nếu lỗi mạng hoặc offline -> thêm vào outbox, trả về failed với ghi chú offline
   */
  const saveSetWithOutbox = useCallback(
    async (item: WorkoutOutboxItem): Promise<{
      syncState: WorkoutSetSyncState;
      message?: string;
    }> => {
      // 1. Nếu đang offline, lưu ngay vào outbox
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        addToOutboxForUser(userId, item);
        return {
          syncState: 'failed',
          message: 'Ngoại tuyến: Đã lưu vào hàng chờ thiết bị. Sẽ tự động gửi lại khi có mạng.',
        };
      }

      // 2. Thử gửi lên server
      try {
        const res = await saveWorkoutSetAction({
          run_id: item.runId,
          exercise_index: item.exerciseIndex,
          exercise_name: item.exerciseName,
          exercise_variant: item.exerciseVariant || null,
          set_order: item.setOrder,
          target_reps: item.targetReps,
          target_load: item.targetLoad ?? null,
          target_duration_seconds: item.targetDurationSeconds ?? null,
          target_assistance: item.targetAssistance ?? null,
          target_unit: item.targetUnit || 'reps',
          actual_reps: item.actualReps,
          actual_load: item.actualLoad ?? null,
          actual_duration_seconds: item.actualDurationSeconds ?? null,
          actual_unit: item.actualUnit || 'reps',
          actual_assistance: item.actualAssistance ?? null,
          status: item.status,
          idempotency_key: item.idempotencyKey,
        });

        if (res.success) {
          removeFromOutboxForUser(userId, item.idempotencyKey);
          return { syncState: 'saved' };
        } else {
          // Server từ chối logic (ví dụ validate lỗi) -> không thêm vào outbox mà báo lỗi
          return {
            syncState: 'failed',
            message: res.message || 'Lỗi từ máy chủ khi lưu hiệp.',
          };
        }
      } catch (err) {
        // Lỗi kết nối / network -> đưa vào outbox retry
        addToOutboxForUser(userId, item);
        return {
          syncState: 'failed',
          message: 'Lỗi mạng: Đã đưa vào hàng chờ ngoại tuyến. Bạn có thể bấm thử lại.',
        };
      }
    },
    [userId]
  );

  return {
    isOnline,
    isSyncing,
    saveSetWithOutbox,
    triggerSyncOutbox,
  };
}
