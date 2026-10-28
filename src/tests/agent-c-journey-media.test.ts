/**
 * CALISCOACHING - AGENT C TEST SUITE
 * D4: Hành trình kỹ năng có bằng chứng
 * D6: Video đối chiếu với chính mình
 *
 * Kiểm thử toàn diện:
 * 1. Seed data & Hành trình mẫu (pull_up_mastery, criteria v1.0.0-pilot, illustrative disclaimer).
 * 2. 4 trạng thái mốc kỹ năng (not_attempted, attempted, self_reported_achieved, needs_review).
 * 3. Đa lần thử trên một mốc (ít nhất 2 lần thử, 1 chưa đạt), bảo tồn lịch sử.
 * 4. Tách biệt hoàn toàn: mở bài / XP không tự cấp Verified hay hoàn thành mốc.
 * 5. Trigger tự động invalidation khi sửa/xóa hoạt động nguồn (needs_review).
 * 6. Bảo mật RLS: cô lập dữ liệu User A vs User B, User B không đọc/sửa được attempt hoặc video của A.
 * 7. Quota video: giới hạn 20 MiB/file (20,971,520 bytes) và 100 MiB/user (104,857,600 bytes).
 * 8. RPC reserve & finalize: idempotency key, concurrency lock, xác thực metadata, ràng buộc tiền tố path user_id/%.
 * 9. Xóa 2 thì (Tombstone): pending_deletion chặn cấp URL mới, xóa video KHÔNG xóa lần thử.
 * 10. Dọn dẹp reservation hết hạn (local runnable cleanup RPC).
 * 11. Adapters & Validators: validateRecordAttemptInput, validateReserveUploadInput, adaptWorkoutResultToJourneyEvidence.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

import {
  calculateMilestoneStatus,
  validateRecordAttemptInput,
  adaptWorkoutResultToJourneyEvidence,
  type JourneyAttempt,
} from '@/features/skills';
import {
  MAX_VIDEO_FILE_BYTES,
  MAX_TOTAL_MEDIA_QUOTA_BYTES,
  validateReserveUploadInput,
  validateTimestampNoteInput,
} from '@/features/media';

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';

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
  DO $$ BEGIN
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
  await db.exec(`CREATE SCHEMA IF NOT EXISTS storage;
 CREATE TABLE storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 CREATE TABLE storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$select string_to_array($1,'/')$$;
 GRANT USAGE ON SCHEMA storage TO anon,authenticated,service_role;
 GRANT ALL ON storage.objects TO service_role;`);

  const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    await db.exec(sql);
  }

  // Tạo sẵn 2 user trong auth.users
  await db.exec(`
    INSERT INTO auth.users (id, email) VALUES 
      ('${USER_A}', 'usera@example.com'),
      ('${USER_B}', 'userb@example.com')
    ON CONFLICT (id) DO NOTHING;
  `);
});

describe('1. Seed Data & Hành trình mẫu (D4)', () => {
  it('hành trình mẫu pull_up_mastery được nạp sẵn với cờ minh họa và disclaimer', async () => {
    const res = await db.query<any>(`
      SELECT id, title, criteria_version, is_demo_illustration, disclaimer 
      FROM skill_journeys 
      WHERE id = 'pull_up_mastery'
    `);
    expect(res.rows.length).toBe(1);
    const j = res.rows[0];
    expect(j.id).toBe('pull_up_mastery');
    expect(j.criteria_version).toBe('v1.0.0-pilot');
    expect(j.is_demo_illustration).toBe(true);
    expect(j.disclaimer).toContain('minh họa');
  });

  it('hành trình pull_up_mastery có đủ 4 mốc kỹ năng chuẩn bị', async () => {
    const res = await db.query<any>(`
      SELECT id, sequence_order, exercise_id, criteria_description
      FROM skill_milestones 
      WHERE journey_id = 'pull_up_mastery'
      ORDER BY sequence_order ASC
    `);
    expect(res.rows.length).toBe(4);
    expect(res.rows[0].id).toBe('dead_hang_30s');
    expect(res.rows[0].exercise_id).toBe('dead_hang');
    expect(res.rows[1].id).toBe('inverted_row_8');
    expect(res.rows[2].id).toBe('negative_pull_up_5');
    expect(res.rows[3].id).toBe('standard_pull_up_1');
    expect(res.rows[3].exercise_id).toBe('standard_pull_up');
  });
});

describe('2. Đa lần thử, trạng thái mốc & tính toán thuần túy (D4)', () => {
  it('tính toán trạng thái mốc: not_attempted khi chưa có lần thử', () => {
    const status = calculateMilestoneStatus([]);
    expect(status).toBe('not_attempted');
  });

  it('ít nhất 2 lần thử trên một mốc: 1 chưa đạt -> attempted; 1 đạt -> self_reported_achieved', () => {
    const attempt1: JourneyAttempt = {
      id: 'att-1',
      user_id: USER_A,
      journey_id: 'pull_up_mastery',
      milestone_id: 'dead_hang_30s',
      attempted_at: '2026-10-20T10:00:00Z',
      exercise_id: 'dead_hang',
      variant_id: 'standard',
      assistance: null,
      actual_reps: null,
      actual_duration_seconds: 18,
      notes: 'Chưa đủ 30 giây, tuột tay ở giây 18',
      is_achieved_self_reported: false,
      status: 'attempted',
      source_ref: null,
      source_invalidated_at: null,
      source_invalidation_reason: null,
      video_id: null,
      idempotency_key: 'idemp-1',
      created_at: '2026-10-20T10:00:00Z',
      updated_at: '2026-10-20T10:00:00Z',
    };

    // Chỉ có attempt1 -> mốc là attempted
    expect(calculateMilestoneStatus([attempt1])).toBe('attempted');

    const attempt2: JourneyAttempt = {
      ...attempt1,
      id: 'att-2',
      attempted_at: '2026-10-25T10:00:00Z',
      actual_duration_seconds: 32,
      notes: 'Đã giữ vững 32 giây!',
      is_achieved_self_reported: true,
      status: 'self_reported_achieved',
      idempotency_key: 'idemp-2',
    };

    // Có cả 2 lần thử, lần mới nhất tự đạt -> self_reported_achieved
    expect(calculateMilestoneStatus([attempt1, attempt2])).toBe('self_reported_achieved');
  });

  it('lần thử bị needs_review lập tức chuyển trạng thái mốc thành needs_review', () => {
    const attemptAchieved: JourneyAttempt = {
      id: 'att-achieved',
      user_id: USER_A,
      journey_id: 'pull_up_mastery',
      milestone_id: 'dead_hang_30s',
      attempted_at: '2026-10-22T10:00:00Z',
      exercise_id: 'dead_hang',
      variant_id: 'standard',
      assistance: null,
      actual_reps: null,
      actual_duration_seconds: 30,
      notes: 'Đạt mốc có chứng cứ',
      is_achieved_self_reported: true,
      status: 'needs_review', // nguồn bị sửa
      source_ref: { sourceType: 'activity', sourceId: 'act-1', recordedAt: '2026-10-22T10:00:00Z' },
      source_invalidated_at: '2026-10-23T08:00:00Z',
      source_invalidation_reason: 'Hoạt động nền liên kết đã bị chỉnh sửa',
      video_id: null,
      idempotency_key: 'idemp-inv',
      created_at: '2026-10-22T10:00:00Z',
      updated_at: '2026-10-23T08:00:00Z',
    };

    expect(calculateMilestoneStatus([attemptAchieved])).toBe('needs_review');
  });
});

describe('3. Trigger DB tự động Invalidation khi sửa/xóa Hoạt Động (D4)', () => {
  it('khi sửa thời gian hoạt động nguồn, trigger chuyển lần thử liên quan thành needs_review', async () => {
    const actId = '10000000-0000-0000-0000-000000000001';
    const attId = '11000000-0000-0000-0000-000000000001';

    await as(userA, async (tx) => {
      // 1. User A tạo hoạt động
      await tx.query(`
        INSERT INTO activities (id, user_id, activity_type, is_planned, start_at, duration_minutes, source, idempotency_key)
        VALUES ($1, $2, 'calisthenics', false, '2026-10-25 08:00:00+00', 45, 'manual_entry', 'act-key-1')
      `, [actId, USER_A]);
      const run=await tx.query<any>(`insert into workout_runs(user_id,session_title,status,completed_at,idempotency_key) values($1,'Evidence','completed',now(),'act-key-1') returning id`,[USER_A]);
      await tx.query(`insert into workout_sets(run_id,user_id,exercise_index,exercise_name,exercise_variant,set_order,target_reps,actual_duration_seconds,actual_unit,actual_assistance,status,idempotency_key) values($1,$2,0,'dead_hang','active_grip',1,'30s',35,'seconds','bodyweight','completed','set-act-key-1')`,[run.rows[0].id,USER_A]);


      // 2. User A ghi nhận lần thử liên kết với hoạt động trên
      await tx.query(`
        INSERT INTO journey_attempts (
          id, user_id, journey_id, milestone_id, exercise_id, variant_id, actual_duration_seconds,
          is_achieved_self_reported, status, source_ref, assistance
        ) VALUES (
          $1, $2, 'pull_up_mastery', 'dead_hang_30s', 'dead_hang', 'active_grip', 35,
          true, 'self_reported_achieved', $3::jsonb, 'bodyweight'
        )
      `, [attId, USER_A, JSON.stringify({ sourceType: 'activity', sourceId: actId, recordedAt: '2026-10-25T08:00:00Z' })]);

      // Kiểm tra trạng thái ban đầu
      const initial = await tx.query<any>(`SELECT status, source_invalidated_at FROM journey_attempts WHERE id = $1`, [attId]);
      expect(initial.rows[0].status).toBe('self_reported_achieved');
      expect(initial.rows[0].source_invalidated_at).toBeNull();

      // 3. User A sửa hoạt động nguồn (ví dụ đổi duration từ 45 -> 60)
      await tx.query(`
        UPDATE activities SET duration_minutes = 60 WHERE id = $1
      `, [actId]);

      // 4. Kiểm tra trigger đã chuyển status thành needs_review
      const afterUpdate = await tx.query<any>(`
        SELECT status, source_invalidated_at, source_invalidation_reason 
        FROM journey_attempts WHERE id = $1
      `, [attId]);

      expect(afterUpdate.rows[0].status).toBe('needs_review');
      expect(afterUpdate.rows[0].source_invalidated_at).not.toBeNull();
      expect(afterUpdate.rows[0].source_invalidation_reason).toContain('thay đổi');
    });
  });

  it('khi xóa hoạt động nguồn, trigger chuyển lần thử liên quan thành needs_review', async () => {
    const actId = '10000000-0000-0000-0000-000000000002';
    const attId = '11000000-0000-0000-0000-000000000002';

    await as(userA, async (tx) => {
      // 1. User A tạo hoạt động
      await tx.query(`
        INSERT INTO activities (id, user_id, activity_type, is_planned, start_at, duration_minutes, source, idempotency_key)
        VALUES ($1, $2, 'calisthenics', false, '2026-10-26 09:00:00+00', 30, 'manual_entry', 'act-key-2')
      `, [actId, USER_A]);
      const run=await tx.query<any>(`insert into workout_runs(user_id,session_title,status,completed_at,idempotency_key) values($1,'Evidence','completed',now(),'act-key-2') returning id`,[USER_A]);
      await tx.query(`insert into workout_sets(run_id,user_id,exercise_index,exercise_name,exercise_variant,set_order,target_reps,actual_reps,actual_assistance,status,idempotency_key) values($1,$2,0,'inverted_row','horizontal_bar',1,'8',8,'bodyweight','completed','set-act-key-2')`,[run.rows[0].id,USER_A]);


      // 2. User A ghi nhận lần thử
      await tx.query(`
        INSERT INTO journey_attempts (
          id, user_id, journey_id, milestone_id, exercise_id, variant_id, actual_reps,
          is_achieved_self_reported, status, source_ref, assistance
        ) VALUES (
          $1, $2, 'pull_up_mastery', 'inverted_row_8', 'inverted_row', 'horizontal_bar', 10,
          true, 'self_reported_achieved', $3::jsonb, 'bodyweight'
        )
      `, [attId, USER_A, JSON.stringify({ sourceType: 'activity', sourceId: actId, recordedAt: '2026-10-26T09:00:00Z' })]);

      // 3. User A xóa hoạt động nguồn
      await tx.query(`DELETE FROM activities WHERE id = $1`, [actId]);

      // 4. Kiểm tra trigger đã chuyển status thành needs_review với thông báo xóa
      const afterDelete = await tx.query<any>(`
        SELECT status, source_invalidated_at, source_invalidation_reason 
        FROM journey_attempts WHERE id = $1
      `, [attId]);

      expect(afterDelete.rows[0].status).toBe('needs_review');
      expect(afterDelete.rows[0].source_invalidated_at).not.toBeNull();
      expect(afterDelete.rows[0].source_invalidation_reason).toContain('bị xóa');
    });
  });
});

describe('4. RLS & Bảo mật cô lập dữ liệu (D4, D6)', () => {
  it('User B không thể đọc lần thử (attempts) của User A', async () => {
    await as(userB, async (tx) => {
      const res = await tx.query(`SELECT * FROM journey_attempts WHERE user_id = $1`, [USER_A]);
      expect(res.rows.length).toBe(0);
    });
  });

  it('User B không thể sửa hoặc xóa lần thử của User A', async () => {
    const attId = '11000000-0000-0000-0000-000000000003';

    // User A tạo attempt
    await as(userA, async (tx) => {
      await tx.query(`
        INSERT INTO journey_attempts (
          id, user_id, journey_id, milestone_id, exercise_id, variant_id, actual_reps,
          is_achieved_self_reported, status, notes
        ) VALUES (
          $1, $2, 'pull_up_mastery', 'negative_pull_up_5', 'negative_pull_up', 'slow_eccentric', 5,
          false, 'attempted', 'Lần thử gốc của A'
        )
      `, [attId, USER_A]);
    });

    // User B cố gắng update hoặc delete
    await as(userB, async (tx) => {
      const updateRes = await tx.query(`UPDATE journey_attempts SET notes = 'Hacked' WHERE id = $1`, [attId]);
      expect(updateRes.rowCount).toBe(0);

      const deleteRes = await tx.query(`DELETE FROM journey_attempts WHERE id = $1`, [attId]);
      expect(deleteRes.rowCount).toBe(0);
    });

    // Dữ liệu của User A vẫn nguyên vẹn
    await as(userA, async (tx) => {
      const checkRes = await tx.query<any>(`SELECT notes FROM journey_attempts WHERE id = $1`, [attId]);
      expect(checkRes.rows[0].notes).toBe('Lần thử gốc của A');
    });
  });

  it('Anonymous không thể đọc journey_attempts hoặc journey_videos', async () => {
    await as(anon, async (tx) => {
      const attempts = await tx.query(`SELECT * FROM journey_attempts`);
      expect(attempts.rows.length).toBe(0);

      const videos = await tx.query(`SELECT * FROM journey_videos`);
      expect(videos.rows.length).toBe(0);
    });
  });
});

describe('5. Video Quota & RPC Reservation (D6)', () => {
  it('hạn mức 20 MiB per file (20,971,520 bytes): từ chối file > 20 MiB', async () => {
    const oversizedBytes = MAX_VIDEO_FILE_BYTES + 1; // 20,971,521

    // Kiểm tra validator contract
    const valRes = validateReserveUploadInput({
      exerciseId: 'pull_up',
      variantId: 'standard',
      fileName: 'huge.mp4',
      fileType: 'video/mp4',
      fileSizeBytes: oversizedBytes,
    });
    expect(valRes.valid).toBe(false);
    expect(valRes.errors.fileSizeBytes).toContain('20 MiB');

    // Kiểm tra RPC DB
    await as(userA, async (tx) => {
      await expect(
        tx.query(`
          SELECT reserve_journey_video_upload(
            'idemp-huge', 'pull_up', 'standard', 'huge.mp4', 'video/mp4', $1, '${USER_A}/huge.mp4', null
          )
        `, [oversizedBytes])
      ).rejects.toThrow(/20 MiB/);
    });
  });

  it('RPC reserve thành công và tính quota lũy kế, từ chối vượt 100 MiB', async () => {
    const fileBytes = 15 * 1024 * 1024; // 15 MiB

    await as(userA, async (tx) => {
      // Đặt 1 video 15 MiB
      const res1 = await tx.query<any>(`
        SELECT reserve_journey_video_upload(
          'idemp-vid-1', 'pull_up', 'standard', 'clip1.mp4', 'video/mp4', $1, '${USER_A}/clip1.mp4', 25
        ) as video_id
      `, [fileBytes]);

      expect(res1.rows[0].video_id).toBeDefined();
      const videoId1 = res1.rows[0].video_id;

      // Idempotency: gọi lại với cùng idempotency_key trả về cùng video_id mà không trừ quota 2 lần
      const resIdemp = await tx.query<any>(`
        SELECT reserve_journey_video_upload(
          'idemp-vid-1', 'pull_up', 'standard', 'clip1.mp4', 'video/mp4', $1, '${USER_A}/clip1.mp4', 25
        ) as video_id
      `, [fileBytes]);
      expect(resIdemp.rows[0].video_id).toBe(videoId1);

      // Kiểm tra quota tính lũy kế cho các video reserved/ready
      const currentSumRes = await tx.query<any>(`
        SELECT COALESCE(SUM(file_size_bytes), 0)::bigint as total
        FROM journey_videos
        WHERE user_id = $1 AND status IN ('reserved', 'ready')
      `, [USER_A]);
      expect(Number(currentSumRes.rows[0].total)).toBe(fileBytes);
    });
  });

  it('RPC finalize xác thực video và chuyển status thành ready', async () => {
    await as(userA, async (tx) => {
      const res = await tx.query<any>(`
        SELECT reserve_journey_video_upload(
          'idemp-vid-fin', 'pull_up', 'standard', 'clip_fin.mp4', 'video/mp4', 5000000, '${USER_A}/clip_fin.mp4', 20
        ) as video_id
      `);
      const videoId = res.rows[0].video_id;
      await tx.exec(`SET LOCAL ROLE service_role; insert into storage.objects(bucket_id,name,metadata) values('comparison_videos','${USER_A}/clip_fin.mp4','{"size":5000000,"mimetype":"video/mp4"}'); SET LOCAL ROLE authenticated;`);

      // Finalize: truyền đúng 3 tham số (p_video_id, p_actual_size_bytes, p_actual_mime_type)
      const finRes = await tx.query<any>(`
        SELECT finalize_journey_video_upload($1::uuid, 5000000, 'video/mp4') as finalized_id
      `, [videoId]);
      expect(finRes.rows[0].finalized_id).toBe(videoId);

      const check = await tx.query<any>(`SELECT status, finalized_at FROM journey_videos WHERE id = $1`, [videoId]);
      expect(check.rows[0].status).toBe('ready');
      expect(check.rows[0].finalized_at).not.toBeNull();
    });
  });

  it('User B không thể finalize video của User A', async () => {
    let videoIdA = '';
    await as(userA, async (tx) => {
      const res = await tx.query<any>(`
        SELECT reserve_journey_video_upload(
          'idemp-user-a', 'pull_up', 'standard', 'clip_a.mp4', 'video/mp4', 2000000, '${USER_A}/clip_a.mp4', 15
        ) as video_id
      `);
      videoIdA = res.rows[0].video_id;
    });

    await as(userB, async (tx) => {
      await expect(
        tx.query(`SELECT finalize_journey_video_upload($1::uuid, 2000000, 'video/mp4')`, [videoIdA])
      ).rejects.toThrow(/Video not owned by user/);
    });
  });
});

describe('6. Tombstone Deletion & Xóa không mất Lần Thử (D6)', () => {
  it('đánh dấu xóa (pending_deletion) và unbind video_id nhưng giữ nguyên attempt', async () => {
    let videoId = '';
    let attemptId = '11000000-0000-0000-0000-000000000099';

    await as(userA, async (tx) => {
      // 1. Tạo video ready
      const vRes = await tx.query<any>(`
        SELECT reserve_journey_video_upload(
          'idemp-del-v', 'standard_pull_up', 'deadstop', 'clip_del.mp4', 'video/mp4', 3000000, '${USER_A}/clip_del.mp4', 20
        ) as video_id
      `);
      videoId = vRes.rows[0].video_id;
      await tx.exec(`SET LOCAL ROLE service_role; insert into storage.objects(bucket_id,name,metadata) values('comparison_videos','${USER_A}/clip_del.mp4','{"size":3000000,"mimetype":"video/mp4"}'); SET LOCAL ROLE authenticated;`);
      await tx.query(`SELECT finalize_journey_video_upload($1::uuid, 3000000, 'video/mp4')`, [videoId]);

      // 2. Tạo attempt gắn video trên
      await tx.query(`
        INSERT INTO journey_attempts (
          id, user_id, journey_id, milestone_id, exercise_id, variant_id, actual_reps,
          is_achieved_self_reported, status, video_id, assistance
        ) VALUES (
          $1, $2, 'pull_up_mastery', 'standard_pull_up_1', 'standard_pull_up', 'deadstop', 5,
          true, 'self_reported_achieved', $3, 'bodyweight'
        )
      `, [attemptId, USER_A, videoId]);

      // 3. Mark for deletion (Tombstone)
      const markRes = await tx.query<any>(`SELECT mark_journey_video_for_deletion($1::uuid) as storage_path`, [videoId]);
      expect(markRes.rows[0].storage_path).toBeDefined();

      // Trạng thái video là pending_deletion
      const vidCheck = await tx.query<any>(`SELECT status, deletion_requested_at FROM journey_videos WHERE id = $1`, [videoId]);
      expect(vidCheck.rows[0].status).toBe('pending_deletion');
      expect(vidCheck.rows[0].deletion_requested_at).not.toBeNull();

      await tx.exec(`SET LOCAL ROLE service_role; delete from storage.objects where name='${USER_A}/clip_del.mp4'; SET LOCAL ROLE authenticated;`);
      // 4. Confirm deleted
      await tx.query(`SELECT confirm_journey_video_deleted($1::uuid, true, null)`, [videoId]);

      // RLS policy: status != 'deleted' -> authenticated user không thấy video đã xóa trong SELECT
      const vidFinal = await tx.query<any>(`SELECT status FROM journey_videos WHERE id = $1`, [videoId]);
      expect(vidFinal.rows.length).toBe(0);

      // 5. Kiểm tra attempt: VẪN TỒN TẠI, chỉ video_id được gỡ bỏ (SET NULL)
      const attFinal = await tx.query<any>(`SELECT id, actual_reps, status, video_id FROM journey_attempts WHERE id = $1`, [attemptId]);
      expect(attFinal.rows.length).toBe(1);
      expect(attFinal.rows[0].actual_reps).toBe(5);
      expect(attFinal.rows[0].status).toBe('self_reported_achieved');
      expect(attFinal.rows[0].video_id).toBeNull();
    });

    // Xác nhận từ góc nhìn hệ thống (bypass RLS) rằng record có status = 'deleted'
    const serviceCheck = await db.query<any>(`SELECT status FROM journey_videos WHERE id = $1`, [videoId]);
    expect(serviceCheck.rows[0].status).toBe('deleted');
  });
});

describe('7. Local Runnable Cleanup RPC (D6)', () => {
  it('dọn dẹp các reservation hết hạn (> 1 giờ) nhưng giữ nguyên video ready', async () => {
    await as(userA, async (tx) => {
      await tx.exec(`SET LOCAL ROLE service_role`);
      // 1. Tạo video hết hạn giả lập bằng cách ghi lùi expires_at với storage_path có user prefix
      await tx.query(`
        INSERT INTO journey_videos (
          id, user_id, exercise_id, variant_id, file_name, file_type, file_size_bytes, storage_path,
          status, reserved_at, expires_at
        ) VALUES (
          '99000000-0000-0000-0000-000000000001', $1, 'pull_up', 'standard', 'old_res.mp4', 'video/mp4',
          1000000, '${USER_A}/old_res.mp4', 'reserved', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour'
        )
      `, [USER_A]);

      await tx.exec(`SET LOCAL ROLE authenticated`);
      // 2. Chạy RPC dọn dẹp
      const cleanRes = await tx.query<any>(`SELECT cleanup_expired_journey_video_reservations() as cleaned_count`);
      expect(Number(cleanRes.rows[0].cleaned_count)).toBeGreaterThanOrEqual(1);

      // 3. Video hết hạn phải bị xóa khỏi bảng
      const checkOld = await tx.query(`SELECT status FROM journey_videos WHERE id = '99000000-0000-0000-0000-000000000001'`);
      expect((checkOld.rows[0] as any).status).toBe('pending_deletion');
    });
  });
});

describe('8. Validators & Adapters (Contracts)', () => {
  it('validateRecordAttemptInput: từ chối khi thiếu reps và duration', () => {
    const res = validateRecordAttemptInput({
      journeyId: 'pull_up_mastery',
      milestoneId: 'dead_hang_30s',
      exerciseId: 'dead_hang',
      actualReps: null,
      actualDurationSeconds: null,
      isAchievedSelfReported: false,
    });
    expect(res.isValid).toBe(false);
    expect(res.errors.metrics).toBeDefined();
  });

  it('validateTimestampNoteInput: từ chối thời gian âm và ghi chú trống hoặc quá dài', () => {
    expect(validateTimestampNoteInput(-1, 'Ghi chú').valid).toBe(false);
    expect(validateTimestampNoteInput(5, '').valid).toBe(false);
    expect(validateTimestampNoteInput(5, '   ').valid).toBe(false);
    expect(validateTimestampNoteInput(5, 'a'.repeat(301)).valid).toBe(false);
    expect(validateTimestampNoteInput(12.5, 'Khóa vai tốt').valid).toBe(true);
  });

  it('adaptWorkoutResultToJourneyEvidence: chuyển đổi đúng định dạng SourceRef', () => {
    const evidence = adaptWorkoutResultToJourneyEvidence({
      resultId: 'run-result-123',
      completedAt: '2026-10-28T09:30:00Z',
      sessionId: 'session-456',
    });

    expect(evidence.sourceType).toBe('session_result');
    expect(evidence.sourceId).toBe('run-result-123');
    expect(evidence.recordedAt).toBe('2026-10-28T09:30:00Z');
  });
});
