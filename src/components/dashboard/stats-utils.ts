/**
 * CALISCOACHING MVP - TIỆN ÍCH TÍNH TOÁN THỐNG KÊ DASHBOARD (AGENT B)
 * Hàm thuần tính toán số liệu 7 ngày qua từ danh sách hoạt động thực tế.
 */

export interface ActivityStatsItem {
  activity_type: string;
  duration_minutes: number;
  start_at: string;
  is_planned: boolean;
}

export interface WeeklyStatsResult {
  totalSessions: number;
  totalMinutes: number;
  distinctTypes: number;
}

/**
 * Tính toán thống kê 7 ngày qua:
 * - Chỉ tính hoạt động thực tế (is_planned = false).
 * - Nằm trong khoảng thời gian [now - 7 ngày, now].
 * - Bỏ qua các hoạt động tương lai (dù vô tình gắn is_planned = false) hoặc hoạt động dự kiến.
 * - Không giới hạn số lượng dòng đầu vào.
 */
export function computeWeeklyStats(
  activities: ActivityStatsItem[],
  now: Date = new Date()
): WeeklyStatsResult {
  if (!activities || activities.length === 0) {
    return {
      totalSessions: 0,
      totalMinutes: 0,
      distinctTypes: 0,
    };
  }

  const nowMs = now.getTime();
  const sevenDaysAgoMs = nowMs - 7 * 24 * 60 * 60 * 1000;

  const validActivities = activities.filter((act) => {
    // 1. Phải là hoạt động thực tế
    if (act.is_planned) return false;

    // 2. Thời gian bắt đầu phải hợp lệ và nằm trong 7 ngày gần nhất đến thời điểm hiện tại
    const actTime = new Date(act.start_at).getTime();
    if (isNaN(actTime)) return false;

    return actTime >= sevenDaysAgoMs && actTime <= nowMs;
  });

  const totalSessions = validActivities.length;
  const totalMinutes = validActivities.reduce((acc, cur) => acc + (cur.duration_minutes || 0), 0);
  const distinctTypes = new Set(validActivities.map((act) => act.activity_type)).size;

  return {
    totalSessions,
    totalMinutes,
    distinctTypes,
  };
}
