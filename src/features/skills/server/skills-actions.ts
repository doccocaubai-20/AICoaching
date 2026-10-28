'use server';

/**
 * AGENT C - SERVER ACTIONS FOR SKILL JOURNEYS
 * D4 Hành trình kỹ năng có bằng chứng
 */

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireAuthenticatedUser } from '@/lib/server/auth-guard';
import type { Database } from '@/contracts/database.types';
import type { AgentCDatabaseTypes } from '@/contracts/database-c.types';
import {
  type ActionResult,
  type SkillJourney,
  type SkillMilestone,
  type JourneyAttempt,
  type JourneyDetails,
  type MilestoneProgress,
  type RecordAttemptInput,
  type JourneySummaryDTO,
  type SourceRef,
  validateRecordAttemptInput,
  calculateMilestoneStatus,
} from '../contracts/skills.contract';

export type SkillsDatabase = {
  public: {
    Tables: {
      [K in keyof Database['public']['Tables'] | keyof AgentCDatabaseTypes]: K extends keyof AgentCDatabaseTypes
        ? AgentCDatabaseTypes[K]
        : K extends keyof Database['public']['Tables']
        ? Database['public']['Tables'][K]
        : never;
    };
    Views: Database['public']['Views'];
    Functions: Database['public']['Functions'];
    Enums: Database['public']['Enums'];
    CompositeTypes: Database['public']['CompositeTypes'];
  };
};

export type SkillsSupabaseClient = SupabaseClient<SkillsDatabase>;

async function getSkillsServerClient(): Promise<SkillsSupabaseClient | null> {
  const client = await createServerSupabaseClient();
  return client as unknown as SkillsSupabaseClient | null;
}

/**
 * Lấy danh sách các hành trình mẫu có sẵn
 */
export async function getAvailableJourneysAction(): Promise<ActionResult<SkillJourney[]>> {
  try {
    const supabase = await getSkillsServerClient();
    if (!supabase) {
      return { success: false, message: 'Chưa cấu hình cơ sở dữ liệu Supabase.', errorCode: 'DB_UNAVAILABLE' };
    }

    const { data, error } = await supabase
      .from('skill_journeys')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      return { success: false, message: 'Không thể tải danh sách hành trình: ' + error.message, errorCode: error.code };
    }

    const journeys: SkillJourney[] = (data || []).map((row: any) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      contentSource: row.content_source,
      criteriaVersion: row.criteria_version,
      isDemoIllustration: row.is_demo_illustration,
      disclaimer: row.disclaimer,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return { success: true, data: journeys };
  } catch (err: any) {
    return { success: false, message: 'Lỗi máy chủ khi lấy danh sách hành trình: ' + (err?.message || String(err)) };
  }
}

/**
 * Lấy chi tiết một hành trình kèm danh sách mốc và các lần thử của người dùng
 */
