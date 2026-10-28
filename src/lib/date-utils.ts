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
  const [year, month, day] = getLocalDateString(baseDate, timezone).split('-').map(Number);
  const offset = Number.isFinite(daysAgo) ? Math.trunc(daysAgo) : 0;
  const target = new Date(Date.UTC(year, month - 1, day - offset));
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-${pad(target.getUTCDate())}`;
}

/** Convert a local calendar date to its UTC start instant for database timestamp filters. */
export function getLocalDateStartInstant(
  localDate: string,
  timezone: string = DEFAULT_APP_TIMEZONE
): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!match) return new Date(NaN);
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (calendarDate.getUTCFullYear() !== year || calendarDate.getUTCMonth() + 1 !== month || calendarDate.getUTCDate() !== day) {
    return new Date(NaN);
  }

  const desiredLocalAsUtc = Date.UTC(year, month - 1, day);
  let instant = desiredLocalAsUtc;
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || DEFAULT_APP_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
  } catch {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: DEFAULT_APP_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
  }

  // Reconcile UTC and local wall-clock components; this handles offsets and DST transitions.
  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = formatter.formatToParts(new Date(instant));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const representedLocalAsUtc = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second)
    );
    const adjustment = desiredLocalAsUtc - representedLocalAsUtc;
    if (adjustment === 0) break;
    instant += adjustment;
  }

  return new Date(instant);
}

/**
 * Convert a local calendar date to its UTC end instant (23:59:59.999 local) for database timestamp filters.
 */
export function getLocalDateEndInstant(
  localDate: string,
  timezone: string = DEFAULT_APP_TIMEZONE
): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!match) return new Date(NaN);
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
  const pad = (v: number) => String(v).padStart(2, '0');
  const nextLocalDateStr = `${nextDay.getUTCFullYear()}-${pad(nextDay.getUTCMonth() + 1)}-${pad(nextDay.getUTCDate())}`;
  const nextDayStart = getLocalDateStartInstant(nextLocalDateStr, timezone);
  return new Date(nextDayStart.getTime() - 1);
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
