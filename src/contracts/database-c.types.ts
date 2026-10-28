/**
 * AGENT C DATABASE TYPES FRAGMENT
 * Khai báo kiểu cho các bảng và RPC do Agent C sở hữu:
 * - skill_journeys
 * - skill_milestones
 * - journey_attempts
 * - journey_videos
 * - rpc: reserve_journey_video_upload
 * - rpc: finalize_journey_video_upload
 * - rpc: mark_journey_video_for_deletion
 * - rpc: confirm_journey_video_deleted
 * - rpc: cleanup_expired_journey_video_reservations
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface AgentCDatabaseTypes {
  skill_journeys: {
    Row: {
      id: string;
      title: string;
      description: string;
      content_source: string;
      criteria_version: string;
      is_demo_illustration: boolean;
      disclaimer: string;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id: string;
      title: string;
      description: string;
      content_source: string;
      criteria_version?: string;
      is_demo_illustration?: boolean;
      disclaimer?: string;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      title?: string;
      description?: string;
      content_source?: string;
      criteria_version?: string;
      is_demo_illustration?: boolean;
      disclaimer?: string;
      created_at?: string;
      updated_at?: string;
    };
    Relationships: [];
  };
  skill_milestones: {
    Row: {
      id: string;
      journey_id: string;
      sequence_order: number;
      title: string;
      description: string;
      criteria_description: string;
      exercise_id: string;
      variant_id: string;
      assistance: string;
      target_reps: number | null;
      target_duration_seconds: number | null;
      criteria_version: string;
      is_demo_illustration: boolean;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id: string;
      journey_id: string;
      sequence_order: number;
      title: string;
      description: string;
      criteria_description: string;
      exercise_id: string;
      variant_id: string;
      assistance?: string;
      target_reps?: number | null;
      target_duration_seconds?: number | null;
      criteria_version?: string;
      is_demo_illustration?: boolean;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      journey_id?: string;
      sequence_order?: number;
      title?: string;
      description?: string;
      criteria_description?: string;
      exercise_id?: string;
      variant_id?: string;
      assistance?: string;
      target_reps?: number | null;
      target_duration_seconds?: number | null;
      criteria_version?: string;
      is_demo_illustration?: boolean;
      created_at?: string;
      updated_at?: string;
    };
    Relationships: [];
  };
  journey_videos: {
    Row: {
      id: string;
      user_id: string;
      exercise_id: string;
      variant_id: string;
      file_name: string;
      file_type: 'video/mp4' | 'video/webm';
      file_size_bytes: number;
      storage_path: string;
      client_estimated_duration_seconds: number | null;
      status: 'reserved' | 'ready' | 'pending_deletion' | 'deleted';
      idempotency_key: string | null;
      reserved_at: string;
      expires_at: string;
      finalized_at: string | null;
      deletion_requested_at: string | null;
      deletion_failed: boolean;
      deletion_attempts: number;
      deletion_error: string | null;
      timestamp_notes: Json;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      user_id: string;
      exercise_id: string;
      variant_id: string;
      file_name: string;
      file_type: 'video/mp4' | 'video/webm';
      file_size_bytes: number;
      storage_path: string;
      client_estimated_duration_seconds?: number | null;
      status?: 'reserved' | 'ready' | 'pending_deletion' | 'deleted';
      idempotency_key?: string | null;
      reserved_at?: string;
      expires_at?: string;
      finalized_at?: string | null;
      deletion_requested_at?: string | null;
      deletion_failed?: boolean;
      deletion_attempts?: number;
      deletion_error?: string | null;
      timestamp_notes?: Json;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      user_id?: string;
      exercise_id?: string;
      variant_id?: string;
      file_name?: string;
      file_type?: 'video/mp4' | 'video/webm';
      file_size_bytes?: number;
      storage_path?: string;
      client_estimated_duration_seconds?: number | null;
      status?: 'reserved' | 'ready' | 'pending_deletion' | 'deleted';
      idempotency_key?: string | null;
      reserved_at?: string;
      expires_at?: string;
      finalized_at?: string | null;
      deletion_requested_at?: string | null;
      deletion_failed?: boolean;
      deletion_attempts?: number;
      deletion_error?: string | null;
      timestamp_notes?: Json;
      created_at?: string;
      updated_at?: string;
    };
    Relationships: [];
  };
  journey_attempts: {
    Row: {
      id: string;
      user_id: string;
      journey_id: string;
      milestone_id: string;
      attempted_at: string;
      exercise_id: string;
      variant_id: string;
      assistance: string;
      actual_reps: number | null;
      actual_duration_seconds: number | null;
      notes: string | null;
      is_achieved_self_reported: boolean;
      status: 'attempted' | 'self_reported_achieved' | 'needs_review';
      source_ref: Json | null;
      source_invalidated_at: string | null;
      source_invalidation_reason: string | null;
      video_id: string | null;
      idempotency_key: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      user_id: string;
      journey_id: string;
      milestone_id: string;
      attempted_at?: string;
      exercise_id: string;
      variant_id: string;
      assistance?: string;
      actual_reps?: number | null;
      actual_duration_seconds?: number | null;
      notes?: string | null;
      is_achieved_self_reported?: boolean;
      status?: 'attempted' | 'self_reported_achieved' | 'needs_review';
      source_ref?: Json | null;
      source_invalidated_at?: string | null;
      source_invalidation_reason?: string | null;
      video_id?: string | null;
      idempotency_key?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      user_id?: string;
      journey_id?: string;
      milestone_id?: string;
      attempted_at?: string;
      exercise_id?: string;
      variant_id?: string;
      assistance?: string;
      actual_reps?: number | null;
      actual_duration_seconds?: number | null;
      notes?: string | null;
      is_achieved_self_reported?: boolean;
      status?: 'attempted' | 'self_reported_achieved' | 'needs_review';
      source_ref?: Json | null;
      source_invalidated_at?: string | null;
      source_invalidation_reason?: string | null;
      video_id?: string | null;
      idempotency_key?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Relationships: [];
  };
}

export interface AgentCFunctionTypes {
  reserve_journey_video_upload: {
    Args: {
      p_idempotency_key: string | null;
      p_exercise_id: string;
      p_variant_id: string;
      p_file_name: string;
      p_file_type: string;
      p_file_size_bytes: number;
      p_storage_path: string;
      p_client_duration?: number | null;
    };
    Returns: string;
  };
  finalize_journey_video_upload: {
    Args: { p_video_id: string };
    Returns: string;
  };
  mark_journey_video_for_deletion: {
    Args: { p_video_id: string };
    Returns: boolean;
  };
  confirm_journey_video_deleted: {
    Args: { p_video_id: string; p_error_message?: string | null };
    Returns: boolean;
  };
  cleanup_expired_journey_video_reservations: {
    Args: Record<string, never>;
    Returns: number;
  };
}
