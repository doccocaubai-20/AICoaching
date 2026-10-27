/**
 * CALISCOACHING - ATHLETE PASSPORT UTILITIES & STANDARDS
 * Đảm bảo các nguyên tắc dữ liệu: Không tự tạo điểm giả, không khẳng định đạt chuẩn phi thực tế,
 * tính streak theo ngày địa phương thực, sinh QR SVG thật, hash ID không trùng.
 */

import QRCode from 'qrcode';
import { getLocalDateString, getPastLocalDateString, DEFAULT_APP_TIMEZONE } from '@/lib/date-utils';

/**
 * 1. Hiển thị mã tài khoản ổn định, duy nhất theo UUID thay vì hash rút gọn dễ va chạm.
 */
export function generatePassportId(identifier: string): string {
  const normalized = (identifier || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    return 'DEMO';
  }
  return normalized.replace(/-/g, '').toUpperCase();
}

/**
 * 2. Sinh SVG Path cho QR Code từ chuỗi URL bất kỳ (Đồng bộ)
 * Scale các module về viewBox 24x24 chuẩn, hai URL khác nhau cho ra path khác nhau 100%.
 */
export function generateQRCodePath(text: string): string {
  try {
    const qr = QRCode.create(text || 'https://caliscoaching.vn', {
      errorCorrectionLevel: 'M',
    });
    const size = qr.modules.size;
    const data = qr.modules.data;
    const scale = 24 / size;

    let path = '';
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (data[r * size + c]) {
          const x = (c * scale).toFixed(2);
          const y = (r * scale).toFixed(2);
          const w = scale.toFixed(2);
          const h = scale.toFixed(2);
          path += `M${x},${y}h${w}v${h}h-${w}z `;
        }
      }
    }
    return path.trim() || 'M2 2h20v20H2z';
  } catch {
    return 'M2 2h8v8H2V2zm2 2v4h4V4H4zm8-2h8v8h-8V2zm2 2v4h4V4h-4zM2 14h8v8H2v-8zm2 2v4h4v-4H4z';
  }
}

/**
 * 3. Tính toán chuỗi ngày kỷ luật (Current Streak Days) theo ngày thực tế:
 * - Bỏ qua các hoạt động trong tương lai (start_at > now).
 * - Sử dụng ngày địa phương theo múi giờ nhất quán (mặc định Asia/Ho_Chi_Minh).
 * - Nếu chuỗi đã đứt (không có buổi tập hôm nay hoặc hôm qua theo giờ địa phương): Streak = 0.
 * - Nhiều buổi tập trong cùng 1 ngày địa phương: Tính tối đa 1 ngày.
 */
export function calculateStreakDays(
  activities: Array<{ start_at?: string; is_planned?: boolean }>,
  now: Date = new Date(),
  timezone: string = DEFAULT_APP_TIMEZONE
): number {
  if (!Array.isArray(activities) || activities.length === 0) {
    return 0;
  }

  const nowTime = now.getTime();

  // Chỉ lấy hoạt động thực tế đã diễn ra và KHÔNG nằm trong tương lai
  const validActivities = activities.filter((a) => {
    if (a.is_planned || !a.start_at) return false;
    const t = new Date(a.start_at).getTime();
    return !isNaN(t) && t <= nowTime;
  });

  if (validActivities.length === 0) {
    return 0;
  }

  // Gom các ngày duy nhất theo giờ địa phương chuẩn (YYYY-MM-DD)
  const uniqueDates = new Set<string>();
  for (const act of validActivities) {
    if (!act.start_at) continue;
    const localDateStr = getLocalDateString(new Date(act.start_at), timezone);
    uniqueDates.add(localDateStr);
  }

  if (uniqueDates.size === 0) {
    return 0;
  }

  // Kiểm tra tính liên tục tính đến hiện tại (Current Streak):
  // Phải có hoạt động hôm nay HOẶC hôm qua theo giờ địa phương
  const todayStr = getLocalDateString(now, timezone);
  const yesterdayStr = getPastLocalDateString(1, now, timezone);

  if (!uniqueDates.has(todayStr) && !uniqueDates.has(yesterdayStr)) {
    // Chuỗi đã đứt quãng từ trước (ví dụ hoạt động từ nhiều ngày trước) -> streak hiện tại = 0
    return 0;
  }

  // Bắt đầu đếm chuỗi từ mốc gần nhất (hôm nay hoặc hôm qua)
  let streak = 0;
  let checkDateOffset = uniqueDates.has(todayStr) ? 0 : 1;

  while (true) {
    const targetDateStr = getPastLocalDateString(checkDateOffset, now, timezone);
    if (uniqueDates.has(targetDateStr)) {
      streak++;
      checkDateOffset++;
    } else {
      break;
    }
  }

  return streak;
}
