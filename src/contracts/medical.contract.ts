/**
 * CALISCOACHING - HỢP ĐỒNG THÔNG TIN Y TẾ, DỊ ỨNG, THUỐC & SỰ KIỆN KHÁM (MEDICAL CONTRACT)
 * 
 * NGUYÊN TẮC QUAN TRỌNG:
 * 1. Phân biệt rõ ràng bệnh được người dùng khai là đã được chẩn đoán (diagnosed_condition)
 *    với triệu chứng tự ghi nhận (self_reported_symptom). Ứng dụng TUYỆT ĐỐI KHÔNG xác nhận chẩn đoán y tế.
 * 2. Dị ứng có trạng thái "chưa biết/chưa khai" (unknown_or_unrecorded), KHÔNG tự suy thành "không có dị ứng".
 * 3. Hướng dẫn dùng thuốc được lưu nguyên văn do người dùng nhập. KHÔNG tự đổi sang đã ngừng chỉ vì ngày cũ.
 */

import {
  ConditionCategory,
  ConditionStatus,
  AllergyStatus,
  AllergySeverity,
  MedicationStatus,
  HealthEventType,
} from './database.types';

// ==============================================================================
// 1. TÌNH TRẠNG SỨC KHỎE (HEALTH CONDITIONS)
// ==============================================================================
export interface HealthConditionEntity {
  id: string;
  user_id: string;
  name: string;
  category: ConditionCategory;
  started_at: string | null;
  status: ConditionStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateHealthConditionInput {
  name: string;
  category: ConditionCategory;
  started_at?: string | null;
  status?: ConditionStatus;
  notes?: string | null;
}

export function validateHealthConditionInput(input: Partial<CreateHealthConditionInput>): { is_valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!input.name || input.name.trim().length === 0) {
    errors.name = 'Tên tình trạng sức khỏe không được để trống.';
  } else if (input.name.length > 200) {
    errors.name = 'Tên tình trạng sức khỏe không được vượt quá 200 ký tự.';
  }

  const validCategories: ConditionCategory[] = ['diagnosed_condition', 'injury', 'self_reported_symptom'];
  if (!input.category || !validCategories.includes(input.category)) {
    errors.category = 'Phân loại tình trạng sức khỏe không hợp lệ.';
  }

  const validStatuses: ConditionStatus[] = ['active', 'resolved', 'monitoring'];
  if (input.status && !validStatuses.includes(input.status)) {
    errors.status = 'Trạng thái theo dõi không hợp lệ.';
  }

  return {
    is_valid: Object.keys(errors).length === 0,
    errors,
  };
}

// ==============================================================================
// 2. DỊ ỨNG (ALLERGIES)
// ==============================================================================
export interface AllergyEntity {
  id: string;
  user_id: string;
  allergen: string;
  reaction: string | null;
  severity: AllergySeverity | null;
  status: AllergyStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAllergyInput {
  allergen: string;
  reaction?: string | null;
  severity?: AllergySeverity | null;
  status?: AllergyStatus;
  notes?: string | null;
}

export function validateAllergyInput(input: Partial<CreateAllergyInput>): { is_valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!input.allergen || input.allergen.trim().length === 0) {
    errors.allergen = 'Tác nhân dị ứng không được để trống.';
  } else if (input.allergen.length > 150) {
    errors.allergen = 'Tên tác nhân dị ứng không được vượt quá 150 ký tự.';
  }

  const validStatuses: AllergyStatus[] = ['known', 'unknown_or_unrecorded'];
  if (input.status && !validStatuses.includes(input.status)) {
    errors.status = 'Trạng thái dị ứng không hợp lệ.';
  }

  const validSeverities: AllergySeverity[] = ['mild', 'moderate', 'severe'];
  if (input.severity && !validSeverities.includes(input.severity)) {
    errors.severity = 'Mức độ dị ứng không hợp lệ.';
  }

  return {
    is_valid: Object.keys(errors).length === 0,
    errors,
  };
}

// ==============================================================================
// 3. THUỐC ĐANG DÙNG (MEDICATIONS)
// ==============================================================================
export interface MedicationEntity {
  id: string;
  user_id: string;
  name: string;
  dosage_instructions: string | null;
  started_at: string | null;
  ended_at: string | null;
  status: MedicationStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMedicationInput {
  name: string;
  dosage_instructions?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  status?: MedicationStatus;
  notes?: string | null;
}

export function validateMedicationInput(input: Partial<CreateMedicationInput>): { is_valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!input.name || input.name.trim().length === 0) {
    errors.name = 'Tên thuốc không được để trống.';
  } else if (input.name.length > 200) {
    errors.name = 'Tên thuốc không được vượt quá 200 ký tự.';
  }

  const validStatuses: MedicationStatus[] = ['active', 'stopped'];
  if (input.status && !validStatuses.includes(input.status)) {
    errors.status = 'Trạng thái sử dụng thuốc không hợp lệ.';
  }

  if (input.started_at && input.ended_at) {
    if (new Date(input.ended_at).getTime() < new Date(input.started_at).getTime()) {
      errors.ended_at = 'Ngày kết thúc không được sớm hơn ngày bắt đầu dùng thuốc.';
    }
  }

  return {
    is_valid: Object.keys(errors).length === 0,
    errors,
  };
}

// ==============================================================================
// 4. SỰ KIỆN KHÁM BỆNH, XÉT NGHIỆM, TIÊM CHỦNG (HEALTH EVENTS)
// ==============================================================================
export interface HealthEventEntity {
  id: string;
  user_id: string;
  event_type: HealthEventType;
  event_date: string; // YYYY-MM-DD
  facility_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateHealthEventInput {
  event_type: HealthEventType;
  event_date: string;
  facility_name?: string | null;
  notes?: string | null;
}

export function validateHealthEventInput(input: Partial<CreateHealthEventInput>): { is_valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  const validTypes: HealthEventType[] = ['checkup', 'lab_test', 'vaccination', 'other'];
  if (!input.event_type || !validTypes.includes(input.event_type)) {
    errors.event_type = 'Loại sự kiện y tế không hợp lệ.';
  }

  if (!input.event_date || !/^\d{4}-\d{2}-\d{2}$/.test(input.event_date)) {
    errors.event_date = 'Ngày diễn ra sự kiện phải theo định dạng YYYY-MM-DD.';
  }

  return {
    is_valid: Object.keys(errors).length === 0,
    errors,
  };
}
