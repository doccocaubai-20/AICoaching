import { describe, it, expect } from 'vitest';
import {
  assertResourceOwnership,
  ForbiddenOwnershipError,
  ConfigurationMissingError,
  UnauthorizedError,
} from '@/lib/server/auth-guard';
import { getSupabaseEnvStatus } from '@/lib/supabase/env';

describe('Server Auth Guard & Ownership Verification', () => {
  it('cho phép thao tác khi user_id của tài nguyên trùng với user_id đang xác thực', () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    expect(() => {
      assertResourceOwnership(userId, userId);
    }).not.toThrow();
  });

  it('lập tức ném ForbiddenOwnershipError khi tài khoản B cố truy cập tài nguyên của tài khoản A', () => {
    const userA = '11111111-1111-1111-1111-111111111111';
    const userB = '22222222-2222-2222-2222-222222222222';

    expect(() => {
      assertResourceOwnership(userA, userB);
    }).toThrow(ForbiddenOwnershipError);

    try {
      assertResourceOwnership(userA, userB);
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenOwnershipError);
      expect((err as Error).message).toContain('không khớp');
    }
  });

  it('lập tức ném ForbiddenOwnershipError khi ID bị rỗng', () => {
    expect(() => {
      assertResourceOwnership('', '11111111-1111-1111-1111-111111111111');
    }).toThrow(ForbiddenOwnershipError);
  });

  it('kiểm tra trạng thái thiếu credential một cách minh bạch (không giả mạo bảo mật)', () => {
    const envStatus = getSupabaseEnvStatus();
    // Khi chưa thiết lập .env.local, isConfigured phải là false
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      expect(envStatus.isConfigured).toBe(false);
      expect(envStatus.missingKeys).toContain('NEXT_PUBLIC_SUPABASE_URL');
    }
  });
});
