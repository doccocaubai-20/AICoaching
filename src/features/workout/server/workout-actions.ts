'use server';

import { revalidatePath } from 'next/cache';
import { requireAuthenticatedUser } from '@/lib/server/auth-guard';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  WorkoutRunEntity,
  WorkoutSetEntity,
  ExerciseItemSnapshot,
  RecordWorkoutSetSchema,
  FinalizeWorkoutRunSchema,
  PreviousExerciseComparison,
  compareExerciseRecords,
  normalizeExerciseName,
} from '../contracts/workout.contract';

export interface ActionResult<T = unknown> {
  success: boolean;
  message?: string;
  errors?: Record<string, string>;
  data?: T;
}

/**
 * 1. KHỞI TẠO HOẶC LẤY PHIÊN TẬP ĐANG DỞ
 * Ưu tiên: nếu đã có lượt đang dở (in_progress hoặc paused), trả về ngay lượt đó để tiếp tục.
 */
export async function startWorkoutRunAction(params: {
  sessionId?: string;
  programId?: string;
  sessionTitle?: string;
  exercises?: ExerciseItemSnapshot[];
  idempotencyKey?: string;
}): Promise<ActionResult<{ runId: string; isExisting: boolean }>> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();

    if (!supabase) {
      return { success: false, message: 'Chưa cấu hình Supabase credentials.' };
    }

    // 1. Kiểm tra lượt tập đang dở (in_progress hoặc paused)
    const { data: existingRun } = await (supabase as any)
      .from('workout_runs')
      .select('id, status')
      .eq('user_id', user.id)
      .in('status', ['in_progress', 'paused'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingRun) {
      return {
        success: true,
        data: { runId: existingRun.id, isExisting: true },
      };
    }

    // 2. Lấy thông tin bài tập từ DB nếu có sessionId
    let title = params.sessionTitle || 'Buổi tập Calisthenics';
    let programVersion = '1.0.0-demo';
    let exercisesSnapshot: ExerciseItemSnapshot[] = params.exercises || [];
    let isDemo = true;

    if (params.sessionId) {
      const { data: sessionRow } = await supabase
        .from('sessions')
        .select('title, exercises, is_demo, program_id')
        .eq('id', params.sessionId)
        .maybeSingle();

      if (sessionRow) {
        title = sessionRow.title;
        isDemo = sessionRow.is_demo ?? true;
        if (Array.isArray(sessionRow.exercises) && sessionRow.exercises.length > 0) {
          exercisesSnapshot = sessionRow.exercises as unknown as ExerciseItemSnapshot[];
        }
      }
    }

    // Nếu không có bài nào, dùng mẫu demo mặc định
    if (!exercisesSnapshot || exercisesSnapshot.length === 0) {
      exercisesSnapshot = [
        { name: 'Hít đất tiêu chuẩn (Push-up)', sets: 3, target_reps: '8-12', rest_seconds: 60, note: 'Khởi đầu' },
        { name: 'Treo xà đơn (Dead hang)', variant:'active_grip', assistance:'bodyweight', unit:'seconds', target_duration_seconds:20, sets: 3, target_reps: '20-30s', rest_seconds: 60, note: 'Giữ vai kích hoạt, không đung đưa' },
      ];
    }

    // Legacy content with an explicit seconds suffix remains a timed exercise.
    exercisesSnapshot=exercisesSnapshot.map(ex=>({...ex,unit:ex.unit || (/^\d+(?:-\d+)?\s*s$/i.test(ex.target_reps || '') ? 'seconds' : 'reps')}));

    // 3. Tạo workout_run mới với snapshot bài tập bất biến
    const idempotencyKey = params.idempotencyKey || `run_${user.id}_${Date.now()}`;

    const { data: runRow, error: runError } = await (supabase as any)
      .from('workout_runs')
      .insert({
        user_id: user.id,
        session_id: params.sessionId || null,
        program_id: params.programId || null,
        program_version: programVersion,
        session_title: title,
        status: 'in_progress',
        started_at: new Date().toISOString(),
        total_paused_duration_seconds: 0,
        exercises_snapshot: exercisesSnapshot as any,
        version: 1,
        idempotency_key: idempotencyKey,
        is_demo: isDemo,
      })
      .select('id')
      .single();

    if (runError || !runRow) {
      return {
        success: false,
        message: runError ? `Lỗi khi khởi tạo buổi tập: ${runError.message}` : 'Không thể tạo phiên tập.',
      };
    }

    const newRunId = runRow.id;

    // 4. Khởi tạo sẵn các hiệp tập trong workout_sets: actual_reps ban đầu để null
    const setsToInsert = [];
    for (let exIdx = 0; exIdx < exercisesSnapshot.length; exIdx++) {
      const ex = exercisesSnapshot[exIdx];
      const setsCount = ex.sets || 3;
      for (let s = 1; s <= setsCount; s++) {
        setsToInsert.push({
          run_id: newRunId,
          user_id: user.id,
          exercise_index: exIdx,
          exercise_name: ex.name,
          exercise_variant: ex.variant || null,
          set_order: s,
          target_reps: ex.target_reps || '10',
          target_load: ex.target_load || null,
          target_duration_seconds: ex.target_duration_seconds || null,
          target_assistance: ex.assistance || null,
          target_unit: ex.unit || 'reps',
          actual_reps: null, // ĐỂ TRỐNG BAN ĐẦU THEO ĐÚNG SPEC D3 MỤC 4
          actual_load: null,
          actual_duration_seconds: null,
          actual_unit: ex.unit || 'reps',
          actual_assistance: ex.assistance || null,
          status: 'pending',
          idempotency_key: `set_${newRunId}_${exIdx}_${s}`,
        });
      }
    }

    if (setsToInsert.length > 0) {
      await (supabase as any).from('workout_sets').insert(setsToInsert as any);
    }

    revalidatePath('/workout');
    return {
      success: true,
      data: { runId: newRunId, isExisting: false },
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Lỗi hệ thống khi bắt đầu buổi tập.',
    };
  }
}

