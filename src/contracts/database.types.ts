/**
 * CALISCOACHING MVP - SUPABASE DATABASE TYPES CONTRACT
 * Phiên bản: 1.1.0 (Migration 20261027000001 + 20261027000002)
 * Định nghĩa kiểu dữ liệu đồng bộ chính xác với Postgres Schema & RLS.
 * Lưu ý: Insert/Update của ai_summaries và ai_messages chỉ dùng được với
 * createAdminSupabaseClient() ở server; client chỉ có quyền đọc/xóa.
 */

import type { AgentADatabaseTypes, AgentAFunctionTypes } from './database-a.types';
import type { AgentBDatabaseTypes, AgentBFunctionTypes } from './database-b.types';
import type { AgentCDatabaseTypes, AgentCFunctionTypes } from './database-c.types';
import type { AgentDDatabaseTypes, AgentDFunctionTypes } from './database-d.types';

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
export type MetricType = 'weight' | 'height' | 'resting_heart_rate' | 'body_feel' | 'waist_circumference' | 'other';
export type WorkContext = 'sedentary' | 'standing_walking' | 'physical_labor' | 'other';
export type BloodPressureSource = 'self_reported' | 'manual_import' | 'imported_from_document';
export type ConditionCategory = 'diagnosed_condition' | 'injury' | 'self_reported_symptom';
export type ConditionStatus = 'active' | 'resolved' | 'monitoring';
export type AllergyStatus = 'known' | 'unknown_or_unrecorded';
export type AllergySeverity = 'mild' | 'moderate' | 'severe';
export type MedicationStatus = 'active' | 'stopped';
export type HealthEventType = 'checkup' | 'lab_test' | 'vaccination' | 'other';
export type HealthDocumentFileType = 'application/pdf' | 'image/jpeg' | 'image/png';
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
      health_profiles: {
        Row: {
          id: string;
          user_id: string;
          birth_year: number | null;
          work_context: WorkContext | null;
          timezone: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          birth_year?: number | null;
          work_context?: WorkContext | null;
          timezone?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          birth_year?: number | null;
          work_context?: WorkContext | null;
          timezone?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      blood_pressure_readings: {
        Row: {
          id: string;
          user_id: string;
          systolic: number;
          diastolic: number;
          measured_at: string;
          source: BloodPressureSource;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          systolic: number;
          diastolic: number;
          measured_at?: string;
          source?: BloodPressureSource;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          systolic?: number;
          diastolic?: number;
          measured_at?: string;
          source?: BloodPressureSource;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      daily_checkins: {
        Row: {
          id: string;
          user_id: string;
          local_date: string;
          sleep_start: string | null;
          sleep_end: string | null;
          sleep_duration_minutes: number | null;
          sleep_quality: number | null;
          energy_level: number | null;
          stress_level: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          local_date: string;
          sleep_start?: string | null;
          sleep_end?: string | null;
          sleep_duration_minutes?: number | null;
          sleep_quality?: number | null;
          energy_level?: number | null;
          stress_level?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          local_date?: string;
          sleep_start?: string | null;
          sleep_end?: string | null;
          sleep_duration_minutes?: number | null;
          sleep_quality?: number | null;
          energy_level?: number | null;
          stress_level?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      health_conditions: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          category: ConditionCategory;
          started_at: string | null;
          status: ConditionStatus;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          category: ConditionCategory;
          started_at?: string | null;
          status?: ConditionStatus;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          category?: ConditionCategory;
          started_at?: string | null;
          status?: ConditionStatus;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      allergies: {
        Row: {
          id: string;
          user_id: string;
          allergen: string;
          reaction: string | null;
          severity: AllergySeverity | null;
          status: AllergyStatus;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          allergen: string;
          reaction?: string | null;
          severity?: AllergySeverity | null;
          status?: AllergyStatus;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          allergen?: string;
          reaction?: string | null;
          severity?: AllergySeverity | null;
          status?: AllergyStatus;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      medications: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          dosage_instructions: string | null;
          started_at: string | null;
          ended_at: string | null;
          status: MedicationStatus;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          dosage_instructions?: string | null;
          started_at?: string | null;
          ended_at?: string | null;
          status?: MedicationStatus;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          dosage_instructions?: string | null;
          started_at?: string | null;
          ended_at?: string | null;
          status?: MedicationStatus;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      health_events: {
        Row: {
          id: string;
          user_id: string;
          event_type: HealthEventType;
          event_date: string;
          facility_name: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_type: HealthEventType;
          event_date: string;
          facility_name?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_type?: HealthEventType;
          event_date?: string;
          facility_name?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      health_documents: {
        Row: {
          id: string;
          user_id: string;
          event_id: string | null;
          title: string;
          file_name: string;
          file_type: HealthDocumentFileType;
          file_size_bytes: number;
          storage_path: string;
          notes: string | null;
          upload_status: 'pending' | 'ready';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_id?: string | null;
          title: string;
          file_name: string;
          file_type: HealthDocumentFileType;
          file_size_bytes: number;
          storage_path: string;
          notes?: string | null;
          upload_status?: 'pending' | 'ready';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_id?: string | null;
          title?: string;
          file_name?: string;
          file_type?: HealthDocumentFileType;
          file_size_bytes?: number;
          storage_path?: string;
          notes?: string | null;
          upload_status?: 'pending' | 'ready';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      athlete_passport_shares: {
        Row: {
          user_id: string;
          token: string;
          revoked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          token: string;
          revoked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          token?: string;
          revoked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    } & AgentADatabaseTypes & AgentBDatabaseTypes & AgentCDatabaseTypes & AgentDDatabaseTypes;
    Views: {
      [_ in never]: never;
    };
    Functions: {
      reserve_health_document_upload: {
        Args: {
          p_event_id: string | null;
          p_title: string;
          p_file_name: string;
          p_file_type: HealthDocumentFileType;
          p_file_size_bytes: number;
          p_storage_path: string;
          p_notes: string | null;
        };
        Returns: string;
      };
      finalize_health_document_upload: {
        Args: { p_document_id: string };
        Returns: string;
      };
      cancel_health_document_upload: {
        Args: { p_document_id: string };
        Returns: boolean;
      };
    } & AgentAFunctionTypes & AgentBFunctionTypes & AgentCFunctionTypes & AgentDFunctionTypes;
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
