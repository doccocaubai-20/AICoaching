/**
 * CALISCOACHING - WORKOUT READ ADAPTER FOR EXTERNAL AGENTS (C, D, DASHBOARD)
 * Cung cấp adapter đọc dữ liệu buổi tập hoàn thành làm chứng cứ (evidence/proof) cho Agent C.
 * Không import Agent C, chỉ export interface & read functions sạch.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireAuthenticatedUser } from '@/lib/server/auth-guard';

export interface CompletedWorkoutRunProof {
  runId: string;
  sessionId: string | null;
  sessionTitle: string;
  completedAt: string;
  durationMinutes: number;
  perceivedExertion: number | null;
  completedExercises: Array<{
    exerciseName: string;
    completedSets: number;
    repsSummary: string;
  }>;
  notes: string | null;
  deepLink: string;
}

/**
 * Đọc kết quả chi tiết của một phiên tập theo runId để làm chứng cứ
 */
export async function getCompletedWorkoutRunProof(
  runId: string
): Promise<CompletedWorkoutRunProof | null> {
  const { user } = await requireAuthenticatedUser();
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;

  const { data: run } = await (supabase as any)
    .from('workout_runs')
    .select('*')
    .eq('id', runId)
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .maybeSingle();

  if (!run) return null;

  const { data: sets } = await (supabase as any)
    .from('workout_sets')
    .select('exercise_name, set_order, actual_reps')
    .eq('run_id', runId)
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .not('actual_reps', 'is', null)
    .order('set_order', { ascending: true });

  const grouped: Record<string, number[]> = {};
  for (const s of sets || []) {
    if (s.actual_reps !== null && s.actual_reps > 0) {
      if (!grouped[s.exercise_name]) grouped[s.exercise_name] = [];
      grouped[s.exercise_name].push(s.actual_reps);
    }
  }

  const completedExercises = Object.entries(grouped).map(([name, reps]) => ({
    exerciseName: name,
    completedSets: reps.length,
    repsSummary: reps.join(', '),
  }));

  const durationMin = Math.max(1, Math.round((run.duration_seconds || 60) / 60));

  return {
    runId: run.id,
    sessionId: run.session_id,
    sessionTitle: run.session_title,
    completedAt: run.completed_at || run.updated_at,
    durationMinutes: durationMin,
    perceivedExertion: run.perceived_exertion_1_10,
    completedExercises,
    notes: run.notes,
    deepLink: `/workout/${run.id}`,
  };
}

/**
 * Danh sách các phiên tập đã hoàn thành gần đây của user
 */
export async function listCompletedWorkoutRuns(
  limit: number = 10
): Promise<CompletedWorkoutRunProof[]> {
  const { user } = await requireAuthenticatedUser();
  const supabase = await createServerSupabaseClient();
  if (!supabase) return [];

  const { data: runs } = await (supabase as any)
    .from('workout_runs')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(limit);

  if (!runs || runs.length === 0) return [];

  const results: CompletedWorkoutRunProof[] = [];
  for (const r of runs) {
    const proof = await getCompletedWorkoutRunProof(r.id);
    if (proof) results.push(proof);
  }

  return results;
}
