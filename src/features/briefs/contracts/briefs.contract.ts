import { z } from 'zod';

export type BriefType = 'workout' | 'medical';

export interface SourceRef {
  sourceType: 'activities' | 'daily_checkins' | 'observations' | 'conditions' | 'medications' | 'allergies';
  sourceId: string;
  fingerprint: string; // SHA-256 hash của updated_at để nhận diện stale
  recordedAt: string;
  summaryLabel?: string;
}

// Cấu trúc Snapshot bất biến lưu trong DB
export interface BriefSnapshotPayload {
  meta: {
    briefType: BriefType;
    title: string;
    generatedAt: string;
    dateRange: {
      start: string; // YYYY-MM-DD
      end: string;   // YYYY-MM-DD
    };
    timezone: string;
    disclaimer: string;
  };
  overview: {
    totalRecords: number;
    daysWithRecords: number;
    missingDaysCount: number;
    activitySessionCount: number;
    totalActivityMinutes: number;
    averageSleepMinutes: number | null;
  };
  workoutDetails?: {
    activitiesCountByType: Record<string, number>;
    sessions: Array<{
      date: string;
      activityType: string;
      durationMinutes: number;
      fatigueLevel: number | null;
      notes: string | null;
      sourceId: string;
    }>;
    notesAndDifficulties: string[];
  };
  medicalDetails?: {
    selfReportedConditions?: Array<{
      conditionName: string;
      status: string;
      notes: string | null;
    }>;
    allergies?: Array<{
      allergen: string;
      reaction: string | null;
      severity: string | null;
    }>;
    medications?: Array<{
      medicationName: string;
      dosage: string | null;
      frequency: string | null;
    }>;
    vitalObservations?: Array<{
      metricType: string;
      metricValue: number;
      metricUnit: string;
      observedAt: string;
    }>;
    dailyCheckinTrends?: Array<{
      date: string;
      sleepDurationMinutes: number | null;
      sleepQuality: number | null;
      energyLevel: number | null;
      stressLevel: number | null;
    }>;
  };
  missingDataNotes: string[];
  sourceRefs: SourceRef[];
}

// Schema tạo brief snapshot mới
export const CreateBriefSnapshotSchema = z.object({
  briefType: z.enum(['workout', 'medical']),
  title: z.string().min(2, 'Tiêu đề tối thiểu 2 ký tự').max(100),
  dateRangeStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Định dạng YYYY-MM-DD'),
  dateRangeEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Định dạng YYYY-MM-DD'),
  includedCategories: z.array(z.string()),
  userNotes: z.string().max(2000).optional(),
  enableAISummary: z.boolean().default(false),
});

export type CreateBriefSnapshotInput = z.infer<typeof CreateBriefSnapshotSchema>;

// Input tạo link chia sẻ
export const CreateShareLinkSchema = z.object({
  briefId: z.string().uuid(),
  durationDays: z.enum(['1', '7', '30']),
});

export type CreateShareLinkInput = z.infer<typeof CreateShareLinkSchema>;

// Trạng thái truy cập của người xem link chia sẻ
export type SharedBriefAccessStatus = 'active' | 'expired' | 'revoked' | 'stale' | 'not_found';

export interface SharedBriefViewResult {
  status: SharedBriefAccessStatus;
  message?: string;
  shareInfo?: {
    expiresAt: string;
    createdAt: string;
  };
  staleDetails?: {
    staleSourceCount: number;
    message: string;
  };
  snapshot?: BriefSnapshotPayload;
  userNotes?: string | null;
  aiSummary?: string | null;
}
