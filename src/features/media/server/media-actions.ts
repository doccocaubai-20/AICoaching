'use server';

/**
 * AGENT C - MEDIA SERVER ACTIONS
 * D6 Video đối chiếu với chính mình
 */

import { revalidatePath } from 'next/cache';
import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { requireAuthenticatedUser } from '@/lib/server/auth-guard';
import type { Database } from '@/contracts/database.types';
import type { AgentCDatabaseTypes } from '@/contracts/database-c.types';
import {
  type ActionResult,
  type ReserveUploadInput,
  type ReserveUploadResult,
  type FinalizeUploadInput,
  type JourneyVideoAsset,
  type TimestampNote,
  mapToVideoAsset,
  MAX_VIDEO_FILE_BYTES,
  SIGNED_URL_TTL_SECONDS,
  ALLOWED_VIDEO_MIME_TYPES,
  validateReserveUploadInput,
  validateTimestampNoteInput,
} from '../contracts/media.contract';

export type MediaDatabase = {
  public: {
    Tables: {
      [K in keyof Database['public']['Tables'] | keyof AgentCDatabaseTypes]: K extends keyof AgentCDatabaseTypes
        ? AgentCDatabaseTypes[K]
        : K extends keyof Database['public']['Tables']
        ? Database['public']['Tables'][K]
        : never;
    };
    Views: Database['public']['Views'];
    Functions: Database['public']['Functions'] & {
      reserve_journey_video_upload: {
        Args: {
          p_idempotency_key: string | null;
          p_exercise_id: string;
          p_variant_id: string;
          p_file_name: string;
          p_file_type: string;
          p_file_size_bytes: number;
          p_storage_path: string;
          p_client_duration: number | null;
        };
        Returns: string;
      };
      finalize_journey_video_upload: {
        Args: {
          p_video_id: string;
          p_actual_size_bytes: number;
          p_actual_mime_type: string;
        };
        Returns: string;
      };
      mark_journey_video_for_deletion: {
        Args: {
          p_video_id: string;
        };
        Returns: string;
      };
      confirm_journey_video_deleted: {
        Args: {
          p_video_id: string;
          p_success: boolean;
          p_error_message?: string | null;
        };
        Returns: void;
      };
      cleanup_expired_journey_video_reservations: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
    };
    Enums: Database['public']['Enums'];
    CompositeTypes: Database['public']['CompositeTypes'];
  };
};

export type MediaSupabaseClient = SupabaseClient<MediaDatabase>;

async function getMediaServerClient(): Promise<MediaSupabaseClient | null> {
  const client = await createServerSupabaseClient();
  return client as unknown as MediaSupabaseClient | null;
}

function getMediaAdminClient(): MediaSupabaseClient | null {
  const client = createAdminSupabaseClient();
  return client as unknown as MediaSupabaseClient | null;
}

/**
 * Bước 1: Giữ chỗ dung lượng (Reserve Quota) và cấp grant upload trực tiếp lên Storage
 */
