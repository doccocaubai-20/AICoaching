/**
 * AGENT C - MEDIA COMPARISON CONTRACT
 * D6 Video đối chiếu với chính mình
 */

export interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  message?: string;
  errorCode?: string;
  fieldErrors?: Record<string, string>;
}

export const MAX_VIDEO_FILE_BYTES = 20_971_520; // 20 MiB integer bytes (20 * 1024 * 1024)
export const MAX_TOTAL_MEDIA_QUOTA_BYTES = 104_857_600; // 100 MiB total quota per user
export const ALLOWED_VIDEO_MIME_TYPES = ['video/mp4', 'video/webm'] as const;
export type AllowedVideoMimeType = (typeof ALLOWED_VIDEO_MIME_TYPES)[number];

export const SIGNED_URL_TTL_SECONDS = 300; // 5 minutes TTL
export const RECOMMENDED_CLIP_DURATION_NOTE =
  'Khuyến nghị clip ngắn 15–30 giây, quay rõ góc nghiêng hoặc chính diện bài tập để đối chiếu chuyển động.';

export interface TimestampNote {
  id: string;
  timeSeconds: number;
  note: string;
  createdAt: string;
}

export interface JourneyVideoAsset {
  id: string;
  userId: string;
  exerciseId: string;
  variantId: string;
  fileName: string;
  fileType: AllowedVideoMimeType;
  fileSizeBytes: number;
  storagePath: string;
  clientEstimatedDurationSeconds: number | null;
  status: 'reserved' | 'ready' | 'pending_deletion' | 'deleted';
  timestampNotes: TimestampNote[];
  reservedAt: string;
  expiresAt: string;
  finalizedAt: string | null;
  deletionRequestedAt: string | null;
  deletionFailed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReserveUploadInput {
  exerciseId: string;
  variantId: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  clientEstimatedDurationSeconds?: number | null;
  idempotencyKey?: string | null;
}

export interface ReserveUploadResult {
  reservationId: string;
  storagePath: string;
  uploadUrl: string;
  token?: string;
  maxBytes: number;
  expiresAt: string;
}

export interface FinalizeUploadInput {
  reservationId: string;
  actualSizeBytes: number;
  actualMimeType: string;
  attemptId?: string | null;
}

export interface ComparisonPairDTO {
  exerciseId: string;
  variantId: string;
  videoA: {
    video: JourneyVideoAsset;
    signedUrl: string;
    attemptTitle: string;
    attemptDate: string;
    repsOrDuration: string;
  };
  videoB: {
    video: JourneyVideoAsset;
    signedUrl: string;
    attemptTitle: string;
    attemptDate: string;
    repsOrDuration: string;
  };
}

/**
 * Kiểm tra tính hợp lệ của input khi giữ chỗ tải lên
 */
export function validateReserveUploadInput(input: ReserveUploadInput): {
  valid: boolean;
  isValid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!input.exerciseId || input.exerciseId.trim().length === 0) {
    errors.exerciseId = 'Thiếu định danh bài tập.';
  }

  if (!input.variantId || input.variantId.trim().length === 0) {
    errors.variantId = 'Thiếu định danh biến thể.';
  }

  if (!input.fileName || input.fileName.trim().length === 0) {
    errors.fileName = 'Thiếu tên tệp video.';
  }

  if (!ALLOWED_VIDEO_MIME_TYPES.includes(input.fileType as AllowedVideoMimeType)) {
    errors.fileType = `Định dạng video không được hỗ trợ (${input.fileType}). Chỉ chấp nhận MP4 hoặc WebM đã kiểm chứng.`;
  }

  const bytes = Number(input.fileSizeBytes);
  if (!Number.isInteger(bytes) || bytes <= 0) {
    errors.fileSizeBytes = 'Dung lượng tệp phải là số nguyên dương tính bằng byte.';
  } else if (bytes > MAX_VIDEO_FILE_BYTES) {
    errors.fileSizeBytes = `Dung lượng video (${(bytes / 1024 / 1024).toFixed(1)} MiB) vượt quá giới hạn cho phép (20 MiB).`;
  }

  const isValid = Object.keys(errors).length === 0;
  return {
    valid: isValid,
    isValid,
    errors,
  };
}

/**
 * Kiểm tra tính hợp lệ của ghi chú gắn mốc thời gian (Timestamp Note)
 */
export function validateTimestampNoteInput(timeSeconds: number, note: string): {
  valid: boolean;
  error?: string;
} {
  if (typeof timeSeconds !== 'number' || isNaN(timeSeconds) || timeSeconds < 0) {
    return { valid: false, error: 'Mốc thời gian phải là số giây không âm.' };
  }

  if (!note || note.trim().length === 0) {
    return { valid: false, error: 'Nội dung ghi chú không được để trống.' };
  }

  if (note.trim().length > 300) {
    return { valid: false, error: 'Nội dung ghi chú không được vượt quá 300 ký tự.' };
  }

  return { valid: true };
}

export function mapToVideoAsset(raw: any): JourneyVideoAsset {
  return {
    id: raw.id,
    userId: raw.user_id,
    exerciseId: raw.exercise_id,
    variantId: raw.variant_id,
    fileName: raw.file_name,
    fileType: raw.file_type,
    fileSizeBytes: raw.file_size_bytes,
    storagePath: raw.storage_path,
    clientEstimatedDurationSeconds: raw.estimated_duration_seconds || raw.client_estimated_duration_seconds || null,
    status: raw.upload_status || raw.status || 'ready',
    timestampNotes: Array.isArray(raw.timestamp_notes) ? raw.timestamp_notes : [],
    reservedAt: raw.reserved_at,
    expiresAt: raw.expires_at,
    finalizedAt: raw.finalized_at,
    deletionRequestedAt: raw.deletion_requested_at,
    deletionFailed: raw.deletion_failed ?? false,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

