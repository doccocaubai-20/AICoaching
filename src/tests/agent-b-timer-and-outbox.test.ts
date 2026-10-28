import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateElapsedSeconds,
  formatWorkoutTime,
} from '../features/workout/contracts/workout.contract';
import {
  getOutboxForUser,
  addToOutboxForUser,
  removeFromOutboxForUser,
  clearSensitiveWorkoutCacheForUser,
  clearAllSensitiveWorkoutStorage,
  getOutboxStorageKey,
} from '../features/workout/hooks/workout-storage';

// Mock localStorage cho Node.js Vitest environment
const mockStorage: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, val: string) => {
    mockStorage[key] = val;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  },
  get length() {
    return Object.keys(mockStorage).length;
  },
  key: (i: number) => Object.keys(mockStorage)[i] || null,
};

describe('Agent B - D3: Timer Calculation & Offline Outbox', () => {
  beforeEach(() => {
    // Gán mock localStorage vào global
    (global as any).window = {};
    (global as any).localStorage = mockLocalStorage;
    mockLocalStorage.clear();
  });

  describe('1. Timer tính từ Timestamps + Paused Duration (Spec D3 mục 6)', () => {
    const T0 = 1700000000000; // Mốc giả lập 0 giây

    it('tính thời gian tập chính xác khi đang chạy (in_progress)', () => {
      const startedAt = new Date(T0).toISOString();
      const nowMs = T0 + 75000; // 75 giây sau
      const elapsed = calculateElapsedSeconds(startedAt, null, 0, nowMs);

      expect(elapsed).toBe(75);
      expect(formatWorkoutTime(elapsed)).toBe('01:15');
    });

    it('ĐÓNG BĂNG thời gian khi tạm dừng (paused) - Không tăng theo clock máy tính', () => {
      const startedAt = new Date(T0).toISOString();
      const pausedAt = new Date(T0 + 120000).toISOString(); // Tạm dừng tại phút thứ 2 (120s)

      // Giả sử client trôi thêm 10 phút (600s) sau đó trong trạng thái pause
      const nowMs = T0 + 720000;
      const elapsed = calculateElapsedSeconds(startedAt, pausedAt, 0, nowMs);

      // Timer vẫn đứng im ở 120 giây, TUYỆT ĐỐI KHÔNG TĂNG
      expect(elapsed).toBe(120);
      expect(formatWorkoutTime(elapsed)).toBe('02:00');
    });

    it('tiếp tục tính toán chính xác sau khi cộng dồn paused duration', () => {
      const startedAt = new Date(T0).toISOString();
      // Đã từng pause tổng cộng 180 giây (3 phút)
      const totalPausedDurationSeconds = 180;

      // Hiện tại là 600 giây kể từ T0
      const nowMs = T0 + 600000;
      // Thời gian tập thực tế = 600 - 180 = 420 giây (7 phút)
      const elapsed = calculateElapsedSeconds(startedAt, null, totalPausedDurationSeconds, nowMs);

      expect(elapsed).toBe(420);
      expect(formatWorkoutTime(elapsed)).toBe('07:00');
    });

    it('bảo toàn thời gian khi đóng tab hoặc tải lại trang (reload)', () => {
      const startedAt = new Date(T0).toISOString();
      const totalPaused = 60; // Nghỉ 60s
      const nowMs = T0 + 300000; // 300s kể từ lúc bắt đầu

      // Lần 1: trước khi đóng tab
      const elapsedBeforeClose = calculateElapsedSeconds(startedAt, null, totalPaused, nowMs);
      expect(elapsedBeforeClose).toBe(240); // 300 - 60 = 240s

      // Giả lập mở lại tab sau đó 10 giây (nowMs + 10000)
      const elapsedAfterReload = calculateElapsedSeconds(startedAt, null, totalPaused, nowMs + 10000);
      expect(elapsedAfterReload).toBe(250);
    });

    it('chặn thời lượng âm hoặc phi lý nếu client chỉnh sửa đồng hồ về quá khứ', () => {
      const startedAt = new Date(T0).toISOString();
      // Client lùi đồng hồ về trước thời điểm bắt đầu
      const tamperedClockMs = T0 - 50000;
      const elapsed = calculateElapsedSeconds(startedAt, null, 0, tamperedClockMs);

      // Tuyệt đối không ghi số âm, luôn an toàn >= 0
      expect(elapsed).toBe(0);
    });
  });

  describe('2. Phân tách Outbox theo User & An toàn khi chuyển tài khoản (Spec D3 mục 5)', () => {
    const USER_A = 'user-uuid-1111';
    const USER_B = 'user-uuid-2222';

    it('hàng đợi ngoại tuyến (outbox) được lưu tách biệt nghiêm ngặt theo userId', () => {
      const itemA = {
        idempotencyKey: 'key_a_set_1',
        runId: 'run-1',
        exerciseIndex: 0,
        exerciseName: 'Push-up',
        setOrder: 1,
        targetReps: '10',
        actualReps: 12,
        actualUnit: 'reps',
        status: 'completed' as const,
        timestamp: Date.now(),
      };

      addToOutboxForUser(USER_A, itemA);

      // User A có 1 item trong outbox
      const outboxA = getOutboxForUser(USER_A);
      expect(outboxA).toHaveLength(1);
      expect(outboxA[0].idempotencyKey).toBe('key_a_set_1');

      // User B hoàn toàn trống, không thấy bất kỳ item nào của User A
      const outboxB = getOutboxForUser(USER_B);
      expect(outboxB).toHaveLength(0);
    });

    it('chống trùng hàng đợi: thêm lại cùng idempotencyKey không làm nhân đôi item', () => {
      const item = {
        idempotencyKey: 'key_idempotent_1',
        runId: 'run-1',
        exerciseIndex: 0,
        exerciseName: 'Push-up',
        setOrder: 1,
        targetReps: '10',
        actualReps: 10,
        actualUnit: 'reps',
        status: 'completed' as const,
        timestamp: Date.now(),
      };

      addToOutboxForUser(USER_A, item);
      // Giả sử user sửa lại số reps thành 12 và bấm lưu lại cùng key
      addToOutboxForUser(USER_A, { ...item, actualReps: 12 });

      const outbox = getOutboxForUser(USER_A);
      expect(outbox).toHaveLength(1);
      expect(outbox[0].actualReps).toBe(12);
    });

    it('xóa item khi đã đồng bộ thành công lên server', () => {
      const item = {
        idempotencyKey: 'key_to_delete',
        runId: 'run-1',
        exerciseIndex: 0,
        exerciseName: 'Pull-up',
        setOrder: 1,
        targetReps: '8',
        actualReps: 8,
        actualUnit: 'reps',
        status: 'completed' as const,
        timestamp: Date.now(),
      };

      addToOutboxForUser(USER_A, item);
      expect(getOutboxForUser(USER_A)).toHaveLength(1);

      removeFromOutboxForUser(USER_A, 'key_to_delete');
      expect(getOutboxForUser(USER_A)).toHaveLength(0);
    });

    it('khi đăng xuất (logout), xóa sạch dữ liệu nhạy cảm của user đó, không rò rỉ sang user khác', () => {
      addToOutboxForUser(USER_A, {
        idempotencyKey: 'key_user_a',
        runId: 'run-a',
        exerciseIndex: 0,
        exerciseName: 'Squat',
        setOrder: 1,
        targetReps: '15',
        actualReps: 15,
        actualUnit: 'reps',
        status: 'completed',
        timestamp: Date.now(),
      });

      addToOutboxForUser(USER_B, {
        idempotencyKey: 'key_user_b',
        runId: 'run-b',
        exerciseIndex: 0,
        exerciseName: 'Dips',
        setOrder: 1,
        targetReps: '10',
        actualReps: 10,
        actualUnit: 'reps',
        status: 'completed',
        timestamp: Date.now(),
      });

      // User A đăng xuất -> dọn dẹp cache của A
      clearSensitiveWorkoutCacheForUser(USER_A);

      expect(getOutboxForUser(USER_A)).toHaveLength(0);
      // User B trên máy vẫn giữ nguyên hàng đợi chưa gửi của mình
      expect(getOutboxForUser(USER_B)).toHaveLength(1);
    });
  });
});
