'use server';

import { revalidatePath } from 'next/cache';
import { requireAuthenticatedUser } from '@/lib/server/auth-guard';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  validateProfileInput,
  validateGoalInput,
  validateObservationInput,
  ExperienceLevel,
  GoalType,
  GoalStatus,
  MetricType,
} from '@/contracts';
import { validateGoalDates } from '@/contracts';

export interface ActionResult<T = unknown> {
  success: boolean;
  message?: string;
  errors?: Record<string, string>;
  data?: T;
}

// ==============================================================================
// 1. PROFILE ACTIONS
// ==============================================================================

export async function updateProfileAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();

    if (!supabase) {
      return {
        success: false,
        message: 'Chưa cấu hình Supabase credentials. Vui lòng kiểm tra môi trường.',
      };
    }

    const displayName = (formData.get('display_name') as string)?.trim() ?? '';
    const experienceLevel = (formData.get('experience_level') as string) as ExperienceLevel;
    // Lấy toàn bộ danh sách dụng cụ người dùng chọn (có thể rỗng)
    const equipmentRaw = formData.getAll('available_equipment') as string[];
    const scheduleAvailabilityRaw = formData.get('schedule_availability') as string;

    let scheduleAvailability = [];
    if (scheduleAvailabilityRaw) {
      try {
        scheduleAvailability = JSON.parse(scheduleAvailabilityRaw);
      } catch {
        scheduleAvailability = [];
      }
    }

    // Xác thực qua hợp đồng @/contracts
    const validation = validateProfileInput({
      display_name: displayName,
      experience_level: experienceLevel,
      available_equipment: equipmentRaw,
      schedule_availability: scheduleAvailability,
    });

    if (!validation.is_valid) {
      return {
        success: false,
        message: 'Dữ liệu hồ sơ không hợp lệ. Vui lòng kiểm tra lại các trường báo lỗi.',
        errors: validation.errors,
      };
    }

    // Upsert theo user.id từ phiên đăng nhập (RLS bảo đảm an toàn, lưu đúng mảng rỗng nếu bỏ chọn hết)
    const { error } = await supabase.from('profiles').upsert(
      {
        user_id: user.id,
        display_name: displayName,
        experience_level: experienceLevel,
        available_equipment: equipmentRaw,
        schedule_availability: scheduleAvailability,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    if (error) {
      return {
        success: false,
        message: `Lỗi khi lưu hồ sơ: ${error.message}`,
      };
    }

    revalidatePath('/profile');
    revalidatePath('/dashboard');

    return {
      success: true,
      message: 'Cập nhật hồ sơ thành công!',
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Đã có lỗi xảy ra khi lưu hồ sơ.',
    };
  }
}

// ==============================================================================
// 2. GOALS ACTIONS
// ==============================================================================

export async function createGoalAction(
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

    const content = (formData.get('content') as string)?.trim() ?? '';
    const goalType = (formData.get('goal_type') as string) as GoalType;
    const startDate = (formData.get('start_date') as string) || null;
    const endDate = (formData.get('end_date') as string) || null;

    const validation = validateGoalInput({
      content,
      goal_type: goalType,
      start_date: startDate,
      end_date: endDate,
    });

    const dateError = validateGoalDates(startDate, endDate);
    const errors = { ...validation.errors };
    if (dateError) {
      errors.end_date = dateError;
    }

    if (!validation.is_valid || dateError) {
      return {
        success: false,
        message: dateError || 'Dữ liệu mục tiêu không hợp lệ.',
        errors,
      };
    }

    const { error } = await supabase.from('goals').insert({
      user_id: user.id,
      content,
      goal_type: goalType,
      status: 'active',
      start_date: startDate,
      end_date: endDate,
    });

    if (error) {
      return {
        success: false,
        message: `Lỗi khi thêm mục tiêu: ${error.message}`,
      };
    }

    revalidatePath('/profile');
    revalidatePath('/dashboard');

    return {
      success: true,
      message: 'Thêm mục tiêu mới thành công!',
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Đã có lỗi xảy ra khi tạo mục tiêu.',
    };
  }
}

