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
 * Chuẩn hóa viết tắt và tiếng lóng tiếng Việt
 */
function normalizeVietnameseInput(text: string): string {
  return text
    .replace(/(?:^|(?<=[\s,;.!]))(?:hnay|h\.nay)(?=[\s,;.!]|$)/gi, 'hôm nay')
    .replace(/(?:^|(?<=[\s,;.!]))(?:hqua|h\.qua|hôm wa)(?=[\s,;.!]|$)/gi, 'hôm qua')
    .replace(/(?:^|(?<=[\s,;.!]))(?:tối wa|đêm wa)(?=[\s,;.!]|$)/gi, 'tối qua')
    .replace(/(?:^|(?<=[\s,;.!]))t(?=[\s,;.!]|$)/gi, 'tôi')
    .replace(/\b(?:tui|mk|mềnh)\b/gi, 'tôi')
    .replace(/\b(?:k|ko|khg|hem)\b/gi, 'không')
    .replace(/\b(?:đc|dc)\b/gi, 'được');
}

interface DetectedSportItem {
  sport: 'running' | 'calisthenics' | 'badminton' | 'walking' | 'other';
  duration: number | null;
  customName?: string;
  rawClause: string;
}

/**
 * Phân tích câu tự nhiên tiếng Việt thành CaptureDraft có cấu trúc
 */