export async function reserveVideoUploadAction(
  input: ReserveUploadInput
): Promise<ActionResult<ReserveUploadResult>> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await getMediaServerClient();
    if (!supabase) return { success: false, message: 'Chưa cấu hình Supabase.', errorCode: 'DB_UNAVAILABLE' };

    const adminClient = getMediaAdminClient();
    if (!adminClient) {
      return { success: false, message: 'Chưa cấu hình khóa dịch vụ Supabase Admin.', errorCode: 'SERVER_MISCONFIGURED' };
    }

    // 1. Kiểm tra validation phía server
    const validation = validateReserveUploadInput(input);
    if (!validation.valid) {
      return {
        success: false,
        message: 'Thông số tệp video không hợp lệ.',
        errorCode: 'VALIDATION_ERROR',
        fieldErrors: validation.errors,
      };
    }

    // 2. Tạo đường dẫn ngẫu nhiên an toàn: <user_id>/<uuid>.<ext>
    const safeExt = input.fileType === 'video/webm' ? 'webm' : 'mp4';
    const randomFileName = `${crypto.randomUUID()}.${safeExt}`;
    const storagePath = `${user.id}/${randomFileName}`;

    // 3. Gọi RPC kiểm tra quota đồng thời (pg_advisory_xact_lock) và ghi nhận reservation
    const { data: reservationId, error: rpcError } = await supabase.rpc(
      'reserve_journey_video_upload',
      {
        p_idempotency_key: input.idempotencyKey ? input.idempotencyKey.trim() : null,
        p_exercise_id: input.exerciseId.trim(),
        p_variant_id: input.variantId.trim(),
        p_file_name: input.fileName.trim(),
        p_file_type: input.fileType,
        p_file_size_bytes: input.fileSizeBytes,
        p_storage_path: storagePath,
        p_client_duration: input.clientEstimatedDurationSeconds || null,
      } as any
    );

    if (rpcError) {
      const isQuotaExceeded = rpcError.message.includes('quota exceeded');
      return {
        success: false,
        message: isQuotaExceeded
          ? 'Vượt quá hạn mức lưu trữ video (tối đa 100 MiB). Vui lòng dọn dẹp các clip cũ trước khi tải thêm.'
          : 'Không thể khởi tạo lượt tải lên: ' + rpcError.message,
        errorCode: isQuotaExceeded ? 'QUOTA_EXCEEDED' : rpcError.code,
      };
    }

    // 4. Cấp Signed Upload URL cho client tải trực tiếp vào Storage (không đi qua Server Action)
    const { data: uploadData, error: uploadErr } = await adminClient.storage
      .from('comparison_videos')
      .createSignedUploadUrl(storagePath);

    if (uploadErr || !uploadData) {
      return {
        success: false,
        message: 'Không thể cấp quyền tải lên tệp: ' + (uploadErr?.message || 'Lỗi Storage'),
        errorCode: 'STORAGE_GRANT_FAILED',
      };
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    return {
      success: true,
      data: {
        reservationId: reservationId as string,
        storagePath,
        uploadUrl: uploadData.signedUrl,
        token: uploadData.token,
        maxBytes: MAX_VIDEO_FILE_BYTES,
        expiresAt,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Lỗi máy chủ khi giữ chỗ upload: ' + (err?.message || String(err)),
      errorCode: err?.name === 'UnauthorizedError' ? 'UNAUTHORIZED' : 'SERVER_ERROR',
    };
  }
}

/**
 * Bước 2: Xác nhận hoàn tất upload (Finalize Verification)
 * Kiểm tra object thực sự tồn tại trong Storage, đúng owner, đúng path, dung lượng và MIME phù hợp
 */
