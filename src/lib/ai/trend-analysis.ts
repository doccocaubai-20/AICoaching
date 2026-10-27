/**
 * CALISCOACHING MVP - PHÂN TÍCH XU HƯỚNG HỒ SƠ P1 (AGENT E)
 * Nguyên tắc: Số liệu do mã TypeScript tính thuần, AI chỉ diễn giải văn phong và trích dẫn.
 * Server kiểm tra số và ID trước khi lưu vào database.
 */

import {
  ActivityEntity,
  ObservationEntity,
  GoalEntity,
  ProfileEntity,
  ConsentScopeItem,
  SessionResultEntity,
} from '@/contracts';
import { AIReferenceSourceItem } from './types';
import { ACTIVITY_TYPE_LABELS } from '@/components/activities/activity-utils';
import { formatDateVN } from '@/components/dashboard/date-utils';

export const MIN_FATIGUE_DATA_POINTS = 3;

export interface WeeklyFrequencyItem {
  week_number: number;
  label: string;
  from_date: string;
  to_date: string;
  session_count: number;
  has_records: boolean; // false nếu tuần không có bản ghi nào
  activity_ids: string[];
}

export interface SportDistributionItem {
  sport: string;
  label: string;
  minutes: number;
  percentage: number;
  session_count: number;
  activity_ids: string[];
}

export interface FatigueTrendItem {
  sport: string;
  label: string;
  sessions_with_fatigue: number;
  average_fatigue: number | null; // null nếu chưa đủ điểm dữ liệu tối thiểu
  status: 'sufficient_data' | 'insufficient_data';
  activity_ids: string[];
}

export interface ScheduleAlignmentMetric {
  status: 'sufficient_data' | 'insufficient_data';
  reason?: string;
  matching_sessions_count: number;
  total_completed_sessions: number;
  match_percentage: number | null;
  activity_ids: string[];
}

export interface GoalProgressMetric {
  status: 'sufficient_data' | 'insufficient_data';
  reason?: string;
  session_results_count: number;
  active_goals_count: number;
  session_result_ids: string[];
}

export interface ProfileMetrics {
  period: {
    from: string;
    to: string;
    weeks: number;
  };
  total_completed_sessions: number;
  total_completed_minutes: number;
  weekly_frequency: WeeklyFrequencyItem[];
  plan_vs_actual: {
    planned_count: number;
    actual_count: number;
    activity_ids: string[];
  };
  sport_distribution: SportDistributionItem[];
  fatigue_trends: FatigueTrendItem[];
  schedule_alignment: ScheduleAlignmentMetric;
  goal_progress: GoalProgressMetric;
  missing_data_ratios: {
    missing_fatigue_percentage: number;
    missing_weight_in_period: boolean;
    unrecorded_weeks_count: number;
  };
  allowed_record_ids: string[];
}

export interface ComputeMetricsInput {
  activities?: ActivityEntity[];
  observations?: ObservationEntity[];
  goals?: GoalEntity[];
  profile?: ProfileEntity | null;
  sessionResults?: SessionResultEntity[];
  weeks?: 4 | 8;
  now?: Date;
  scope?: ConsentScopeItem[];
}

/**
 * Hàm thuần tính toán toàn bộ chỉ số xu hướng hồ sơ rèn luyện.
 * Không suy đoán, tuần trống ghi là không có bản ghi, thiếu dữ liệu ghi nhận rõ ràng.
 * Thực thi phạm vi đồng ý (Scope of Consent).
 */
