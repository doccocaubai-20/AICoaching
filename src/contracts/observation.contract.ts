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

  if (typeof input.metric_value !== 'number' || !Number.isFinite(input.metric_value) || input.metric_value <= 0) {
    errors.metric_value = 'Giá trị chỉ số phải là một số hữu hạn dương lớn hơn 0.';
  }

  if (!input.metric_unit || input.metric_unit.trim().length === 0) {
    errors.metric_unit = 'Đơn vị chỉ số không được để trống.';
  } else {
    const unit = input.metric_unit.trim().toLowerCase();
    if (input.metric_type === 'weight' && !['kg', 'lbs'].includes(unit)) {
      errors.metric_unit = 'Đơn vị cân nặng phải là kg hoặc lbs.';
    } else if (input.metric_type === 'height' && !['cm', 'm'].includes(unit)) {
      errors.metric_unit = 'Đơn vị chiều cao phải là cm hoặc m.';
    } else if (input.metric_type === 'waist_circumference' && !['cm', 'inch'].includes(unit)) {
      errors.metric_unit = 'Đơn vị vòng eo phải là cm hoặc inch.';
    } else if (input.metric_type === 'resting_heart_rate' && unit !== 'bpm') {
      errors.metric_unit = 'Đơn vị nhịp tim phải là bpm.';
    }
  }

  return {
    is_valid: Object.keys(errors).length === 0,
    errors,
  };
}