export async function finalizeVideoUploadAction(
  input: FinalizeUploadInput
): Promise<ActionResult<JourneyVideoAsset>> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await getMediaServerClient();
    if (!supabase) return { success: false, message: 'Chưa cấu hình Supabase.' };

    const adminClient = getMediaAdminClient();
    if (!adminClient) return { success: false, message: 'Chưa cấu hình khóa dịch vụ máy chủ.' };

    // 1. Đọc reservation từ DB
    const { data: videoRecord, error: fetchErr } = await supabase
      .from('journey_videos')
      .select('*')
      .eq('id', input.reservationId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchErr || !videoRecord) {
      return {
        success: false,
        message: 'Không tìm thấy lượt giữ chỗ tải lên hoặc bạn không có quyền truy cập.',
        errorCode: 'RESERVATION_NOT_FOUND',
      };
    }

    if (videoRecord.status === 'ready') {
      // Đã finalize trước đó (idempotent)
      return {
        success: true,
        data: mapToVideoAsset(videoRecord),
      };
    }

    if (videoRecord.status !== 'reserved') {
      return {
        success: false,
        message: `Trạng thái giữ chỗ không hợp lệ (${videoRecord.status}).`,
        errorCode: 'INVALID_STATUS',
      };
    }

    // 2. Xác thực sự tồn tại của tệp trong Storage
    const storagePath: string = videoRecord.storage_path;
    const pathParts = storagePath.split('/');
    const folder = pathParts[0];
    const fileName = pathParts.slice(1).join('/');

    const { data: listData, error: listErr } = await adminClient.storage
      .from('comparison_videos')
      .list(folder, { search: fileName });

    const objectExists = listData && listData.some((f) => f.name === fileName);
    if (listErr || !objectExists) {
      return {
        success: false,
        message: 'Xác thực thất bại: Không tìm thấy tệp video trên Storage sau khi tải lên.',
        errorCode: 'OBJECT_NOT_FOUND',
      };
    }

    // 3. Gọi RPC finalize để cập nhật trạng thái sang 'ready'
    const actualBytes = Math.min(input.actualSizeBytes || videoRecord.file_size_bytes, MAX_VIDEO_FILE_BYTES);
    const actualMime = ALLOWED_VIDEO_MIME_TYPES.includes(input.actualMimeType as any)
      ? input.actualMimeType
      : videoRecord.file_type;

    const { error: finalizeErr } = await supabase.rpc('finalize_journey_video_upload', {
      p_video_id: input.reservationId,
      p_actual_size_bytes: actualBytes,
      p_actual_mime_type: actualMime,
    } as any);

    if (finalizeErr) {
      return {
        success: false,
        message: 'Không thể xác nhận hoàn tất tải lên: ' + finalizeErr.message,
        errorCode: finalizeErr.code,
      };
    }

    // 4. Nếu có attemptId đính kèm, liên kết video với lần thử đó
    if (input.attemptId) {
      await supabase
        .from('journey_attempts')
        .update({ video_id: input.reservationId, updated_at: new Date().toISOString() })
        .eq('id', input.attemptId)
        .eq('user_id', user.id);
    }

    // 5. Tải lại bản ghi sau khi finalize
    const { data: updatedRecord } = await supabase
      .from('journey_videos')
      .select('*')
      .eq('id', input.reservationId)
      .single();

    revalidatePath('/journey');

    return {
      success: true,
      data: mapToVideoAsset(updatedRecord || videoRecord),
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Lỗi máy chủ khi hoàn tất tải lên video: ' + (err?.message || String(err)),
      errorCode: err?.name === 'UnauthorizedError' ? 'UNAUTHORIZED' : 'SERVER_ERROR',
    };
  }
}

/**
 * Cấp Signed URL ngắn hạn (TTL 300s) để phát video riêng tư
 * Cấm cấp mới ngay khi video ở trạng thái pending_deletion hoặc deleted!
 */
export async function getComparisonVideoSignedUrlAction(
  videoId: string
): Promise<ActionResult<{ signedUrl: string; ttlSeconds: number; disclaimer: string }>> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await getMediaServerClient();
    if (!supabase) return { success: false, message: 'Chưa cấu hình Supabase.' };

    const adminClient = getMediaAdminClient();
    if (!adminClient) return { success: false, message: 'Chưa cấu hình khóa dịch vụ máy chủ.' };

    // 1. Kiểm tra quyền sở hữu và trạng thái video
    const { data: videoRecord, error: fetchErr } = await supabase
      .from('journey_videos')
      .select('id, user_id, storage_path, status')
      .eq('id', videoId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchErr || !videoRecord) {
      return {
        success: false,
        message: 'Không tìm thấy video hoặc bạn không có quyền xem tệp này.',
        errorCode: 'FORBIDDEN_OWNERSHIP',
      };
    }

    // 2. Chặn tuyệt đối nếu đang trong tiến trình xóa (pending_deletion) hoặc đã xóa
    if (videoRecord.status === 'pending_deletion' || videoRecord.status === 'deleted') {
      return {
        success: false,
        message: 'Từ chối cấp liên kết: Tệp video này đang chờ xóa hoặc đã bị hủy bỏ.',
        errorCode: 'VIDEO_PENDING_DELETION',
      };
    }

    if (videoRecord.status !== 'ready') {
      return {
        success: false,
        message: 'Tệp video chưa sẵn sàng để phát.',
        errorCode: 'VIDEO_NOT_READY',
      };
    }

    // 3. Tạo Signed URL TTL 300 giây (5 phút)
    const { data: signedData, error: signedErr } = await adminClient.storage
      .from('comparison_videos')
      .createSignedUrl(videoRecord.storage_path, SIGNED_URL_TTL_SECONDS);

    if (signedErr || !signedData?.signedUrl) {
      return {
        success: false,
        message: 'Không thể tạo liên kết phát video: ' + (signedErr?.message || 'Lỗi Storage'),
        errorCode: 'SIGNED_URL_FAILED',
      };
    }

    return {
      success: true,
      data: {
        signedUrl: signedData.signedUrl,
        ttlSeconds: SIGNED_URL_TTL_SECONDS,
        disclaimer:
          'Liên kết riêng tư tạm thời có hiệu lực tối đa 5 phút. Hết hạn cần yêu cầu lại từ máy chủ.',
      },
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Lỗi máy chủ khi lấy link video: ' + (err?.message || String(err)),
      errorCode: err?.name === 'UnauthorizedError' ? 'UNAUTHORIZED' : 'SERVER_ERROR',
    };
  }
}

