import {
  getLocalDateString,
  getPastLocalDateString,
  getLocalDateStartInstant,
  DEFAULT_APP_TIMEZONE,
} from '@/lib/date-utils';
import {
  CaptureDraft,
  DraftActivityItem,
  DraftDailyCheckinItem,
  DraftObservationItem,
  DisambiguationQuestion,
} from '../contracts/capture.contract';

/**
 * Trích xuất thời lượng (phút) từ cụm từ
 * Ví dụ: '25 phút', '1 tiếng rưỡi', '1h30p', '1.5 tiếng', '45p'
 */
function extractDurationMinutes(text: string): number | null {
  // 1 tiếng rưỡi / 2 tiếng rưỡi
  const halfHourMatch = /(\d+)\s*(tiếng|giờ)\s*rưỡi/i.exec(text);
  if (halfHourMatch) {
    const hours = parseInt(halfHourMatch[1], 10);
    return hours * 60 + 30;
  }

  // 1 tiếng 30 phút / 1h30
  const hoursMinutesMatch = /(\d+)\s*(?:tiếng|giờ|h)\s*(\d+)\s*(?:phút|p|m)?/i.exec(text);
  if (hoursMinutesMatch) {
    const hours = parseInt(hoursMinutesMatch[1], 10);
    const minutes = parseInt(hoursMinutesMatch[2], 10);
    return hours * 60 + minutes;
  }

  // 1.5 tiếng / 1.5 giờ / 1.5h
  const floatHoursMatch = /(\d+(?:[.,]\d+)?)\s*(?:tiếng|giờ|h)\b/i.exec(text);
  if (floatHoursMatch) {
    const hours = parseFloat(floatHoursMatch[1].replace(',', '.'));
    return Math.round(hours * 60);
  }

  // 25 phút / 25p / 25 min
  const minutesMatch = /(\d+)\s*(?:phút|p|min)\b/i.exec(text);
  if (minutesMatch) {
    return parseInt(minutesMatch[1], 10);
  }

  return null;
}

/**
 * Trích xuất thời lượng giấc ngủ
 * Ví dụ: 'ngủ 6 tiếng rưỡi', 'ngủ 7 tiếng', 'ngủ 6.5h', 'ngủ 8h'
 */
function extractSleepDuration(text: string): number | null {
  const sleepIndex = text.toLowerCase().indexOf('ngủ');
  if (sleepIndex !== -1) {
    const afterSleep = text.slice(sleepIndex + 3);
    const duration = extractDurationMinutes(afterSleep);
    if (duration !== null) return duration;
  }

  // Cụm độc lập nếu có từ ngủ ở gần
  if (/ngủ/i.test(text)) {
    return extractDurationMinutes(text);
  }

  return null;
}

/**
 * Trích xuất cân nặng (kg)
 * Ví dụ: 'nặng 68kg', 'cân nặng 70.5 kg', '68.5 kg'
 */
function extractWeight(text: string): number | null {
  const weightMatch = /(?:nặng|cân\s*nặng|cân)?\s*(\d+(?:[.,]\d+)?)\s*kg\b/i.exec(text);
  if (weightMatch) {
    const val = parseFloat(weightMatch[1].replace(',', '.'));
    if (val >= 20 && val <= 300) {
      return val;
    }
  }
  return null;
}

/**
 * Trích xuất vòng eo (cm)
 */
function extractWaist(text: string): number | null {
  const waistMatch = /(?:vòng\s*eo|eo)\s*(\d+(?:[.,]\d+)?)\s*cm\b/i.exec(text);
  if (waistMatch) {
    const val = parseFloat(waistMatch[1].replace(',', '.'));
    if (val >= 40 && val <= 200) {
      return val;
    }
  }
  return null;
}

/**
 * Phân tích câu tự nhiên tiếng Việt thành CaptureDraft có cấu trúc
 */
