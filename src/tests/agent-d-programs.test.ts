/**
 * CALISCOACHING MVP - KIỂM THỬ CHƯƠNG TRÌNH, BUỔI TẬP VÀ XEM LẠI LỊCH (AGENT D)
 * Kiểm tra các tính năng của Agent D:
 * 1. Hàm thuần: parseExercises, cleanCompletedExercises, validateSessionDuration.
 * 2. Hàm thuần: evaluateScheduleReview (quy tắc demo cầu lông và calisthenics gần nhau, xử lý thiếu dữ liệu).
 * 3. Postgres RLS, Idempotency & Review Suggestion Triggers qua PGlite:
 *    - Đọc chương trình/buổi tập mẫu hệ thống (user_id IS NULL).
 *    - Ghi kết quả tự khai và đồng bộ hoạt động với cùng một idempotency_key.
 *    - Lưu lặp cùng khóa không nhân đôi dữ liệu.
 *    - RLS chặn User B ghi kết quả cho buổi tập riêng của User A.
 *    - Chặn trùng gợi ý còn hiệu lực qua index uq_review_suggestions_active.
 *    - Trigger tự động đổi trạng thái gợi ý sang 'outdated' khi hoạt động nguồn bị sửa.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import {
  ActivityEntity,
  IDEMPOTENCY_CONFLICT_TARGET,
  MAX_ACTIVITY_DURATION_MINUTES,
} from '@/contracts';
import {
  parseExercises,
  cleanCompletedExercises,
  validateSessionDuration,
  parsePerceivedExertion,
} from '@/components/programs/program-utils';
import {
  evaluateScheduleReview,
  REVIEW_RULE_VERSION,
  DEMO_PROXIMITY_THRESHOLD_HOURS,
} from '@/components/review/review-utils';

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';
const SYSTEM_SESSION_1 = 'b0000000-0000-0000-0000-000000000001';

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

describe('Agent D: Programs, Sessions & Review Suggestions Suite', () => {
  beforeAll(async () => {
    db = await PGlite.create({ extensions: { pgcrypto } });
    await db.exec(SUPABASE_STUB);

    // Chạy tất cả migration theo thứ tự tên
    const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');
    for (const file of fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
      await db.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
    }

    // Chạy file seed dữ liệu mẫu
    await db.exec(fs.readFileSync(path.resolve(__dirname, '../../supabase/seed_demo.sql'), 'utf8'));

    // Tạo 2 tài khoản kiểm thử
    await db.query(
      `INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
        ($1, 'user_a@example.internal', '{"display_name":"Người dùng A","experience_level":"beginner"}'::jsonb),
        ($2, 'user_b@example.internal', '{"display_name":"Người dùng B","experience_level":"intermediate"}'::jsonb)`,
      [USER_A, USER_B]
    );
  });

  afterAll(async () => {
    await db?.close();
  });

  // ============================================================================
  // 1. UNIT TESTS: HÀM THUẦN (PURE FUNCTIONS)
  // ============================================================================
  describe('Hàm thuần xử lý chương trình & bài tập (program-utils)', () => {
    it('parseExercises: đọc mảng động tác hợp lệ và loại bỏ phần tử hỏng', () => {
      const validJson = [
        { name: 'Hít xà đơn', sets: 3, target_reps: '8-10', rest_seconds: 90, note: 'Demo' },
        { name: 'Chống đẩy', sets: 4, target_reps: '12-15', rest_seconds: 60 },
      ];
      const parsed = parseExercises(validJson);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].name).toBe('Hít xà đơn');
      expect(parsed[0].sets).toBe(3);
      expect(parsed[1].name).toBe('Chống đẩy');

      // Chuỗi JSON hợp lệ
      const parsedStr = parseExercises(JSON.stringify(validJson));
      expect(parsedStr).toHaveLength(2);
    });

    it('parseExercises: xử lý an toàn khi JSON bị hỏng, rỗng hoặc sai cấu trúc', () => {
      expect(parseExercises(null)).toEqual([]);
      expect(parseExercises(undefined)).toEqual([]);
      expect(parseExercises('invalid-json-string')).toEqual([]);
      expect(parseExercises(123)).toEqual([]);
      expect(parseExercises({})).toEqual([]);

      // Mảng chứa phần tử thiếu tên hoặc sets <= 0
      const mixed = [
        { name: '', sets: 3, target_reps: '10' }, // tên rỗng -> loại bỏ
        { name: 'Hợp lệ', sets: 3, target_reps: '10' },
        { name: 'Sets bằng 0', sets: 0, target_reps: '10' }, // sets = 0 -> loại bỏ
        null,
        'string-item',
      ];
      const cleaned = parseExercises(mixed);
      expect(cleaned).toHaveLength(1);
      expect(cleaned[0].name).toBe('Hợp lệ');
    });

    it('cleanCompletedExercises: loại bỏ động tác bỏ trống, không lưu 0', () => {
      const rawInputs = [
        { exercise_name: 'Hít xà', actual_sets: 3, actual_reps: '8' },
        { exercise_name: 'Chống đẩy', actual_sets: '', actual_reps: '' }, // Bỏ trống -> loại bỏ
        { exercise_name: 'Treo xà', actual_sets: 0, actual_reps: '30s' }, // Số hiệp = 0 -> loại bỏ
        { exercise_name: 'Plank', actual_sets: 2, actual_reps: '0' }, // Số lần = '0' -> loại bỏ
        { exercise_name: 'Squat', actual_sets: '3', actual_reps: '15' }, // Hợp lệ dạng chuỗi
      ];

      const cleaned = cleanCompletedExercises(rawInputs);
      expect(cleaned).toHaveLength(2);
      expect(cleaned[0].exercise_name).toBe('Hít xà');
      expect(cleaned[0].actual_sets).toBe(3);
      expect(cleaned[1].exercise_name).toBe('Squat');
      expect(cleaned[1].actual_sets).toBe(3);
    });

    it('parsePerceivedExertion: bỏ trống là null, chỉ nhận số nguyên 1-10', () => {
      expect(parsePerceivedExertion(null)).toEqual({ value: null });
      expect(parsePerceivedExertion('')).toEqual({ value: null });
      expect(parsePerceivedExertion('  ')).toEqual({ value: null });
      expect(parsePerceivedExertion('1')).toEqual({ value: 1 });
      expect(parsePerceivedExertion('10')).toEqual({ value: 10 });

      // Giá trị sai bị từ chối trước khi ghi session_results, không bị cắt hay suy ra
      for (const bad of ['0', '11', '7.5', '-3', 'abc']) {
        const result = parsePerceivedExertion(bad);
        expect(result.value, bad).toBeNull();
        expect(result.error, bad).toBeDefined();
      }
    });

    it('validateSessionDuration: kiểm tra thời lượng buổi tập hợp lệ (1 - 1440 phút)', () => {
      expect(validateSessionDuration(35)).toEqual({ isValid: true });
      expect(validateSessionDuration(MAX_ACTIVITY_DURATION_MINUTES)).toEqual({ isValid: true });

      // Không hợp lệ: <= 0
      expect(validateSessionDuration(0).isValid).toBe(false);
      expect(validateSessionDuration(-10).isValid).toBe(false);

      // Không hợp lệ: vượt quá 1440 phút
      expect(validateSessionDuration(1441).isValid).toBe(false);

      // Không hợp lệ: số thập phân
      expect(validateSessionDuration(35.5).isValid).toBe(false);

      // Không hợp lệ: chuỗi hoặc NaN
      expect(validateSessionDuration('35' as any).isValid).toBe(false);
    });
  });

  // ============================================================================
  // 2. UNIT TESTS: QUY TẮC XEM LẠI LỊCH (review-utils)
  // ============================================================================
  describe('Hàm thuần quy tắc xem lại lịch (review-utils)', () => {
    const fixedNow = new Date('2026-10-27T12:00:00.000Z');

    it('phát hiện buổi Cầu lông và Calisthenics cách nhau dưới 12 giờ -> needs_review', () => {
      const mockActivities: ActivityEntity[] = [
        {
          id: 'act-uuid-222',
          user_id: USER_A,
          activity_type: 'calisthenics',
          is_planned: false,
          start_at: '2026-10-27T08:00:00.000Z',
          duration_minutes: 45,
          fatigue_level: 6,
          notes: 'Buổi kéo đẩy',
          source: 'manual_entry',
          idempotency_key: 'key-calis',
          created_at: fixedNow.toISOString(),
          updated_at: fixedNow.toISOString(),
        },
        {
          id: 'act-uuid-111',
          user_id: USER_A,
          activity_type: 'badminton',
          is_planned: false,
          start_at: '2026-10-27T11:00:00.000Z', // Cách nhau 3 tiếng (< 12h)
          duration_minutes: 60,
          fatigue_level: 7,
          notes: 'Đánh đôi',
          source: 'manual_entry',
          idempotency_key: 'key-badminton',
          created_at: fixedNow.toISOString(),
          updated_at: fixedNow.toISOString(),
        },
      ];

      const result = evaluateScheduleReview(mockActivities, fixedNow);
      expect(result.status).toBe('needs_review');
      expect(result.reason).toContain('Cầu lông');
      expect(result.reason).toContain('Calisthenics');
      expect(result.rule_version).toBe(REVIEW_RULE_VERSION);
      expect(result.is_demo).toBe(true);

      // reference_activity_ids PHẢI được sắp xếp tăng dần
      expect(result.reference_activity_ids).toEqual(['act-uuid-111', 'act-uuid-222']);
    });

    it('không cảnh báo nếu hai buổi tập cách nhau trên 12 giờ -> no_flag', () => {
      const mockActivities: ActivityEntity[] = [
        {
          id: 'act-1',
          user_id: USER_A,
          activity_type: 'calisthenics',
          is_planned: false,
          start_at: '2026-10-25T08:00:00.000Z',
          duration_minutes: 45,
          fatigue_level: 6,
          notes: null,
          source: 'manual_entry',
          idempotency_key: 'k1',
          created_at: fixedNow.toISOString(),
          updated_at: fixedNow.toISOString(),
        },
        {
          id: 'act-2',
          user_id: USER_A,
          activity_type: 'badminton',
          is_planned: false,
          start_at: '2026-10-27T08:00:00.000Z', // Cách nhau 48 tiếng (> 12h)
          duration_minutes: 60,
          fatigue_level: 5,
          notes: null,
          source: 'manual_entry',
          idempotency_key: 'k2',
          created_at: fixedNow.toISOString(),
          updated_at: fixedNow.toISOString(),
        },
      ];

      const result = evaluateScheduleReview(mockActivities, fixedNow);
      expect(result.status).toBe('no_flag');
      expect(result.reference_activity_ids).toEqual([]);
    });

    it('bỏ qua hoạt động là lịch dự kiến (is_planned = true) khi đối chiếu', () => {
      const mockActivities: ActivityEntity[] = [
        {
          id: 'act-1',
          user_id: USER_A,
          activity_type: 'calisthenics',
          is_planned: false,
          start_at: '2026-10-27T08:00:00.000Z',
          duration_minutes: 45,
          fatigue_level: 6,
          notes: null,
          source: 'manual_entry',
          idempotency_key: 'k1',
          created_at: fixedNow.toISOString(),
          updated_at: fixedNow.toISOString(),
        },
        {
          id: 'act-2',
          user_id: USER_A,
          activity_type: 'badminton',
          is_planned: true, // Chỉ là lịch dự kiến
          start_at: '2026-10-27T10:00:00.000Z',
          duration_minutes: 60,
          fatigue_level: null,
          notes: null,
          source: 'manual_entry',
          idempotency_key: 'k2',
          created_at: fixedNow.toISOString(),
          updated_at: fixedNow.toISOString(),
        },
      ];

      const result = evaluateScheduleReview(mockActivities, fixedNow);
      // Chỉ có 1 hoạt động thực tế -> không đủ đối chiếu
      expect(result.status).toBe('no_flag');
    });

    it('xử lý thiếu dữ liệu (thời gian hỏng hoặc thời lượng <= 0) -> insufficient_data', () => {
      const corruptedActivities: ActivityEntity[] = [
        {
          id: 'act-corrupt-1',
          user_id: USER_A,
          activity_type: 'calisthenics',
          is_planned: false,
          start_at: 'invalid-date',
          duration_minutes: 45,
          fatigue_level: 5,
          notes: null,
          source: 'manual_entry',
          idempotency_key: 'kc1',
          created_at: fixedNow.toISOString(),
          updated_at: fixedNow.toISOString(),
        },
        {
          id: 'act-corrupt-2',
          user_id: USER_A,
          activity_type: 'badminton',
          is_planned: false,
          start_at: '2026-10-27T08:00:00.000Z',
          duration_minutes: 60,
          fatigue_level: 6,
          notes: null,
          source: 'manual_entry',
          idempotency_key: 'kc2',
          created_at: fixedNow.toISOString(),
          updated_at: fixedNow.toISOString(),
        },
      ];

      const result = evaluateScheduleReview(corruptedActivities, fixedNow);
      expect(result.status).toBe('insufficient_data');
      expect(result.reason).toContain('Chưa đủ thông tin');
    });
  });

  // ============================================================================
  // 3. DATABASE TESTS (PGLITE & RLS & IDEMPOTENCY)
  // ============================================================================
  describe('Postgres RLS, Idempotency & Review Suggestion Triggers (PGlite)', () => {
    it('User A đọc được chương trình và buổi tập mẫu cấp hệ thống (user_id IS NULL)', async () => {
      const programs = await as(userA, async (tx) => {
        const res = await tx.query(`SELECT * FROM public.programs WHERE user_id IS NULL`);
        return res.rows;
      });
      expect(programs.length).toBeGreaterThanOrEqual(1);

      const sessions = await as(userA, async (tx) => {
        const res = await tx.query(`SELECT * FROM public.sessions WHERE user_id IS NULL ORDER BY sequence_order ASC`);
        return res.rows;
      });
      expect(sessions.length).toBeGreaterThanOrEqual(2);
      expect((sessions[0] as Record<string, any>).title).toContain('Buổi 1');
    });

    it('Ghi kết quả và đồng bộ hoạt động với cùng một idempotency_key; lưu lặp không nhân đôi', async () => {
      const sharedKey = 'shared-session-sync-key-001';

      // 1. Lưu session_results với idempotency_key
      await as(userA, async (tx) => {
        await tx.query(
          `INSERT INTO public.session_results (session_id, user_id, completed_at, self_reported_data, notes, idempotency_key, is_demo)
           VALUES ($1, $2, now(), '{"completed_exercises":[{"exercise_name":"Hít xà","actual_sets":3,"actual_reps":"8"}]}'::jsonb, 'Hoàn thành tốt', $3, true)
           ON CONFLICT (user_id, idempotency_key) DO NOTHING`,
          [SYSTEM_SESSION_1, USER_A, sharedKey]
        );
      });

      // 2. Lưu activities nguồn session_sync với CÙNG idempotency_key
      await as(userA, async (tx) => {
        await tx.query(
          `INSERT INTO public.activities (user_id, activity_type, is_planned, start_at, duration_minutes, fatigue_level, notes, source, idempotency_key)
           VALUES ($1, 'calisthenics', false, now(), 35, 6, 'Buổi tập minh họa: Buổi 1', 'session_sync', $2)
           ON CONFLICT (user_id, idempotency_key) DO NOTHING`,
          [USER_A, sharedKey]
        );
      });

      // 3. Giả lập bấm lưu lặp (gửi lại cùng idempotency_key cho cả 2 bảng)
      await as(userA, async (tx) => {
        await tx.query(
          `INSERT INTO public.session_results (session_id, user_id, completed_at, self_reported_data, notes, idempotency_key, is_demo)
           VALUES ($1, $2, now(), '{"completed_exercises":[{"exercise_name":"Hít xà","actual_sets":3,"actual_reps":"8"}]}'::jsonb, 'Hoàn thành tốt', $3, true)
           ON CONFLICT (user_id, idempotency_key) DO NOTHING`,
          [SYSTEM_SESSION_1, USER_A, sharedKey]
        );
        await tx.query(
          `INSERT INTO public.activities (user_id, activity_type, is_planned, start_at, duration_minutes, fatigue_level, notes, source, idempotency_key)
           VALUES ($1, 'calisthenics', false, now(), 35, 6, 'Buổi tập minh họa: Buổi 1', 'session_sync', $2)
           ON CONFLICT (user_id, idempotency_key) DO NOTHING`,
          [USER_A, sharedKey]
        );
      });

      // Kiểm tra trong database: chính xác 1 dòng session_results và 1 dòng activities
      const resCount = await as(userA, async (tx) => {
        const q = await tx.query(`SELECT COUNT(*)::int AS count FROM public.session_results WHERE user_id = $1 AND idempotency_key = $2`, [
          USER_A,
          sharedKey,
        ]);
        return (q.rows[0] as Record<string, any>).count as number;
      });
      expect(resCount).toBe(1);

      const actCount = await as(userA, async (tx) => {
        const q = await tx.query(`SELECT COUNT(*)::int AS count FROM public.activities WHERE user_id = $1 AND idempotency_key = $2`, [
          USER_A,
          sharedKey,
        ]);
        return (q.rows[0] as Record<string, any>).count as number;
      });
      expect(actCount).toBe(1);
    });

    it('RLS: User B không thể ghi kết quả cho buổi tập riêng của User A', async () => {
      // User A tạo buổi tập riêng thuộc về mình
      const aPrivateSessionId = await as(userA, async (tx) => {
        const q = await tx.query(
          `INSERT INTO public.sessions (program_id, user_id, title, sequence_order, exercises)
           VALUES ('a0000000-0000-0000-0000-000000000001', $1, 'Buổi riêng của A', 99, '[]'::jsonb)
           RETURNING id`,
          [USER_A]
        );
        return (q.rows[0] as Record<string, any>).id as string;
      });

      // User B cố ý ghi kết quả cho buổi tập của User A -> Bị RLS chặn (vi phạm WITH CHECK policy)
      await expect(
        as(userB, async (tx) => {
          await tx.query(
            `INSERT INTO public.session_results (session_id, user_id, completed_at, idempotency_key)
             VALUES ($1, $2, now(), 'key-b-hack')`,
            [aPrivateSessionId, USER_B]
          );
        })
      ).rejects.toThrow();
    });

    it('Review Suggestions: Chặn trùng gợi ý còn hiệu lực qua index uq_review_suggestions_active', async () => {
      const act1 = '33333333-3333-3333-3333-333333333331';
      const act2 = '33333333-3333-3333-3333-333333333332';
      const sortedIds = [act1, act2].sort();

      // Tạo gợi ý 1 cho User A với status = 'pending'
      await as(userA, async (tx) => {
        await tx.query(
          `INSERT INTO public.review_suggestions (user_id, status, reason, reference_activity_ids, rule_version)
           VALUES ($1, 'pending', 'Cầu lông và Calisthenics sát nhau', $2, 'rule-demo-v1.0')`,
          [USER_A, sortedIds]
        );
      });

      // Cố ý chèn gợi ý 2 TRÙNG LẶP cùng (user_id, rule_version, reference_activity_ids) với status = 'pending'
      // -> Phải bị chặn bởi unique index uq_review_suggestions_active (mã lỗi 23505)
      await expect(
        as(userA, async (tx) => {
          await tx.query(
            `INSERT INTO public.review_suggestions (user_id, status, reason, reference_activity_ids, rule_version)
             VALUES ($1, 'pending', 'Gợi ý trùng lặp', $2, 'rule-demo-v1.0')`,
            [USER_A, sortedIds]
          );
        })
      ).rejects.toThrow(/uq_review_suggestions_active/);
    });

    it('Trigger: Sửa hoạt động nguồn tự động chuyển review_suggestions liên quan sang outdated', async () => {
      // 1. Tạo hoạt động nguồn cho User A
      const actId = await as(userA, async (tx) => {
        const q = await tx.query(
          `INSERT INTO public.activities (user_id, activity_type, is_planned, start_at, duration_minutes, idempotency_key)
           VALUES ($1, 'calisthenics', false, now(), 40, 'act-key-for-trigger-test')
           RETURNING id`,
          [USER_A]
        );
        return (q.rows[0] as Record<string, any>).id as string;
      });

      // 2. Tạo gợi ý xem lại lịch tham chiếu đến hoạt động này
      const suggId = await as(userA, async (tx) => {
        const q = await tx.query(
          `INSERT INTO public.review_suggestions (user_id, status, reason, reference_activity_ids, rule_version)
           VALUES ($1, 'pending', 'Tập sát nhau', ARRAY[$2::uuid], 'rule-demo-v1.0')
           RETURNING id`,
          [USER_A, actId]
        );
        return (q.rows[0] as Record<string, any>).id as string;
      });

      // 3. User A sửa hoạt động nguồn (VD: thay đổi thời lượng)
      await as(userA, async (tx) => {
        await tx.query(`UPDATE public.activities SET duration_minutes = 60 WHERE id = $1`, [actId]);
      });

      // 4. Trigger database trg_activities_mark_suggestions_outdated phải tự động cập nhật status = 'outdated'
      const statusAfterUpdate = await as(userA, async (tx) => {
        const q = await tx.query(`SELECT status FROM public.review_suggestions WHERE id = $1`, [suggId]);
        return (q.rows[0] as Record<string, any>).status;
      });
      expect(statusAfterUpdate).toBe('outdated');
    });
  });
});
