/**
 * CALISCOACHING MVP - SUPABASE DATABASE TYPES CONTRACT
 * Phiên bản: 1.1.0 (Migration 20261027000001 + 20261027000002)
 * Định nghĩa kiểu dữ liệu đồng bộ chính xác với Postgres Schema & RLS.
 * Lưu ý: Insert/Update của ai_summaries và ai_messages chỉ dùng được với
 * createAdminSupabaseClient() ở server; client chỉ có quyền đọc/xóa.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type GoalType = 'skill' | 'endurance' | 'habit' | 'strength' | 'other';
export type GoalStatus = 'active' | 'completed' | 'paused' | 'archived';
export type MetricType = 'weight' | 'height' | 'resting_heart_rate' | 'body_feel' | 'other';
export type ObservationSource = 'self_reported' | 'manual_import';
export type ActivityType = 'calisthenics' | 'running' | 'badminton' | 'walking' | 'other';
export type ActivitySource = 'manual_entry' | 'session_sync';
export type ProgramStatus = 'demo_illustration' | 'reviewed' | 'archived';
export type ReviewSuggestionStatus = 'pending' | 'acknowledged' | 'dismissed' | 'outdated';
export type AISummaryStatus = 'ai_generated' | 'template_fallback';
export type AIMessageRole = 'user' | 'assistant' | 'system';
export type AIMessageStatus = 'completed' | 'failed' | 'retrying';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          user_id: string;
          display_name: string;
          experience_level: ExperienceLevel;
          schedule_availability: Json;
          available_equipment: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          display_name: string;
          experience_level: ExperienceLevel;
          schedule_availability?: Json;
          available_equipment?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          display_name?: string;
          experience_level?: ExperienceLevel;
          schedule_availability?: Json;
          available_equipment?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      goals: {
        Row: {
          id: string;
          user_id: string;
          content: string;
          goal_type: GoalType;
          status: GoalStatus;
          start_date: string | null;
          end_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          content: string;
          goal_type: GoalType;
          status?: GoalStatus;
          start_date?: string | null;
          end_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          content?: string;
          goal_type?: GoalType;
          status?: GoalStatus;
          start_date?: string | null;
          end_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      observations: {
        Row: {
          id: string;
          user_id: string;
          metric_type: MetricType;
          metric_value: number;
          metric_unit: string;
          observed_at: string;
          source: ObservationSource;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          metric_type: MetricType;
          metric_value: number;
          metric_unit: string;
          observed_at?: string;
          source?: ObservationSource;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          metric_type?: MetricType;
          metric_value?: number;
          metric_unit?: string;
          observed_at?: string;
          source?: ObservationSource;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      activities: {
        Row: {
          id: string;
          user_id: string;
          activity_type: ActivityType;
          is_planned: boolean;
          start_at: string;
          duration_minutes: number;
          fatigue_level: number | null;
          notes: string | null;
          source: ActivitySource;
          idempotency_key: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          activity_type: ActivityType;
          is_planned?: boolean;
          start_at: string;
          duration_minutes: number;
          fatigue_level?: number | null;
          notes?: string | null;
          source?: ActivitySource;
          idempotency_key: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          activity_type?: ActivityType;
          is_planned?: boolean;
          start_at?: string;
          duration_minutes?: number;
          fatigue_level?: number | null;
          notes?: string | null;
          source?: ActivitySource;
          idempotency_key?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      programs: {
        Row: {
          id: string;
          user_id: string | null;
          title: string;
          version: string;
          status: ProgramStatus;
          description: string;
          is_demo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          title: string;
          version?: string;
          status?: ProgramStatus;
          description: string;
          is_demo?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          title?: string;
          version?: string;
          status?: ProgramStatus;
          description?: string;
          is_demo?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      sessions: {
        Row: {
          id: string;
          program_id: string;
          user_id: string | null;
          title: string;
          sequence_order: number;
          exercises: Json;
          is_demo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          program_id: string;
          user_id?: string | null;
          title: string;
          sequence_order?: number;
          exercises?: Json;
          is_demo?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          program_id?: string;
          user_id?: string | null;
          title?: string;
          sequence_order?: number;
          exercises?: Json;
          is_demo?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      session_results: {
        Row: {
          id: string;
          session_id: string;
          user_id: string;
          completed_at: string;
          self_reported_data: Json;
          notes: string | null;
          idempotency_key: string;
          is_demo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_id: string;
          completed_at?: string;
          self_reported_data?: Json;
          notes?: string | null;
          idempotency_key: string;
          is_demo?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          user_id?: string;
          completed_at?: string;
          self_reported_data?: Json;
          notes?: string | null;
          idempotency_key?: string;
          is_demo?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      review_suggestions: {
        Row: {
          id: string;
          user_id: string;
          status: ReviewSuggestionStatus;
          reason: string;
          reference_activity_ids: string[];
          rule_version: string;
          is_demo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          status?: ReviewSuggestionStatus;
          reason: string;
          reference_activity_ids?: string[];
          rule_version?: string;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          status?: ReviewSuggestionStatus;
          reason?: string;
          reference_activity_ids?: string[];
          rule_version?: string;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_consents: {
        Row: {
          id: string;
          user_id: string;
          consent_version: string;
          scope: string[];
          is_granted: boolean;
          granted_at: string;
          revoked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          consent_version?: string;
          scope?: string[];
          is_granted?: boolean;
          granted_at?: string;
          revoked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          consent_version?: string;
          scope?: string[];
          is_granted?: boolean;
          granted_at?: string;
          revoked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_summaries: {
        Row: {
          id: string;
          user_id: string;
          input_scope: Json;
          status: AISummaryStatus;
          content: string;
          missing_data_notes: string | null;
          reference_record_ids: Json;
          is_demo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          input_scope?: Json;
          status?: AISummaryStatus;
          content: string;
          missing_data_notes?: string | null;
          reference_record_ids?: Json;
          is_demo?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          input_scope?: Json;
          status?: AISummaryStatus;
          content?: string;
          missing_data_notes?: string | null;
          reference_record_ids?: Json;
          is_demo?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      ai_conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_messages: {
        Row: {
          id: string;
          conversation_id: string;
          user_id: string;
          role: AIMessageRole;
          content: string;
          reference_sources: Json;
          status: AIMessageStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          user_id: string;
          role: AIMessageRole;
          content: string;
          reference_sources?: Json;
          status?: AIMessageStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          user_id?: string;
          role?: AIMessageRole;
          content?: string;
          reference_sources?: Json;
          status?: AIMessageStatus;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
