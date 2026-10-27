/**
 * CALISCOACHING MVP - TIỆN ÍCH ĐỊNH DẠNG NGÀY GIỜ & NGUỒN DỮ LIỆU (AGENT B)
 * Chuẩn hóa múi giờ Việt Nam ('Asia/Ho_Chi_Minh') cho toàn bộ giao diện hồ sơ và dashboard.
 */

export const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';

/**
 * Định dạng ngày theo chuẩn tiếng Việt với múi giờ Asia/Ho_Chi_Minh.
 * Ví dụ: "27/10/2026"
 */
export function formatDateVN(
  dateInput: string | number | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) return '—';

  const date = typeof dateInput === 'object' ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return '—';

  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: VIETNAM_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...options,
  };

  return new Intl.DateTimeFormat('vi-VN', defaultOptions).format(date);
}

/**
 * Lấy chuỗi ngày hôm nay theo giờ Việt Nam định dạng YYYY-MM-DD cho input type="date".
 */
export function getTodayVNDateString(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: VIETNAM_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

/**
 * Hiển thị nhãn nguồn dữ liệu động dựa trên trường source.
 */
export function formatSourceLabel(source: string | null | undefined): string {
  if (!source) return 'Chưa rõ nguồn';
  switch (source) {
    case 'self_reported':
      return 'Tự khai';
    case 'manual_import':
      return 'Nhập thủ công';
    case 'session_sync':
      return 'Đồng bộ buổi tập';
    case 'manual_entry':
      return 'Tự nhập';
    default:
      return source;
  }
}

// Đã chuyển vào hợp đồng chung; giữ export để không vỡ import cũ
export { validateGoalDates } from '@/contracts';
