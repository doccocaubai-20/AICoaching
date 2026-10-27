import { describe, it, expect } from 'vitest';
import {
  validateProfileInput,
  validateGoalInput,
  validateObservationInput,
  validateActivityInput,
} from '@/contracts';

describe('Contracts Validation Suite', () => {
  describe('Profile Contract', () => {
    it('chấp nhận hồ sơ hợp lệ với cấp độ beginner', () => {
      const result = validateProfileInput({
        display_name: 'Nguyễn Văn A',
        experience_level: 'beginner',
      });
      expect(result.is_valid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it('từ chối hồ sơ khi để trống tên hiển thị', () => {
      const result = validateProfileInput({
        display_name: '   ',
        experience_level: 'intermediate',
      });
      expect(result.is_valid).toBe(false);
      expect(result.errors.display_name).toBeDefined();
    });

    it('từ chối cấp độ kinh nghiệm không hợp lệ', () => {
      const result = validateProfileInput({
        display_name: 'Trần B',
        experience_level: 'expert_not_allowed' as unknown as import('@/contracts').ExperienceLevel,
      });
      expect(result.is_valid).toBe(false);
      expect(result.errors.experience_level).toBeDefined();
    });
  });

  describe('Goal Contract', () => {
    it('chấp nhận mục tiêu có nội dung và loại hợp lệ', () => {
      const result = validateGoalInput({
        content: 'Hít xà đơn 5 lần',
        goal_type: 'skill',
      });
      expect(result.is_valid).toBe(true);
    });

    it('từ chối ngày kết thúc sớm hơn ngày bắt đầu', () => {
      const result = validateGoalInput({
        content: 'Chạy 5km',
        goal_type: 'endurance',
        start_date: '2026-11-10',
        end_date: '2026-11-01',
      });
      expect(result.is_valid).toBe(false);
      expect(result.errors.end_date).toBeDefined();
    });

    it('từ chối khi thiếu nội dung mục tiêu', () => {
      const result = validateGoalInput({
        content: '',
        goal_type: 'habit',
      });
      expect(result.is_valid).toBe(false);
      expect(result.errors.content).toBeDefined();
    });
  });

  describe('Observation Contract (Chỉ số tự khai)', () => {
    it('chấp nhận chỉ số cân nặng hợp lệ', () => {
      const result = validateObservationInput({
        metric_type: 'weight',
        metric_value: 68.5,
        metric_unit: 'kg',
      });
      expect(result.is_valid).toBe(true);
    });

    it('từ chối giá trị âm hoặc bằng 0', () => {
      const result = validateObservationInput({
        metric_type: 'weight',
        metric_value: -5,
        metric_unit: 'kg',
      });
      expect(result.is_valid).toBe(false);
      expect(result.errors.metric_value).toBeDefined();
    });
  });

  describe('Activity Contract (Nhật ký hoạt động)', () => {
    it('chấp nhận hoạt động hợp lệ với các môn MVP', () => {
      const validActivities = ['calisthenics', 'running', 'badminton', 'walking', 'other'] as const;
      for (const act of validActivities) {
        const result = validateActivityInput({
          activity_type: act,
          start_at: new Date().toISOString(),
          duration_minutes: 30,
          fatigue_level: 6,
        });
        expect(result.is_valid).toBe(true);
      }
    });

    it('từ chối mức mệt mỏi ngoài thang điểm 1-10', () => {
      const resultLow = validateActivityInput({
        activity_type: 'running',
        start_at: new Date().toISOString(),
        duration_minutes: 20,
        fatigue_level: 0,
      });
      expect(resultLow.is_valid).toBe(false);

      const resultHigh = validateActivityInput({
        activity_type: 'running',
        start_at: new Date().toISOString(),
        duration_minutes: 20,
        fatigue_level: 11,
      });
      expect(resultHigh.is_valid).toBe(false);
    });

    it('từ chối thời lượng quá 1440 phút', () => {
      const result = validateActivityInput({
        activity_type: 'walking',
        start_at: new Date().toISOString(),
        duration_minutes: 1441,
      });
      expect(result.is_valid).toBe(false);
      expect(result.errors.duration_minutes).toBeDefined();
    });

    it('từ chối thời lượng phút âm hoặc bằng 0', () => {
      const result = validateActivityInput({
        activity_type: 'badminton',
        start_at: new Date().toISOString(),
        duration_minutes: 0,
      });
      expect(result.is_valid).toBe(false);
      expect(result.errors.duration_minutes).toBeDefined();
    });
  });
});
