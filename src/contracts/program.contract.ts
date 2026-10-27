/**
 * CALISCOACHING MVP - HỢP ĐỒNG BÀI TẬP CALISTHENICS MINH HỌA (PROGRAM CONTRACT)
 * Cung cấp cho Agent D (Calisthenics & Quy tắc) và Agent F (Tích hợp).
 *
 * CẢNH BÁO QUAN TRỌNG:
 * 1. Nội dung mang tính chất MINH HỌA KỸ THUẬT CHO BẢN DEMO.
 * 2. TUYỆT ĐỐI KHÔNG CÔNG BỐ LÀ GIÁO ÁN ĐÃ QUA THẨM ĐỊNH Y KHOA HAY THỂ THAO CHUYÊN NGHIỆP.
 * 3. Chống ghi trùng kết quả tập luyện qua idempotency_key.
 */

import { ProgramStatus, Json } from './database.types';

export interface ExerciseItem {
  name: string;
  sets: number;
  target_reps: string; // ví dụ: "8-12" hoặc "30s"
  rest_seconds: number;
  note?: string;
}

export interface ProgramEntity {
  id: string;
  user_id: string | null;
  title: string;
  version: string;
  status: ProgramStatus;
  description: string;
  is_demo: boolean;
  created_at: string;
}

export interface SessionEntity {
  id: string;
  program_id: string;
  user_id: string | null;
  title: string;
  sequence_order: number;
  exercises: ExerciseItem[] | Json;
  is_demo: boolean;
  created_at: string;
}

export interface RecordSessionResultInput {
  session_id: string;
  completed_at?: string;
  self_reported_data: {
    completed_exercises?: Array<{
      exercise_name: string;
      actual_sets: number;
      actual_reps: string;
    }>;
    perceived_exertion_1_10?: number;
    completion_rate_percent?: number;
  } | Json;
  notes?: string | null;
  idempotency_key: string; // Khóa chống trùng khi người dùng bấm lưu nhiều lần, sinh bằng newIdempotencyKey()
}

export interface SessionResultEntity {
  id: string;
  session_id: string;
  user_id: string;
  completed_at: string;
  self_reported_data: Json;
  notes: string | null;
  idempotency_key: string;
  is_demo: boolean;
  created_at: string;
}
