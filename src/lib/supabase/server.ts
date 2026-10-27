/**
 * CALISCOACHING MVP - SUPABASE SERVER CLIENT
 * Dùng cho Server Components, Server Actions và Route Handlers.
 * Tương thích với Next.js 15 App Router (async cookies).
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/contracts/database.types';
import { getSafeSupabaseConfig } from './env';

export async function createServerSupabaseClient(): Promise<SupabaseClient<Database> | null> {
  const config = getSafeSupabaseConfig();

  if (!config.isConfigured) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as any)
          );
        } catch {
          // Xảy ra khi được gọi từ Server Component thuần (chỉ đọc)
        }
      },
    },
  }) as unknown as SupabaseClient<Database>;
}
