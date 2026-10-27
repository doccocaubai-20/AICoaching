import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Database Schema & RLS Static Verification', () => {
  const migrationPath = path.resolve(__dirname, '../../supabase/migrations/20261027000001_mvp_schema_and_rls.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  const EXPECTED_TABLES = [
    'profiles',
    'goals',
    'observations',
    'activities',
    'programs',
    'sessions',
    'session_results',
    'review_suggestions',
    'ai_consents',
    'ai_summaries',
    'ai_conversations',
    'ai_messages',
  ];

  it('tất cả 12 bảng MVP đều được khởi tạo', () => {
    for (const table of EXPECTED_TABLES) {
      const tableRegex = new RegExp(`CREATE TABLE (IF NOT EXISTS )?public\\.${table}\\b`, 'i');
      expect(tableRegex.test(sql), `Bảng public.${table} phải được định nghĩa trong migration`).toBe(true);
    }
  });

  it('tất cả 12 bảng đều được BẬT Row Level Security (ENABLE ROW LEVEL SECURITY)', () => {
    for (const table of EXPECTED_TABLES) {
      const rlsRegex = new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`, 'i');
      expect(rlsRegex.test(sql), `Bảng public.${table} phải có lệnh ENABLE ROW LEVEL SECURITY`).toBe(true);
    }
  });

  it('chính sách RLS của các bảng dữ liệu cá nhân phải kiểm tra auth.uid() = user_id', () => {
    const userOwnedTables = [
      'profiles',
      'goals',
      'observations',
      'activities',
      'session_results',
      'review_suggestions',
      'ai_consents',
      'ai_summaries',
      'ai_conversations',
      'ai_messages',
    ];

    for (const table of userOwnedTables) {
      const policyRegex = new RegExp(`CREATE POLICY "${table}_select_own" ON public\\.${table}[\\s\\S]*?auth\\.uid\\(\\) = user_id`, 'i');
      expect(policyRegex.test(sql), `Bảng public.${table} phải có SELECT policy kiểm tra auth.uid() = user_id`).toBe(true);
    }
  });

  it('tuyệt đối KHÔNG chứa bảng hoặc chính sách liên quan đến HLV (coach) hoặc chia sẻ công khai (public sharing)', () => {
    const coachRegex = /\b(coaches|coach_id|coach_feedback|trainer)\b/i;
    expect(coachRegex.test(sql), 'Tuyệt đối không có bảng/cột HLV trong MVP schema').toBe(false);

    const publicSharingRegex = /CREATE POLICY .*? FOR ALL TO public USING \(true\)/i;
    expect(publicSharingRegex.test(sql), 'Không được cấp quyền mở toàn bộ cho public').toBe(false);
  });

  it('activities và session_results có ràng buộc chống ghi trùng theo idempotency_key', () => {
    const fixesSql = fs.readFileSync(
      path.resolve(__dirname, '../../supabase/migrations/20261027000002_a_fixes_ownership_idempotency.sql'),
      'utf8'
    );
    expect(fixesSql).toMatch(/uq_activities_user_idempotency UNIQUE \(user_id, idempotency_key\)/);
    expect(fixesSql).toMatch(/uq_session_results_user_idempotency UNIQUE \(user_id, idempotency_key\)/);
  });

  it('các bảng bài tập & gợi ý & AI đều gắn cờ minh họa demo (is_demo)', () => {
    const demoTables = ['programs', 'sessions', 'session_results', 'review_suggestions', 'ai_summaries'];
    for (const table of demoTables) {
      const demoColRegex = new RegExp(`CREATE TABLE (IF NOT EXISTS )?public\\.${table}[\\s\\S]*?\\bis_demo\\b`, 'i');
      expect(demoColRegex.test(sql), `Bảng public.${table} phải có cờ is_demo rõ ràng`).toBe(true);
    }
  });
});
