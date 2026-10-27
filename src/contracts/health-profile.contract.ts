/**
 * CALISCOACHING - HỢP ĐỒNG HỒ SƠ SỨC KHỎE NỀN (HEALTH PROFILE CONTRACT)
 * Quản lý thông tin nền cá nhân: năm sinh, bối cảnh công việc, múi giờ.
 */

import { WorkContext } from './database.types';

export interface HealthProfileEntity {
  id: string;
  user_id: string;
  birth_year: number | null;
  work_context: WorkContext | null;
  timezone: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateHealthProfileInput {
  birth_year?: number | null;
  work_context?: WorkContext | null;
  timezone?: string;
  notes?: string | null;
}

export interface HealthProfileValidationResult {
  is_valid: boolean;
  errors: Record<string, string>;
}

export function validateHealthProfileInput(input: Partial<UpdateHealthProfileInput>): HealthProfileValidationResult {
  const errors: Record<string, string> = {};

  if (input.birth_year !== undefined && input.birth_year !== null) {
    const currentYear = new Date().getFullYear();
    if (typeof input.birth_year !== 'number' || input.birth_year < 1900 || input.birth_year > currentYear) {
      errors.birth_year = `Năm sinh phải nằm trong khoảng từ 1900 đến ${currentYear}.`;
    }
  }

  const validWorkContexts: WorkContext[] = ['sedentary', 'standing_walking', 'physical_labor', 'other'];
  if (input.work_context !== undefined && input.work_context !== null) {
    if (!validWorkContexts.includes(input.work_context)) {
      errors.work_context = 'Bối cảnh công việc không hợp lệ.';
    }
  }

  if (input.timezone !== undefined && input.timezone !== null) {
    if (typeof input.timezone !== 'string' || input.timezone.trim().length === 0) {
      errors.timezone = 'Múi giờ không được để trống.';
    }
  }

  return {
    is_valid: Object.keys(errors).length === 0,
    errors,
  };
}