export function parseQuickCapture(
  rawInput: string,
  timezone: string = DEFAULT_APP_TIMEZONE,
  existingCheckinForDate: any = null
): CaptureDraft {
  const normalized = rawInput.trim();
  const lower = normalized.toLowerCase();

  // 1. Phân giải ngày
  const todayDateStr = getLocalDateString(new Date(), timezone);
  const yesterdayDateStr = getPastLocalDateString(1, new Date(), timezone);

  // Xác định ngày cho Activity
  let activityDateStr = todayDateStr;
  if (/hôm qua|hôm trc|hôm trước|ngày hôm qua/i.test(lower)) {
    activityDateStr = yesterdayDateStr;
  }

  // Xác định ngày cho Check-in
  // Ghi nhận ngủ "tối qua" thì check-in thuộc ngày hôm nay (buổi sáng thức dậy) hoặc hôm qua
  let checkinDateStr = todayDateStr;
  if (/hôm qua|tối qua|đêm qua/i.test(lower)) {
    // Nếu nói riêng tối qua ngủ, theo thói quen checkin thường là ngày hôm nay đánh giá giấc ngủ đêm qua,
    // nhưng nếu có từ "hôm qua ngủ" thì có thể là check-in ngày hôm qua
    checkinDateStr = todayDateStr;
  }

  const activities: DraftActivityItem[] = [];
  let dailyCheckin: DraftDailyCheckinItem | null = null;
  const observations: DraftObservationItem[] = [];
  const disambiguations: DisambiguationQuestion[] = [];
  const missingFields: Array<{ target: string; message: string }> = [];

  // 2. Phát hiện hoạt động (Activity)
  let detectedSport: 'running' | 'calisthenics' | 'badminton' | 'walking' | 'other' | null = null;
  if (/chạy\s*bộ|chạy|chay\s*bo|jogging|run/i.test(lower)) {
    detectedSport = 'running';
  } else if (/calisthenics|calis|chống\s*đẩy|hít\s*xà|hít\s*đất|pull\s*up|push\s*up|dips|tập\s*xà|tập\s*gym/i.test(lower)) {
    detectedSport = 'calisthenics';
  } else if (/cầu\s*lông|badminton/i.test(lower)) {
    detectedSport = 'badminton';
  } else if (/đi\s*bộ|walking/i.test(lower)) {
    detectedSport = 'walking';
  } else if (/đạp\s*xe|bơi|bơi\s*lội|yoga/i.test(lower)) {
    detectedSport = 'other';
  }

  // Tìm thời lượng hoạt động
  let activityDuration = extractDurationMinutes(rawInput);

  // Nếu có cả giấc ngủ và hoạt động thì phân tách cụm từ
  const hasSleepMention = /ngủ|giấc\s*ngủ/i.test(lower);
  if (detectedSport && hasSleepMention) {
    // Tách vế câu qua dấu phẩy hoặc liên từ "và", "còn", "tối qua"
    const parts = rawInput.split(/[,;]|(?:\bvà\b)|(?:\btối qua\b)|(?:\bđêm qua\b)/i);
    for (const part of parts) {
      if (
        /chạy|calis|xà|đất|lông|đi bộ|tập/i.test(part) &&
        !/ngủ/i.test(part)
      ) {
        const dur = extractDurationMinutes(part);
        if (dur) activityDuration = dur;
      }
    }
  }

  // 3. Phát hiện giấc ngủ
  const sleepMinutes = extractSleepDuration(rawInput);
  if (hasSleepMention || sleepMinutes !== null) {
    dailyCheckin = {
      local_date: checkinDateStr,
      sleep_duration_minutes: sleepMinutes ?? undefined,
      notes: hasSleepMention ? 'Ghi nhận nhanh qua câu tự nhiên' : undefined,
      conflictResolution: existingCheckinForDate ? 'update' : 'create',
      existingRecord: existingCheckinForDate
        ? {
            id: existingCheckinForDate.id,
            local_date: existingCheckinForDate.local_date,
            sleep_duration_minutes: existingCheckinForDate.sleep_duration_minutes,
            sleep_quality: existingCheckinForDate.sleep_quality,
            energy_level: existingCheckinForDate.energy_level,
            stress_level: existingCheckinForDate.stress_level,
            notes: existingCheckinForDate.notes,
            updated_at: existingCheckinForDate.updated_at,
          }
        : null,
    };

    if (sleepMinutes === null) {
      missingFields.push({
        target: 'daily_checkin.sleep_duration_minutes',
        message: 'Bạn có nhắc đến giấc ngủ nhưng chưa rõ số tiếng ngủ cụ thể.',
      });
    }
  }

  // 4. Phát hiện RPE / Mệt mỏi / Căng thẳng (Disambiguation)
  // Ví dụ: "mệt 7", "mệt mức 7", "rpe 8", "đuối 6"
  const fatigueMatch = /(?:mệt|đuối|rpe)\s*(?:mức\s*)?(\d+)(?:\s*\/\s*10)?\b/i.exec(lower);
  let resolvedActivityFatigue: number | undefined;

  if (fatigueMatch) {
    const rawVal = parseInt(fatigueMatch[1], 10);
    const rawText = fatigueMatch[0];

    if (/rpe\s*\d+/i.test(rawText)) {
      // Nếu nói rõ RPE thì gắn cho buổi tập
      if (rawVal >= 1 && rawVal <= 10) {
        resolvedActivityFatigue = rawVal;
      }
    } else {
      // "mệt 7" -> Tạo DisambiguationQuestion, KHÔNG tự ý map 2 thang
      disambiguations.push({
        id: 'fatigue_disambiguation',
        rawTextSegment: rawText,
        question: `Bạn đã nhập "${rawText}". Bạn muốn ghi nhận mức này cho buổi tập hay cảm nhận trong ngày?`,
        fieldTarget: detectedSport && dailyCheckin ? 'both' : detectedSport ? 'activity_fatigue' : 'checkin_fatigue',
        options: [
          {
            id: 'option_activity_rpe',
            label: `Mức gắng sức buổi tập (RPE: ${rawVal}/10)`,
            description: 'Ghi nhận độ mệt và cường độ của buổi tập luyện',
            targetValue: {
              activityFatigue: Math.min(Math.max(rawVal, 1), 10),
            },
          },
          {
            id: 'option_checkin_stress',
            label: `Mức căng thẳng / mệt mỏi trong ngày (1-5)`,
            description: 'Ghi nhận vào đánh giá sinh hoạt hằng ngày',
            targetValue: {
              checkinStressOrEnergy: {
                // Chỉ gợi ý nếu user chọn, thang 1-5
                stress: Math.min(Math.max(Math.round(rawVal / 2), 1), 5),
              },
            },
          },
        ],
      });
    }
  }

  // 5. Thêm Activity nếu phát hiện môn tập
  if (detectedSport) {
    if (activityDuration && activityDuration > 0) {
      activities.push({
        tempId: `act_${Date.now()}`,
        activity_type: detectedSport,
        duration_minutes: activityDuration,
        fatigue_level: resolvedActivityFatigue,
        start_at: `${activityDateStr}T08:00:00.000Z`,
        notes: `Ghi nhanh: "${normalized}"`,
      });
    } else {
      missingFields.push({
        target: 'activity.duration_minutes',
        message: `Bạn đã tập ${detectedSport} nhưng chưa ghi thời lượng (phút/giờ).`,
      });
    }
  }

  // 6. Phát hiện Cân nặng & Vòng eo (Observations)
  const weight = extractWeight(rawInput);
  if (weight !== null) {
    observations.push({
      tempId: `obs_weight_${Date.now()}`,
      metric_type: 'weight',
      metric_value: weight,
      metric_unit: 'kg',
      observed_at: `${activityDateStr}T07:00:00.000Z`,
      notes: `Ghi nhanh: ${normalized}`,
    });
  }

  const waist = extractWaist(rawInput);
  if (waist !== null) {
    observations.push({
      tempId: `obs_waist_${Date.now()}`,
      metric_type: 'waist_circumference',
      metric_value: waist,
      metric_unit: 'cm',
      observed_at: `${activityDateStr}T07:00:00.000Z`,
      notes: `Ghi nhanh: ${normalized}`,
    });
  }

  return {
    draftId: `draft_${Date.now()}`,
    revision: 1,
    rawInput: normalized,
    timezone,
    createdAt: new Date().toISOString(),
    activities,
    dailyCheckin,
    observations,
    disambiguations,
    missingFields,
    aiAssisted: false,
  };
}