export async function getJourneyDetailsAction(journeyId = 'pull_up_mastery'): Promise<ActionResult<JourneyDetails>> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await getSkillsServerClient();
    if (!supabase) {
      return { success: false, message: 'Chưa cấu hình Supabase.', errorCode: 'DB_UNAVAILABLE' };
    }

    // 1. Tải thông tin hành trình
    const { data: journeyData, error: journeyError } = await supabase
      .from('skill_journeys')
      .select('*')
      .eq('id', journeyId)
      .maybeSingle();

    if (journeyError || !journeyData) {
      return {
        success: false,
        message: journeyError ? journeyError.message : 'Không tìm thấy hành trình kỹ năng yêu cầu.',
        errorCode: 'JOURNEY_NOT_FOUND',
      };
    }

    // 2. Tải các mốc tiêu chí của hành trình
    const { data: milestonesData, error: milestonesError } = await supabase
      .from('skill_milestones')
      .select('*')
      .eq('journey_id', journeyId)
      .order('sequence_order', { ascending: true });

    if (milestonesError) {
      return { success: false, message: 'Không thể tải các mốc tiêu chí: ' + milestonesError.message };
    }

    // 3. Tải các lần thử của người dùng cho hành trình này
    const { data: attemptsData, error: attemptsError } = await supabase
      .from('journey_attempts')
      .select('*')
      .eq('user_id', user.id)
      .eq('journey_id', journeyId)
      .order('attempted_at', { ascending: false });

    if (attemptsError) {
      return { success: false, message: 'Không thể tải lịch sử lần thử: ' + attemptsError.message };
    }

    const journey: SkillJourney = {
      id: journeyData.id,
      title: journeyData.title,
      description: journeyData.description,
      contentSource: journeyData.content_source,
      criteriaVersion: journeyData.criteria_version,
      isDemoIllustration: journeyData.is_demo_illustration,
      disclaimer: journeyData.disclaimer,
      createdAt: journeyData.created_at,
      updatedAt: journeyData.updated_at,
    };

    const attemptsMap = new Map<string, JourneyAttempt[]>();
    for (const raw of attemptsData || []) {
      const attempt: JourneyAttempt = {
        id: raw.id,
        userId: raw.user_id,
        journeyId: raw.journey_id,
        milestoneId: raw.milestone_id,
        attemptedAt: raw.attempted_at,
        exerciseId: raw.exercise_id,
        variantId: raw.variant_id,
        assistance: raw.assistance,
        actualReps: raw.actual_reps,
        actualDurationSeconds: raw.actual_duration_seconds,
        notes: raw.notes,
        isAchievedSelfReported: raw.is_achieved_self_reported,
        status: raw.status as 'attempted' | 'self_reported_achieved' | 'needs_review',
        sourceRef: (raw.source_ref as unknown) as SourceRef | null,
        sourceInvalidatedAt: raw.source_invalidated_at,
        sourceInvalidationReason: raw.source_invalidation_reason,
        videoId: raw.video_id,
        idempotencyKey: raw.idempotency_key,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
      };

      const list = attemptsMap.get(raw.milestone_id) || [];
      list.push(attempt);
      attemptsMap.set(raw.milestone_id, list);
    }

    let achievedCount = 0;
    let needsReviewCount = 0;
    let attemptedCount = 0;

    const milestones: MilestoneProgress[] = (milestonesData || []).map((mRow: any) => {
      const milestone: SkillMilestone = {
        id: mRow.id,
        journeyId: mRow.journey_id,
        sequenceOrder: mRow.sequence_order,
        title: mRow.title,
        description: mRow.description,
        criteriaDescription: mRow.criteria_description,
        exerciseId: mRow.exercise_id,
        variantId: mRow.variant_id,
        assistance: mRow.assistance,
        targetReps: mRow.target_reps,
        targetDurationSeconds: mRow.target_duration_seconds,
        criteriaVersion: mRow.criteria_version,
        isDemoIllustration: mRow.is_demo_illustration,
        createdAt: mRow.created_at,
        updatedAt: mRow.updated_at,
      };

      const mAttempts = attemptsMap.get(milestone.id) || [];
      const status = calculateMilestoneStatus(mAttempts);

      if (status === 'self_reported_achieved') achievedCount++;
      if (status === 'needs_review') needsReviewCount++;
      if (status === 'attempted') attemptedCount++;

      const latestAttempt = mAttempts.length > 0 ? mAttempts[0] : null;
      const hasVideoAttached = mAttempts.some((a) => Boolean(a.videoId));
      const achievedAttemptsCount = mAttempts.filter((a) => a.isAchievedSelfReported).length;

      return {
        milestone,
        status,
        attemptsCount: mAttempts.length,
        achievedAttemptsCount,
        latestAttempt,
        hasVideoAttached,
      };
    });

    return {
      success: true,
      data: {
        journey,
        milestones,
        totalMilestones: milestones.length,
        achievedMilestonesCount: achievedCount,
        needsReviewMilestonesCount: needsReviewCount,
        attemptedMilestonesCount: attemptedCount,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Lỗi máy chủ khi lấy chi tiết hành trình: ' + (err?.message || String(err)),
      errorCode: err?.name === 'UnauthorizedError' ? 'UNAUTHORIZED' : 'SERVER_ERROR',
    };
  }
}

/**
 * Ghi nhận một lần thử cho mốc kỹ năng
 */