export function computeProfileMetrics(input: ComputeMetricsInput): ProfileMetrics {
  const weeks = input.weeks === 8 ? 8 : 4;
  const now = input.now || new Date();
  const startTimeMs = now.getTime() - weeks * 7 * 24 * 3600 * 1000;
  const fromDate = new Date(startTimeMs);

  const effectiveScope = input.scope || ['profile', 'goals', 'activities', 'observations'];

  const rawActivities = effectiveScope.includes('activities') ? (input.activities || []) : [];
  const rawObservations = effectiveScope.includes('observations') ? (input.observations || []) : [];
  const rawGoals = effectiveScope.includes('goals') ? (input.goals || []) : [];
  const rawSessionResults = effectiveScope.includes('activities') ? (input.sessionResults || []) : [];

  const activities = rawActivities.filter((a) => {
    const actTime = new Date(a.start_at).getTime();
    return actTime >= startTimeMs && actTime <= now.getTime();
  });

  const observations = rawObservations.filter((o) => {
    const obsTime = new Date(o.observed_at).getTime();
    return obsTime >= startTimeMs && obsTime <= now.getTime();
  });

  const sessionResults = rawSessionResults.filter((s) => {
    const sTime = new Date(s.completed_at).getTime();
    return sTime >= startTimeMs && sTime <= now.getTime();
  });

  const allowedRecordIds = new Set<string>();
  activities.forEach((a) => allowedRecordIds.add(a.id));
  observations.forEach((o) => allowedRecordIds.add(o.id));
  rawGoals.forEach((g) => allowedRecordIds.add(g.id));
  sessionResults.forEach((s) => allowedRecordIds.add(s.id));

  // 1. Tần suất theo tuần
  const weeklyFrequency: WeeklyFrequencyItem[] = [];
  let unrecordedWeeksCount = 0;

  for (let w = 0; w < weeks; w++) {
    const wStart = new Date(startTimeMs + w * 7 * 24 * 3600 * 1000);
    const wEnd = new Date(startTimeMs + (w + 1) * 7 * 24 * 3600 * 1000);

    const weekActs = activities.filter((a) => {
      const t = new Date(a.start_at).getTime();
      return t >= wStart.getTime() && t < wEnd.getTime();
    });

    const completed = weekActs.filter((a) => !a.is_planned);
    const hasRecords = weekActs.length > 0;

    if (!hasRecords) {
      unrecordedWeeksCount++;
    }

    weeklyFrequency.push({
      week_number: w + 1,
      label: `Tuần ${w + 1}`,
      from_date: formatDateVN(wStart.toISOString()),
      to_date: formatDateVN(wEnd.toISOString()),
      session_count: completed.length,
      has_records: hasRecords,
      activity_ids: completed.map((a) => a.id),
    });
  }

  // 2. Kế hoạch vs Thực tế
  const plannedActivities = activities.filter((a) => a.is_planned);
  const actualActivities = activities.filter((a) => !a.is_planned);

  const planVsActual = {
    planned_count: plannedActivities.length,
    actual_count: actualActivities.length,
    activity_ids: activities.map((a) => a.id),
  };

  // 3. Cơ cấu thời lượng theo môn
  const totalCompletedMinutes = actualActivities.reduce((acc, a) => acc + (a.duration_minutes || 0), 0);
  const sportMinutesMap = new Map<string, { minutes: number; count: number; ids: string[] }>();

  for (const act of actualActivities) {
    const sport = act.activity_type;
    const current = sportMinutesMap.get(sport) || { minutes: 0, count: 0, ids: [] };
    current.minutes += act.duration_minutes || 0;
    current.count += 1;
    current.ids.push(act.id);
    sportMinutesMap.set(sport, current);
  }

  const sportDistribution: SportDistributionItem[] = [];
  for (const [sport, data] of sportMinutesMap.entries()) {
    const percentage =
      totalCompletedMinutes > 0 ? Math.round((data.minutes / totalCompletedMinutes) * 100) : 0;
    sportDistribution.push({
      sport,
      label: ACTIVITY_TYPE_LABELS[sport as keyof typeof ACTIVITY_TYPE_LABELS] || sport,
      minutes: data.minutes,
      percentage,
      session_count: data.count,
      activity_ids: data.ids,
    });
  }
  // Sắp xếp môn có thời lượng nhiều nhất lên đầu
  sportDistribution.sort((a, b) => b.minutes - a.minutes);

  // 4. Xu hướng mức mệt theo môn (ngưỡng tối thiểu MIN_FATIGUE_DATA_POINTS)
  const fatigueTrends: FatigueTrendItem[] = [];
  for (const [sport, data] of sportMinutesMap.entries()) {
    const actsWithFatigue = actualActivities.filter(
      (a) => a.activity_type === sport && a.fatigue_level != null
    );
    const count = actsWithFatigue.length;

    if (count >= MIN_FATIGUE_DATA_POINTS) {
      const sum = actsWithFatigue.reduce((acc, a) => acc + (a.fatigue_level || 0), 0);
      const avg = Math.round((sum / count) * 10) / 10;
      fatigueTrends.push({
        sport,
        label: ACTIVITY_TYPE_LABELS[sport as keyof typeof ACTIVITY_TYPE_LABELS] || sport,
        sessions_with_fatigue: count,
        average_fatigue: avg,
        status: 'sufficient_data',
        activity_ids: actsWithFatigue.map((a) => a.id),
      });
    } else {
      fatigueTrends.push({
        sport,
        label: ACTIVITY_TYPE_LABELS[sport as keyof typeof ACTIVITY_TYPE_LABELS] || sport,
        sessions_with_fatigue: count,
        average_fatigue: null,
        status: 'insufficient_data',
        activity_ids: actsWithFatigue.map((a) => a.id),
      });
    }
  }

  // 5. Lịch rảnh trong profile so với giờ hoạt động thực tế (Giờ Việt Nam: UTC+7)
  let scheduleAlignment: ScheduleAlignmentMetric = {
    status: 'insufficient_data',
    reason: 'Chưa khai báo lịch rảnh trong hồ sơ hoặc không có quyền xem hồ sơ',
    matching_sessions_count: 0,
    total_completed_sessions: actualActivities.length,
    match_percentage: null,
    activity_ids: [],
  };

  if (effectiveScope.includes('profile') && input.profile?.schedule_availability) {
    const rawSched = input.profile.schedule_availability;
    const schedArray = Array.isArray(rawSched) ? rawSched : [];

    if (schedArray.length > 0 && actualActivities.length > 0) {
      const matchingIds: string[] = [];
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

      for (const act of actualActivities) {
        // Đổi giờ sang giờ Việt Nam (+7)
        const actDate = new Date(new Date(act.start_at).getTime() + 7 * 3600 * 1000);
        const dayOfWeek = dayNames[actDate.getUTCDay()];

        const matchedSlot = schedArray.find(
          (s) =>
            Boolean(
              s &&
                typeof s === 'object' &&
                'day_of_week' in s &&
                (s as Record<string, unknown>).day_of_week === dayOfWeek
            )
        );

        if (matchedSlot) {
          matchingIds.push(act.id);
        }
      }

      const matchPct = Math.round((matchingIds.length / actualActivities.length) * 100);
      scheduleAlignment = {
        status: 'sufficient_data',
        matching_sessions_count: matchingIds.length,
        total_completed_sessions: actualActivities.length,
        match_percentage: matchPct,
        activity_ids: matchingIds,
      };
    } else if (actualActivities.length === 0) {
      scheduleAlignment = {
        status: 'insufficient_data',
        reason: 'Chưa có buổi tập hoàn thành nào trong chu kỳ để đối chiếu lịch rảnh',
        matching_sessions_count: 0,
        total_completed_sessions: 0,
        match_percentage: null,
        activity_ids: [],
      };
    }
  }

  // 6. Tiến độ mục tiêu từ kết quả buổi tập (session_results)
  let goalProgress: GoalProgressMetric = {
    status: 'insufficient_data',
    reason: 'Chưa có kết quả buổi tập hoặc mục tiêu để đối chiếu',
    session_results_count: sessionResults.length,
    active_goals_count: rawGoals.filter((g) => g.status === 'active').length,
    session_result_ids: sessionResults.map((s) => s.id),
  };

  const activeGoals = rawGoals.filter((g) => g.status === 'active');
  if (sessionResults.length > 0 && activeGoals.length > 0) {
    goalProgress = {
      status: 'sufficient_data',
      session_results_count: sessionResults.length,
      active_goals_count: activeGoals.length,
      session_result_ids: sessionResults.map((s) => s.id),
    };
  }

  // 7. Tỷ lệ thiếu dữ liệu
  const missingFatigueCount = actualActivities.filter((a) => a.fatigue_level == null).length;
  const missingFatiguePercentage =
    actualActivities.length > 0 ? Math.round((missingFatigueCount / actualActivities.length) * 100) : 0;

  const hasWeight = observations.some((o) => o.metric_type === 'weight');

  return {
    period: {
      from: formatDateVN(fromDate.toISOString()),
      to: formatDateVN(now.toISOString()),
      weeks,
    },
    total_completed_sessions: actualActivities.length,
    total_completed_minutes: totalCompletedMinutes,
    weekly_frequency: weeklyFrequency,
    plan_vs_actual: planVsActual,
    sport_distribution: sportDistribution,
    fatigue_trends: fatigueTrends,
    schedule_alignment: scheduleAlignment,
    goal_progress: goalProgress,
    missing_data_ratios: {
      missing_fatigue_percentage: missingFatiguePercentage,
      missing_weight_in_period: !hasWeight,
      unrecorded_weeks_count: unrecordedWeeksCount,
    },
    allowed_record_ids: Array.from(allowedRecordIds),
  };
}

