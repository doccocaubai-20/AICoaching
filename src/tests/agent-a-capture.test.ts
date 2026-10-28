import { describe, it, expect } from 'vitest';
import { parseQuickCapture } from '@/features/capture/server/capture-parser';
import { ConfirmBatchPayloadSchema } from '@/features/capture/contracts/capture.contract';
import { getLocalDateString, getPastLocalDateString } from '@/lib/date-utils';

describe('Agent A: D1 Quick Capture Parser & Contract Tests', () => {
  const timezone = 'Asia/Ho_Chi_Minh';

  it('1. Phân tích câu kết hợp "Hôm nay chạy 25 phút, tối qua ngủ 6 tiếng rưỡi"', () => {
    const input = 'Hôm nay chạy 25 phút, tối qua ngủ 6 tiếng rưỡi';
    const draft = parseQuickCapture(input, timezone);

    // Kiểm tra Activity
    expect(draft.activities.length).toBe(1);
    expect(draft.activities[0].activity_type).toBe('running');
    expect(draft.activities[0].duration_minutes).toBe(25);
    expect(draft.activities[0].start_at).toContain(getLocalDateString(new Date(), timezone));

    // Kiểm tra Check-in Giấc ngủ
    expect(draft.dailyCheckin).not.toBeNull();
    // 6.5 tiếng * 60 = 390 phút
    expect(draft.dailyCheckin?.sleep_duration_minutes).toBe(390);

    // Không có disambiguation vì không có "mệt 7"
    expect(draft.disambiguations.length).toBe(0);
    expect(draft.missingFields.length).toBe(0);
  });

  it('2. Phân tích câu có "mệt 7" -> Sinh câu hỏi Disambiguation, KHÔNG tự map hai thang', () => {
    const input = 'Sáng nay chống đẩy 30 phút, mệt 7, nặng 68kg';
    const draft = parseQuickCapture(input, timezone);

    // Kiểm tra môn tập
    expect(draft.activities.length).toBe(1);
    expect(draft.activities[0].activity_type).toBe('calisthenics');
    expect(draft.activities[0].duration_minutes).toBe(30);

    // Kiểm tra chỉ số cân nặng
    expect(draft.observations.length).toBe(1);
    expect(draft.observations[0].metric_type).toBe('weight');
    expect(draft.observations[0].metric_value).toBe(68);
    expect(draft.observations[0].metric_unit).toBe('kg');

    // Kiểm tra Disambiguation câu hỏi
    expect(draft.disambiguations.length).toBe(1);
    const q = draft.disambiguations[0];
    expect(q.id).toBe('fatigue_disambiguation');
    expect(q.rawTextSegment).toBe('mệt 7');
    expect(q.options.length).toBeGreaterThanOrEqual(2);
    // Có lựa chọn RPE buổi tập và lựa chọn cảm nhận ngày
    expect(q.options.some((o) => o.targetValue.activityFatigue === 7)).toBe(true);
    expect(q.options.some((o) => o.targetValue.checkinStressOrEnergy !== undefined)).toBe(true);
  });

  it('3. Diễn giải "hôm qua" thành ngày cụ thể theo timezone hồ sơ', () => {
    const input = 'Hôm qua tập calis 45 phút, rpe 8';
    const draft = parseQuickCapture(input, timezone);

    const yesterday = getPastLocalDateString(1, new Date(), timezone);
    expect(draft.activities.length).toBe(1);
    expect(draft.activities[0].start_at).toContain(yesterday);
    expect(draft.activities[0].activity_type).toBe('calisthenics');
    expect(draft.activities[0].duration_minutes).toBe(45);
    // Vì người dùng ghi rõ "rpe 8" nên tự gán cho buổi tập mà không mơ hồ
    expect(draft.activities[0].fatigue_level).toBe(8);
    expect(draft.disambiguations.length).toBe(0);
  });

  it('4. Nhận diện check-in hiện hữu để hiển thị xung đột và cho user chọn update/skip', () => {
    const today = getLocalDateString(new Date(), timezone);
    const existingCheckin = {
      id: 'mock-checkin-uuid-1',
      local_date: today,
      sleep_duration_minutes: 420,
      sleep_quality: 4,
      energy_level: 4,
      stress_level: 2,
      notes: 'Checkin cũ',
      updated_at: new Date().toISOString(),
    };

    const input = 'Tối qua ngủ 7 tiếng rưỡi';
    const draft = parseQuickCapture(input, timezone, existingCheckin);

    expect(draft.dailyCheckin).not.toBeNull();
    expect(draft.dailyCheckin?.existingRecord).not.toBeNull();
    expect(draft.dailyCheckin?.existingRecord?.id).toBe('mock-checkin-uuid-1');
    expect(draft.dailyCheckin?.conflictResolution).toBe('update');
  });

  it('5. Phân tích câu có nhiều chỉ số: cầu lông 1h30p, vòng eo 78cm, ngủ 8h', () => {
    const input = 'Chiều nay đánh cầu lông 1 tiếng 30 phút, vòng eo 78cm, đêm qua ngủ 8 tiếng';
    const draft = parseQuickCapture(input, timezone);

    expect(draft.activities.length).toBe(1);
    expect(draft.activities[0].activity_type).toBe('badminton');
    expect(draft.activities[0].duration_minutes).toBe(90);

    expect(draft.observations.length).toBe(1);
    expect(draft.observations[0].metric_type).toBe('waist_circumference');
    expect(draft.observations[0].metric_value).toBe(78);
    expect(draft.observations[0].metric_unit).toBe('cm');

    expect(draft.dailyCheckin).not.toBeNull();
    expect(draft.dailyCheckin?.sleep_duration_minutes).toBe(480);
  });

  it('6. Báo missing field khi nhắc đến môn tập nhưng thiếu thời lượng', () => {
    const input = 'Sáng nay có đi chạy bộ';
    const draft = parseQuickCapture(input, timezone);

    expect(draft.activities.length).toBe(0);
    expect(draft.missingFields.length).toBeGreaterThanOrEqual(1);
    expect(draft.missingFields.some((f) => f.target === 'activity.duration_minutes')).toBe(true);
  });

  it('7. Validate Batch Confirm Payload: Chặn thời lượng <= 0 hoặc số đo âm', () => {
    const invalidPayload = {
      idempotencyKey: 'valid-idempotency-key-12345',
      draftRevision: 1,
      rawInput: 'test',
      timezone: 'Asia/Ho_Chi_Minh',
      activities: [
        {
          activity_type: 'running' as const,
          duration_minutes: -10, // Lỗi: âm
          start_at: new Date().toISOString(),
        },
      ],
      observations: [
        {
          metric_type: 'weight' as const,
          metric_value: 0, // Lỗi: 0 không dương
          metric_unit: 'kg',
          observed_at: new Date().toISOString(),
        },
      ],
    };

    const parsed = ConfirmBatchPayloadSchema.safeParse(invalidPayload);
    expect(parsed.success).toBe(false);
  });

  it('8. Validate Batch Confirm Payload: Cho phép dữ liệu hợp lệ', () => {
    const validPayload = {
      idempotencyKey: 'valid-idempotency-key-12345',
      draftRevision: 1,
      rawInput: 'Hôm nay chạy 25 phút',
      timezone: 'Asia/Ho_Chi_Minh',
      activities: [
        {
          activity_type: 'running' as const,
          duration_minutes: 25,
          start_at: new Date().toISOString(),
        },
      ],
      dailyCheckin: {
        local_date: '2026-10-28',
        sleep_duration_minutes: 390,
        action: 'create' as const,
      },
      observations: [
        {
          metric_type: 'weight' as const,
          metric_value: 68.5,
          metric_unit: 'kg',
          observed_at: new Date().toISOString(),
        },
      ],
    };

    const parsed = ConfirmBatchPayloadSchema.safeParse(validPayload);
    expect(parsed.success).toBe(true);
  });

  it('9. Không lấy nhầm thời lượng giấc ngủ gán cho môn tập khi môn tập chỉ ghi hiệp/cái', () => {
    const input = 'Hôm nay tôi ở nhà tập chống đẩy 2 hiệp mỗi hiệp 20 cái, tối qua ngủ 8 tiếng rưỡi, 2 giờ đêm mới ngủ, sáng dậy vẫn thiếu ngủ';
    const draft = parseQuickCapture(input, timezone);

    // Giấc ngủ được nhận diện đúng 8.5 giờ (510 phút)
    expect(draft.dailyCheckin).not.toBeNull();
    expect(draft.dailyCheckin?.sleep_duration_minutes).toBe(510);

    // Môn tập không bị gán nhầm 510 phút của giấc ngủ!
    expect(draft.activities.length).toBe(0);
    expect(draft.missingFields.some((f) => f.target === 'activity.duration_minutes')).toBe(true);
  });

  it('10. Phân tích đa hoạt động (Multi-activity) kèm viết tắt: "Hnay t chạy cầu lông 1 tiếng 15, nhảy dây 20 phút, đi bộ 2 tiếng, ngủ 2 tiếng rưỡi"', () => {
    const input = 'Hnay t chạy cầu lông 1 tiếng 15, nhảy dây 20 phút, đi bộ 2 tiếng, ngủ 2 tiếng rưỡi';
    const draft = parseQuickCapture(input, timezone);

    // Có 3 môn tập được bóc tách riêng biệt
    expect(draft.activities.length).toBe(3);

    // Môn 1: Cầu lông 1h15p = 75 phút (không bị nhận nhầm thành chạy)
    const badminton = draft.activities.find((a) => a.activity_type === 'badminton');
    expect(badminton).toBeDefined();
    expect(badminton?.duration_minutes).toBe(75);

    // Môn 2: Nhảy dây 20 phút
    const jumpRope = draft.activities.find((a) => a.activity_type === 'other');
    expect(jumpRope).toBeDefined();
    expect(jumpRope?.duration_minutes).toBe(20);

    // Môn 3: Đi bộ 2 tiếng = 120 phút
    const walking = draft.activities.find((a) => a.activity_type === 'walking');
    expect(walking).toBeDefined();
    expect(walking?.duration_minutes).toBe(120);

    // Giấc ngủ: 2 tiếng rưỡi = 150 phút (2.5h)
    expect(draft.dailyCheckin).not.toBeNull();
    expect(draft.dailyCheckin?.sleep_duration_minutes).toBe(150);
  });
});