/**
 * Xóa video có Tombstone (pending_deletion) và retry dọn dẹp Storage
 * Xóa video KHÔNG xóa lần thử tập luyện!
 */
export async function deleteComparisonVideoAction(videoId: string): Promise<ActionResult<void>> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await getMediaServerClient();
    if (!supabase) return { success: false, message: 'Chưa cấu hình Supabase.' };

    const adminClient = getMediaAdminClient();
    if (!adminClient) return { success: false, message: 'Chưa cấu hình khóa dịch vụ máy chủ.' };

    // 1. Đặt Tombstone pending_deletion và gỡ liên kết video khỏi journey_attempts qua RPC
    const { data: storagePath, error: tombstoneErr } = await supabase.rpc(
      'mark_journey_video_for_deletion',
      { p_video_id: videoId } as any
    );

    if (tombstoneErr) {
      return {
        success: false,
        message: 'Không thể bắt đầu xóa video: ' + tombstoneErr.message,
        errorCode: tombstoneErr.code,
      };
    }

    // 2. Thao tác xóa file trên Supabase Storage
    const pathToDelete = storagePath as string;
    const { error: removeErr } = await adminClient.storage
      .from('comparison_videos')
      .remove([pathToDelete]);

    // 3. Cập nhật kết quả xóa vào DB (hỗ trợ retry nếu lỗi Storage)
    await supabase.rpc('confirm_journey_video_deleted', {
      p_video_id: videoId,
      p_success: !removeErr,
      p_error_message: removeErr ? removeErr.message : null,
    } as any);

    if (removeErr) {
      // Storage xóa lỗi nhưng tombstone đã được đặt -> người dùng không còn thấy video nữa, retry job sẽ dọn sau
      return {
        success: true,
        message: 'Đã hủy video khỏi hồ sơ. Tệp lưu trữ vật lý sẽ được hệ thống dọn dẹp trong lượt kế tiếp.',
      };
    }

    revalidatePath('/journey');
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      message: 'Lỗi máy chủ khi xóa video: ' + (err?.message || String(err)),
      errorCode: err?.name === 'UnauthorizedError' ? 'UNAUTHORIZED' : 'SERVER_ERROR',
    };
  }
}

/**
 * Thêm ghi chú gắn mốc thời gian (Timestamp Note) cho video
 */
