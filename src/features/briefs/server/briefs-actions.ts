'use server';

import crypto from 'node:crypto';
import { signBriefPreview, verifyBriefPreview } from '../contracts/preview-integrity';
import { requireAuthenticatedUser } from '@/lib/server/auth-guard';
import { getAgentASupabaseClient } from '@/features/common/supabase-a';
import { DEFAULT_APP_TIMEZONE, getLocalDateString, getLocalDateStartInstant, getLocalDateEndInstant } from '@/lib/date-utils';
import {
  CreateBriefSnapshotInput,
  CreateBriefSnapshotSchema,
  CreateShareLinkInput,
  CreateShareLinkSchema,
  BriefSnapshotPayload,
  SourceRef,
  SharedBriefViewResult,
} from '../contracts/briefs.contract';

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Tạo fingerprint SHA-256 từ timestamp
 */
function computeFingerprint(timestamp: string): string {
  return crypto.createHash('sha256').update(timestamp).digest('hex').slice(0, 16);
}

/**
 * Server action: Tạo bản xem trước (Preview deterministic) cho Brief
 */
export async function generateBriefPreviewAction(
  input: CreateBriefSnapshotInput
): Promise<ActionResult<BriefSnapshotPayload>> {
  try {
    const { user } = await requireAuthenticatedUser();
    const parsed = CreateBriefSnapshotSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ.',
        },
      };
    }

    const { briefType, title, dateRangeStart, dateRangeEnd, includedCategories, userNotes } = parsed.data;
    const supabase = await getAgentASupabaseClient();
    if (!supabase) {
      return {
        success: false,
        error: { code: 'DB_UNAVAILABLE', message: 'Không thể kết nối cơ sở dữ liệu.' },
      };
    }

    // Lấy timezone
    const { data: profile } = await supabase
      .from('health_profiles')
      .select('timezone')
      .eq('user_id', user.id)
      .maybeSingle();
    const timezone = profile?.timezone || DEFAULT_APP_TIMEZONE;

    const sourceRefs: SourceRef[] = [];
    const missingDataNotes: string[] = [];

    // Tính toán ranh giới ngày địa phương chuẩn xác theo timezone người dùng (V7)
    const startInstant = getLocalDateStartInstant(dateRangeStart, timezone).toISOString();
    const endInstant = getLocalDateEndInstant(dateRangeEnd, timezone).toISOString();

    // 1. Lấy dữ liệu Activities (Nhật ký luyện tập)
    // V6: Lọc bỏ is_planned = true (chỉ tính các buổi đã tập thực sự)
    // V5: Kiểm tra actError, không được nuốt lỗi DB thành rỗng
    const { data: rawActivities, error: actError } = await supabase
      .from('activities')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_planned', false)
      .gte('start_at', startInstant)
      .lte('start_at', endInstant)
      .order('start_at', { ascending: true });

    if (actError) {
      return {
        success: false,
        error: {
          code: 'DB_READ_ERROR',
          message: 'Không thể đọc dữ liệu nhật ký hoạt động. Vui lòng thử lại.',
        },
      };
    }

    const activities = rawActivities || [];
    const activitiesCountByType: Record<string, number> = {};
    let totalActivityMinutes = 0;

    const sessions = activities.map((act) => {
      activitiesCountByType[act.activity_type] = (activitiesCountByType[act.activity_type] || 0) + 1;
      totalActivityMinutes += act.duration_minutes;

      const actUpdatedAt = act.updated_at || act.created_at;
      sourceRefs.push({
        sourceType: 'activities',
        sourceId: act.id,
        fingerprint: computeFingerprint(actUpdatedAt), sourceUpdatedAt: actUpdatedAt,
        recordedAt: act.created_at,
        summaryLabel: `Hoạt động ${act.activity_type} (${act.duration_minutes} phút)`,
      });

      return {
        date: getLocalDateString(new Date(act.start_at), timezone),
        activityType: act.activity_type,
        durationMinutes: act.duration_minutes,
        fatigueLevel: act.fatigue_level,
        notes: act.notes,
        sourceId: act.id,
      };
    });

    // 2. Lấy dữ liệu Daily Checkins (Giấc ngủ, sinh hoạt)
    // V5: Kiểm tra chkError, không nuốt lỗi DB
    const { data: rawCheckins, error: chkError } = await supabase
      .from('daily_checkins')
      .select('*')
      .eq('user_id', user.id)
      .gte('local_date', dateRangeStart)
      .lte('local_date', dateRangeEnd)
      .order('local_date', { ascending: true });

    if (chkError) {
      return {
        success: false,
        error: {
          code: 'DB_READ_ERROR',
          message: 'Không thể đọc dữ liệu điểm danh sinh hoạt. Vui lòng thử lại.',
        },
      };
    }

    const checkins = rawCheckins || [];
    let totalSleepMinutes = 0;
    let sleepCount = 0;

    const dailyCheckinTrends = checkins.map((chk) => {
      if (chk.sleep_duration_minutes) {
        totalSleepMinutes += chk.sleep_duration_minutes;
        sleepCount += 1;
      }

      const chkUpdatedAt = chk.updated_at || chk.created_at;
      sourceRefs.push({
        sourceType: 'daily_checkins',
        sourceId: chk.id,
        fingerprint: computeFingerprint(chkUpdatedAt), sourceUpdatedAt: chkUpdatedAt,
        recordedAt: chk.created_at,
        summaryLabel: `Check-in ngày ${chk.local_date}`,
      });

      return {
        date: chk.local_date,
        sleepDurationMinutes: chk.sleep_duration_minutes,
        sleepQuality: chk.sleep_quality,
        energyLevel: chk.energy_level,
        stressLevel: chk.stress_level,
      };
    });

    // 3. Lấy dữ liệu Observations (Chỉ số cơ thể)
    // V5: Kiểm tra obsError, không nuốt lỗi DB
    // V7: Sử dụng ranh giới múi giờ startInstant / endInstant
    const { data: rawObservations, error: obsError } = await supabase
      .from('observations')
      .select('*')
      .eq('user_id', user.id)
      .gte('observed_at', startInstant)
      .lte('observed_at', endInstant)
      .order('observed_at', { ascending: true });

    if (obsError) {
      return {
        success: false,
        error: {
          code: 'DB_READ_ERROR',
          message: 'Không thể đọc dữ liệu chỉ số cơ thể. Vui lòng thử lại.',
        },
      };
    }

    const observations = rawObservations || [];
    const vitalObservations = observations.map((obs) => {
      // V3: Dùng updated_at || created_at để phát hiện UPDATE
      const obsUpdatedAt = (obs as any).updated_at || obs.created_at;
      sourceRefs.push({
        sourceType: 'observations',
        sourceId: obs.id,
        fingerprint: computeFingerprint(obsUpdatedAt), sourceUpdatedAt: obsUpdatedAt,
        recordedAt: obs.created_at,
        summaryLabel: `Chỉ số ${obs.metric_type}: ${obs.metric_value} ${obs.metric_unit}`,
      });

      return {
        metricType: obs.metric_type,
        metricValue: Number(obs.metric_value),
        metricUnit: obs.metric_unit,
        observedAt: obs.observed_at,
      };
    });

    // Tính toán số ngày có dữ liệu và số ngày thiếu
    const recordedDates = new Set<string>();
    sessions.forEach((s) => recordedDates.add(s.date));
    dailyCheckinTrends.forEach((c) => recordedDates.add(c.date));

    const startDate = new Date(dateRangeStart);
    const endDate = new Date(dateRangeEnd);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const totalDaysInRange = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const missingDaysCount = Math.max(0, totalDaysInRange - recordedDates.size);

    if (missingDaysCount > 0) {
      missingDataNotes.push(
        `Trong giai đoạn ${totalDaysInRange} ngày, có ${missingDaysCount} ngày không ghi nhận hoạt động hoặc giấc ngủ.`
      );
    }

    if (sessions.length === 0) {
      missingDataNotes.push('Chưa có buổi tập nào được ghi nhận trong khoảng thời gian này.');
    }

    // 4. Mẫu Y tế (Medical Brief) - Chỉ lấy thuốc/dị ứng/bệnh sử nếu được chọn
    let medicalDetails: BriefSnapshotPayload['medicalDetails'] = undefined;
    if (briefType === 'medical') {
      let conditionsData: any[] = [];
      let allergiesData: any[] = [];
      let medicationsData: any[] = [];

      if (includedCategories.includes('conditions')) {
        const { data, error: condError } = await supabase
          .from('health_conditions')
          .select('*')
          .eq('user_id', user.id);

        if (condError) {
          return {
            success: false,
            error: {
              code: 'DB_READ_ERROR',
              message: 'Không thể đọc dữ liệu bệnh lý/tình trạng sức khỏe. Vui lòng thử lại.',
            },
          };
        }

        conditionsData = (data || []).map((c) => {
          sourceRefs.push({
            sourceType: 'conditions',
            sourceId: c.id,
            fingerprint: computeFingerprint(c.updated_at || c.created_at), sourceUpdatedAt: c.updated_at || c.created_at,
            recordedAt: c.created_at,
          });
          return {
            conditionName: (c as any).condition_name || (c as any).name,
            status: c.status,
            notes: c.notes,
          };
        });
      }

      if (includedCategories.includes('allergies')) {
        const { data, error: algError } = await supabase.from('allergies').select('*').eq('user_id', user.id);

        if (algError) {
          return {
            success: false,
            error: {
              code: 'DB_READ_ERROR',
              message: 'Không thể đọc dữ liệu dị ứng. Vui lòng thử lại.',
            },
          };
        }

        allergiesData = (data || []).map((a) => {
          sourceRefs.push({
            sourceType: 'allergies',
            sourceId: a.id,
            // V3: Dùng updated_at || created_at để nhận diện cập nhật
            fingerprint: computeFingerprint(a.updated_at || a.created_at), sourceUpdatedAt: a.updated_at || a.created_at,
            recordedAt: a.created_at,
          });
          return {
            allergen: a.allergen,
            reaction: a.reaction,
            severity: a.severity,
          };
        });
      }

      if (includedCategories.includes('medications')) {
        const { data, error: medError } = await supabase.from('medications').select('*').eq('user_id', user.id);

        if (medError) {
          return {
            success: false,
            error: {
              code: 'DB_READ_ERROR',
              message: 'Không thể đọc dữ liệu danh mục thuốc. Vui lòng thử lại.',
            },
          };
        }

        medicationsData = (data || []).map((m) => {
          sourceRefs.push({
            sourceType: 'medications',
            sourceId: m.id,
            fingerprint: computeFingerprint(m.updated_at || m.created_at), sourceUpdatedAt: m.updated_at || m.created_at,
            recordedAt: m.created_at,
          });
          return {
            medicationName: (m as any).medication_name || (m as any).name,
            dosage: (m as any).dosage || (m as any).dosage_instructions,
            frequency: (m as any).frequency || '',
          };
        });
      }

      medicalDetails = {
        selfReportedConditions: conditionsData,
        allergies: allergiesData,
        medications: medicationsData,
        vitalObservations,
        dailyCheckinTrends,
      };
    }

    const payload: BriefSnapshotPayload = {
      meta: {
        briefType,
        title,
        generatedAt: new Date().toISOString(),
        dateRange: {
          start: dateRangeStart,
          end: dateRangeEnd,
        },
        timezone,
        disclaimer:
          briefType === 'workout'
            ? 'Bản tóm tắt quá trình luyện tập tự khai nhằm mục đích trao đổi với người hướng dẫn. Không chứa thông tin y tế nhạy cảm.'
            : 'Bản chuẩn bị thông tin tự khai để trao đổi với nhân viên y tế. Đây không phải chẩn đoán y khoa hay hồ sơ bệnh án chính thức.',
      },
      overview: {
        totalRecords: sourceRefs.length,
        daysWithRecords: recordedDates.size,
        missingDaysCount,
        activitySessionCount: sessions.length,
        totalActivityMinutes,
        averageSleepMinutes: sleepCount > 0 ? Math.round(totalSleepMinutes / sleepCount) : null,
      },
      workoutDetails:
        briefType === 'workout'
          ? {
              activitiesCountByType,
              sessions,
              notesAndDifficulties: userNotes ? [userNotes] : [],
            }
          : undefined,
      medicalDetails,
      missingDataNotes,
      sourceRefs,
    };

    payload.confirmationToken = signBriefPreview(user.id, parsed.data, payload);
    return {
      success: true,
      data: payload,
    };
  } catch (err: any) {
    return {
      success: false,
      error: {
        code: err.name || 'PREVIEW_ERROR',
        message: err.message || 'Lỗi khi tạo bản xem trước tóm tắt.',
      },
    };
  }
}

