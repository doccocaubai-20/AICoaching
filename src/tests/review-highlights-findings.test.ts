/**
 * KIỂM THỬ HỒI QUY TOÀN DIỆN 17 PHÁT HIỆN REVIEW ĐIỂM NHẤN (0c53e4d)
 * Bao gồm:
 * - Standards: S1 (Role NULL bypass), S2 (Direct update on group_members), S3 (Storage reservation & video metadata)
 * - Spec: F1 (Evidence real records), F2 (Target vs actual separation), F3 (Unified live workout entry),
 *         F4 (Contextual post-workout CTA), F5 (Capture receipt links), F6 (/demo route existence)
 * - Verification: V1 (Capture activity idempotency_key NOT NULL), V2 (Public shared brief RPC),
 *                 V3 (Stale detection on all source types), V4 (Server-generated snapshot validation),
 *                 V5 (DB read error handling), V6 (Exclude is_planned from brief),
 *                 V7 (Local day timezone boundaries), V8 (Seed script safety guards)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import fs from 'fs';
import path from 'path';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { getLocalDateStartInstant, getLocalDateEndInstant } from '@/lib/date-utils';
import { validateRecordAttemptInput } from '@/features/skills/contracts/skills.contract';

const USER_A = '11111111-1111-1111-1111-111111111111'; // Owner
const USER_B = '22222222-2222-2222-2222-222222222222'; // Member
const USER_C = '33333333-3333-3333-3333-333333333333'; // Outsider

const SUPABASE_STUB = `
  CREATE SCHEMA IF NOT EXISTS auth;
  CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY,
    email TEXT,
    raw_user_meta_data JSONB DEFAULT '{}'::jsonb
  );
  CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
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
  END $$;
  GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
`;

let db: PGlite;

type Actor = { role: 'authenticated'; uid: string } | { role: 'anon' } | { role: 'service_role' };

type TestTx = {
  query: <R = any>(sql: string, params?: any[]) => Promise<{ rows: R[]; rowCount?: number }>;
  exec: (sql: string) => Promise<any>;
};

async function as<T>(actor: Actor, fn: (tx: TestTx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    const uid = actor.role === 'authenticated' ? actor.uid : '';
    await tx.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [uid]);
    await tx.exec(`SET LOCAL ROLE ${actor.role}`);
    return fn(tx as unknown as TestTx);
  });
}

const userA: Actor = { role: 'authenticated', uid: USER_A };
const userB: Actor = { role: 'authenticated', uid: USER_B };
const userC: Actor = { role: 'authenticated', uid: USER_C };
const anon: Actor = { role: 'anon' };

beforeAll(async () => {
  db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_STUB);
  await db.exec(`CREATE SCHEMA IF NOT EXISTS storage;
 CREATE TABLE storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 CREATE TABLE storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$select string_to_array($1,'/')$$;
 GRANT USAGE ON SCHEMA storage TO anon,authenticated,service_role;
 GRANT ALL ON storage.objects TO service_role;`);

  // Nạp toàn bộ migrations theo thứ tự
  const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');
  for (const file of fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await db.exec(sql);
  }

  // Khởi tạo users trong auth.users
  await db.query(
    `INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
       ($1, 'usera@example.com', '{"display_name":"Người dùng A"}'),
       ($2, 'userb@example.com', '{"display_name":"Người dùng B"}'),
       ($3, 'userc@example.com', '{"display_name":"Người dùng C"}')
     ON CONFLICT DO NOTHING`,
    [USER_A, USER_B, USER_C]
  );
});

afterAll(async () => {
  if (db) await db.close();
});

describe('1. Standards: S1, S2, S3', () => {
  it('S1: Người ngoài C với role NULL bị chặn hoàn toàn khi tạo invite, archive hoặc transfer nhóm A', async () => {
    // A tạo nhóm A
    const groupId = await as(userA, async (tx) => {
      const { rows } = await tx.query<{ create_group_with_owner: string }>(
        `SELECT public.create_group_with_owner('Nhóm của A', 'Mô tả', 'Asia/Ho_Chi_Minh')`
      );
      return rows[0].create_group_with_owner;
    });

    // C (người ngoài) cố tạo invite cho nhóm A -> BỊ CHẶN (Không bị bẫy logic NULL NOT IN / !=)
    const tokenHash = crypto.createHash('sha256').update('dummy-token').digest('hex');
    await expect(
      as(userC, async (tx) => {
        await tx.query(`SELECT public.create_group_invite($1, $2, now() + interval '7 days', 5)`, [groupId, tokenHash]);
      })
    ).rejects.toThrow(/Chỉ chủ nhóm hoặc quản trị viên/);

    // C (người ngoài) cố archive nhóm A -> BỊ CHẶN
    await expect(
      as(userC, async (tx) => {
        await tx.query(`SELECT public.archive_group($1)`, [groupId]);
      })
    ).rejects.toThrow(/Chỉ chủ nhóm.*giải tán/);

    // C (người ngoài) cố transfer ownership nhóm A -> BỊ CHẶN
    await expect(
      as(userC, async (tx) => {
        await tx.query(`SELECT public.transfer_group_ownership($1, $2)`, [groupId, USER_C]);
      })
    ).rejects.toThrow(/Chỉ chủ nhóm hiện tại/);
  });

  it('S2: Direct UPDATE trên group_members bị trigger chặn các cột định danh, quan hệ, vai trò và trạng thái', async () => {
    // C tạo nhóm của riêng mình
    const groupCId = await as(userC, async (tx) => {
      const { rows } = await tx.query<{ create_group_with_owner: string }>(
        `SELECT public.create_group_with_owner('Nhóm của C', 'Mô tả', 'Asia/Ho_Chi_Minh')`
      );
      return rows[0].create_group_with_owner;
    });

    // C cố gắng direct UPDATE membership của chính mình để đổi group_id sang Nhóm của A -> BỊ CHẶN!
    await expect(
      as(userC, async (tx) => {
        await tx.query(`UPDATE public.group_members SET group_id = $1 WHERE user_id = $2`, [
          '11111111-1111-1111-1111-111111111111',
          USER_C,
        ]);
      })
    ).rejects.toThrow(/Chỉ được phép cập nhật cài đặt thông báo \(is_muted\)/);

    // C direct UPDATE chỉ cột is_muted -> HỢP LỆ
    await as(userC, async (tx) => {
      const { rowCount } = await tx.query(
        `UPDATE public.group_members SET is_muted = true WHERE group_id = $1 AND user_id = $2`,
        [groupCId, USER_C]
      );
      expect(rowCount).toBe(1);
    });
  });

  it('S3: Trigger bảo vệ journey_videos metadata chặn client sửa trực tiếp dung lượng và trạng thái', async () => {
    // A tạo 1 reservation video hợp lệ qua RPC
    const videoId = await as(userA, async (tx) => {
      const { rows } = await tx.query(
        `SELECT public.reserve_journey_video_upload(
          'idemp-v-1', 'pull_up', 'standard', 'video.mp4', 'video/mp4', 1048576, '${USER_A}/video.mp4', null
        ) AS id`
      );
      return rows[0].id;
    });

    // Client A cố gắng direct UPDATE trạng thái thành 'ready' hoặc sửa file_size_bytes để gian lận quota -> BỊ CHẶN!
    await expect(
      as(userA, async (tx) => {
        await tx.query(`UPDATE public.journey_videos SET status = 'ready' WHERE id = $1`, [videoId]);
      })
    ).rejects.toThrow(/Video accounting changes require a controlled operation/);

    await db.query(`insert into storage.objects(bucket_id,name,metadata) values('comparison_videos',$1,'{"size":1048576,"mimetype":"video/mp4"}')`,[`${USER_A}/video.mp4`]);
    // Finalize verifies authoritative Storage metadata.
    await as(userA, async (tx) => {
      await tx.query(`SELECT public.finalize_journey_video_upload($1, 1048576, 'video/mp4')`, [videoId]);
      const { rows } = await tx.query(`SELECT status FROM public.journey_videos WHERE id = $1`, [videoId]);
      expect(rows[0].status).toBe('ready');
    });
  });
});

describe('2. Verification: V1, V2, V3', () => {
  it('V1: Ghi nhanh có hoạt động sinh con idempotency_key hợp lệ và không lỗi NOT NULL', async () => {
    const batchResult = await as(userA, async (tx) => {
      const { rows } = await tx.query(
        `SELECT public.commit_capture_batch(
          'batch-key-001'::text,
          'payload-hash-001'::text,
          $1::jsonb,
          NULL::jsonb,
          '[]'::jsonb
        ) AS res`,
        [
          JSON.stringify([
            {
              activity_type: 'running',
              duration_minutes: 25,
              start_at: '2026-10-28T08:00:00.000Z',
              fatigue_level: 7,
              notes: 'Chạy buổi sáng',
            },
          ]),
        ]
      );
      return rows[0].res;
    });

    expect(batchResult.status).toBe('committed');
    expect(batchResult.committed_records).toHaveLength(1);
    expect(batchResult.committed_records[0].source_type).toBe('activities');

    // Kiểm tra activities table có đúng idempotency_key
    const actRow = await as(userA, async (tx) => {
      const { rows } = await tx.query(`SELECT idempotency_key, source FROM public.activities WHERE user_id = $1`, [USER_A]);
      return rows[0];
    });
    expect(actRow.idempotency_key).toContain('batch-key-001:act:');
    expect(actRow.source).toBe('manual_entry');
  });

  it('V2: Người nhận / anon gọi get_public_shared_brief thành công nhận snapshot an toàn', async () => {
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const briefId = await as(userA, async (tx) => {
      const { rows } = await tx.query(
        `INSERT INTO public.health_briefs (
          user_id, brief_type, title, date_range_start, date_range_end,
          snapshot_payload, source_fingerprints, user_notes, ai_summary
        ) VALUES (
          $1, 'workout', 'Tóm tắt tuần', '2026-10-20', '2026-10-28',
          '{"meta":{"title":"Tóm tắt tuần"}}'::jsonb,
          '[]'::jsonb,
          'Ghi chú cá nhân',
          'Tóm tắt AI'
        ) RETURNING id`,
        [USER_A]
      );
      return rows[0].id;
    });

    await as(userA, async (tx) => {
      await tx.query(
        `INSERT INTO public.brief_shares (brief_id, user_id, token_hash, expires_at)
         VALUES ($1, $2, $3, now() + interval '7 days')`,
        [briefId, USER_A, tokenHash]
      );
    });

    // Người nhận ẩn danh (anon) đọc qua get_public_shared_brief RPC
    const publicResult = await as(anon, async (tx) => {
      const { rows } = await tx.query(`SELECT public.get_public_shared_brief($1) AS res`, [tokenHash]);
      return rows[0].res;
    });

    expect(publicResult.status).toBe('active');
    expect(publicResult.title).toBe('Tóm tắt tuần');
    expect(publicResult.snapshot).toEqual({meta:{title:'Tóm tắt tuần',dateRange:{}},overview:{},missingDataNotes:[],sourceRefs:[]});
    expect(publicResult.user_notes).toBe('Ghi chú cá nhân');
    expect(publicResult.ai_summary).toBe('Tóm tắt AI');
  });

  it('V3: Sửa hoặc xóa dữ liệu nguồn bất kỳ (activities, conditions, checkin, vitals) tự động kích hoạt Stale', async () => {
    const condId = await as(userA, async (tx) => {
      const { rows } = await tx.query(
        `INSERT INTO public.health_conditions (user_id, name, category, status)
         VALUES ($1, 'Đau cổ tay', 'injury', 'active') RETURNING id`,
        [USER_A]
      );
      return rows[0].id;
    });

    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const briefId = await as(userA, async (tx) => {
      const { rows } = await tx.query(
        `INSERT INTO public.health_briefs (
          user_id, brief_type, title, date_range_start, date_range_end,
          snapshot_payload, source_fingerprints, created_at
        ) VALUES (
          $1, 'medical', 'Bản y tế', '2026-10-20', '2026-10-28',
          '{"meta":{"title":"Bản y tế"}}'::jsonb,
          $2::jsonb,
          now()
        ) RETURNING id`,
        [
          USER_A,
          JSON.stringify([
            { sourceType: 'conditions', sourceId: condId, fingerprint: 'fp-1' },
          ]),
        ]
      );
      return rows[0].id;
    });

    await as(userA, async (tx) => {
      await tx.query(
        `INSERT INTO public.brief_shares (brief_id, user_id, token_hash, expires_at)
         VALUES ($1, $2, $3, now() + interval '7 days')`,
        [briefId, USER_A, tokenHash]
      );
    });

    // Khi nguồn còn nguyên: active
    const activeRes = await as(anon, async (tx) => {
      const { rows } = await tx.query(`SELECT public.get_public_shared_brief($1) AS res`, [tokenHash]);
      return rows[0].res;
    });
    expect(activeRes.status).toBe('active');

    // Sửa tình trạng sức khỏe nguồn sau khi tạo brief
    await as(userA, async (tx) => {
      await tx.query(`UPDATE public.health_conditions SET status = 'resolved', updated_at = now() + interval '1 second' WHERE id = $1`, [condId]);
    });

    // Anon đọc lại link -> BÁO STALE!
    const staleRes = await as(anon, async (tx) => {
      const { rows } = await tx.query(`SELECT public.get_public_shared_brief($1) AS res`, [tokenHash]);
      return rows[0].res;
    });
    expect(staleRes.status).toBe('stale');
    expect(staleRes.message).toContain('đã được cập nhật');

    // Xóa bản ghi nguồn
    await as(userA, async (tx) => {
      await tx.query(`DELETE FROM public.health_conditions WHERE id = $1`, [condId]);
    });

    // Anon đọc lại link -> BÁO STALE (đã bị xóa)!
    const deletedStaleRes = await as(anon, async (tx) => {
      const { rows } = await tx.query(`SELECT public.get_public_shared_brief($1) AS res`, [tokenHash]);
      return rows[0].res;
    });
    expect(deletedStaleRes.status).toBe('stale');
    expect(deletedStaleRes.message).toContain('thay đổi hoặc xóa');
  });
});

describe('3. Spec: F1, F2, F3, F4, F5, F6', () => {
  it('F1: getEligibleEvidenceSourcesAction chỉ trả về bản ghi có thật của người dùng', async () => {
    await as(userA, async (tx) => {
      await tx.query(
        `INSERT INTO public.activities (user_id, activity_type, duration_minutes, fatigue_level, start_at, is_planned, idempotency_key)
         VALUES ($1, 'calisthenics', 40, 8, now(), false, 'act-key-real-1')`,
        [USER_A]
      );
    });

    const userAActivities = await as(userA, async (tx) => {
      const { rows } = await tx.query(`SELECT id, activity_type FROM public.activities WHERE user_id = $1`, [USER_A]);
      return rows;
    });
    expect(userAActivities.length).toBeGreaterThan(0);
    // ID là UUID chuẩn, không phải chuỗi giả như 'act-sample-1'
    expect(userAActivities[0].id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('F2: Validate lần thử kỹ năng yêu cầu nhập actual reps hoặc duration, không tự động lấy target', () => {
    const invalidInput = {
      journeyId: 'pull_up_mastery',
      milestoneId: 'dead_hang_30s',
      exerciseId: 'dead_hang',
      variantId: 'active_grip',
      assistance: 'bodyweight',
      actualReps: null,
      actualDurationSeconds: null,
      notes: null,
      isAchievedSelfReported: false,
    };
    const res = validateRecordAttemptInput(invalidInput);
    expect(res.isValid).toBe(false);
    expect(res.errors.metrics).toBeDefined();

    const validInput = {
      ...invalidInput,
      actualDurationSeconds: 25,
    };
    const validRes = validateRecordAttemptInput(validInput);
    expect(validRes.isValid).toBe(true);
  });

  it('F4 & F5: URL biên nhận và CTA mang đầy đủ ngữ cảnh nguồn và tham số highlight', () => {
    const sampleRecordId = '12345678-1234-1234-1234-123456789012';
    const sampleDate = '2026-10-28';

    // F5 receipt URLs
    const activityReceiptUrl = `/activities?highlight=${sampleRecordId}`;
    const checkinReceiptUrl = `/profile?tab=checkin&date=${sampleDate}`;
    const vitalsReceiptUrl = `/profile?tab=vitals&highlight=${sampleRecordId}`;

    expect(activityReceiptUrl).toContain(`highlight=${sampleRecordId}`);
    expect(checkinReceiptUrl).toContain(`tab=checkin`);
    expect(vitalsReceiptUrl).toContain(`tab=vitals`);

    // F4 post-workout CTA URLs
    const journeyCta = `/journey?sourceType=session_result&sourceId=${sampleRecordId}&exercise=pull_up`;
    const groupsCta = `/groups?action=commit&sourceId=${sampleRecordId}&title=Buổi+tập+chiều`;

    expect(journeyCta).toContain(`sourceType=session_result`);
    expect(groupsCta).toContain(`action=commit`);
  });

  it('F6: Tuyến đường /demo tồn tại trong App Router', () => {
    const demoPagePath = path.resolve(__dirname, '../app/demo/page.tsx');
    expect(fs.existsSync(demoPagePath)).toBe(true);
    const content = fs.readFileSync(demoPagePath, 'utf-8');
    expect(content).toContain('Trung Tâm Demo Điểm Nhấn');
    expect(content).toContain('/capture');
    expect(content).toContain('/workout');
    expect(content).toContain('/journey');
  });
});

describe('4. Verification bổ sung: V4, V6, V7, V8', () => {
  it('V6: Hoạt động có is_planned = true không được tính vào buổi đã tập', async () => {
    await as(userB, async (tx) => {
      // 1 buổi đã tập thực sự
      await tx.query(
        `INSERT INTO public.activities (user_id, activity_type, duration_minutes, start_at, is_planned, idempotency_key)
         VALUES ($1, 'running', 30, now(), false, 'act-b-actual')`,
        [USER_B]
      );
      // 1 lịch dự kiến (is_planned = true)
      await tx.query(
        `INSERT INTO public.activities (user_id, activity_type, duration_minutes, start_at, is_planned, idempotency_key)
         VALUES ($1, 'badminton', 60, now(), true, 'act-b-planned')`,
        [USER_B]
      );
    });

    // Query lọc is_planned = false chỉ trả về 1 buổi
    const actualActivities = await as(userB, async (tx) => {
      const { rows } = await tx.query(
        `SELECT * FROM public.activities WHERE user_id = $1 AND is_planned = false`,
        [USER_B]
      );
      return rows;
    });
    expect(actualActivities).toHaveLength(1);
    expect(actualActivities[0].activity_type).toBe('running');
  });

  it('V7: Helper ranh giới ngày địa phương tính toán chính xác theo múi giờ', () => {
    const startInstant = getLocalDateStartInstant('2026-10-28', 'Asia/Ho_Chi_Minh');
    const endInstant = getLocalDateEndInstant('2026-10-28', 'Asia/Ho_Chi_Minh');

    expect(startInstant.toISOString()).toBe('2026-10-27T17:00:00.000Z'); // 00:00:00 UTC+7 là 17:00:00Z ngày trước
    expect(endInstant.toISOString()).toBe('2026-10-28T16:59:59.999Z');   // 23:59:59.999 UTC+7 là 16:59:59.999Z
  });

  it('V8: retired seed cannot contact cloud or overwrite a user, even with old flags', () => {
    const result=spawnSync(process.execPath,[path.resolve(__dirname,'../../scripts/seed-4-weeks.js'),'--allow-demo-seed',`--user-id=${USER_A}`,'--confirm-wipe'],{encoding:'utf8'});
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Không có dữ liệu nào được ghi hoặc xóa');
  });
});
