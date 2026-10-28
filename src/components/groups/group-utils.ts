/**
 * CALISCOACHING - GROUP UTILITIES (HÀM THUẦN XỬ LÝ NHÓM CAM KẾT D5)
 * Tính toán tuần theo múi giờ nhóm, định dạng tiếng Việt, chuẩn hóa văn bản an toàn.
 */

import { CommitmentStatus, GroupRole, RSVPStatus } from '@/contracts/group.contract';

export const DEFAULT_GROUP_TIMEZONE = 'Asia/Ho_Chi_Minh';

/**
 * Tính ngày Thứ Hai đầu tuần (YYYY-MM-DD) theo đúng múi giờ của nhóm.
 * TUYỆT ĐỐI KHÔNG dùng toISOString().slice(0, 10) để tránh lệch ngày do UTC.
 */
export function getWeekStartForDate(
  date: Date = new Date(),
  timezone: string = DEFAULT_GROUP_TIMEZONE
): string {
  const tz = timezone || DEFAULT_GROUP_TIMEZONE;

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const parts = formatter.formatToParts(date);
    let weekdayStr = '';
    let year = 1970;
    let month = 1;
    let day = 1;

    for (const part of parts) {
      if (part.type === 'weekday') weekdayStr = part.value;
      else if (part.type === 'year') year = Number(part.value);
      else if (part.type === 'month') month = Number(part.value);
      else if (part.type === 'day') day = Number(part.value);
    }

    // Thứ Hai = 0 ngày lùi, Thứ Ba = 1, ... Chủ Nhật = 6
    const weekdayMap: Record<string, number> = {
      Mon: 0,
      Tue: 1,
      Wed: 2,
      Thu: 3,
      Fri: 4,
      Sat: 5,
      Sun: 6,
    };

    const offsetDays = weekdayMap[weekdayStr] ?? 0;
    const monday = new Date(Date.UTC(year, month - 1, day - offsetDays));
    const pad = (n: number) => String(n).padStart(2, '0');

    return `${monday.getUTCFullYear()}-${pad(monday.getUTCMonth() + 1)}-${pad(monday.getUTCDate())}`;
  } catch {
    // Fallback nếu múi giờ không hợp lệ: dùng Asia/Ho_Chi_Minh
    return getWeekStartForDate(date, DEFAULT_GROUP_TIMEZONE);
  }
}

/**
 * Dịch chuyển tuần từ chuỗi YYYY-MM-DD với weeksDelta (+1, -1, v.v.).
 */
export function getShiftedWeekStart(currentWeekStart: string, weeksDelta: number): string {
  const [y, m, d] = currentWeekStart.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1, d + weeksDelta * 7));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-${pad(target.getUTCDate())}`;
}

/**
 * Hiển thị khoảng ngày trong tuần dạng tiếng Việt: "26/10 - 01/11/2026".
 */
export function formatWeekRangeVN(weekStart: string): string {
  const [y, m, d] = weekStart.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, d));
  const end = new Date(Date.UTC(y, m - 1, d + 6));
  const pad = (n: number) => String(n).padStart(2, '0');

  return `${pad(start.getUTCDate())}/${pad(start.getUTCMonth() + 1)} - ${pad(end.getUTCDate())}/${pad(end.getUTCMonth() + 1)}/${end.getUTCFullYear()}`;
}

/**
 * Định dạng ngày giờ hiển thị theo chuẩn Việt Nam.
 */
export function formatDateTimeVN(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: DEFAULT_GROUP_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);
  } catch {
    return isoString;
  }
}

/**
 * Làm sạch văn bản tin nhắn ngắn an toàn (không rich HTML, escape ký tự, tối đa 280 ký tự).
 */
export function sanitizeTextMessage(input: string, maxLength: number = 280): string {
  if (!input) return '';
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, ''); // Loại bỏ thẻ nhọn nguy hiểm
}

export function getRoleBadgeStyle(role: GroupRole): { label: string; className: string } {
  switch (role) {
    case 'owner':
      return {
        label: 'Chủ nhóm',
        className: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      };
    case 'admin':
      return {
        label: 'Quản trị',
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      };
    case 'member':
    default:
      return {
        label: 'Thành viên',
        className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
      };
  }
}

export function getCommitmentStatusBadgeStyle(status: CommitmentStatus): { label: string; className: string } {
  switch (status) {
    case 'completed':
      return {
        label: 'Đã hoàn thành',
        className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      };
    case 'needs_companion':
      return {
        label: 'Cần đồng hành',
        className: 'bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200 dark:border-purple-800',
      };
    case 'rescheduled':
      return {
        label: 'Dời lịch',
        className: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      };
    case 'planned':
    default:
      return {
        label: 'Dự định',
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      };
  }
}

export function getRSVPBadgeStyle(status: RSVPStatus): { label: string; className: string } {
  switch (status) {
    case 'going':
      return {
        label: 'Tham gia',
        className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      };
    case 'maybe':
      return {
        label: 'Có thể',
        className: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      };
    case 'declined':
    default:
      return {
        label: 'Không tham gia',
        className: 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800',
      };
  }
}
