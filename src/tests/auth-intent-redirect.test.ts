import { describe, it, expect } from 'vitest';
import { getSafeRedirectUrl, ALLOWED_INTENTS } from '@/lib/auth/safe-redirect';

describe('P0.2: Auth Safe Redirect & Intent Preservation Tests', () => {
  it('1. Cho phép các URL nội bộ hợp lệ', () => {
    expect(getSafeRedirectUrl('/activities')).toBe('/activities');
    expect(getSafeRedirectUrl('/profile?tab=health&date=2026-10-28')).toBe(
      '/profile?tab=health&date=2026-10-28'
    );
    expect(getSafeRedirectUrl('/groups?runId=123')).toBe('/groups?runId=123');
  });

  it('2. Chặn các URL tấn công Open Redirect (//evil.com, http:, javascript:)', () => {
    expect(getSafeRedirectUrl('//evil.com/phishing')).toBe('/dashboard');
    expect(getSafeRedirectUrl('https://malicious.site')).toBe('/dashboard');
    expect(getSafeRedirectUrl('http://attacker.com')).toBe('/dashboard');
    expect(getSafeRedirectUrl('javascript:alert(1)')).toBe('/dashboard');
  });

  it('3. Bảo toàn User Intent khi không có next URL', () => {
    expect(getSafeRedirectUrl(null, 'start_workout')).toBe('/dashboard?intent=start_workout');
    expect(getSafeRedirectUrl(undefined, 'record_activity')).toBe(
      '/dashboard?intent=record_activity'
    );
    expect(getSafeRedirectUrl('', 'track_health')).toBe('/dashboard?intent=track_health');
  });

  it('4. Từ chối intent không nằm trong allowlist', () => {
    expect(getSafeRedirectUrl(null, 'admin_hack')).toBe('/dashboard');
    expect(getSafeRedirectUrl(null, 'undefined')).toBe('/dashboard');
  });

  it('5. Ưu tiên nextUrl an toàn trước intent', () => {
    expect(getSafeRedirectUrl('/groups', 'start_workout')).toBe('/groups');
  });
});
