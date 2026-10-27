/**
 * CALISCOACHING MVP - HỢP ĐỒNG NHẬT KÝ HOẠT ĐỘNG (ACTIVITY CONTRACT)
 * Cung cấp cho Agent C (Nhật ký), Agent D (Calisthenics & Quy tắc) và Agent E (AI).
 *
 * NGUYÊN TẮC:
 * 1. Phân biệt rõ hoạt động thực tế (is_planned = false) và lịch dự kiến (is_planned = true).
 * 2. Ghi chú (notes) là dữ liệu người dùng tự do nhập (UNTRUSTED INPUT), không đáng tin cậy.
 * 3. Hỗ trợ các môn: calisthenics, running, badminton, walking, other.
 */

import { ActivityType, ActivitySource } from './database.types';

// Database có CHECK tương ứng (migration 20261027000004)
export const MAX_ACTIVITY_DURATION_MINUTES = 1440;

export interface ActivityEntity {
  id: string;
  user_id: string;
  activity_type: ActivityType;
  is_planned: boolean;
  start_at: string;
  duration_minutes: number;
  fatigue_level: number | null; // Mức mệt mỏi từ 1 (rất nhẹ) đến 10 (cực kỳ kiệt sức)
  notes: string | null;
  source: ActivitySource;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
}

export interface CreateActivityInput {
  activity_type: ActivityType;
  is_planned?: boolean;
  start_at: string;
  duration_minutes: number;
  fatigue_level?: number | null;
  notes?: string | null;
  source?: ActivitySource;
  // Sinh bằng newIdempotencyKey() một lần khi mở form; lưu lặp gửi lại đúng khóa này.
  // Database có UNIQUE (user_id, idempotency_key).
  idempotency_key: string;
}

export interface UpdateActivityInput {
  activity_type?: ActivityType;
  is_planned?: boolean;
  start_at?: string;
  duration_minutes?: number;
  fatigue_level?: number | null;
  notes?: string | null;
}

export function validateActivityInput(input: Partial<CreateActivityInput>): { is_valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  const validTypes: ActivityType[] = ['calisthenics', 'running', 'badminton', 'walking', 'other'];
  if (!input.activity_type || !validTypes.includes(input.activity_type)) {
    errors.activity_type = 'Loại hoạt động không hợp lệ.';
  }

  if (!input.start_at || isNaN(Date.parse(input.start_at))) {
    errors.start_at = 'Thời gian bắt đầu không hợp lệ (phải theo chuẩn ISO-8601).';
  }

  if (typeof input.duration_minutes !== 'number' || input.duration_minutes <= 0) {
    errors.duration_minutes = 'Thời lượng tập luyện phải là số phút lớn hơn 0.';
  } else if (input.duration_minutes > MAX_ACTIVITY_DURATION_MINUTES) {
    errors.duration_minutes = `Thời lượng một hoạt động không được vượt quá ${MAX_ACTIVITY_DURATION_MINUTES} phút (24 giờ).`;
  }

  if (input.fatigue_level !== undefined && input.fatigue_level !== null) {
    if (
      typeof input.fatigue_level !== 'number' ||
      input.fatigue_level < 1 ||
      input.fatigue_level > 10 ||
      !Number.isInteger(input.fatigue_level)
    ) {
      errors.fatigue_level = 'Mức mệt mỏi phải là số nguyên từ 1 đến 10.';
    }
  }

  return {
    is_valid: Object.keys(errors).length === 0,
    errors,
  };
}
