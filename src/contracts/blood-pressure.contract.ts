/**
 * CALISCOACHING - HỢP ĐỒNG ĐO HUYẾT ÁP (BLOOD PRESSURE CONTRACT)
 * Lưu trữ hai thành phần tâm thu (systolic) và tâm trương (diastolic) trong cùng 1 lần đo.
 * Đơn vị: mmHg.
 */

import { BloodPressureSource } from './database.types';

export interface BloodPressureEntity {
  id: string;
  user_id: string;
  systolic: number;
  diastolic: number;
  measured_at: string;
  source: BloodPressureSource;
  notes: string | null;
  created_at: string;
}

export interface CreateBloodPressureInput {
  systolic: number;
  diastolic: number;
  measured_at?: string;
  source?: BloodPressureSource;
  notes?: string | null;
}

export interface BloodPressureValidationResult {
  is_valid: boolean;
  errors: Record<string, string>;
}

export function validateBloodPressureInput(input: Partial<CreateBloodPressureInput>): BloodPressureValidationResult {
  const errors: Record<string, string> = {};

  if (typeof input.systolic !== 'number' || isNaN(input.systolic)) {
    errors.systolic = 'Huyết áp tâm thu phải là một số hợp lệ.';
  } else if (input.systolic < 40 || input.systolic > 300) {
    errors.systolic = 'Huyết áp tâm thu phải nằm trong khoảng từ 40 đến 300 mmHg.';
  }

  if (typeof input.diastolic !== 'number' || isNaN(input.diastolic)) {
    errors.diastolic = 'Huyết áp tâm trương phải là một số hợp lệ.';
  } else if (input.diastolic < 20 || input.diastolic > 200) {
    errors.diastolic = 'Huyết áp tâm trương phải nằm trong khoảng từ 20 đến 200 mmHg.';
  }

  if (
    typeof input.systolic === 'number' &&
    typeof input.diastolic === 'number' &&
    !errors.systolic &&
    !errors.diastolic &&
    input.systolic <= input.diastolic
  ) {
    errors.systolic = 'Huyết áp tâm thu phải lớn hơn huyết áp tâm trương.';
  }

  const validSources: BloodPressureSource[] = ['self_reported', 'manual_import', 'imported_from_document'];
  if (input.source && !validSources.includes(input.source)) {
    errors.source = 'Nguồn dữ liệu không hợp lệ.';
  }

  return {
    is_valid: Object.keys(errors).length === 0,
    errors,
  };
}
