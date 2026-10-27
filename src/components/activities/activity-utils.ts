/**
 * CALISCOACHING MVP - TIỆN ÍCH QUẢN LÝ NHẬT KÝ HOẠT ĐỘNG (AGENT C)
 * Các hàm thuần phục vụ lọc danh sách, kiểm tra thời lượng, và định dạng thời gian.
 */

import { ActivityEntity, ActivityType, MAX_ACTIVITY_DURATION_MINUTES } from '@/contracts';

export const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  calisthenics: 'Calisthenics',
  running: 'Chạy bộ',
  badminton: 'Cầu lông',
  walking: 'Đi bộ',
  other: 'Môn khác',
};

export interface ActivityFilterOptions {
  type?: ActivityType | 'all';
  status?: 'all' | 'actual' | 'planned';
}

const DATETIME_LOCAL_PATTERN = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(:\d{2})?$/;

/**
 * Đổi giá trị <input type="datetime-local"> sang ISO-8601 (UTC).
 * Giá trị nhập luôn được hiểu là GIỜ VIỆT NAM (+07:00), khớp với nhãn form và với
 * isoToVNDatetimeLocal() khi điền sẵn form sửa — không phụ thuộc múi giờ của trình duyệt,
 * nên mở sửa rồi lưu lại không làm lệch giờ.
 */
export function localDatetimeToIso(localValue: string): string {
  if (!localValue || typeof localValue !== 'string') return '';
  const match = DATETIME_LOCAL_PATTERN.exec(localValue.trim());
  if (!match) return '';
  const parsed = new Date(`${match[1]}${match[2] ?? ':00'}+07:00`);
  if (isNaN(parsed.getTime())) return '';
  return parsed.toISOString();
}

/**
 * Hàm thuần chuyển chuỗi thời gian ISO sang định dạng YYYY-MM-DDTHH:mm theo giờ Việt Nam
 * để điền sẵn vào <input type="datetime-local"> khi mở form chỉnh sửa.
 */
export function isoToVNDatetimeLocal(isoString: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: VIETNAM_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  const hour = partMap.hour === '24' ? '00' : partMap.hour;
  return `${partMap.year}-${partMap.month}-${partMap.day}T${hour}:${partMap.minute}`;
}

/**
 * Lấy thời gian hiện tại theo giờ Việt Nam định dạng YYYY-MM-DDTHH:mm cho giá trị mặc định form.
 */
export function getVietnamNowDatetimeLocal(now: Date = new Date()): string {
  return isoToVNDatetimeLocal(now.toISOString());
}

/**
 * Hàm thuần kiểm tra tính hợp lệ của thời lượng vận động.
 * Giới hạn nghiệp vụ: số phút phải là số nguyên dương > 0 và <= 1440 (tối đa 24 giờ).
 */
export function validateActivityDuration(
  durationMinutes: number | unknown
): { isValid: boolean; error?: string } {
  if (typeof durationMinutes !== 'number' || isNaN(durationMinutes)) {
    return {
      isValid: false,
      error: 'Thời lượng tập luyện phải là một con số.',
    };
  }

  if (!Number.isInteger(durationMinutes)) {
    return {
      isValid: false,
      error: 'Thời lượng tập luyện phải là số nguyên phút (không nhập số thập phân).',
    };
  }

  if (durationMinutes <= 0) {
    return {
      isValid: false,
      error: 'Thời lượng tập luyện phải lớn hơn 0 phút.',
    };
  }

  if (durationMinutes > MAX_ACTIVITY_DURATION_MINUTES) {
    return {
      isValid: false,
      error: 'Thời lượng một buổi tập không được vượt quá 1440 phút (24 giờ).',
    };
  }

  return { isValid: true };
}

/**
 * Hàm thuần lọc danh sách hoạt động theo loại môn và trạng thái kế hoạch.
 */
export function filterActivities(
  activities: ActivityEntity[],
  filters: ActivityFilterOptions
): ActivityEntity[] {
  if (!Array.isArray(activities)) return [];

  return activities.filter((act) => {
    // 1. Lọc theo loại môn
    if (filters.type && filters.type !== 'all') {
      if (act.activity_type !== filters.type) {
        return false;
      }
    }

    // 2. Lọc theo trạng thái (Đã tập vs Lịch dự kiến)
    if (filters.status && filters.status !== 'all') {
      if (filters.status === 'actual' && act.is_planned) {
        return false;
      }
      if (filters.status === 'planned' && !act.is_planned) {
        return false;
      }
    }

    return true;
  });
}
