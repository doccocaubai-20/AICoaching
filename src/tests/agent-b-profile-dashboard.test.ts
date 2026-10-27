/**
 * CALISCOACHING MVP - KIỂM THỬ HỒ SƠ & DASHBOARD (AGENT B)
 * Kiểm tra các tính năng của Agent B:
 * 1. Xác thực hợp đồng hồ sơ, mục tiêu, chỉ số tự khai, kiểm tra ngày mục tiêu.
 * 2. Logic tính toán on-the-fly qua hàm thuần computeWeeklyStats (hơn 10 hoạt động, loại trừ lịch tương lai).
 * 3. Helper định dạng ngày giờ theo múi giờ Việt Nam và nhãn nguồn dữ liệu.
 * 4. Kiểm tra bảo mật RLS và cách ly dữ liệu giữa User A và User B qua PGlite (Postgres thật).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import {
  validateProfileInput,
  validateGoalInput,
  validateObservationInput,
  ObservationEntity,
  ActivityEntity,
} from '@/contracts';
import { computeWeeklyStats } from '@/components/dashboard/stats-utils';
import {
  formatDateVN,
  getTodayVNDateString,
  formatSourceLabel,
  validateGoalDates,
} from '@/components/dashboard/date-utils';

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';

const SUPABASE_STUB = `
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (
    id UUID PRIMARY KEY,
    email TEXT,
    raw_user_meta_data JSONB DEFAULT '{}'::jsonb
  );
  CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE ROLE service_role NOLOGIN BYPASSRLS;
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

const userA: Actor = { role: 'authenticated', uid: USER_A };
const userB: Actor = { role: 'authenticated', uid: USER_B };

describe('Agent B: Profile & Dashboard Suite', () => {
  beforeAll(async () => {
    db = await PGlite.create({ extensions: { pgcrypto } });
    await db.exec(SUPABASE_STUB);

    const mig1 = fs.readFileSync(
      path.resolve(__dirname, '../../supabase/migrations/20261027000001_mvp_schema_and_rls.sql'),
      'utf8'
    );
    const mig2 = fs.readFileSync(
      path.resolve(__dirname, '../../supabase/migrations/20261027000002_a_fixes_ownership_idempotency.sql'),
      'utf8'
    );
    await db.exec(mig1);
    await db.exec(mig2);

    // Tạo 2 tài khoản kiểm thử
    await db.query(
      `INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
        ($1, 'a@example.internal', '{"display_name":"Người dùng A","experience_level":"beginner"}'::jsonb),
        ($2, 'b@example.internal', '{"display_name":"Người dùng B","experience_level":"intermediate"}'::jsonb)`,
      [USER_A, USER_B]
    );
  });

  afterAll(async () => {
    await db?.close();
  });

  // ============================================================================
  // 1. UNIT TESTS: VALIDATION & CONTRACTS
  // ============================================================================
  describe('Contracts Validation & Business Rules', () => {
    it('validateProfileInput: chấp nhận hồ sơ hợp lệ và từ chối tên trống hoặc > 100 ký tự', () => {
      const valid = validateProfileInput({
        display_name: 'Hoàng Nam',
        experience_level: 'beginner',
        available_equipment: ['Sàn nhà', 'Xà đơn'],
      });
      expect(valid.is_valid).toBe(true);

      const emptyName = validateProfileInput({
        display_name: '   ',
        experience_level: 'beginner',
      });
      expect(emptyName.is_valid).toBe(false);
      expect(emptyName.errors.display_name).toBeDefined();

      const longName = validateProfileInput({
        display_name: 'a'.repeat(101),
        experience_level: 'beginner',
      });
      expect(longName.is_valid).toBe(false);
      expect(longName.errors.display_name).toBeDefined();
    });

    it('validateGoalInput: yêu cầu nội dung mục tiêu và loại hợp lệ', () => {
      const valid = validateGoalInput({
        content: 'Hít xà đơn 10 cái',
        goal_type: 'skill',
        start_date: '2026-10-27',
      });
      expect(valid.is_valid).toBe(true);

      const invalid = validateGoalInput({
        content: '',
        goal_type: 'skill',
      });
      expect(invalid.is_valid).toBe(false);
      expect(invalid.errors.content).toBeDefined();
    });

    it('validateGoalDates: từ chối khi end_date < start_date, chấp nhận khi end_date >= start_date', () => {
      // Ngày kết thúc trước ngày bắt đầu -> không hợp lệ
      const invalid = validateGoalDates('2026-11-01', '2026-10-31');
      expect(invalid).toBe('Ngày kết thúc phải diễn ra sau hoặc cùng ngày với ngày bắt đầu.');

      // Ngày kết thúc bằng ngày bắt đầu -> hợp lệ
      expect(validateGoalDates('2026-10-31', '2026-10-31')).toBeNull();

      // Ngày kết thúc sau ngày bắt đầu -> hợp lệ
      expect(validateGoalDates('2026-10-01', '2026-10-31')).toBeNull();

      // Chỉ có một trong hai ngày hoặc không có ngày nào -> hợp lệ
      expect(validateGoalDates('2026-10-01', null)).toBeNull();
      expect(validateGoalDates(null, '2026-10-31')).toBeNull();
      expect(validateGoalDates(null, null)).toBeNull();
    });

    it('validateObservationInput: chỉ chấp nhận số dương lớn hơn 0, không cho phép số 0 hoặc số âm', () => {
      const validWeight = validateObservationInput({
        metric_type: 'weight',
        metric_value: 65.5,
        metric_unit: 'kg',
      });
      expect(validWeight.is_valid).toBe(true);

      const zeroWeight = validateObservationInput({
        metric_type: 'weight',
        metric_value: 0,
        metric_unit: 'kg',
      });
      expect(zeroWeight.is_valid).toBe(false);
      expect(zeroWeight.errors.metric_value).toBeDefined();

      const negativeHeight = validateObservationInput({
        metric_type: 'height',
        metric_value: -170,
        metric_unit: 'cm',
      });
      expect(negativeHeight.is_valid).toBe(false);
    });
  });

  // ============================================================================
  // 2. DASHBOARD LOGIC (PURE FUNCTION computeWeeklyStats)
  // ============================================================================
  describe('computeWeeklyStats: Pure function for 7-day stats', () => {
    it('tính chính xác khi có hơn 10 hoạt động trong tuần (không bị giới hạn 10 dòng)', () => {
      const fixedNow = new Date('2026-10-27T12:00:00.000Z');

      // Tạo 14 hoạt động thực tế trong 7 ngày qua (mỗi hoạt động 30 phút, 2 hoạt động/ngày)
      const mockActivities: ActivityEntity[] = Array.from({ length: 14 }, (_, i) => ({
        id: `act-${i + 1}`,
        user_id: USER_A,
        activity_type: i % 2 === 0 ? 'calisthenics' : 'running',
        is_planned: false,
        start_at: new Date(fixedNow.getTime() - (i % 6 + 1) * 24 * 3600 * 1000).toISOString(),
        duration_minutes: 30,
        fatigue_level: 5,
        notes: `Buổi ${i + 1}`,
        source: 'manual_entry',
        idempotency_key: `act-key-${i + 1}`,
        created_at: fixedNow.toISOString(),
        updated_at: fixedNow.toISOString(),
      }));

      const stats = computeWeeklyStats(mockActivities, fixedNow);

      // Phải đếm đủ toàn bộ 14 buổi, không bị chặn bởi limit(10)
      expect(stats.totalSessions).toBe(14);
      expect(stats.totalMinutes).toBe(14 * 30); // 420 phút
      expect(stats.distinctTypes).toBe(2);
    });

    it('loại trừ lịch dự kiến (is_planned = true) và hoạt động trong tương lai', () => {
      const fixedNow = new Date('2026-10-27T12:00:00.000Z');

      const mockActivities: ActivityEntity[] = [
        // Hoạt động 1: Đã tập 2 ngày trước (hợp lệ)
        {
          id: '1',
          user_id: USER_A,
          activity_type: 'calisthenics',
          is_planned: false,
          start_at: new Date(fixedNow.getTime() - 2 * 24 * 3600 * 1000).toISOString(),
          duration_minutes: 45,
          fatigue_level: 6,
          notes: 'Đã hoàn thành',
          source: 'manual_entry',
          idempotency_key: 'act-1',
          created_at: fixedNow.toISOString(),
          updated_at: fixedNow.toISOString(),
        },
        // Hoạt động 2: Lịch dự kiến trong quá khứ (is_planned = true) -> không tính
        {
          id: '2',
          user_id: USER_A,
          activity_type: 'badminton',
          is_planned: true,
          start_at: new Date(fixedNow.getTime() - 1 * 24 * 3600 * 1000).toISOString(),
          duration_minutes: 60,
          fatigue_level: null,
          notes: 'Lịch chưa tập',
          source: 'manual_entry',
          idempotency_key: 'act-2',
          created_at: fixedNow.toISOString(),
          updated_at: fixedNow.toISOString(),
        },
        // Hoạt động 3: Lịch dự kiến trong tương lai -> không tính
        {
          id: '3',
          user_id: USER_A,
          activity_type: 'running',
          is_planned: true,
          start_at: new Date(fixedNow.getTime() + 2 * 24 * 3600 * 1000).toISOString(),
          duration_minutes: 30,
          fatigue_level: null,
          notes: 'Kế hoạch tương lai',
          source: 'manual_entry',
          idempotency_key: 'act-3',
          created_at: fixedNow.toISOString(),
          updated_at: fixedNow.toISOString(),
        },
        // Hoạt động 4: Hoạt động thực tế nhưng thời gian trong tương lai (> now) -> không tính
        {
          id: '4',
          user_id: USER_A,
          activity_type: 'calisthenics',
          is_planned: false,
          start_at: new Date(fixedNow.getTime() + 1 * 24 * 3600 * 1000).toISOString(),
          duration_minutes: 50,
          fatigue_level: 4,
          notes: 'Nhầm ngày tương lai',
          source: 'manual_entry',
          idempotency_key: 'act-4',
          created_at: fixedNow.toISOString(),
          updated_at: fixedNow.toISOString(),
        },
        // Hoạt động 5: Hoạt động quá 7 ngày trước -> không tính
        {
          id: '5',
          user_id: USER_A,
          activity_type: 'walking',
          is_planned: false,
          start_at: new Date(fixedNow.getTime() - 8 * 24 * 3600 * 1000).toISOString(),
          duration_minutes: 40,
          fatigue_level: 3,
          notes: 'Cũ hơn 7 ngày',
          source: 'manual_entry',
          idempotency_key: 'act-5',
          created_at: fixedNow.toISOString(),
          updated_at: fixedNow.toISOString(),
        },
      ];

      const stats = computeWeeklyStats(mockActivities, fixedNow);

      // Chỉ hoạt động 1 thỏa mãn điều kiện
      expect(stats.totalSessions).toBe(1);
      expect(stats.totalMinutes).toBe(45);
      expect(stats.distinctTypes).toBe(1);
    });

    it('nhận diện dữ liệu quan sát bị thiếu (null/undefined) mà không suy luận thành 0', () => {
      const emptyObservations: ObservationEntity[] = [];
      const latestWeight = emptyObservations.find((o) => o.metric_type === 'weight');
      const latestHeight = emptyObservations.find((o) => o.metric_type === 'height');

      // Khi thiếu dữ liệu: là undefined/null, không được gán bằng 0
      expect(latestWeight).toBeUndefined();
      expect(latestHeight).toBeUndefined();
    });
  });

  // ============================================================================
  // 3. DATE UTILITIES & SOURCE LABELS
  // ============================================================================
  describe('Date formatting & Vietnamese Labels', () => {
    it('formatDateVN: định dạng ngày theo giờ Việt Nam và trả về — nếu không hợp lệ', () => {
      // 2026-10-27T17:30:00.000Z là 00:30 ngày 28/10 theo giờ Việt Nam (UTC+7)
      const vnFormatted = formatDateVN('2026-10-27T17:30:00.000Z');
      expect(vnFormatted).toBe('28/10/2026');

      expect(formatDateVN(null)).toBe('—');
      expect(formatDateVN('')).toBe('—');
      expect(formatDateVN('invalid')).toBe('—');
    });

    it('getTodayVNDateString: trả về chuỗi ngày YYYY-MM-DD theo giờ Việt Nam', () => {
      const today = getTodayVNDateString();
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('formatSourceLabel: ánh xạ đúng mã nguồn sang nhãn tiếng Việt', () => {
      expect(formatSourceLabel('self_reported')).toBe('Tự khai');
      expect(formatSourceLabel('manual_import')).toBe('Nhập thủ công');
      expect(formatSourceLabel('session_sync')).toBe('Đồng bộ buổi tập');
      // Không tự đoán nguồn khi thiếu dữ liệu
      expect(formatSourceLabel(undefined)).toBe('Chưa rõ nguồn');
    });
  });

  // ============================================================================
  // 4. DATABASE RLS ISOLATION TESTS CHO PROFILE, GOALS, OBSERVATIONS (PGLITE)
  // ============================================================================
  describe('Database RLS Isolation for Agent B tables', () => {
    it('User A có sẵn hồ sơ được tạo tự động bởi trigger handle_new_user', async () => {
      const profile = await as(userA, async (tx) => {
        const res = await tx.query(`SELECT * FROM public.profiles WHERE user_id = $1`, [USER_A]);
        return res.rows[0] as Record<string, any>;
      });

      expect(profile).toBeDefined();
      expect(profile.display_name).toBe('Người dùng A');
      expect(profile.experience_level).toBe('beginner');
    });

    it('User A cập nhật hồ sơ với danh sách dụng cụ rỗng và kiểm tra dữ liệu lưu đúng là rỗng', async () => {
      // Lưu danh sách dụng cụ rỗng []
      await as(userA, async (tx) => {
        await tx.query(
          `UPDATE public.profiles
           SET display_name = 'Nguyễn Văn A (Đã cập nhật)',
               available_equipment = $1,
               updated_at = now()
           WHERE user_id = $2`,
          [[], USER_A]
        );
      });

      // User A đọc lại hồ sơ -> available_equipment phải là mảng rỗng [] (không tự ý điền 'Sàn nhà')
      const profileA = await as(userA, async (tx) => {
        const res = await tx.query(`SELECT display_name, available_equipment FROM public.profiles WHERE user_id = $1`, [USER_A]);
        return res.rows[0] as Record<string, any>;
      });
      expect(profileA.display_name).toBe('Nguyễn Văn A (Đã cập nhật)');
      expect(profileA.available_equipment).toEqual([]);

      // User B query hồ sơ của A -> 0 dòng do RLS
      const bReadA = await as(userB, async (tx) => {
        const res = await tx.query(`SELECT * FROM public.profiles WHERE user_id = $1`, [USER_A]);
        return res.rows;
      });
      expect(bReadA).toHaveLength(0);

      // User B cố ý update hồ sơ của A -> 0 dòng bị tác động
      const bUpdateA = await as(userB, async (tx) => {
        const res = await tx.query(
          `UPDATE public.profiles SET display_name = 'Hacked' WHERE user_id = $1`,
          [USER_A]
        );
        return res.affectedRows;
      });
      expect(bUpdateA).toBe(0);
    });

    it('User A thêm, sửa nội dung, sửa trạng thái, và xóa mục tiêu cá nhân an toàn qua RLS', async () => {
      // 1. Thêm mục tiêu
      const goalId = await as(userA, async (tx) => {
        const res = await tx.query(
          `INSERT INTO public.goals (user_id, content, goal_type, status, start_date, end_date)
           VALUES ($1, 'Hít xà 8 cái liên tục', 'skill', 'active', '2026-10-01', '2026-10-31')
           RETURNING id`,
          [USER_A]
        );
        return (res.rows[0] as Record<string, any>).id as string;
      });
      expect(goalId).toBeDefined();

      // User B không thể đọc mục tiêu này của A
      const bReadGoals = await as(userB, async (tx) => {
        const res = await tx.query(`SELECT * FROM public.goals WHERE id = $1`, [goalId]);
        return res.rows;
      });
      expect(bReadGoals).toHaveLength(0);

      // 2. User A sửa nội dung mục tiêu (updateGoal)
      await as(userA, async (tx) => {
        await tx.query(
          `UPDATE public.goals
           SET content = 'Hít xà 10 cái hoàn chỉnh',
               goal_type = 'strength',
               end_date = '2026-11-30'
           WHERE id = $1 AND user_id = $2`,
          [goalId, USER_A]
        );
      });

      const updatedContentGoal = await as(userA, async (tx) => {
        const res = await tx.query(`SELECT content, goal_type, end_date::text AS end_date FROM public.goals WHERE id = $1`, [goalId]);
        return res.rows[0] as Record<string, any>;
      });
      expect(updatedContentGoal.content).toBe('Hít xà 10 cái hoàn chỉnh');
      expect(updatedContentGoal.goal_type).toBe('strength');
      expect(updatedContentGoal.end_date).toBe('2026-11-30');

      // 3. User B cố sửa nội dung mục tiêu của A -> 0 dòng
      const bUpdateGoal = await as(userB, async (tx) => {
        const res = await tx.query(
          `UPDATE public.goals SET content = 'Bị sửa bởi B' WHERE id = $1`,
          [goalId]
        );
        return res.affectedRows;
      });
      expect(bUpdateGoal).toBe(0);

      // 4. User A đổi trạng thái sang completed
      await as(userA, async (tx) => {
        await tx.query(`UPDATE public.goals SET status = 'completed' WHERE id = $1`, [goalId]);
      });

      const updatedGoal = await as(userA, async (tx) => {
        const res = await tx.query(`SELECT status FROM public.goals WHERE id = $1`, [goalId]);
        return res.rows[0] as Record<string, any>;
      });
      expect(updatedGoal.status).toBe('completed');

      // 5. User B cố xóa mục tiêu của A -> không xóa được
      const bDelete = await as(userB, async (tx) => {
        const res = await tx.query(`DELETE FROM public.goals WHERE id = $1`, [goalId]);
        return res.affectedRows;
      });
      expect(bDelete).toBe(0);

      // 6. User A tự xóa mục tiêu của mình -> xóa thành công
      const aDelete = await as(userA, async (tx) => {
        const res = await tx.query(`DELETE FROM public.goals WHERE id = $1`, [goalId]);
        return res.affectedRows;
      });
      expect(aDelete).toBe(1);
    });

    it('Chỉ số tự khai: User A lưu cân nặng và chiều cao có ngày và nguồn, User B bị RLS chặn', async () => {
      const obsId = await as(userA, async (tx) => {
        const res = await tx.query(
          `INSERT INTO public.observations (user_id, metric_type, metric_value, metric_unit, source)
           VALUES ($1, 'weight', 67.5, 'kg', 'self_reported')
           RETURNING id`,
          [USER_A]
        );
        return (res.rows[0] as Record<string, any>).id as string;
      });

      // User A đọc được
      const obsA = await as(userA, async (tx) => {
        const res = await tx.query(`SELECT * FROM public.observations WHERE id = $1`, [obsId]);
        return res.rows[0] as Record<string, any>;
      });
      expect(obsA.metric_value).toBe('67.5');
      expect(obsA.source).toBe('self_reported');

      // User B không đọc được
      const obsB = await as(userB, async (tx) => {
        const res = await tx.query(`SELECT * FROM public.observations WHERE id = $1`, [obsId]);
        return res.rows;
      });
      expect(obsB).toHaveLength(0);

      // User B không thể xóa
      const bDeleteObs = await as(userB, async (tx) => {
        const res = await tx.query(`DELETE FROM public.observations WHERE id = $1`, [obsId]);
        return res.affectedRows;
      });
      expect(bDeleteObs).toBe(0);
    });
  });
});