/**
 * Server action: Lưu Snapshot bất biến vào bảng health_briefs
 * V4: Server tự tạo & xác minh snapshot từ nguồn thật thay vì tin nhận trực tiếp payload từ client
 */
export async function saveBriefSnapshotAction(
  input: CreateBriefSnapshotInput,
  _untrustedSnapshot?: BriefSnapshotPayload
): Promise<ActionResult<{ briefId: string }>> {
  try {
    const { user } = await requireAuthenticatedUser();
    const parsed = CreateBriefSnapshotSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message || 'Dữ liệu đầu vào không hợp lệ.',
        },
      };
    }

    // V4: Tạo snapshot phía server từ nguồn thật, đảm bảo dữ liệu toàn vẹn
    const previewRes = await generateBriefPreviewAction(parsed.data);
    if (!previewRes.success || !previewRes.data) {
      return {
        success: false,
        error: previewRes.error || {
          code: 'PREVIEW_GENERATION_FAILED',
          message: 'Không thể tạo bản tóm tắt xác minh từ nguồn dữ liệu.',
        },
      };
    }

    const verifiedSnapshot = previewRes.data;
    if (!_untrustedSnapshot || !verifyBriefPreview(user.id, parsed.data, _untrustedSnapshot, verifiedSnapshot)) {
      return { success:false, error:{code:'PREVIEW_STALE',message:'Dữ liệu hoặc lựa chọn đã thay đổi. Vui lòng xem trước lại trước khi lưu.'} };
    }
    const {confirmationToken:_confirmationToken,...storedSnapshot}=verifiedSnapshot;
    const supabase = await getAgentASupabaseClient();
    if (!supabase) {
      return { success: false, error: { code: 'DB_ERROR', message: 'Không thể kết nối DB' } };
    }

    const { data: brief, error } = await supabase
      .from('health_briefs')
      .insert({
        user_id: user.id,
        brief_type: parsed.data.briefType,
        title: parsed.data.title,
        date_range_start: parsed.data.dateRangeStart,
        date_range_end: parsed.data.dateRangeEnd,
        included_categories: parsed.data.includedCategories,
        snapshot_payload: storedSnapshot as any,
        source_fingerprints: verifiedSnapshot.sourceRefs as any,
        user_notes: parsed.data.userNotes || null,
        ai_summary: parsed.data.enableAISummary ? 'Bản tóm tắt tự động từ dữ liệu tự khai của người dùng.' : null,
      })
      .select('id')
      .single();

    if (error || !brief) {
      return {
        success: false,
        error: { code: 'SAVE_FAILED', message: error?.message || 'Không thể lưu bản tóm tắt' },
      };
    }

    return {
      success: true,
      data: { briefId: brief.id },
    };
  } catch (err: any) {
    return {
      success: false,
      error: { code: err.name || 'SAVE_ERROR', message: err.message },
    };
  }
}

