/**
 * CALISCOACHING MVP - HỢP ĐỒNG GỢI Ý XEM LẠI LỊCH (REVIEW SUGGESTION CONTRACT)
 * Cung cấp cho Agent D (Quy tắc demo) và Agent C (Nhật ký).
 *
 * NGUYÊN TẮC:
 * 1. Đây chỉ là quy tắc demo tĩnh (ví dụ: phát hiện 2 hoạt động nặng sát nhau).
 * 2. TUYỆT ĐỐI KHÔNG TỰ ĐỘNG THAY ĐỔI TẢI TẬP CỦA NGƯỜI DÙNG.
 * 3. TUYỆT ĐỐI KHÔNG KẾT LUẬN VỀ TRẠNG THÁI PHỤC HỒI THỂ LỰC HOẶC Y TẾ.
 * 4. Khi dữ liệu hoạt động nguồn thay đổi/bị xóa, gợi ý liên quan PHẢI được đánh dấu 'outdated'.
 */

import { ReviewSuggestionStatus } from './database.types';

export interface ReviewSuggestionEntity {
  id: string;
  user_id: string;
  status: ReviewSuggestionStatus;
  reason: string;
  reference_activity_ids: string[];
  rule_version: string;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface EvaluateScheduleRuleInput {
  user_id: string;
  recent_activity_ids: string[];
  time_window_hours: number;
}
