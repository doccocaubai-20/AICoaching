/**
 * CALISCOACHING MVP - TIỆN ÍCH CHƯƠNG TRÌNH & BUỔI TẬP (AGENT D)
 * Các hàm thuần xử lý phân tích bài tập, làm sạch kết quả và kiểm tra thời lượng.
 */

import { ExerciseItem, MAX_ACTIVITY_DURATION_MINUTES } from '@/contracts';

/**
 * Phân tích và làm sạch danh sách động tác từ trường exercises (JSONB).
 * Phòng ngừa lỗi định dạng khi đọc dữ liệu từ database, không tin tuyệt đối vào kiểu khai báo.
 */
export function parseExercises(raw: unknown): ExerciseItem[] {
  if (!raw) return [];

  let list: unknown = raw;
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(list)) return [];

  const result: ExerciseItem[] = [];

  for (const item of list) {
    if (!item || typeof item !== 'object') continue;

    const candidate = item as Record<string, unknown>;
    const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
    const sets = typeof candidate.sets === 'number' && candidate.sets > 0 ? candidate.sets : 0;
    const targetReps =
      typeof candidate.target_reps === 'string'
        ? candidate.target_reps.trim()
        : typeof candidate.target_reps === 'number'
        ? String(candidate.target_reps)
        : '';
    const restSeconds =
      typeof candidate.rest_seconds === 'number' && candidate.rest_seconds >= 0
        ? candidate.rest_seconds
        : 60;
    const note = typeof candidate.note === 'string' ? candidate.note.trim() : undefined;

    // Chỉ nhận động tác có tên và số hiệp hợp lệ
    if (name && sets > 0) {
      result.push({
        name,
        sets,
        target_reps: targetReps || '8-12',
        rest_seconds: restSeconds,
        note,
      });
    }
  }

  return result;
}

export interface RawExerciseResultInput {
  exercise_name: string;
  actual_sets?: number | string | null;
  actual_reps?: string | null;
}

export interface CleanedExerciseResult {
  exercise_name: string;
  actual_sets: number;
  actual_reps: string;
}

/**
 * Làm sạch danh sách kết quả động tác tự khai.
 * NGUYÊN TẮC: Động tác bỏ trống thì KHÔNG ghi 0, mà loại bỏ hoàn toàn khỏi completed_exercises.
 */
export function cleanCompletedExercises(rawInput: unknown): CleanedExerciseResult[] {
  if (!Array.isArray(rawInput)) return [];

  const cleaned: CleanedExerciseResult[] = [];

  for (const item of rawInput) {
    if (!item || typeof item !== 'object') continue;

    const row = item as RawExerciseResultInput;
    const name = typeof row.exercise_name === 'string' ? row.exercise_name.trim() : '';
    if (!name) continue;

    let setsNum: number | null = null;
    if (typeof row.actual_sets === 'number') {
      setsNum = row.actual_sets;
    } else if (typeof row.actual_sets === 'string' && row.actual_sets.trim() !== '') {
      const parsed = parseInt(row.actual_sets, 10);
      if (!isNaN(parsed)) setsNum = parsed;
    }

    const repsStr = typeof row.actual_reps === 'string' ? row.actual_reps.trim() : '';

    // Nếu người dùng không nhập số hiệp hoặc không nhập số lần, hoặc số hiệp <= 0: bỏ qua, không ghi 0
    if (setsNum === null || setsNum <= 0 || !repsStr || repsStr === '0') {
      continue;
    }

    cleaned.push({
      exercise_name: name,
      actual_sets: setsNum,
      actual_reps: repsStr,
    });
  }

  return cleaned;
}

/**
 * Đọc mức gắng sức tự khai từ form. Bỏ trống → null (không suy ra giá trị).
 * Chỉ nhận số nguyên 1-10, khớp CHECK fatigue_level của bảng activities;
 * "7.5" bị từ chối thay vì bị cắt thành 7.
 */
export function parsePerceivedExertion(raw: unknown): { value: number | null; error?: string } {
  if (raw === null || raw === undefined) return { value: null };
  if (typeof raw !== 'string' && typeof raw !== 'number') {
    return { value: null, error: 'Mức gắng sức không hợp lệ.' };
  }
  const text = String(raw).trim();
  if (text === '') return { value: null };

  const value = Number(text);
  if (!Number.isInteger(value) || value < 1 || value > 10) {
    return { value: null, error: 'Mức gắng sức phải là số nguyên từ 1 đến 10.' };
  }
  return { value };
}

/**
 * Kiểm tra thời lượng buổi tập hợp lệ.
 * Giới hạn nghiệp vụ: 1 <= duration <= MAX_ACTIVITY_DURATION_MINUTES (1440 phút / 24h).
 */
export function validateSessionDuration(
  durationMinutes: number | unknown
): { isValid: boolean; error?: string } {
  if (typeof durationMinutes !== 'number' || isNaN(durationMinutes)) {
    return {
      isValid: false,
      error: 'Thời lượng tập luyện phải là một con số.',
    };
  }

  if (!Number.isInteger(durationMinutes)) {
    return {
      isValid: false,
      error: 'Thời lượng tập luyện phải là số nguyên phút (không nhập số thập phân).',
    };
  }

  if (durationMinutes <= 0) {
    return {
      isValid: false,
      error: 'Thời lượng tập luyện phải lớn hơn 0 phút.',
    };
  }

  if (durationMinutes > MAX_ACTIVITY_DURATION_MINUTES) {
    return {
      isValid: false,
      error: `Thời lượng một buổi tập không được vượt quá ${MAX_ACTIVITY_DURATION_MINUTES} phút (24 giờ).`,
    };
  }

  return { isValid: true };
}
