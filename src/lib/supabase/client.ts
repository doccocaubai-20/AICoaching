/**
 * CALISCOACHING MVP - SUPABASE BROWSER CLIENT
 * Dùng cho các tương tác ở Client Components.
 * Nếu thiếu thông tin cấu hình, cảnh báo rõ ràng thay vì giả mạo kết nối.
 */

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/contracts/database.types';
import { getSafeSupabaseConfig } from './env';

export function createClient(): SupabaseClient<Database> | null {
  const config = getSafeSupabaseConfig();

  if (!config.isConfigured) {
    console.warn(
      '[CalisCoaching Supabase Client] Thiếu cấu hình NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY. Vui lòng xem .env.example.'
    );
    return null;
  }

  return createBrowserClient(config.url, config.anonKey) as unknown as SupabaseClient<Database>;
}
