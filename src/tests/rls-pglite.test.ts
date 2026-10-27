/**
 * Kiểm tra RLS bằng Postgres thật (PGlite, chạy trong Node).
 * Schema auth của Supabase được dựng lại tối thiểu: auth.users, auth.uid() và các role
 * anon / authenticated / service_role. Không thay thế lần chạy trên Supabase thật
 * (supabase/tests/rls_ownership_test.sql) nhưng chạy đúng migration và chính sách RLS.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';
const SYSTEM_SESSION = 'b0000000-0000-0000-0000-000000000001';

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
const serviceRole: Actor = { role: 'service_role' };

async function count(actor: Actor, table: string, where = `user_id = '${USER_A}'`) {
  const res = await as(actor, (tx) =>
    tx.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM public.${table} WHERE ${where}`)
  );
  return res.rows[0].n;
}

async function insertActivity(actor: Actor, userId: string, key: string) {
  return as(actor, (tx) =>
    tx.query<{ id: string }>(
      `INSERT INTO public.activities (user_id, activity_type, start_at, duration_minutes, idempotency_key)
       VALUES ($1, 'calisthenics', now(), 45, $2) RETURNING id`,
      [userId, key]
    )
  );
}

beforeAll(async () => {
  db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_STUB);

  const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');
  for (const file of fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
  }
  await db.exec(fs.readFileSync(path.resolve(__dirname, '../../supabase/seed_demo.sql'), 'utf8'));

  // Tài khoản kỹ thuật giả lập, không phải dữ liệu thật
  await db.query(
    `INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
       ($1, 'test_user_a@example.internal', '{"display_name":"Người dùng A","experience_level":"intermediate"}'),
       ($2, 'test_user_b@example.internal', '{}')`,
    [USER_A, USER_B]
  );

  await as(userA, async (tx) => {
    await tx.query(`INSERT INTO public.goals (user_id, content, goal_type) VALUES ($1, 'Hít xà 5 lần', 'skill')`, [USER_A]);
    await tx.query(
      `INSERT INTO public.observations (user_id, metric_type, metric_value, metric_unit) VALUES ($1, 'weight', 65.5, 'kg')`,
      [USER_A]
    );
    await tx.query(`INSERT INTO public.ai_consents (user_id) VALUES ($1)`, [USER_A]);
  });
  await insertActivity(userA, USER_A, 'seed-activity-a');
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe('Hồ sơ tự tạo khi đăng ký', () => {
  it('tạo profile từ metadata đăng ký', async () => {
    const res = await db.query<{ display_name: string; experience_level: string }>(
      `SELECT display_name, experience_level FROM public.profiles WHERE user_id = $1`,
      [USER_A]
    );
    expect(res.rows).toEqual([{ display_name: 'Người dùng A', experience_level: 'intermediate' }]);
  });

  it('dùng giá trị mặc định khi metadata trống', async () => {
    const res = await db.query<{ display_name: string; experience_level: string }>(
      `SELECT display_name, experience_level FROM public.profiles WHERE user_id = $1`,
      [USER_B]
    );
    expect(res.rows).toEqual([{ display_name: 'Người dùng mới', experience_level: 'beginner' }]);
  });
});

describe('Cô lập dữ liệu giữa tài khoản', () => {
  const ownedTables = ['profiles', 'goals', 'observations', 'activities', 'ai_consents'];

  it('A đọc được dữ liệu của mình', async () => {
    for (const table of ownedTables) {
      expect(await count(userA, table), table).toBeGreaterThan(0);
    }
  });

  it('B và anon không thấy bản ghi nào của A', async () => {
    for (const table of ownedTables) {
      expect(await count(userB, table), `B đọc ${table}`).toBe(0);
      expect(await count(anon, table), `anon đọc ${table}`).toBe(0);
    }
  });

  it('B sửa/xóa dữ liệu của A ảnh hưởng 0 dòng', async () => {
    const updated = await as(userB, (tx) =>
      tx.query(`UPDATE public.activities SET notes = 'x' WHERE user_id = $1`, [USER_A])
    );
    const deleted = await as(userB, (tx) => tx.query(`DELETE FROM public.profiles WHERE user_id = $1`, [USER_A]));
    expect(updated.affectedRows).toBe(0);
    expect(deleted.affectedRows).toBe(0);
  });

  it('B không thể chèn bản ghi mang user_id của A', async () => {
    await expect(insertActivity(userB, USER_A, 'spoof-1')).rejects.toThrow(/row-level security/);
    await expect(
      as(userB, (tx) =>
        tx.query(`INSERT INTO public.goals (user_id, content, goal_type) VALUES ($1, 'x', 'habit')`, [USER_A])
      )
    ).rejects.toThrow(/row-level security/);
  });

  it('B không thể đổi user_id bản ghi của mình sang A', async () => {
    await insertActivity(userB, USER_B, 'b-own-1');
    await expect(
      as(userB, (tx) =>
        tx.query(`UPDATE public.activities SET user_id = $1 WHERE user_id = $2`, [USER_A, USER_B])
      )
    ).rejects.toThrow(/row-level security/);
  });
});

describe('Chống ghi trùng', () => {
  it('activities bắt buộc idempotency_key', async () => {
    await expect(
      as(userA, (tx) =>
        tx.query(
          `INSERT INTO public.activities (user_id, activity_type, start_at, duration_minutes) VALUES ($1, 'running', now(), 20)`,
          [USER_A]
        )
      )
    ).rejects.toThrow(/null value/);
  });

  it('lưu lặp cùng khóa không nhân đôi hoạt động', async () => {
    await insertActivity(userA, USER_A, 'dup-key');
    await expect(insertActivity(userA, USER_A, 'dup-key')).rejects.toThrow(/duplicate key/);

    // Cách client nên lưu: upsert với ignoreDuplicates (ON CONFLICT DO NOTHING)
    await as(userA, (tx) =>
      tx.query(
        `INSERT INTO public.activities (user_id, activity_type, start_at, duration_minutes, idempotency_key)
         VALUES ($1, 'calisthenics', now(), 45, 'dup-key') ON CONFLICT (user_id, idempotency_key) DO NOTHING`,
        [USER_A]
      )
    );
    expect(await count(userA, 'activities', `idempotency_key = 'dup-key'`)).toBe(1);
  });

  it('cùng khóa ở hai tài khoản khác nhau không xung đột', async () => {
    await insertActivity(userB, USER_B, 'dup-key');
    expect(await count(userB, 'activities', `idempotency_key = 'dup-key'`)).toBe(1);
  });

  it('session_results chặn lưu lặp cùng khóa', async () => {
    const insertResult = () =>
      as(userA, (tx) =>
        tx.query(`INSERT INTO public.session_results (session_id, user_id, idempotency_key) VALUES ($1, $2, 'res-1')`, [
          SYSTEM_SESSION,
          USER_A,
        ])
      );
    await insertResult();
    await expect(insertResult()).rejects.toThrow(/duplicate key/);
  });
});

describe('Bản ghi con cùng chủ sở hữu với bản ghi cha', () => {
  let privateProgramId: string;
  let privateSessionId: string;

  beforeAll(async () => {
    await as(userA, async (tx) => {
      const program = await tx.query<{ id: string }>(
        `INSERT INTO public.programs (user_id, title, description) VALUES ($1, 'Riêng A', 'demo') RETURNING id`,
        [USER_A]
      );
      privateProgramId = program.rows[0].id;
      const session = await tx.query<{ id: string }>(
        `INSERT INTO public.sessions (program_id, user_id, title) VALUES ($1, $2, 'Buổi riêng A') RETURNING id`,
        [privateProgramId, USER_A]
      );
      privateSessionId = session.rows[0].id;
    });
  });

  it('B không thể thêm buổi tập vào chương trình riêng của A', async () => {
    await expect(
      as(userB, (tx) =>
        tx.query(`INSERT INTO public.sessions (program_id, user_id, title) VALUES ($1, $2, 'x')`, [
          privateProgramId,
          USER_B,
        ])
      )
    ).rejects.toThrow(/row-level security/);
  });

  it('B không thể ghi kết quả cho buổi tập riêng của A', async () => {
    await expect(
      as(userB, (tx) =>
        tx.query(`INSERT INTO public.session_results (session_id, user_id, idempotency_key) VALUES ($1, $2, 'x')`, [
          privateSessionId,
          USER_B,
        ])
      )
    ).rejects.toThrow(/row-level security/);
  });

  it('B vẫn ghi được kết quả cho buổi tập mẫu hệ thống', async () => {
    await as(userB, (tx) =>
      tx.query(`INSERT INTO public.session_results (session_id, user_id, idempotency_key) VALUES ($1, $2, 'b-res')`, [
        SYSTEM_SESSION,
        USER_B,
      ])
    );
    expect(await count(userB, 'session_results', `user_id = '${USER_B}'`)).toBe(1);
  });
});

describe('Bảng AI chỉ ghi từ server', () => {
  let conversationA: string;

  beforeAll(async () => {
    const res = await as(userA, (tx) =>
      tx.query<{ id: string }>(`INSERT INTO public.ai_conversations (user_id) VALUES ($1) RETURNING id`, [USER_A])
    );
    conversationA = res.rows[0].id;
  });

  it('client không tự tạo tóm tắt "ai_generated"', async () => {
    await expect(
      as(userA, (tx) =>
        tx.query(`INSERT INTO public.ai_summaries (user_id, status, content) VALUES ($1, 'ai_generated', 'giả')`, [
          USER_A,
        ])
      )
    ).rejects.toThrow(/permission denied/);
  });

  it('client không tự tạo tin nhắn assistant', async () => {
    await expect(
      as(userA, (tx) =>
        tx.query(
          `INSERT INTO public.ai_messages (conversation_id, user_id, role, content) VALUES ($1, $2, 'assistant', 'giả')`,
          [conversationA, USER_A]
        )
      )
    ).rejects.toThrow(/permission denied/);
  });

  it('server ghi được; A đọc được, B không đọc được', async () => {
    await as(serviceRole, async (tx) => {
      await tx.query(`INSERT INTO public.ai_summaries (user_id, status, content) VALUES ($1, 'template_fallback', 'mẫu')`, [
        USER_A,
      ]);
      await tx.query(
        `INSERT INTO public.ai_messages (conversation_id, user_id, role, content) VALUES ($1, $2, 'assistant', 'trả lời')`,
        [conversationA, USER_A]
      );
    });
    expect(await count(userA, 'ai_summaries')).toBe(1);
    expect(await count(userA, 'ai_messages')).toBe(1);
    expect(await count(userB, 'ai_messages')).toBe(0);
  });

  it('tóm tắt mới không mặc định gắn nhãn demo', async () => {
    const res = await as(userA, (tx) => tx.query<{ is_demo: boolean }>(`SELECT is_demo FROM public.ai_summaries`));
    expect(res.rows[0].is_demo).toBe(false);
  });

  it('kể cả server cũng không gắn tin nhắn của B vào hội thoại của A', async () => {
    await expect(
      as(serviceRole, (tx) =>
        tx.query(`INSERT INTO public.ai_messages (conversation_id, user_id, role, content) VALUES ($1, $2, 'user', 'x')`, [
          conversationA,
          USER_B,
        ])
      )
    ).rejects.toThrow(/foreign key/);
  });

  it('A xóa hội thoại thì tin nhắn bị xóa theo', async () => {
    await as(userA, (tx) => tx.query(`DELETE FROM public.ai_conversations WHERE id = $1`, [conversationA]));
    expect(await count(userA, 'ai_messages')).toBe(0);
  });
});

describe('Gợi ý xem lại lịch được đánh dấu cũ', () => {
  async function createSuggestion(activityId: string) {
    const res = await as(userA, (tx) =>
      tx.query<{ id: string }>(
        `INSERT INTO public.review_suggestions (user_id, reason, reference_activity_ids)
         VALUES ($1, 'demo', ARRAY[$2::uuid]) RETURNING id`,
        [USER_A, activityId]
      )
    );
    return res.rows[0].id;
  }

  async function statusOf(suggestionId: string) {
    const res = await as(userA, (tx) =>
      tx.query<{ status: string }>(`SELECT status FROM public.review_suggestions WHERE id = $1`, [suggestionId])
    );
    return res.rows[0].status;
  }

  it('khi sửa hoạt động nguồn', async () => {
    const activity = await insertActivity(userA, USER_A, 'rs-update');
    const suggestion = await createSuggestion(activity.rows[0].id);
    await as(userA, (tx) =>
      tx.query(`UPDATE public.activities SET duration_minutes = 60 WHERE id = $1`, [activity.rows[0].id])
    );
    expect(await statusOf(suggestion)).toBe('outdated');
  });

  it('khi xóa hoạt động nguồn', async () => {
    const activity = await insertActivity(userA, USER_A, 'rs-delete');
    const suggestion = await createSuggestion(activity.rows[0].id);
    await as(userA, (tx) => tx.query(`DELETE FROM public.activities WHERE id = $1`, [activity.rows[0].id]));
    expect(await statusOf(suggestion)).toBe('outdated');
  });
});

describe('Giới hạn thời lượng và chống trùng gợi ý', () => {
  it('chặn hoạt động dài hơn 1440 phút', async () => {
    await expect(
      as(userA, (tx) =>
        tx.query(
          `INSERT INTO public.activities (user_id, activity_type, start_at, duration_minutes, idempotency_key)
           VALUES ($1, 'walking', now(), 1441, 'too-long')`,
          [USER_A]
        )
      )
    ).rejects.toThrow(/chk_activities_duration_max/);
  });

  it('không tạo hai gợi ý còn hiệu lực cho cùng bộ hoạt động và phiên bản quy tắc', async () => {
    const a1 = (await insertActivity(userA, USER_A, 'dedupe-1')).rows[0].id;
    const a2 = (await insertActivity(userA, USER_A, 'dedupe-2')).rows[0].id;
    const ids = [a1, a2].sort();
    const insert = () =>
      as(userA, (tx) =>
        tx.query(
          `INSERT INTO public.review_suggestions (user_id, reason, reference_activity_ids, rule_version)
           VALUES ($1, 'demo', $2::uuid[], 'rule-demo-test')`,
          [USER_A, ids]
        )
      );
    await insert();
    await expect(insert()).rejects.toThrow(/duplicate key/);

    // Gợi ý cũ bị đánh dấu outdated thì được tạo lại
    await as(userA, (tx) =>
      tx.query(`UPDATE public.review_suggestions SET status = 'outdated' WHERE rule_version = 'rule-demo-test'`)
    );
    await insert();
  });
});

describe('Ràng buộc ngày mục tiêu', () => {
  it('chặn end_date sớm hơn start_date', async () => {
    await expect(
      as(userA, (tx) =>
        tx.query(
          `INSERT INTO public.goals (user_id, content, goal_type, start_date, end_date)
           VALUES ($1, 'x', 'habit', '2026-11-10', '2026-11-01')`,
          [USER_A]
        )
      )
    ).rejects.toThrow(/chk_goals_dates/);
  });
});

describe('Thời gian lưu kèm múi giờ', () => {
  it('không còn mặc định TIMEZONE(utc, NOW())', async () => {
    const res = await db.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM information_schema.columns
       WHERE table_schema = 'public' AND column_default ILIKE '%timezone(%'`
    );
    expect(res.rows[0].n).toBe(0);
  });
});