/**
 * 2. ĐỌC DỮ LIỆU PHIÊN TẬP VÀ DANH SÁCH HIỆP
 */
export async function getWorkoutRunAction(
  runId: string
): Promise<ActionResult<{ run: WorkoutRunEntity; sets: WorkoutSetEntity[] }>> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();

    if (!supabase) {
      return { success: false, message: 'Chưa cấu hình Supabase credentials.' };
    }

    const { data: run, error: runError } = await (supabase as any)
      .from('workout_runs')
      .select('*')
      .eq('id', runId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (runError || !run) {
      return {
        success: false,
        message: 'Không tìm thấy phiên tập hoặc bạn không có quyền truy cập.',
      };
    }

    const { data: sets, error: setsError } = await (supabase as any)
      .from('workout_sets')
      .select('*')
      .eq('run_id', runId)
      .eq('user_id', user.id)
      .order('exercise_index', { ascending: true })
      .order('set_order', { ascending: true });

    if (setsError) {
      return {
        success: false,
        message: `Lỗi đọc danh sách hiệp: ${setsError.message}`,
      };
    }

    return {
      success: true,
      data: {
        run: run as unknown as WorkoutRunEntity,
        sets: (sets || []) as unknown as WorkoutSetEntity[],
      },
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Lỗi khi tải phiên tập.',
    };
  }
}

/**
 * 3. LƯU TỪNG HIỆP TẬP (CÓ CHỐNG TRÙNG IDEMPOTENCY KEY)
 */
export async function saveWorkoutSetAction(
  rawInput: unknown
): Promise<ActionResult<{ setId: string; status: string }>> {
  try {
    const { user } = await requireAuthenticatedUser();
    const parsed = RecordWorkoutSetSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        message: 'Dữ liệu hiệp tập không hợp lệ.',
        errors: parsed.error.flatten().fieldErrors as Record<string, string>,
      };
    }

    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return { success: false, message: 'Chưa cấu hình Supabase credentials.' };
    }

    const input = parsed.data;

    // Gọi RPC record_workout_set đã chuẩn bị
    const { data: rpcRes, error: rpcError } = await (supabase as any).rpc('record_workout_set', {
      p_run_id: input.run_id,
      p_exercise_index: input.exercise_index,
      p_exercise_name: input.exercise_name,
      p_exercise_variant: input.exercise_variant || null,
      p_set_order: input.set_order,
      p_target_reps: input.target_reps,
      p_target_load: input.target_load ?? null,
      p_target_duration_seconds: input.target_duration_seconds ?? null,
      p_target_assistance: input.target_assistance ?? null,
      p_target_unit: input.target_unit || 'reps',
      p_actual_reps: input.actual_reps ?? null,
      p_actual_load: input.actual_load ?? null,
      p_actual_duration_seconds: input.actual_duration_seconds ?? null,
      p_actual_unit: input.actual_unit || 'reps',
      p_actual_assistance: input.actual_assistance ?? null,
      p_status: input.status,
      p_idempotency_key: input.idempotency_key,
    });

    if (rpcError) {
      return {
        success: false,
        message: `Lỗi khi lưu hiệp: ${rpcError.message}`,
      };
    }

    return {
      success: true,
      data: {
        setId: (rpcRes as any)?.set_id || '',
        status: input.status,
      },
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Lỗi hệ thống khi lưu hiệp tập.',
    };
  }
}

