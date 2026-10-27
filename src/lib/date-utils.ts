/**
 * CALISCOACHING - TIỆN ÍCH NGÀY GIỜ ĐỊA PHƯƠNG THỐNG NHẤT (E5)
 * Hỗ trợ múi giờ IANA từ hồ sơ người dùng (fallback: 'Asia/Ho_Chi_Minh').
 * TUYỆT ĐỐI KHÔNG dùng toISOString().slice(0, 10) để suy ra ngày địa phương (vì sẽ lệch múi giờ).
 */

export const DEFAULT_APP_TIMEZONE = 'Asia/Ho_Chi_Minh';

/**
 * Trả về chuỗi ngày YYYY-MM-DD theo múi giờ chỉ định.
 */
export function getLocalDateString(
  date: Date = new Date(),
  timezone: string = DEFAULT_APP_TIMEZONE
): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || DEFAULT_APP_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  } catch {
    // Fallback an toàn nếu múi giờ không hợp lệ
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: DEFAULT_APP_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  }
}

/**
 * Trả về chuỗi ngày lùi lại N ngày theo múi giờ chỉ định.
 */
export function getPastLocalDateString(
  daysAgo: number,
  baseDate: Date = new Date(),
  timezone: string = DEFAULT_APP_TIMEZONE
): string {
  const target = new Date(baseDate.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  return getLocalDateString(target, timezone);
}

/**
 * Lấy cửa sổ 7 ngày chuẩn xác: [hôm nay - 6 ngày, hôm nay] theo múi giờ chỉ định.
 */
export function get7DayWindow(
  baseDate: Date = new Date(),
  timezone: string = DEFAULT_APP_TIMEZONE
): { startDate: string; endDate: string } {
  return {
    startDate: getPastLocalDateString(6, baseDate, timezone),
    endDate: getLocalDateString(baseDate, timezone),
  };
}

/**
 * Định dạng Date thành chuỗi YYYY-MM-DDTHH:mm tương thích input datetime-local theo giờ máy/địa phương.
 */
export function toLocalDatetimeInputValue(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
