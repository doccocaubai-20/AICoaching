/**
 * CALISCOACHING MVP - HỢP ĐỒNG DỮ LIỆU HỒ SƠ (PROFILE CONTRACT)
 * Phụ trách bởi Agent A; cung cấp cho Agent B (Hồ sơ và dashboard) và Agent F.
 * Quy tắc: Người dùng chỉ đọc/sửa dữ liệu của mình. Không yêu cầu bệnh án.
 */

import { ExperienceLevel, Json } from './database.types';

export interface ProfileScheduleDay {
  day_of_week: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  available_time_slots: string[]; // ví dụ: ["17:30 - 18:30"]
}

export interface ProfileEntity {
  user_id: string;
  display_name: string;
  experience_level: ExperienceLevel;
  schedule_availability: ProfileScheduleDay[] | Json;
  available_equipment: string[]; // ví dụ: ["xà đơn", "dây kháng lực", "sàn nhà"]
  created_at: string;
  updated_at: string;
}

export interface UpdateProfileInput {
  display_name: string;
  experience_level: ExperienceLevel;
  schedule_availability?: ProfileScheduleDay[] | Json;
  available_equipment?: string[];
}

export interface ProfileValidationResult {
  is_valid: boolean;
  errors: Record<string, string>;
}

export function validateProfileInput(input: Partial<UpdateProfileInput>): ProfileValidationResult {
  const errors: Record<string, string> = {};

  if (!input.display_name || input.display_name.trim().length === 0) {
    errors.display_name = 'Tên hiển thị không được để trống.';
  } else if (input.display_name.length > 100) {
    errors.display_name = 'Tên hiển thị không được vượt quá 100 ký tự.';
  }

  const validLevels: ExperienceLevel[] = ['beginner', 'intermediate', 'advanced'];
  if (!input.experience_level || !validLevels.includes(input.experience_level)) {
    errors.experience_level = 'Cấp độ kinh nghiệm phải là người mới, trung cấp hoặc nâng cao.';
  }

  return {
    is_valid: Object.keys(errors).length === 0,
    errors,
  };
}