/**
 * 4. TẠM DỪNG PHIÊN TẬP (PAUSE)
 */
export async function pauseWorkoutRunAction(
  runId: string,
  expectedVersion?: number
): Promise<ActionResult<{ status: string; version: number }>> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return { success: false, message: 'Chưa cấu hình Supabase.' };
    }

    const { data, error } = await (supabase as any).rpc('pause_workout_run', {
      p_run_id: runId,
      p_expected_version: expectedVersion ?? null,
    });

    if (error) {
      return { success: false, message: `Lỗi tạm dừng: ${error.message}` };
    }

    revalidatePath(`/workout/${runId}`);
    return { success: true, data: data as any };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Lỗi tạm dừng.' };
  }
}

/**
 * 5. TIẾP TỤC TẬP (RESUME)
 */
export async function resumeWorkoutRunAction(
  runId: string,
  expectedVersion?: number
): Promise<ActionResult<{ status: string; version: number }>> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return { success: false, message: 'Chưa cấu hình Supabase.' };
    }

    const { data, error } = await (supabase as any).rpc('resume_workout_run', {
      p_run_id: runId,
      p_expected_version: expectedVersion ?? null,
    });

    if (error) {
      return { success: false, message: `Lỗi tiếp tục: ${error.message}` };
    }

    revalidatePath(`/workout/${runId}`);
    return { success: true, data: data as any };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Lỗi tiếp tục.' };
  }
}

/**
 * 6. HỦY BỎ PHIÊN TẬP (ABANDON)
 */
export async function abandonWorkoutRunAction(
  runId: string
): Promise<ActionResult<{ status: string }>> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return { success: false, message: 'Chưa cấu hình Supabase.' };
    }

    const { data, error } = await (supabase as any).rpc('abandon_workout_run', {
      p_run_id: runId,
    });

    if (error) {
      return { success: false, message: `Lỗi hủy: ${error.message}` };
    }

    revalidatePath('/workout');
    return { success: true, data: data as any };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Lỗi hủy phiên tập.' };
  }
}

/**
 * 7. HOÀN THÀNH PHIÊN TẬP (FINALIZE NGUYÊN TỬ)
 */
export async function finalizeWorkoutRunAction(
  rawInput: unknown
): Promise<ActionResult<{ run_id: string; duration_minutes: number; is_partial: boolean }>> {
  try {
    const { user } = await requireAuthenticatedUser();
    const parsed = FinalizeWorkoutRunSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        message: 'Dữ liệu kết thúc buổi tập không hợp lệ.',
        errors: parsed.error.flatten().fieldErrors as Record<string, string>,
      };
    }

    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return { success: false, message: 'Chưa cấu hình Supabase.' };
    }

    const input = parsed.data;

    const { data, error } = await (supabase as any).rpc('finalize_workout_run', {
      p_run_id: input.run_id,
      p_expected_version: input.expected_version,
      p_perceived_exertion: input.perceived_exertion,
      p_notes: input.notes || null,
      p_idempotency_key: input.idempotency_key,
      p_allow_partial: input.allow_partial,
    });

    if (error) {
      return {
        success: false,
        message: `Lỗi hoàn thành buổi tập: ${error.message}`,
      };
    }

    revalidatePath('/workout');
    revalidatePath(`/workout/${input.run_id}`);
    revalidatePath('/programs');
    revalidatePath('/activities');
    revalidatePath('/dashboard');

    return { success: true, data: data as any };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Lỗi khi hoàn thành buổi tập.',
    };
  }
}

/**
 * 8. LẤY THÀNH TÍCH LẦN TRƯỚC CHO ĐỘNG TÁC (ĐỐI CHIẾU CHÍNH XÁC, KHÔNG FUZZY)
 */
