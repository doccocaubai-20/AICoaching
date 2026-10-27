/**
 * CALISCOACHING - HỢP ĐỒNG GHI NHẬN SINH HOẠT HẰNG NGÀY (DAILY CHECK-IN CONTRACT)
 * Quản lý giấc ngủ, năng lượng, căng thẳng theo ngày địa phương (local_date).
 */

export interface DailyCheckinEntity {
  id: string;
  user_id: string;
  local_date: string; // YYYY-MM-DD
  sleep_start: string | null;
  sleep_end: string | null;
  sleep_duration_minutes: number | null;
  sleep_quality: number | null; // 1 - 5
  energy_level: number | null; // 1 - 5
  stress_level: number | null; // 1 - 5
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertDailyCheckinInput {
  local_date: string; // YYYY-MM-DD
  sleep_start?: string | null;
  sleep_end?: string | null;
  sleep_duration_minutes?: number | null;
  sleep_quality?: number | null;
  energy_level?: number | null;
  stress_level?: number | null;
  notes?: string | null;
}

export interface DailyCheckinValidationResult {
  is_valid: boolean;
  errors: Record<string, string>;
}

export function validateDailyCheckinInput(input: Partial<UpsertDailyCheckinInput>): DailyCheckinValidationResult {
  const errors: Record<string, string> = {};

  if (!input.local_date || !/^\d{4}-\d{2}-\d{2}$/.test(input.local_date)) {
    errors.local_date = 'Ngày ghi nhận phải có định dạng YYYY-MM-DD.';
  }

  if (input.sleep_duration_minutes !== undefined && input.sleep_duration_minutes !== null) {
    if (
      typeof input.sleep_duration_minutes !== 'number' ||
      input.sleep_duration_minutes < 0 ||
      input.sleep_duration_minutes > 1440
    ) {
      errors.sleep_duration_minutes = 'Thời gian ngủ phải nằm trong khoảng từ 0 đến 1440 phút (24 giờ).';
    }
  }

  const checkRating = (val: number | null | undefined, fieldName: string, label: string) => {
    if (val !== undefined && val !== null) {
      if (!Number.isInteger(val) || val < 1 || val > 5) {
        errors[fieldName] = `${label} phải là số nguyên từ 1 đến 5.`;
      }
    }
  };

  checkRating(input.sleep_quality, 'sleep_quality', 'Chất lượng giấc ngủ');
  checkRating(input.energy_level, 'energy_level', 'Mức năng lượng');
  checkRating(input.stress_level, 'stress_level', 'Mức căng thẳng');

  return {
    is_valid: Object.keys(errors).length === 0,
    errors,
  };
}

export interface CheckinWeeklyStatsResult {
  totalRecordedDays: number;
  recordedDays?: number;
  windowDays: number;
  averageSleepMinutes: number | null;
  averageEnergy: number | null;
  averageStress: number | null;
  summaryText: string;
}

/**
 * Tính toán tóm tắt sinh hoạt 7 ngày:
 * - Luôn nêu rõ số ngày thực sự đã ghi (ví dụ: 4/7 ngày).
 * - Không tự ý suy diễn ngày chưa ghi thành 0 giờ ngủ.
 */
export function computeCheckinWeeklyStats(
  checkins: DailyCheckinEntity[],
  windowDays: number = 7
): CheckinWeeklyStatsResult {
  if (!Array.isArray(checkins) || checkins.length === 0) {
    return {
      totalRecordedDays: 0,
      recordedDays: 0,
      windowDays,
      averageSleepMinutes: null,
      averageEnergy: null,
      averageStress: null,
      summaryText: `Chưa có bản ghi sinh hoạt nào trong ${windowDays} ngày qua.`,
    };
  }

  // Tính toán số ngày và số liệu trung bình hợp lệ (giữ 0 phút là giá trị người dùng đã khai)
  // Lọc các bản ghi theo ngày duy nhất nếu có local_date
  const uniqueDateMap = new Map<string, DailyCheckinEntity>();
  checkins.forEach((c) => {
    if (c.local_date) {
      uniqueDateMap.set(c.local_date, c);
    }
  });

  const effectiveCheckins = uniqueDateMap.size > 0 ? Array.from(uniqueDateMap.values()) : checkins;
  const recordedDays = Math.min(effectiveCheckins.length, windowDays);

  const sleepList = effectiveCheckins
    .map((c) => c.sleep_duration_minutes)
    .filter((m): m is number => typeof m === 'number' && !isNaN(m) && m >= 0);

  const energyList = effectiveCheckins
    .map((c) => c.energy_level)
    .filter((e): e is number => typeof e === 'number' && e >= 1);

  const stressList = effectiveCheckins
    .map((c) => c.stress_level)
    .filter((s): s is number => typeof s === 'number' && s >= 1);

  const avgSleep = sleepList.length > 0 ? Math.round(sleepList.reduce((a, b) => a + b, 0) / sleepList.length) : null;
  const avgEnergy = energyList.length > 0 ? Number((energyList.reduce((a, b) => a + b, 0) / energyList.length).toFixed(1)) : null;
  const avgStress = stressList.length > 0 ? Number((stressList.reduce((a, b) => a + b, 0) / stressList.length).toFixed(1)) : null;

  let summaryText = `Đã ghi nhận ${recordedDays}/${windowDays} ngày.`;
  if (avgSleep !== null) {
    const hours = Math.floor(avgSleep / 60);
    const mins = avgSleep % 60;
    summaryText += ` Trung bình ngủ ${hours} giờ ${mins > 0 ? `${mins} phút ` : ''}trong ${sleepList.length} ngày đã ghi.`;
  }

  return {
    totalRecordedDays: recordedDays,
    recordedDays,
    windowDays,
    averageSleepMinutes: avgSleep,
    averageEnergy: avgEnergy,
    averageStress: avgStress,
    summaryText,
  };
}