export interface AITrendHighlight {
  metric_key: string;
  text: string;
  references: AIReferenceSourceItem[];
}

export interface AITrendOutput {
  highlights: AITrendHighlight[];
  missing_data: string[];
  period: {
    from: string;
    to: string;
    weeks: number;
  };
}

/**
 * Trích xuất toàn bộ các khóa chỉ số (metric_key) hợp lệ từ ProfileMetrics.
 */
export function getValidMetricKeys(metrics: ProfileMetrics): Set<string> {
  const keys = new Set<string>();
  keys.add('total_completed_sessions');
  keys.add('total_completed_minutes');
  keys.add('plan_vs_actual');
  keys.add('plan_vs_actual:planned');
  keys.add('plan_vs_actual:actual');
  keys.add('weekly_frequency');
  keys.add('schedule_alignment');
  keys.add('goal_progress');

  for (const w of metrics.weekly_frequency) {
    keys.add(`weekly_frequency:week_${w.week_number}`);
  }

  for (const s of metrics.sport_distribution) {
    keys.add(`sport_distribution:${s.sport}`);
  }

  for (const f of metrics.fatigue_trends) {
    keys.add(`fatigue_trends:${f.sport}`);
  }

  keys.add('missing_data:fatigue');
  keys.add('missing_data:weight');
  keys.add('missing_data:unrecorded_weeks');

  return keys;
}

