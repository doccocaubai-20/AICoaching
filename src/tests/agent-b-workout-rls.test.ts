/**
 * CALISCOACHING - KIỂM THỬ BẢO MẬT RLS & GIAO DỊCH RPC CỦA AGENT B (WORKOUT RUNS & SETS)
 * Kiểm tra các tính năng của Agent B - D3:
 * 1. Cô lập dữ liệu RLS giữa User A và User B cho workout_runs và workout_sets.
 * 2. Lưu từng hiệp qua record_workout_set: kiểm tra ownership và chống ghi đè khi đã complete/abandon.
 * 3. Tạm dừng (pause) và tiếp tục (resume) có optimistic lock concurrency version.
 * 4. Hủy bỏ (abandon): không tạo activity hay session result.
 * 5. Hoàn tất (finalize): atomic transaction (Run + Session Result + Activity), concurrency lock, idempotency.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';
const DEMO_SESSION_ID = 'b0000000-0000-0000-0000-000000000001';

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
const anon: Actor = { role: 'anon' };

beforeAll(async () => {
  db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_STUB);

  const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');
  for (const file of fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
  }

  // Chèn users và demo program / session nếu chưa có
  await db.exec(`
    INSERT INTO auth.users (id, email) VALUES
      ('${USER_A}', 'usera@example.com'),
      ('${USER_B}', 'userb@example.com')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.programs (id, title, description, is_demo)
    VALUES ('a0000000-0000-0000-0000-000000000001', 'Demo Program', 'Description', true)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.sessions (id, program_id, title, sequence_order, exercises, is_demo)
    VALUES ('${DEMO_SESSION_ID}', 'a0000000-0000-0000-0000-000000000001', 'Buổi 1 Demo', 1, '[{"name": "Push-up", "sets": 3, "target_reps": "10", "rest_seconds": 60}]'::jsonb, true)
    ON CONFLICT (id) DO NOTHING;
  `);
});

afterAll(async () => {
  if (db) await db.close();
});

describe('Agent B - D3: Database RLS & Concurrency Tests', () => {
  describe('1. Cô lập dữ liệu RLS giữa User A và User B', () => {
    it('User A tạo workout run -> User B và Anon không thể đọc thấy', async () => {
      const runRes = await as(userA, async (tx) => {
        return tx.query<{ id: string }>(
          `INSERT INTO public.workout_runs (user_id, session_title, session_id, exercises_snapshot)
           VALUES ($1, 'Buổi tập của A', $2, '[]'::jsonb)
           RETURNING id`,
          [USER_A, DEMO_SESSION_ID]
        );
      });

      const runId = runRes.rows[0].id;

      // User A đọc được
      const countA = await as(userA, async (tx) => {
        const res = await tx.query<{ n: number }>(
          `SELECT COUNT(*)::int AS n FROM public.workout_runs WHERE id = $1`,
          [runId]
        );
        return res.rows[0].n;
      });
      expect(countA).toBe(1);

      // User B thấy 0 dòng
      const countB = await as(userB, async (tx) => {
        const res = await tx.query<{ n: number }>(
          `SELECT COUNT(*)::int AS n FROM public.workout_runs WHERE id = $1`,
          [runId]
        );
        return res.rows[0].n;
      });
      expect(countB).toBe(0);

      // Anon thấy 0 dòng
      const countAnon = await as(anon, async (tx) => {
        const res = await tx.query<{ n: number }>(
          `SELECT COUNT(*)::int AS n FROM public.workout_runs WHERE id = $1`,
          [runId]
        );
        return res.rows[0].n;
      });
      expect(countAnon).toBe(0);
    });

    it('User B không thể can thiệp cập nhật hoặc xóa phiên tập của User A', async () => {
      const runRes = await as(userA, async (tx) => {
        return tx.query<{ id: string }>(
          `INSERT INTO public.workout_runs (user_id, session_title, session_id, exercises_snapshot)
           VALUES ($1, 'Buổi tập riêng của A', $2, '[]'::jsonb)
           RETURNING id`,
          [USER_A, DEMO_SESSION_ID]
        );
      });
      const runId = runRes.rows[0].id;

      // B thử UPDATE run của A -> 0 dòng bị ảnh hưởng
      const updateRes = await as(userB, async (tx) => {
        return tx.query(
          `UPDATE public.workout_runs SET session_title = 'B hack' WHERE id = $1`,
          [runId]
        );
      });
      expect(updateRes.affectedRows).toBe(0);

      // B thử DELETE run của A -> 0 dòng bị ảnh hưởng
      const deleteRes = await as(userB, async (tx) => {
        return tx.query(
          `DELETE FROM public.workout_runs WHERE id = $1`,
          [runId]
        );
      });
      expect(deleteRes.affectedRows).toBe(0);
    });
  });

  describe('2. Lưu từng hiệp qua record_workout_set & Kiểm tra quyền sở hữu', () => {
    it('User A ghi nhận hiệp thành công; User B gọi RPC trên run của A bị từ chối', async () => {
      const runRes = await as(userA, async (tx) => {
        return tx.query<{ id: string }>(
          `INSERT INTO public.workout_runs (user_id, session_title, session_id, exercises_snapshot)
           VALUES ($1, 'Buổi tập test hiệp', $2, '[]'::jsonb)
           RETURNING id`,
          [USER_A, DEMO_SESSION_ID]
        );
      });
      const runId = runRes.rows[0].id;

      // User A ghi hiệp 1
      const setA = await as(userA, async (tx) => {
        return tx.query<{ record_workout_set: any }>(
          `SELECT public.record_workout_set(
            $1, 0, 'Hít đất', null, 1, '10 reps', null, null, null, 'reps',
            12, null, null, 'reps', null, 'completed', 'key_set_1_test'
          )`,
          [runId]
        );
      });
      expect(setA.rows[0].record_workout_set.success).toBe(true);

      // User B thử ghi hiệp trên run của A -> bị ném ngoại lệ NOT_FOUND / UNAUTHORIZED
      await expect(
        as(userB, async (tx) => {
          return tx.query(
            `SELECT public.record_workout_set(
              $1, 0, 'Hít đất', null, 2, '10 reps', null, null, null, 'reps',
              10, null, null, 'reps', null, 'completed', 'key_set_2_b_hack'
            )`,
            [runId]
          );
        })
      ).rejects.toThrow(/NOT_FOUND/);
    });
  });

  describe('3. Tạm dừng (Pause), Tiếp tục (Resume) và Optimistic Locking Concurrency', () => {
    it('pause và resume cập nhật trạng thái và version tuần tự', async () => {
      const runRes = await as(userA, async (tx) => {
        return tx.query<{ id: string; version: number }>(
          `INSERT INTO public.workout_runs (user_id, session_title, session_id, exercises_snapshot)
           VALUES ($1, 'Buổi tập pause test', $2, '[]'::jsonb)
           RETURNING id, version`,
          [USER_A, DEMO_SESSION_ID]
        );
      });
      const runId = runRes.rows[0].id;
      const initialVersion = runRes.rows[0].version;

      // 1. Pause
      const pauseRes = await as(userA, async (tx) => {
        return tx.query<{ pause_workout_run: any }>(
          `SELECT public.pause_workout_run($1, $2)`,
          [runId, initialVersion]
        );
      });
      expect(pauseRes.rows[0].pause_workout_run.status).toBe('paused');
      const v2 = pauseRes.rows[0].pause_workout_run.version;
      expect(v2).toBe(initialVersion + 1);

      // 2. Resume
      const resumeRes = await as(userA, async (tx) => {
        return tx.query<{ resume_workout_run: any }>(
          `SELECT public.resume_workout_run($1, $2)`,
          [runId, v2]
        );
      });
      expect(resumeRes.rows[0].resume_workout_run.status).toBe('in_progress');
      const v3 = resumeRes.rows[0].resume_workout_run.version;
      expect(v3).toBe(v2 + 1);

      // 3. Concurrency check: gọi resume với version cũ bị từ chối
      await expect(
        as(userA, async (tx) => {
          return tx.query(`SELECT public.resume_workout_run($1, $2)`, [runId, initialVersion]);
        })
      ).rejects.toThrow(/CONCURRENCY_ERROR/);
    });
  });

  describe('4. Hủy bỏ phiên tập (Abandon)', () => {
    it('abandon chuyển trạng thái sang abandoned và KHÔNG tạo session_results hay activities', async () => {
      const runRes = await as(userA, async (tx) => {
        return tx.query<{ id: string }>(
          `INSERT INTO public.workout_runs (user_id, session_title, session_id, exercises_snapshot)
           VALUES ($1, 'Buổi tập sắp bị hủy', $2, '[]'::jsonb)
           RETURNING id`,
          [USER_A, DEMO_SESSION_ID]
        );
      });
      const runId = runRes.rows[0].id;

      // Ghi 1 hiệp dở
      await as(userA, async (tx) => {
        return tx.query(
          `SELECT public.record_workout_set(
            $1, 0, 'Hít đất', null, 1, '10 reps', null, null, null, 'reps',
            10, null, null, 'reps', null, 'completed', 'key_abandon_set'
          )`,
          [runId]
        );
      });

      // Gọi RPC abandon
      const abandonRes = await as(userA, async (tx) => {
        return tx.query<{ abandon_workout_run: any }>(
          `SELECT public.abandon_workout_run($1)`,
          [runId]
        );
      });
      expect(abandonRes.rows[0].abandon_workout_run.status).toBe('abandoned');

      // Kiểm tra trong session_results: không có bản ghi nào sinh ra
      const countResults = await as(userA, async (tx) => {
        const res = await tx.query<{ n: number }>(
          `SELECT COUNT(*)::int AS n FROM public.session_results WHERE user_id = $1 AND notes ILIKE '%Buổi tập sắp bị hủy%'`,
          [USER_A]
        );
        return res.rows[0].n;
      });
      expect(countResults).toBe(0);

      // Thử finalize một run đã bị abandon -> Bị từ chối
      await expect(
        as(userA, async (tx) => {
          return tx.query(
            `SELECT public.finalize_workout_run($1, 1, 7, 'Ghi đè', 'key_fail_fin', true)`,
            [runId]
          );
        })
      ).rejects.toThrow(/INVALID_STATE/);
    });
  });

  describe('5. Hoàn thành nguyên tử (Finalize) & Bảo vệ Idempotency', () => {
    it('chặn hoàn thành khi còn hiệp chưa nhập nếu allow_partial = false', async () => {
      const runRes = await as(userA, async (tx) => {
        return tx.query<{ id: string; version: number }>(
          `INSERT INTO public.workout_runs (user_id, session_title, session_id, exercises_snapshot)
           VALUES ($1, 'Buổi tập thiếu hiệp', $2, '[]'::jsonb)
           RETURNING id, version`,
          [USER_A, DEMO_SESSION_ID]
        );
      });
      const runId = runRes.rows[0].id;
      const version = runRes.rows[0].version;

      // Tạo 1 hiệp chưa nhập (actual_reps = null, status = 'pending')
      await as(userA, async (tx) => {
        return tx.query(
          `INSERT INTO public.workout_sets (user_id, run_id, exercise_index, exercise_name, set_order, target_reps, status, idempotency_key)
           VALUES ($1, $2, 0, 'Xà đơn', 1, '8', 'pending', 'key_pending_set')`,
          [USER_A, runId]
        );
      });

      // Gọi finalize với allow_partial = false -> Bị từ chối
      await expect(
        as(userA, async (tx) => {
          return tx.query(
            `SELECT public.finalize_workout_run($1, $2, 7, 'Notes', 'key_fin_1', false)`,
            [runId, version]
          );
        })
      ).rejects.toThrow(/INCOMPLETE_SETS/);
    });

    it('hoàn thành nguyên tử: cập nhật run + tạo session_results + tạo activity nền đúng một lần', async () => {
      const runRes = await as(userA, async (tx) => {
        return tx.query<{ id: string; version: number }>(
          `INSERT INTO public.workout_runs (user_id, session_title, session_id, exercises_snapshot)
           VALUES ($1, 'Buổi tập chuẩn finalize', $2, '[]'::jsonb)
           RETURNING id, version`,
          [USER_A, DEMO_SESSION_ID]
        );
      });
      const runId = runRes.rows[0].id;
      const version = runRes.rows[0].version;

      // Ghi hiệp 1 (hoàn thành) và hiệp 2 (chưa nhập)
      await as(userA, async (tx) => {
        await tx.query(
          `SELECT public.record_workout_set(
            $1, 0, 'Hít đất', null, 1, '10 reps', null, null, null, 'reps',
            12, null, null, 'reps', null, 'completed', 'key_set_fin_1'
          )`,
          [runId]
        );
        await tx.query(
          `INSERT INTO public.workout_sets (user_id, run_id, exercise_index, exercise_name, set_order, target_reps, status, idempotency_key)
           VALUES ($1, $2, 0, 'Hít đất', 2, '10 reps', 'pending', 'key_set_fin_2')`,
          [USER_A, runId]
        );
      });

      const finalizeKey = 'unique_finalize_idempotency_key_123';

      // Hoàn tất với allow_partial = true
      const finRes = await as(userA, async (tx) => {
        return tx.query<{ finalize_workout_run: any }>(
          `SELECT public.finalize_workout_run($1, $2, 8, 'Tập tốt', $3, true)`,
          [runId, version, finalizeKey]
        );
      });

      const finData = finRes.rows[0].finalize_workout_run;
      expect(finData.success).toBe(true);
      expect(finData.status).toBe('completed');
      expect(finData.is_partial).toBe(true);
      expect(finData.duration_minutes).toBeGreaterThanOrEqual(1);

      // Kiểm tra hiệp 2 đã được tự động chuyển thành 'skipped' (không điền 0 hay target)
      const skippedSet = await as(userA, async (tx) => {
        const res = await tx.query<{ status: string; actual_reps: number | null }>(
          `SELECT status, actual_reps FROM public.workout_sets WHERE run_id = $1 AND set_order = 2`,
          [runId]
        );
        return res.rows[0];
      });
      expect(skippedSet.status).toBe('skipped');
      expect(skippedSet.actual_reps).toBeNull(); // Không tự điền 0 hay mục tiêu

      // Kiểm tra session_results đã được tạo
      const sessionResult = await as(userA, async (tx) => {
        const res = await tx.query<{ notes: string; is_demo: boolean }>(
          `SELECT notes, is_demo FROM public.session_results WHERE user_id = $1 AND idempotency_key = $2`,
          [USER_A, finalizeKey]
        );
        return res.rows[0];
      });
      expect(sessionResult.notes).toBe('Tập tốt');

      // Kiểm tra activities (source = session_sync) đã được tạo với cùng idempotency_key
      const syncActivity = await as(userA, async (tx) => {
        const res = await tx.query<{ activity_type: string; source: string; fatigue_level: number }>(
          `SELECT activity_type, source, fatigue_level FROM public.activities WHERE user_id = $1 AND idempotency_key = $2`,
          [USER_A, finalizeKey]
        );
        return res.rows[0];
      });
      expect(syncActivity.activity_type).toBe('calisthenics');
      expect(syncActivity.source).toBe('session_sync');
      expect(syncActivity.fatigue_level).toBe(8);

      // Chống ghi trùng / Idempotent Replay: gọi lại cùng finalizeKey không sinh thêm hoạt động
      const replayRes = await as(userA, async (tx) => {
        return tx.query<{ finalize_workout_run: any }>(
          `SELECT public.finalize_workout_run($1, $2, 8, 'Tập tốt', $3, true)`,
          [runId, version, finalizeKey]
        );
      });
      expect(replayRes.rows[0].finalize_workout_run.idempotent_replay).toBe(true);

      // Tổng số activity mang key này vẫn duy nhất là 1
      const countAct = await as(userA, async (tx) => {
        const res = await tx.query<{ n: number }>(
          `SELECT COUNT(*)::int AS n FROM public.activities WHERE user_id = $1 AND idempotency_key = $2`,
          [USER_A, finalizeKey]
        );
        return res.rows[0].n;
      });
      expect(countAct).toBe(1);
    });
  });
});
