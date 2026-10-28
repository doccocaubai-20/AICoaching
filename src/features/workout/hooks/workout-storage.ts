/**
 * CALISCOACHING - WORKOUT OFFLINE STORAGE & OUTBOX UTILITIES
 * Đảm bảo:
 * 1. Phân tách cache/outbox cục bộ nghiêm ngặt theo userId (calis_workout_outbox_${userId})
 * 2. Tài khoản khác trên cùng trình duyệt không đọc/chạy lại queue của người trước
 * 3. Hỗ trợ dọn sạch toàn bộ cache nhạy cảm khi logout
 */

import { WorkoutOutboxItem } from '../contracts/workout.contract';

const OUTBOX_PREFIX = 'calis_workout_outbox_';
const DRAFT_PREFIX = 'calis_workout_draft_';

export function getOutboxStorageKey(userId: string): string {
  return `${OUTBOX_PREFIX}${userId}`;
}

export function getDraftStorageKey(userId: string, runId: string): string {
  return `${DRAFT_PREFIX}${userId}_${runId}`;
}

/**
 * Đọc hàng đợi outbox của một user cụ thể
 */
export function getOutboxForUser(userId: string): WorkoutOutboxItem[] {
  if (typeof window === 'undefined' || !userId) return [];
  try {
    const raw = localStorage.getItem(getOutboxStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Lưu toàn bộ danh sách outbox của user
 */
export function saveOutboxForUser(userId: string, items: WorkoutOutboxItem[]): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    localStorage.setItem(getOutboxStorageKey(userId), JSON.stringify(items));
  } catch (err) {
    console.warn('Không thể ghi outbox vào localStorage:', err);
  }
}

/**
 * Thêm một hiệp vào outbox ngoại tuyến (chống trùng idempotency_key)
 */
export function addToOutboxForUser(userId: string, item: WorkoutOutboxItem): void {
  const current = getOutboxForUser(userId);
  const filtered = current.filter((i) => i.idempotencyKey !== item.idempotencyKey);
  filtered.push(item);
  saveOutboxForUser(userId, filtered);
}

/**
 * Xóa một item khỏi outbox khi đã đồng bộ thành công lên server
 */
export function removeFromOutboxForUser(userId: string, idempotencyKey: string): void {
  const current = getOutboxForUser(userId);
  const updated = current.filter((i) => i.idempotencyKey !== idempotencyKey);
  saveOutboxForUser(userId, updated);
}

/**
 * Xóa toàn bộ outbox của user
 */
export function clearOutboxForUser(userId: string): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    localStorage.removeItem(getOutboxStorageKey(userId));
  } catch {
    // ignore
  }
}

/**
 * Xóa toàn bộ dữ liệu nháp và outbox của user khi logout
 */
export function clearSensitiveWorkoutCacheForUser(userId: string): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    localStorage.removeItem(getOutboxStorageKey(userId));
    // Quét và xóa các draft của user này
    const prefix = `${DRAFT_PREFIX}${userId}_`;
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

/**
 * Xóa toàn bộ cache nhạy cảm của mọi user trên thiết bị này
 */
export function clearAllSensitiveWorkoutStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith(OUTBOX_PREFIX) || key.startsWith(DRAFT_PREFIX))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}