export async function getPreviousExerciseRecordAction(params: {
  exerciseName: string;
  variant?: string;
  unit?: string;
  assistance?: string;
}): Promise<ActionResult<PreviousExerciseComparison>> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return {
        success: true,
        data: { hasComparison: false, reason: 'no_previous_record' },
      };
    }

    // Tìm trong workout_sets của các run đã hoàn thành trước đây của chính user này
    const { data: candidateSets } = await (supabase as any)
      .from('workout_sets')
      .select('exercise_name, exercise_variant, actual_unit, actual_assistance, set_order, actual_reps, actual_load, actual_duration_seconds, completed_at, run_id')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .not('actual_reps', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(50);

    if (!candidateSets || candidateSets.length === 0) {
      return {
        success: true,
        data: { hasComparison: false, reason: 'no_previous_record' },
      };
    }

    // Nhóm theo run_id gần nhất có chứa bài tập này
    const targetNorm = normalizeExerciseName(params.exerciseName);
    const matchingRunSets = (candidateSets as any[]).filter(
      (s: any) => normalizeExerciseName(s.exercise_name) === targetNorm
    );

    if (matchingRunSets.length === 0) {
      return {
        success: true,
        data: { hasComparison: false, reason: 'no_previous_record' },
      };
    }

    const latestRunId = matchingRunSets[0].run_id;
    const latestSets = matchingRunSets.filter((s: any) => s.run_id === latestRunId);

    const comparison = compareExerciseRecords(
      {
        name: params.exerciseName,
        variant: params.variant,
        unit: params.unit,
        assistance: params.assistance,
      },
      {
        exercise_name: latestSets[0].exercise_name,
        exercise_variant: latestSets[0].exercise_variant,
        unit: latestSets[0].actual_unit,
        assistance: latestSets[0].actual_assistance,
        completed_at: latestSets[0].completed_at || undefined,
        is_demo: false, // Dữ liệu thật của user
        sets: latestSets.map((s: any) => ({
          set_order: s.set_order,
          actual_reps: s.actual_reps,
          actual_load: s.actual_load,
          actual_duration_seconds: s.actual_duration_seconds,
          actual_unit: s.actual_unit,
          actual_assistance: s.actual_assistance,
        })),
      }
    );

    return { success: true, data: comparison };
  } catch (err) {
    return {
      success: true,
      data: { hasComparison: false, reason: 'no_previous_record' },
    };
  }
}

/**
 * 9. DỜI LỊCH BUỔI TẬP DỰ KIẾN (CHỈ THAY ĐỔI LỊCH DỰ KIẾN, GIỮ LỊCH SỬ ĐÃ TẬP)
 */
export async function reschedulePlannedSessionAction(
  sessionId: string,
  newDateIso: string
): Promise<ActionResult<{ rescheduled: boolean; newDate: string }>> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return { success: false, message: 'Chưa cấu hình Supabase.' };
    }

    if (!newDateIso || isNaN(Date.parse(newDateIso))) {
      return { success: false, message: 'Ngày dời lịch không hợp lệ.' };
    }

    // Cập nhật hoạt động dự kiến (is_planned = true) của session này
    // TUYỆT ĐỐI KHÔNG SỬA các hoạt động đã hoàn thành (is_planned = false)
    const { data: updatedActivities, error } = await supabase
      .from('activities')
      .update({
        start_at: newDateIso,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('is_planned', true)
      .ilike('notes', `%${sessionId}%`)
      .select('id');

    if (error) {
      return { success: false, message: `Lỗi khi dời lịch: ${error.message}` };
    }

    revalidatePath('/programs');
    revalidatePath('/activities');
    return {
      success: true,
      data: { rescheduled: true, newDate: newDateIso },
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Lỗi khi dời lịch buổi tập.',
    };
  }
}

/**
 * 10. LẤY BUỔI TẬP ĐANG DỞ CỦA NGƯỜI DÙNG HIỆN TẠI
 */
export async function getActiveWorkoutRunForUserAction(): Promise<
  ActionResult<WorkoutRunEntity | null>
> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return { success: true, data: null };
    }

    const { data: run, error } = await (supabase as any)
      .from('workout_runs')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['in_progress', 'paused'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, data: (run as unknown as WorkoutRunEntity) || null };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Lỗi hệ thống.' };
  }
}
