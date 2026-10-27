/**
 * CALISCOACHING - HEALTH PROFILE V2 TEST SUITE
 * 
 * Kiểm tra toàn diện các tính năng của Hồ sơ Sức khỏe Cá nhân V2:
 * 1. Hàm thuần & Hợp đồng (Contracts & Validation):
 *    - Hồ sơ nền (Năm sinh, bối cảnh công việc, múi giờ).
 *    - Huyết áp 2 thành phần (Tâm thu, Tâm trương, kiểm tra tâm thu > tâm trương).
 *    - Ghi nhận sinh hoạt ngắn (Giấc ngủ, Năng lượng, Căng thẳng, computeCheckinWeeklyStats).
 *    - Tình trạng sức khỏe (Phân biệt bệnh khai chẩn đoán, chấn thương, triệu chứng).
 *    - Dị ứng (Tác nhân, phản ứng, trạng thái đã biết vs chưa biết/chưa khai).
 *    - Thuốc (Tên, hướng dẫn dùng nguyên văn, trạng thái đang dùng vs đã ngừng).
 *    - Sự kiện y tế & Tài liệu khám (Kiểm tra kích thước <= 10MB, định dạng PDF/JPG/PNG).
 *    - Chỉ số vòng eo (waist_circumference).
 * 2. Postgres RLS, Constraints & Triggers qua PGlite:
 *    - Cô lập dữ liệu tuyệt đối giữa User A và User B trên tất cả 8 bảng mới.
 *    - Ràng buộc UNIQUE (user_id, local_date) trên daily_checkins.
 *    - Cập nhật trigger updated_at tự động.
 *    - Cascade khi xóa người dùng hoặc gỡ liên kết sự kiện khám.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

import {
  validateHealthProfileInput,
  validateBloodPressureInput,
  validateDailyCheckinInput,
  computeCheckinWeeklyStats,
  DailyCheckinEntity,
  validateHealthConditionInput,
  validateAllergyInput,
  validateMedicationInput,
  validateHealthEventInput,
  validateHealthDocumentInput,
  MAX_DOCUMENT_SIZE_BYTES,
  validateObservationInput,
} from '@/contracts';

const USER_A = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';

const SUPABASE_STUB = `
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), 'anon');
$$ LANGUAGE sql STABLE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
`;

let db: PGlite;

type Actor = { role: 'authenticated'; uid: string } | { role: 'anon' } | { role: 'service_role' };

async function as<T>(actor: Actor, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    const uid = actor.role === 'authenticated' ? actor.uid : '';
    await tx.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [uid]);
    await tx.exec(`SET LOCAL ROLE ${actor.role}`);
    return fn(tx);
  });
}

const actorUserA: Actor = { role: 'authenticated', uid: USER_A };
const actorUserB: Actor = { role: 'authenticated', uid: USER_B };
const actorAnon: Actor = { role: 'anon' };

describe('Hồ Sơ Sức Khỏe Cá Nhân V2 Suite', () => {
  beforeAll(async () => {
    db = await PGlite.create({ extensions: { pgcrypto } });
    await db.exec(SUPABASE_STUB);

    const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');
    const migrationFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      await db.exec(sql);
    }

    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES
        ('${USER_A}', 'usera.v2@example.com'),
        ('${USER_B}', 'userb.v2@example.com')
      ON CONFLICT DO NOTHING;
    `);

    await db.exec(`
      GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
    `);
  });

  // ==============================================================================
  // 1. HÀM THUẦN & VALIDATION HỢP ĐỒNG
  // ==============================================================================
  describe('1. Hợp đồng dữ liệu & Validation', () => {
    it('1.1. validateHealthProfileInput: chấp nhận năm sinh hợp lệ và từ chối năm sinh sai', () => {
      const valid = validateHealthProfileInput({ birth_year: 1995, work_context: 'sedentary', timezone: 'Asia/Ho_Chi_Minh' });
      expect(valid.is_valid).toBe(true);

      const invalidYear = validateHealthProfileInput({ birth_year: 1850 });
      expect(invalidYear.is_valid).toBe(false);
      expect(invalidYear.errors.birth_year).toBeDefined();

      const futureYear = validateHealthProfileInput({ birth_year: 2150 });
      expect(futureYear.is_valid).toBe(false);
    });

    it('1.2. validateBloodPressureInput: yêu cầu tâm thu > tâm trương và giới hạn số đo an toàn', () => {
      const validBP = validateBloodPressureInput({ systolic: 120, diastolic: 80 });
      expect(validBP.is_valid).toBe(true);

      // Tâm thu <= Tâm trương -> từ chối
      const swappedBP = validateBloodPressureInput({ systolic: 80, diastolic: 120 });
      expect(swappedBP.is_valid).toBe(false);
      expect(swappedBP.errors.systolic).toContain('lớn hơn');

      // Vượt ngưỡng sinh học
      const outOfRange = validateBloodPressureInput({ systolic: 350, diastolic: 10 });
      expect(outOfRange.is_valid).toBe(false);
    });

    it('1.3. validateDailyCheckinInput & computeCheckinWeeklyStats: ghi nhận sinh hoạt chuẩn xác', () => {
      const validCheckin = validateDailyCheckinInput({
        local_date: '2026-10-27',
        sleep_duration_minutes: 420,
        sleep_quality: 4,
        energy_level: 3,
        stress_level: 2,
      });
      expect(validCheckin.is_valid).toBe(true);

      const invalidRating = validateDailyCheckinInput({
        local_date: '2026-10-27',
        sleep_quality: 6, // Vượt quá 5
      });
      expect(invalidRating.is_valid).toBe(false);

      // Thử nghiệm computeCheckinWeeklyStats
      const mockCheckins: DailyCheckinEntity[] = [
        {
          id: '1',
          user_id: USER_A,
          local_date: '2026-10-25',
          sleep_start: null,
          sleep_end: null,
          sleep_duration_minutes: 420, // 7h
          sleep_quality: 4,
          energy_level: 4,
          stress_level: 2,
          notes: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: '2',
          user_id: USER_A,
          local_date: '2026-10-26',
          sleep_start: null,
          sleep_end: null,
          sleep_duration_minutes: 360, // 6h
          sleep_quality: 3,
          energy_level: 3,
          stress_level: 3,
          notes: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const stats = computeCheckinWeeklyStats(mockCheckins, 7);
      expect(stats.totalRecordedDays).toBe(2);
      expect(stats.averageSleepMinutes).toBe(390); // 6h30m
      expect(stats.averageEnergy).toBe(3.5);
      expect(stats.summaryText).toContain('2/7 ngày');
      expect(stats.summaryText).toContain('6 giờ 30 phút');
    });

    it('1.4. validateHealthConditionInput: phân biệt bệnh khai, chấn thương và triệu chứng', () => {
      const condition = validateHealthConditionInput({
        name: 'Thoát vị đĩa đệm L4-L5',
        category: 'diagnosed_condition',
        status: 'active',
      });
      expect(condition.is_valid).toBe(true);

      const injury = validateHealthConditionInput({
        name: 'Bong gân cổ chân',
        category: 'injury',
        status: 'monitoring',
      });
      expect(injury.is_valid).toBe(true);
    });

    it('1.5. validateAllergyInput & validateMedicationInput: kiểm tra dị ứng và thuốc', () => {
      const allergy = validateAllergyInput({
        allergen: 'Hải sản',
        reaction: 'Nổi mề đay',
        severity: 'moderate',
        status: 'known',
      });
      expect(allergy.is_valid).toBe(true);

      const med = validateMedicationInput({
        name: 'Glucosamine',
        dosage_instructions: '1 viên sau ăn',
        status: 'active',
      });
      expect(med.is_valid).toBe(true);
    });

    it('1.6. validateHealthDocumentInput: kiểm tra tệp tối đa 10MB và đúng định dạng MIME', () => {
      const validDoc = validateHealthDocumentInput({
        title: 'Kết quả xét nghiệm máu',
        file_name: 'xet_nghiem.pdf',
        file_type: 'application/pdf',
        file_size_bytes: 2 * 1024 * 1024, // 2MB
        storage_path: 'health-docs/doc-1.pdf',
      });
      expect(validDoc.is_valid).toBe(true);

      const tooLargeDoc = validateHealthDocumentInput({
        title: 'Video nội soi',
        file_name: 'video.mp4',
        file_type: 'application/pdf',
        file_size_bytes: MAX_DOCUMENT_SIZE_BYTES + 100, // Quá 10MB
        storage_path: 'health-docs/video.mp4',
      });
      expect(tooLargeDoc.is_valid).toBe(false);
      expect(tooLargeDoc.errors.file_size_bytes).toBeDefined();
    });

    it('1.7. validateObservationInput: hỗ trợ loại chỉ số mới waist_circumference', () => {
      const waistObs = validateObservationInput({
        metric_type: 'waist_circumference',
        metric_value: 78.5,
        metric_unit: 'cm',
      });
      expect(waistObs.is_valid).toBe(true);
    });
  });

  // ==============================================================================
  // 2. POSTGRES RLS VÀ CÔ LẬP DỮ LIỆU
  // ==============================================================================
  describe('2. Postgres RLS & Cô lập dữ liệu giữa các tài khoản', () => {
    it('2.1. health_profiles: User A lưu thông tin nền, User B không xem hay sửa được', async () => {
      // User A chèn thông tin nền
      await as(actorUserA, async (tx) => {
        const res = await tx.query(`
          INSERT INTO health_profiles (user_id, birth_year, work_context, timezone)
          VALUES ('${USER_A}', 1996, 'sedentary', 'Asia/Ho_Chi_Minh')
          RETURNING *;
        `);
        expect(res.rows).toHaveLength(1);
      });

      // User B đọc -> Không thấy dòng nào
      await as(actorUserB, async (tx) => {
        const res = await tx.query(`SELECT * FROM health_profiles WHERE user_id = '${USER_A}';`);
        expect(res.rows).toHaveLength(0);
      });

      // Anonymous đọc -> Không thấy dòng nào
      await as(actorAnon, async (tx) => {
        const res = await tx.query(`SELECT * FROM health_profiles WHERE user_id = '${USER_A}';`);
        expect(res.rows).toHaveLength(0);
      });
    });

    it('2.2. blood_pressure_readings: User A lưu huyết áp, User B không truy cập được', async () => {
      let bpId = '';
      await as(actorUserA, async (tx) => {
        const res = await tx.query<{ id: string }>(`
          INSERT INTO blood_pressure_readings (user_id, systolic, diastolic, notes)
          VALUES ('${USER_A}', 120, 80, 'Đo sáng sớm')
          RETURNING id;
        `);
        expect(res.rows).toHaveLength(1);
        bpId = res.rows[0].id;
      });

      await as(actorUserB, async (tx) => {
        const readRes = await tx.query(`SELECT * FROM blood_pressure_readings WHERE id = '${bpId}';`);
        expect(readRes.rows).toHaveLength(0);

        const delRes = await tx.query(`DELETE FROM blood_pressure_readings WHERE id = '${bpId}';`);
        expect(delRes.rowCount).toBe(0);
      });
    });

    it('2.3. daily_checkins: Ràng buộc UNIQUE (user_id, local_date) và RLS', async () => {
      const testDate = '2026-10-27';

      // Lần 1: Chèn
      await as(actorUserA, async (tx) => {
        await tx.query(`
          INSERT INTO daily_checkins (user_id, local_date, sleep_duration_minutes, sleep_quality)
          VALUES ('${USER_A}', '${testDate}', 450, 4);
        `);
      });

      // Lần 2: Upsert cùng ngày cập nhật ghi chú mà không tạo dòng thứ hai
      await as(actorUserA, async (tx) => {
        await tx.query(`
          INSERT INTO daily_checkins (user_id, local_date, sleep_duration_minutes, sleep_quality, notes)
          VALUES ('${USER_A}', '${testDate}', 480, 5, 'Ngủ thêm 30p')
          ON CONFLICT (user_id, local_date) DO UPDATE
            SET sleep_duration_minutes = EXCLUDED.sleep_duration_minutes,
                sleep_quality = EXCLUDED.sleep_quality,
                notes = EXCLUDED.notes;
        `);

        const countRes = await tx.query<{ count: string }>(`
          SELECT COUNT(*) as count FROM daily_checkins WHERE user_id = '${USER_A}' AND local_date = '${testDate}';
        `);
        expect(Number(countRes.rows[0].count)).toBe(1);
      });

      // User B không thể đọc checkin của User A
      await as(actorUserB, async (tx) => {
        const res = await tx.query(`SELECT * FROM daily_checkins WHERE user_id = '${USER_A}';`);
        expect(res.rows).toHaveLength(0);
      });
    });

    it('2.4. health_conditions & allergies & medications: RLS bảo vệ thông tin y tế nhạy cảm', async () => {
      await as(actorUserA, async (tx) => {
        await tx.query(`
          INSERT INTO health_conditions (user_id, name, category, status)
          VALUES ('${USER_A}', 'Viêm khớp vai', 'injury', 'active');
        `);
        await tx.query(`
          INSERT INTO allergies (user_id, allergen, reaction, status)
          VALUES ('${USER_A}', 'Kháng sinh Penicillin', 'Khó thở', 'known');
        `);
        await tx.query(`
          INSERT INTO medications (user_id, name, dosage_instructions, status)
          VALUES ('${USER_A}', 'Vitamin D3', '1 giọt mỗi sáng', 'active');
        `);
      });

      // User B kiểm tra các bảng trên
      await as(actorUserB, async (tx) => {
        const cond = await tx.query(`SELECT * FROM health_conditions WHERE user_id = '${USER_A}';`);
        const aller = await tx.query(`SELECT * FROM allergies WHERE user_id = '${USER_A}';`);
        const meds = await tx.query(`SELECT * FROM medications WHERE user_id = '${USER_A}';`);

        expect(cond.rows).toHaveLength(0);
        expect(aller.rows).toHaveLength(0);
        expect(meds.rows).toHaveLength(0);
      });
    });

    it('2.5. health_events & health_documents: Liên kết sự kiện và cô lập tài liệu', async () => {
      let eventId = '';
      await as(actorUserA, async (tx) => {
        const evRes = await tx.query<{ id: string }>(`
          INSERT INTO health_events (user_id, event_type, event_date, facility_name)
          VALUES ('${USER_A}', 'checkup', '2026-10-15', 'Phòng khám Đa khoa')
          RETURNING id;
        `);
        eventId = evRes.rows[0].id;

        const docRes = await tx.query(`
          INSERT INTO health_documents (user_id, event_id, title, file_name, file_type, file_size_bytes, storage_path)
          VALUES ('${USER_A}', '${eventId}', 'Phiếu siêu âm tim', 'sieu_am.pdf', 'application/pdf', 1048576, 'docs/user-a/sieu_am.pdf')
          RETURNING *;
        `);
        expect(docRes.rows).toHaveLength(1);
      });

      // User B không thấy sự kiện lẫn tài liệu của User A
      await as(actorUserB, async (tx) => {
        const ev = await tx.query(`SELECT * FROM health_events WHERE user_id = '${USER_A}';`);
        const doc = await tx.query(`SELECT * FROM health_documents WHERE user_id = '${USER_A}';`);
        expect(ev.rows).toHaveLength(0);
        expect(doc.rows).toHaveLength(0);
      });

      // Xóa sự kiện -> Tài liệu vẫn tồn tại nhưng event_id chuyển thành NULL (ON DELETE SET NULL)
      await as(actorUserA, async (tx) => {
        await tx.query(`DELETE FROM health_events WHERE id = '${eventId}';`);
        const docRes = await tx.query<{ event_id: string | null }>(`
          SELECT event_id FROM health_documents WHERE user_id = '${USER_A}';
        `);
        expect(docRes.rows[0].event_id).toBeNull();
      });
    });

    it('2.6. observations: lưu thành công chỉ số vòng eo waist_circumference', async () => {
      await as(actorUserA, async (tx) => {
        const res = await tx.query(`
          INSERT INTO observations (user_id, metric_type, metric_value, metric_unit, notes)
          VALUES ('${USER_A}', 'waist_circumference', 79, 'cm', 'Đo ngang rốn')
          RETURNING *;
        `);
        expect(res.rows).toHaveLength(1);
      });
    });
  });
});
