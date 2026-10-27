'use server';

import { revalidatePath } from 'next/cache';
import { requireAuthenticatedUser } from '@/lib/server/auth-guard';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  IDEMPOTENCY_CONFLICT_TARGET,
  ReviewSuggestionStatus,
  ReviewSuggestionEntity,
  Json,
} from '@/contracts';
import {
  cleanCompletedExercises,
  validateSessionDuration,
  parsePerceivedExertion,
} from '@/components/programs/program-utils';
import {
  evaluateScheduleReview,
} from '@/components/review/review-utils';
import { ActivityEntity } from '@/contracts';

export interface ActionResult<T = unknown> {
  success: boolean;
  message?: string;
  errors?: Record<string, string>;
  data?: T;
}

// ==============================================================================
// 1. GHI KẾT QUẢ BUỔI TẬP VÀ ĐỒNG BỘ VÀO HỒ SƠ (P0)
// ==============================================================================

export async function recordSessionResultAction(
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

    const sessionId = (formData.get('session_id') as string)?.trim();
    const completedAt = (formData.get('completed_at') as string)?.trim();
    const durationRaw = formData.get('duration_minutes') as string;
    const durationMinutes = parseInt(durationRaw, 10);
    const exertion = parsePerceivedExertion(formData.get('perceived_exertion'));
    const notesRaw = formData.get('notes') as string;
    const notes = notesRaw && notesRaw.trim() !== '' ? notesRaw.trim() : null;
    const idempotencyKey = (formData.get('idempotency_key') as string)?.trim();
    const exercisesJsonRaw = formData.get('completed_exercises') as string;

    if (!sessionId) {
      return {
        success: false,
        message: 'Thiếu mã định danh buổi tập.',
      };
    }

    if (!idempotencyKey) {
      return {
        success: false,
        message: 'Thiếu khóa chống ghi trùng (idempotency key). Vui lòng thử lại.',
      };
    }

    if (!completedAt || isNaN(Date.parse(completedAt))) {
      return {
        success: false,
        message: 'Thời gian hoàn thành không hợp lệ.',
      };
    }

    // 1. Kiểm tra thời lượng buổi tập
    const durationCheck = validateSessionDuration(durationMinutes);
    if (!durationCheck.isValid) {
      return {
        success: false,
        message: durationCheck.error || 'Thời lượng không hợp lệ.',
        errors: { duration_minutes: durationCheck.error || 'Thời lượng không hợp lệ.' },
      };
    }

    // Kiểm tra trước khi ghi bất kỳ bảng nào: giá trị sai sẽ bị CHECK 1-10 của activities chặn
    // sau khi session_results đã lưu, khiến "bấm lưu lại" lỗi mãi
    if (exertion.error) {
      return {
        success: false,
        message: exertion.error,
        errors: { perceived_exertion: exertion.error },
      };
    }
    const perceivedExertion = exertion.value;

    // Lấy tên buổi tập từ database thay vì từ form; đồng thời xác nhận buổi tập đọc được (RLS)
    const { data: sessionRow, error: sessionLookupError } = await supabase
      .from('sessions')
      .select('title')
      .eq('id', sessionId)
      .maybeSingle();

    if (sessionLookupError || !sessionRow) {
      return {
        success: false,
        message: 'Không tìm thấy buổi tập. Vui lòng tải lại trang.',
      };
    }
    const sessionTitle = sessionRow.title;

    // 2. Làm sạch kết quả động tác: loại bỏ động tác chưa hoàn thành, không ghi 0
    let parsedExercisesRaw: unknown = [];
    if (exercisesJsonRaw) {
      try {
        parsedExercisesRaw = JSON.parse(exercisesJsonRaw);
      } catch {
        parsedExercisesRaw = [];
      }
    }
    const completedExercises = cleanCompletedExercises(parsedExercisesRaw);

    // 3. Bước 1: Lưu session_results với idempotency_key
    const { error: sessionResultError } = await supabase
      .from('session_results')
      .upsert(
        {
          session_id: sessionId,
          user_id: user.id,
          completed_at: completedAt,
          self_reported_data: {
            completed_exercises: completedExercises,
            perceived_exertion_1_10: perceivedExertion,
          } as unknown as Json,
          notes,
          idempotency_key: idempotencyKey,
          is_demo: true,
        },
        {
          onConflict: IDEMPOTENCY_CONFLICT_TARGET,
          ignoreDuplicates: true,
        }
      );

    if (sessionResultError) {
      return {
        success: false,
        message: `Lỗi khi lưu kết quả buổi tập: ${sessionResultError.message}`,
      };
    }

    // 4. Bước 2: Lưu hoạt động calisthenics nguồn session_sync với CÙNG idempotency_key
    // để nhật ký, dashboard và AI thấy được buổi tập ("hồ sơ được cập nhật")
    const activityNotes = notes
      ? `Buổi tập minh họa: ${sessionTitle} • ${notes}`
      : `Buổi tập minh họa: ${sessionTitle}`;

    const { error: activityError } = await supabase
      .from('activities')
      .upsert(
        {
          user_id: user.id,
          activity_type: 'calisthenics',
          is_planned: false,
          start_at: completedAt,
          duration_minutes: durationMinutes,
          fatigue_level: perceivedExertion,
          notes: activityNotes,
          source: 'session_sync',
          idempotency_key: idempotencyKey,
        },
        {
          onConflict: IDEMPOTENCY_CONFLICT_TARGET,
          ignoreDuplicates: true,
        }
      );

    if (activityError) {
      // Báo lỗi nhưng vẫn giữ form để người dùng có thể gửi lại cùng khóa
      return {
        success: false,
        message: `Kết quả buổi tập đã lưu nhưng chưa đồng bộ được vào nhật ký: ${activityError.message}. Bấm lưu lại để tiếp tục.`,
      };
    }

    // 5. Cập nhật lại cache cho các trang liên quan
    revalidatePath('/programs');
    revalidatePath('/activities');
    revalidatePath('/dashboard');

    return {
      success: true,
      message: 'Đã lưu kết quả buổi tập và cập nhật vào hồ sơ!',
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Đã có lỗi xảy ra khi ghi kết quả buổi tập.',
    };
  }
}

