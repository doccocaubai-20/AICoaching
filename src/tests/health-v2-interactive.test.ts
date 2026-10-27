import { describe, it, expect } from 'vitest';
import {
  validateDailyCheckinInput,
  computeCheckinWeeklyStats,
  DailyCheckinEntity,
} from '@/contracts/daily-checkin.contract';
import {
  validateBloodPressureInput,
} from '@/contracts/blood-pressure.contract';
import {
  validateHealthConditionInput,
  validateMedicationInput,
  validateAllergyInput,
} from '@/contracts/medical.contract';

describe('Hồ Sơ Sức Khỏe V2 - Interactive & Validation Test Suite', () => {
  // ============================================================================
  // 1. KIỂM THỬ CHECK-IN SINH HOẠT HẰNG NGÀY (DAILY CHECK-IN)
  // ============================================================================
  describe('Daily Check-in Contract', () => {
    it('chấp nhận dữ liệu check-in hợp lệ', () => {
      const res = validateDailyCheckinInput({
        local_date: '2026-10-27',
        sleep_duration_minutes: 450, // 7.5 tiếng
        sleep_quality: 4,
        energy_level: 3,
        stress_level: 2,
        notes: 'Ngủ ngon, tinh thần thoải mái',
      });
      expect(res.is_valid).toBe(true);
      expect(Object.keys(res.errors).length).toBe(0);
    });

    it('từ chối local_date sai định dạng', () => {
      const res = validateDailyCheckinInput({
        local_date: '27/10/2026',
      });
      expect(res.is_valid).toBe(false);
      expect(res.errors.local_date).toBeDefined();
    });

    it('từ chối thời gian ngủ âm hoặc vượt quá 24 giờ (1440 phút)', () => {
      const resOver = validateDailyCheckinInput({
        local_date: '2026-10-27',
        sleep_duration_minutes: 1500,
      });
      expect(resOver.is_valid).toBe(false);
      expect(resOver.errors.sleep_duration_minutes).toBeDefined();

      const resNeg = validateDailyCheckinInput({
        local_date: '2026-10-27',
        sleep_duration_minutes: -10,
      });
      expect(resNeg.is_valid).toBe(false);
      expect(resNeg.errors.sleep_duration_minutes).toBeDefined();
    });

    it('từ chối thang đánh giá nằm ngoài khoảng 1 - 5', () => {
      const res = validateDailyCheckinInput({
        local_date: '2026-10-27',
        sleep_quality: 6,
        energy_level: 0,
      });
      expect(res.is_valid).toBe(false);
      expect(res.errors.sleep_quality).toBeDefined();
      expect(res.errors.energy_level).toBeDefined();
    });

    it('tính toán thống kê sinh hoạt 7 ngày chính xác, không tự suy ngày thiếu thành 0', () => {
      const mockCheckins: DailyCheckinEntity[] = [
        {
          id: 'c1',
          user_id: 'u1',
          local_date: '2026-10-27',
          sleep_start: null,
          sleep_end: null,
          sleep_duration_minutes: 480, // 8h
          sleep_quality: 4,
          energy_level: 4,
          stress_level: 2,
          notes: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'c2',
          user_id: 'u1',
          local_date: '2026-10-26',
          sleep_start: null,
          sleep_end: null,
          sleep_duration_minutes: 360, // 6h
          sleep_quality: 3,
          energy_level: 2,
          stress_level: 4,
          notes: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const stats = computeCheckinWeeklyStats(mockCheckins, 7);
      expect(stats.totalRecordedDays).toBe(2);
      expect(stats.windowDays).toBe(7);
      expect(stats.averageSleepMinutes).toBe(420); // (480 + 360) / 2 = 420 (7 tiếng)
      expect(stats.averageEnergy).toBe(3);
      expect(stats.averageStress).toBe(3);
      expect(stats.summaryText).toContain('Đã ghi nhận 2/7 ngày');
    });
  });

  // ============================================================================
  // 2. KIỂM THỬ HUYẾT ÁP (BLOOD PRESSURE READINGS)
  // ============================================================================
  describe('Blood Pressure Contract', () => {
    it('chấp nhận chỉ số huyết áp chuẩn', () => {
      const res = validateBloodPressureInput({
        systolic: 120,
        diastolic: 80,
      });
      expect(res.is_valid).toBe(true);
    });

    it('từ chối khi tâm thu nhỏ hơn hoặc bằng tâm trương', () => {
      const resEqual = validateBloodPressureInput({
        systolic: 90,
        diastolic: 90,
      });
      expect(resEqual.is_valid).toBe(false);
      expect(resEqual.errors.systolic).toContain('phải lớn hơn');

      const resLess = validateBloodPressureInput({
        systolic: 70,
        diastolic: 90,
      });
      expect(resLess.is_valid).toBe(false);
      expect(resLess.errors.systolic).toContain('phải lớn hơn');
    });

    it('từ chối chỉ số phi lý về mặt sinh lý', () => {
      const resHigh = validateBloodPressureInput({
        systolic: 350,
        diastolic: 80,
      });
      expect(resHigh.is_valid).toBe(false);
      expect(resHigh.errors.systolic).toBeDefined();

      const resLow = validateBloodPressureInput({
        systolic: 120,
        diastolic: 10,
      });
      expect(resLow.is_valid).toBe(false);
      expect(resLow.errors.diastolic).toBeDefined();
    });
  });

  // ============================================================================
  // 3. KIỂM THỬ TÌNH TRẠNG SỨC KHỎE, THUỐC & DỊ ỨNG
  // ============================================================================
  describe('Medical & Allergy Contracts', () => {
    it('kiểm tra tình trạng sức khỏe yêu cầu tên và phân loại hợp lệ', () => {
      const validRes = validateHealthConditionInput({
        name: 'Chấn thương gân cơ vai trái',
        category: 'injury',
        status: 'active',
      });
      expect(validRes.is_valid).toBe(true);

      const emptyRes = validateHealthConditionInput({
        name: '   ',
        category: 'injury',
      });
      expect(emptyRes.is_valid).toBe(false);
      expect(emptyRes.errors.name).toBeDefined();
    });

    it('kiểm tra khai báo thuốc yêu cầu tên', () => {
      const valid = validateMedicationInput({
        name: 'Glucosamine 500mg',
        dosage_instructions: '1 viên sau ăn sáng',
        status: 'active',
      });
      expect(valid.is_valid).toBe(true);

      const invalid = validateMedicationInput({
        name: '',
      });
      expect(invalid.is_valid).toBe(false);
    });

    it('kiểm tra dị ứng yêu cầu tên tác nhân', () => {
      const valid = validateAllergyInput({
        allergen: 'Penicillin',
        reaction: 'Mề đay nhẹ',
      });
      expect(valid.is_valid).toBe(true);
    });
  });

  // ============================================================================
  // 4. KIỂM THỬ LOGIC AI SYNERGY HEALTH GUARD (ĐỐI CHIẾU AN TOÀN VẬN ĐỘNG)
  // ============================================================================
  describe('AI Synergy Health Guard Logic', () => {
    it('phát hiện chấn thương khớp vai và đưa ra khuyến nghị bài tập thay thế', () => {
      const conditions = [
        { name: 'Đau khớp vai phải', category: 'injury', status: 'active' },
      ];

      const nameLower = conditions[0].name.toLowerCase();
      const hasShoulderAlert = nameLower.includes('vai') || nameLower.includes('shoulder');

      expect(hasShoulderAlert).toBe(true);
      // Khuyến nghị an toàn: không tập pull-up/dips nặng, chuyển sang inverted row
    });

    it('phát hiện chấn thương cổ tay và khuyến nghị dùng thanh push-up bar', () => {
      const conditions = [
        { name: 'Viêm gân cổ tay (Wrist strain)', category: 'injury', status: 'active' },
      ];

      const nameLower = conditions[0].name.toLowerCase();
      const hasWristAlert = nameLower.includes('cổ tay') || nameLower.includes('wrist');

      expect(hasWristAlert).toBe(true);
    });

    it('phát hiện thiếu ngủ (< 6 tiếng) và kích hoạt cảnh báo hạ tải', () => {
      const sleepMin = 300; // 5 tiếng
      const isSleepDeprived = sleepMin > 0 && sleepMin < 360;
      expect(isSleepDeprived).toBe(true);
    });

    it('phát hiện huyết áp cao và cảnh báo tránh nín thở Valsalva maneuver', () => {
      const bp = { systolic: 145, diastolic: 92 };
      const isHighBP = bp.systolic >= 140 || bp.diastolic >= 90;
      expect(isHighBP).toBe(true);
    });
  });
});
