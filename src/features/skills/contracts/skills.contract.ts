/**
 * AGENT C - SKILLS JOURNEY CONTRACTS
 * Các định nghĩa kiểu, trạng thái, DTO và validator cho hành trình kỹ năng.
 */

export type MilestoneStatus =
  | 'not_attempted'
  | 'attempted'
  | 'self_reported_achieved'
  | 'needs_review';

export interface ExerciseRef {
  exerciseId: string;
  variantId?: string | null;
  assistance?: string | null;
}

export interface SourceRef {
  sourceType: 'activity' | 'session_result';
  sourceId: string;
  recordedAt: string;
}

export interface EvidencePickerItem {
  id: string;
  sourceType: 'activity' | 'session_result';
  title: string;
  date: string;
  durationMinutes?: number;
  activityType?: string;
  summaryNotes?: string;
}

export interface SkillMilestone {
  id: string;
  journeyId: string;
  journey_id?: string;
  sequenceOrder: number;
  order_index?: number;
  title: string;
  description?: string;
  criteriaDescription: string;
  criteria_description?: string;
  exerciseId: string;
  exercise_id?: string;
  variantId: string | null;
  variant_id?: string | null;
  assistance: string;
  assistance_standard?: string | null;
  targetReps: number | null;
  target_reps?: number | null;
  targetDurationSeconds: number | null;
  target_duration_seconds?: number | null;
  criteriaVersion?: string;
  criteria_version?: string;
  isDemoIllustration?: boolean;
  is_demo_illustration?: boolean;
  disclaimer?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
}

export interface SkillJourney {
  id: string;
  title: string;
  description: string;
  contentSource: string;
  content_source?: string;
  criteriaVersion: string;
  criteria_version?: string;
  isDemoIllustration: boolean;
  is_demo_illustration?: boolean;
  disclaimer: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
}

export interface JourneyAttempt {
  id: string;
  userId?: string;
  user_id?: string;
  journeyId?: string;
  journey_id?: string;
  milestoneId?: string;
  milestone_id?: string;
  attemptedAt?: string;
  attempted_at?: string;
  exerciseId?: string;
  exercise_id?: string;
  variantId?: string | null;
  variant_id?: string | null;
  assistance?: string | null;
  actualReps?: number | null;
  actual_reps?: number | null;
  actualDurationSeconds?: number | null;
  actual_duration_seconds?: number | null;
  notes?: string | null;
  isAchievedSelfReported?: boolean;
  is_achieved_self_reported?: boolean;
  status: 'attempted' | 'self_reported_achieved' | 'needs_review';
  sourceRef?: SourceRef | null;
  source_ref?: SourceRef | null;
  sourceInvalidatedAt?: string | null;
  source_invalidated_at?: string | null;
  sourceInvalidationReason?: string | null;
  source_invalidation_reason?: string | null;
  videoId?: string | null;
  video_id?: string | null;
  idempotencyKey?: string | null;
  idempotency_key?: string | null;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
}

export interface RecordAttemptInput {
  journeyId: string;
  milestoneId: string;
  attemptedAt?: string;
  exerciseId: string;
  variantId?: string | null;
  assistance?: string | null;
  actualReps?: number | null;
  actualDurationSeconds?: number | null;
  notes?: string | null;
  isAchievedSelfReported: boolean;
  sourceRef?: SourceRef | null;
  videoId?: string | null;
  idempotencyKey?: string | null;
}

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errorCode?: string;
  errors?: Record<string, string>;
  fieldErrors?: Record<string, string>;
  error?: {
    code: string;
    message: string;
  };
}

export type JourneySummaryDTO = JourneySummary;

export interface MilestoneProgress {
  milestone: SkillMilestone;
  status: MilestoneStatus;
  attemptsCount: number;
  latestAttempt?: JourneyAttempt | null;
  attemptsHistory?: JourneyAttempt[];
  achievedAttemptsCount?: number;
  hasVideoAttached?: boolean;
}

export interface JourneySummary {
  journeyId: string;
  activeJourneyId?: string;
  title: string;
  journeyTitle?: string;
  totalMilestones: number;
  achievedCount: number;
  needsReviewCount: number;
  attemptedCount: number;
  criteriaVersion: string;
  isDemoIllustration: boolean;
  latestAttemptAt?: string | null;
}

