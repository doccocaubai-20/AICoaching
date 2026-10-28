/**
 * CALISCOACHING - KIỂM THỬ TOÀN DIỆN AGENT D: D5 NHÓM NHỎ CÙNG GIỮ CAM KẾT
 * Kiểm tra các tính năng theo hợp đồng G0 và yêu cầu nghiệm thu:
 * 1. Hàm thuần & timezone (Tuần theo múi giờ, date shifting, export summary, validation).
 * 2. Hai tài khoản độc lập A & B (Tạo nhóm, mời, preview, accept, cam kết, tiến độ, reaction, feedback).
 * 3. Bảo vệ đa tầng (Outsider C, Member B đã rời, token hết hạn/thu hồi không đọc/ghi nội dung trái quyền).
 * 4. Giới hạn 1-5 người (Sức chứa tối đa 5, chặn người thứ 6, chống accept trùng).
 * 5. Chính sách quyền & Owner rời nhóm (Chống tự nâng role, chống kick owner, owner phải chuyển quyền hoặc archive).
 * 6. Hẹn buổi chung & Revision (Tăng revision khi sửa lịch, nhận diện cần xác nhận lại).
 * 7. Cô lập dữ liệu sức khỏe (Không truy cập hồ sơ y tế/nhật ký qua API nhóm; mute/rời không xóa dữ liệu riêng).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import fs from 'fs';
import path from 'path';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

import {
  getWeekStartForDate,
  getShiftedWeekStart,
  formatWeekRangeVN,
  sanitizeTextMessage,
} from '@/components/groups/group-utils';
import {
  validateCreateGroupInput,
  validateCommitmentInput,
  validateFeedbackMessageInput,
  validateMeetupInput,
  exportGroupWeekSummary,
  getGroupDeepLink,
  getInviteDeepLink,
  GroupEntity,
  GroupCommitmentEntity,
} from '@/contracts/group.contract';

// Các tài khoản kỹ thuật kiểm thử
const USER_A = '11111111-1111-1111-1111-111111111111'; // Chủ nhóm (Owner)
const USER_B = '22222222-2222-2222-2222-222222222222'; // Thành viên 2 (Member)
const USER_C = '33333333-3333-3333-3333-333333333333'; // Người ngoài nhóm (Outsider)
const USER_D = '44444444-4444-4444-4444-444444444444'; // Thành viên 3
const USER_E = '55555555-5555-5555-5555-555555555555'; // Thành viên 4
const USER_F = '66666666-6666-6666-6666-666666666666'; // Thành viên 5 (ghế cuối)
const USER_G = '77777777-7777-7777-7777-777777777777'; // Người thứ 6 (vượt cap)

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
const userC: Actor = { role: 'authenticated', uid: USER_C };
const userD: Actor = { role: 'authenticated', uid: USER_D };
const userE: Actor = { role: 'authenticated', uid: USER_E };
const userF: Actor = { role: 'authenticated', uid: USER_F };
const userG: Actor = { role: 'authenticated', uid: USER_G };
const anon: Actor = { role: 'anon' };

beforeAll(async () => {
  db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_STUB);

  const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');
  // Chạy các migration theo thứ tự tên tệp
  for (const file of fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await db.exec(sql);
  }

  // Khởi tạo người dùng kiểm thử
  await db.query(
    `INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
       ($1, 'usera@example.internal', '{"display_name":"Người dùng A"}'),
       ($2, 'userb@example.internal', '{"display_name":"Người dùng B"}'),
       ($3, 'userc@example.internal', '{"display_name":"Người dùng C"}'),
       ($4, 'userd@example.internal', '{"display_name":"Người dùng D"}'),
       ($5, 'usere@example.internal', '{"display_name":"Người dùng E"}'),
       ($6, 'userf@example.internal', '{"display_name":"Người dùng F"}'),
       ($7, 'userg@example.internal', '{"display_name":"Người dùng G"}')
     ON CONFLICT (id) DO NOTHING`,
    [USER_A, USER_B, USER_C, USER_D, USER_E, USER_F, USER_G]
  );
}, 60_000);

afterAll(async () => {
  await db?.close();
});

// ==============================================================================
// 1. KIỂM THỬ HÀM THUẦN & MÚI GIỜ (TIMEZONE-AWARE WEEKS)
// ==============================================================================

describe('1. Hàm thuần & Tính toán tuần theo múi giờ', () => {
  it('tính ngày Thứ Hai đầu tuần chính xác theo múi giờ Việt Nam Asia/Ho_Chi_Minh', () => {
    // Thứ Tư, 28/10/2026 -> Thứ Hai cùng tuần là 26/10/2026
    const wednesday = new Date('2026-10-28T10:00:00Z');
    expect(getWeekStartForDate(wednesday, 'Asia/Ho_Chi_Minh')).toBe('2026-10-26');

    // Chủ Nhật, 01/11/2026 23:30 tại VN -> Thứ Hai đầu tuần là 26/10/2026
    const sundayNight = new Date('2026-11-01T16:30:00Z'); // 16:30 UTC = 23:30 VN
    expect(getWeekStartForDate(sundayNight, 'Asia/Ho_Chi_Minh')).toBe('2026-10-26');

    // Thứ Hai, 26/10/2026 01:00 tại VN -> Thứ Hai đầu tuần là 26/10/2026
    const mondayMorning = new Date('2026-10-25T18:00:00Z'); // 18:00 UTC hôm trước = 01:00 VN
    expect(getWeekStartForDate(mondayMorning, 'Asia/Ho_Chi_Minh')).toBe('2026-10-26');
  });

  it('dịch chuyển tuần (+1, -1 tuần) chính xác không phụ thuộc đồng hồ hệ thống', () => {
    expect(getShiftedWeekStart('2026-10-26', 1)).toBe('2026-11-02');
    expect(getShiftedWeekStart('2026-10-26', -1)).toBe('2026-10-19');
    expect(getShiftedWeekStart('2026-10-26', 4)).toBe('2026-11-23');
  });

  it('định dạng khoảng ngày trong tuần tiếng Việt chuẩn', () => {
    expect(formatWeekRangeVN('2026-10-26')).toBe('26/10 - 01/11/2026');
  });

  it('làm sạch tin nhắn an toàn: loại bỏ HTML tag nguy hiểm và giới hạn 280 ký tự', () => {
    const dirty = '<script>alert("hack")</script>Cố lên bạn ơi!<b>Tập tốt</b>';
    const clean = sanitizeTextMessage(dirty);
    expect(clean).not.toContain('<script>');
    expect(clean).not.toContain('<b>');
    expect(clean).toContain('Cố lên bạn ơi!');

    const longText = 'a'.repeat(350);
    expect(sanitizeTextMessage(longText).length).toBe(280);
  });

  it('kiểm tra tính hợp lệ của input nhóm, cam kết, phản hồi và buổi hẹn', () => {
    expect(validateCreateGroupInput({ name: '' }).is_valid).toBe(false);
    expect(validateCreateGroupInput({ name: 'A' }).is_valid).toBe(false);
    expect(validateCreateGroupInput({ name: 'Nhóm Calisthenics' }).is_valid).toBe(true);

    expect(validateCommitmentInput({ content: 'ab', week_start: '2026-10-26' }).is_valid).toBe(false);
    expect(validateCommitmentInput({ content: 'Tập xà 3 buổi', week_start: 'sai-format' }).is_valid).toBe(false);
    expect(validateCommitmentInput({ content: 'Tập xà 3 buổi', week_start: '2026-10-26', target_count: 60 }).is_valid).toBe(false);
    expect(validateCommitmentInput({ content: 'Tập xà 3 buổi', week_start: '2026-10-26', target_count: 3 }).is_valid).toBe(true);

    expect(validateFeedbackMessageInput('').is_valid).toBe(false);
    expect(validateFeedbackMessageInput('Tuyệt vời lắm bạn!').is_valid).toBe(true);
    expect(validateFeedbackMessageInput('x'.repeat(300)).is_valid).toBe(false);

    expect(validateMeetupInput({ title: 'Bu' }).is_valid).toBe(false);
    expect(validateMeetupInput({ title: 'Buổi tập chung', scheduled_at: '2026-10-30T07:00:00Z' }).is_valid).toBe(true);
  });

  it('xuất tóm tắt cam kết tuần đúng hợp đồng CONTRACTS mà không lộ dữ liệu sức khỏe', () => {
    const mockGroup: Pick<GroupEntity, 'id' | 'name' | 'timezone'> = {
      id: 'g-1',
      name: 'Nhóm Kỷ Luật',
      timezone: 'Asia/Ho_Chi_Minh',
    };
    const mockCommitments: GroupCommitmentEntity[] = [
      {
        id: 'c-1',
        group_id: 'g-1',
        user_id: USER_A,
        user_display_name: 'Huy Lê',
        week_start: '2026-10-26',
        content: 'Tập xà 3 buổi',
        target_count: 3,
        completed_count: 3,
        status: 'completed',
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'c-2',
        group_id: 'g-1',
        user_id: USER_B,
        user_display_name: 'Tuấn',
        week_start: '2026-10-26',
        content: 'Chạy bộ 2 buổi',
        target_count: 2,
        completed_count: 1,
        status: 'needs_companion',
        notes: 'Cần bạn chạy cùng thứ 7',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const summary = exportGroupWeekSummary(mockGroup, mockCommitments, '2026-10-26', 2);
    expect(summary.total_commitments).toBe(2);
    expect(summary.completed_commitments).toBe(1);
    expect(summary.needs_companion_commitments).toBe(1);
    expect(summary.summary_text).toContain('Nhóm Kỷ Luật');
    expect(summary.summary_text).toContain('Huy Lê');
    expect(summary.summary_text).toContain('Đã hoàn thành');
    expect(summary.summary_text).toContain('Cần đồng hành');
    // Không chứa các từ khóa nhạy cảm
    expect(summary.summary_text).not.toContain('huyết áp');
    expect(summary.summary_text).not.toContain('bệnh nền');

    expect(getGroupDeepLink('g-1', 'commitments')).toBe('/groups/g-1?tab=commitments');
    expect(getInviteDeepLink('token-123')).toBe('/groups/invite/token-123');
  });
});

// ==============================================================================
// 2. NGHIỆM THU: HAI TÀI KHOẢN ĐỘC LẬP A & B (TẠO, MỜI, PREVIEW, ACCEPT, CAM KẾT)
// ==============================================================================

describe('2. Luồng hai tài khoản A & B: Tạo nhóm → Mời → Preview → Gia nhập → Cam kết → Phản hồi', () => {
  let createdGroupId: string;
  let rawToken: string;
  let tokenHash: string;
  let commitmentAId: string;
  let commitmentBId: string;

  it('A tạo nhóm mới (1 thành viên ban đầu, role owner)', async () => {
    const res = await as(userA, async (tx) => {
      const { rows } = await tx.query<{ create_group_with_owner: string }>(
        `SELECT public.create_group_with_owner('Nhóm Calisthenics A & B', 'Cùng tập đều mỗi tuần', 'Asia/Ho_Chi_Minh')`
      );
      return rows[0].create_group_with_owner;
    });

    expect(res).toBeDefined();
    createdGroupId = res;

    // Kiểm tra membership của A là owner
    const members = await as(userA, async (tx) => {
      const { rows } = await tx.query<{ role: string; status: string }>(
        `SELECT role, status FROM public.group_members WHERE group_id = $1 AND user_id = $2`,
        [createdGroupId, USER_A]
      );
      return rows;
    });

    expect(members).toHaveLength(1);
    expect(members[0].role).toBe('owner');
    expect(members[0].status).toBe('active');
  });

  it('A tạo lời mời có token ngẫu nhiên lưu hash SHA-256 và TTL', async () => {
    rawToken = 'test-token-random-secure-123456';
    tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const inviteId = await as(userA, async (tx) => {
      const { rows } = await tx.query<{ create_group_invite: string }>(
        `SELECT public.create_group_invite($1, $2, now() + INTERVAL '7 days', 2)`,
        [createdGroupId, tokenHash]
      );
      return rows[0].create_group_invite;
    });

    expect(inviteId).toBeDefined();

    // Xác nhận trong DB chỉ lưu hash, không lưu rawToken
    const inviteRow = await db.query<{ token_hash: string }>(
      `SELECT token_hash FROM public.group_invites WHERE id = $1`,
      [inviteId]
    );
    expect(inviteRow.rows[0].token_hash).toBe(tokenHash);
  });

  it('B xem trước (GET preview) an toàn: thấy thông tin nhóm nhưng KHÔNG tự gia nhập', async () => {
    const preview = await as(userB, async (tx) => {
      const { rows } = await tx.query<{
        group_id: string;
        group_name: string;
        member_count: number;
        is_valid: boolean;
      }>(`SELECT * FROM public.get_group_invite_preview($1)`, [tokenHash]);
      return rows[0];
    });

    expect(preview.is_valid).toBe(true);
    expect(preview.group_name).toBe('Nhóm Calisthenics A & B');
    expect(Number(preview.member_count)).toBe(1); // Mới chỉ có 1 người (A)

    // Xác nhận B vẫn CHƯA là thành viên sau khi preview
    const checkMembership = await as(userA, async (tx) => {
      const { rows } = await tx.query(
        `SELECT * FROM public.group_members WHERE group_id = $1 AND user_id = $2`,
        [createdGroupId, USER_B]
      );
      return rows;
    });
    expect(checkMembership).toHaveLength(0);
  });

  it('B chấp nhận lời mời (mutation có xác thực): gia nhập thành công thành viên thứ 2', async () => {
    const joinedGroupId = await as(userB, async (tx) => {
      const { rows } = await tx.query<{ accept_group_invite: string }>(
        `SELECT public.accept_group_invite($1)`,
        [tokenHash]
      );
      return rows[0].accept_group_invite;
    });

    expect(joinedGroupId).toBe(createdGroupId);

    // Xác nhận B đã là member hoạt động
    const bMember = await as(userB, async (tx) => {
      const { rows } = await tx.query<{ role: string; status: string }>(
        `SELECT role, status FROM public.group_members WHERE group_id = $1 AND user_id = $2`,
        [createdGroupId, USER_B]
      );
      return rows[0];
    });

    expect(bMember.role).toBe('member');
    expect(bMember.status).toBe('active');
  });

  it('A và B đặt 2 cam kết cá nhân khác nhau cho tuần hiện tại', async () => {
    const weekStart = '2026-10-26';

    // A đặt cam kết
    const resA = await as(userA, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        `INSERT INTO public.group_commitments (group_id, user_id, week_start, content, target_count, status)
         VALUES ($1, $2, $3, 'Tập xà 3 buổi và chạy nhẹ', 3, 'planned')
         RETURNING id`,
        [createdGroupId, USER_A, weekStart]
      );
      return rows[0].id;
    });
    commitmentAId = resA;

    // B đặt cam kết khác
    const resB = await as(userB, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        `INSERT INTO public.group_commitments (group_id, user_id, week_start, content, target_count, status)
         VALUES ($1, $2, $3, 'Hít đất 100 cái mỗi ngày và bơi 2 buổi', 2, 'planned')
         RETURNING id`,
        [createdGroupId, USER_B, weekStart]
      );
      return rows[0].id;
    });
    commitmentBId = resB;

    expect(commitmentAId).toBeDefined();
    expect(commitmentBId).toBeDefined();
  });

  it('B cập nhật trạng thái đã làm kèm số lần hoàn thành một phần', async () => {
    await as(userB, async (tx) => {
      await tx.query(
        `UPDATE public.group_commitments
         SET status = 'completed', completed_count = 2, updated_at = now()
         WHERE id = $1 AND user_id = $2`,
        [commitmentBId, USER_B]
      );
    });

    const bCommitment = await as(userA, async (tx) => {
      const { rows } = await tx.query<{ status: string; completed_count: number }>(
        `SELECT status, completed_count FROM public.group_commitments WHERE id = $1`,
        [commitmentBId]
      );
      return rows[0];
    });

    expect(bCommitment.status).toBe('completed');
    expect(bCommitment.completed_count).toBe(2);
  });

  it('A thả reaction 🔥 và gửi lời động viên ngắn cho B, dữ liệu giữ nguyên sau reload', async () => {
    // A thả reaction
    await as(userA, async (tx) => {
      await tx.query(
        `INSERT INTO public.group_reactions (commitment_id, user_id, reaction_type)
         VALUES ($1, $2, 'fire')`,
        [commitmentBId, USER_A]
      );
    });

    // A gửi tin nhắn ngắn
    await as(userA, async (tx) => {
      await tx.query(
        `INSERT INTO public.group_feedback_messages (commitment_id, user_id, message)
         VALUES ($1, $2, 'Cố lên bạn ơi, tuần này hoàn thành rất tốt!')`,
        [commitmentBId, USER_A]
      );
    });

    // B đọc lại (mô phỏng reload)
    const reactions = await as(userB, async (tx) => {
      const { rows } = await tx.query<{ reaction_type: string; user_id: string }>(
        `SELECT reaction_type, user_id FROM public.group_reactions WHERE commitment_id = $1`,
        [commitmentBId]
      );
      return rows;
    });

    const messages = await as(userB, async (tx) => {
      const { rows } = await tx.query<{ message: string; user_id: string }>(
        `SELECT message, user_id FROM public.group_feedback_messages WHERE commitment_id = $1`,
        [commitmentBId]
      );
      return rows;
    });

    expect(reactions).toHaveLength(1);
    expect(reactions[0].reaction_type).toBe('fire');
    expect(reactions[0].user_id).toBe(USER_A);

    expect(messages).toHaveLength(1);
    expect(messages[0].message).toContain('Cố lên bạn ơi');
  });
});

// ==============================================================================
// 3. AN TOÀN DỮ LIỆU: OUTSIDER C, THÀNH VIÊN ĐÃ RỜI, TOKEN HẾT HẠN / THU HỒI
// ==============================================================================

describe('3. Chính sách quyền & Cô lập dữ liệu: Người ngoài C, Member B đã rời, Token hết hạn', () => {
  let groupId: string;
  let activeTokenHash: string;
  let commitmentId: string;

  beforeAll(async () => {
    // Tạo nhóm thử nghiệm
    groupId = await as(userA, async (tx) => {
      const { rows } = await tx.query<{ create_group_with_owner: string }>(
        `SELECT public.create_group_with_owner('Nhóm Bảo Mật', 'Thử nghiệm bảo mật RLS', 'Asia/Ho_Chi_Minh')`
      );
      return rows[0].create_group_with_owner;
    });

    // Tạo token
    activeTokenHash = crypto.createHash('sha256').update('token-security-test-999').digest('hex');
    await as(userA, async (tx) => {
      await tx.query(
        `SELECT public.create_group_invite($1, $2, now() + INTERVAL '1 day', 1)`,
        [groupId, activeTokenHash]
      );
    });

    // Cho B gia nhập
    await as(userB, async (tx) => {
      await tx.query(`SELECT public.accept_group_invite($1)`, [activeTokenHash]);
    });

    // B tạo cam kết
    commitmentId = await as(userB, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        `INSERT INTO public.group_commitments (group_id, user_id, week_start, content, status)
         VALUES ($1, $2, '2026-10-26', 'Cam kết bảo mật của B', 'planned')
         RETURNING id`,
        [groupId, USER_B]
      );
      return rows[0].id;
    });
  });

  it('Người ngoài C không đọc được thông tin nhóm qua direct SELECT', async () => {
    const res = await as(userC, async (tx) => {
      const { rows } = await tx.query(`SELECT * FROM public.groups WHERE id = $1`, [groupId]);
      return rows;
    });
    expect(res).toHaveLength(0); // RLS chặn
  });

  it('Người ngoài C không đọc được cam kết của nhóm qua direct SELECT', async () => {
    const res = await as(userC, async (tx) => {
      const { rows } = await tx.query(`SELECT * FROM public.group_commitments WHERE group_id = $1`, [groupId]);
      return rows;
    });
    expect(res).toHaveLength(0); // RLS chặn
  });

  it('Người ngoài C cố tình INSERT cam kết vào nhóm bị RLS từ chối', async () => {
    await expect(
      as(userC, async (tx) => {
        await tx.query(
          `INSERT INTO public.group_commitments (group_id, user_id, week_start, content, status)
           VALUES ($1, $2, '2026-10-26', 'C can thiệp trái phép', 'planned')`,
          [groupId, USER_C]
        );
      })
    ).rejects.toThrow();
  });

  it('Token bị thu hồi (revoked) hoặc hết hạn không cho phép chấp nhận gia nhập', async () => {
    // Tạo 1 token và thu hồi
    const revokedHash = crypto.createHash('sha256').update('token-revoked-test').digest('hex');
    await as(userA, async (tx) => {
      const { rows } = await tx.query<{ create_group_invite: string }>(
        `SELECT public.create_group_invite($1, $2, now() + INTERVAL '1 day', 1)`,
        [groupId, revokedHash]
      );
      await tx.query(`UPDATE public.group_invites SET is_revoked = true WHERE id = $1`, [rows[0].create_group_invite]);
    });

    await expect(
      as(userC, async (tx) => {
        await tx.query(`SELECT public.accept_group_invite($1)`, [revokedHash]);
      })
    ).rejects.toThrow(/thu hồi/);

    // Tạo 1 token đã hết hạn
    const expiredHash = crypto.createHash('sha256').update('token-expired-test').digest('hex');
    await as(userA, async (tx) => {
      await tx.query(
        `INSERT INTO public.group_invites (group_id, token_hash, created_by, expires_at, max_uses, used_count)
         VALUES ($1, $2, $3, now() - INTERVAL '1 hour', 1, 0)`,
        [groupId, expiredHash, USER_A]
      );
    });

    await expect(
      as(userC, async (tx) => {
        await tx.query(`SELECT public.accept_group_invite($1)`, [expiredHash]);
      })
    ).rejects.toThrow(/hết hạn/);
  });

  it('Khi member B rời nhóm: mất quyền nội dung nhóm ngay lập tức; cam kết chi tiết ẩn khỏi nhóm', async () => {
    // B rời nhóm
    await as(userB, async (tx) => {
      await tx.query(`SELECT public.leave_group($1)`, [groupId]);
    });

    // B cố gắng đọc cam kết của nhóm: 0 dòng
    const bRead = await as(userB, async (tx) => {
      const { rows } = await tx.query(`SELECT * FROM public.group_commitments WHERE group_id = $1`, [groupId]);
      return rows;
    });
    expect(bRead).toHaveLength(0);

    // A đọc cam kết trong nhóm: cam kết của người đã rời (B) mặc định bị ẩn khỏi nhóm theo RLS
    const aRead = await as(userA, async (tx) => {
      const { rows } = await tx.query(`SELECT * FROM public.group_commitments WHERE group_id = $1`, [groupId]);
      return rows;
    });
    const foundBCommitment = aRead.find((c: any) => c.user_id === USER_B);
    expect(foundBCommitment).toBeUndefined(); // Cam kết của người đã rời nhóm được ẩn để bảo vệ riêng tư
  });
});

// ==============================================================================
// 4. SỨC CHỨA 1-5 THÀNH VIÊN & CHỐNG ACCEPT VƯỢT CAP / TRÙNG LẶP
// ==============================================================================

describe('4. Giới hạn thành viên 1–5 người & Chống accept trùng / vượt cap', () => {
  let capGroupId: string;
  let multiUseTokenHash: string;

  beforeAll(async () => {
    capGroupId = await as(userA, async (tx) => {
      const { rows } = await tx.query<{ create_group_with_owner: string }>(
        `SELECT public.create_group_with_owner('Nhóm Sức Chứa 5', 'Kiểm tra cap 5 người', 'Asia/Ho_Chi_Minh')`
      );
      return rows[0].create_group_with_owner;
    });

    multiUseTokenHash = crypto.createHash('sha256').update('multi-use-token-5-seats').digest('hex');
    await as(userA, async (tx) => {
      await tx.query(
        `SELECT public.create_group_invite($1, $2, now() + INTERVAL '7 days', 10)`,
        [capGroupId, multiUseTokenHash]
      );
    });
  });

  it('nhóm hoạt động bình thường với 1 người ban đầu', async () => {
    const count = await db.query<{ count: string }>(
      `SELECT count(*) FROM public.group_members WHERE group_id = $1 AND status = 'active'`,
      [capGroupId]
    );
    expect(Number(count.rows[0].count)).toBe(1);
  });

  it('các thành viên B, D, E, F lần lượt gia nhập đủ 5 ghế', async () => {
    // Ghế 2: B
    await as(userB, async (tx) => {
      await tx.query(`SELECT public.accept_group_invite($1)`, [multiUseTokenHash]);
    });
    // Ghế 3: D
    await as(userD, async (tx) => {
      await tx.query(`SELECT public.accept_group_invite($1)`, [multiUseTokenHash]);
    });
    // Ghế 4: E
    await as(userE, async (tx) => {
      await tx.query(`SELECT public.accept_group_invite($1)`, [multiUseTokenHash]);
    });
    // Ghế 5: F (ghế cuối cùng)
    await as(userF, async (tx) => {
      await tx.query(`SELECT public.accept_group_invite($1)`, [multiUseTokenHash]);
    });

    const count = await db.query<{ count: string }>(
      `SELECT count(*) FROM public.group_members WHERE group_id = $1 AND status = 'active'`,
      [capGroupId]
    );
    expect(Number(count.rows[0].count)).toBe(5);
  });

  it('người thứ 6 (G) cố gắng gia nhập bị chặn bởi ràng buộc sức chứa tối đa 5 người', async () => {
    await expect(
      as(userG, async (tx) => {
        await tx.query(`SELECT public.accept_group_invite($1)`, [multiUseTokenHash]);
      })
    ).rejects.toThrow(/tối đa 5 thành viên/);

    // Xác nhận số thành viên vẫn là đúng 5
    const count = await db.query<{ count: string }>(
      `SELECT count(*) FROM public.group_members WHERE group_id = $1 AND status = 'active'`,
      [capGroupId]
    );
    expect(Number(count.rows[0].count)).toBe(5);
  });

  it('thành viên đã ở trong nhóm (B) accept lặp không nhân đôi membership', async () => {
    await expect(
      as(userB, async (tx) => {
        await tx.query(`SELECT public.accept_group_invite($1)`, [multiUseTokenHash]);
      })
    ).rejects.toThrow(/đã là thành viên/);

    const bRows = await db.query(
      `SELECT * FROM public.group_members WHERE group_id = $1 AND user_id = $2`,
      [capGroupId, USER_B]
    );
    expect(bRows.rows).toHaveLength(1);
  });
});

// ==============================================================================
// 5. CHÍNH SÁCH QUYỀN: CHỐNG TỰ NÂNG ROLE & OWNER RỜI NHÓM
// ==============================================================================

describe('5. Phân quyền Contract G0 & Chính sách khi Owner rời', () => {
  let roleGroupId: string;

  beforeAll(async () => {
    roleGroupId = await as(userA, async (tx) => {
      const { rows } = await tx.query<{ create_group_with_owner: string }>(
        `SELECT public.create_group_with_owner('Nhóm Quản Trị Role', 'Kiểm tra phân quyền', 'Asia/Ho_Chi_Minh')`
      );
      return rows[0].create_group_with_owner;
    });

    const tokenHash = crypto.createHash('sha256').update('token-role-test').digest('hex');
    await as(userA, async (tx) => {
      await tx.query(`SELECT public.create_group_invite($1, $2, now() + INTERVAL '1 day', 2)`, [roleGroupId, tokenHash]);
    });
    await as(userB, async (tx) => {
      await tx.query(`SELECT public.accept_group_invite($1)`, [tokenHash]);
    });
  });

  it('Thành viên B không được tự nâng role của chính mình', async () => {
    await expect(
      as(userB, async (tx) => {
        await tx.query(
          `UPDATE public.group_members SET role = 'owner' WHERE group_id = $1 AND user_id = $2`,
          [roleGroupId, USER_B]
        );
      })
    ).rejects.toThrow(/không được phép tự nâng quyền/);
  });

  it('Thành viên B không được thay đổi quyền của Owner A', async () => {
    // B chạy update trên dòng của A: bị RLS chặn nên rowCount = 0 (không thể can thiệp dòng người khác)
    const updateResult = await as(userB, async (tx) => {
      const res = await tx.query(
        `UPDATE public.group_members SET role = 'member' WHERE group_id = $1 AND user_id = $2`,
        [roleGroupId, USER_A]
      );
      return res.rowCount;
    });
    expect(updateResult).toBe(0);

    // Xác nhận quyền của A trong DB vẫn là owner
    const aRole = await db.query<{ role: string }>(
      `SELECT role FROM public.group_members WHERE group_id = $1 AND user_id = $2`,
      [roleGroupId, USER_A]
    );
    expect(aRole.rows[0].role).toBe('owner');
  });

  it('Chủ nhóm A rời nhóm khi còn thành viên B bị chặn (không để nhóm vô chủ)', async () => {
    await expect(
      as(userA, async (tx) => {
        await tx.query(`SELECT public.leave_group($1)`, [roleGroupId]);
      })
    ).rejects.toThrow(/Chủ nhóm không thể rời nhóm khi còn thành viên khác/);
  });

  it('Chủ nhóm A chuyển quyền cho B: B thành Owner, A thành Admin, sau đó A rời nhóm thành công', async () => {
    // Chuyển quyền cho B
    await as(userA, async (tx) => {
      await tx.query(`SELECT public.transfer_group_ownership($1, $2)`, [roleGroupId, USER_B]);
    });

    const members = await as(userB, async (tx) => {
      const { rows } = await tx.query<{ user_id: string; role: string }>(
        `SELECT user_id, role FROM public.group_members WHERE group_id = $1 AND status = 'active'`,
        [roleGroupId]
      );
      return rows;
    });

    const b = members.find((m) => m.user_id === USER_B);
    const a = members.find((m) => m.user_id === USER_A);
    expect(b?.role).toBe('owner');
    expect(a?.role).toBe('admin');

    // Bây giờ A (không còn là Owner) có thể rời nhóm bình thường
    await as(userA, async (tx) => {
      await tx.query(`SELECT public.leave_group($1)`, [roleGroupId]);
    });

    const checkA = await db.query<{ status: string }>(
      `SELECT status FROM public.group_members WHERE group_id = $1 AND user_id = $2`,
      [roleGroupId, USER_A]
    );
    expect(checkA.rows[0].status).toBe('left');
  });

  it('Khi là thành viên duy nhất còn lại, Owner rời nhóm sẽ tự động lưu trữ (archive) nhóm', async () => {
    // Tạo nhóm 1 người
    const soloGroupId = await as(userA, async (tx) => {
      const { rows } = await tx.query<{ create_group_with_owner: string }>(
        `SELECT public.create_group_with_owner('Nhóm Một Mình', 'Kiểm tra solo leave', 'Asia/Ho_Chi_Minh')`
      );
      return rows[0].create_group_with_owner;
    });

    // Owner rời nhóm
    await as(userA, async (tx) => {
      await tx.query(`SELECT public.leave_group($1)`, [soloGroupId]);
    });

    // Kiểm tra nhóm đã được tự động lưu trữ
    const groupRow = await db.query<{ status: string }>(
      `SELECT status FROM public.groups WHERE id = $1`,
      [soloGroupId]
    );
    expect(groupRow.rows[0].status).toBe('archived');
  });
});

// ==============================================================================
// 6. HẸN BUỔI CHUNG & QUẢN LÝ PHIÊN BẢN (REVISION & RSVP)
// ==============================================================================

describe('6. Hẹn buổi chung (Meetups) & Quản lý Revision khi sửa lịch', () => {
  let meetupGroupId: string;
  let meetupId: string;

  beforeAll(async () => {
    meetupGroupId = await as(userA, async (tx) => {
      const { rows } = await tx.query<{ create_group_with_owner: string }>(
        `SELECT public.create_group_with_owner('Nhóm Hẹn Tập', 'Kiểm tra meetup', 'Asia/Ho_Chi_Minh')`
      );
      return rows[0].create_group_with_owner;
    });

    const tokenHash = crypto.createHash('sha256').update('token-meetup-test').digest('hex');
    await as(userA, async (tx) => {
      await tx.query(`SELECT public.create_group_invite($1, $2, now() + INTERVAL '1 day', 2)`, [meetupGroupId, tokenHash]);
    });
    await as(userB, async (tx) => {
      await tx.query(`SELECT public.accept_group_invite($1)`, [tokenHash]);
    });
  });

  it('A tạo lịch hẹn buổi tập chung: revision khởi tạo là 1', async () => {
    const res = await as(userA, async (tx) => {
      const { rows } = await tx.query<{ id: string; revision: number }>(
        `INSERT INTO public.group_meetups (group_id, created_by, title, scheduled_at, location, revision)
         VALUES ($1, $2, 'Tập xà công viên Gia Định', now() + INTERVAL '3 days', 'Cổng Hoàng Minh Giám', 1)
         RETURNING id, revision`,
        [meetupGroupId, USER_A]
      );
      return rows[0];
    });

    meetupId = res.id;
    expect(res.revision).toBe(1);
  });

  it('B xác nhận tham gia (RSVP going) với acknowledged_revision = 1', async () => {
    await as(userB, async (tx) => {
      await tx.query(
        `INSERT INTO public.group_meetup_rsvps (meetup_id, user_id, status, acknowledged_revision)
         VALUES ($1, $2, 'going', 1)`,
        [meetupId, USER_B]
      );
    });

    const rsvp = await as(userB, async (tx) => {
      const { rows } = await tx.query<{ status: string; acknowledged_revision: number }>(
        `SELECT status, acknowledged_revision FROM public.group_meetup_rsvps WHERE meetup_id = $1 AND user_id = $2`,
        [meetupId, USER_B]
      );
      return rows[0];
    });

    expect(rsvp.status).toBe('going');
    expect(rsvp.acknowledged_revision).toBe(1);
  });

  it('A sửa lịch hẹn qua RPC update_group_meetup: revision tự động tăng lên 2', async () => {
    const newRev = await as(userA, async (tx) => {
      const { rows } = await tx.query<{ update_group_meetup: number }>(
        `SELECT public.update_group_meetup($1, 'Tập xà công viên Gia Định (Dời giờ)', now() + INTERVAL '3 days 1 hour', 'Cổng Hoàng Minh Giám', 'Mang thêm nước', 'Dời từ 6h sang 7h sáng')`,
        [meetupId]
      );
      return rows[0].update_group_meetup;
    });

    expect(newRev).toBe(2);

    const meetup = await as(userB, async (tx) => {
      const { rows } = await tx.query<{ revision: number; revision_note: string }>(
        `SELECT revision, revision_note FROM public.group_meetups WHERE id = $1`,
        [meetupId]
      );
      return rows[0];
    });

    expect(meetup.revision).toBe(2);
    expect(meetup.revision_note).toContain('Dời từ 6h sang 7h sáng');

    // Kiểm tra B: acknowledged_revision của B (1) < meetup.revision (2) -> B phát hiện cần xác nhận lại
    const bRsvp = await as(userB, async (tx) => {
      const { rows } = await tx.query<{ acknowledged_revision: number }>(
        `SELECT acknowledged_revision FROM public.group_meetup_rsvps WHERE meetup_id = $1 AND user_id = $2`,
        [meetupId, USER_B]
      );
      return rows[0];
    });
    expect(bRsvp.acknowledged_revision).toBeLessThan(meetup.revision);
  });

  it('B xác nhận lại tham gia sau khi lịch đổi: acknowledged_revision được cập nhật lên 2', async () => {
    await as(userB, async (tx) => {
      await tx.query(
        `UPDATE public.group_meetup_rsvps
         SET acknowledged_revision = 2, updated_at = now()
         WHERE meetup_id = $1 AND user_id = $2`,
        [meetupId, USER_B]
      );
    });

    const bRsvp = await as(userB, async (tx) => {
      const { rows } = await tx.query<{ acknowledged_revision: number }>(
        `SELECT acknowledged_revision FROM public.group_meetup_rsvps WHERE meetup_id = $1 AND user_id = $2`,
        [meetupId, USER_B]
      );
      return rows[0];
    });
    expect(bRsvp.acknowledged_revision).toBe(2);
  });
});

// ==============================================================================
// 7. CÔ LẬP DỮ LIỆU SỨC KHỎE & MUTE THÔNG BÁO
// ==============================================================================

describe('7. Cô lập dữ liệu cá nhân & Tắt thông báo (Mute)', () => {
  let isolationGroupId: string;

  beforeAll(async () => {
    isolationGroupId = await as(userA, async (tx) => {
      const { rows } = await tx.query<{ create_group_with_owner: string }>(
        `SELECT public.create_group_with_owner('Nhóm Kiểm Tra Cô Lập', 'Không lộ dữ liệu y tế', 'Asia/Ho_Chi_Minh')`
      );
      return rows[0].create_group_with_owner;
    });

    // Tạo dữ liệu cá nhân của B: nhật ký hoạt động, hồ sơ sức khỏe
    await as(userB, async (tx) => {
      await tx.query(
        `INSERT INTO public.goals (user_id, content, goal_type)
         VALUES ($1, 'Mục tiêu bí mật của B', 'skill')`,
        [USER_B]
      );
      await tx.query(
        `INSERT INTO public.observations (user_id, metric_type, metric_value, metric_unit)
         VALUES ($1, 'weight', 68.5, 'kg')`,
        [USER_B]
      );
      await tx.query(
        `INSERT INTO public.activities (user_id, activity_type, start_at, duration_minutes, idempotency_key)
         VALUES ($1, 'running', now(), 30, 'b-private-run-key-1')`,
        [USER_B]
      );
    });
  });

  it('A không thể đọc mục tiêu, chỉ số cân nặng hay hoạt động cá nhân của B', async () => {
    const goalsOfB = await as(userA, async (tx) => {
      const { rows } = await tx.query(`SELECT * FROM public.goals WHERE user_id = $1`, [USER_B]);
      return rows;
    });
    expect(goalsOfB).toHaveLength(0);

    const obsOfB = await as(userA, async (tx) => {
      const { rows } = await tx.query(`SELECT * FROM public.observations WHERE user_id = $1`, [USER_B]);
      return rows;
    });
    expect(obsOfB).toHaveLength(0);

    const actsOfB = await as(userA, async (tx) => {
      const { rows } = await tx.query(`SELECT * FROM public.activities WHERE user_id = $1`, [USER_B]);
      return rows;
    });
    expect(actsOfB).toHaveLength(0);
  });

  it('B bật tắt Mute thông báo trong app: không làm mất quyền thành viên', async () => {
    // B gia nhập nhóm
    const tokenHash = crypto.createHash('sha256').update('token-mute-test').digest('hex');
    await as(userA, async (tx) => {
      await tx.query(`SELECT public.create_group_invite($1, $2, now() + INTERVAL '1 day', 1)`, [isolationGroupId, tokenHash]);
    });
    await as(userB, async (tx) => {
      await tx.query(`SELECT public.accept_group_invite($1)`, [tokenHash]);
    });

    // B bật Mute
    await as(userB, async (tx) => {
      await tx.query(
        `UPDATE public.group_members SET is_muted = true WHERE group_id = $1 AND user_id = $2`,
        [isolationGroupId, USER_B]
      );
    });

    const bMember = await as(userB, async (tx) => {
      const { rows } = await tx.query<{ is_muted: boolean; status: string }>(
        `SELECT is_muted, status FROM public.group_members WHERE group_id = $1 AND user_id = $2`,
        [isolationGroupId, USER_B]
      );
      return rows[0];
    });

    expect(bMember.is_muted).toBe(true);
    expect(bMember.status).toBe('active'); // Vẫn là thành viên hoạt động
  });

  it('Khi B rời nhóm hoặc tắt mute: dữ liệu nhật ký và mục tiêu cá nhân của B hoàn toàn không bị xóa', async () => {
    await as(userB, async (tx) => {
      await tx.query(`SELECT public.leave_group($1)`, [isolationGroupId]);
    });

    // Dữ liệu cá nhân của B vẫn nguyên vẹn
    const bGoals = await as(userB, async (tx) => {
      const { rows } = await tx.query(`SELECT * FROM public.goals WHERE user_id = $1`, [USER_B]);
      return rows;
    });
    expect(bGoals.length).toBeGreaterThan(0);

    const bActs = await as(userB, async (tx) => {
      const { rows } = await tx.query(`SELECT * FROM public.activities WHERE user_id = $1`, [USER_B]);
      return rows;
    });
    expect(bActs.length).toBeGreaterThan(0);
  });
});
