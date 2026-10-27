/**
 * CALISCOACHING MVP - QUY TẮC XEM LẠI LỊCH HOẠT ĐỘNG (AGENT D - P1)
 * Hàm thuần TypeScript đánh giá lịch hoạt động gần nhau (ví dụ: Cầu lông & Calisthenics).
 *
 * NGUYÊN TẮC AN TOÀN:
 * 1. QUY TẮC DEMO TĨNH, CHƯA QUA RÀ SOÁT CHUYÊN MÔN Y HỌC / THỂ THAO.
 * 2. TUYỆT ĐỐI KHÔNG TỰ ĐỘNG THAY ĐỔI TẢI TẬP HOẶC LỊCH CỦA NGƯỜI DÙNG.
 * 3. TUYỆT ĐỐI KHÔNG KẾT LUẬN TRẠNG THÁI HỒI PHỤC THỂ LỰC HAY Y TẾ.
 * 4. NGƯỠNG DEMO KHÔNG ĐƯA VÀO KHUYẾN NGHỊ CHO NGƯỜI THẬT TẬP THEO.
 */

import { ActivityEntity } from '@/contracts';

export const REVIEW_RULE_VERSION = 'rule-demo-v1.0';

/**
 * Ngưỡng thời gian demo giữa hai hoạt động (tính bằng giờ).
 * Minh họa kỹ thuật: 12 giờ.
 */
export const DEMO_PROXIMITY_THRESHOLD_HOURS = 12;

export interface ScheduleReviewEvaluation {
  status: 'needs_review' | 'insufficient_data' | 'no_flag';
  reason: string;
  reference_activity_ids: string[];
  rule_version: string;
  is_demo: boolean;
}

/**
 * Hàm thuần đánh giá lịch hoạt động theo quy tắc demo:
 * Kiểm tra xem có buổi Cầu lông (badminton) và buổi Calisthenics nào thực tế đã diễn ra
 * trong khoảng cách thời gian dưới 12 giờ hay không.
 *
 * @param activities Danh sách hoạt động của người dùng
 * @param now Thời điểm đánh giá (mặc định là hiện tại)
 */
export function evaluateScheduleReview(
  activities: ActivityEntity[],
  now: Date = new Date()
): ScheduleReviewEvaluation {
  if (!Array.isArray(activities) || activities.length < 2) {
    return {
      status: 'no_flag',
      reason: 'Chưa đủ số lượng hoạt động để áp dụng quy tắc xem lại lịch demo.',
      reference_activity_ids: [],
      rule_version: REVIEW_RULE_VERSION,
      is_demo: true,
    };
  }

  // 1. Chỉ xét các hoạt động thực tế đã tập (is_planned === false)
  const actuals = activities.filter((a) => !a.is_planned);
  if (actuals.length < 2) {
    return {
      status: 'no_flag',
      reason: 'Chưa có đủ 2 hoạt động thực tế để đối chiếu.',
      reference_activity_ids: [],
      rule_version: REVIEW_RULE_VERSION,
      is_demo: true,
    };
  }

  // 2. Kiểm tra dữ liệu bị thiếu hoặc không hợp lệ (Missing/Corrupted data)
  for (const act of actuals) {
    const timeMs = new Date(act.start_at).getTime();
    if (isNaN(timeMs) || !act.start_at) {
      return {
        status: 'insufficient_data',
        reason: 'Chưa đủ thông tin: Phát hiện hoạt động thiếu ngày giờ bắt đầu hợp lệ.',
        reference_activity_ids: [act.id].sort(),
        rule_version: REVIEW_RULE_VERSION,
        is_demo: true,
      };
    }
    if (typeof act.duration_minutes !== 'number' || act.duration_minutes <= 0) {
      return {
        status: 'insufficient_data',
        reason: 'Chưa đủ thông tin: Phát hiện hoạt động thiếu thời lượng hợp lệ.',
        reference_activity_ids: [act.id].sort(),
        rule_version: REVIEW_RULE_VERSION,
        is_demo: true,
      };
    }
  }

  // 3. Tìm cặp hoạt động [Cầu lông (badminton) và Calisthenics (calisthenics)] diễn ra gần nhau (< 12 giờ)
  const proximityMs = DEMO_PROXIMITY_THRESHOLD_HOURS * 60 * 60 * 1000;

  const badmintonActs = actuals.filter((a) => a.activity_type === 'badminton');
  const calisActs = actuals.filter((a) => a.activity_type === 'calisthenics');

  for (const b of badmintonActs) {
    const bTime = new Date(b.start_at).getTime();

    for (const c of calisActs) {
      const cTime = new Date(c.start_at).getTime();
      const diffMs = Math.abs(bTime - cTime);

      if (diffMs <= proximityMs) {
        const diffHours = (diffMs / (1000 * 60 * 60)).toFixed(1);
        // Sắp xếp IDs tăng dần theo yêu cầu index uq_review_suggestions_active
        const sortedIds = [b.id, c.id].sort();

        return {
          status: 'needs_review',
          reason: `Phát hiện buổi Cầu lông (${b.duration_minutes} phút) và buổi Calisthenics (${c.duration_minutes} phút) diễn ra cách nhau ${diffHours} giờ (ngưỡng demo: dưới ${DEMO_PROXIMITY_THRESHOLD_HOURS} giờ). Bạn có thể xem lại lịch để cân đối thời gian nghỉ ngơi phù hợp.`,
          reference_activity_ids: sortedIds,
          rule_version: REVIEW_RULE_VERSION,
          is_demo: true,
        };
      }
    }
  }

  return {
    status: 'no_flag',
    reason: 'Không phát hiện hoạt động nào cần xem xét lại theo quy tắc demo.',
    reference_activity_ids: [],
    rule_version: REVIEW_RULE_VERSION,
    is_demo: true,
  };
}