export async function recordJourneyAttemptAction(input: RecordAttemptInput): Promise<ActionResult<JourneyAttempt>> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await getSkillsServerClient();
    if (!supabase) {
      return { success: false, message: 'Chưa cấu hình Supabase.', errorCode: 'DB_UNAVAILABLE' };
    }

    // 1. Kiểm tra tính hợp lệ của input
    const validation = validateRecordAttemptInput(input);
    if (!validation.isValid) {
      return {
        success: false,
        message: 'Dữ liệu lần thử không hợp lệ.',
        errorCode: 'VALIDATION_ERROR',
        fieldErrors: validation.errors,
      };
    }

    // The DB uses the same exact exercise matcher for listing and saving evidence.
    if (input.sourceRef) {
      const eligible = await getEligibleEvidenceSourcesAction(input.exerciseId, input.variantId || 'standard', input.assistance || 'bodyweight');
      const source = eligible.data?.find(item => item.id === input.sourceRef?.sourceId && item.sourceType === input.sourceRef.sourceType);
      if (!eligible.success || !source) return { success: false, message: 'Nguồn phải là buổi tập đã hoàn thành đúng động tác, biến thể và mức hỗ trợ. Bạn có thể bỏ gắn nguồn để ghi lần thử độc lập.', errorCode: 'INCOMPATIBLE_EVIDENCE' };
      input = { ...input, sourceRef: { sourceType: source.sourceType, sourceId: source.id, recordedAt: source.date } };
    }

    // 3. Kiểm tra video đính kèm (nếu có)
    if (input.videoId) {
      const { data: vid, error: vidErr } = await supabase
        .from('journey_videos')
        .select('id, user_id, status, exercise_id, variant_id')
        .eq('id', input.videoId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (vidErr || !vid) {
        return {
          success: false,
          message: 'Từ chối đính kèm video: Tệp video không tồn tại hoặc bạn không sở hữu.',
          errorCode: 'FORBIDDEN_OWNERSHIP',
        };
      }

      if (vid.status !== 'ready' || vid.exercise_id !== input.exerciseId || vid.variant_id !== (input.variantId || 'standard')) {
        return {
          success: false,
          message: 'Video phải tải xong và đúng động tác, biến thể của lần thử.',
          errorCode: 'VIDEO_UNAVAILABLE',
        };
      }
    }

    // 4. Trạng thái lần thử: self_reported_achieved hoặc attempted
    const initialStatus: 'attempted' | 'self_reported_achieved' | 'needs_review' = input.isAchievedSelfReported ? 'self_reported_achieved' : 'attempted';

    const insertPayload = {
      user_id: user.id,
      journey_id: input.journeyId,
      milestone_id: input.milestoneId,
      attempted_at: input.attemptedAt || new Date().toISOString(),
      exercise_id: input.exerciseId,
      variant_id: input.variantId || 'standard',
      assistance: input.assistance || 'bodyweight',
      actual_reps: input.actualReps !== undefined ? input.actualReps : null,
      actual_duration_seconds: input.actualDurationSeconds !== undefined ? input.actualDurationSeconds : null,
      notes: input.notes ? input.notes.trim() : null,
      is_achieved_self_reported: input.isAchievedSelfReported,
      status: initialStatus,
      source_ref: (input.sourceRef as any) || null,
      video_id: input.videoId || null,
      idempotency_key: input.idempotencyKey ? input.idempotencyKey.trim() : null,
    };

    const { data: newAttempt, error: insertError } = (await supabase
      .from('journey_attempts')
      .insert(insertPayload)
      .select('*')
      .single()) as { data: AgentCDatabaseTypes['journey_attempts']['Row'] | null; error: any };

    if (insertError) {
      // Xử lý idempotency conflict
      if (insertError.code === '23505' && input.idempotencyKey) {
        const { data: existing } = (await supabase
          .from('journey_attempts')
          .select('*')
          .eq('user_id', user.id)
          .eq('idempotency_key', input.idempotencyKey.trim())
          .single()) as { data: AgentCDatabaseTypes['journey_attempts']['Row'] | null; error: any };

        if (existing) {
          return {
            success: true,
            data: {
              id: existing.id,
              userId: existing.user_id,
              journeyId: existing.journey_id,
              milestoneId: existing.milestone_id,
              attemptedAt: existing.attempted_at,
              exerciseId: existing.exercise_id,
              variantId: existing.variant_id,
              assistance: existing.assistance,
              actualReps: existing.actual_reps,
              actualDurationSeconds: existing.actual_duration_seconds,
              notes: existing.notes,
              isAchievedSelfReported: existing.is_achieved_self_reported,
              status: existing.status,
              sourceRef: existing.source_ref as unknown as SourceRef | null,
              sourceInvalidatedAt: existing.source_invalidated_at,
              sourceInvalidationReason: existing.source_invalidation_reason,
              videoId: existing.video_id,
              idempotencyKey: existing.idempotency_key,
              createdAt: existing.created_at,
              updatedAt: existing.updated_at,
            },
          };
        }
      }

      return {
        success: false,
        message: 'Không thể lưu lần thử: ' + insertError.message,
        errorCode: insertError.code,
      };
    }

    if (!newAttempt) {
      return { success: false, message: 'Lỗi không nhận được bản ghi sau khi lưu.' };
    }

    revalidatePath('/journey');
    revalidatePath('/dashboard');

    return {
      success: true,
      data: {
        id: newAttempt.id,
        userId: newAttempt.user_id,
        journeyId: newAttempt.journey_id,
        milestoneId: newAttempt.milestone_id,
        attemptedAt: newAttempt.attempted_at,
        exerciseId: newAttempt.exercise_id,
        variantId: newAttempt.variant_id,
        assistance: newAttempt.assistance,
        actualReps: newAttempt.actual_reps,
        actualDurationSeconds: newAttempt.actual_duration_seconds,
        notes: newAttempt.notes,
        isAchievedSelfReported: newAttempt.is_achieved_self_reported,
        status: newAttempt.status,
        sourceRef: newAttempt.source_ref as unknown as SourceRef | null,
        sourceInvalidatedAt: newAttempt.source_invalidated_at,
        sourceInvalidationReason: newAttempt.source_invalidation_reason,
        videoId: newAttempt.video_id,
        idempotencyKey: newAttempt.idempotency_key,
        createdAt: newAttempt.created_at,
        updatedAt: newAttempt.updated_at,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Lỗi máy chủ khi ghi nhận lần thử: ' + (err?.message || String(err)),
      errorCode: err?.name === 'UnauthorizedError' ? 'UNAUTHORIZED' : 'SERVER_ERROR',
    };
  }
}

