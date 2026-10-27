'use server';

import { revalidatePath } from 'next/cache';
import { requireAuthenticatedUser } from '@/lib/server/auth-guard';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  ActivityType,
  ActivityEntity,
  validateActivityInput,
  IDEMPOTENCY_CONFLICT_TARGET,
} from '@/contracts';
import { validateActivityDuration } from '@/components/activities/activity-utils';

export interface ActionResult<T = unknown> {
  success: boolean;
  message?: string;
  errors?: Record<string, string>;
  data?: T;
}

// ==============================================================================
// 1. THÊM HOẠT ĐỘNG (UPSERT VỚI IDEMPOTENCY KEY)
// ==============================================================================

export async function createActivityAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult<ActivityEntity | null>> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();

    if (!supabase) {
      return {
        success: false,
        message: 'Chưa cấu hình Supabase credentials. Vui lòng kiểm tra môi trường.',
      };
    }

    const activityType = (formData.get('activity_type') as string)?.trim() as ActivityType;
    const isPlanned = formData.get('is_planned') === 'true';
    const startAt = (formData.get('start_at') as string)?.trim();
    const durationRaw = formData.get('duration_minutes') as string;
    const durationMinutes = parseInt(durationRaw, 10);
    const fatigueRaw = formData.get('fatigue_level') as string;
    const fatigueLevel = fatigueRaw && fatigueRaw.trim() !== '' ? Number(fatigueRaw) : null; // Number để 7.5 bị validate chặn, không bị cắt thành 7
    const notesRaw = formData.get('notes') as string;
    const notes = notesRaw && notesRaw.trim() !== '' ? notesRaw.trim() : null;
    const idempotencyKey = (formData.get('idempotency_key') as string)?.trim();

    if (!idempotencyKey) {
      return {
        success: false,
        message: 'Thiếu khóa chống ghi trùng (idempotency key). Vui lòng thử lại.',
      };
    }

    // 1. Kiểm tra thời lượng hợp lệ
    const durationCheck = validateActivityDuration(durationMinutes);
    if (!durationCheck.isValid) {
      return {
        success: false,
        message: durationCheck.error || 'Thời lượng không hợp lệ.',
        errors: { duration_minutes: durationCheck.error || 'Thời lượng không hợp lệ.' },
      };
    }

    // 2. Kiểm tra theo hợp đồng @/contracts
    const validation = validateActivityInput({
      activity_type: activityType,
      is_planned: isPlanned,
      start_at: startAt,
      duration_minutes: durationMinutes,
      fatigue_level: fatigueLevel,
      notes,
      source: 'manual_entry',
      idempotency_key: idempotencyKey,
    });

    if (!validation.is_valid) {
      return {
        success: false,
        message: 'Dữ liệu hoạt động không hợp lệ.',
        errors: validation.errors,
      };
    }

    // 3. Thực hiện lưu bằng upsert chống ghi trùng
    const { data, error } = await supabase
      .from('activities')
      .upsert(
        {
          user_id: user.id,
          activity_type: activityType,
          is_planned: isPlanned,
          start_at: startAt,
          duration_minutes: durationMinutes,
          fatigue_level: fatigueLevel,
          notes,
          source: 'manual_entry',
          idempotency_key: idempotencyKey,
        },
        {
          onConflict: IDEMPOTENCY_CONFLICT_TARGET,
          ignoreDuplicates: true,
        }
      )
      .select()
      .maybeSingle();

    if (error) {
      return {
        success: false,
        message: `Lỗi khi lưu hoạt động: ${error.message}`,
      };
    }

    // Cập nhật lại cache của trang nhật ký và trang tổng quan dashboard
    revalidatePath('/activities');
    revalidatePath('/dashboard');

    return {
      success: true,
      message: isPlanned ? 'Đã lên lịch hoạt động dự kiến!' : 'Ghi hoạt động thành công!',
      data: (data as ActivityEntity) || null,
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Đã có lỗi xảy ra khi tạo hoạt động.',
    };
  }
}

// ==============================================================================
// 2. CHỈNH SỬA HOẠT ĐỘNG
// ==============================================================================