export interface JourneyDetails {
  journey: SkillJourney;
  milestones: MilestoneProgress[];
  totalMilestones: number;
  achievedMilestonesCount: number;
  needsReviewMilestonesCount: number;
  attemptedMilestonesCount: number;
}

/**
 * Validate input ghi lần thử kỹ năng
 */
export function validateRecordAttemptInput(input: RecordAttemptInput): {
  isValid: boolean;
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!input.journeyId || input.journeyId.trim().length === 0) {
    errors.journeyId = 'Thiếu mã hành trình';
  }

  if (!input.milestoneId || input.milestoneId.trim().length === 0) {
    errors.milestoneId = 'Thiếu mã mốc kỹ năng';
  }

  if (!input.exerciseId || input.exerciseId.trim().length === 0) {
    errors.exerciseId = 'Thiếu mã bài tập';
  }

  const hasReps = typeof input.actualReps === 'number' && input.actualReps > 0;
  const hasDuration = typeof input.actualDurationSeconds === 'number' && input.actualDurationSeconds > 0;

  if (!hasReps && !hasDuration) {
    errors.metrics = 'Phải ghi số lần (reps) hoặc thời gian thực hiện (giây) lớn hơn 0';
  }

  if (input.actualReps !== undefined && input.actualReps !== null) {
    if (input.actualReps < 0 || !Number.isInteger(input.actualReps)) {
      errors.actualReps = 'Số lần phải là số nguyên dương';
    }
  }

  if (input.actualDurationSeconds !== undefined && input.actualDurationSeconds !== null) {
    if (input.actualDurationSeconds < 0 || !Number.isInteger(input.actualDurationSeconds)) {
      errors.actualDurationSeconds = 'Thời gian phải là số nguyên dương (giây)';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Tính trạng thái tổng hợp của mốc kỹ năng dựa trên danh sách các lần thử:
 * 1. Không có lần thử -> 'not_attempted'
 * 2. Có bất kỳ lần thử nào bị 'needs_review' -> 'needs_review' (nếu là lần gần nhất hoặc duy nhất đạt)
 * 3. Có lần thử tự nhận đạt (hợp lệ) -> 'self_reported_achieved'
 * 4. Ngược lại -> 'attempted'
 */
export function calculateMilestoneStatus(attempts: JourneyAttempt[]): MilestoneStatus {
  if (!attempts || attempts.length === 0) {
    return 'not_attempted';
  }

  // Sắp xếp theo attempted_at giảm dần (mới nhất trước)
  const sorted = [...attempts].sort(
    (a, b) => new Date(b.attempted_at || b.attemptedAt || 0).getTime() - new Date(a.attempted_at || a.attemptedAt || 0).getTime()
  );

  const latest = sorted[0];

  // Nếu lần thử mới nhất hoặc có lần thử đạt bị đánh dấu needs_review
  if (latest.status === 'needs_review') {
    return 'needs_review';
  }

  const hasNeedsReviewOnAchieved = sorted.some(
    (att) => (att.is_achieved_self_reported || att.isAchievedSelfReported) && att.status === 'needs_review'
  );
  if (hasNeedsReviewOnAchieved) {
    return 'needs_review';
  }

  // Tìm lần đạt tự báo cáo mà không bị needs_review
  const achievedAttempt = sorted.find(
    (att) => (att.is_achieved_self_reported || att.isAchievedSelfReported) && att.status === 'self_reported_achieved'
  );

  if (achievedAttempt) {
    return 'self_reported_achieved';
  }

  return 'attempted';
}

/**
 * Adapter hook cho Agent B: chuyển đổi kết quả buổi tập B thành chứng cứ cho Agent C
 */
export function adaptWorkoutResultToJourneyEvidence(workoutResult: {
  sessionId?: string;
  resultId: string;
  completedAt: string;
  workoutType?: string;
}): SourceRef {
  return {
    sourceType: 'session_result',
    sourceId: workoutResult.resultId,
    recordedAt: workoutResult.completedAt || new Date().toISOString(),
  };
}
