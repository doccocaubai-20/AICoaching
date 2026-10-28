'use server';

import crypto from 'node:crypto';
import { requireAuthenticatedUser } from '@/lib/server/auth-guard';
import { getAgentASupabaseClient } from '@/features/common/supabase-a';
import { DEFAULT_APP_TIMEZONE, getLocalDateString } from '@/lib/date-utils';
import {
  CaptureDraft,
  ConfirmBatchPayload,
  ConfirmBatchPayloadSchema,
  CaptureReceipt,
} from '../contracts/capture.contract';
import { parseQuickCapture } from './capture-parser';

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
  };
}

/**
 * Server action: Phân tích câu tiếng Việt thành bản nháp CaptureDraft
 */
export async function parseQuickCaptureAction(rawInput: string): Promise<ActionResult<CaptureDraft>> {
  try {
    const { user } = await requireAuthenticatedUser();
    if (!rawInput || !rawInput.trim()) {
      return {
        success: false,
        error: {
          code: 'EMPTY_INPUT',
          message: 'Vui lòng nhập nội dung cần ghi nhận.',
        },
      };
    }

    const supabase = await getAgentASupabaseClient();
    let timezone = DEFAULT_APP_TIMEZONE;
    let existingCheckin: any = null;

    if (supabase) {
      // 1. Lấy timezone người dùng
      const { data: profile } = await supabase
        .from('health_profiles')
        .select('timezone')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profile?.timezone) {
        timezone = profile.timezone;
      }

      // 2. Kiểm tra check-in ngày hôm nay theo timezone
      const today = getLocalDateString(new Date(), timezone);
      const { data: checkin } = await supabase
        .from('daily_checkins')
        .select('*')
        .eq('user_id', user.id)
        .eq('local_date', today)
        .maybeSingle();

      existingCheckin = checkin;
    }

    // 3. Phân tích nội dung tiếng Việt
    const draft = parseQuickCapture(rawInput, timezone, existingCheckin);

    return {
      success: true,
      data: draft,
    };
  } catch (err: any) {
    return {
      success: false,
      error: {
        code: err.name || 'PARSE_ERROR',
        message: err.message || 'Lỗi trong quá trình phân tích nội dung.',
      },
    };
  }
}

/**
 * Server action: Xác nhận batch ghi nhận dữ liệu nguyên tử (Atomic Batch Commit)
 */
export async function commitCaptureBatchAction(
  payload: ConfirmBatchPayload
): Promise<ActionResult<CaptureReceipt>> {
  try {
    const { user } = await requireAuthenticatedUser();

    // 1. Kiểm tra validation payload
    const parsed = ConfirmBatchPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      parsed.error.issues.forEach((issue) => {
        const path = issue.path.join('.');
        fieldErrors[path] = fieldErrors[path] || [];
        fieldErrors[path].push(issue.message);
      });

      return {
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại các trường.',
          fieldErrors,
        },
      };
    }

    const validData = parsed.data;
    const supabase = await getAgentASupabaseClient();
    if (!supabase) {
      return {
        success: false,
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: 'Không thể kết nối đến cơ sở dữ liệu.',
        },
      };
    }

    // 2. Tính hash của payload để bảo vệ idempotency
    const payloadForHash = {
      activities: validData.activities,
      dailyCheckin: validData.dailyCheckin,
      observations: validData.observations,
    };
    const payloadHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(payloadForHash))
      .digest('hex');

    // Chuẩn bị tham số cho Daily Checkin
    let checkinParam: any = null;
    if (validData.dailyCheckin && validData.dailyCheckin.action !== 'skip') {
      checkinParam = {
        action: validData.dailyCheckin.action,
        local_date: validData.dailyCheckin.local_date,
        sleep_start: validData.dailyCheckin.sleep_start ?? null,
        sleep_end: validData.dailyCheckin.sleep_end ?? null,
        sleep_duration_minutes: validData.dailyCheckin.sleep_duration_minutes ?? null,
        sleep_quality: validData.dailyCheckin.sleep_quality ?? null,
        energy_level: validData.dailyCheckin.energy_level ?? null,
        stress_level: validData.dailyCheckin.stress_level ?? null,
        notes: validData.dailyCheckin.notes ?? null,
      };
    }

    // 3. Thực thi RPC commit_capture_batch nguyên tử
    const { data: rpcResult, error: rpcError } = await supabase.rpc('commit_capture_batch', {
      p_idempotency_key: validData.idempotencyKey,
      p_payload_hash: payloadHash,
      p_activities: validData.activities as any,
      p_daily_checkin: checkinParam,
      p_observations: validData.observations as any,
    });

    if (rpcError) {
      // Nhận diện lỗi conflict idempotency key
      if (rpcError.message?.includes('CONFLICT: Idempotency key')) {
        return {
          success: false,
          error: {
            code: 'IDEMPOTENCY_CONFLICT',
            message: 'Khóa thao tác này đã được sử dụng với nội dung khác. Vui lòng thử lại.',
          },
        };
      }

      return {
        success: false,
        error: {
          code: 'COMMIT_BATCH_ERROR',
          message: rpcError.message || 'Lỗi khi lưu dữ liệu nguyên tử.',
        },
      };
    }

    // 4. Định dạng kết quả biên nhận (Receipt)
    const records: CaptureReceipt['records'] = [];
    const committedRecords = (rpcResult as any)?.committed_records || [];

    for (const rec of committedRecords) {
      if (rec.source_type === 'activities') {
        records.push({
          sourceType: 'activities',
          id: rec.id,
          label: `Hoạt động: ${rec.activity_type}`,
          detail: 'Đã lưu vào nhật ký luyện tập',
          // F5: Mở trực tiếp nhật ký hoạt động có highlight ID
          viewUrl: `/activities?highlight=${rec.id}`,
        });
      } else if (rec.source_type === 'daily_checkins') {
        records.push({
          sourceType: 'daily_checkins',
          id: rec.id,
          label: `Check-in sinh hoạt ngày ${rec.local_date}`,
          detail: rec.action === 'updated' ? 'Đã cập nhật sinh hoạt ngày' : 'Đã tạo mới check-in sinh hoạt',
          // F5: Mở tab checkin tại đúng ngày
          viewUrl: `/profile?tab=checkin&date=${rec.local_date}`,
        });
      } else if (rec.source_type === 'observations') {
        records.push({
          sourceType: 'observations',
          id: rec.id,
          label: `Chỉ số: ${rec.metric_type}`,
          detail: 'Đã lưu chỉ số cơ thể tự khai',
          // F5: Mở tab vitals có highlight ID
          viewUrl: `/profile?tab=vitals&highlight=${rec.id}`,
        });
      }
    }

    const receipt: CaptureReceipt = {
      status: (rpcResult as any)?.status === 'replayed' ? 'replayed' : 'committed',
      idempotencyKey: validData.idempotencyKey,
      committedAt: new Date().toISOString(),
      totalRecords: records.length,
      records,
    };

    return {
      success: true,
      data: receipt,
    };
  } catch (err: any) {
    return {
      success: false,
      error: {
        code: err.name || 'UNKNOWN_ERROR',
        message: err.message || 'Lỗi hệ thống khi xác nhận bản ghi.',
      },
    };
  }
}