/**
 * Server action: Tạo link chia sẻ bí mật có thời hạn và lưu hash vào brief_shares
 */
export async function createShareLinkAction(
  input: CreateShareLinkInput
): Promise<ActionResult<{ rawToken: string; shareUrl: string; expiresAt: string }>> {
  try {
    const { user } = await requireAuthenticatedUser();
    const parsed = CreateShareLinkSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: { code: 'INVALID_INPUT', message: 'Dữ liệu không hợp lệ' } };
    }

    const supabase = await getAgentASupabaseClient();
    if (!supabase) {
      return { success: false, error: { code: 'DB_ERROR', message: 'Không thể kết nối DB' } };
    }

    // 1. Kiểm tra ownership của brief
    const { data: brief, error: briefErr } = await supabase
      .from('health_briefs')
      .select('id')
      .eq('id', parsed.data.briefId)
      .eq('user_id', user.id)
      .single();

    if (briefErr || !brief) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Không tìm thấy bản tóm tắt hoặc bạn không có quyền.' },
      };
    }

    // 2. Sinh random token mạnh (base64url)
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // 3. Tính thời gian hết hạn (TTL)
    const days = parseInt(parsed.data.durationDays, 10);
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    // 4. Lưu hash vào DB
    const { error: shareErr } = await supabase.from('brief_shares').insert({
      brief_id: brief.id,
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    if (shareErr) {
      return {
        success: false,
        error: { code: 'SHARE_CREATE_FAILED', message: shareErr.message },
      };
    }

    const shareUrl = `/shared/briefs/${rawToken}`;

    return {
      success: true,
      data: {
        rawToken,
        shareUrl,
        expiresAt,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: { code: err.name || 'SHARE_ERROR', message: err.message },
    };
  }
}

/**
 * Server action: Thu hồi link chia sẻ (Revoke)
 */
export async function revokeShareLinkAction(
  briefId: string
): Promise<ActionResult<{ revokedCount: number }>> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await getAgentASupabaseClient();
    if (!supabase) {
      return { success: false, error: { code: 'DB_ERROR', message: 'Không thể kết nối DB' } };
    }

    const { data, error } = await supabase
      .from('brief_shares')
      .update({ revoked_at: new Date().toISOString() })
      .eq('brief_id', briefId)
      .eq('user_id', user.id)
      .is('revoked_at', null)
      .select('id');

    if (error) {
      return { success: false, error: { code: 'REVOKE_FAILED', message: error.message } };
    }

    return {
      success: true,
      data: { revokedCount: data?.length || 0 },
    };
  } catch (err: any) {
    return {
      success: false,
      error: { code: err.name || 'REVOKE_ERROR', message: err.message },
    };
  }
}