export function parseQuickCapture(
  rawInput: string,
  timezone: string = DEFAULT_APP_TIMEZONE,
  existingCheckinForDate: any = null
): CaptureDraft {
  const normalized = normalizeVietnameseInput(rawInput.trim());
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
  let checkinDateStr = todayDateStr;
  if (/hôm qua|tối qua|đêm qua/i.test(lower)) {
    checkinDateStr = todayDateStr;
  }

  const activities: DraftActivityItem[] = [];
  let dailyCheckin: DraftDailyCheckinItem | null = null;
  const observations: DraftObservationItem[] = [];
  const disambiguations: DisambiguationQuestion[] = [];
  const missingFields: Array<{ target: string; message: string }> = [];

  // 2. Tách các phân đoạn (clauses) để phát hiện đa hoạt động (Multi-activity)
  const clauses = normalized
    .split(/[,;\n]|(?:\bvà\b)|(?:\brồi\b)|(?:\bsau đó\b)|(?:\bcòn\b)|(?:\btiếp theo\b)/i)
    .map((c) => c.trim())
    .filter(Boolean);

  const detectedSports: DetectedSportItem[] = [];

  for (const clause of clauses) {
    const cLower = clause.toLowerCase();
    // Bỏ qua nếu đây là phân đoạn nói riêng về giấc ngủ
    if (/^\s*(?:tối qua|đêm qua|hôm qua)?\s*ngủ\b/i.test(cLower) || (/ngủ/i.test(cLower) && !/chạy|calis|xà|đất|lông|đi bộ|tập|nhảy dây|bơi|đạp/i.test(cLower))) {
      continue;
    }

    let sport: 'running' | 'calisthenics' | 'badminton' | 'walking' | 'other' | null = null;
    let customName: string | undefined;

    // Ưu tiên cầu lông trước chạy (tránh "chạy cầu lông" bị tính là chạy bộ)
    if (/cầu\s*lông|badminton/i.test(cLower)) {
      sport = 'badminton';
    } else if (/calisthenics|calis|chống\s*đẩy|hít\s*xà|hít\s*đất|pull\s*up|push\s*up|dips|tập\s*xà|tập\s*gym|gập\s*bụng|plank/i.test(cLower)) {
      sport = 'calisthenics';
    } else if (/đi\s*bộ|walking|tản\s*bộ/i.test(cLower)) {
      sport = 'walking';
    } else if (/nhảy\s*dây|jump\s*rope/i.test(cLower)) {
      sport = 'other';
      customName = 'Nhảy dây';
    } else if (/đạp\s*xe|cycling/i.test(cLower)) {
      sport = 'other';
      customName = 'Đạp xe';
    } else if (/bơi|bơi\s*lội|swimming/i.test(cLower)) {
      sport = 'other';
      customName = 'Bơi lội';
    } else if (/yoga/i.test(cLower)) {
      sport = 'other';
      customName = 'Yoga';
    } else if (/chạy\s*bộ|chạy|chay\s*bo|jogging|run/i.test(cLower)) {
      sport = 'running';
    }

    if (sport) {
      // Chỉ tìm thời lượng bên trong phân đoạn này, không quét lan sang phân đoạn khác
      const duration = extractDurationMinutes(clause);
      detectedSports.push({
        sport,
        duration,
        customName,
        rawClause: clause,
      });
    }
  }

  // Fallback nếu không tách được theo dấu phân đoạn nhưng có môn tập
  if (detectedSports.length === 0) {
    let singleSport: 'running' | 'calisthenics' | 'badminton' | 'walking' | 'other' | null = null;
    let customName: string | undefined;
    if (/cầu\s*lông|badminton/i.test(lower)) {
      singleSport = 'badminton';
    } else if (/calisthenics|calis|chống\s*đẩy|hít\s*xà|hít\s*đất|pull\s*up|push\s*up|dips|tập\s*xà|tập\s*gym/i.test(lower)) {
      singleSport = 'calisthenics';
    } else if (/đi\s*bộ|walking/i.test(lower)) {
      singleSport = 'walking';
    } else if (/nhảy\s*dây|jump\s*rope/i.test(lower)) {
      singleSport = 'other';
      customName = 'Nhảy dây';
    } else if (/đạp\s*xe|bơi|bơi\s*lội|yoga/i.test(lower)) {
      singleSport = 'other';
    } else if (/chạy\s*bộ|chạy|chay\s*bo|jogging|run/i.test(lower)) {
      singleSport = 'running';
    }

    if (singleSport) {
      // Tìm thời lượng không bao gồm giấc ngủ
      let dur: number | null = null;
      if (/ngủ|giấc\s*ngủ/i.test(lower)) {
        const nonSleepText = normalized.replace(/(?:tối qua|đêm qua|hôm qua)?\s*ngủ\s*[^,;.]+/gi, '');
        dur = extractDurationMinutes(nonSleepText);
      } else {
        dur = extractDurationMinutes(normalized);
      }
      detectedSports.push({
        sport: singleSport,
        duration: dur,
        customName,
        rawClause: normalized,
      });
    }
  }

  // 3. Phát hiện giấc ngủ
  const sleepMinutes = extractSleepDuration(normalized);
  const hasSleepMention = /ngủ|giấc\s*ngủ/i.test(lower);
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
  const fatigueMatch = /(?:mệt|đuối|rpe)\s*(?:mức\s*)?(\d+)(?:\s*\/\s*10)?\b/i.exec(lower);
  let resolvedActivityFatigue: number | undefined;

  if (fatigueMatch) {
    const rawVal = parseInt(fatigueMatch[1], 10);
    const rawText = fatigueMatch[0];

    if (/rpe\s*\d+/i.test(rawText)) {
      if (rawVal >= 1 && rawVal <= 10) {
        resolvedActivityFatigue = rawVal;
      }
    } else {
      disambiguations.push({
        id: 'fatigue_disambiguation',
        rawTextSegment: rawText,
        question: `Bạn đã nhập "${rawText}". Bạn muốn ghi nhận mức này cho buổi tập hay cảm nhận trong ngày?`,
        fieldTarget: detectedSports.length > 0 && dailyCheckin ? 'both' : detectedSports.length > 0 ? 'activity_fatigue' : 'checkin_fatigue',
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
                stress: Math.min(Math.max(Math.round(rawVal / 2), 1), 5),
              },
            },
          },
        ],
      });
    }
  }

  // 5. Thêm tất cả Activity hợp lệ đã nhận diện
  let actIndex = 0;
  for (const item of detectedSports) {
    if (item.duration && item.duration > 0) {
      activities.push({
        tempId: `act_${Date.now()}_${actIndex++}`,
        activity_type: item.sport,
        duration_minutes: item.duration,
        fatigue_level: resolvedActivityFatigue,
        start_at: `${activityDateStr}T08:00:00.000Z`,
        notes: item.customName ? `${item.customName} ("${item.rawClause}")` : `Ghi nhanh: "${item.rawClause}"`,
      });
    } else {
      missingFields.push({
        target: 'activity.duration_minutes',
        message: `Bạn đã tập ${item.sport} nhưng chưa ghi thời lượng (phút/giờ).`,
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
