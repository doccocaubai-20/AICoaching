/**
 * CALISCOACHING MVP - SUPABASE ADMIN CLIENT (CHỈ DÙNG Ở SERVER)
 * Dùng service role, BỎ QUA RLS. Chỉ dành cho các thao tác mà client không được phép:
 * ghi ai_summaries và ai_messages (Agent E).
 *
 * BẮT BUỘC khi dùng:
 * 1. Gọi requireAuthenticatedUser() trước, lấy user.id từ phiên.
 * 2. Luôn tự đặt user_id = user.id; không bao giờ lấy user_id từ request body.
 * 3. Kiểm tra đồng ý AI còn hiệu lực trước khi gửi dữ liệu ra provider.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/contracts/database.types';
import { getSupabaseEnvStatus } from './env';

export function createAdminSupabaseClient(): SupabaseClient<Database> | null {
  if (typeof window !== 'undefined') {
    throw new Error('createAdminSupabaseClient chỉ được gọi ở server.');
  }

  const status = getSupabaseEnvStatus();
  if (!status.isConfigured || !status.hasServiceRoleKey) {
    return null;
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as SupabaseClient<Database>;
}
