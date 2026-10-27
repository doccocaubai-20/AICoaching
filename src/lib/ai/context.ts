/**
 * CALISCOACHING MVP - DỰNG NGỮ CẢNH TỐI GIẢN & KIỂM TRA THAM CHIẾU (AGENT E)
 * Thu thập dữ liệu tối thiểu ở Server, lọc bỏ danh tính cá nhân và kiểm tra ID tham chiếu.
 * Thực thi nghiêm ngặt phạm vi đồng ý (Scope of Consent) cho cả dữ liệu gốc và dữ liệu dẫn xuất.
 */

import {
  ProfileEntity,
  GoalEntity,
  ActivityEntity,
  ObservationEntity,
  ReviewSuggestionEntity,
  ConsentScopeItem,
  DailyCheckinEntity,
  BloodPressureEntity,
  computeCheckinWeeklyStats,
} from '@/contracts';
import { AIContextPayload, AIReferenceSourceItem } from './types';
import { formatDateVN } from '@/components/dashboard/date-utils';

export interface BuildAIContextInput {
  profile?: ProfileEntity | null;
  goals?: GoalEntity[];
  activities?: ActivityEntity[];
  observations?: ObservationEntity[];
  reviewSuggestions?: ReviewSuggestionEntity[];
  dailyCheckins?: DailyCheckinEntity[];
  bloodPressures?: BloodPressureEntity[];
  dateWindow?: {
    from: string;
    to: string;
  };
  scope?: ConsentScopeItem[];
}

/**
 * Dựng ngữ cảnh tối thiểu gửi cho AI ở Server.
 * NGUYÊN TẮC BẢO MẬT:
 * 1. Tuyệt đối KHÔNG gửi display_name, email hay user_id ra bên ngoài.
 * 2. Chỉ gửi những loại dữ liệu nằm trong phạm vi người dùng đã đồng ý (scope).
 * 3. Dữ liệu dẫn xuất (review_suggestions) chỉ được đưa vào nếu scope có 'activities'.
 * 4. Áp dụng nghiêm ngặt cả cận dưới và cận trên của cửa sổ thời gian.
 */
