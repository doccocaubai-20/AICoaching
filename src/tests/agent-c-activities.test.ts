/**
 * CALISCOACHING MVP - KIỂM THỬ NHẬT KÝ HOẠT ĐỘNG (AGENT C)
 * Kiểm tra các tính năng của Agent C:
 * 1. Hàm thuần: đổi giờ địa phương sang ISO, format giờ VN, kiểm tra thời lượng, lọc danh sách.
 * 2. Xác thực hợp đồng dữ liệu qua validateActivityInput.
 * 3. Postgres RLS & Idempotency qua PGlite:
 *    - Upsert lặp cùng idempotency_key không nhân đôi bản ghi.
 *    - Cách ly dữ liệu giữa User A và User B (không xem, sửa hoặc xóa chéo).
 *    - Khi sửa hoặc xóa hoạt động, trigger tự động đổi review_suggestions liên quan sang 'outdated'.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import {
  ActivityEntity,
  validateActivityInput,
  IDEMPOTENCY_CONFLICT_TARGET,
} from '@/contracts';
import {
  localDatetimeToIso,
  isoToVNDatetimeLocal,
  getVietnamNowDatetimeLocal,
  validateActivityDuration,
  filterActivities,
} from '@/components/activities/activity-utils';

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

describe('Agent C: Activities Suite', () => {
  beforeAll(async () => {
    db = await PGlite.create({ extensions: { pgcrypto } });
    await db.exec(SUPABASE_STUB);

    // Chạy tất cả migration theo thứ tự tên
    const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');
    for (const file of fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
      await db.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
    }

    // Tạo 2 tài khoản kiểm thử độc lập
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
  describe('Hàm thuần xử lý thời gian & danh sách (activity-utils)', () => {
    it('localDatetimeToIso: chuyển đổi chuỗi giờ địa phương sang ISO-8601 chính xác', () => {
      // Giá trị nhập là giờ Việt Nam (+07:00), không phụ thuộc múi giờ máy chạy test
      expect(localDatetimeToIso('2026-10-27T14:30')).toBe('2026-10-27T07:30:00.000Z');
      expect(localDatetimeToIso('2026-10-27T06:00')).toBe('2026-10-26T23:00:00.000Z');
      expect(localDatetimeToIso('2026-10-27T14:30:15')).toBe('2026-10-27T07:30:15.000Z');

      // Mở form sửa rồi lưu lại không làm lệch giờ
      const saved = '2026-10-27T07:30:00.000Z';
      expect(localDatetimeToIso(isoToVNDatetimeLocal(saved))).toBe(saved);

      // Đầu vào rỗng hoặc không hợp lệ
      expect(localDatetimeToIso('')).toBe('');
      expect(localDatetimeToIso('invalid-date')).toBe('');
    });

    it('isoToVNDatetimeLocal: chuyển chuỗi ISO sang giờ Việt Nam YYYY-MM-DDTHH:mm', () => {
      // 07:30 UTC = 14:30 theo giờ Việt Nam (UTC+7)
      const vnLocal = isoToVNDatetimeLocal('2026-10-27T07:30:00.000Z');
      expect(vnLocal).toBe('2026-10-27T14:30');

      // 17:00 UTC hôm trước = 00:00 ngày hôm sau theo giờ Việt Nam
      const midnightVN = isoToVNDatetimeLocal('2026-10-26T17:00:00.000Z');
      expect(midnightVN).toBe('2026-10-27T00:00');

      expect(isoToVNDatetimeLocal('')).toBe('');
      expect(isoToVNDatetimeLocal('not-a-date')).toBe('');
    });

    it('getVietnamNowDatetimeLocal: trả về định dạng YYYY-MM-DDTHH:mm hợp lệ', () => {
      const nowVN = getVietnamNowDatetimeLocal();
      expect(nowVN).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    });

    it('validateActivityDuration: kiểm tra thời lượng (nguyên dương, tối đa 1440 phút)', () => {
      // Hợp lệ
      expect(validateActivityDuration(30)).toEqual({ isValid: true });
      expect(validateActivityDuration(45)).toEqual({ isValid: true });
      expect(validateActivityDuration(1440)).toEqual({ isValid: true });

      // Không hợp lệ: <= 0
      expect(validateActivityDuration(0).isValid).toBe(false);
      expect(validateActivityDuration(-15).isValid).toBe(false);

      // Không hợp lệ: vượt quá 1440 phút (24h)
      const tooLong = validateActivityDuration(1441);
      expect(tooLong.isValid).toBe(false);
      expect(tooLong.error).toContain('1440 phút');

      // Không hợp lệ: số thập phân
      const decimal = validateActivityDuration(45.5);
      expect(decimal.isValid).toBe(false);
      expect(decimal.error).toContain('số nguyên');

      // Không hợp lệ: không phải số
      expect(validateActivityDuration('45' as any).isValid).toBe(false);
      expect(validateActivityDuration(null as any).isValid).toBe(false);
    });

    it('filterActivities: lọc danh sách theo môn và theo trạng thái (Đã tập / Lịch dự kiến)', () => {
      const mockList: ActivityEntity[] = [
        {
          id: '1',
          user_id: USER_A,
          activity_type: 'calisthenics',
          is_planned: false,
          start_at: '2026-10-27T08:00:00.000Z',
          duration_minutes: 45,
          fatigue_level: 6,
          notes: null,
          source: 'manual_entry',
          idempotency_key: 'k1',
          created_at: '2026-10-27T08:00:00.000Z',
          updated_at: '2026-10-27T08:00:00.000Z',
        },
        {
          id: '2',
          user_id: USER_A,
          activity_type: 'running',
          is_planned: true, // Kế hoạch dự kiến
          start_at: '2026-10-28T06:00:00.000Z',
          duration_minutes: 30,
          fatigue_level: null,
          notes: 'Chạy sáng',
          source: 'manual_entry',
          idempotency_key: 'k2',
          created_at: '2026-10-27T08:00:00.000Z',
          updated_at: '2026-10-27T08:00:00.000Z',
        },
        {
          id: '3',
          user_id: USER_A,
          activity_type: 'badminton',
          is_planned: false,
          start_at: '2026-10-26T10:00:00.000Z',
          duration_minutes: 60,
          fatigue_level: 7,
          notes: null,
          source: 'manual_entry',
          idempotency_key: 'k3',
          created_at: '2026-10-27T08:00:00.000Z',
          updated_at: '2026-10-27T08:00:00.000Z',
        },
      ];

      // Lọc tất cả
      expect(filterActivities(mockList, { type: 'all', status: 'all' })).toHaveLength(3);

      // Lọc theo môn calisthenics
      const calis = filterActivities(mockList, { type: 'calisthenics', status: 'all' });
      expect(calis).toHaveLength(1);
      expect(calis[0].id).toBe('1');

      // Lọc chỉ lịch dự kiến
      const planned = filterActivities(mockList, { type: 'all', status: 'planned' });
      expect(planned).toHaveLength(1);
      expect(planned[0].id).toBe('2');

      // Lọc chỉ hoạt động thực tế đã tập
      const actual = filterActivities(mockList, { type: 'all', status: 'actual' });
      expect(actual).toHaveLength(2);

      // Kết hợp lọc môn running + đã tập -> 0 dòng vì running đang là planned
      const runningActual = filterActivities(mockList, { type: 'running', status: 'actual' });
      expect(runningActual).toHaveLength(0);
    });
  });

  // ============================================================================
  // 2. UNIT TESTS: XÁC THỰC HỢP ĐỒNG (CONTRACTS)
  // ============================================================================
  describe('Xác thực hợp đồng validateActivityInput', () => {
    it('chấp nhận dữ liệu hoạt động hợp lệ', () => {
      const res = validateActivityInput({
        activity_type: 'calisthenics',
        is_planned: false,
        start_at: '2026-10-27T10:00:00.000Z',
        duration_minutes: 45,
        fatigue_level: 6,
        notes: 'Buổi tập tốt',
        source: 'manual_entry',
        idempotency_key: 'valid-key-1',
      });
      expect(res.is_valid).toBe(true);
      expect(Object.keys(res.errors)).toHaveLength(0);
    });

    it('từ chối loại môn không thuộc danh mục cho phép', () => {
      const res = validateActivityInput({
        activity_type: 'swimming' as any,
        start_at: '2026-10-27T10:00:00.000Z',
        duration_minutes: 30,
      });
      expect(res.is_valid).toBe(false);
      expect(res.errors.activity_type).toBeDefined();
    });

    it('từ chối mức mệt ngoài khoảng 1-10', () => {
      const resZero = validateActivityInput({
        activity_type: 'running',
        start_at: '2026-10-27T10:00:00.000Z',
        duration_minutes: 30,
        fatigue_level: 0,
      });
      expect(resZero.is_valid).toBe(false);
      expect(resZero.errors.fatigue_level).toBeDefined();

      const resEleven = validateActivityInput({
        activity_type: 'running',
        start_at: '2026-10-27T10:00:00.000Z',
        duration_minutes: 30,
        fatigue_level: 11,
      });
      expect(resEleven.is_valid).toBe(false);
      expect(resEleven.errors.fatigue_level).toBeDefined();
    });
  });

  // ============================================================================
  // 3. DATABASE TESTS (PGLITE & RLS & IDEMPOTENCY)
  // ============================================================================
  describe('Postgres RLS, Idempotency & Trigger quy tắc xem lại lịch', () => {
    it('Chống lưu trùng: upsert lặp cùng idempotency_key chỉ tạo 1 bản ghi duy nhất', async () => {
      const key = 'idempotent-test-key-001';

      // Lần lưu 1: chèn hoạt động
      await as(userA, async (tx) => {
        await tx.query(
          `INSERT INTO public.activities (user_id, activity_type, start_at, duration_minutes, is_planned, idempotency_key)
           VALUES ($1, 'calisthenics', now(), 40, false, $2)
           ON CONFLICT (user_id, idempotency_key) DO NOTHING`,
          [USER_A, key]
        );
      });

      // Lần lưu 2: cùng khóa, gửi lại do nhấn đúp hoặc thử lại mạng -> DO NOTHING
      await as(userA, async (tx) => {
        await tx.query(
          `INSERT INTO public.activities (user_id, activity_type, start_at, duration_minutes, is_planned, idempotency_key)
           VALUES ($1, 'calisthenics', now(), 40, false, $2)
           ON CONFLICT (user_id, idempotency_key) DO NOTHING`,
          [USER_A, key]
        );
      });

      // Kiểm tra chỉ có duy nhất 1 bản ghi với key này
      const res = await as(userA, async (tx) => {
        const query = await tx.query(`SELECT COUNT(*)::int AS count FROM public.activities WHERE user_id = $1 AND idempotency_key = $2`, [
          USER_A,
          key,
        ]);
        return (query.rows[0] as Record<string, any>).count as number;
      });
      expect(res).toBe(1);
    });

    it('Quyền sở hữu RLS: User A và User B cách ly hoàn toàn dữ liệu hoạt động', async () => {
      const actAId = await as(userA, async (tx) => {
        const insertRes = await tx.query(
          `INSERT INTO public.activities (user_id, activity_type, start_at, duration_minutes, notes, idempotency_key)
           VALUES ($1, 'running', now(), 35, 'Chạy của A', 'key-a-only')
           RETURNING id`,
          [USER_A]
        );
        return (insertRes.rows[0] as Record<string, any>).id as string;
      });

      // 1. User B query hoạt động của A -> 0 dòng do RLS
      const bRead = await as(userB, async (tx) => {
        const query = await tx.query(`SELECT * FROM public.activities WHERE id = $1`, [actAId]);
        return query.rows;
      });
      expect(bRead).toHaveLength(0);

      // 2. User B cố ý UPDATE hoạt động của A -> 0 dòng bị tác động
      const bUpdate = await as(userB, async (tx) => {
        const updateRes = await tx.query(
          `UPDATE public.activities SET notes = 'Hacked by B' WHERE id = $1`,
          [actAId]
        );
        return updateRes.affectedRows;
      });
      expect(bUpdate).toBe(0);

      // 3. User B cố ý DELETE hoạt động của A -> 0 dòng bị tác động
      const bDelete = await as(userB, async (tx) => {
        const deleteRes = await tx.query(`DELETE FROM public.activities WHERE id = $1`, [actAId]);
        return deleteRes.affectedRows;
      });
      expect(bDelete).toBe(0);

      // User A vẫn đọc được hoạt động nguyên vẹn
      const aRead = await as(userA, async (tx) => {
        const query = await tx.query(`SELECT notes FROM public.activities WHERE id = $1`, [actAId]);
        return (query.rows[0] as Record<string, any>).notes;
      });
      expect(aRead).toBe('Chạy của A');
    });

    it('Sửa và xóa hoạt động: User A cập nhật và xóa thành công bản ghi của mình', async () => {
      const actId = await as(userA, async (tx) => {
        const insertRes = await tx.query(
          `INSERT INTO public.activities (user_id, activity_type, start_at, duration_minutes, is_planned, idempotency_key)
           VALUES ($1, 'badminton', now(), 60, true, 'key-badminton-edit')
           RETURNING id`,
          [USER_A]
        );
        return (insertRes.rows[0] as Record<string, any>).id as string;
      });

      // 1. User A sửa: đổi từ kế hoạch dự kiến sang đã hoàn thành (is_planned: false) và tăng thời lượng
      await as(userA, async (tx) => {
        await tx.query(
          `UPDATE public.activities
           SET duration_minutes = 90,
               is_planned = false,
               notes = 'Đã đánh xong 3 set'
           WHERE id = $1 AND user_id = $2`,
          [actId, USER_A]
        );
      });

      const updated = await as(userA, async (tx) => {
        const q = await tx.query(`SELECT duration_minutes, is_planned, notes FROM public.activities WHERE id = $1`, [actId]);
        return q.rows[0] as Record<string, any>;
      });
      expect(updated.duration_minutes).toBe(90);
      expect(updated.is_planned).toBe(false);
      expect(updated.notes).toBe('Đã đánh xong 3 set');

      // 2. User A xóa hoạt động
      const deletedRows = await as(userA, async (tx) => {
        const del = await tx.query(`DELETE FROM public.activities WHERE id = $1 AND user_id = $2`, [actId, USER_A]);
        return del.affectedRows;
      });
      expect(deletedRows).toBe(1);
    });

    it('Trigger: Sửa hoặc xóa hoạt động tự động đánh dấu review_suggestions liên quan thành outdated', async () => {
      // 1. Tạo hoạt động
      const actId = await as(userA, async (tx) => {
        const res = await tx.query(
          `INSERT INTO public.activities (user_id, activity_type, start_at, duration_minutes, idempotency_key)
           VALUES ($1, 'calisthenics', now(), 50, 'key-for-suggestion-trigger')
           RETURNING id`,
          [USER_A]
        );
        return (res.rows[0] as Record<string, any>).id as string;
      });

      // 2. Tạo gợi ý xem lại lịch tham chiếu đến hoạt động này (status = 'pending')
      const suggId = await as(userA, async (tx) => {
        const res = await tx.query(
          `INSERT INTO public.review_suggestions (user_id, reason, reference_activity_ids, status)
           VALUES ($1, 'Các buổi tập cách nhau dưới 12 giờ', ARRAY[$2::uuid], 'pending')
           RETURNING id`,
          [USER_A, actId]
        );
        return (res.rows[0] as Record<string, any>).id as string;
      });

      // 3. User A sửa hoạt động nguồn (VD: đổi thời lượng)
      await as(userA, async (tx) => {
        await tx.query(`UPDATE public.activities SET duration_minutes = 75 WHERE id = $1`, [actId]);
      });

      // Trigger trg_activities_mark_suggestions_outdated phải tự động chuyển gợi ý sang 'outdated'
      const suggAfterUpdate = await as(userA, async (tx) => {
        const q = await tx.query(`SELECT status FROM public.review_suggestions WHERE id = $1`, [suggId]);
        return (q.rows[0] as Record<string, any>).status;
      });
      expect(suggAfterUpdate).toBe('outdated');

      // 4. Tạo thêm gợi ý thứ hai với status = 'acknowledged'
      const suggId2 = await as(userA, async (tx) => {
        const res = await tx.query(
          `INSERT INTO public.review_suggestions (user_id, reason, reference_activity_ids, status)
           VALUES ($1, 'Gợi ý thứ hai', ARRAY[$2::uuid], 'acknowledged')
           RETURNING id`,
          [USER_A, actId]
        );
        return (res.rows[0] as Record<string, any>).id as string;
      });

      // 5. User A xóa hoạt động nguồn
      await as(userA, async (tx) => {
        await tx.query(`DELETE FROM public.activities WHERE id = $1`, [actId]);
      });

      // Trigger phải chuyển gợi ý thứ hai sang 'outdated'
      const suggAfterDelete = await as(userA, async (tx) => {
        const q = await tx.query(`SELECT status FROM public.review_suggestions WHERE id = $1`, [suggId2]);
        return (q.rows[0] as Record<string, any>).status;
      });
      expect(suggAfterDelete).toBe('outdated');
    });
  });
});
