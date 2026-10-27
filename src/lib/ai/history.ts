/**
 * CALISCOACHING MVP - DỰNG LỊCH SỬ HỘI THOẠI AI AN TOÀN (AGENT E)
 * Hàm thuần xử lý danh sách tin nhắn hội thoại:
 * 1. Chỉ giữ lại tin nhắn có status = 'completed' (loại bỏ thông báo lỗi 'failed').
 * 2. Loại trừ tin nhắn vừa gửi (nếu có id) để chống lặp câu hỏi hiện tại.
 * 3. Thực thi phạm vi đồng ý (Scope of Consent):
 *    - Nếu scope rỗng: không gửi bất kỳ lịch sử nào ra ngoài.
 *    - Nếu người dùng thu hẹp scope (ví dụ bỏ observations), loại bỏ các tin nhắn
 *      chứa thông tin của loại dữ liệu bị rút lại (chống rò rỉ dữ liệu qua lịch sử cũ).
 */

import { AIMessageHistoryItem, AIReferenceSourceItem } from './types';
import { ConsentScopeItem } from '@/contracts';

export interface RawConversationMessage {
  id?: string;
  role: string;
  content: string;
  status?: string;
  created_at?: string;
  reference_sources?: unknown;
}

/**
 * Kiểm tra xem một tin nhắn có chứa hoặc tham chiếu đến loại dữ liệu bị loại khỏi scope hay không.
 */
function isMessageScopeCompliant(
  msg: RawConversationMessage,
  scope: ConsentScopeItem[]
): boolean {
  // 1. Kiểm tra mảng tham chiếu reference_sources nếu có
  const refs = (Array.isArray(msg.reference_sources) ? msg.reference_sources : []) as AIReferenceSourceItem[];
  for (const ref of refs) {
    if (ref && typeof ref.type === 'string') {
      if (ref.type === 'observation' && !scope.includes('observations')) return false;
      if (ref.type === 'activity' && !scope.includes('activities')) return false;
      if (ref.type === 'goal' && !scope.includes('goals')) return false;
      if (ref.type === 'profile' && !scope.includes('profile')) return false;
      if (ref.type === 'checkin' && !scope.includes('daily_checkins')) return false;
      if (ref.type === 'blood_pressure' && !scope.includes('blood_pressures')) return false;
    }
  }

  const lower = (msg.content || '').toLowerCase();

  // 2. Kiểm tra từ khóa nội dung nếu thiếu observations
  if (!scope.includes('observations')) {
    // Phát hiện số đo cân nặng / chiều cao ví dụ "65 kg", "cân nặng", "chiều cao"
    if (
      /\b\d+(?:[.,]\d+)?\s*(?:kg|kilogram|cm|mét)\b/i.test(lower) ||
      lower.includes('cân nặng') ||
      lower.includes('chiều cao')
    ) {
      return false;
    }
  }

  // 3. Kiểm tra từ khóa nội dung nếu thiếu activities
  if (!scope.includes('activities')) {
    if (
      /\b\d+\s*(?:buổi|phút)\b/i.test(lower) ||
      lower.includes('buổi tập') ||
      lower.includes('calisthenics') ||
      lower.includes('chạy bộ') ||
      lower.includes('cầu lông')
    ) {
      return false;
    }
  }

  // 4. Kiểm tra từ khóa nội dung nếu thiếu goals
  if (!scope.includes('goals')) {
    if (lower.includes('mục tiêu') || lower.includes('goal')) {
      return false;
    }
  }

  if (!scope.includes('daily_checkins')) {
    if (lower.includes('giấc ngủ') || lower.includes('ngủ') || lower.includes('mức năng lượng') || lower.includes('mệt mỏi') || lower.includes('stress')) {
      return false;
    }
  }

  if (!scope.includes('blood_pressures')) {
    if (lower.includes('huyết áp') || lower.includes('tâm thu') || lower.includes('tâm trương') || lower.includes('blood pressure')) {
      return false;
    }
  }

  return true;
}

export function buildConversationHistory(
  messages: RawConversationMessage[],
  excludeMessageId?: string,
  scope?: ConsentScopeItem[]
): AIMessageHistoryItem[] {
  if (!Array.isArray(messages)) return [];

  // Nếu scope rỗng, tuyệt đối không gửi lại lịch sử nào ra ngoài
  if (scope && scope.length === 0) {
    return [];
  }

  const effectiveScope = scope || ['profile', 'goals', 'activities', 'observations'];

  return messages
    .filter((m) => {
      if (!m || typeof m.content !== 'string' || !m.content.trim()) return false;
      // Chỉ lấy tin nhắn completed
      if (m.status && m.status !== 'completed') return false;
      // Loại trừ tin nhắn trùng
      if (excludeMessageId && m.id === excludeMessageId) return false;
      // Chỉ nhận role user hoặc assistant
      if (m.role !== 'user' && m.role !== 'assistant') return false;
      // Kiểm tra tính tuân thủ scope
      if (!isMessageScopeCompliant(m, effectiveScope)) return false;
      return true;
    })
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content.trim(),
    }));
}