export async function addVideoTimestampNoteAction(
  videoId: string,
  timeSeconds: number,
  noteText: string
): Promise<ActionResult<TimestampNote[]>> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await getMediaServerClient();
    if (!supabase) return { success: false, message: 'Chưa cấu hình Supabase.' };

    const validation = validateTimestampNoteInput(timeSeconds, noteText);
    if (!validation.valid) {
      return { success: false, message: validation.error || 'Dữ liệu ghi chú không hợp lệ.' };
    }

    const { data: videoRecord, error: fetchErr } = await supabase
      .from('journey_videos')
      .select('id, user_id, timestamp_notes')
      .eq('id', videoId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchErr || !videoRecord) {
      return { success: false, message: 'Không tìm thấy video hoặc bạn không sở hữu.', errorCode: 'FORBIDDEN_OWNERSHIP' };
    }

    const currentNotes: TimestampNote[] = Array.isArray(videoRecord.timestamp_notes)
      ? (videoRecord.timestamp_notes as any)
      : [];

    const newNote: TimestampNote = {
      id: crypto.randomUUID(),
      timeSeconds: Math.round(timeSeconds * 10) / 10,
      note: noteText.trim(),
      createdAt: new Date().toISOString(),
    };

    const updatedNotes = [...currentNotes, newNote].sort((a, b) => a.timeSeconds - b.timeSeconds);

    const { error: updateErr } = await supabase
      .from('journey_videos')
      .update({ timestamp_notes: updatedNotes as any, updated_at: new Date().toISOString() })
      .eq('id', videoId)
      .eq('user_id', user.id);

    if (updateErr) {
      return { success: false, message: 'Không thể cập nhật ghi chú: ' + updateErr.message };
    }

    return { success: true, data: updatedNotes };
  } catch (err: any) {
    return { success: false, message: 'Lỗi máy chủ khi thêm ghi chú: ' + (err?.message || String(err)) };
  }
}

/**
 * Xóa một ghi chú mốc thời gian
 */
export async function removeVideoTimestampNoteAction(
  videoId: string,
  noteId: string
): Promise<ActionResult<TimestampNote[]>> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await getMediaServerClient();
    if (!supabase) return { success: false, message: 'Chưa cấu hình Supabase.' };

    const { data: videoRecord, error: fetchErr } = await supabase
      .from('journey_videos')
      .select('id, user_id, timestamp_notes')
      .eq('id', videoId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchErr || !videoRecord) {
      return { success: false, message: 'Không tìm thấy video.', errorCode: 'FORBIDDEN_OWNERSHIP' };
    }

    const currentNotes: TimestampNote[] = Array.isArray(videoRecord.timestamp_notes)
      ? (videoRecord.timestamp_notes as any)
      : [];

    const updatedNotes = currentNotes.filter((n) => n.id !== noteId);

    const { error: updateErr } = await supabase
      .from('journey_videos')
      .update({ timestamp_notes: updatedNotes as any, updated_at: new Date().toISOString() })
      .eq('id', videoId)
      .eq('user_id', user.id);

    if (updateErr) {
      return { success: false, message: 'Không thể xóa ghi chú: ' + updateErr.message };
    }

    return { success: true, data: updatedNotes };
  } catch (err: any) {
    return { success: false, message: 'Lỗi máy chủ khi xóa ghi chú: ' + (err?.message || String(err)) };
  }
}

/**
 * Dọn dẹp các lượt giữ chỗ upload bị bỏ dở hoặc quá hạn 15 phút
 * Có thể gọi từ môi trường local / test runner mà không cần cloud cron
 */
export async function cleanupExpiredVideoReservationsAction(): Promise<ActionResult<{ cleanedCount: number }>> {
  try {
    const supabase = await getMediaServerClient();
    if (!supabase) return { success: false, message: 'Chưa cấu hình Supabase.' };

    const { data: count, error } = await supabase.rpc('cleanup_expired_journey_video_reservations');
    if (error) {
      return { success: false, message: 'Không thể dọn dẹp reservation quá hạn: ' + error.message };
    }

    return { success: true, data: { cleanedCount: count || 0 } };
  } catch (err: any) {
    return { success: false, message: 'Lỗi máy chủ khi dọn dẹp reservation: ' + (err?.message || String(err)) };
  }
}

