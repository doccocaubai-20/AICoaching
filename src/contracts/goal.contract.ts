/**
 * CALISCOACHING MVP - HỢP ĐỒNG MỤC TIÊU (GOAL CONTRACT)
 * Cung cấp cho Agent B (Hồ sơ và dashboard).
 */

import { GoalType, GoalStatus } from './database.types';

export interface GoalEntity {
  id: string;
  user_id: string;
  content: string;
  goal_type: GoalType;
  status: GoalStatus;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateGoalInput {
  content: string;
  goal_type: GoalType;
  start_date?: string | null;
  end_date?: string | null;
}

export interface UpdateGoalInput {
  content?: string;
  goal_type?: GoalType;
  status?: GoalStatus;
  start_date?: string | null;
  end_date?: string | null;
}

/**
 * Ngày kết thúc không được sớm hơn ngày bắt đầu (database có CHECK tương ứng).
 * Trả về thông báo lỗi hoặc null.
 */
export function validateGoalDates(startDate?: string | null, endDate?: string | null): string | null {
  if (startDate && endDate) {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    if (!isNaN(start) && !isNaN(end) && end < start) {
      return 'Ngày kết thúc phải diễn ra sau hoặc cùng ngày với ngày bắt đầu.';
    }
  }
  return null;
}

export function validateGoalInput(input: Partial<CreateGoalInput>): { is_valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!input.content || input.content.trim().length === 0) {
    errors.content = 'Nội dung mục tiêu không được để trống.';
  }

  const validTypes: GoalType[] = ['skill', 'endurance', 'habit', 'strength', 'other'];
  if (!input.goal_type || !validTypes.includes(input.goal_type)) {
    errors.goal_type = 'Loại mục tiêu không hợp lệ.';
  }

  const dateError = validateGoalDates(input.start_date, input.end_date);
  if (dateError) {
    errors.end_date = dateError;
  }

  return {
    is_valid: Object.keys(errors).length === 0,
    errors,
  };
}
