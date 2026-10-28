'use server';

import crypto from 'node:crypto';
import { requireAuthenticatedUser } from '@/lib/server/auth-guard';
import { getAgentASupabaseClient } from '@/features/common/supabase-a';
import { DEFAULT_APP_TIMEZONE, getLocalDateString } from '@/lib/date-utils';
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

    // 1. Lấy dữ liệu Activities (Nhật ký luyện tập)
    const { data: rawActivities } = await supabase
      .from('activities')
      .select('*')
      .eq('user_id', user.id)
      .gte('start_at', `${dateRangeStart}T00:00:00.000Z`)
      .lte('start_at', `${dateRangeEnd}T23:59:59.999Z`)
      .order('start_at', { ascending: true });

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
        fingerprint: computeFingerprint(actUpdatedAt),
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
    const { data: rawCheckins } = await supabase
      .from('daily_checkins')
      .select('*')
      .eq('user_id', user.id)
      .gte('local_date', dateRangeStart)
      .lte('local_date', dateRangeEnd)
      .order('local_date', { ascending: true });

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
        fingerprint: computeFingerprint(chkUpdatedAt),
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
    const { data: rawObservations } = await supabase
      .from('observations')
      .select('*')
      .eq('user_id', user.id)
      .gte('observed_at', `${dateRangeStart}T00:00:00.000Z`)
      .lte('observed_at', `${dateRangeEnd}T23:59:59.999Z`)
      .order('observed_at', { ascending: true });

    const observations = rawObservations || [];
    const vitalObservations = observations.map((obs) => {
      sourceRefs.push({
        sourceType: 'observations',
        sourceId: obs.id,
        fingerprint: computeFingerprint(obs.created_at),
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
        const { data } = await supabase
          .from('health_conditions')
          .select('*')
          .eq('user_id', user.id);
        conditionsData = (data || []).map((c) => {
          sourceRefs.push({
            sourceType: 'conditions',
            sourceId: c.id,
            fingerprint: computeFingerprint(c.updated_at || c.created_at),
            recordedAt: c.created_at,
          });
          return {
            conditionName: c.condition_name,
            status: c.status,
            notes: c.notes,
          };
        });
      }

      if (includedCategories.includes('allergies')) {
        const { data } = await supabase.from('allergies').select('*').eq('user_id', user.id);
        allergiesData = (data || []).map((a) => {
          sourceRefs.push({
            sourceType: 'allergies',
            sourceId: a.id,
            fingerprint: computeFingerprint(a.created_at),
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
        const { data } = await supabase.from('medications').select('*').eq('user_id', user.id);
        medicationsData = (data || []).map((m) => {
          sourceRefs.push({
            sourceType: 'medications',
            sourceId: m.id,
            fingerprint: computeFingerprint(m.updated_at || m.created_at),
            recordedAt: m.created_at,
          });
          return {
            medicationName: m.medication_name,
            dosage: m.dosage,
            frequency: m.frequency,
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
 */
export async function saveBriefSnapshotAction(
  input: CreateBriefSnapshotInput,
  snapshot: BriefSnapshotPayload
): Promise<ActionResult<{ briefId: string }>> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await getAgentASupabaseClient();
    if (!supabase) {
      return { success: false, error: { code: 'DB_ERROR', message: 'Không thể kết nối DB' } };
    }

    const { data: brief, error } = await supabase
      .from('health_briefs')
      .insert({
        user_id: user.id,
        brief_type: input.briefType,
        title: input.title,
        date_range_start: input.dateRangeStart,
        date_range_end: input.dateRangeEnd,
        included_categories: input.includedCategories,
        snapshot_payload: snapshot as any,
        source_fingerprints: snapshot.sourceRefs as any,
        user_notes: input.userNotes || null,
        ai_summary: input.enableAISummary ? 'Bản tóm tắt tự động từ dữ liệu tự khai của người dùng.' : null,
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
 * Server function: Đọc dữ liệu chia sẻ cho người nhận bằng bearer token
 * Kiểm tra hash token, hạn sử dụng, thu hồi và STALE DETECTION trên nguồn DB!
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

  // 2. Tìm bản ghi share
  const { data: share, error: shareErr } = await supabase
    .from('brief_shares')
    .select('id, brief_id, user_id, token_hash, expires_at, revoked_at, access_count, last_accessed_at, created_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (shareErr || !share) {
    return { status: 'not_found', message: 'Không tìm thấy liên kết chia sẻ hoặc liên kết đã bị xóa.' };
  }

  // Lấy health_brief tương ứng
  const { data: brief, error: briefErr } = await supabase
    .from('health_briefs')
    .select('*')
    .eq('id', share.brief_id)
    .maybeSingle();

  if (briefErr || !brief) {
    return { status: 'not_found', message: 'Không tìm thấy bản tóm tắt liên kết.' };
  }

  // 3. Kiểm tra Thu hồi (Revoked)
  if (share.revoked_at) {
    return {
      status: 'revoked',
      message: 'Chủ sở hữu đã thu hồi quyền truy cập của liên kết này.',
    };
  }

  // 4. Kiểm tra Hết hạn (Expired)
  const now = new Date();
  const expiresAt = new Date(share.expires_at);
  if (expiresAt < now) {
    return {
      status: 'expired',
      message: `Liên kết chia sẻ này đã hết hạn vào ${expiresAt.toLocaleString('vi-VN')}.`,
    };
  }

  const snapshot: BriefSnapshotPayload = brief.snapshot_payload as any;
  const sourceRefs: SourceRef[] = (brief.source_fingerprints as any) || [];

  // 5. STALE DETECTION: Kiểm tra xem bản ghi nguồn có bị sửa/xóa không
  const activityRefs = sourceRefs.filter((r) => r.sourceType === 'activities');
  if (activityRefs.length > 0) {
    const activityIds = activityRefs.map((r) => r.sourceId);
    const { data: currentActivities } = await supabase
      .from('activities')
      .select('id, updated_at, created_at')
      .in('id', activityIds);

    const currentMap = new Map((currentActivities || []).map((a) => [a.id, a]));

    for (const ref of activityRefs) {
      const current = currentMap.get(ref.sourceId);
      if (!current) {
        // Bản ghi nguồn đã bị XÓA
        return {
          status: 'stale',
          message: 'Bản tóm tắt tạm ngừng hiển thị vì dữ liệu nguồn đã bị thay đổi hoặc xóa bởi chủ sở hữu.',
          staleDetails: {
            staleSourceCount: 1,
            message: 'Bản ghi hoạt động gốc không còn tồn tại.',
          },
        };
      }

      const currentFp = computeFingerprint(current.updated_at || current.created_at);
      if (currentFp !== ref.fingerprint) {
        // Bản ghi nguồn đã bị SỬA
        return {
          status: 'stale',
          message: 'Bản tóm tắt tạm ngừng hiển thị vì dữ liệu nguồn đã được cập nhật bởi chủ sở hữu.',
          staleDetails: {
            staleSourceCount: 1,
            message: 'Nội dung buổi tập nguồn đã được chỉnh sửa.',
          },
        };
      }
    }
  }

  // 6. Cập nhật lượt truy cập (access_count & last_accessed_at)
  await supabase
    .from('brief_shares')
    .update({
      access_count: (share.access_count || 0) + 1,
      last_accessed_at: new Date().toISOString(),
    })
    .eq('id', share.id);

  // 7. Trả về Safe Snapshot View (Allowlist data only - KHÔNG có user_id hay raw entities)
  return {
    status: 'active',
    shareInfo: {
      expiresAt: share.expires_at,
      createdAt: share.created_at,
    },
    snapshot,
    userNotes: brief.user_notes,
    aiSummary: brief.ai_summary,
  };
}
