/**
 * CALISCOACHING MVP - HỢP ĐỒNG QUAN SÁT TỰ KHAI (OBSERVATION CONTRACT)
 * Cung cấp cho Agent B (Hồ sơ) và Agent E (AI).
 *
 * NGUYÊN TẮC QUAN TRỌNG:
 * 1. Chiều cao/cân nặng/chỉ số là người dùng TỰ KHAI (self-reported) theo ngày và nguồn.
 * 2. TUYỆT ĐỐI KHÔNG tính toán điểm sức khỏe tổng hợp.
 * 3. TUYỆT ĐỐI KHÔNG suy luận y khoa, chẩn đoán hay kết luận thể chất.
 */

import { MetricType, ObservationSource } from './database.types';

export interface ObservationEntity {
  id: string;
  user_id: string;
  metric_type: MetricType;
  metric_value: number;
  metric_unit: string;
  observed_at: string;
  source: ObservationSource;
  notes: string | null;
  created_at: string;
}

export interface CreateObservationInput {
  metric_type: MetricType;
  metric_value: number;
  metric_unit: string;
  observed_at?: string;
  notes?: string | null;
}

export function validateObservationInput(input: Partial<CreateObservationInput>): { is_valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  const validTypes: MetricType[] = ['weight', 'height', 'resting_heart_rate', 'body_feel', 'waist_circumference', 'other'];
  if (!input.metric_type || !validTypes.includes(input.metric_type)) {
    errors.metric_type = 'Loại chỉ số không hợp lệ.';
  }

  if (typeof input.metric_value !== 'number' || isNaN(input.metric_value) || input.metric_value <= 0) {
    errors.metric_value = 'Giá trị chỉ số phải là một số dương lớn hơn 0.';
  }

  if (!input.metric_unit || input.metric_unit.trim().length === 0) {
    errors.metric_unit = 'Đơn vị chỉ số không được để trống.';
  }

  return {
    is_valid: Object.keys(errors).length === 0,
    errors,
  };
}
