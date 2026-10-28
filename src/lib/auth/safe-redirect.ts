/**
 * CALISCOACHING - SAFE REDIRECT HELPER (P0.2)
 * Kiểm tra và bảo đảm URL chuyển hướng sau đăng nhập/đăng ký là URL nội bộ an toàn.
 * Chống lỗ hổng Open Redirect và bảo toàn lời mời nhóm, deep link hoặc user intent.
 */

export const ALLOWED_INTENTS = ['record_activity', 'start_workout', 'track_health'] as const;
export type UserIntent = typeof ALLOWED_INTENTS[number];

export function getSafeRedirectUrl(
  nextUrl: string | null | undefined,
  intent?: string | null | undefined,
  fallback = '/dashboard'
): string {
  if (nextUrl) {
    const trimmed = nextUrl.trim();
    // Bắt buộc bắt đầu bằng '/', không chứa '//' và không chứa ':' (chống http:, javascript:)
    if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes(':')) {
      return trimmed;
    }
  }

  if (intent && ALLOWED_INTENTS.includes(intent as UserIntent)) {
    return `/dashboard?intent=${intent}`;
  }

  return fallback;
}