// ==============================================================================
// 2. QUY TẮC XEM LẠI LỊCH (P1)
// ==============================================================================

export async function evaluateAndSaveReviewSuggestionAction(): Promise<
  ActionResult<ReviewSuggestionEntity | null>
> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();

    if (!supabase) {
      return {
        success: false,
        message: 'Chưa cấu hình Supabase credentials.',
      };
    }

    // Tải hoạt động ở server: không nhận danh sách từ client để tránh lý do/ID tham chiếu bịa
    const { data: activitiesData, error: activitiesError } = await supabase
      .from('activities')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_planned', false)
      .order('start_at', { ascending: false });

    if (activitiesError) {
      return {
        success: false,
        message: 'Không tải được nhật ký hoạt động để kiểm tra lịch, thử lại sau.',
      };
    }

    const evaluation = evaluateScheduleReview((activitiesData as ActivityEntity[]) || []);

    if (evaluation.status !== 'needs_review') {
      return {
        success: true,
        message: evaluation.reason,
        data: null,
      };
    }

    // Lưu gợi ý với trạng thái pending
    const { data, error } = await supabase
      .from('review_suggestions')
      .insert({
        user_id: user.id,
        status: 'pending',
        reason: evaluation.reason,
        reference_activity_ids: evaluation.reference_activity_ids,
        rule_version: evaluation.rule_version,
        is_demo: true,
      })
      .select()
      .maybeSingle();

    if (error) {
      // Mã lỗi 23505: Vi phạm index uq_review_suggestions_active (gợi ý đang còn hiệu lực đã tồn tại)
      if (error.code === '23505') {
        return {
          success: true,
          message: 'Gợi ý xem lại lịch đã tồn tại và đang chờ xem xét.',
          data: null,
        };
      }

      return {
        success: false,
        message: `Lỗi khi lưu gợi ý xem lại lịch: ${error.message}`,
      };
    }

    revalidatePath('/programs');
    revalidatePath('/dashboard');

    return {
      success: true,
      message: 'Đã tạo gợi ý xem lại lịch!',
      data: (data as ReviewSuggestionEntity) || null,
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Đã có lỗi xảy ra khi đánh giá lịch.',
    };
  }
}

export async function updateReviewSuggestionStatusAction(
  suggestionId: string,
  newStatus: 'acknowledged' | 'dismissed'
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

    if (!suggestionId || typeof suggestionId !== 'string') {
      return {
        success: false,
        message: 'Mã định danh gợi ý không hợp lệ.',
      };
    }

    const { error } = await supabase
      .from('review_suggestions')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', suggestionId)
      .eq('user_id', user.id);

    if (error) {
      return {
        success: false,
        message: `Lỗi khi cập nhật trạng thái gợi ý: ${error.message}`,
      };
    }

    revalidatePath('/programs');
    revalidatePath('/dashboard');

    return {
      success: true,
      message:
        newStatus === 'acknowledged'
          ? 'Đã ghi nhận gợi ý xem lại lịch.'
          : 'Đã bỏ qua gợi ý xem lại lịch.',
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Đã có lỗi xảy ra khi cập nhật gợi ý.',
    };
  }
}
