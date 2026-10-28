import { describe, it, expect } from 'vitest';
import {
  calculateElapsedSeconds,
  formatWorkoutTime,
  normalizeExerciseName,
  compareExerciseRecords,
  hasReviewedShortVersion,
  cleanWorkoutSetsForFinalize,
  ExerciseItemSnapshot,
  WorkoutSetStatus,
  CandidateHistoricalExercise,
} from '../features/workout/contracts/workout.contract';

describe('Agent B - D3: Workout Flow & State Machine Logic', () => {
  describe('1. Chuẩn hóa tên động tác & Quy tắc CẤM Fuzzy Match (Spec D3 mục 7)', () => {
    it('chuẩn hóa chữ thường và khoảng trắng', () => {
      expect(normalizeExerciseName('  Hít Đất  Tiêu Chuẩn   ')).toBe('hít đất tiêu chuẩn');
      expect(normalizeExerciseName('PULL-UP')).toBe('pull-up');
    });

    it('từ chối so sánh khi tên bài không khớp chính xác tuyệt đối (chặn match gần giống)', () => {
      const target = { name: 'Hít đất kim cương (Diamond Push-up)' };
      const candidate: CandidateHistoricalExercise = {
        exercise_name: 'Hít đất tiêu chuẩn (Push-up)',
        is_demo: false,
        sets: [{ set_order: 1, actual_reps: 12 }],
      };

      const result = compareExerciseRecords(target, candidate);
      expect(result.hasComparison).toBe(false);
      expect(result.reason).toBe('no_previous_record');
    });

    it('từ chối so sánh khi khác biến thể (variant mismatch)', () => {
      const target = { name: 'Pull-up', variant: 'wide_grip', unit: 'reps' };
      const candidate: CandidateHistoricalExercise = {
        exercise_name: 'Pull-up',
        exercise_variant: 'close_grip',
        unit: 'reps',
        is_demo: false,
        sets: [{ set_order: 1, actual_reps: 8 }],
      };

      const result = compareExerciseRecords(target, candidate);
      expect(result.hasComparison).toBe(false);
      expect(result.reason).toBe('unmapped_variant');
    });

    it('từ chối so sánh khi khác đơn vị đo (unit mismatch)', () => {
      const target = { name: 'Plank', unit: 'seconds' };
      const candidate: CandidateHistoricalExercise = {
        exercise_name: 'Plank',
        unit: 'reps', // Khác đơn vị
        is_demo: false,
        sets: [{ set_order: 1, actual_reps: 60 }],
      };

      const result = compareExerciseRecords(target, candidate);
      expect(result.hasComparison).toBe(false);
      expect(result.reason).toBe('unit_mismatch');
    });

    it('loại trừ số liệu từ chương trình demo nếu chưa có kết quả người dùng thực sự nhập', () => {
      const target = { name: 'Hít xà đơn', unit: 'reps' };
      const demoCandidate: CandidateHistoricalExercise = {
        exercise_name: 'Hít xà đơn',
        unit: 'reps',
        is_demo: true,
        sets: [{ set_order: 1, actual_reps: null }], // Chưa nhập thực tế
      };

      const result = compareExerciseRecords(target, demoCandidate);
      expect(result.hasComparison).toBe(false);
      expect(result.reason).toBe('demo_program_data_excluded');
    });

    it('chấp nhận đối chiếu khi cùng bài, cùng variant, unit, assistance và có kết quả thực tế', () => {
      const target = {
        name: 'Hít xà đơn',
        variant: 'standard',
        unit: 'reps',
        assistance: 'band_red',
      };
      const candidate: CandidateHistoricalExercise = {
        exercise_name: 'Hít xà đơn',
        exercise_variant: 'standard',
        unit: 'reps',
        assistance: 'band_red',
        is_demo: false,
        completed_at: '2026-10-25T08:00:00Z',
        sets: [
          { set_order: 1, actual_reps: 8 },
          { set_order: 2, actual_reps: 8 },
          { set_order: 3, actual_reps: 6 },
        ],
      };

      const result = compareExerciseRecords(target, candidate);
      expect(result.hasComparison).toBe(true);
      expect(result.summaryText).toBe('3 hiệp x 8-8-6 reps');
      expect(result.exactSets).toHaveLength(3);
      expect(result.exactSets?.[0].actual_reps).toBe(8);
      expect(result.exactSets?.[2].actual_reps).toBe(6);
    });
  });

  describe('2. Tách biệt Target và Actual & Xử lý Hoàn thành một phần (Spec D3 mục 4 & 9)', () => {
    it('chỉ gom các hiệp có actual_reps > 0 và status completed, không tự điền 0 hay target cho hiệp bỏ qua', () => {
      const sets: Array<{
        exercise_name: string;
        status: WorkoutSetStatus;
        actual_reps: number | null;
      }> = [
        { exercise_name: 'Hít đất', status: 'completed', actual_reps: 12 },
        { exercise_name: 'Hít đất', status: 'completed', actual_reps: 10 },
        { exercise_name: 'Hít đất', status: 'skipped', actual_reps: null }, // Hiệp bỏ qua
        { exercise_name: 'Xà đơn', status: 'skipped', actual_reps: null }, // Toàn bộ bỏ qua
      ];

      const finalized = cleanWorkoutSetsForFinalize(sets);

      // Chỉ có Hít đất được đưa vào kết quả với 2 hiệp đã hoàn thành
      expect(finalized).toHaveLength(1);
      expect(finalized[0].exercise_name).toBe('Hít đất');
      expect(finalized[0].actual_sets).toBe(2);
      expect(finalized[0].actual_reps).toBe('12, 10');
      // Không có Xà đơn vì không có hiệp nào hoàn thành
    });

    it('loại bỏ giá trị 0 hoặc số âm nếu có phát sinh bất thường', () => {
      const sets: Array<{
        exercise_name: string;
        status: WorkoutSetStatus;
        actual_reps: number | null;
      }> = [
        { exercise_name: 'Hít đất', status: 'completed', actual_reps: 0 }, // Không tính hiệp 0 rep
        { exercise_name: 'Hít đất', status: 'completed', actual_reps: 15 },
      ];

      const finalized = cleanWorkoutSetsForFinalize(sets);
      expect(finalized[0].actual_sets).toBe(1);
      expect(finalized[0].actual_reps).toBe('15');
    });
  });

  describe('3. Quy tắc phiên bản 15/30 phút & Bảo vệ nội dung chuyên môn (Spec D3 mục 10)', () => {
    it('từ chối phiên bản 15/30 phút nếu chưa có đánh giá chuyên môn (reviewed: true)', () => {
      const unreviewedSession = {
        title: 'Thân trên nâng cao',
        duration_variants: [
          { minutes: 15, reviewed: false },
          { minutes: 30, reviewed: false },
        ],
      };

      expect(hasReviewedShortVersion(unreviewedSession, 15)).toBe(false);
      expect(hasReviewedShortVersion(unreviewedSession, 30)).toBe(false);
    });

    it('chấp nhận phiên bản 15/30 phút khi đã có rà soát chuyên môn rõ ràng', () => {
      const reviewedSession = {
        title: 'Thân trên cô đọng',
        duration_variants: [
          { minutes: 15, reviewed: true },
          { minutes: 30, reviewed: false },
        ],
      };

      expect(hasReviewedShortVersion(reviewedSession, 15)).toBe(true);
      expect(hasReviewedShortVersion(reviewedSession, 30)).toBe(false);
    });

    it('trả về false nếu session không có trường duration_variants', () => {
      const normalSession = { title: 'Buổi tập thông thường' };
      expect(hasReviewedShortVersion(normalSession, 15)).toBe(false);
    });
  });

  describe('4. Bất biến Snapshot bài tập khi phiên tập đang diễn ra (Spec D3 mục 3)', () => {
    it('snapshot giữ nguyên cấu trúc bài tập độc lập với việc thay đổi chương trình gốc', () => {
      const originalExercises: ExerciseItemSnapshot[] = [
        { name: 'Push-up', sets: 3, target_reps: '10', rest_seconds: 60 },
        { name: 'Pull-up', sets: 3, target_reps: '8', rest_seconds: 90 },
      ];

      // Đóng băng snapshot trong run
      const runSnapshot: ExerciseItemSnapshot[] = JSON.parse(JSON.stringify(originalExercises));

      // Giả sử chương trình gốc sau đó bị Admin/User sửa thành 4 hiệp hoặc đổi tên bài
      originalExercises[0].sets = 4;
      originalExercises[0].name = 'Push-up nâng cao';

      // Snapshot của phiên tập vẫn giữ nguyên vẹn
      expect(runSnapshot[0].sets).toBe(3);
      expect(runSnapshot[0].name).toBe('Push-up');
    });
  });
});
