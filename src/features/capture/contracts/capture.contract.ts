import { z } from 'zod';
import type { ActivityType } from '@/contracts/database.types';

export { ActivityType };

// Danh mục các nguồn dữ liệu hỗ trợ theo CONTRACTS
export const CAPTURE_SUPPORTED_SOURCES = ['activities', 'daily_checkins', 'observations'] as const;
export type CaptureSupportedSource = typeof CAPTURE_SUPPORTED_SOURCES[number];

// Schema câu hỏi làm rõ (Disambiguation)
export interface DisambiguationQuestion {
  id: string; // ví dụ: 'fatigue_disambiguation'
  rawTextSegment: string; // ví dụ: 'mệt 7'
  question: string;
  fieldTarget: 'activity_fatigue' | 'checkin_fatigue' | 'both';
  options: Array<{
    id: string;
    label: string;
    description: string;
    targetValue: {
      activityFatigue?: number; // 1-10
      checkinStressOrEnergy?: {
        stress?: number; // 1-5
        energy?: number; // 1-5
      };
    };
  }>;
}

// Item Activity trong nháp
export interface DraftActivityItem {
  tempId: string;
  activity_type: ActivityType;
  duration_minutes: number;
  fatigue_level?: number; // 1-10 RPE
  start_at: string; // ISO string
  notes?: string;
}

// Item Daily Checkin trong nháp
export interface DraftDailyCheckinItem {
  local_date: string; // YYYY-MM-DD
  sleep_start?: string;
  sleep_end?: string;
  sleep_duration_minutes?: number;
  sleep_quality?: number; // 1-5
  energy_level?: number; // 1-5
  stress_level?: number; // 1-5
  notes?: string;
  existingRecord?: {
    id: string;
    local_date: string;
    sleep_duration_minutes: number | null;
    sleep_quality: number | null;
    energy_level: number | null;
    stress_level: number | null;
    notes: string | null;
    updated_at: string;
  } | null;
  conflictResolution: 'create' | 'update' | 'skip';
}

// Item Observation trong nháp
export interface DraftObservationItem {
  tempId: string;
  metric_type: 'weight' | 'height' | 'resting_heart_rate' | 'body_feel' | 'waist_circumference';
  metric_value: number;
  metric_unit: string;
  observed_at: string; // ISO string
  notes?: string;
}

// Tổng thể bản nháp (Draft)
export interface CaptureDraft {
  draftId: string;
  revision: number;
  rawInput: string;
  timezone: string;
  createdAt: string;
  activities: DraftActivityItem[];
  dailyCheckin: DraftDailyCheckinItem | null;
  observations: DraftObservationItem[];
  disambiguations: DisambiguationQuestion[];
  missingFields: Array<{
    target: string;
    message: string;
  }>;
  aiAssisted: boolean;
}

// Payload gửi lên server để xác nhận batch
export const ConfirmBatchPayloadSchema = z.object({
  idempotencyKey: z.string().min(8, 'Idempotency key không hợp lệ'),
  draftRevision: z.number().int().nonnegative(),
  rawInput: z.string().min(1),
  timezone: z.string().default('Asia/Ho_Chi_Minh'),
  activities: z.array(
    z.object({
      activity_type: z.enum(['calisthenics', 'running', 'badminton', 'walking', 'other']),
      duration_minutes: z.number().int().min(1, 'Thời lượng phải lớn hơn 0').max(1440),
      fatigue_level: z.number().int().min(1).max(10).optional(),
      start_at: z.string().datetime(),
      notes: z.string().max(1000).optional(),
    })
  ),
  dailyCheckin: z
    .object({
      local_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Định dạng ngày YYYY-MM-DD'),
      sleep_start: z.string().datetime().optional(),
      sleep_end: z.string().datetime().optional(),
      sleep_duration_minutes: z.number().int().min(0).max(1440).optional(),
      sleep_quality: z.number().int().min(1).max(5).optional(),
      energy_level: z.number().int().min(1).max(5).optional(),
      stress_level: z.number().int().min(1).max(5).optional(),
      notes: z.string().max(1000).optional(),
      action: z.enum(['create', 'update', 'skip']),
      existingSourceRevision: z.string().optional(),
    })
    .nullable()
    .optional(),
  observations: z.array(
    z.object({
      metric_type: z.enum(['weight', 'height', 'resting_heart_rate', 'body_feel', 'waist_circumference']),
      metric_value: z.number().positive('Chỉ số phải lớn hơn 0'),
      metric_unit: z.string().min(1),
      observed_at: z.string().datetime(),
      notes: z.string().max(1000).optional(),
    })
  ),
});

export type ConfirmBatchPayload = z.infer<typeof ConfirmBatchPayloadSchema>;

// Biên nhận xác nhận thành công
export interface CaptureReceipt {
  status: 'committed' | 'replayed';
  idempotencyKey: string;
  committedAt: string;
  totalRecords: number;
  records: Array<{
    sourceType: 'activities' | 'daily_checkins' | 'observations';
    id: string;
    label: string;
    detail: string;
    viewUrl: string;
  }>;
}
