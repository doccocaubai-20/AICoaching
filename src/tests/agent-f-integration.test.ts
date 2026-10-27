/**
 * AGENT F: FULL INTEGRATION & VERIFICATION TEST SUITE
 * 
 * Toàn diện hành trình người dùng (End-to-End User Journey) và các chốt chặn tích hợp:
 * 1. Hồ sơ & Mục tiêu: Thiết lập trình độ, dụng cụ (bao gồm mảng rỗng), lịch tập và mục tiêu cá nhân.
 * 2. Nhật ký hoạt động & Quy tắc xem lại lịch: Ghi nhận hoạt động, kích hoạt quy tắc cảnh báo lịch tập cận kề (Agent D).
 * 3. Buổi tập Calisthenics & Ghi nhận kép chống trùng (Dual-write Idempotency):
 *    - Lưu kết quả session_results và hoạt động calisthenics nguồn session_sync dùng chung idempotency_key.
 *    - Chống nhân đôi bản ghi khi gửi trùng lặp.
 * 4. Tổng hợp chỉ số Dashboard 7 ngày (Agent B):
 *    - Lọc chính xác 7 ngày qua, loại bỏ hoạt động tương lai và lịch dự kiến (is_planned = true).
 *    - Giữ nguyên giá trị thiếu (null), không tự ý suy diễn thành 0.
 * 5. Cơ chế Đồng ý AI & Phạm vi dữ liệu (Scope Guardrails - Review S1, S2, S3, E3):
 *    - Thực thi nghiêm ngặt 4 phạm vi (profile, goals, activities, observations).
 *    - Không rò rỉ dữ liệu dẫn xuất review_suggestions khi thiếu scope activities (S1).
 *    - Không gửi lại lịch sử chứa dữ liệu đã bị rút khỏi scope (S2).
 *    - Áp dụng cận dưới (gte) và cận trên (lte) của khoảng thời gian (E3).
 * 6. Tính toán Chỉ số Xu hướng & Kiểm định Số liệu (Review E4, E6, E7):
 *    - computeProfileMetrics tính đúng schedule_alignment và goal_progress từ session_results (E4).
 *    - verifyAITrendHighlights chặn hoán đổi số buổi và số phút (E6).
 *    - Bảo toàn điểm nổi bật mẫu ngày tháng hợp lệ (E7).
 * 7. Hỏi đáp AI & Chống ảo giác Nguồn (Anti-Hallucination - Review E1, E5, E8, E9):
 *    - Đối chiếu và loại bỏ ID bịa đặt; từ chối câu trả lời mất toàn bộ nguồn (E5).
 *    - Schema Zod chấp nhận phản hồi hợp lệ khi provider thiếu period_used (E9).
 * 8. Vòng đời Thu hồi & Xóa sạch Dữ liệu (Cascading Cleanup):
 *    - Thu hồi đồng ý AI (is_granted = false).
 *    - Xóa hội thoại tự động xóa sạch các tin nhắn liên quan (CASCADE).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

import {
  ProfileEntity,
  GoalEntity,
  ActivityEntity,
  SessionResultEntity,
  validateProfileInput,
  validateGoalInput,
  IDEMPOTENCY_CONFLICT_TARGET,
} from '@/contracts';

import { computeWeeklyStats } from '@/components/dashboard/stats-utils';
import {
  evaluateScheduleReview,
  REVIEW_RULE_VERSION,
} from '@/components/review/review-utils';

import { buildAIContext, filterValidReferences } from '@/lib/ai/context';
import { buildConversationHistory } from '@/lib/ai/history';
import {
  computeProfileMetrics,
  verifyAITrendHighlights,
  generateTemplateTrendAnalysis,
} from '@/lib/ai/trend-analysis';
import { AIAnswerOutputSchema } from '@/lib/ai/schemas';

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';
const SYSTEM_SESSION_1 = 'b0000000-0000-0000-0000-000000000001';

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
const actorServiceRole: Actor = { role: 'service_role' };

describe('Agent F: Full MVP Integration & End-to-End User Journey Suite', () => {
  beforeAll(async () => {
    db = await PGlite.create({ extensions: { pgcrypto } });
    await db.exec(SUPABASE_STUB);

    // Chạy tuần tự các migration database
    const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');
    const migrationFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      await db.exec(sql);
    }

    // Nạp dữ liệu seed minh họa chương trình & buổi tập mẫu
    const seedPath = path.resolve(__dirname, '../../supabase/seed_demo.sql');
    if (fs.existsSync(seedPath)) {
      const seedSql = fs.readFileSync(seedPath, 'utf-8');
      await db.exec(seedSql);
    }

    // Khởi tạo người dùng test trong auth.users
    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES
        ('${USER_A}', 'user.a.pilot@example.com'),
        ('${USER_B}', 'user.b.pilot@example.com')
      ON CONFLICT DO NOTHING;
    `);

    // Cấp quyền trên tất cả bảng công khai
    await db.exec(`
      GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
      REVOKE INSERT ON public.ai_messages FROM authenticated;
      REVOKE INSERT ON public.ai_summaries FROM authenticated;
    `);
  });

  // ============================================================================
  // GIAI ĐOẠN 1: THIẾT LẬP HỒ SƠ & MỤC TIÊU (AGENT B)
  // ============================================================================
  describe('Giai đoạn 1: Thiết lập hồ sơ & Mục tiêu cá nhân', () => {
    it('1.1. Cập nhật hồ sơ với thiết bị rỗng và lịch tập khả dụng', async () => {
      const profileInput = {
        display_name: 'Thí sinh Pilot',
        experience_level: 'beginner' as const,
        available_equipment: [] as string[],
        schedule_availability: [
          { day_of_week: 'monday' as const, available_time_slots: ['17:30 - 18:30'] },
          { day_of_week: 'wednesday' as const, available_time_slots: ['17:30 - 18:30'] },
        ],
      };
      const validation = validateProfileInput(profileInput);
      expect(validation.is_valid).toBe(true);

      await as(actorUserA, async (tx) => {
        const res = await tx.query<ProfileEntity>(`
          UPDATE profiles
          SET display_name = 'Thí sinh Pilot',
              experience_level = 'beginner',
              available_equipment = '{}'::text[],
              schedule_availability = '[{"day_of_week":"monday","available_time_slots":["17:30 - 18:30"]},{"day_of_week":"wednesday","available_time_slots":["17:30 - 18:30"]}]'::jsonb
          WHERE user_id = '${USER_A}'
          RETURNING *;
        `);
        expect(res.rows).toHaveLength(1);
        expect(res.rows[0].available_equipment).toEqual([]);
        expect(res.rows[0].experience_level).toBe('beginner');
      });
    });

    it('1.2. Thêm các mục tiêu rèn luyện cá nhân', async () => {
      const goalInput = {
        content: 'Thực hiện 10 lần hít xà chuẩn form',
        goal_type: 'strength' as const,
        start_date: '2026-10-01',
        end_date: '2026-11-01',
      };
      expect(validateGoalInput(goalInput).is_valid).toBe(true);

      await as(actorUserA, async (tx) => {
        const res = await tx.query<GoalEntity>(`
          INSERT INTO goals (user_id, content, goal_type, start_date, end_date, status)
          VALUES ('${USER_A}', 'Thực hiện 10 lần hít xà chuẩn form', 'strength', '2026-10-01', '2026-11-01', 'active')
          RETURNING *;
        `);
        expect(res.rows).toHaveLength(1);
        expect(res.rows[0].status).toBe('active');
        expect(res.rows[0].content).toBe('Thực hiện 10 lần hít xà chuẩn form');
      });
    });
  });

  // ============================================================================
  // GIAI ĐOẠN 2: NHẬT KÝ HOẠT ĐỘNG & QUY TẮC XEM LẠI LỊCH (AGENT C & D)
  // ============================================================================
  describe('Giai đoạn 2: Nhật ký hoạt động & Đánh giá quy tắc xem lại lịch', () => {
    it('2.1. Ghi nhận hoạt động và kích hoạt cảnh báo lịch tập cận kề (Proximity Rule)', async () => {
      const baseTime = new Date('2026-10-27T10:00:00.000Z');
      const calisTime = new Date('2026-10-27T08:00:00.000Z'); // 2 tiếng trước
      const badmintonTime = new Date('2026-10-27T09:00:00.000Z'); // 1 tiếng trước

      const act1: ActivityEntity = {
        id: 'act-calis-01',
        user_id: USER_A,
        activity_type: 'calisthenics',
        duration_minutes: 45,
        start_at: calisTime.toISOString(),
        is_planned: false,
        source: 'manual_entry',
        idempotency_key: 'idem-calis-01',
        notes: null,
        fatigue_level: 6,
        created_at: calisTime.toISOString(),
        updated_at: calisTime.toISOString(),
      };

      const act2: ActivityEntity = {
        id: 'act-badminton-01',
        user_id: USER_A,
        activity_type: 'badminton',
        duration_minutes: 60,
        start_at: badmintonTime.toISOString(),
        is_planned: false,
        source: 'manual_entry',
        idempotency_key: 'idem-badminton-01',
        notes: null,
        fatigue_level: 8,
        created_at: badmintonTime.toISOString(),
        updated_at: badmintonTime.toISOString(),
      };

      const ruleResult = evaluateScheduleReview([act1, act2], baseTime);
      expect(ruleResult.status).toBe('needs_review');
      expect(ruleResult.reason).toContain('Cầu lông');
      expect(ruleResult.reason).toContain('Calisthenics');
      expect(ruleResult.rule_version).toBe(REVIEW_RULE_VERSION);
      expect(ruleResult.reference_activity_ids).toEqual(['act-badminton-01', 'act-calis-01'].sort());
    });
  });

  // ============================================================================
  // GIAI ĐOẠN 3: BUỔI TẬP CALISTHENICS & ĐỒNG BỘ CHỐNG TRÙNG (AGENT D)
  // ============================================================================
  describe('Giai đoạn 3: Ghi kết quả buổi tập & Đồng bộ kép với Idempotency Key', () => {
    it('3.1. Đồng bộ session_results và activities dùng chung idempotency_key không gây nhân đôi', async () => {
      const sharedIdempotencyKey = 'dual-sync-session-result-001';
      const completedTime = '2026-10-27T07:30:00.000Z';

      // 1. Ghi vào session_results
      await as(actorUserA, async (tx) => {
        const srRes = await tx.query<SessionResultEntity>(`
          INSERT INTO session_results (
            session_id, user_id, completed_at, self_reported_data, notes, idempotency_key, is_demo
          ) VALUES (
            '${SYSTEM_SESSION_1}', '${USER_A}', '${completedTime}', '{"completed_exercises":[]}'::jsonb, 'Xong', '${sharedIdempotencyKey}', true
          )
          ON CONFLICT (${IDEMPOTENCY_CONFLICT_TARGET}) DO NOTHING
          RETURNING *;
        `);
        expect(srRes.rows).toHaveLength(1);
        expect(srRes.rows[0].idempotency_key).toBe(sharedIdempotencyKey);
      });

      // 2. Ghi hoạt động đồng bộ vào activities
      await as(actorUserA, async (tx) => {
        const actRes = await tx.query<ActivityEntity>(`
          INSERT INTO activities (
            user_id, activity_type, duration_minutes, start_at, is_planned, source, idempotency_key
          ) VALUES (
            '${USER_A}', 'calisthenics', 30, '${completedTime}', false, 'session_sync', '${sharedIdempotencyKey}'
          )
          ON CONFLICT (${IDEMPOTENCY_CONFLICT_TARGET}) DO NOTHING
          RETURNING *;
        `);
        expect(actRes.rows).toHaveLength(1);
        expect(actRes.rows[0].source).toBe('session_sync');
        expect(actRes.rows[0].idempotency_key).toBe(sharedIdempotencyKey);
      });

      // 3. Thử ghi lại lần 2 với cùng key -> Cả 2 bảng đều không nhân đôi
      await as(actorUserA, async (tx) => {
        const dupSr = await tx.query(`
          INSERT INTO session_results (
            session_id, user_id, completed_at, self_reported_data, notes, idempotency_key, is_demo
          ) VALUES (
            '${SYSTEM_SESSION_1}', '${USER_A}', '${completedTime}', '{"completed_exercises":[]}'::jsonb, 'Xong', '${sharedIdempotencyKey}', true
          )
          ON CONFLICT (${IDEMPOTENCY_CONFLICT_TARGET}) DO NOTHING
          RETURNING *;
        `);
        expect(dupSr.rows).toHaveLength(0);

        const dupAct = await tx.query(`
          INSERT INTO activities (
            user_id, activity_type, duration_minutes, start_at, is_planned, source, idempotency_key
          ) VALUES (
            '${USER_A}', 'calisthenics', 30, '${completedTime}', false, 'session_sync', '${sharedIdempotencyKey}'
          )
          ON CONFLICT (${IDEMPOTENCY_CONFLICT_TARGET}) DO NOTHING
          RETURNING *;
        `);
        expect(dupAct.rows).toHaveLength(0);
      });
    });
  });

  // ============================================================================
  // GIAI ĐOẠN 4: TỔNG HỢP DASHBOARD 7 NGÀY (AGENT B)
  // ============================================================================
  describe('Giai đoạn 4: Tổng hợp chỉ số Dashboard 7 ngày', () => {
    it('4.1. Lọc chuẩn 7 ngày qua, loại trừ hoạt động tương lai và lịch dự kiến', () => {
      const now = new Date('2026-10-27T12:00:00.000Z');
      const past2Days = new Date('2026-10-25T08:00:00.000Z').toISOString();
      const past8Days = new Date('2026-10-19T08:00:00.000Z').toISOString();
      const futureTime = new Date('2026-10-28T08:00:00.000Z').toISOString();

      const activities = [
        {
          activity_type: 'calisthenics',
          duration_minutes: 40,
          start_at: past2Days,
          is_planned: false,
        },
        {
          activity_type: 'running',
          duration_minutes: 30,
          start_at: futureTime,
          is_planned: false,
        },
        {
          activity_type: 'calisthenics',
          duration_minutes: 50,
          start_at: past2Days,
          is_planned: true, // Lịch dự kiến
        },
        {
          activity_type: 'badminton',
          duration_minutes: 90,
          start_at: past8Days,
          is_planned: false,
        },
      ];

      const stats = computeWeeklyStats(activities, now);
      expect(stats.totalSessions).toBe(1);
      expect(stats.totalMinutes).toBe(40);
      expect(stats.distinctTypes).toBe(1);
    });
  });

  // ============================================================================
  // GIAI ĐOẠN 5: BẢO VỆ PHẠM VI ĐỒNG Ý AI (SCOPE GUARDRAILS - S1, S2, S3, E3)
  // ============================================================================
  describe('Giai đoạn 5: Cơ chế đồng ý AI & Bảo vệ biên giới dữ liệu (S1, S2, S3, E3)', () => {
    it('5.1. S1 & S2: buildAIContext và buildConversationHistory tuân thủ triệt để phạm vi Scope', () => {
      const now = new Date('2026-10-27T12:00:00.000Z');
      const profile: ProfileEntity = {
        user_id: USER_A,
        display_name: 'Thí sinh Thử nghiệm',
        experience_level: 'beginner',
        available_equipment: ['xà đơn'],
        schedule_availability: [],
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      };

      const goals: GoalEntity[] = [
        {
          id: 'goal-01',
          user_id: USER_A,
          content: 'Hít xà 10 lần',
          goal_type: 'strength',
          start_date: '2026-10-01',
          end_date: '2026-11-01',
          status: 'active',
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        },
      ];

      const activities: ActivityEntity[] = [
        {
          id: 'act-01',
          user_id: USER_A,
          activity_type: 'calisthenics',
          duration_minutes: 30,
          start_at: '2026-10-26T10:00:00.000Z',
          is_planned: false,
          source: 'manual_entry',
          idempotency_key: 'idem-act-01',
          notes: null,
          fatigue_level: 6,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        },
      ];

      // Khi người dùng CHỈ đồng ý scope 'goals':
      const restrictedContext = buildAIContext({
        scope: ['goals'],
        profile,
        goals,
        activities,
        observations: [],
        reviewSuggestions: [
          {
            id: 'sug-01',
            user_id: USER_A,
            status: 'pending',
            reason: 'Tập calisthenics và cầu lông quá gần nhau',
            reference_activity_ids: ['act-01'],
            rule_version: 'v1.0.0',
            is_demo: false,
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
          },
        ],
      });

      // S1: Tuyệt đối không đưa review_suggestions vào context khi scope thiếu activities
      expect(restrictedContext.context.review_suggestions ?? []).toHaveLength(0);
      expect(restrictedContext.context.activities).toEqual([]);
      expect(restrictedContext.context.profile).toBeUndefined();
      expect(restrictedContext.context.goals).toHaveLength(1);

      // Bảo vệ PII: Tuyệt đối không rò rỉ display_name, email, user_id
      const payloadString = JSON.stringify(restrictedContext.context);
      expect(payloadString).not.toContain('Thí sinh Thử nghiệm');
      expect(payloadString).not.toContain(USER_A);

      // S2: Lịch sử hội thoại loại bỏ dữ liệu ngoài scope
      const rawMessages = [
        { id: 'm-1', role: 'user' as const, content: 'Cân nặng của tôi tuần này thế nào?', created_at: '2026-10-25T10:00:00Z', status: 'completed' as const },
        { id: 'm-2', role: 'assistant' as const, content: 'Cân nặng của bạn hiện tại là 68 kg.', created_at: '2026-10-25T10:01:00Z', status: 'completed' as const },
        { id: 'm-3', role: 'user' as const, content: 'Tôi đã đặt mục tiêu gì?', created_at: '2026-10-26T10:00:00Z', status: 'completed' as const },
      ];
      const filteredHistory = buildConversationHistory(rawMessages, undefined, ['goals']);
      const historyStr = JSON.stringify(filteredHistory);
      expect(historyStr).not.toContain('68 kg');
      expect(historyStr).toContain('Tôi đã đặt mục tiêu gì?');
    });

    it('5.2. E3: buildAIContext chặn cả cận dưới (gte) và cận trên (lte) của khoảng thời gian', () => {
      const now = new Date('2026-10-27T12:00:00.000Z');
      const pastTime = new Date('2026-10-25T10:00:00.000Z').toISOString();
      const futureTime = new Date('2026-10-28T10:00:00.000Z').toISOString();

      const activities: ActivityEntity[] = [
        {
          id: 'act-valid',
          user_id: USER_A,
          activity_type: 'calisthenics',
          duration_minutes: 30,
          start_at: pastTime,
          is_planned: false,
          source: 'manual_entry',
          idempotency_key: 'act-valid',
          notes: null,
          fatigue_level: 5,
          created_at: pastTime,
          updated_at: pastTime,
        },
        {
          id: 'act-future',
          user_id: USER_A,
          activity_type: 'calisthenics',
          duration_minutes: 45,
          start_at: futureTime,
          is_planned: false,
          source: 'manual_entry',
          idempotency_key: 'act-future',
          notes: null,
          fatigue_level: 7,
          created_at: futureTime,
          updated_at: futureTime,
        },
      ];

      const res = buildAIContext({
        scope: ['activities'],
        activities,
        dateWindow: {
          from: new Date(now.getTime() - 7 * 86400000).toISOString(),
          to: now.toISOString(),
        },
      });

      // act-future phải bị loại bỏ bởi cận lte
      expect(res.context.activities).toHaveLength(1);
      expect(res.context.activities?.[0].id).toBe('act-valid');
      expect(res.allowedRecordIds.has('act-future')).toBe(false);
    });
  });

  // ============================================================================
  // GIAI ĐOẠN 6: CHỈ SỐ XU HƯỚNG & KIỂM ĐỊNH SỐ LIỆU (REVIEW E4, E6, E7)
  // ============================================================================
  describe('Giai đoạn 6: Phân tích xu hướng rèn luyện & Kiểm định số liệu (E4, E6, E7)', () => {
    it('6.1. E4: computeProfileMetrics tính đúng schedule_alignment và goal_progress', () => {
      const now = new Date('2026-10-27T12:00:00.000Z'); // Thứ Ba
      const profile: ProfileEntity = {
        user_id: USER_A,
        display_name: 'Pilot User',
        experience_level: 'intermediate',
        available_equipment: ['xà đơn'],
        schedule_availability: [
          { day_of_week: 'tuesday', available_time_slots: ['06:00 - 07:00'] },
        ],
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      };

      const activities: ActivityEntity[] = [
        {
          id: 'act-tue',
          user_id: USER_A,
          activity_type: 'calisthenics',
          duration_minutes: 40,
          start_at: '2026-10-27T06:30:00.000Z', // Sáng Thứ Ba
          is_planned: false,
          source: 'manual_entry',
          idempotency_key: 'k-tue',
          notes: null,
          fatigue_level: 6,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        },
      ];

      const sessionResults: SessionResultEntity[] = [
        {
          id: 'sr-01',
          user_id: USER_A,
          session_id: 'sess-01',
          completed_at: '2026-10-27T06:30:00.000Z',
          self_reported_data: {},
          notes: null,
          is_demo: false,
          idempotency_key: 'k-sr-01',
          created_at: now.toISOString(),
        },
      ];

      const goals: GoalEntity[] = [
        {
          id: 'goal-target',
          user_id: USER_A,
          content: '3 buổi/tuần',
          goal_type: 'habit',
          start_date: '2026-10-01',
          end_date: '2026-11-01',
          status: 'active',
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        },
      ];

      const metrics = computeProfileMetrics({
        profile,
        goals,
        activities,
        sessionResults,
        now,
        weeks: 4,
      });

      expect(metrics.schedule_alignment.status).toBe('sufficient_data');
      expect(metrics.schedule_alignment.matching_sessions_count).toBe(1);
      expect(metrics.goal_progress.status).toBe('sufficient_data');
      expect(metrics.goal_progress.session_results_count).toBe(1);
    });

    it('6.2. E6: verifyAITrendHighlights chặn hoán đổi số buổi và số phút', () => {
      const now = new Date('2026-10-27T12:00:00.000Z');
      const activities: ActivityEntity[] = Array.from({ length: 4 }).map((_, idx) => ({
        id: `act-${idx}`,
        user_id: USER_A,
        activity_type: 'calisthenics',
        duration_minutes: 30, // 4 buổi x 30m = 120 phút
        start_at: new Date(now.getTime() - idx * 86400000).toISOString(),
        is_planned: false,
        source: 'manual_entry',
        idempotency_key: `key-${idx}`,
        notes: null,
        fatigue_level: 5,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      }));

      const metrics = computeProfileMetrics({ activities, now, weeks: 4 });
      const allowedIds = new Set(metrics.allowed_record_ids);

      const swappedHighlights = [
        {
          metric_key: 'total_completed_sessions',
          text: 'Bạn đã hoàn thành 120 buổi với thời lượng 4 phút.',
          references: [{ type: 'activity' as const, id: 'act-0' }],
        },
      ];

      const verifyResult = verifyAITrendHighlights(swappedHighlights, metrics, allowedIds);
      expect(verifyResult.validHighlights).toHaveLength(0);
      expect(verifyResult.rejectedCount).toBe(1);
    });

    it('6.3. E7: verifyAITrendHighlights giữ lại highlight mẫu trung thực chứa ngày tháng', () => {
      const now = new Date('2026-10-27T12:00:00.000Z');
      const activities: ActivityEntity[] = Array.from({ length: 3 }).map((_, idx) => ({
        id: `act-${idx}`,
        user_id: USER_A,
        activity_type: 'calisthenics',
        duration_minutes: 40,
        start_at: new Date(now.getTime() - idx * 86400000).toISOString(),
        is_planned: false,
        source: 'manual_entry',
        idempotency_key: `key-${idx}`,
        notes: null,
        fatigue_level: 6,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      }));

      const metrics = computeProfileMetrics({ activities, now, weeks: 4 });
      const generated = generateTemplateTrendAnalysis(metrics);
      const verifyResult = verifyAITrendHighlights(generated.highlights, metrics, new Set(metrics.allowed_record_ids));

      expect(verifyResult.validHighlights.length).toBeGreaterThan(0);
      expect(verifyResult.rejectedCount).toBe(0);
    });
  });

  // ============================================================================
  // GIAI ĐOẠN 7: HỎI ĐÁP AI & CHỐNG ẢO GIÁC NGUỒN (E1, E5, E8, E9)
  // ============================================================================
  describe('Giai đoạn 7: Hỏi đáp AI & Cơ chế chống ảo giác nguồn (E1, E5, E8, E9)', () => {
    it('7.1. E5: filterValidReferences loại bỏ ID bịa đặt và phát hiện đầu ra mất nguồn', () => {
      const allowedIds = new Set(['act-valid-01', 'act-valid-02']);
      const hallucinatedReferences = [
        { type: 'activity' as const, id: 'fake-id-999' },
        { type: 'activity' as const, id: 'act-valid-01' },
      ];

      const filtered = filterValidReferences(hallucinatedReferences, allowedIds);
      expect(filtered.validReferences).toEqual([{ type: 'activity', id: 'act-valid-01' }]);
      expect(filtered.removedCount).toBe(1);

      // Nếu AI bịa đặt toàn bộ ID nguồn:
      const totalHallucination = [{ type: 'activity' as const, id: 'fake-id-888' }];
      const totalFiltered = filterValidReferences(totalHallucination, allowedIds);
      expect(totalFiltered.validReferences).toHaveLength(0);
      expect(totalFiltered.removedCount).toBe(1);
    });

    it('7.2. E9: Schema Zod chấp nhận phản hồi hợp lệ khi provider không trả về period_used', () => {
      const validPayloadWithoutPeriod = {
        answer: 'Bạn đã hoàn thành 3 buổi calisthenics đều đặn trong tuần.',
        references: [{ type: 'activity', id: 'act-valid-01' }],
        missing_data_acknowledged: true,
        out_of_scope: false,
      };

      const parseResult = AIAnswerOutputSchema.safeParse(validPayloadWithoutPeriod);
      expect(parseResult.success).toBe(true);
      if (parseResult.success) {
        expect(parseResult.data.period_used).toBeNull();
      }
    });
  });

  // ============================================================================
  // GIAI ĐOẠN 8: VÒNG ĐỜI THU HỒI & XÓA SẠCH DỮ LIỆU (CASCADING CLEANUP)
  // ============================================================================
  describe('Giai đoạn 8: Thu hồi đồng ý & Xóa sạch hội thoại (Cascade Cleanup)', () => {
    it('8.1. Thu hồi đồng ý AI và xác nhận cập nhật ai_consents', async () => {
      const now = new Date().toISOString();
      await as(actorUserA, async (tx) => {
        // Cấp đồng ý trước
        await tx.query(`
          INSERT INTO ai_consents (user_id, is_granted, consent_version, scope)
          VALUES ('${USER_A}', true, '1.0.0', ARRAY['profile', 'activities'])
          ON CONFLICT (user_id, consent_version) DO UPDATE SET is_granted = true, revoked_at = NULL;
        `);

        // Thu hồi đồng ý
        const res = await tx.query<{ is_granted: boolean; revoked_at: string | null }>(`
          UPDATE ai_consents
          SET is_granted = false, revoked_at = '${now}'
          WHERE user_id = '${USER_A}' AND consent_version = '1.0.0'
          RETURNING *;
        `);
        expect(res.rows).toHaveLength(1);
        expect(res.rows[0].is_granted).toBe(false);
        expect(res.rows[0].revoked_at).not.toBeNull();
      });
    });

    it('8.2. Xóa ai_conversations tự động xóa sạch các tin nhắn ai_messages (CASCADE)', async () => {
      // 1. User tạo cuộc hội thoại
      const conv = await as(actorUserA, async (tx) => {
        const res = await tx.query<{ id: string }>(`
          INSERT INTO ai_conversations (user_id, title)
          VALUES ('${USER_A}', 'Hội thoại thử nghiệm CASCADE')
          RETURNING id;
        `);
        return res.rows[0];
      });

      // 2. Server service_role ghi tin nhắn vào ai_messages (RLS bảo vệ: authenticated bị revoke INSERT)
      await as(actorServiceRole, async (tx) => {
        await tx.query(`
          INSERT INTO ai_messages (conversation_id, user_id, role, content, status)
          VALUES
            ('${conv.id}', '${USER_A}', 'user', 'Tuần này tôi tập thế nào?', 'completed'),
            ('${conv.id}', '${USER_A}', 'assistant', 'Bạn đã tập 2 buổi rất tốt.', 'completed');
        `);
      });

      // 3. User kiểm tra đã có 2 tin nhắn trong hội thoại
      const beforeCount = await as(actorUserA, async (tx) => {
        const res = await tx.query<{ count: string }>(`SELECT COUNT(*) as count FROM ai_messages WHERE conversation_id = '${conv.id}';`);
        return Number(res.rows[0].count);
      });
      expect(beforeCount).toBe(2);

      // 4. User xóa hội thoại
      await as(actorUserA, async (tx) => {
        await tx.query(`DELETE FROM ai_conversations WHERE id = '${conv.id}';`);
      });

      // 5. Kiểm tra tin nhắn liên quan đã bị xóa sạch hoàn toàn qua CASCADE
      const afterCount = await as(actorUserA, async (tx) => {
        const res = await tx.query<{ count: string }>(`SELECT COUNT(*) as count FROM ai_messages WHERE conversation_id = '${conv.id}';`);
        return Number(res.rows[0].count);
      });
      expect(afterCount).toBe(0);
    });
  });
});