/**
 * Server function: Đọc dữ liệu chia sẻ cho người nhận bằng bearer token (V2 & V3)
 * Sử dụng RPC SECURITY DEFINER get_public_shared_brief để người nhận (anon / public)
 * đọc được bản tóm tắt an toàn, tự động kiểm tra TTL, thu hồi và Stale Detection trên toàn bộ nguồn!
 */
export async function getSharedBriefAction(token: string): Promise<SharedBriefViewResult> {
  if (!token || token.length < 16) {
    return { status: 'not_found', message: 'Liên kết không hợp lệ.' };
  }

  const supabase = await getAgentASupabaseClient();
  if (!supabase) {
    return { status: 'not_found', message: 'Hệ thống hiện không thể tải dữ liệu.' };
  }

  // 1. Tính hash token
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  // 2. Gọi RPC SECURITY DEFINER get_public_shared_brief (V2 & V3)
  const { data: rpcResult, error: rpcErr } = await (supabase as any).rpc('get_public_shared_brief', {
    p_token_hash: tokenHash,
  });

  if (rpcErr || !rpcResult) {
    return { status: 'not_found', message: 'Không tìm thấy liên kết chia sẻ hoặc liên kết đã bị xóa.' };
  }

  if (rpcResult.status === 'not_found') {
    return { status: 'not_found', message: rpcResult.message || 'Không tìm thấy liên kết chia sẻ.' };
  }

  if (rpcResult.status === 'revoked') {
    return {
      status: 'revoked',
      message: rpcResult.message || 'Chủ sở hữu đã thu hồi quyền truy cập của liên kết này.',
    };
  }

  if (rpcResult.status === 'expired') {
    return {
      status: 'expired',
      message: rpcResult.message || 'Liên kết chia sẻ này đã hết thời hạn sử dụng.',
    };
  }

  if (rpcResult.status === 'stale') {
    return {
      status: 'stale',
      message:
        rpcResult.message ||
        'Bản tóm tắt tạm ngừng hiển thị vì dữ liệu nguồn đã bị thay đổi hoặc xóa bởi chủ sở hữu.',
      staleDetails: {
        staleSourceCount: rpcResult.stale_details?.stale_source_count || 1,
        message: rpcResult.stale_details?.message || 'Dữ liệu nguồn đã thay đổi.',
      },
    };
  }

  if (rpcResult.status === 'active') {
    return {
      status: 'active',
      shareInfo: {
        expiresAt: rpcResult.expires_at,
        createdAt: rpcResult.created_at,
      },
      snapshot: rpcResult.snapshot,
      userNotes: rpcResult.user_notes,
      aiSummary: rpcResult.ai_summary,
    };
  }

  return {
    status: 'not_found',
    message: 'Trạng thái liên kết không xác định.',
  };
}