/**
 * Kiểm tra tính nhất quán về đơn vị và số liệu giữa text và metrics:
 * BẢO ĐẢM KHÔNG BAO GIỜ CHO PHÉP HOÁN ĐỔI SỐ LƯỢNG VÀ THỜI LƯỢNG (E6).
 */
function validateHighlightNumbersAndUnits(
  text: string,
  metric_key: string,
  metrics: ProfileMetrics
): boolean {
  // Loại bỏ các mốc ngày tháng như "29/09/2026", "27/10/2026" hoặc "2026-10-27"
  // để ngày tháng không bị đối chiếu nhầm với số liệu vận động (E7)
  const sanitizedText = text
    .replace(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, '')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, '');

  // 1. Kiểm tra số buổi (sessions / buổi / lượt tập)
  const sessionMatch = sanitizedText.match(/(?:^|[^\d.,])(\d+)\s*(?:buổi|lượt tập|buoi|session)(?!\w)/i);
  if (sessionMatch) {
    const statedSessions = parseInt(sessionMatch[1], 10);
    let expectedSessions = metrics.total_completed_sessions;

    if (metric_key.startsWith('sport_distribution:')) {
      const sport = metric_key.replace('sport_distribution:', '');
      const item = metrics.sport_distribution.find((s) => s.sport === sport);
      expectedSessions = item?.session_count ?? 0;
    } else if (metric_key.startsWith('weekly_frequency:week_')) {
      const wNum = parseInt(metric_key.replace('weekly_frequency:week_', ''), 10);
      const wItem = metrics.weekly_frequency.find((w) => w.week_number === wNum);
      expectedSessions = wItem?.session_count ?? 0;
    } else if (metric_key === 'plan_vs_actual:actual' || metric_key === 'plan_vs_actual') {
      expectedSessions = metrics.plan_vs_actual.actual_count;
    } else if (metric_key === 'plan_vs_actual:planned') {
      expectedSessions = metrics.plan_vs_actual.planned_count;
    }

    if (statedSessions !== expectedSessions) {
      return false; // Sai số buổi hoặc hoán đổi đơn vị
    }
  }

  // 2. Kiểm tra số phút (minutes / phút)
  const minuteMatch = sanitizedText.match(/(?:^|[^\d.,])(\d+(?:[.,]\d+)?)\s*(?:phút|phut|minute|min)(?!\w)/i);
  if (minuteMatch) {
    const statedMinutes = parseFloat(minuteMatch[1].replace(',', '.'));
    let expectedMinutes = metrics.total_completed_minutes;

    if (metric_key.startsWith('sport_distribution:')) {
      const sport = metric_key.replace('sport_distribution:', '');
      const item = metrics.sport_distribution.find((s) => s.sport === sport);
      expectedMinutes = item?.minutes ?? 0;
    }

    if (statedMinutes !== expectedMinutes) {
      return false; // Sai số phút hoặc hoán đổi đơn vị
    }
  }

  // 3. Kiểm tra số tuần (weeks / tuần)
  const weekMatch = sanitizedText.match(/(?:^|[^\d.,])(\d+)\s*(?:tuần|tuan|week)(?!\w)/i);
  if (weekMatch) {
    const statedWeeks = parseInt(weekMatch[1], 10);
    if (statedWeeks !== metrics.period.weeks) {
      return false; // Sai số tuần
    }
  }

  // 4. Kiểm tra phần trăm (% / phần trăm)
  const percentMatch = sanitizedText.match(/(?:^|[^\d.,])(\d+(?:[.,]\d+)?)\s*(?:%|phần trăm)(?!\w)/i);
  if (percentMatch) {
    const statedPercent = parseFloat(percentMatch[1].replace(',', '.'));
    let expectedPercent: number | null = null;

    if (metric_key.startsWith('sport_distribution:')) {
      const sport = metric_key.replace('sport_distribution:', '');
      const item = metrics.sport_distribution.find((s) => s.sport === sport);
      expectedPercent = item?.percentage ?? null;
    } else if (metric_key === 'missing_data:fatigue') {
      expectedPercent = metrics.missing_data_ratios.missing_fatigue_percentage;
    } else if (metric_key === 'schedule_alignment') {
      expectedPercent = metrics.schedule_alignment.match_percentage;
    }

    if (expectedPercent === null || Math.abs(statedPercent - expectedPercent) > 1.001) {
      return false; // Sai phần trăm
    }
  }

  // 5. Kiểm tra mức mệt trung bình (thang 1-10)
  const fatigueMatch = sanitizedText.match(/(?:^|[^\d.,])(\d+(?:[.,]\d+)?)\s*(?:\/10|mức mệt)(?!\w)/i);
  if (fatigueMatch) {
    const statedFatigue = parseFloat(fatigueMatch[1].replace(',', '.'));
    let expectedFatigue: number | null = null;

    if (metric_key.startsWith('fatigue_trends:')) {
      const sport = metric_key.replace('fatigue_trends:', '');
      const item = metrics.fatigue_trends.find((f) => f.sport === sport);
      expectedFatigue = item?.average_fatigue ?? null;
    }

    if (expectedFatigue === null || Math.abs(statedFatigue - expectedFatigue) > 0.1001) {
      return false; // Sai mức mệt trung bình
    }
  }

  return true;
}

