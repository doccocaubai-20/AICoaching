/**
 * CALISCOACHING - WORKOUT FLOW V2 CONTRACTS (AGENT B - D3)
 * Định nghĩa state machine, types, validation và logic tính toán thời gian, so sánh thành tích.
 */

import { z } from 'zod';

export type WorkoutRunStatus = 'in_progress' | 'paused' | 'completed' | 'abandoned';
export type WorkoutSetStatus = 'pending' | 'completed' | 'skipped';
export type WorkoutSetSyncState = 'draft' | 'pending' | 'saved' | 'failed';

export interface ExerciseItemSnapshot {
  name: string;
  sets: number;
  target_reps: string;
  rest_seconds: number;
  note?: string;
  variant?: string;
  unit?: string;
  assistance?: string;
  target_load?: number;
  target_duration_seconds?: number;
}

export interface WorkoutRunEntity {
  id: string;
  user_id: string;
  session_id: string | null;
  program_id: string | null;
  program_version: string;
  session_title: string;
  status: WorkoutRunStatus;
  started_at: string;
  paused_at: string | null;
  total_paused_duration_seconds: number;
  completed_at: string | null;
  duration_seconds: number | null;
  perceived_exertion_1_10: number | null;
  notes: string | null;
  exercises_snapshot: ExerciseItemSnapshot[];
  version: number;
  idempotency_key: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkoutSetEntity {
  id: string;
  run_id: string;
  user_id: string;
  exercise_index: number;
  exercise_name: string;
  exercise_variant: string | null;
  set_order: number;
  target_reps: string;
  target_load: number | null;
  target_duration_seconds: number | null;
  target_assistance: string | null;
  target_unit: string;
  actual_reps: number | null;
  actual_load: number | null;
  actual_duration_seconds: number | null;
  actual_unit: string;
  actual_assistance: string | null;
  status: WorkoutSetStatus;
  idempotency_key: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PreviousExerciseComparison {
  hasComparison: boolean;
  reason?: 'no_previous_record' | 'unmapped_variant' | 'unit_mismatch' | 'demo_program_data_excluded';
  summaryText?: string;
  lastCompletedAt?: string;
  exactSets?: Array<{
    set_order: number;
    actual_reps: number | null;
    actual_load: number | null;
    actual_duration_seconds: number | null;
    actual_unit: string;
    actual_assistance: string | null;
  }>;
}

export interface WorkoutOutboxItem {
  idempotencyKey: string;
  runId: string;
  exerciseIndex: number;
  exerciseName: string;
  exerciseVariant?: string | null;
  setOrder: number;
  targetReps: string;
  targetLoad?: number | null;
  targetDurationSeconds?: number | null;
  targetAssistance?: string | null;
  targetUnit?: string;
  actualReps: number | null;
  actualLoad?: number | null;
  actualDurationSeconds?: number | null;
  actualUnit: string;
  actualAssistance?: string | null;
  status: WorkoutSetStatus;
  timestamp: number;
}

// ==============================================================================
// 1. TÍNH TOÁN TIMER THỜI GIAN THỰC TỪ TIMESTAMPS + PAUSED DURATION
// ==============================================================================

/**
 * Tính số giây đã tập (active elapsed seconds) dựa trên mốc thời gian bắt đầu, mốc tạm dừng và tổng thời gian dừng.
 * - Khi status = 'in_progress': (now - startedAt) - totalPausedDuration
 * - Khi status = 'paused': (pausedAt - startedAt) - totalPausedDuration
 * Tuyệt đối không làm timer tăng khi đang pause, chống trôi khi reload/chuyển tab.
 */
export function calculateElapsedSeconds(
  startedAt: string | number | Date,
  pausedAt: string | number | Date | null | undefined,
  totalPausedDurationSeconds: number,
  nowMs: number = Date.now()
): number {
  const startMs = typeof startedAt === 'number' ? startedAt : new Date(startedAt).getTime();
  if (isNaN(startMs)) return 0;

  const validPausedSecs = Math.max(0, totalPausedDurationSeconds || 0);

  if (pausedAt) {
    const pauseMs = typeof pausedAt === 'number' ? pausedAt : new Date(pausedAt).getTime();
    if (isNaN(pauseMs)) return 0;
    const grossActiveMs = Math.max(0, pauseMs - startMs);
    const netSeconds = Math.floor(grossActiveMs / 1000) - validPausedSecs;
    return Math.max(0, netSeconds);
  }

  const grossActiveMs = Math.max(0, nowMs - startMs);
  const netSeconds = Math.floor(grossActiveMs / 1000) - validPausedSecs;
  return Math.max(0, netSeconds);
}

/**
 * Format mm:ss từ số giây
 */
export function formatWorkoutTime(totalSeconds: number): string {
  const safeSecs = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safeSecs / 60);
  const s = safeSecs % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ==============================================================================
// 2. CHUẨN HÓA VÀ SO SÁNH ĐỐI CHIẾU THÀNH TÍCH LẦN TRƯỚC
// ==============================================================================

/**
 * Chuẩn hóa tên động tác để so sánh chính xác:
 * - Chuyển chữ thường, trim khoảng trắng thừa
 * - KHÔNG MATCH GẦN GIỐNG (Fuzzy Match bị cấm hoàn toàn theo Spec D3 mục 7)
 */
export function normalizeExerciseName(name: string): string {
  return (name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export interface CandidateHistoricalExercise {
  exercise_name: string;
  exercise_variant?: string | null;
  unit?: string;
  assistance?: string | null;
  is_demo?: boolean;
  completed_at?: string;
  sets: Array<{
    set_order: number;
    actual_reps: number | null;
    actual_load?: number | null;
    actual_duration_seconds?: number | null;
    actual_unit?: string;
    actual_assistance?: string | null;
  }>;
}

/**
 * Đối chiếu kết quả lần trước:
 * Phải cùng bài, cùng variant, cùng unit và cùng assistance.
 * Loại trừ dữ liệu demo mẫu chưa qua người dùng thực tế nhập.
 */
export function compareExerciseRecords(
  target: {
    name: string;
    variant?: string | null;
    unit?: string;
    assistance?: string | null;
  },
  candidate: CandidateHistoricalExercise | null | undefined
): PreviousExerciseComparison {
  if (!candidate) {
    return {
      hasComparison: false,
      reason: 'no_previous_record',
    };
  }

  // 1. Phân biệt dữ liệu từ chương trình demo với dữ liệu người dùng thực sự nhập
  if (candidate.is_demo && (!candidate.sets || candidate.sets.length === 0 || candidate.sets.every(s => s.actual_reps === null))) {
    return {
      hasComparison: false,
      reason: 'demo_program_data_excluded',
    };
  }

  // 2. Kiểm tra tên động tác chính xác tuyệt đối (không fuzzy)
  if (normalizeExerciseName(target.name) !== normalizeExerciseName(candidate.exercise_name)) {
    return {
      hasComparison: false,
      reason: 'no_previous_record',
    };
  }

  // 3. Kiểm tra biến thể (variant) nếu có
  const targetVariant = (target.variant || '').trim().toLowerCase();
  const candidateVariant = (candidate.exercise_variant || '').trim().toLowerCase();
  if (targetVariant !== candidateVariant) {
    return {
      hasComparison: false,
      reason: 'unmapped_variant',
    };
  }

  // 4. Kiểm tra đơn vị (unit)
  const targetUnit = (target.unit || 'reps').trim().toLowerCase();
  const candidateUnit = (candidate.unit || 'reps').trim().toLowerCase();
  if (targetUnit !== candidateUnit) {
    return {
      hasComparison: false,
      reason: 'unit_mismatch',
    };
  }

  // 5. Kiểm tra mức trợ lực (assistance) nếu có
  const targetAssistance = (target.assistance || '').trim().toLowerCase();
  const candidateAssistance = (candidate.assistance || '').trim().toLowerCase();
  if (targetAssistance !== candidateAssistance) {
    return {
      hasComparison: false,
      reason: 'unmapped_variant',
    };
  }

  // Lọc các hiệp có giá trị thật
  const validSets = candidate.sets.filter((s) => s.actual_reps !== null && s.actual_reps > 0);
  if (validSets.length === 0) {
    return {
      hasComparison: false,
      reason: 'no_previous_record',
    };
  }

  const repsSummary = validSets.map((s) => s.actual_reps).join('-');
  const summaryText = `${validSets.length} hiệp x ${repsSummary} ${targetUnit}`;

  return {
    hasComparison: true,
    summaryText,
    lastCompletedAt: candidate.completed_at,
    exactSets: validSets.map((s) => ({
      set_order: s.set_order,
      actual_reps: s.actual_reps,
      actual_load: s.actual_load ?? null,
      actual_duration_seconds: s.actual_duration_seconds ?? null,
      actual_unit: s.actual_unit || targetUnit,
      actual_assistance: s.actual_assistance ?? null,
    })),
  };
}

// ==============================================================================
// 3. QUY TẮC PHIÊN BẢN 15/30 PHÚT & BẢO VỆ NỘI DUNG CHUYÊN MÔN
// ==============================================================================

/**
 * Kiểm tra xem buổi tập có phiên bản rút gọn (15/30 phút) đã được chuyên môn rà soát hay không.
 * TUYỆT ĐỐI KHÔNG tự động cắt xén động tác và tuyên bố có hiệu quả tương đương.
 */
export function hasReviewedShortVersion(
  session: { duration_variants?: Array<{ minutes: number; reviewed: boolean }>; [key: string]: unknown } | null | undefined,
  variantMinutes: 15 | 30
): boolean {
  if (!session || !session.duration_variants || !Array.isArray(session.duration_variants)) {
    return false;
  }
  return session.duration_variants.some(
    (v) => v.minutes === variantMinutes && v.reviewed === true
  );
}

// ==============================================================================
// 4. LÀM SẠCH KẾT QUẢ KHI HOÀN THÀNH (PARTIAL COMPLETION)
// ==============================================================================

/**
 * Gom và làm sạch các hiệp đã hoàn thành thật để lưu session_results.
 * Chỉ lấy actual_reps > 0, KHÔNG tự động điền 0 hay target của hiệp bị bỏ qua.
 */
export function cleanWorkoutSetsForFinalize(
  sets: Array<{
    exercise_name: string;
    status: WorkoutSetStatus;
    actual_reps: number | null;
  }>
): Array<{
  exercise_name: string;
  actual_sets: number;
  actual_reps: string;
}> {
  const grouped: Record<string, number[]> = {};

  for (const s of sets) {
    if (s.status === 'completed' && typeof s.actual_reps === 'number' && s.actual_reps > 0) {
      if (!grouped[s.exercise_name]) {
        grouped[s.exercise_name] = [];
      }
      grouped[s.exercise_name].push(s.actual_reps);
    }
  }

  return Object.entries(grouped).map(([exercise_name, repsList]) => ({
    exercise_name,
    actual_sets: repsList.length,
    actual_reps: repsList.join(', '),
  }));
}

// ==============================================================================
// 5. VALIDATION SCHEMAS (ZOD)
// ==============================================================================

export const RecordWorkoutSetSchema = z.object({
  run_id: z.string().uuid(),
  exercise_index: z.number().int().min(0),
  exercise_name: z.string().min(1),
  exercise_variant: z.string().nullable().optional(),
  set_order: z.number().int().min(1),
  target_reps: z.string(),
  target_load: z.number().min(0).nullable().optional(),
  target_duration_seconds: z.number().int().min(0).nullable().optional(),
  target_assistance: z.string().nullable().optional(),
  target_unit: z.string().default('reps'),
  actual_reps: z.number().int().min(0).max(1000).nullable().optional(),
  actual_load: z.number().min(0).max(1000).nullable().optional(),
  actual_duration_seconds: z.number().int().min(0).max(86400).nullable().optional(),
  actual_unit: z.string().default('reps'),
  actual_assistance: z.string().nullable().optional(),
  status: z.enum(['pending', 'completed', 'skipped']),
  idempotency_key: z.string().min(1),
});

export const FinalizeWorkoutRunSchema = z.object({
  run_id: z.string().uuid(),
  expected_version: z.number().int().min(1),
  perceived_exertion: z.number().int().min(1).max(10),
  notes: z.string().max(1000).optional().nullable(),
  idempotency_key: z.string().min(1),
  allow_partial: z.boolean().default(false),
});