/**
 * Xóa một lần thử của người dùng
 */
export async function deleteJourneyAttemptAction(attemptId: string): Promise<ActionResult<void>> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await getSkillsServerClient();
    if (!supabase) return { success: false, message: 'Chưa cấu hình Supabase.' };

    const { error } = await supabase
      .from('journey_attempts')
      .delete()
      .eq('id', attemptId)
      .eq('user_id', user.id);

    if (error) {
      return { success: false, message: 'Không thể xóa lần thử: ' + error.message };
    }

    revalidatePath('/journey');
    return { success: true };
  } catch (err: any) {
    return { success: false, message: 'Lỗi máy chủ khi xóa lần thử: ' + (err?.message || String(err)) };
  }
}

/**
 * Tóm tắt hành trình kỹ năng phục vụ Dashboard / Programs Integration
 * Không tải URL hàng loạt, chỉ trả metadata cần thiết.
 */
export async function getJourneySummary(userId: string): Promise<JourneySummaryDTO | null> {
  try {
    const supabase = await getSkillsServerClient();
    if (!supabase) return null;

    const { data: journey } = await supabase
      .from('skill_journeys')
      .select('id, title, criteria_version, is_demo_illustration, disclaimer')
      .eq('id', 'pull_up_mastery')
      .maybeSingle();

    if (!journey) return null;

    const { data: milestones } = await supabase
      .from('skill_milestones')
      .select('id')
      .eq('journey_id', journey.id);

    const totalMilestones = milestones?.length || 0;

    const { data: attempts } = await supabase
      .from('journey_attempts')
      .select('id, milestone_id, exercise_id, attempted_at, is_achieved_self_reported, status')
      .eq('user_id', userId)
      .eq('journey_id', journey.id)
      .order('attempted_at', { ascending: false });

    const attemptsList = attempts || [];
    const achievedMilestoneIds = new Set<string>();
    const needsReviewMilestoneIds = new Set<string>();

    for (const a of attemptsList) {
      if (a.is_achieved_self_reported && a.status === 'self_reported_achieved') {
        achievedMilestoneIds.add(a.milestone_id);
      }
      if (a.status === 'needs_review') {
        needsReviewMilestoneIds.add(a.milestone_id);
      }
    }

    const latestAttempt = attemptsList[0] || null;

    return {
      journeyId: journey.id,
      activeJourneyId: journey.id,
      title: journey.title,
      journeyTitle: journey.title,
      criteriaVersion: journey.criteria_version,
      totalMilestones,
      achievedCount: achievedMilestoneIds.size,
      needsReviewCount: needsReviewMilestoneIds.size,
      attemptedCount: attemptsList.length,
      latestAttemptAt: latestAttempt ? latestAttempt.attempted_at : null,
      isDemoIllustration: journey.is_demo_illustration,
    };
  } catch {
    return null;
  }
}

export interface EligibleEvidenceSource {
  id: string;
  sourceType: 'activity' | 'session_result';
  title: string;
  date: string;
  details: string;
}

/**
 * Lấy danh sách các chứng cứ thực tế (hoạt động / kết quả buổi tập) của người dùng hiện tại (F1)
 */
export async function getEligibleEvidenceSourcesAction(
  exerciseId?: string, variantId = 'standard', assistance = 'bodyweight', runId?: string
): Promise<ActionResult<EligibleEvidenceSource[]>> {
  try {
    await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) return { success:false, message:'Chưa cấu hình Supabase.' };
    if (!exerciseId) return { success:true, data:[] };
    const {data,error} = await (supabase as any).rpc('get_compatible_journey_evidence', {
      p_exercise_id:exerciseId, p_variant_id:variantId, p_assistance:assistance, p_run_id:runId || null,
    });
    if (error) return { success:false, message:'Không thể tải nguồn chứng cứ. Vui lòng thử lại.' };
    return {success:true,data:(data || []).map((row:any)=>({
      id:row.source_id,sourceType:row.source_type as 'activity' | 'session_result',title:row.title,date:row.recorded_at,
      details:'Đã hoàn thành đúng động tác, biến thể và mức hỗ trợ',
    }))};
  } catch { return {success:false,message:'Không thể tải nguồn chứng cứ.'}; }
}
