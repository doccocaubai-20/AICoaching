/**
 * CALISCOACHING MVP - AUTH GUARD & OWNER CHECK (SERVER LAYER)
 * Kiểm soát phiên đăng nhập và xác thực quyền sở hữu nghiêm ngặt ở tầng Server.
 * 
 * NGUYÊN TẮC BẢO MẬT:
 * 1. Không bao giờ giả lập người dùng hoặc bỏ qua bước kiểm tra quyền nếu thiếu credential.
 * 2. Mọi thao tác đọc/ghi tài nguyên cá nhân phải trùng khớp: auth.uid === resource.user_id.
 * 3. Ngăn chặn triệt để hành vi can thiệp dữ liệu chéo giữa các tài khoản.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getSupabaseEnvStatus } from '@/lib/supabase/env';

export class ConfigurationMissingError extends Error {
  constructor(message = 'Chưa cấu hình Supabase credentials. Vui lòng kiểm tra biến môi trường theo .env.example.') {
    super(message);
    this.name = 'ConfigurationMissingError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message = 'Yêu cầu đăng nhập. Phiên làm việc không hợp lệ hoặc đã hết hạn.') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenOwnershipError extends Error {
  constructor(message = 'Từ chối truy cập: Bạn không có quyền thao tác trên tài nguyên của người khác.') {
    super(message);
    this.name = 'ForbiddenOwnershipError';
  }
}

export async function getAuthenticatedUser() {
  const envStatus = getSupabaseEnvStatus();
  if (!envStatus.isConfigured) {
    return {
      user: null,
      error: new ConfigurationMissingError(),
      envStatus,
    };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return {
      user: null,
      error: new ConfigurationMissingError(),
      envStatus,
    };
  }

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      user: null,
      error: new UnauthorizedError(error?.message),
      envStatus,
    };
  }

  return {
    user,
    error: null,
    envStatus,
  };
}

export async function requireAuthenticatedUser() {
  const { user, error, envStatus } = await getAuthenticatedUser();
  if (error) {
    throw error;
  }
  if (!user) {
    throw new UnauthorizedError();
  }
  return { user, envStatus };
}

/**
 * Kiểm tra xem người dùng hiện tại có phải là chủ sở hữu của tài nguyên hay không.
 * Nếu resourceUserId khác authenticatedUserId, lập tức ném lỗi ForbiddenOwnershipError.
 */
export function assertResourceOwnership(resourceUserId: string, authenticatedUserId: string): void {
  if (!resourceUserId || !authenticatedUserId || resourceUserId !== authenticatedUserId) {
    throw new ForbiddenOwnershipError(
      `Từ chối quyền truy cập: ID chủ sở hữu (${resourceUserId}) không khớp với tài khoản hiện tại (${authenticatedUserId}).`
    );
  }
}