/**
 * Kiểm tra và lọc các highlight do AI tạo:
 * 1. metric_key phải nằm trong danh sách chỉ số đã tính.
 * 2. Số liệu phải khớp chính xác với đại lượng và đơn vị (chống hoán đổi số buổi và số phút).
 * 3. Điểm nổi bật không có tham chiếu hợp lệ nào thì bị loại, trừ các chỉ số tổng hợp không cần ID.
 */
export function verifyAITrendHighlights(
  highlights: AITrendHighlight[],
  metrics: ProfileMetrics,
  allowedRecordIds: Set<string>
): { validHighlights: AITrendHighlight[]; rejectedCount: number } {
  if (!Array.isArray(highlights)) {
    return { validHighlights: [], rejectedCount: 0 };
  }

  const validKeys = getValidMetricKeys(metrics);
  const validHighlights: AITrendHighlight[] = [];
  let rejectedCount = 0;

  for (const h of highlights) {
    if (!h || typeof h.text !== 'string' || typeof h.metric_key !== 'string') {
      rejectedCount++;
      continue;
    }

    // 1. Kiểm tra metric_key
    if (!validKeys.has(h.metric_key)) {
      rejectedCount++;
      continue;
    }

    // 2. Lọc và kiểm tra references
    const validRefs: AIReferenceSourceItem[] = [];
    for (const ref of h.references || []) {
      if (ref && typeof ref.id === 'string' && allowedRecordIds.has(ref.id)) {
        validRefs.push(ref);
      }
    }

    // Các chỉ số tổng hợp không bắt buộc có ID tham chiếu
    const isAggregateMetricWithoutRequiredIds =
      h.metric_key.startsWith('missing_data:') ||
      h.metric_key === 'schedule_alignment' ||
      h.metric_key === 'goal_progress' ||
      (h.metric_key === 'total_completed_sessions' && metrics.total_completed_sessions === 0);

    if (!isAggregateMetricWithoutRequiredIds && validRefs.length === 0) {
      rejectedCount++;
      continue;
    }

    // 3. Kiểm tra tính nhất quán của số liệu và đơn vị (E6 & E7)
    const isNumbersValid = validateHighlightNumbersAndUnits(h.text, h.metric_key, metrics);
    if (!isNumbersValid) {
      rejectedCount++;
      continue;
    }

    validHighlights.push({
      ...h,
      references: validRefs,
    });
  }

  return {
    validHighlights,
    rejectedCount,
  };
}

