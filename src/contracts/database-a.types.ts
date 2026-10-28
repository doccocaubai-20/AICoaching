/**
-- AGENT A DATABASE TYPES FRAGMENT
-- Khai báo kiểu cho các bảng và RPC do Agent A sở hữu:
-- - capture_idempotency_keys
-- - health_briefs
-- - brief_shares
-- - rpc: commit_capture_batch
*/

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface AgentADatabaseTypes {
  capture_idempotency_keys: {
    Row: {
      id: string;
      user_id: string;
      idempotency_key: string;
      payload_hash: string;
      committed_records: Json;
      created_at: string;
    };
    Insert: {
      id?: string;
      user_id: string;
      idempotency_key: string;
      payload_hash: string;
      committed_records?: Json;
      created_at?: string;
    };
    Update: {
      id?: string;
      user_id?: string;
      idempotency_key?: string;
      payload_hash?: string;
      committed_records?: Json;
      created_at?: string;
    };
    Relationships: [];
  };
  health_briefs: {
    Row: {
      id: string;
      user_id: string;
      brief_type: 'workout' | 'medical';
      title: string;
      date_range_start: string;
      date_range_end: string;
      included_categories: string[];
      snapshot_payload: Json;
      source_fingerprints: Json;
      user_notes: string | null;
      ai_summary: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      user_id: string;
      brief_type: 'workout' | 'medical';
      title: string;
      date_range_start: string;
      date_range_end: string;
      included_categories?: string[];
      snapshot_payload: Json;
      source_fingerprints?: Json;
      user_notes?: string | null;
      ai_summary?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      user_id?: string;
      brief_type?: 'workout' | 'medical';
      title?: string;
      date_range_start?: string;
      date_range_end?: string;
      included_categories?: string[];
      snapshot_payload?: Json;
      source_fingerprints?: Json;
      user_notes?: string | null;
      ai_summary?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Relationships: [];
  };
  brief_shares: {
    Row: {
      id: string;
      brief_id: string;
      user_id: string;
      token_hash: string;
      expires_at: string;
      revoked_at: string | null;
      access_count: number;
      last_accessed_at: string | null;
      created_at: string;
    };
    Insert: {
      id?: string;
      brief_id: string;
      user_id: string;
      token_hash: string;
      expires_at: string;
      revoked_at?: string | null;
      access_count?: number;
      last_accessed_at?: string | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      brief_id?: string;
      user_id?: string;
      token_hash?: string;
      expires_at?: string;
      revoked_at?: string | null;
      access_count?: number;
      last_accessed_at?: string | null;
      created_at?: string;
    };
    Relationships: [];
  };
}

export interface AgentAFunctionTypes {
  commit_capture_batch: {
    Args: {
      p_idempotency_key: string;
      p_payload_hash: string;
      p_activities?: Json;
      p_daily_checkin?: Json;
      p_observations?: Json;
    };
    Returns: Json;
  };
}