export function buildAIContext(input: BuildAIContextInput): {
  context: AIContextPayload;
  allowedRecordIds: Set<string>;
} {
  const allowedRecordIds = new Set<string>();
  const effectiveScope = input.scope || ['profile', 'goals', 'activities', 'observations'];

  const dateFrom = input.dateWindow?.from || new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const dateTo = input.dateWindow?.to || new Date().toISOString();
  const fromTime = new Date(dateFrom).getTime();
  const toTime = new Date(dateTo).getTime();

  // 1. Hồ sơ: chỉ lấy thông tin tập luyện nếu scope có 'profile', bỏ display_name và user_id
  const profile =
    effectiveScope.includes('profile') && input.profile
      ? {
          experience_level: input.profile.experience_level,
          available_equipment: input.profile.available_equipment || [],
          schedule_availability: input.profile.schedule_availability || [],
        }
      : undefined;

  // 2. Mục tiêu: chỉ lấy nếu scope có 'goals', giữ id để AI trích dẫn
  const goals = effectiveScope.includes('goals')
    ? (input.goals || []).map((g) => {
        allowedRecordIds.add(g.id);
        return {
          id: g.id,
          content: g.content,
          goal_type: g.goal_type,
          status: g.status,
          start_date: g.start_date,
          end_date: g.end_date,
        };
      })
    : [];

  // 3. Hoạt động: chỉ lấy nếu scope có 'activities' VÀ nằm trong cửa sổ [dateFrom, dateTo]
  const activities = effectiveScope.includes('activities')
    ? (input.activities || [])
        .filter((a) => {
          const t = new Date(a.start_at).getTime();
          return !isNaN(t) && t >= fromTime && t <= toTime;
        })
        .map((a) => {
          allowedRecordIds.add(a.id);
          return {
            id: a.id,
            activity_type: a.activity_type,
            is_planned: a.is_planned,
            start_at: formatDateVN(a.start_at, { hour: '2-digit', minute: '2-digit' }),
            duration_minutes: a.duration_minutes,
            fatigue_level: a.fatigue_level,
            notes: a.notes,
            source: a.source,
          };
        })
    : [];

  // 4. Chỉ số tự khai: chỉ lấy nếu scope có 'observations' VÀ nằm trong cửa sổ [dateFrom, dateTo]
  const observations = effectiveScope.includes('observations')
    ? (input.observations || [])
        .filter((o) => {
          const t = new Date(o.observed_at).getTime();
          return !isNaN(t) && t >= fromTime && t <= toTime;
        })
        .map((o) => {
          allowedRecordIds.add(o.id);
          return {
            id: o.id,
            metric_type: o.metric_type,
            metric_value: o.metric_value,
            metric_unit: o.metric_unit,
            observed_at: formatDateVN(o.observed_at),
            source: o.source,
          };
        })
    : [];

  // 5. Gợi ý xem lại lịch (dữ liệu dẫn xuất từ hoạt động):
  // NGUYÊN TẮC: Chỉ đưa vào khi scope CÓ 'activities'.
  // reference_activity_ids chỉ giữ lại các ID hoạt động thuộc allowedRecordIds.
  const reviewSuggestions = effectiveScope.includes('activities')
    ? (input.reviewSuggestions || [])
        .filter((s) => s.status === 'pending' || s.status === 'acknowledged')
        .map((s) => {
          allowedRecordIds.add(s.id);
          const filteredRefs = (s.reference_activity_ids || []).filter((id) =>
            allowedRecordIds.has(id)
          );
          return {
            id: s.id,
            reason: s.reason,
            reference_activity_ids: filteredRefs,
            rule_version: s.rule_version,
            status: s.status,
          };
        })
    : [];

  // 6. Sinh hoạt & Giấc ngủ V2 (E7): chỉ lấy khi scope có 'daily_checkins'
  let daily_checkins: AIContextPayload['daily_checkins'] = undefined;
  let daily_checkins_summary: AIContextPayload['daily_checkins_summary'] = undefined;

  if (effectiveScope.includes('daily_checkins') && input.dailyCheckins) {
    const fromDateStr = new Date(fromTime).toISOString().slice(0, 10);
    const toDateStr = new Date(toTime).toISOString().slice(0, 10);

    const filteredCheckins = input.dailyCheckins.filter(
      (c) => c.local_date && c.local_date >= fromDateStr && c.local_date <= toDateStr
    );

    filteredCheckins.forEach((c) => allowedRecordIds.add(c.id));

    daily_checkins = filteredCheckins.map((c) => ({
      id: c.id,
      local_date: c.local_date,
      sleep_duration_minutes: c.sleep_duration_minutes,
      sleep_quality: c.sleep_quality,
      energy_level: c.energy_level,
      stress_level: c.stress_level,
    }));

    const stats = computeCheckinWeeklyStats(filteredCheckins);
    daily_checkins_summary = {
      recorded_days: stats.totalRecordedDays,
      average_sleep_minutes: stats.averageSleepMinutes,
      average_energy: stats.averageEnergy,
      average_stress: stats.averageStress,
      summary_text: stats.summaryText,
    };
  }

  // 7. Huyết áp V2 (E7): chỉ lấy khi scope có 'blood_pressures'
  let blood_pressures: AIContextPayload['blood_pressures'] = undefined;
  if (effectiveScope.includes('blood_pressures') && input.bloodPressures) {
    const filteredBP = input.bloodPressures.filter((b) => {
      const t = new Date(b.measured_at).getTime();
      return !isNaN(t) && t >= fromTime && t <= toTime;
    });

    filteredBP.forEach((b) => allowedRecordIds.add(b.id));

    blood_pressures = filteredBP.map((b) => ({
      id: b.id,
      systolic: b.systolic,
      diastolic: b.diastolic,
      measured_at: formatDateVN(b.measured_at),
      source: b.source,
    }));
  }

  const context: AIContextPayload = {
    profile,
    goals,
    activities,
    observations,
    daily_checkins,
    daily_checkins_summary,
    blood_pressures,
    review_suggestions: reviewSuggestions.length > 0 ? reviewSuggestions : undefined,
    date_window: {
      from: formatDateVN(dateFrom),
      to: formatDateVN(dateTo),
    },
  };

  return {
    context,
    allowedRecordIds,
  };
}

/**
 * Lọc và loại bỏ các ID tham chiếu lạ không thuộc tập ID đã gửi cho AI.
 */
export function filterValidReferences(
  references: AIReferenceSourceItem[],
  allowedRecordIds: Set<string>
): { validReferences: AIReferenceSourceItem[]; removedCount: number } {
  if (!Array.isArray(references)) {
    return { validReferences: [], removedCount: 0 };
  }

  let removedCount = 0;
  const validReferences: AIReferenceSourceItem[] = [];

  for (const ref of references) {
    if (ref && typeof ref.id === 'string' && allowedRecordIds.has(ref.id)) {
      validReferences.push(ref);
    } else {
      removedCount++;
    }
  }

  return {
    validReferences,
    removedCount,
  };
}
