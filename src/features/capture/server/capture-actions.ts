'use server';

import crypto from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import { requireAuthenticatedUser } from '@/lib/server/auth-guard';
import { getAgentASupabaseClient } from '@/features/common/supabase-a';
import { DEFAULT_APP_TIMEZONE, getLocalDateString } from '@/lib/date-utils';
import { getAIEnvConfig } from '@/lib/ai/env';
import {
  CaptureDraft,
  ConfirmBatchPayload,
  ConfirmBatchPayloadSchema,
  CaptureReceipt,
  DraftActivityItem,
  DraftDailyCheckinItem,
  DraftObservationItem,
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
 * Trợ lý AI Gemini: Phân tích ngữ nghĩa tự nhiên tiếng Việt cho câu ghi chép nhanh
 */
async function parseWithGeminiAI(
  rawInput: string,
  timezone: string,
  existingCheckin: any
): Promise<CaptureDraft | null> {
  try {
    const aiConfig = getAIEnvConfig();
    if (!aiConfig.isConfigured || !aiConfig.apiKey) {
      return null;
    }

    const ai = new GoogleGenAI({ apiKey: aiConfig.apiKey });
    const today = getLocalDateString(new Date(), timezone);

    const prompt = `Bạn là trợ lý AI chuyên gia thể thao và sức khỏe CalisCoaching.
Hãy phân tích câu nhật ký tiếng Việt của người dùng và bóc tách thành dữ liệu JSON có cấu trúc.

Múi giờ: ${timezone}
Ngày hôm nay: ${today}
Câu người dùng: "${rawInput}"

Hãy trả về JSON theo đúng định dạng sau (chỉ trả về JSON thuần):
{
  "activities": [
    {
      "activity_type": "calisthenics" | "running" | "badminton" | "walking" | "other",
      "duration_minutes": number,
      "fatigue_level": number | null,
      "notes": string
    }
  ],
  "sleep": {
    "duration_minutes": number | null,
    "notes": string | null
  } | null,
  "observations": [
    {
      "metric_type": "weight" | "waist_circumference",
      "metric_value": number,
      "metric_unit": "kg" | "cm"
    }
  ],
  "missing_duration_sports": string[]
}

Quy tắc quan trọng:
1. Hiểu tiếng Việt tự nhiên và từ viết tắt: hnay (hôm nay), t (tôi), calis (calisthenics), hqua (hôm qua).
2. Tách bạch hoàn toàn từng môn tập và giấc ngủ, tuyệt đối không lấy nhầm thời lượng ngủ gán cho môn tập và ngược lại.
3. Nếu người dùng chỉ nói tập nhưng không ghi thời lượng, thêm tên môn vào missing_duration_sports và không tự bịa duration.
4. "cầu lông 1 tiếng 15" -> activity_type: "badminton", duration_minutes: 75.
5. "nhảy dây 20 phút" -> activity_type: "other", duration_minutes: 20, notes: "Nhảy dây".
6. "đi bộ 2 tiếng" -> activity_type: "walking", duration_minutes: 120.
7. "ngủ 2 tiếng rưỡi" -> sleep.duration_minutes: 150.`;

    // Gọi Gemini với timeout 10s
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000));
    const aiPromise = ai.models.generateContent({
      model: aiConfig.modelName,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    const response = await Promise.race([aiPromise, timeoutPromise]);
    if (!response || !('text' in response)) {
      return null;
    }

    const text = response.text?.trim();
    if (!text) return null;

    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object') return null;

    const activities: DraftActivityItem[] = [];
    if (Array.isArray(parsed.activities)) {
      parsed.activities.forEach((act: any, idx: number) => {
        const dur = typeof act.duration_minutes === 'number' && act.duration_minutes > 0 ? act.duration_minutes : null;
        if (dur) {
          activities.push({
            tempId: `act_ai_${Date.now()}_${idx}`,
            activity_type: act.activity_type || 'other',
            duration_minutes: dur,
            fatigue_level: typeof act.fatigue_level === 'number' ? act.fatigue_level : undefined,
            start_at: `${today}T08:00:00.000Z`,
            notes: act.notes ? String(act.notes) : `Ghi nhanh: "${rawInput}"`,
          });
        }
      });
    }

    let dailyCheckin: DraftDailyCheckinItem | null = null;
    if (parsed.sleep && (parsed.sleep.duration_minutes || parsed.sleep.notes)) {
      dailyCheckin = {
        local_date: today,
        sleep_duration_minutes: typeof parsed.sleep.duration_minutes === 'number' ? parsed.sleep.duration_minutes : undefined,
        notes: parsed.sleep.notes ? String(parsed.sleep.notes) : 'Ghi nhận nhanh qua AI',
        conflictResolution: existingCheckin ? 'update' : 'create',
        existingRecord: existingCheckin
          ? {
              id: existingCheckin.id,
              local_date: existingCheckin.local_date,
              sleep_duration_minutes: existingCheckin.sleep_duration_minutes,
              sleep_quality: existingCheckin.sleep_quality,
              energy_level: existingCheckin.energy_level,
              stress_level: existingCheckin.stress_level,
              notes: existingCheckin.notes,
              updated_at: existingCheckin.updated_at,
            }
          : null,
      };
    }

    const observations: DraftObservationItem[] = [];
    if (Array.isArray(parsed.observations)) {
      parsed.observations.forEach((obs: any, idx: number) => {
        if (typeof obs.metric_value === 'number' && obs.metric_value > 0) {
          observations.push({
            tempId: `obs_ai_${Date.now()}_${idx}`,
            metric_type: obs.metric_type || 'weight',
            metric_value: obs.metric_value,
            metric_unit: obs.metric_unit || 'kg',
            observed_at: `${today}T07:00:00.000Z`,
            notes: `Ghi nhanh: "${rawInput}"`,
          });
        }
      });
    }

    const missingFields: Array<{ target: string; message: string }> = [];
    if (Array.isArray(parsed.missing_duration_sports)) {
      parsed.missing_duration_sports.forEach((sportName: string) => {
        missingFields.push({
          target: 'activity.duration_minutes',
          message: `Bạn đã tập ${sportName} nhưng chưa ghi thời lượng (phút/giờ).`,
        });
      });
    }

    return {
      draftId: `draft_ai_${Date.now()}`,
      revision: 1,
      rawInput,
      timezone,
      createdAt: new Date().toISOString(),
      activities,
      dailyCheckin,
      observations,
      disambiguations: [],
      missingFields,
      aiAssisted: true,
    };
  } catch (err) {
    console.warn('[AI_CAPTURE_PARSER] Lỗi phân tích Gemini, tự động chuyển về fallback:', err);
    return null;
  }
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

    // 3. Ưu tiên phân tích thông minh qua Gemini AI nếu có cấu hình
    const aiDraft = await parseWithGeminiAI(rawInput, timezone, existingCheckin);
    if (aiDraft) {
      return {
        success: true,
        data: aiDraft,
      };
    }

    // 4. Fallback nội bộ: Phân tích đa hoạt động bằng luật xác định
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
