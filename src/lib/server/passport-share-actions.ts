'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { requireAuthenticatedUser } from '@/lib/server/auth-guard';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function createPassportShareAction(): Promise<{
  success: boolean;
  token?: string;
  error?: string;
}> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) return { success: false, error: 'Chưa cấu hình Supabase.' };

    const token = randomBytes(32).toString('base64url');
    const { data, error } = await supabase
      .from('athlete_passport_shares')
      .upsert({ user_id: user.id, token, revoked_at: null }, { onConflict: 'user_id' })
      .select('token')
      .single();

    if (error || !data) {
      return { success: false, error: 'Không thể tạo liên kết chia sẻ: ' + (error?.message || 'Không có dữ liệu trả về') };
    }

    revalidatePath('/passport');
    return { success: true, token: data.token };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Lỗi hệ thống' };
  }
}

export async function revokePassportShareAction(): Promise<{ success: boolean; error?: string }> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) return { success: false, error: 'Chưa cấu hình Supabase.' };

    const { error } = await supabase
      .from('athlete_passport_shares')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('revoked_at', null);

    if (error) return { success: false, error: 'Không thể thu hồi liên kết: ' + error.message };
    revalidatePath('/passport');
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Lỗi hệ thống' };
  }
}