/**
 * Sinh bản phân tích xu hướng dự phòng theo mẫu (TypeScript thuần, không dùng AI).
 */
export function generateTemplateTrendAnalysis(metrics: ProfileMetrics): AITrendOutput {
  const highlights: AITrendHighlight[] = [];
  const missingData: string[] = [];

  // 1. Highlight tổng quan buổi tập
  highlights.push({
    metric_key: 'total_completed_sessions',
    text: `Trong ${metrics.period.weeks} tuần qua (${metrics.period.from} - ${metrics.period.to}), bạn đã hoàn thành ${metrics.total_completed_sessions} buổi tập thực tế với tổng thời lượng ${metrics.total_completed_minutes} phút.`,
    references: metrics.weekly_frequency.flatMap((w) =>
      w.activity_ids.map((id) => ({ type: 'activity' as const, id }))
    ),
  });

  // 2. Highlight phân bổ môn
  if (metrics.sport_distribution.length > 0) {
    const topSport = metrics.sport_distribution[0];
    highlights.push({
      metric_key: `sport_distribution:${topSport.sport}`,
      text: `Môn tập chiếm thời lượng lớn nhất là ${topSport.label} với ${topSport.minutes} phút (${topSport.percentage}% tổng thời lượng rèn luyện).`,
      references: topSport.activity_ids.map((id) => ({ type: 'activity' as const, id })),
    });
  }

  // 3. Highlight mức mệt
  for (const f of metrics.fatigue_trends) {
    if (f.status === 'sufficient_data' && f.average_fatigue !== null) {
      highlights.push({
        metric_key: `fatigue_trends:${f.sport}`,
        text: `Môn ${f.label} có mức mệt tự khai trung bình là ${f.average_fatigue}/10 qua ${f.sessions_with_fatigue} buổi tập có ghi nhận.`,
        references: f.activity_ids.map((id) => ({ type: 'activity' as const, id })),
      });
    } else {
      missingData.push(
        `Môn ${f.label} chưa đủ số điểm dữ liệu mức mệt (hiện có ${f.sessions_with_fatigue}/${MIN_FATIGUE_DATA_POINTS} buổi ghi nhận)`
      );
    }
  }

  // 4. Highlight lịch rảnh
  if (metrics.schedule_alignment.status === 'sufficient_data') {
    highlights.push({
      metric_key: 'schedule_alignment',
      text: `Độ khớp lịch rảnh khai báo đạt ${metrics.schedule_alignment.match_percentage}% (${metrics.schedule_alignment.matching_sessions_count}/${metrics.schedule_alignment.total_completed_sessions} buổi hoàn thành vào khung giờ thuận tiện).`,
      references: metrics.schedule_alignment.activity_ids.map((id) => ({ type: 'activity' as const, id })),
    });
  } else if (metrics.schedule_alignment.reason) {
    missingData.push(metrics.schedule_alignment.reason);
  }

  // 5. Highlight tiến độ mục tiêu
  if (metrics.goal_progress.status === 'sufficient_data') {
    highlights.push({
      metric_key: 'goal_progress',
      text: `Bạn có ${metrics.goal_progress.session_results_count} buổi tập hoàn thành đối chiếu với ${metrics.goal_progress.active_goals_count} mục tiêu đang theo dõi.`,
      references: metrics.goal_progress.session_result_ids.map((id) => ({ type: 'activity' as const, id })),
    });
  } else if (metrics.goal_progress.reason) {
    missingData.push(metrics.goal_progress.reason);
  }

  // 6. Tuần không có bản ghi
  if (metrics.missing_data_ratios.unrecorded_weeks_count > 0) {
    missingData.push(
      `Có ${metrics.missing_data_ratios.unrecorded_weeks_count} tuần không có bản ghi hoạt động nào`
    );
  }

  if (metrics.missing_data_ratios.missing_weight_in_period) {
    missingData.push(`Chưa có bản ghi cân nặng nào trong chu kỳ ${metrics.period.weeks} tuần`);
  }

  return {
    highlights,
    missing_data: missingData,
    period: metrics.period,
  };
}
