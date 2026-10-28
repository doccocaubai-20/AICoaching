/**
 * CALISCOACHING - AGENT B DATABASE TYPES FRAGMENT
 * Version: 20261028000020
 * Bảng và RPC phục vụ luồng tập có trí nhớ:
 * - workout_runs
 * - workout_sets
 * - RPC: record_workout_set, pause_workout_run, resume_workout_run, abandon_workout_run, finalize_workout_run
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type WorkoutRunStatus = 'in_progress' | 'paused' | 'completed' | 'abandoned';
export type WorkoutSetStatus = 'pending' | 'completed' | 'skipped';

export interface AgentBDatabaseTypes {
  workout_runs: {
    Row: {
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
      exercises_snapshot: Json;
      version: number;
      idempotency_key: string | null;
      is_demo: boolean;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      user_id: string;
      session_id?: string | null;
      program_id?: string | null;
      program_version?: string;
      session_title: string;
      status?: WorkoutRunStatus;
      started_at?: string;
      paused_at?: string | null;
      total_paused_duration_seconds?: number;
      completed_at?: string | null;
      duration_seconds?: number | null;
      perceived_exertion_1_10?: number | null;
      notes?: string | null;
      exercises_snapshot?: Json;
      version?: number;
      idempotency_key?: string | null;
      is_demo?: boolean;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      user_id?: string;
      session_id?: string | null;
      program_id?: string | null;
      program_version?: string;
      session_title?: string;
      status?: WorkoutRunStatus;
      started_at?: string;
      paused_at?: string | null;
      total_paused_duration_seconds?: number;
      completed_at?: string | null;
      duration_seconds?: number | null;
      perceived_exertion_1_10?: number | null;
      notes?: string | null;
      exercises_snapshot?: Json;
      version?: number;
      idempotency_key?: string | null;
      is_demo?: boolean;
      created_at?: string;
      updated_at?: string;
    };
    Relationships: [];
  };
  workout_sets: {
    Row: {
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
    };
    Insert: {
      id?: string;
      run_id: string;
      user_id: string;
      exercise_index: number;
      exercise_name: string;
      exercise_variant?: string | null;
      set_order: number;
      target_reps: string;
      target_load?: number | null;
      target_duration_seconds?: number | null;
      target_assistance?: string | null;
      target_unit?: string;
      actual_reps?: number | null;
      actual_load?: number | null;
      actual_duration_seconds?: number | null;
      actual_unit?: string;
      actual_assistance?: string | null;
      status?: WorkoutSetStatus;
      idempotency_key: string;
      completed_at?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      run_id?: string;
      user_id?: string;
      exercise_index?: number;
      exercise_name?: string;
      exercise_variant?: string | null;
      set_order?: number;
      target_reps?: string;
      target_load?: number | null;
      target_duration_seconds?: number | null;
      target_assistance?: string | null;
      target_unit?: string;
      actual_reps?: number | null;
      actual_load?: number | null;
      actual_duration_seconds?: number | null;
      actual_unit?: string;
      actual_assistance?: string | null;
      status?: WorkoutSetStatus;
      idempotency_key?: string;
      completed_at?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Relationships: [];
  };
}

export interface AgentBFunctionTypes {
  record_workout_set: {
    Args: {
      p_run_id: string;
      p_exercise_index: number;
      p_exercise_name: string;
      p_exercise_variant?: string | null;
      p_set_order: number;
      p_target_reps: string;
      p_target_load?: number | null;
      p_target_duration_seconds?: number | null;
      p_target_assistance?: string | null;
      p_target_unit?: string;
      p_actual_reps?: number | null;
      p_actual_load?: number | null;
      p_actual_duration_seconds?: number | null;
      p_actual_unit?: string;
      p_actual_assistance?: string | null;
      p_status?: WorkoutSetStatus;
      p_idempotency_key: string;
    };
    Returns: Json;
  };
  pause_workout_run: {
    Args: {
      p_run_id: string;
      p_expected_version?: number | null;
    };
    Returns: Json;
  };
  resume_workout_run: {
    Args: {
      p_run_id: string;
      p_expected_version?: number | null;
    };
    Returns: Json;
  };
  abandon_workout_run: {
    Args: {
      p_run_id: string;
    };
    Returns: Json;
  };
  finalize_workout_run: {
    Args: {
      p_run_id: string;
      p_expected_version: number;
      p_perceived_exertion: number;
      p_notes?: string | null;
      p_idempotency_key: string;
      p_allow_partial?: boolean;
    };
    Returns: Json;
  };
}