export async function updateActivityAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();

    if (!supabase) {
      return {
        success: false,
        message: 'Chưa cấu hình Supabase credentials.',
      };
    }

    const activityId = (formData.get('activity_id') as string)?.trim();
    if (!activityId) {
      return {
        success: false,
        message: 'Mã định danh hoạt động không hợp lệ.',
      };
    }

    const activityType = (formData.get('activity_type') as string)?.trim() as ActivityType;
    const isPlanned = formData.get('is_planned') === 'true';
    const startAt = (formData.get('start_at') as string)?.trim();
    const durationRaw = formData.get('duration_minutes') as string;
    const durationMinutes = parseInt(durationRaw, 10);
    const fatigueRaw = formData.get('fatigue_level') as string;
    const fatigueLevel = fatigueRaw && fatigueRaw.trim() !== '' ? Number(fatigueRaw) : null; // Number để 7.5 bị validate chặn, không bị cắt thành 7
    const notesRaw = formData.get('notes') as string;
    const notes = notesRaw && notesRaw.trim() !== '' ? notesRaw.trim() : null;

    // 1. Kiểm tra thời lượng hợp lệ
    const durationCheck = validateActivityDuration(durationMinutes);
    if (!durationCheck.isValid) {
      return {
        success: false,
        message: durationCheck.error || 'Thời lượng không hợp lệ.',
        errors: { duration_minutes: durationCheck.error || 'Thời lượng không hợp lệ.' },
      };
    }

    // 2. Kiểm tra theo hợp đồng @/contracts
    const validation = validateActivityInput({
      activity_type: activityType,
      is_planned: isPlanned,
      start_at: startAt,
      duration_minutes: durationMinutes,
      fatigue_level: fatigueLevel,
      notes,
    });

    if (!validation.is_valid) {
      return {
        success: false,
        message: 'Dữ liệu chỉnh sửa hoạt động không hợp lệ.',
        errors: validation.errors,
      };
    }

    // 3. Cập nhật hoạt động: KHÔNG đổi idempotency_key, lọc theo id và user_id
    // Trigger trg_activities_mark_suggestions_outdated trong DB sẽ tự động đánh dấu review_suggestions liên quan thành 'outdated'
    const { error } = await supabase
      .from('activities')
      .update({
        activity_type: activityType,
        is_planned: isPlanned,
        start_at: startAt,
        duration_minutes: durationMinutes,
        fatigue_level: fatigueLevel,
        notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', activityId)
      .eq('user_id', user.id);

    if (error) {
      return {
        success: false,
        message: `Lỗi khi cập nhật hoạt động: ${error.message}`,
      };
    }

    // Cập nhật lại cache của trang nhật ký và trang tổng quan dashboard
    revalidatePath('/activities');
    revalidatePath('/dashboard');

    return {
      success: true,
      message: 'Cập nhật hoạt động thành công!',
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Đã có lỗi xảy ra khi cập nhật hoạt động.',
    };
  }
}

// ==============================================================================
// 3. XÓA HOẠT ĐỘNG
// ==============================================================================

export async function deleteActivityAction(activityId: string): Promise<ActionResult> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();

    if (!supabase) {
      return {
        success: false,
        message: 'Chưa cấu hình Supabase credentials.',
      };
    }

    if (!activityId || typeof activityId !== 'string') {
      return {
        success: false,
        message: 'Mã định danh hoạt động không hợp lệ.',
      };
    }

    // Xóa hoạt động và kiểm tra quyền sở hữu .eq('user_id', user.id)
    // Trigger trg_activities_mark_suggestions_outdated trong DB sẽ tự động đánh dấu review_suggestions liên quan thành 'outdated'
    const { error } = await supabase
      .from('activities')
      .delete()
      .eq('id', activityId)
      .eq('user_id', user.id);

    if (error) {
      return {
        success: false,
        message: `Lỗi khi xóa hoạt động: ${error.message}`,
      };
    }

    // Cập nhật lại cache của trang nhật ký và trang tổng quan dashboard
    revalidatePath('/activities');
    revalidatePath('/dashboard');

    return {
      success: true,
      message: 'Đã xóa hoạt động thành công!',
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Đã có lỗi xảy ra khi xóa hoạt động.',
    };
  }
}