export async function updateGoalAction(
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

    const goalId = (formData.get('goal_id') as string)?.trim() ?? '';
    if (!goalId) {
      return {
        success: false,
        message: 'Mã định danh mục tiêu không hợp lệ.',
      };
    }

    const content = (formData.get('content') as string)?.trim() ?? '';
    const goalType = (formData.get('goal_type') as string) as GoalType;
    const startDate = (formData.get('start_date') as string) || null;
    const endDate = (formData.get('end_date') as string) || null;

    const validation = validateGoalInput({
      content,
      goal_type: goalType,
      start_date: startDate,
      end_date: endDate,
    });

    const dateError = validateGoalDates(startDate, endDate);
    const errors = { ...validation.errors };
    if (dateError) {
      errors.end_date = dateError;
    }

    if (!validation.is_valid || dateError) {
      return {
        success: false,
        message: dateError || 'Dữ liệu chỉnh sửa mục tiêu không hợp lệ.',
        errors,
      };
    }

    // Cập nhật mục tiêu và kiểm tra quyền sở hữu .eq('user_id', user.id)
    const { error } = await supabase
      .from('goals')
      .update({
        content,
        goal_type: goalType,
        start_date: startDate,
        end_date: endDate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', goalId)
      .eq('user_id', user.id);

    if (error) {
      return {
        success: false,
        message: `Lỗi khi cập nhật mục tiêu: ${error.message}`,
      };
    }

    revalidatePath('/profile');
    revalidatePath('/dashboard');

    return {
      success: true,
      message: 'Cập nhật nội dung mục tiêu thành công!',
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Lỗi khi cập nhật mục tiêu.',
    };
  }
}

export async function updateGoalStatusAction(
  goalId: string,
  newStatus: GoalStatus
): Promise<ActionResult> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();

    if (!supabase) {
      return { success: false, message: 'Chưa cấu hình Supabase credentials.' };
    }

    // Chỉ cập nhật mục tiêu thuộc quyền sở hữu của user
    const { error } = await supabase
      .from('goals')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', goalId)
      .eq('user_id', user.id);

    if (error) {
      return { success: false, message: `Lỗi khi đổi trạng thái: ${error.message}` };
    }

    revalidatePath('/profile');
    revalidatePath('/dashboard');

    return { success: true, message: 'Cập nhật trạng thái mục tiêu thành công!' };
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Lỗi cập nhật trạng thái mục tiêu.',
    };
  }
}

export async function deleteGoalAction(goalId: string): Promise<ActionResult> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();

    if (!supabase) {
      return { success: false, message: 'Chưa cấu hình Supabase credentials.' };
    }

    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('id', goalId)
      .eq('user_id', user.id);

    if (error) {
      return { success: false, message: `Lỗi khi xóa mục tiêu: ${error.message}` };
    }

    revalidatePath('/profile');
    revalidatePath('/dashboard');

    return { success: true, message: 'Đã xóa mục tiêu thành công.' };
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Lỗi khi xóa mục tiêu.',
    };
  }
}

// ==============================================================================
// 3. OBSERVATION ACTIONS (CHỈ SỐ TỰ KHAI)
// Chiều cao/cân nặng tùy chọn, lưu theo ngày và nguồn tự khai.
// TUYỆT ĐỐI KHÔNG TÍNH ĐIỂM SỨC KHỎE TỔNG HỢP, KHÔNG SUY LUẬN Y KHOA.
// ==============================================================================

export async function createObservationAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();

    if (!supabase) {
      return { success: false, message: 'Chưa cấu hình Supabase credentials.' };
    }

    const metricType = (formData.get('metric_type') as string) as MetricType;
    const metricValueRaw = formData.get('metric_value') as string;
    const metricValue = parseFloat(metricValueRaw);
    const metricUnit = (formData.get('metric_unit') as string)?.trim() ?? (metricType === 'weight' ? 'kg' : 'cm');
    const observedAtRaw = formData.get('observed_at') as string;
    const observedAt = observedAtRaw ? new Date(observedAtRaw).toISOString() : new Date().toISOString();
    const notes = (formData.get('notes') as string)?.trim() || null;

    const validation = validateObservationInput({
      metric_type: metricType,
      metric_value: metricValue,
      metric_unit: metricUnit,
      observed_at: observedAt,
      notes,
    });

    if (!validation.is_valid) {
      return {
        success: false,
        message: 'Dữ liệu chỉ số tự khai không hợp lệ.',
        errors: validation.errors,
      };
    }

    const { error } = await supabase.from('observations').insert({
      user_id: user.id,
      metric_type: metricType,
      metric_value: metricValue,
      metric_unit: metricUnit,
      observed_at: observedAt,
      source: 'self_reported',
      notes,
    });

    if (error) {
      return { success: false, message: `Lỗi khi lưu chỉ số: ${error.message}` };
    }

    revalidatePath('/profile');
    revalidatePath('/dashboard');

    return {
      success: true,
      message: `Đã lưu chỉ số ${metricType === 'weight' ? 'cân nặng' : 'chiều cao'} (${metricValue} ${metricUnit}) tự khai!`,
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Lỗi khi lưu chỉ số tự khai.',
    };
  }
}

export async function deleteObservationAction(observationId: string): Promise<ActionResult> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();

    if (!supabase) {
      return { success: false, message: 'Chưa cấu hình Supabase credentials.' };
    }

    const { error } = await supabase
      .from('observations')
      .delete()
      .eq('id', observationId)
      .eq('user_id', user.id);

    if (error) {
      return { success: false, message: `Lỗi khi xóa chỉ số: ${error.message}` };
    }

    revalidatePath('/profile');
    revalidatePath('/dashboard');

    return { success: true, message: 'Đã xóa bản ghi chỉ số.' };
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Lỗi khi xóa chỉ số.',
    };
  }
}
